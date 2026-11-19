import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@bosla/db';
import {
  bulkApproveCommissionsSchema,
  commissionReviewDecisionSchema,
  computeProportionalCommissionReversal,
  createSettlementSchema,
  failPayoutSchema,
  financialExpenseSchema,
  getCairoMonthBoundsUtc,
  getCairoWallClockParts,
  markPayoutSchema,
  piastersToDecimalString,
  refundRequestSchema,
  toPiasters,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';

@Injectable()
export class RefundSettlementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private async assertPeriodOpen(date: Date) {
    const parts = getCairoWallClockParts(date);
    const closed = await this.prisma.accountingPeriodClose.findUnique({
      where: {
        periodYear_periodMonth: { periodYear: parts.year, periodMonth: parts.month },
      },
    });
    if (closed?.isClosed) {
      throw new ForbiddenException(
        `الفترة المحاسبية (${parts.year}-${String(parts.month).padStart(2, '0')}) مغلقة ولا يمكن تعديل معاملاتها بأثر رجعي`,
      );
    }
  }

  // ============================================================
  // 1. REFUNDS & CHARGEBACKS (CONCURRENCY-SAFE, PROPORTIONAL OR FULL REVERSAL)
  // ============================================================

  async processRefund(actor: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = refundRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الاسترداد غير صالحة');
    }

    const data = parsed.data;
    const requestedRefundPiasters = toPiasters(data.refundAmountEgp);
    if (requestedRefundPiasters <= 0) {
      throw new BadRequestException('مبلغ الاسترداد يجب أن يكون أكبر من صفر');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        // Lock the Order row strictly to defeat concurrent double-refund race conditions (AT-060)
        await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${data.orderId} FOR UPDATE`;

        const order = await tx.order.findUnique({
          where: { id: data.orderId },
          include: {
            seller: { select: { id: true, userId: true } },
            items: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: { commission: true },
            },
          },
        });
        if (!order) throw new NotFoundException('الطلب غير موجود');

        const orderPaidPiasters = toPiasters(order.paidAmount.toString());
        const orderRefundedPiasters = toPiasters(order.refundedAmount.toString());
        const maxOrderRefundable = orderPaidPiasters - orderRefundedPiasters;
        if (maxOrderRefundable <= 0 || requestedRefundPiasters > maxOrderRefundable) {
          throw new BadRequestException(
            `مبلغ الاسترداد يتجاوز الرصيد القابل للاسترداد (${piastersToDecimalString(Math.max(0, maxOrderRefundable))} ج.م)`,
          );
        }

        const targetItems = data.orderItemId
          ? order.items.filter((i) => i.id === data.orderItemId)
          : order.items.filter(
              (i) =>
                toPiasters(i.allocatedPaidAmount.toString()) - toPiasters(i.refundedAmount.toString()) > 0,
            );

        if (targetItems.length === 0) {
          throw new BadRequestException('لا يوجد بند مدفوع قابل للاسترداد في هذا الطلب');
        }

        if (data.orderItemId) {
          const item = targetItems[0];
          const itemRemaining =
            toPiasters(item.allocatedPaidAmount.toString()) - toPiasters(item.refundedAmount.toString());
          if (requestedRefundPiasters > itemRemaining) {
            throw new BadRequestException(
              `مبلغ الاسترداد يتجاوز المبلغ المحصّل المتبقي للبند (${piastersToDecimalString(itemRemaining)} ج.م)`,
            );
          }
        }

        let remainingToRefund = requestedRefundPiasters;
        let totalCommissionReversedPiasters = 0;
        const createdDebits: string[] = [];
        const now = new Date();

        // Create the refund audit record first so ReversalDebits can reference refundId
        const refundRecord = await tx.orderRefund.create({
          data: {
            orderId: order.id,
            orderItemId: data.orderItemId ?? null,
            refundType: data.refundType,
            refundAmount: piastersToDecimalString(requestedRefundPiasters),
            commissionReversedAmount: '0.00',
            revokeAccess: data.revokeAccess || data.refundType === 'FULL' || data.refundType === 'CHARGEBACK',
            reasonAr: data.reasonAr,
            processedById: actor.id,
          },
        });

        for (const item of targetItems) {
          if (remainingToRefund <= 0) break;
          const itemAllocated = toPiasters(item.allocatedPaidAmount.toString());
          const itemPriorRefunded = toPiasters(item.refundedAmount.toString());
          const itemAvailable = itemAllocated - itemPriorRefunded;
          if (itemAvailable <= 0) continue;

          const itemRefundNow = Math.min(remainingToRefund, itemAvailable);
          remainingToRefund -= itemRefundNow;

          const newItemRefunded = itemPriorRefunded + itemRefundNow;
          const isItemFullyRefunded = newItemRefunded >= itemAllocated;
          const shouldRevokeAccess =
            isItemFullyRefunded || data.revokeAccess || data.refundType === 'CHARGEBACK';

          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              refundedAmount: piastersToDecimalString(newItemRefunded),
              ...(shouldRevokeAccess ? { entitlementRevokedAt: now } : {}),
            },
          });

          if (shouldRevokeAccess) {
            await tx.directPurchase.updateMany({
              where: {
                userId: order.userId,
                targetType: 'COURSE',
                courseId: item.courseId,
                status: 'ACTIVE',
              },
              data: { status: 'CANCELLED', revokedAt: now },
            });
          }

          // Commission reversal logic (v1.2 §3): full reversal on 100% refund / access revoke / chargeback,
          // proportional exact piaster reversal on partial refund without access revocation.
          if (item.commission) {
            const comm = item.commission;
            const appliedPiasters = toPiasters(comm.appliedAmount.toString());
            const priorReversedPiasters = toPiasters(comm.reversedAmount.toString());
            const remainingCommPiasters = Math.max(0, appliedPiasters - priorReversedPiasters);

            if (remainingCommPiasters > 0) {
              let reversalDeltaPiasters = 0;
              if (shouldRevokeAccess || isItemFullyRefunded) {
                reversalDeltaPiasters = remainingCommPiasters;
              } else {
                const prop = computeProportionalCommissionReversal({
                  appliedCommissionPiasters: appliedPiasters,
                  alreadyReversedPiasters: priorReversedPiasters,
                  refundAmountPiasters: itemRefundNow,
                  netItemAmountPiasters: itemAllocated,
                  priorRefundedItemPiasters: itemPriorRefunded,
                  revokeAccess: false,
                });
                reversalDeltaPiasters = prop.reversalPiasters;
              }

              if (reversalDeltaPiasters > 0) {
                totalCommissionReversedPiasters += reversalDeltaPiasters;
                const newReversed = priorReversedPiasters + reversalDeltaPiasters;
                const newNet = Math.max(0, appliedPiasters - newReversed);

                if (comm.status === 'PAID') {
                  // Commission was already paid out -> create ReversalDebit for next settlement (AT-029, AT-078)
                  const debit = await tx.reversalDebit.create({
                    data: {
                      sellerId: comm.sellerId,
                      commissionId: comm.id,
                      refundId: refundRecord.id,
                      originalAmount: piastersToDecimalString(reversalDeltaPiasters),
                      settledAmount: '0.00',
                      remainingAmount: piastersToDecimalString(reversalDeltaPiasters),
                      reasonAr: `خصم عكس عمولة بعد الصرف بسبب استرداد (${data.refundType}): ${data.reasonAr}`,
                    },
                  });
                  createdDebits.push(debit.id);

                  await tx.sellerCommission.update({
                    where: { id: comm.id },
                    data: {
                      reversedAmount: piastersToDecimalString(newReversed),
                      netAmount: piastersToDecimalString(newNet),
                    },
                  });

                  await tx.commissionStatusHistory.create({
                    data: {
                      commissionId: comm.id,
                      fromStatus: 'PAID',
                      toStatus: 'PAID',
                      changedById: actor.id,
                      reasonAr: `تسجيل مديونية عكس عمولة (ReversalDebit) بقيمة ${piastersToDecimalString(reversalDeltaPiasters)} ج.م بعد الصرف`,
                      metadata: { refundId: refundRecord.id, reversalDebitId: debit.id },
                    },
                  });
                } else {
                  const nextCommStatus = newNet === 0 ? 'REVERSED' : comm.status;
                  await tx.sellerCommission.update({
                    where: { id: comm.id },
                    data: {
                      reversedAmount: piastersToDecimalString(newReversed),
                      netAmount: piastersToDecimalString(newNet),
                      status: nextCommStatus,
                    },
                  });

                  await tx.commissionStatusHistory.create({
                    data: {
                      commissionId: comm.id,
                      fromStatus: comm.status,
                      toStatus: nextCommStatus,
                      changedById: actor.id,
                      reasonAr: `عكس عمولة بقيمة ${piastersToDecimalString(reversalDeltaPiasters)} ج.م بسبب استرداد (${data.refundType}): ${data.reasonAr}`,
                      metadata: {
                        refundId: refundRecord.id,
                        reversalDelta: piastersToDecimalString(reversalDeltaPiasters),
                        newNet: piastersToDecimalString(newNet),
                      },
                    },
                  });
                }
              }
            }
          }
        }

        const newOrderRefunded = orderRefundedPiasters + requestedRefundPiasters;
        const nextOrderStatus = newOrderRefunded >= orderPaidPiasters ? 'REFUNDED' : order.status;

        await tx.order.update({
          where: { id: order.id },
          data: {
            refundedAmount: piastersToDecimalString(newOrderRefunded),
            status: nextOrderStatus,
          },
        });

        const updatedRefund = await tx.orderRefund.update({
          where: { id: refundRecord.id },
          data: {
            commissionReversedAmount: piastersToDecimalString(totalCommissionReversedPiasters),
          },
        });

        if (order.seller && totalCommissionReversedPiasters > 0) {
          await tx.notification.createMany({
            data: [
              {
                userId: order.seller.userId,
                type: 'ORDER_REFUND_UPDATED',
                titleAr: 'تحديث عمولة بسبب استرداد طلب',
                bodyAr: `تم عكس ${piastersToDecimalString(totalCommissionReversedPiasters)} ج.م من عمولات الطلب ${order.orderNumber} نتيجة عملية استرداد.`,
                actionUrl: '/seller',
                dedupKey: `refund-seller-${refundRecord.id}`,
              },
            ],
            skipDuplicates: true,
          });
        }

        return {
          refund: updatedRefund,
          totalCommissionReversedEgp: Number(piastersToDecimalString(totalCommissionReversedPiasters)),
          createdReversalDebitIds: createdDebits,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((err: any) => {
      const code = err?.code || err?.meta?.code;
      if (code === 'P2034' || code === '40001') {
        throw new ConflictException('يوجد استرداد متزامن قيد المعالجة لهذا الطلب');
      }
      throw err;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ORDER_REFUND_PROCESSED',
      entityType: 'OrderRefund',
      entityId: result.refund.id,
      metadata: {
        orderId: data.orderId,
        orderItemId: data.orderItemId ?? null,
        refundType: data.refundType,
        refundAmountEgp: data.refundAmountEgp,
        commissionReversedEgp: result.totalCommissionReversedEgp,
        createdReversalDebitIds: result.createdReversalDebitIds,
        reasonAr: data.reasonAr,
      },
      ipAddress,
    });

    return result;
  }

  // ============================================================
  // 2. COMMISSION APPROVAL, DISPUTE & REVIEW
  // ============================================================

  async listCommissions(params: { status?: string; sellerId?: string; courseId?: string }) {
    return this.prisma.sellerCommission.findMany({
      where: {
        ...(params.status ? { status: params.status as any } : {}),
        ...(params.sellerId ? { sellerId: params.sellerId } : {}),
        ...(params.courseId ? { courseId: params.courseId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
      include: {
        seller: { select: { id: true, fullName: true, status: true, kycVerified: true, payoutVerified: true } },
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        order: { select: { id: true, orderNumber: true, status: true, isFlaggedSuspicious: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 8 },
      },
    });
  }

  async reviewCommission(
    actor: AuthenticatedContextUser,
    commissionId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = commissionReviewDecisionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات قرار العمولة غير صالحة');
    }

    const comm = await this.prisma.sellerCommission.findUnique({
      where: { id: commissionId },
      include: { order: true, seller: { select: { userId: true } } },
    });
    if (!comm) throw new NotFoundException('سجل العمولة غير موجود');
    if (comm.status === 'PAID') {
      throw new BadRequestException('لا يمكن تعديل حالة عمولة تم صرفها بالفعل — استخدم الاسترداد أو تسوية مالية');
    }

    const { action, reasonAr } = parsed.data;
    const now = new Date();
    let nextStatus = comm.status;
    let extraUpdate: Prisma.SellerCommissionUpdateInput = {};

    if (action === 'APPROVE') {
      if (comm.status !== 'ELIGIBLE') {
        throw new BadRequestException('لا يمكن اعتماد العمولة إلا بعد انتقالها إلى حالة مؤهلة (ELIGIBLE)');
      }
      if (toPiasters(comm.netAmount.toString()) <= 0) {
        throw new BadRequestException('صافي العمولة يساوي صفراً ولا يمكن اعتماده');
      }
      nextStatus = 'APPROVED';
      extraUpdate = { approvedAt: now, approvedBy: { connect: { id: actor.id } } };
    } else if (action === 'DISPUTE') {
      nextStatus = 'DISPUTED';
      extraUpdate = { disputedReason: reasonAr };
    } else if (action === 'RESOLVE_TO_ELIGIBLE') {
      if (comm.status !== 'DISPUTED' && comm.status !== 'ON_HOLD') {
        throw new BadRequestException('يمكن تحويل العمولة إلى مؤهلة فقط من حالة النزاع أو الانتظار المراجع');
      }
      nextStatus = 'ELIGIBLE';
      extraUpdate = { disputedReason: null, warningNote: null };
    } else if (action === 'REVERSE') {
      nextStatus = 'REVERSED';
      extraUpdate = {
        reversedAmount: comm.appliedAmount,
        netAmount: '0.00',
        disputedReason: reasonAr,
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.sellerCommission.update({
        where: { id: comm.id },
        data: { status: nextStatus, ...extraUpdate },
      });
      if (action === 'RESOLVE_TO_ELIGIBLE' && comm.order.isFlaggedSuspicious) {
        await tx.order.update({
          where: { id: comm.orderId },
          data: { isFlaggedSuspicious: false, suspiciousReason: null },
        });
      }
      await tx.commissionStatusHistory.create({
        data: {
          commissionId: comm.id,
          fromStatus: comm.status,
          toStatus: nextStatus,
          changedById: actor.id,
          reasonAr,
        },
      });
      return saved;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: `COMMISSION_${action}`,
      entityType: 'SellerCommission',
      entityId: comm.id,
      metadata: { fromStatus: comm.status, toStatus: nextStatus, reasonAr },
      ipAddress,
    });

    return updated;
  }

  async bulkApproveCommissions(
    actor: AuthenticatedContextUser,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = bulkApproveCommissionsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الاعتماد الجماعي غير صالحة');
    }

    const approvedIds: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const id of parsed.data.commissionIds) {
      try {
        await this.reviewCommission(
          actor,
          id,
          { action: 'APPROVE', reasonAr: parsed.data.reasonAr || 'اعتماد مالي جماعي للعمولات المؤهلة' },
          ipAddress,
        );
        approvedIds.push(id);
      } catch (err: any) {
        skipped.push({ id, reason: err?.message || 'غير مؤهل للاعتماد' });
      }
    }

    return { approvedCount: approvedIds.length, approvedIds, skipped };
  }

  // ============================================================
  // 3. MAKER-CHECKER MONTHLY SETTLEMENTS & PAYOUTS
  // ============================================================

  async listSettlements(params: { sellerId?: string; status?: string }) {
    return this.prisma.sellerPayout.findMany({
      where: {
        ...(params.sellerId ? { sellerId: params.sellerId } : {}),
        ...(params.status ? { status: params.status as any } : {}),
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }],
      include: {
        seller: { select: { id: true, fullName: true, status: true, payoutMethodType: true, payoutAccountName: true } },
        createdBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        paidBy: { select: { id: true, fullName: true } },
        items: {
          where: { isVoided: false },
          include: {
            commission: {
              select: { id: true, orderId: true, courseId: true, netAmount: true, status: true },
            },
          },
        },
        settledDebits: true,
        adjustments: true,
      },
    });
  }

  /**
   * Maker Step: generates monthly settlement up to 23:59:59 Africa/Cairo on month end (AT-083).
   * Enforces:
   * - Suspended seller freeze (AT-072)
   * - Verified KYC + payout method (AT-073)
   * - Concurrent race guard via seller row lock + DB partial unique index (AT-058)
   * - Automatic deduction of ReversalDebits (AT-029, AT-078)
   * - Never negative cash payout (AT-079)
   * - Minimum payout threshold carry-forward (500 EGP default, AT-075)
   */
  async createMonthlySettlement(
    actor: AuthenticatedContextUser,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = createSettlementSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات التسوية غير صالحة');
    }

    const { sellerId, periodYear, periodMonth, minPayoutEgp, notesAr } = parsed.data;
    const { startUtc, endUtc } = getCairoMonthBoundsUtc(periodYear, periodMonth);

    const payout = await this.prisma.$transaction(
      async (tx) => {
        // Lock seller row to serialize concurrent settlement creation attempts (AT-058)
        await tx.$queryRaw`SELECT "id" FROM "sellers" WHERE "id" = ${sellerId} FOR UPDATE`;

        const seller = await tx.seller.findUnique({ where: { id: sellerId } });
        if (!seller) throw new NotFoundException('ملف البائع غير موجود');

        if (seller.status === 'SUSPENDED') {
          throw new ForbiddenException('حساب البائع موقوف — تم تجميد كافة التسويات والصرفيات (AT-072)');
        }
        if (seller.status !== 'APPROVED') {
          throw new ForbiddenException('لا يمكن إنشاء تسوية لبائع غير معتمد');
        }
        if (!seller.kycVerified || !seller.payoutVerified) {
          throw new ForbiddenException(
            'يلزم التحقق من الهوية (KYC) ووسيلة استلام المستحقات قبل إنشاء التسوية (AT-073)',
          );
        }

        // Strict month cutoff: approvedAt <= 23:59:59.999 Africa/Cairo of periodMonth (AT-083)
        // Exclude any commission already attached to a non-voided SellerPayoutItem (AT-058)
        const eligibleCommissions = await tx.sellerCommission.findMany({
          where: {
            sellerId,
            status: 'APPROVED',
            approvedAt: { lte: endUtc },
            payoutItems: { none: { isVoided: false } },
          },
          orderBy: { approvedAt: 'asc' },
        });

        const openDebits = await tx.reversalDebit.findMany({
          where: { sellerId, remainingAmount: { gt: 0 } },
          orderBy: { createdAt: 'asc' },
        });

        const openAdjustments = await tx.financialAdjustment.findMany({
          where: { sellerId, payoutId: null, createdAt: { lte: endUtc } },
          orderBy: { createdAt: 'asc' },
        });

        if (eligibleCommissions.length === 0 && openAdjustments.length === 0) {
          throw new BadRequestException('لا توجد عمولات معتمدة غير مسوّاة ضمن حدود هذه الفترة الزمنية');
        }

        const grossPiasters = eligibleCommissions.reduce(
          (acc, c) => acc + toPiasters(c.netAmount.toString()),
          0,
        );
        const totalOpenDebitsPiasters = openDebits.reduce(
          (acc, d) => acc + toPiasters(d.remainingAmount.toString()),
          0,
        );
        const adjustmentPiasters = openAdjustments.reduce(
          (acc, a) => acc + toPiasters(a.amount.toString()),
          0,
        );

        const rawNetPiasters = grossPiasters - totalOpenDebitsPiasters + adjustmentPiasters;
        const effectiveMinPiasters = Math.max(
          toPiasters(minPayoutEgp),
          toPiasters(seller.minPayoutAmount.toString()),
        );

        const seq = Math.floor(1000 + Math.random() * 9000);
        const settlementNumber = `STL-${periodYear}${String(periodMonth).padStart(2, '0')}-${Date.now().toString().slice(-5)}-${seq}`;

        // Case A: Negative or zero net balance (AT-079) -> NEVER negative cash payout!
        if (rawNetPiasters <= 0) {
          const offsetCapacity = Math.max(0, grossPiasters + adjustmentPiasters);
          const deductedDebits = Math.min(offsetCapacity, totalOpenDebitsPiasters);
          const remainingCarryDebt = Math.max(0, totalOpenDebitsPiasters - deductedDebits);

          const saved = await tx.sellerPayout.create({
            data: {
              settlementNumber,
              sellerId,
              periodYear,
              periodMonth,
              periodStartUtc: startUtc,
              periodEndUtc: endUtc,
              grossCommissionAmount: piastersToDecimalString(grossPiasters),
              reversalDebitDeducted: piastersToDecimalString(deductedDebits),
              adjustmentAmount: piastersToDecimalString(adjustmentPiasters),
              netPayableAmount: '0.00',
              carriedForwardAmount: '0.00',
              status: 'CARRIED_FORWARD',
              createdById: actor.id,
              notesAr:
                notesAr ||
                `تم ترحيل الرصيد السالب (مديونية متبقية ${piastersToDecimalString(remainingCarryDebt)} ج.م) دون إصدار صرف سالب.`,
            },
          });

          // Apply deducted debits proportionally across open ReversalDebits & mark offset commissions PAID
          let remainingToOffset = deductedDebits;
          for (const debit of openDebits) {
            if (remainingToOffset <= 0) break;
            const dRem = toPiasters(debit.remainingAmount.toString());
            const take = Math.min(dRem, remainingToOffset);
            remainingToOffset -= take;
            await tx.reversalDebit.update({
              where: { id: debit.id },
              data: {
                settledAmount: piastersToDecimalString(toPiasters(debit.settledAmount.toString()) + take),
                remainingAmount: piastersToDecimalString(dRem - take),
                settledPayoutId: dRem - take === 0 ? saved.id : debit.settledPayoutId,
              },
            });
          }

          if (eligibleCommissions.length > 0 && deductedDebits > 0) {
            for (const c of eligibleCommissions) {
              await tx.sellerPayoutItem.create({
                data: { payoutId: saved.id, commissionId: c.id, amount: c.netAmount, isVoided: false },
              });
              await tx.sellerCommission.update({
                where: { id: c.id },
                data: { status: 'PAID', paidAt: new Date() },
              });
              await tx.commissionStatusHistory.create({
                data: {
                  commissionId: c.id,
                  fromStatus: 'APPROVED',
                  toStatus: 'PAID',
                  changedById: actor.id,
                  reasonAr: `تمت مقاصة العمولة بالكامل مقابل مديونية عكس عمولة في التسوية ${settlementNumber}`,
                },
              });
            }
          }

          for (const adj of openAdjustments) {
            await tx.financialAdjustment.update({ where: { id: adj.id }, data: { payoutId: saved.id } });
          }

          return saved;
        }

        // Case B: Below minimum payout threshold (e.g. < 500 EGP — AT-075) -> carry forward!
        if (rawNetPiasters < effectiveMinPiasters) {
          const saved = await tx.sellerPayout.create({
            data: {
              settlementNumber,
              sellerId,
              periodYear,
              periodMonth,
              periodStartUtc: startUtc,
              periodEndUtc: endUtc,
              grossCommissionAmount: piastersToDecimalString(grossPiasters),
              reversalDebitDeducted: piastersToDecimalString(totalOpenDebitsPiasters),
              adjustmentAmount: piastersToDecimalString(adjustmentPiasters),
              netPayableAmount: '0.00',
              carriedForwardAmount: piastersToDecimalString(rawNetPiasters),
              status: 'CARRIED_FORWARD',
              createdById: actor.id,
              notesAr:
                notesAr ||
                `الرصيد (${piastersToDecimalString(rawNetPiasters)} ج.م) أقل من الحد الأدنى للصرف (${piastersToDecimalString(effectiveMinPiasters)} ج.م) — تم ترحيله للدورة القادمة.`,
            },
          });

          // Record voided snapshot items so commissions remain APPROVED & available next month
          for (const c of eligibleCommissions) {
            await tx.sellerPayoutItem.create({
              data: { payoutId: saved.id, commissionId: c.id, amount: c.netAmount, isVoided: true },
            });
          }

          return saved;
        }

        // Case C: Normal Maker DRAFT settlement ready for independent Checker approval
        const saved = await tx.sellerPayout.create({
          data: {
            settlementNumber,
            sellerId,
            periodYear,
            periodMonth,
            periodStartUtc: startUtc,
            periodEndUtc: endUtc,
            grossCommissionAmount: piastersToDecimalString(grossPiasters),
            reversalDebitDeducted: piastersToDecimalString(totalOpenDebitsPiasters),
            adjustmentAmount: piastersToDecimalString(adjustmentPiasters),
            netPayableAmount: piastersToDecimalString(rawNetPiasters),
            carriedForwardAmount: '0.00',
            status: 'DRAFT',
            createdById: actor.id,
            notesAr: notesAr ?? null,
          },
        });

        for (const c of eligibleCommissions) {
          await tx.sellerPayoutItem.create({
            data: {
              payoutId: saved.id,
              commissionId: c.id,
              amount: c.netAmount,
              isVoided: false,
            },
          });
        }

        return saved;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((err: any) => {
      const code = err?.code || err?.meta?.code;
      if (code === 'P2034' || code === 'P2002' || code === '40001') {
        throw new ConflictException('يوجد كشف تسوية متزامن قيد الإنشاء لنفس البائع والعمولات (AT-058)');
      }
      throw err;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'SELLER_SETTLEMENT_CREATED',
      entityType: 'SellerPayout',
      entityId: payout.id,
      metadata: {
        settlementNumber: payout.settlementNumber,
        sellerId,
        periodYear,
        periodMonth,
        status: payout.status,
        gross: payout.grossCommissionAmount.toString(),
        deductedDebits: payout.reversalDebitDeducted.toString(),
        netPayable: payout.netPayableAmount.toString(),
        carriedForward: payout.carriedForwardAmount.toString(),
      },
      ipAddress,
    });

    return payout;
  }

  /**
   * Checker Step (AT-059): Approver MUST strictly differ from Maker (createdById).
   */
  async approveSettlement(actor: AuthenticatedContextUser, payoutId: string, ipAddress?: string) {
    const payout = await this.prisma.sellerPayout.findUnique({
      where: { id: payoutId },
      include: { seller: true },
    });
    if (!payout) throw new NotFoundException('كشف التسوية غير موجود');

    if (payout.status !== 'DRAFT') {
      throw new BadRequestException('يمكن اعتماد التسويات في حالة مسودة (DRAFT) فقط');
    }
    if (payout.createdById === actor.id) {
      throw new ForbiddenException(
        'مبدأ Maker-Checker: لا يجوز لمنشئ التسوية اعتمادها بنفسه؛ يلزم مراجع مالي آخر',
      );
    }
    if (payout.seller.status === 'SUSPENDED') {
      throw new ForbiddenException('حساب البائع موقوف — لا يمكن اعتماد الصرف');
    }
    if (!payout.seller.kycVerified || !payout.seller.payoutVerified) {
      throw new ForbiddenException('يلزم توثيق الهوية ووسيلة الصرف للبائع قبل الاعتماد');
    }

    const updated = await this.prisma.sellerPayout.update({
      where: { id: payout.id },
      data: {
        status: 'APPROVED',
        approvedById: actor.id,
        approvedAt: new Date(),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'SELLER_SETTLEMENT_APPROVED',
      entityType: 'SellerPayout',
      entityId: payout.id,
      metadata: {
        settlementNumber: payout.settlementNumber,
        makerId: payout.createdById,
        checkerId: actor.id,
        netPayable: payout.netPayableAmount.toString(),
      },
      ipAddress,
    });

    return updated;
  }

  async markSettlementPaid(
    actor: AuthenticatedContextUser,
    payoutId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = markPayoutSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات التحويل البنكي غير صالحة');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const payout = await tx.sellerPayout.findUnique({
        where: { id: payoutId },
        include: {
          seller: true,
          items: { where: { isVoided: false }, include: { commission: true } },
        },
      });
      if (!payout) throw new NotFoundException('كشف التسوية غير موجود');
      if (payout.status !== 'APPROVED') {
        throw new BadRequestException('لا يمكن تنفيذ الصرف إلا بعد اعتماد التسوية (APPROVED)');
      }
      if (payout.seller.status === 'SUSPENDED') {
        throw new ForbiddenException('حساب البائع موقوف — تم تجميد الصرف');
      }
      if (!payout.seller.kycVerified || !payout.seller.payoutVerified) {
        throw new ForbiddenException('بيانات الهوية أو التحويل للبائع غير موثقة');
      }

      const now = new Date();
      const saved = await tx.sellerPayout.update({
        where: { id: payout.id },
        data: {
          status: 'PAID',
          paidById: actor.id,
          paidAt: now,
          transferReference: parsed.data.transferReference,
          paymentProofUrl: parsed.data.paymentProofUrl ?? null,
          notesAr: parsed.data.notesAr ?? payout.notesAr,
        },
      });

      // Mark every included commission as PAID
      for (const item of payout.items) {
        await tx.sellerCommission.update({
          where: { id: item.commissionId },
          data: { status: 'PAID', paidAt: now },
        });
        await tx.commissionStatusHistory.create({
          data: {
            commissionId: item.commissionId,
            fromStatus: item.commission.status,
            toStatus: 'PAID',
            changedById: actor.id,
            reasonAr: `تم الصرف ضمن التسوية ${payout.settlementNumber} — مرجع التحويل: ${parsed.data.transferReference}`,
            metadata: { payoutId: payout.id, transferReference: parsed.data.transferReference },
          },
        });
      }

      // Mark deducted ReversalDebits as settled
      let debitToConsume = toPiasters(payout.reversalDebitDeducted.toString());
      if (debitToConsume > 0) {
        const openDebits = await tx.reversalDebit.findMany({
          where: { sellerId: payout.sellerId, remainingAmount: { gt: 0 } },
          orderBy: { createdAt: 'asc' },
        });
        for (const d of openDebits) {
          if (debitToConsume <= 0) break;
          const rem = toPiasters(d.remainingAmount.toString());
          const take = Math.min(rem, debitToConsume);
          debitToConsume -= take;
          await tx.reversalDebit.update({
            where: { id: d.id },
            data: {
              settledAmount: piastersToDecimalString(toPiasters(d.settledAmount.toString()) + take),
              remainingAmount: piastersToDecimalString(rem - take),
              settledPayoutId: rem - take === 0 ? payout.id : d.settledPayoutId,
            },
          });
        }
      }

      // Attach any unattached adjustments included in the period
      await tx.financialAdjustment.updateMany({
        where: { sellerId: payout.sellerId, payoutId: null, createdAt: { lte: payout.periodEndUtc } },
        data: { payoutId: payout.id },
      });

      await tx.notification.createMany({
        data: [
          {
            userId: payout.seller.userId,
            type: 'PAYOUT_STATEMENT_UPDATED',
            titleAr: 'تم تحويل مستحقاتك الشهرية بنجاح',
            bodyAr: `تم صرف تسوية ${payout.settlementNumber} بمبلغ ${payout.netPayableAmount.toString()} ج.م — مرجع التحويل: ${parsed.data.transferReference}.`,
            actionUrl: '/seller',
            dedupKey: `payout-paid-${payout.id}`,
          },
        ],
        skipDuplicates: true,
      });

      return saved;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'SELLER_SETTLEMENT_PAID',
      entityType: 'SellerPayout',
      entityId: updated.id,
      metadata: {
        settlementNumber: updated.settlementNumber,
        transferReference: parsed.data.transferReference,
        netPayable: updated.netPayableAmount.toString(),
      },
      ipAddress,
    });

    return updated;
  }

  /**
   * AT-080: Marks an APPROVED settlement as FAILED, voids its payout items so APPROVED commissions
   * can be retried ONCE in a replacement settlement; a second failure escalates to DISPUTED.
   */
  async markSettlementFailed(
    actor: AuthenticatedContextUser,
    payoutId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = failPayoutSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'سبب فشل التحويل مطلوب');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const payout = await tx.sellerPayout.findUnique({
        where: { id: payoutId },
        include: {
          seller: true,
          items: { where: { isVoided: false }, include: { commission: true } },
        },
      });
      if (!payout) throw new NotFoundException('كشف التسوية غير موجود');
      if (payout.status !== 'APPROVED') {
        throw new BadRequestException('يمكن تسجيل فشل الصرف للتسويات المعتمدة (APPROVED) فقط');
      }

      const saved = await tx.sellerPayout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          failureReasonAr: parsed.data.failureReasonAr,
        },
      });

      for (const item of payout.items) {
        await tx.sellerPayoutItem.update({
          where: { id: item.id },
          data: { isVoided: true },
        });

        const nextRetryCount = item.commission.failedPayoutRetryCount + 1;
        const canRetryOnce = item.commission.failedPayoutRetryCount < 1;
        const nextStatus = canRetryOnce ? 'APPROVED' : 'DISPUTED';

        await tx.sellerCommission.update({
          where: { id: item.commissionId },
          data: {
            status: nextStatus,
            failedPayoutRetryCount: nextRetryCount,
            ...(!canRetryOnce
              ? { disputedReason: 'تجاوز الحد الأقصى لإعادة محاولة الصرف الفاشل (مرة واحدة)' }
              : {}),
          },
        });

        await tx.commissionStatusHistory.create({
          data: {
            commissionId: item.commissionId,
            fromStatus: item.commission.status,
            toStatus: nextStatus,
            changedById: actor.id,
            reasonAr: canRetryOnce
              ? `فشل صرف التسوية ${payout.settlementNumber} (${parsed.data.failureReasonAr}) — إعادة العمولة لحالة APPROVED لمحاولة إعادة صرف واحدة`
              : `فشل الصرف للمرة الثانية (${parsed.data.failureReasonAr}) — تحويل العمولة إلى DISPUTED للمراجعة المالية`,
          },
        });
      }

      return saved;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'SELLER_SETTLEMENT_FAILED',
      entityType: 'SellerPayout',
      entityId: updated.id,
      metadata: {
        settlementNumber: updated.settlementNumber,
        failureReasonAr: parsed.data.failureReasonAr,
      },
      ipAddress,
    });

    return updated;
  }

  // ============================================================
  // 4. IMMUTABLE ADJUSTMENTS, EXPENSES, PERIOD CLOSING & P&L DASHBOARD
  // ============================================================

  async createFinancialAdjustment(
    actor: AuthenticatedContextUser,
    body: { sellerId: string; amountEgp: number; reasonAr: string; commissionId?: string; orderId?: string },
    ipAddress?: string,
  ) {
    if (!body?.sellerId || !body?.reasonAr?.trim() || !Number.isFinite(Number(body.amountEgp))) {
      throw new BadRequestException('بيانات التسوية المالية غير مكتملة');
    }
    await this.assertPeriodOpen(new Date());

    const amountPiasters = toPiasters(Number(body.amountEgp));
    if (amountPiasters === 0) {
      throw new BadRequestException('قيمة التسوية يجب أن تختلف عن الصفر');
    }

    const saved = await this.prisma.financialAdjustment.create({
      data: {
        sellerId: body.sellerId,
        commissionId: body.commissionId ?? null,
        orderId: body.orderId ?? null,
        amount: piastersToDecimalString(amountPiasters),
        reasonAr: body.reasonAr.trim(),
        createdById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'FINANCIAL_ADJUSTMENT_CREATED',
      entityType: 'FinancialAdjustment',
      entityId: saved.id,
      metadata: {
        sellerId: saved.sellerId,
        amount: saved.amount.toString(),
        reasonAr: saved.reasonAr,
      },
      ipAddress,
    });

    return saved;
  }

  async recordExpense(actor: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = financialExpenseSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات المصروف غير صالحة');
    }

    const incurredAt = new Date(parsed.data.incurredAt);
    if (Number.isNaN(incurredAt.getTime())) {
      throw new BadRequestException('تاريخ المصروف غير صالح');
    }
    await this.assertPeriodOpen(incurredAt);

    const saved = await this.prisma.financialExpense.create({
      data: {
        categoryAr: parsed.data.categoryAr,
        courseId: parsed.data.courseId ?? null,
        descriptionAr: parsed.data.descriptionAr,
        amount: piastersToDecimalString(toPiasters(parsed.data.amountEgp)),
        incurredAt,
        receiptRef: parsed.data.receiptRef ?? null,
        recordedById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'FINANCIAL_EXPENSE_RECORDED',
      entityType: 'FinancialExpense',
      entityId: saved.id,
      metadata: { categoryAr: saved.categoryAr, amount: saved.amount.toString(), incurredAt: incurredAt.toISOString() },
      ipAddress,
    });

    return saved;
  }

  async listExpenses() {
    return this.prisma.financialExpense.findMany({
      orderBy: { incurredAt: 'desc' },
      take: 200,
      include: {
        course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
        recordedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async closeAccountingPeriod(
    actor: AuthenticatedContextUser,
    body: { periodYear: number; periodMonth: number; notesAr?: string },
    ipAddress?: string,
  ) {
    const year = Number(body?.periodYear);
    const month = Number(body?.periodMonth);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('السنة والشهر المحاسبي غير صالحين');
    }

    const existing = await this.prisma.accountingPeriodClose.findUnique({
      where: { periodYear_periodMonth: { periodYear: year, periodMonth: month } },
    });
    if (existing?.isClosed) {
      throw new ConflictException('هذه الفترة المحاسبية مغلقة بالفعل');
    }

    const { startUtc, endUtc } = getCairoMonthBoundsUtc(year, month);
    const [orders, payments, refunds, commissions, expenses, instructorEntries] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: startUtc, lte: endUtc }, status: { in: ['PAID', 'PARTIALLY_PAID', 'REFUNDED'] } },
      }),
      this.prisma.orderPayment.findMany({
        where: { status: 'PAID', paidAt: { gte: startUtc, lte: endUtc } },
      }),
      this.prisma.orderRefund.findMany({
        where: { createdAt: { gte: startUtc, lte: endUtc } },
      }),
      this.prisma.sellerCommission.findMany({
        where: { createdAt: { gte: startUtc, lte: endUtc }, status: { not: 'REVERSED' } },
      }),
      this.prisma.financialExpense.findMany({
        where: { incurredAt: { gte: startUtc, lte: endUtc } },
      }),
      this.prisma.instructorStatementEntry.findMany({
        where: { createdAt: { gte: startUtc, lte: endUtc }, type: 'DEBIT_INSTRUCTOR_SHARE' },
      }),
    ]);

    const recognizedRev = orders.reduce((s, o) => s + toPiasters(o.totalAmount.toString()), 0);
    const cashCollected = payments.reduce((s, p) => s + toPiasters(p.amount.toString()), 0);
    const totalRefunds = refunds.reduce((s, r) => s + toPiasters(r.refundAmount.toString()), 0);
    const totalComms = commissions.reduce((s, c) => s + toPiasters(c.netAmount.toString()), 0);
    const totalInstShares = instructorEntries.reduce((s, e) => s + Math.abs(e.netAmountCents), 0);
    const totalExpenses = expenses.reduce((s, e) => s + toPiasters(e.amount.toString()), 0);
    const netProfit = cashCollected - totalRefunds - totalComms - totalInstShares - totalExpenses;

    const closed = await this.prisma.accountingPeriodClose.create({
      data: {
        periodYear: year,
        periodMonth: month,
        periodStartUtc: startUtc,
        periodEndUtc: endUtc,
        recognizedRevenue: piastersToDecimalString(recognizedRev),
        cashCollected: piastersToDecimalString(cashCollected),
        totalRefunds: piastersToDecimalString(totalRefunds),
        totalCommissions: piastersToDecimalString(totalComms),
        totalInstructorShares: piastersToDecimalString(totalInstShares),
        totalExpenses: piastersToDecimalString(totalExpenses),
        netProfit: piastersToDecimalString(netProfit),
        isClosed: true,
        closedById: actor.id,
        notesAr: body.notesAr?.trim() || null,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ACCOUNTING_PERIOD_CLOSED',
      entityType: 'AccountingPeriodClose',
      entityId: closed.id,
      metadata: {
        periodYear: year,
        periodMonth: month,
        cashCollected: closed.cashCollected.toString(),
        netProfit: closed.netProfit.toString(),
      },
      ipAddress,
    });

    return closed;
  }

  async getFinanceDashboard() {
    const [
      orders,
      payments,
      refunds,
      commissions,
      payouts,
      expenses,
      closedPeriods,
      expiringContracts,
      legacyPaymentRecords,
    ] = await Promise.all([
      this.prisma.order.findMany({
        select: {
          id: true,
          accountingType: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          refundedAmount: true,
          createdAt: true,
        },
      }),
      this.prisma.orderPayment.findMany({
        where: { status: 'PAID' },
        select: { amount: true, paymentMethod: true, paidAt: true },
      }),
      this.prisma.orderRefund.findMany({
        select: { refundAmount: true, commissionReversedAmount: true },
      }),
      this.prisma.sellerCommission.findMany({
        select: { status: true, appliedAmount: true, reversedAmount: true, netAmount: true },
      }),
      this.prisma.sellerPayout.findMany({
        select: { status: true, netPayableAmount: true, carriedForwardAmount: true },
      }),
      this.prisma.financialExpense.findMany({
        select: { categoryAr: true, amount: true, courseId: true },
      }),
      this.prisma.accountingPeriodClose.findMany({
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        take: 12,
      }),
      this.prisma.instructorContract.findMany({
        where: {
          isActive: true,
          endDate: { lte: new Date(Date.now() + 30 * 86_400_000) },
        },
        include: { instructor: { select: { id: true, fullName: true } } },
        orderBy: { endDate: 'asc' },
      }),
      this.prisma.financialPaymentRecord.findMany({
        select: { direction: true, grossAmountCents: true, instructorShareCents: true, status: true },
      }),
    ]);

    const recognizedRevenuePiasters = orders
      .filter((o) => o.status !== 'CANCELLED' && o.status !== 'DRAFT')
      .reduce((s, o) => s + toPiasters(o.totalAmount.toString()), 0);
    const cashCollectedOrderPiasters = payments.reduce((s, p) => s + toPiasters(p.amount.toString()), 0);
    const legacyInboundPiasters = legacyPaymentRecords
      .filter((r) => r.direction === 'INBOUND' && r.status === 'PAID')
      .reduce((s, r) => s + r.grossAmountCents, 0);
    const instructorSharesPiasters = legacyPaymentRecords
      .filter((r) => r.direction === 'INBOUND' && r.status === 'PAID')
      .reduce((s, r) => s + r.instructorShareCents, 0);

    const totalRefundsPiasters = refunds.reduce((s, r) => s + toPiasters(r.refundAmount.toString()), 0);
    const totalExpensesPiasters = expenses.reduce((s, e) => s + toPiasters(e.amount.toString()), 0);

    const commByStatus = {
      ON_HOLD: 0,
      ELIGIBLE: 0,
      APPROVED: 0,
      PAID: 0,
      DISPUTED: 0,
      REVERSED: 0,
    };
    for (const c of commissions) {
      if (c.status === 'REVERSED') {
        commByStatus.REVERSED += toPiasters(c.reversedAmount.toString());
      } else {
        commByStatus[c.status] += toPiasters(c.netAmount.toString());
      }
    }

    const totalActiveCommissionsPiasters =
      commByStatus.ON_HOLD + commByStatus.ELIGIBLE + commByStatus.APPROVED + commByStatus.PAID;

    const totalCashInPiasters = cashCollectedOrderPiasters + legacyInboundPiasters;
    const netCashFlowPiasters =
      totalCashInPiasters - totalRefundsPiasters - commByStatus.PAID - totalExpensesPiasters;
    const operatingNetProfitPiasters =
      totalCashInPiasters -
      totalRefundsPiasters -
      totalActiveCommissionsPiasters -
      instructorSharesPiasters -
      totalExpensesPiasters;

    const revenueByClassification = {
      COURSE_PURCHASE:
        orders
          .filter((o) => o.accountingType === 'COURSE_PURCHASE')
          .reduce((s, o) => s + toPiasters(o.paidAmount.toString()), 0) / 100,
      MONTHLY_MEMBERSHIP:
        orders
          .filter((o) => o.accountingType === 'MONTHLY_MEMBERSHIP')
          .reduce((s, o) => s + toPiasters(o.paidAmount.toString()), 0) / 100,
      ANNUAL_MEMBERSHIP:
        orders
          .filter((o) => o.accountingType === 'ANNUAL_MEMBERSHIP')
          .reduce((s, o) => s + toPiasters(o.paidAmount.toString()), 0) / 100,
    };

    const byPaymentChannel: Record<string, number> = {};
    for (const p of payments) {
      byPaymentChannel[p.paymentMethod] =
        (byPaymentChannel[p.paymentMethod] || 0) + toPiasters(p.amount.toString());
    }

    return {
      disclaimerAr:
        'البيانات المالية تعكس المطابقة التشغيلية والمحاسبية الداخلية ولا تشكل إقراراً ضريبياً قانونياً بدون مراجعة المحاسب القانوني.',
      summary: {
        recognizedRevenueEgp: recognizedRevenuePiasters / 100,
        cashCollectedOrdersEgp: cashCollectedOrderPiasters / 100,
        cashCollectedLegacyEgp: legacyInboundPiasters / 100,
        totalCashCollectedEgp: totalCashInPiasters / 100,
        totalRefundsEgp: totalRefundsPiasters / 100,
        totalExpensesEgp: totalExpensesPiasters / 100,
        totalInstructorSharesEgp: instructorSharesPiasters / 100,
        totalActiveCommissionsEgp: totalActiveCommissionsPiasters / 100,
        netCashFlowEgp: netCashFlowPiasters / 100,
        operatingNetProfitEgp: operatingNetProfitPiasters / 100,
      },
      commissionsByStatusEgp: {
        ON_HOLD: commByStatus.ON_HOLD / 100,
        ELIGIBLE: commByStatus.ELIGIBLE / 100,
        APPROVED: commByStatus.APPROVED / 100,
        PAID: commByStatus.PAID / 100,
        DISPUTED: commByStatus.DISPUTED / 100,
        REVERSED: commByStatus.REVERSED / 100,
      },
      revenueByClassification,
      byPaymentChannelEgp: Object.fromEntries(
        Object.entries(byPaymentChannel).map(([k, v]) => [k, v / 100]),
      ),
      payoutCounts: {
        draft: payouts.filter((p) => p.status === 'DRAFT').length,
        approved: payouts.filter((p) => p.status === 'APPROVED').length,
        paid: payouts.filter((p) => p.status === 'PAID').length,
        failed: payouts.filter((p) => p.status === 'FAILED').length,
        carriedForward: payouts.filter((p) => p.status === 'CARRIED_FORWARD').length,
      },
      closedPeriods,
      expiringInstructorContracts: expiringContracts,
    };
  }

  // ============================================================
  // 5. RECONCILIATION ENGINE & CSV EXPORTS (SECTION 7)
  // ============================================================

  async runReconciliationReport() {
    const [orders, orderItems, paidPayments, allocations, commissions, payouts, payoutItems] =
      await Promise.all([
        this.prisma.order.findMany({
          select: { id: true, orderNumber: true, accountingType: true, paidAmount: true, refundedAmount: true },
        }),
        this.prisma.orderItem.findMany({
          select: { id: true, orderId: true, allocatedPaidAmount: true },
        }),
        this.prisma.orderPayment.findMany({
          where: { status: 'PAID' },
          select: { id: true, amount: true, allocatedAmount: true },
        }),
        this.prisma.paymentAllocation.findMany({
          select: { id: true, paymentId: true, allocatedAmount: true },
        }),
        this.prisma.sellerCommission.findMany({
          include: { order: { select: { accountingType: true } } },
        }),
        this.prisma.sellerPayout.findMany({
          select: { id: true, createdById: true, approvedById: true, netPayableAmount: true, status: true },
        }),
        this.prisma.sellerPayoutItem.findMany({
          where: { isVoided: false },
          select: { commissionId: true, payoutId: true, amount: true },
        }),
      ]);

    const sumPaidPayments = paidPayments.reduce((s, p) => s + toPiasters(p.amount.toString()), 0);
    const sumAllocations = allocations.reduce((s, a) => s + toPiasters(a.allocatedAmount.toString()), 0);
    const sumOrderPaid = orders.reduce((s, o) => s + toPiasters(o.paidAmount.toString()), 0);
    const sumItemAllocated = orderItems.reduce((s, i) => s + toPiasters(i.allocatedPaidAmount.toString()), 0);

    const commissionMathMismatches = commissions.filter(
      (c) =>
        toPiasters(c.appliedAmount.toString()) - toPiasters(c.reversedAmount.toString()) !==
        toPiasters(c.netAmount.toString()),
    );

    const membershipCommissions = commissions.filter(
      (c) => c.order.accountingType !== 'COURSE_PURCHASE',
    );

    const makerCheckerViolations = payouts.filter(
      (p) => p.approvedById !== null && p.approvedById === p.createdById,
    );

    const negativePayouts = payouts.filter((p) => toPiasters(p.netPayableAmount.toString()) < 0);

    // Check duplicate active payout items per commission
    const activeByComm = new Map<string, number>();
    for (const pi of payoutItems) {
      activeByComm.set(pi.commissionId, (activeByComm.get(pi.commissionId) || 0) + 1);
    }
    const duplicateActivePayoutCommissions = Array.from(activeByComm.entries()).filter(
      ([, count]) => count > 1,
    );

    const checks = [
      {
        code: 'REC-01',
        nameAr: 'تطابق المدفوعات المحصّلة مع توزيعات البنود (Payments vs Allocations)',
        passed: sumPaidPayments === sumAllocations,
        expected: piastersToDecimalString(sumPaidPayments),
        actual: piastersToDecimalString(sumAllocations),
        varianceEgp: (sumPaidPayments - sumAllocations) / 100,
      },
      {
        code: 'REC-02',
        nameAr: 'تطابق إجمالي مدفوعات الطلبات مع إجمالي تخصيص البنود (Orders vs OrderItems)',
        passed: sumOrderPaid === sumItemAllocated,
        expected: piastersToDecimalString(sumOrderPaid),
        actual: piastersToDecimalString(sumItemAllocated),
        varianceEgp: (sumOrderPaid - sumItemAllocated) / 100,
      },
      {
        code: 'REC-03',
        nameAr: 'دقة معادلة صافي العمولات (Applied - Reversed = Net)',
        passed: commissionMathMismatches.length === 0,
        expected: '0',
        actual: String(commissionMathMismatches.length),
        varianceEgp: 0,
      },
      {
        code: 'REC-04',
        nameAr: 'عدم وجود عمولات مسجلة على الاشتراكات الشهرية والسنوية',
        passed: membershipCommissions.length === 0,
        expected: '0',
        actual: String(membershipCommissions.length),
        varianceEgp: 0,
      },
      {
        code: 'REC-05',
        nameAr: 'سلامة مبدأ Maker-Checker وعدم وجود تسويات سالبة',
        passed: makerCheckerViolations.length === 0 && negativePayouts.length === 0,
        expected: '0',
        actual: String(makerCheckerViolations.length + negativePayouts.length),
        varianceEgp: 0,
      },
      {
        code: 'REC-06',
        nameAr: 'عدم تكرار إدراج نفس العمولة في أكثر من تسوية نشطة',
        passed: duplicateActivePayoutCommissions.length === 0,
        expected: '0',
        actual: String(duplicateActivePayoutCommissions.length),
        varianceEgp: 0,
      },
    ];

    return {
      generatedAtUtc: new Date().toISOString(),
      allChecksPassed: checks.every((c) => c.passed),
      checks,
      totals: {
        ordersCount: orders.length,
        paidPaymentsEgp: sumPaidPayments / 100,
        allocationsEgp: sumAllocations / 100,
        commissionsCount: commissions.length,
        payoutsCount: payouts.length,
      },
    };
  }

  async exportCsv(dataset: 'orders' | 'commissions' | 'payouts' | 'reconciliation'): Promise<string> {
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };
    const bom = '\uFEFF';

    if (dataset === 'orders') {
      const rows = await this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: { user: { select: { fullName: true, phoneE164: true } } },
      });
      const header = ['OrderNumber', 'Classification', 'Buyer', 'Status', 'TotalEGP', 'PaidEGP', 'RefundedEGP', 'SellerCode', 'CreatedAt'];
      const lines = rows.map((r) =>
        [
          r.orderNumber,
          r.accountingType,
          r.user.fullName,
          r.status,
          r.totalAmount.toString(),
          r.paidAmount.toString(),
          r.refundedAmount.toString(),
          r.sellerCodeSnapshot ?? '',
          r.createdAt.toISOString(),
        ]
          .map(esc)
          .join(','),
      );
      return bom + [header.join(','), ...lines].join('\n');
    }

    if (dataset === 'commissions') {
      const rows = await this.prisma.sellerCommission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: {
          seller: { select: { fullName: true } },
          order: { select: { orderNumber: true } },
        },
      });
      const header = ['CommissionId', 'OrderNumber', 'Seller', 'Status', 'ConfiguredEGP', 'CapEGP', 'AppliedEGP', 'ReversedEGP', 'NetEGP', 'EligibleAt'];
      const lines = rows.map((r) =>
        [
          r.id,
          r.order.orderNumber,
          r.seller.fullName,
          r.status,
          r.configuredAmount.toString(),
          r.cappedAmount.toString(),
          r.appliedAmount.toString(),
          r.reversedAmount.toString(),
          r.netAmount.toString(),
          r.eligibleAt.toISOString(),
        ]
          .map(esc)
          .join(','),
      );
      return bom + [header.join(','), ...lines].join('\n');
    }

    if (dataset === 'payouts') {
      const rows = await this.prisma.sellerPayout.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: { seller: { select: { fullName: true } } },
      });
      const header = ['SettlementNumber', 'Seller', 'Period', 'Status', 'GrossEGP', 'DebitsDeductedEGP', 'NetPayableEGP', 'CarriedForwardEGP', 'TransferRef'];
      const lines = rows.map((r) =>
        [
          r.settlementNumber,
          r.seller.fullName,
          `${r.periodYear}-${String(r.periodMonth).padStart(2, '0')}`,
          r.status,
          r.grossCommissionAmount.toString(),
          r.reversalDebitDeducted.toString(),
          r.netPayableAmount.toString(),
          r.carriedForwardAmount.toString(),
          r.transferReference ?? '',
        ]
          .map(esc)
          .join(','),
      );
      return bom + [header.join(','), ...lines].join('\n');
    }

    const report = await this.runReconciliationReport();
    const header = ['CheckCode', 'CheckName', 'Passed', 'Expected', 'Actual', 'VarianceEGP'];
    const lines = report.checks.map((c) =>
      [c.code, c.nameAr, c.passed ? 'PASS' : 'FAIL', c.expected, c.actual, c.varianceEgp]
        .map(esc)
        .join(','),
    );
    return bom + [header.join(','), ...lines].join('\n');
  }

  async listSellersDirectory() {
    return this.prisma.seller.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        phoneE164: true,
        status: true,
        kycVerified: true,
        payoutVerified: true,
        codes: {
          select: { id: true, code: true, isActive: true },
        },
      },
    });
  }
}
