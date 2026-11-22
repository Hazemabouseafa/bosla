import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@bosla/db';
import type { PrismaService } from './prisma.service';

type DbClient = PrismaService | Prisma.TransactionClient;

const INDEPENDENT_GRANT_ENROLLMENT_SOURCES = [
  'B2B_ORG_ENROLLMENT',
  'ADMIN_GRANTED',
  'ADMIN_GRANT',
];

export function throwCourseCapacityExceededError(waitlistEnabled: boolean): never {
  throw new BadRequestException(
    waitlistEnabled
      ? 'اكتمل عدد المقاعد المتاحة — يمكنك الانضمام لقائمة الانتظار'
      : 'اكتمل عدد المقاعد المتاحة لهذا الكورس',
  );
}

/**
 * Locks `"Course"` `FOR UPDATE` inside an active transaction and verifies remaining
 * seat capacity for a prospective enrollment (`userId`). Already-enrolled learners do
 * not consume an additional seat.
 */
export async function assertCourseCapacityForEnrollmentTx(
  tx: Prisma.TransactionClient,
  params: { courseId: string; userId?: string },
): Promise<void> {
  const [lockedCourse] = await tx.$queryRaw<
    Array<{ id: string; maxCapacity: number | null; waitlistEnabled: boolean }>
  >`SELECT id, "maxCapacity", "waitlistEnabled" FROM "Course" WHERE id = ${params.courseId} FOR UPDATE`;

  if (!lockedCourse?.maxCapacity) return;

  if (params.userId) {
    const existing = await tx.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: params.userId, courseId: params.courseId } },
      select: { id: true },
    });
    if (existing) return;
  }

  const enrolledCount = await tx.courseEnrollment.count({ where: { courseId: params.courseId } });
  if (enrolledCount >= lockedCourse.maxCapacity) {
    throwCourseCapacityExceededError(lockedCourse.waitlistEnabled);
  }
}

/**
 * Ensures an ACTIVE `DirectPurchase` entitlement row exists for `(userId, courseId)`
 * when access is granted outside a standalone direct payment transaction (e.g., manual
 * admin grants, B2B bulk allocations, or multi-item cart order settlement).
 */
export async function ensureActiveCourseDirectPurchase(
  db: DbClient,
  params: { userId: string; courseId: string; amountCents?: number; purchasedAt?: Date },
): Promise<void> {
  const existing = await db.directPurchase.findFirst({
    where: {
      userId: params.userId,
      targetType: 'COURSE',
      courseId: params.courseId,
      status: 'ACTIVE',
      revokedAt: null,
    },
    select: { id: true },
  });

  if (!existing) {
    await db.directPurchase.create({
      data: {
        userId: params.userId,
        targetType: 'COURSE',
        courseId: params.courseId,
        amountCents: params.amountCents ?? 0,
        currency: 'EGP',
        status: 'ACTIVE',
        purchasedAt: params.purchasedAt ?? new Date(),
      },
    });
  }
}

/**
 * Cancels un-linked (`paymentTransactionId: null`) course `DirectPurchase` grants ONLY
 * when no other valid direct entitlement remains for `(userId, courseId)` (such as another
 * un-revoked paid order item or an active B2B/admin course enrollment grant).
 * Standalone `DirectPurchase` rows linked to a `PaymentTransaction` are never touched.
 */
export async function revokeUnlinkedCourseDirectPurchaseIfNoRemainingGrant(
  db: DbClient,
  params: {
    userId: string;
    courseId: string;
    excludeOrderItemId?: string;
    now?: Date;
  },
): Promise<boolean> {
  const [otherPaidOrderItem, activeIndependentGrant] = await Promise.all([
    db.orderItem.findFirst({
      where: {
        ...(params.excludeOrderItemId ? { id: { not: params.excludeOrderItemId } } : {}),
        courseId: params.courseId,
        entitlementGrantedAt: { not: null },
        entitlementRevokedAt: null,
        order: {
          userId: params.userId,
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
        },
      },
      select: { id: true },
    }),
    db.courseEnrollment.findFirst({
      where: {
        userId: params.userId,
        courseId: params.courseId,
        source: { in: INDEPENDENT_GRANT_ENROLLMENT_SOURCES },
      },
      select: { id: true },
    }),
  ]);

  if (otherPaidOrderItem || activeIndependentGrant) {
    return false;
  }

  await db.directPurchase.updateMany({
    where: {
      userId: params.userId,
      targetType: 'COURSE',
      courseId: params.courseId,
      status: 'ACTIVE',
      paymentTransactionId: null,
    },
    data: {
      status: 'CANCELLED',
      revokedAt: params.now ?? new Date(),
    },
  });

  return true;
}
