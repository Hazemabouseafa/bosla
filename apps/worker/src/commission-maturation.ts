import type { PrismaClient } from '@bosla/db';

/**
 * Worker-side 14-day Cairo hold maturation task.
 * Mirrors CommissionEngineService.runHourlyEligibilityMaturation cleanly for BullMQ / standalone worker.
 */
export async function runWorkerCommissionMaturation(
  prisma: PrismaClient,
  nowUtc: Date = new Date(),
): Promise<{ checked: number; transitioned: number }> {
  const candidates = await prisma.sellerCommission.findMany({
    where: {
      status: 'ON_HOLD',
      eligibleAt: { lte: nowUtc },
    },
    include: {
      order: { select: { orderNumber: true, status: true, isFlaggedSuspicious: true } },
      orderItem: { select: { entitlementRevokedAt: true } },
      seller: { select: { userId: true } },
    },
  });

  let transitioned = 0;
  for (const comm of candidates) {
    if (
      comm.order.isFlaggedSuspicious ||
      comm.order.status === 'REFUNDED' ||
      comm.order.status === 'CANCELLED' ||
      comm.orderItem.entitlementRevokedAt ||
      Number(comm.netAmount) <= 0
    ) {
      continue;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.sellerCommission.updateMany({
        where: { id: comm.id, status: 'ON_HOLD' },
        data: { status: 'ELIGIBLE' },
      });
      if (res.count === 0) return false;

      await tx.commissionStatusHistory.create({
        data: {
          commissionId: comm.id,
          fromStatus: 'ON_HOLD',
          toStatus: 'ELIGIBLE',
          reasonAr: 'انتهاء فترة الانتظار (14 يوماً بتوقيت القاهرة) عبر مجدول المهام الخلفي',
          metadata: { evaluatedAtUtc: nowUtc.toISOString(), source: 'worker' },
        },
      });

      await tx.notification.createMany({
        data: [
          {
            userId: comm.seller.userId,
            type: 'COMMISSION_STATUS_UPDATED',
            titleAr: 'أصبحت عمولتك مؤهلة للاعتماد',
            bodyAr: `انتهت فترة الانتظار لعمولة الطلب ${comm.order.orderNumber} بقيمة ${comm.netAmount.toString()} ج.م.`,
            actionUrl: '/seller',
            dedupKey: `comm-eligible-${comm.id}`,
            courseId: comm.courseId,
          },
        ],
        skipDuplicates: true,
      });

      return true;
    });

    if (updated) transitioned += 1;
  }

  return { checked: candidates.length, transitioned };
}
