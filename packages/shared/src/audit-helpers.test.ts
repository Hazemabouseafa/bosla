import { describe, expect, it } from 'vitest';
import {
  buildLearnerWatermarkText,
  clampActiveWatchDelta,
  decryptSecretAesGcm,
  encryptSecretAesGcm,
  evaluateCouponEligibilityAndDiscount,
  evaluateCourseWizardCompleteness,
  isMaskedSecretPlaceholder,
  maskSecretValue,
  resolveMonotonicLessonProgress,
  sanitizeLiveEditorConfig,
  shouldDiscloseQuizAnswers,
  validateAndNormalizeWebVtt,
} from './audit-helpers';

describe('Audit Domain Helpers (TDD)', () => {
  describe('validateAndNormalizeWebVtt (3.G Subtitles only — no transcript search)', () => {
    it('validates standard WebVTT with Arabic cues, counts cues, and strips script tags', () => {
      const raw = [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:04.500',
        'مرحباً بكم في محاضرة الأمان الحيوي <script>alert(1)</script>',
        '',
        '00:00:05.000 --> 00:00:09.000',
        'الخطوة الأولى: تطهير العنبر بالكامل',
      ].join('\r\n');

      const res = validateAndNormalizeWebVtt(raw);
      expect(res.valid).toBe(true);
      expect(res.cueCount).toBe(2);
      expect(res.normalizedVtt.startsWith('WEBVTT\n')).toBe(true);
      expect(res.normalizedVtt).not.toContain('<script>');
      expect(res.normalizedVtt).toContain('مرحباً بكم في محاضرة الأمان الحيوي');
    });

    it('rejects files missing WEBVTT header or containing zero valid timed cues', () => {
      expect(validateAndNormalizeWebVtt('1\n00:00:01,000 --> 00:00:03,000\nSRT not VTT').valid).toBe(
        false,
      );
      expect(validateAndNormalizeWebVtt('WEBVTT\n\nبدون توقيت زمني').valid).toBe(false);
    });
  });

  describe('resolveMonotonicLessonProgress (3.B Resume Watching)', () => {
    it('ignores out-of-order older clientSequence updates so delayed ticks never rewind seek', () => {
      const existing = {
        watchedSeconds: 240,
        durationSeconds: 300,
        progressPercent: 80,
        isCompleted: false,
        completedAt: null,
        lastClientSequence: 12,
      };

      const staleResult = resolveMonotonicLessonProgress(existing, {
        watchedSeconds: 45,
        durationSeconds: 300,
        clientSequence: 9,
      });

      expect(staleResult.ignoredOutOfOrder).toBe(true);
      expect(staleResult.watchedSeconds).toBe(240);
      expect(staleResult.lastClientSequence).toBe(12);
    });

    it('marks completed at >= 90% and preserves completion when restarting lesson from 0s', () => {
      const completed = resolveMonotonicLessonProgress(null, {
        watchedSeconds: 275,
        durationSeconds: 300,
        clientSequence: 15,
      });
      expect(completed.isCompleted).toBe(true);
      expect(completed.progressPercent).toBe(92);

      const restarted = resolveMonotonicLessonProgress(
        {
          ...completed,
          completedAt: new Date('2026-11-23T10:00:00Z'),
        },
        {
          watchedSeconds: 0,
          durationSeconds: 300,
          resetPosition: true,
          clientSequence: 16,
        },
      );
      expect(restarted.watchedSeconds).toBe(0);
      expect(restarted.isCompleted).toBe(true);
      expect(restarted.progressPercent).toBe(92);
    });
  });

  describe('buildLearnerWatermarkText (3.C Personalized Watermark)', () => {
    it('formats safe learner identifier with masked phone and short ID without leaking secrets', () => {
      const label = buildLearnerWatermarkText(
        {
          id: 'cm8abc123xyz9876',
          fullName: 'د. أحمد محمد',
          phoneE164: '+201012345678',
        },
        {
          enabled: true,
          opacity: 0.22,
          moveIntervalSeconds: 10,
          showMaskedPhone: true,
          showUserCode: true,
        },
      );
      expect(label).toContain('د. أحمد محمد');
      expect(label).toContain('5678');
      expect(label).not.toContain('+201012345678');
      expect(label).toContain('ID:9876');
    });
  });

  describe('clampActiveWatchDelta (3.F Meaningful Watch Analytics)', () => {
    it('excludes paused intervals and clamps wall-clock bursts so seeks/tabs cannot inflate watch time', () => {
      expect(
        clampActiveWatchDelta({
          reportedDeltaSeconds: 10,
          isPaused: true,
          elapsedSinceLastHeartbeatMs: 10_000,
        }),
      ).toBe(0);

      // Simultaneous tab or rapid seek sending heartbeat 1s after previous heartbeat claiming +15s:
      expect(
        clampActiveWatchDelta({
          reportedDeltaSeconds: 15,
          isPaused: false,
          elapsedSinceLastHeartbeatMs: 1_000,
          playbackRate: 2,
        }),
      ).toBeLessThanOrEqual(3);
    });
  });

  describe('shouldDiscloseQuizAnswers (3.J Quiz Answer Disclosure)', () => {
    it('withholds answers on failed attempts before maxAttempts under AFTER_PASS_OR_MAX_ATTEMPTS', () => {
      expect(
        shouldDiscloseQuizAnswers({
          policy: 'AFTER_PASS_OR_MAX_ATTEMPTS',
          passed: false,
          attemptCountAfterSubmit: 1,
          maxAttempts: 3,
        }),
      ).toBe(false);

      expect(
        shouldDiscloseQuizAnswers({
          policy: 'AFTER_PASS_OR_MAX_ATTEMPTS',
          passed: false,
          attemptCountAfterSubmit: 3,
          maxAttempts: 3,
        }),
      ).toBe(true);

      expect(
        shouldDiscloseQuizAnswers({
          policy: 'AFTER_PASS_OR_MAX_ATTEMPTS',
          passed: true,
          attemptCountAfterSubmit: 1,
          maxAttempts: 3,
        }),
      ).toBe(true);

      expect(
        shouldDiscloseQuizAnswers({
          policy: 'NEVER',
          passed: true,
          attemptCountAfterSubmit: 3,
          maxAttempts: 3,
        }),
      ).toBe(false);
    });
  });

  describe('evaluateCouponEligibilityAndDiscount (4.C Coupons)', () => {
    const now = new Date('2026-11-23T12:00:00Z');
    const baseCoupon = {
      isActive: true,
      discountType: 'PERCENT' as const,
      discountValuePiastersOrPercent: 25,
      maxDiscountPiasters: 30000,
      minOrderPiasters: 40000,
      applicableTargetType: 'DIPLOMA' as const,
      applicableDiplomaId: 'dip-1',
      usageLimit: 10,
      usageCount: 3,
      perUserLimit: 1,
      userRedemptionCount: 0,
      validFrom: new Date('2026-11-01T00:00:00Z'),
      validTo: new Date('2026-12-01T00:00:00Z'),
    };

    it('applies capped discount on matching diploma and blocks wrong target or exhausted per-user limit', () => {
      const ok = evaluateCouponEligibilityAndDiscount({
        coupon: baseCoupon,
        targetType: 'DIPLOMA',
        targetIds: ['dip-1'],
        subtotalPiasters: 180000,
        eligibleSubtotalPiasters: 180000,
        now,
      });
      expect(ok.eligible).toBe(true);
      // 25% of 1800 EGP = 450 EGP (45000 piasters), capped at maxDiscountPiasters = 30000
      expect(ok.discountPiasters).toBe(30000);
      expect(ok.finalTotalPiasters).toBe(150000);

      const wrongTarget = evaluateCouponEligibilityAndDiscount({
        coupon: baseCoupon,
        targetType: 'MEMBERSHIP_PLAN',
        targetIds: ['plan-monthly'],
        subtotalPiasters: 50000,
        eligibleSubtotalPiasters: 50000,
        now,
      });
      expect(wrongTarget.eligible).toBe(false);

      const perUserExhausted = evaluateCouponEligibilityAndDiscount({
        coupon: { ...baseCoupon, userRedemptionCount: 1 },
        targetType: 'DIPLOMA',
        targetIds: ['dip-1'],
        subtotalPiasters: 180000,
        eligibleSubtotalPiasters: 180000,
        now,
      });
      expect(perUserExhausted.eligible).toBe(false);
    });
  });

  describe('Paymob AES-256-GCM Secret Encryption & Masking (Section 8)', () => {
    it('encrypts secrets with AES-256-GCM, decrypts back accurately, and masks secrets for browser display', () => {
      const masterKey = 'bosla-unit-test-encryption-key-32bytes-seed';
      const plainSecret = 'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5_9876';
      const cipher = encryptSecretAesGcm(plainSecret, masterKey);

      expect(cipher).not.toContain(plainSecret);
      expect(cipher.startsWith('enc:v1:')).toBe(true);
      expect(decryptSecretAesGcm(cipher, masterKey)).toBe(plainSecret);

      const masked = maskSecretValue(plainSecret);
      expect(masked).toBe('••••••••9876');
      expect(isMaskedSecretPlaceholder(masked)).toBe(true);
      expect(isMaskedSecretPlaceholder(plainSecret)).toBe(false);
    });
  });

  describe('Live Editor XSS & URL Sanitization (Section 6)', () => {
    it('strips script tags, inline event handlers, and javascript: URLs while keeping valid Arabic copy and safe links', () => {
      const dirty = {
        hero: {
          titleAr: 'أكاديمية بوصلة <script>alert("xss")</script> للتأهيل الميداني',
          subtitleAr: 'من الطالب إلى المدير <img src=x onerror=alert(1)>',
          primaryCtaLabelAr: 'ابدأ الآن',
          primaryCtaHref: 'javascript:alert(document.cookie)',
          secondaryCtaHref: '/courses',
        },
        pricing: {
          visible: true,
          titleAr: 'الباقات والأسعار',
          featuredPlanId: 'plan-annual',
          orderedPlanIds: ['plan-monthly', 'plan-annual'],
        },
      };

      const clean = sanitizeLiveEditorConfig(dirty);
      expect(clean.hero.titleAr).toBe('أكاديمية بوصلة للتأهيل الميداني');
      expect(clean.hero.subtitleAr).not.toContain('onerror');
      expect(clean.hero.primaryCtaHref).toBe('/');
      expect(clean.hero.secondaryCtaHref).toBe('/courses');
      expect(clean.pricing.featuredPlanId).toBe('plan-annual');
    });
  });

  describe('4-Step Course Wizard Completeness Check (Section 2)', () => {
    it('reports exact missing items with step numbers and field anchors, and passes when ready', () => {
      const incomplete = evaluateCourseWizardCompleteness({
        titleAr: 'كو',
        descriptionAr: 'قصير',
        thumbnailUrl: '',
        isFree: false,
        priceEgp: 0,
        allowIndividualPurchase: true,
        includedInMembership: false,
        sections: [],
        videosById: {},
      });

      expect(incomplete.readyToPublish).toBe(false);
      expect(incomplete.issues.some((i) => i.step === 1 && i.fieldId === 'cw-title')).toBe(true);
      expect(incomplete.issues.some((i) => i.step === 1 && i.fieldId === 'cw-desc')).toBe(true);
      expect(incomplete.issues.some((i) => i.step === 2 && i.fieldId === 'cw-cover')).toBe(true);
      expect(incomplete.issues.some((i) => i.step === 3 && i.fieldId === 'cw-lessons')).toBe(true);
      expect(incomplete.issues.some((i) => i.step === 4 && i.fieldId === 'cw-price')).toBe(true);

      const ready = evaluateCourseWizardCompleteness({
        titleAr: 'إدارة مزارع الدواجن الحديثة',
        descriptionAr: 'برنامج عملي متكامل يغطي التهوية والأمان الحيوي وحساب معامل التحويل الغذائي.',
        thumbnailUrl: '/images/brand/course-farm-management.webp',
        isFree: false,
        priceEgp: 450,
        allowIndividualPurchase: true,
        includedInMembership: true,
        sections: [
          {
            titleAr: 'القسم الأول',
            lessons: [
              {
                titleAr: 'الدرس الأول',
                type: 'VIDEO',
                videoAssetId: 'vid-1',
                isFreePreview: true,
              },
            ],
          },
        ],
        videosById: {
          'vid-1': { id: 'vid-1', status: 'READY' },
        },
      });
      expect(ready.readyToPublish).toBe(true);
      expect(ready.issues).toHaveLength(0);
    });
  });
});
