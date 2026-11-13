import { describe, expect, it } from 'vitest';
import {
  evaluateCourseAccess,
  normalizePhoneToE164,
  rankSpecializationDomains,
  resolvePlanCourseIds,
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
