import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import {
  createSellerCodeSchema,
  normalizePhoneToE164,
  parseAndNormalizeSellerCode,
  sellerApplySchema,
  sellerReviewApplicationSchema,
  sellerStatusChangeSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';
import { RedisService } from '../../core/redis.service';

export const REFERRAL_COOKIE_NAME = 'bosla_ref';
const REFERRAL_WINDOW_DAYS = 30;
const INVALID_SELLER_CODE_MESSAGE = 'كود البائع غير صالح أو غير متاح حالياً';

@Injectable()
export class SellersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  private getAppBaseUrl(): string {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  }

  private buildReferralUrl(normalizedCode: string): string {
    return `${this.getAppBaseUrl()}/r/${encodeURIComponent(normalizedCode)}`;
  }

  private async ensureSellerRoleAssigned(userId: string, actorId: string) {
    const roleDef = await this.prisma.roleDefinition.findUnique({
      where: { code: 'AFFILIATE_SELLER' },
    });
    if (roleDef) {
      await this.prisma.userRoleAssignment.upsert({
        where: { userId_roleId: { userId, roleId: roleDef.id } },
        update: {},
        create: { userId, roleId: roleDef.id, assignedById: actorId },
      });
    }
  }

  // ============================================================
  // 1. SELLER APPLICATION & LIFECYCLE
  // ============================================================

  async applyAsSeller(user: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = sellerApplySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات طلب البائع غير مكتملة');
    }

    const data = parsed.data;
    const phoneE164 = normalizePhoneToE164(data.phoneNumber, data.countryCode || '+20');
    if (!phoneE164) {
      throw new BadRequestException('رقم الهاتف غير صالح');
    }
    const existing = await this.prisma.seller.findUnique({ where: { userId: user.id } });

    if (existing && existing.status === 'APPROVED') {
      throw new ConflictException('حسابك معتمد بالفعل كبائع في الأكاديمية');
    }
    if (existing && existing.status === 'SUSPENDED') {
      throw new ForbiddenException('حساب البائع موقوف حالياً، يرجى التواصل مع الإدارة');
    }

    const seller = existing
      ? await this.prisma.seller.update({
          where: { id: existing.id },
          data: {
            status: 'PENDING',
            fullName: data.fullName,
            phoneE164,
            email: data.email ?? null,
            nationalIdNumber: data.nationalIdNumber,
            idDocumentUrl: data.idDocumentUrl,
            experienceSummaryAr: data.experienceSummaryAr,
            marketingChannelsAr: data.marketingChannelsAr ?? null,
            payoutMethodType: data.payoutMethodType,
            payoutAccountName: data.payoutAccountName,
            payoutAccountDetails: data.payoutAccountDetails,
          },
        })
      : await this.prisma.seller.create({
          data: {
            userId: user.id,
            status: 'PENDING',
            fullName: data.fullName,
            phoneE164,
            email: data.email ?? null,
            nationalIdNumber: data.nationalIdNumber,
            idDocumentUrl: data.idDocumentUrl,
            experienceSummaryAr: data.experienceSummaryAr,
            marketingChannelsAr: data.marketingChannelsAr ?? null,
            payoutMethodType: data.payoutMethodType,
            payoutAccountName: data.payoutAccountName,
            payoutAccountDetails: data.payoutAccountDetails,
          },
        });

    const application = await this.prisma.sellerApplication.create({
      data: {
        sellerId: seller.id,
        userId: user.id,
        submittedData: data as any,
        status: 'PENDING',
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SELLER_APPLICATION_SUBMITTED',
      entityType: 'Seller',
      entityId: seller.id,
      metadata: { applicationId: application.id, payoutMethodType: data.payoutMethodType },
      ipAddress,
    });

    return { seller, application };
  }

  async adminListSellers(status?: string, q?: string) {
    return this.prisma.seller.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(q?.trim()
          ? {
              OR: [
                { fullName: { contains: q.trim(), mode: 'insensitive' } },
                { phoneE164: { contains: q.trim() } },
                { email: { contains: q.trim(), mode: 'insensitive' } },
                { codes: { some: { code: { contains: q.trim().toUpperCase() } } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true, phoneE164: true, role: true } },
        codes: { orderBy: { createdAt: 'desc' } },
        applications: { orderBy: { createdAt: 'desc' }, take: 3 },
        _count: {
          select: {
            attributedOrders: true,
            commissions: true,
            payouts: true,
          },
        },
      },
    });
  }

  async adminReviewSellerApplication(
    actor: AuthenticatedContextUser,
    sellerId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = sellerReviewApplicationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات المراجعة غير صالحة');
    }

    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: { applications: { orderBy: { createdAt: 'desc' }, take: 1 }, codes: true },
    });
    if (!seller) {
      throw new NotFoundException('ملف البائع غير موجود');
    }

    const nextStatus =
      parsed.data.decision === 'APPROVE'
        ? 'APPROVED'
        : parsed.data.decision === 'REJECT'
          ? 'REJECTED'
          : 'CHANGES_REQUESTED';

    let createdCode: string | null = null;
    if (nextStatus === 'APPROVED' && parsed.data.initialCode) {
      const check = parseAndNormalizeSellerCode(parsed.data.initialCode);
      if (!check.ok) {
        throw new BadRequestException(check.messageAr || 'كود البائع غير صالح');
      }
      const dup = await this.prisma.sellerCode.findUnique({ where: { code: check.normalized } });
      if (dup && dup.sellerId !== seller.id) {
        throw new ConflictException('هذا الكود مستخدم بالفعل لبائع آخر');
      }
      createdCode = check.normalized;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const savedSeller = await tx.seller.update({
        where: { id: seller.id },
        data: {
          status: nextStatus,
          kycVerified: nextStatus === 'APPROVED' ? parsed.data.verifyKycAndPayout : seller.kycVerified,
          payoutVerified: nextStatus === 'APPROVED' ? parsed.data.verifyKycAndPayout : seller.payoutVerified,
          verifiedById: nextStatus === 'APPROVED' ? actor.id : seller.verifiedById,
          verifiedAt: nextStatus === 'APPROVED' ? new Date() : seller.verifiedAt,
        },
      });

      if (seller.applications[0]) {
        await tx.sellerApplication.update({
          where: { id: seller.applications[0].id },
          data: {
            status: nextStatus,
            reviewNotesAr: parsed.data.reviewNotesAr ?? null,
            reviewedById: actor.id,
            reviewedAt: new Date(),
          },
        });
      }

      if (createdCode) {
        await tx.sellerCode.upsert({
          where: { code: createdCode },
          update: { isActive: true },
          create: { sellerId: seller.id, code: createdCode, isActive: true },
        });
      }

      return savedSeller;
    });

    if (nextStatus === 'APPROVED') {
      await this.ensureSellerRoleAssigned(seller.userId, actor.id);
    }

    await this.prisma.notification.createMany({
      data: [
        {
          userId: seller.userId,
          type: 'COMMISSION_STATUS_UPDATED',
          titleAr:
            nextStatus === 'APPROVED'
              ? 'تمت الموافقة على حسابك كبائع في أكاديمية بوصلة'
              : nextStatus === 'REJECTED'
                ? 'تم رفض طلب الانضمام كبائع'
                : 'مطلوب تعديلات على طلب البائع الخاص بك',
          bodyAr:
            parsed.data.reviewNotesAr ||
            (nextStatus === 'APPROVED'
              ? 'يمكنك الآن استخدام بوابة البائع وأكواد وروابط الإحالة الخاصة بك.'
              : 'يرجى مراجعة حالة الطلب من بوابة البائع.'),
          actionUrl: '/seller',
          dedupKey: `seller-review-${seller.id}-${Date.now()}`,
        },
      ],
      skipDuplicates: true,
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: `SELLER_APPLICATION_${parsed.data.decision}`,
      entityType: 'Seller',
      entityId: seller.id,
      metadata: {
        previousStatus: seller.status,
        newStatus: nextStatus,
        initialCode: createdCode,
        reviewNotesAr: parsed.data.reviewNotesAr ?? null,
      },
      ipAddress,
    });

    return updated;
  }

  async adminChangeSellerStatus(
    actor: AuthenticatedContextUser,
    sellerId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = sellerStatusChangeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الحالة غير صالحة');
    }

    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('ملف البائع غير موجود');

    const updated = await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        status: parsed.data.status,
        suspensionReasonAr: parsed.data.status === 'SUSPENDED' ? parsed.data.reasonAr : null,
        ...(parsed.data.kycVerified !== undefined ? { kycVerified: parsed.data.kycVerified } : {}),
        ...(parsed.data.payoutVerified !== undefined ? { payoutVerified: parsed.data.payoutVerified } : {}),
        ...(parsed.data.kycVerified || parsed.data.payoutVerified
          ? { verifiedById: actor.id, verifiedAt: new Date() }
          : {}),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: parsed.data.status === 'SUSPENDED' ? 'SELLER_SUSPENDED' : 'SELLER_REACTIVATED',
      entityType: 'Seller',
      entityId: seller.id,
      metadata: {
        previousStatus: seller.status,
        newStatus: parsed.data.status,
        reasonAr: parsed.data.reasonAr,
        kycVerified: updated.kycVerified,
        payoutVerified: updated.payoutVerified,
      },
      ipAddress,
    });

    return updated;
  }

  // ============================================================
  // 2. SELLER CODES & QR GENERATION
  // ============================================================

  async createSellerCode(
    actor: AuthenticatedContextUser,
    sellerId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = createSellerCodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الكود غير صالحة');
    }

    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('ملف البائع غير موجود');
    if (seller.status !== 'APPROVED') {
      throw new BadRequestException('لا يمكن إصدار كود لبائع غير معتمد');
    }

    const codeCheck = parseAndNormalizeSellerCode(parsed.data.code);
    if (!codeCheck.ok) {
      throw new BadRequestException(codeCheck.messageAr || 'صيغة كود البائع غير صالحة');
    }

    const exists = await this.prisma.sellerCode.findUnique({
      where: { code: codeCheck.normalized },
    });
    if (exists) {
      throw new ConflictException('هذا الكود مستخدم بالفعل بعد التطبيع (Normalization)');
    }

    const saved = await this.prisma.sellerCode.create({
      data: {
        sellerId: seller.id,
        code: codeCheck.normalized,
        allowedCourseIds: parsed.data.allowedCourseIds,
        isActive: true,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'SELLER_CODE_CREATED',
      entityType: 'SellerCode',
      entityId: saved.id,
      metadata: { sellerId: seller.id, code: saved.code, allowedCourseIds: saved.allowedCourseIds },
      ipAddress,
    });

    const referralUrl = this.buildReferralUrl(saved.code);
    const qrSvg = await QRCode.toString(referralUrl, { type: 'svg', margin: 1, width: 220 });

    return { ...saved, referralUrl, qrSvg };
  }

  async toggleSellerCode(
    actor: AuthenticatedContextUser,
    codeId: string,
    isActive: boolean,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.sellerCode.findUnique({ where: { id: codeId } });
    if (!existing) throw new NotFoundException('كود البائع غير موجود');

    const updated = await this.prisma.sellerCode.update({
      where: { id: codeId },
      data: { isActive },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: isActive ? 'SELLER_CODE_ACTIVATED' : 'SELLER_CODE_DEACTIVATED',
      entityType: 'SellerCode',
      entityId: updated.id,
      metadata: { sellerId: updated.sellerId, code: updated.code },
      ipAddress,
    });

    return updated;
  }

  async getCodeQrSvg(codeId: string, requestingUser: AuthenticatedContextUser) {
    const code = await this.prisma.sellerCode.findUnique({ where: { id: codeId } });
    if (!code) throw new NotFoundException('كود البائع غير موجود');

    const isManager =
      requestingUser.permissions.includes('sellers.manage') ||
      requestingUser.roles.includes('ADMIN') ||
      requestingUser.roles.includes('SUPER_ADMIN');
    if (!isManager && requestingUser.sellerId !== code.sellerId) {
      throw new ForbiddenException('لا يمكنك الوصول إلى أكواد بائع آخر');
    }

    const referralUrl = this.buildReferralUrl(code.code);
    const qrSvg = await QRCode.toString(referralUrl, { type: 'svg', margin: 1, width: 260 });
    return { code: code.code, referralUrl, qrSvg };
  }

  // ============================================================
  // 3. SERVER-SIDE REFERRAL TRACKING (30 DAYS, NO PII) & CODE VALIDATION
  // ============================================================

  async trackReferralVisit(params: {
    rawCode: string;
    userId?: string | null;
    landingPath?: string;
    sourceTag?: string;
    ipAddress?: string;
  }) {
    const parsed = parseAndNormalizeSellerCode(params.rawCode);
    if (!parsed.ok) {
      return { valid: false as const, message: INVALID_SELLER_CODE_MESSAGE };
    }

    const sellerCode = await this.prisma.sellerCode.findUnique({
      where: { code: parsed.normalized },
      include: { seller: true },
    });

    if (!sellerCode || !sellerCode.isActive || sellerCode.seller.status !== 'APPROVED') {
      return { valid: false as const, message: INVALID_SELLER_CODE_MESSAGE };
    }

    // Opaque server-side tracking token with ZERO PII
    const trackingToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + REFERRAL_WINDOW_DAYS * 86_400_000);

    const referral = await this.prisma.sellerReferral.create({
      data: {
        trackingToken,
        sellerId: sellerCode.sellerId,
        sellerCodeId: sellerCode.id,
        normalizedCode: sellerCode.code,
        userId: params.userId ?? null,
        landingPath: params.landingPath || '/',
        sourceTag: params.sourceTag?.slice(0, 80) ?? null,
        expiresAt,
      },
    });

    return {
      valid: true as const,
      trackingToken: referral.trackingToken,
      code: sellerCode.code,
      expiresAt: referral.expiresAt,
      sellerDisplayName: sellerCode.seller.fullName,
    };
  }

  async resolvePrefillFromReferralToken(
    trackingToken?: string | null,
    userId?: string | null,
  ): Promise<{
    referralId: string;
    sellerId: string;
    sellerCodeId: string;
    code: string;
    expiresAt: Date;
  } | null> {
    const now = new Date();
    let referral = trackingToken
      ? await this.prisma.sellerReferral.findUnique({
          where: { trackingToken },
          include: { seller: true, sellerCode: true },
        })
      : null;

    if (!referral && userId) {
      referral = await this.prisma.sellerReferral.findFirst({
        where: { userId, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
        include: { seller: true, sellerCode: true },
      });
    }

    if (!referral) return null;
    if (referral.expiresAt <= now) return null;
    if (!referral.sellerCode.isActive || referral.seller.status !== 'APPROVED') return null;

    return {
      referralId: referral.id,
      sellerId: referral.sellerId,
      sellerCodeId: referral.sellerCodeId,
      code: referral.sellerCode.code,
      expiresAt: referral.expiresAt,
    };
  }

  /**
   * Validates a seller code for checkout with strict anti-enumeration rate limiting:
   * max 5 invalid attempts per 60 seconds per IP/user, uniform error message (AT-071).
   */
  async validateSellerCodeForCheckout(params: {
    rawCode: string;
    courseIds: string[];
    buyer: { id: string; email?: string | null; phoneE164?: string | null };
    ipAddress?: string;
    enforceRateLimit?: boolean;
  }): Promise<{
    valid: boolean;
    selfPurchaseBlocked?: boolean;
    message?: string;
    seller?: { id: string; userId: string; fullName: string };
    sellerCode?: { id: string; code: string; allowedCourseIds: string[] };
  }> {
    const rateKey = `seller-code-invalid:${params.ipAddress || 'unknown'}:${params.buyer.id}`;

    const rejectInvalid = async (reasonForAudit?: string) => {
      if (params.enforceRateLimit !== false) {
        const attempts = await this.redis.incrementRateLimit(rateKey, 60);
        if (attempts.count > 5) {
          throw new HttpException(
            'تم تجاوز الحد المسموح لمحاولات التحقق من كود البائع، يرجى المحاولة بعد دقيقة',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      if (reasonForAudit) {
        await this.audit.log({
          actorId: params.buyer.id,
          action: 'SELLER_CODE_VALIDATION_REJECTED',
          entityType: 'SellerCode',
          metadata: { reason: reasonForAudit },
          ipAddress: params.ipAddress,
        });
      }
      return { valid: false, message: INVALID_SELLER_CODE_MESSAGE };
    };

    const parsed = parseAndNormalizeSellerCode(params.rawCode);
    if (!parsed.ok) {
      return rejectInvalid('FORMAT_INVALID');
    }

    const sellerCode = await this.prisma.sellerCode.findUnique({
      where: { code: parsed.normalized },
      include: { seller: { include: { user: { select: { email: true, phoneE164: true } } } } },
    });

    if (!sellerCode || !sellerCode.isActive || sellerCode.seller.status !== 'APPROVED') {
      return rejectInvalid('INACTIVE_OR_NOT_FOUND');
    }

    // Course restriction check (uniform message for anti-enumeration)
    if (sellerCode.allowedCourseIds.length > 0 && params.courseIds.length > 0) {
      const allowedSet = new Set(sellerCode.allowedCourseIds);
      const anyAllowed = params.courseIds.some((cid) => allowedSet.has(cid));
      if (!anyAllowed) {
        return rejectInvalid('COURSE_NOT_ALLOWED');
      }
    }

    // Self-purchase detection (AT-012): userId, email, or normalized phone match
    const sellerEmails = new Set(
      [sellerCode.seller.email, sellerCode.seller.user.email]
        .filter((v): v is string => Boolean(v))
        .map((e) => e.trim().toLowerCase()),
    );
    const sellerPhones = new Set(
      [sellerCode.seller.phoneE164, sellerCode.seller.user.phoneE164].filter((v): v is string => Boolean(v)),
    );

    const isSelfPurchase =
      params.buyer.id === sellerCode.seller.userId ||
      (params.buyer.email ? sellerEmails.has(params.buyer.email.trim().toLowerCase()) : false) ||
      (params.buyer.phoneE164 ? sellerPhones.has(params.buyer.phoneE164) : false);

    if (isSelfPurchase) {
      await this.audit.log({
        actorId: params.buyer.id,
        action: 'SELF_PURCHASE_BLOCKED',
        entityType: 'Seller',
        entityId: sellerCode.sellerId,
        metadata: {
          code: sellerCode.code,
          buyerId: params.buyer.id,
        },
        ipAddress: params.ipAddress,
      });
      return {
        valid: false,
        selfPurchaseBlocked: true,
        message: 'لا يجوز استخدام كود البائع على مشترياتك الشخصية',
      };
    }

    return {
      valid: true,
      seller: {
        id: sellerCode.seller.id,
        userId: sellerCode.seller.userId,
        fullName: sellerCode.seller.fullName,
      },
      sellerCode: {
        id: sellerCode.id,
        code: sellerCode.code,
        allowedCourseIds: sellerCode.allowedCourseIds,
      },
    };
  }

  // ============================================================
  // 4. SELLER PORTAL (STRICT OWN-DATA ISOLATION — AT-061)
  // ============================================================

  async getSellerPortalOverview(user: AuthenticatedContextUser) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: user.id },
      include: {
        applications: { orderBy: { createdAt: 'desc' }, take: 5 },
        codes: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!seller) {
      return {
        hasSellerProfile: false,
        status: null,
        seller: null,
      };
    }

    const [orders, commissions, payouts, reversalDebits, materials, notifications] = await Promise.all([
      this.prisma.order.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          refundedAmount: true,
          sellerCodeSnapshot: true,
          paidAt: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              courseId: true,
              courseTitleSnapshotAr: true,
              finalPrice: true,
              allocatedPaidAmount: true,
              refundedAmount: true,
            },
          },
        },
      }),
      this.prisma.sellerCommission.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          course: { select: { id: true, slug: true, publishedVersion: { select: { titleAr: true } } } },
          order: { select: { orderNumber: true, status: true } },
          history: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      }),
      this.prisma.sellerPayout.findMany({
        where: { sellerId: seller.id },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        include: {
          items: { where: { isVoided: false } },
        },
      }),
      this.prisma.reversalDebit.findMany({
        where: { sellerId: seller.id, remainingAmount: { gt: 0 } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.marketingMaterial.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const codesWithLinks = await Promise.all(
      seller.codes.map(async (c) => {
        const referralUrl = this.buildReferralUrl(c.code);
        const qrSvg = await QRCode.toString(referralUrl, { type: 'svg', margin: 1, width: 180 });
        return { ...c, referralUrl, qrSvg };
      }),
    );

    // Aggregate strictly using decimal strings -> exact integer sums
    const sumByStatus = (status: string) =>
      commissions
        .filter((c) => c.status === status)
        .reduce((acc, c) => acc + Math.round(Number(c.netAmount) * 100), 0) / 100;

    const totalSalesEgp =
      orders
        .filter((o) => o.status === 'PAID' || o.status === 'PARTIALLY_PAID')
        .reduce((acc, o) => acc + Math.round(Number(o.paidAmount) * 100), 0) / 100;

    const totalReversedEgp =
      commissions.reduce((acc, c) => acc + Math.round(Number(c.reversedAmount) * 100), 0) / 100;

    const openReversalDebitEgp =
      reversalDebits.reduce((acc, d) => acc + Math.round(Number(d.remainingAmount) * 100), 0) / 100;

    const pendingPayoutsEgp =
      payouts
        .filter((p) => p.status === 'DRAFT' || p.status === 'APPROVED')
        .reduce((acc, p) => acc + Math.round(Number(p.netPayableAmount) * 100), 0) / 100;

    return {
      hasSellerProfile: true,
      status: seller.status,
      seller: {
        id: seller.id,
        fullName: seller.fullName,
        phoneE164: seller.phoneE164,
        email: seller.email,
        status: seller.status,
        kycVerified: seller.kycVerified,
        payoutVerified: seller.payoutVerified,
        payoutMethodType: seller.payoutMethodType,
        payoutAccountName: seller.payoutAccountName,
        payoutAccountDetails: seller.payoutAccountDetails,
        minPayoutAmount: Number(seller.minPayoutAmount),
        suspensionReasonAr: seller.suspensionReasonAr,
        applications: seller.applications,
      },
      summary: {
        totalAttributedOrders: orders.length,
        totalSoldCourses: orders.reduce((acc, o) => acc + o.items.length, 0),
        totalSalesEgp,
        onHoldCommissionsEgp: sumByStatus('ON_HOLD'),
        eligibleCommissionsEgp: sumByStatus('ELIGIBLE'),
        approvedCommissionsEgp: sumByStatus('APPROVED'),
        paidCommissionsEgp: sumByStatus('PAID'),
        disputedCommissionsEgp: sumByStatus('DISPUTED'),
        reversedCommissionsEgp: totalReversedEgp,
        openReversalDebitEgp,
        pendingPayoutsEgp,
      },
      codes: codesWithLinks,
      orders,
      commissions,
      payouts,
      reversalDebits,
      materials,
      notifications,
    };
  }

  async getSellerPayoutDetailForOwner(user: AuthenticatedContextUser, payoutId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { userId: user.id } });
    if (!seller) throw new ForbiddenException('لا تملك ملف بائع نشط');

    const payout = await this.prisma.sellerPayout.findUnique({
      where: { id: payoutId },
      include: {
        items: {
          include: {
            commission: {
              include: {
                course: { select: { slug: true, publishedVersion: { select: { titleAr: true } } } },
                order: { select: { orderNumber: true } },
              },
            },
          },
        },
        settledDebits: true,
        adjustments: true,
      },
    });
    if (!payout || payout.sellerId !== seller.id) {
      throw new ForbiddenException('لا يمكنك الاطلاع على تسويات بائع آخر');
    }
    return payout;
  }

  async createMarketingMaterial(
    actor: AuthenticatedContextUser,
    body: {
      titleAr: string;
      descriptionAr?: string;
      assetType?: string;
      assetUrl?: string;
      copyTextAr?: string;
      courseId?: string;
    },
  ) {
    if (!body.titleAr?.trim()) {
      throw new BadRequestException('عنوان المادة التسويقية مطلوب');
    }
    return this.prisma.marketingMaterial.create({
      data: {
        titleAr: body.titleAr.trim(),
        descriptionAr: body.descriptionAr?.trim() || null,
        assetType: body.assetType || 'COPY',
        assetUrl: body.assetUrl?.trim() || null,
        copyTextAr: body.copyTextAr?.trim() || null,
        courseId: body.courseId || null,
        isActive: true,
      },
    });
  }
}
