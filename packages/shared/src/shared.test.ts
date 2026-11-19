import { describe, expect, it } from 'vitest';
import {
  createCommunityPostSchema,
  evaluateCommunityAccess,
  evaluateCourseAccess,
  formatVideoTimestamp,
  normalizePhoneToE164,
  rankSpecializationDomains,
  resolvePlanCourseIds,
  sanitizeCommunityText,
  selectTranscodeQualities,
} from './index';

describe('normalizePhoneToE164', () => {
  it('normalizes Egyptian local and Arabic-Indic numbers to E.164', () => {
    expect(normalizePhoneToE164('01001226683', '+20')).toBe('+201001226683');
    expect(normalizePhoneToE164('٠١٠١٢٣٤٥٦٧٨', 'EG')).toBe('+201012345678');
    expect(normalizePhoneToE164('+20 112-345-6789')).toBe('+201123456789');
    expect(normalizePhoneToE164('00966501234567')).toBe('+966501234567');
  });

  it('rejects invalid Egyptian mobile numbers', () => {
    expect(normalizePhoneToE164('01912345678', '+20')).toBeNull();
    expect(normalizePhoneToE164('12345', '+20')).toBeNull();
  });
});

describe('evaluateCourseAccess', () => {
  const futureDate = new Date(Date.now() + 86400_000);
  const pastDate = new Date(Date.now() - 86400_000);

  it('denies unpublished courses to students even with active membership', () => {
    const decision = evaluateCourseAccess({
      isCoursePublished: false,
      isCourseFree: false,
      isLessonFreePreview: false,
      isAdmin: false,
      isCourseOwnerInstructor: false,
      activeSubscriptions: [
        { status: 'ACTIVE', currentPeriodEnd: futureDate, entitledCourseIds: ['c1'] },
      ],
      courseId: 'c1',
    });
    expect(decision).toEqual({ allowed: false, reason: 'UNPUBLISHED' });
  });

  it('allows free course and active membership, revokes expired membership', () => {
    expect(
      evaluateCourseAccess({
        isCoursePublished: true,
        isCourseFree: true,
        isLessonFreePreview: false,
        isAdmin: false,
        isCourseOwnerInstructor: false,
        activeSubscriptions: [],
        courseId: 'c1',
      }),
    ).toEqual({ allowed: true, reason: 'FREE_COURSE' });

    expect(
      evaluateCourseAccess({
        isCoursePublished: true,
        isCourseFree: false,
        isLessonFreePreview: false,
        isAdmin: false,
        isCourseOwnerInstructor: false,
        activeSubscriptions: [
          { status: 'ACTIVE', currentPeriodEnd: futureDate, entitledCourseIds: ['c1'] },
        ],
        courseId: 'c1',
      }),
    ).toEqual({ allowed: true, reason: 'ACTIVE_MEMBERSHIP' });

    expect(
      evaluateCourseAccess({
        isCoursePublished: true,
        isCourseFree: false,
        isLessonFreePreview: false,
        isAdmin: false,
        isCourseOwnerInstructor: false,
        activeSubscriptions: [
          { status: 'ACTIVE', currentPeriodEnd: pastDate, entitledCourseIds: ['c1'] },
        ],
        courseId: 'c1',
      }),
    ).toEqual({ allowed: false, reason: 'SUBSCRIPTION_REQUIRED' });
  });
});

describe('resolvePlanCourseIds', () => {
  it('deduplicates courses reused across direct, path, and diploma inclusions', () => {
    const ids = resolvePlanCourseIds({
      directCourseIds: ['c1', 'c2'],
      includedPathIds: ['p1'],
      learningPathCourses: [
        { learningPathId: 'p1', courseId: 'c2' },
        { learningPathId: 'p1', courseId: 'c3' },
      ],
      includedDiplomaIds: ['d1'],
      diplomaCourses: [
        { diplomaId: 'd1', courseId: 'c1' },
        { diplomaId: 'd1', courseId: 'c4' },
      ],
    });
    expect(ids.sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
  });
});

describe('selectTranscodeQualities', () => {
  it('never upscales low-resolution sources', () => {
    const q720 = selectTranscodeQualities(720, ['480p', '720p', '1080p']);
    expect(q720.map((x) => x.name)).toEqual(['480p', '720p']);

    const q360 = selectTranscodeQualities(360, ['480p', '720p', '1080p']);
    expect(q360).toHaveLength(1);
    expect(q360[0]?.height).toBe(360);
  });
});

describe('rankSpecializationDomains', () => {
  it('ranks matching domain weights higher', () => {
    const ranked = rankSpecializationDomains(
      [
        {
          id: '1',
          slug: 'poultry',
          nameAr: 'الدواجن',
          descriptionAr: '',
          weightsCode: 'p2c1',
          speciesCode: 'p',
          leafCount: 10,
        },
        {
          id: '2',
          slug: 'pets',
          nameAr: 'الحيوانات الأليفة',
          descriptionAr: '',
          weightsCode: 'c2',
          speciesCode: 't',
          leafCount: 10,
        },
      ],
      { p: 3 },
      { p: 1 },
    );
    expect(ranked[0]?.slug).toBe('poultry');
  });
});

describe('evaluateCommunityAccess', () => {
  const futureDate = new Date(Date.now() + 86400_000);
  const baseInput = {
    isAuthenticated: true,
    userRole: 'STUDENT' as const,
    isCourseOwnerInstructor: false,
    isCoursePublished: true,
    isCourseFree: false,
    isCommunityEnabled: true,
    isAdminDisabled: false,
    activeSubscriptions: [
      { status: 'ACTIVE' as const, currentPeriodEnd: futureDate, entitledCourseIds: ['c1'] },
    ],
    hasAnyExpiredMembership: false,
    hasStartedCourse: true,
    courseId: 'c1',
  };

  it('allows enrolled student with active membership entitlement', () => {
    const decision = evaluateCommunityAccess(baseInput);
    expect(decision.allowed).toBe(true);
    expect(decision.canPost).toBe(true);
    expect(decision.canModerate).toBe(false);
    expect(decision.reason).toBe('ACTIVE_MEMBERSHIP_ENROLLED');
  });

  it('enforces all 6 community conditions (expired, not enrolled, disabled, unassigned instructor)', () => {
    expect(
      evaluateCommunityAccess({
        ...baseInput,
        activeSubscriptions: [],
        hasAnyExpiredMembership: true,
      }).reason,
    ).toBe('MEMBERSHIP_EXPIRED');

    expect(
      evaluateCommunityAccess({
        ...baseInput,
        hasStartedCourse: false,
      }).reason,
    ).toBe('NOT_ENROLLED');

    expect(
      evaluateCommunityAccess({
        ...baseInput,
        isCommunityEnabled: false,
      }).reason,
    ).toBe('COMMUNITY_DISABLED');

    expect(
      evaluateCommunityAccess({
        ...baseInput,
        userRole: 'INSTRUCTOR',
        isCourseOwnerInstructor: false,
      }).reason,
    ).toBe('UNASSIGNED_INSTRUCTOR');

    const ownerDecision = evaluateCommunityAccess({
      ...baseInput,
      userRole: 'INSTRUCTOR',
      isCourseOwnerInstructor: true,
      activeSubscriptions: [],
      hasStartedCourse: false,
    });
    expect(ownerDecision.allowed).toBe(true);
    expect(ownerDecision.canModerate).toBe(true);
  });
});

describe('Community helpers & schemas', () => {
  it('sanitizes HTML tags and formats video timestamps safely', () => {
    expect(sanitizeCommunityText('<script>alert(1)</script>سؤال عن التهوية')).toBe(
      'alert(1)سؤال عن التهوية',
    );
    expect(formatVideoTimestamp(750)).toBe('12:30');
    expect(formatVideoTimestamp(-5)).toBeNull();
  });

  it('rejects negative timestamps or timestamps without lessonId', () => {
    const missingLesson = createCommunityPostSchema.safeParse({
      type: 'QUESTION',
      title: 'سؤال عام بدون درس',
      body: 'تفاصيل السؤال أكثر من 8 أحرف',
      videoTimestampSeconds: 120,
    });
    expect(missingLesson.success).toBe(false);

    const negTimestamp = createCommunityPostSchema.safeParse({
      lessonId: 'lesson-1',
      type: 'QUESTION',
      title: 'سؤال عن التهوية',
      body: 'لماذا نفضل هذه الطريقة في التهوية؟',
      videoTimestampSeconds: -10,
    });
    expect(negTimestamp.success).toBe(false);
  });
});

import {
  addCairoCalendarDays,
  allocatePaymentSequentially,
  computeCappedCommission,
  computeProportionalCommissionReversal,
  getCairoMonthBoundsUtc,
  getCairoWallClockParts,
  parseAndNormalizeSellerCode,
  piastersToDecimalString,
  resolvePermissionsFromRoles,
  toPiasters,
} from './index';

describe('Enterprise v1.2 Shared Financial, Timezone, Seller Code & RBAC Utilities', () => {
  it('computes fixed-point money in piasters with zero binary float drift', () => {
    expect(toPiasters(150)).toBe(15000);
    expect(toPiasters('199.95')).toBe(19995);
    expect(toPiasters('0.1')).toBe(10);
    expect(piastersToDecimalString(toPiasters('0.1') + toPiasters('0.2'))).toBe('0.30');
  });

  it('enforces configurable 50% commission cap on net discounted price and zero on free courses (AT-072, AT-073)', () => {
    const capped = computeCappedCommission({
      fixedCommissionPiasters: toPiasters(200),
      netItemPricePiasters: toPiasters(300),
      capPercent: 50,
    });
    expect(capped.appliedPiasters).toBe(toPiasters(150));
    expect(capped.wasCapped).toBe(true);

    const free = computeCappedCommission({
      fixedCommissionPiasters: toPiasters(200),
      netItemPricePiasters: 0,
    });
    expect(free.appliedPiasters).toBe(0);
  });

  it('allocates partial payments sequentially across ordered order items (AT-050, AT-087)', () => {
    const allocs = allocatePaymentSequentially({
      paymentAmountPiasters: toPiasters(700),
      items: [
        { orderItemId: 'i1', netAmountPiasters: toPiasters(500), alreadyPaidPiasters: 0 },
        { orderItemId: 'i2', netAmountPiasters: toPiasters(400), alreadyPaidPiasters: 0 },
        { orderItemId: 'i3', netAmountPiasters: toPiasters(300), alreadyPaidPiasters: 0 },
      ],
    });
    expect(allocs).toHaveLength(2);
    expect(allocs[0]).toMatchObject({ orderItemId: 'i1', allocatedPiasters: 50000, becomesFullyPaid: true });
    expect(allocs[1]).toMatchObject({ orderItemId: 'i2', allocatedPiasters: 20000, becomesFullyPaid: false });
  });

  it('computes proportional partial refund reversals & exact remainder on final refund (AT-074, AT-075, AT-076)', () => {
    const first = computeProportionalCommissionReversal({
      appliedCommissionPiasters: toPiasters(100),
      alreadyReversedPiasters: 0,
      refundAmountPiasters: toPiasters(100),
      netItemAmountPiasters: toPiasters(300),
      priorRefundedItemPiasters: 0,
    });
    expect(first.reversalPiasters).toBe(3333); // 33.33 EGP

    const second = computeProportionalCommissionReversal({
      appliedCommissionPiasters: toPiasters(100),
      alreadyReversedPiasters: first.newTotalReversedPiasters,
      refundAmountPiasters: toPiasters(100),
      netItemAmountPiasters: toPiasters(300),
      priorRefundedItemPiasters: toPiasters(100),
    });
    expect(second.reversalPiasters).toBe(3333);

    // Final partial refund bringing total refund to 300.00 loads exact remainder 33.34 -> total 100.00
    const third = computeProportionalCommissionReversal({
      appliedCommissionPiasters: toPiasters(100),
      alreadyReversedPiasters: second.newTotalReversedPiasters,
      refundAmountPiasters: toPiasters(100),
      netItemAmountPiasters: toPiasters(300),
      priorRefundedItemPiasters: toPiasters(200),
    });
    expect(third.reversalPiasters).toBe(3334);
    expect(third.newTotalReversedPiasters).toBe(10000);
    expect(third.isFullReversal).toBe(true);
  });

  it('preserves Africa/Cairo local wall-clock hour across DST shifts & calculates exact Cairo month bounds (AT-082, AT-083)', () => {
    // Egypt DST transition typically occurs late April (spring forward) and late October (fall back)
    const beforeSpringDst = new Date('2026-04-20T12:00:00.000Z'); // 14:00 Cairo (+2)
    const holdSpring = addCairoCalendarDays(beforeSpringDst, 14); // May 4 is +3 in Cairo
    const partsAfter = getCairoWallClockParts(holdSpring);
    expect(partsAfter.month).toBe(5);
    expect(partsAfter.day).toBe(4);
    expect(partsAfter.hour).toBe(14);
    expect(partsAfter.minute).toBe(0);

    const bounds = getCairoMonthBoundsUtc(2026, 3); // March 2026 (+2): starts 2026-02-28T22:00:00Z, ends 2026-03-31T21:59:59.999Z
    const startParts = getCairoWallClockParts(bounds.startUtc);
    const endParts = getCairoWallClockParts(bounds.endUtc);
    expect(startParts).toMatchObject({ year: 2026, month: 3, day: 1, hour: 0, minute: 0, second: 0 });
    expect(endParts).toMatchObject({ year: 2026, month: 3, day: 31, hour: 23, minute: 59, second: 59 });
  });

  it('normalizes seller codes (uppercase, whitespace stripped, 4-20 A-Z0-9, AT-070)', () => {
    const valid = parseAndNormalizeSellerCode('  bosla  2026 ');
    expect(valid).toEqual({ ok: true, normalized: 'BOSLA2026' });

    expect(parseAndNormalizeSellerCode('ab').ok).toBe(false);
    expect(parseAndNormalizeSellerCode('bad-code!').ok).toBe(false);
  });

  it('resolves multi-role permissions cleanly while keeping Support strictly non-financial', () => {
    const supportPerms = resolvePermissionsFromRoles(['SUPPORT']);
    expect(supportPerms.has('support.manage')).toBe(true);
    expect(supportPerms.has('settlements.approve')).toBe(false);
    expect(supportPerms.has('settlements.payout')).toBe(false);
    expect(supportPerms.has('orders.refund')).toBe(false);

    const multiPerms = resolvePermissionsFromRoles(['INSTRUCTOR', 'AFFILIATE_SELLER']);
    expect(multiPerms.has('courses.teach_assigned')).toBe(true);
    expect(multiPerms.has('sellers.portal')).toBe(true);
    expect(multiPerms.has('rbac.manage')).toBe(false);
  });
});
