import type {
  CouponTargetTypeValue,
  QuizDisclosurePolicyType,
} from './enums';

/**
 * Validates and normalizes a WebVTT subtitle file.
 * Strictly for timed captions/subtitles (`<track kind="subtitles">`) — never builds searchable transcripts.
 */
export function validateAndNormalizeWebVtt(raw: string): {
  valid: boolean;
  cueCount: number;
  normalizedVtt: string;
  errorAr?: string;
} {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, cueCount: 0, normalizedVtt: '', errorAr: 'ملف الترجمة فارغ' };
  }

  const normalizedLines = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .split('\n');

  const firstNonEmpty = normalizedLines.find((l) => l.trim().length > 0) ?? '';
  if (!/^WEBVTT(\s|$)/i.test(firstNonEmpty.trim())) {
    return {
      valid: false,
      cueCount: 0,
      normalizedVtt: '',
      errorAr: 'يجب أن يبدأ ملف الترجمة بترويسة WEBVTT القياسية',
    };
  }

  const cueTimingPattern =
    /^(?:\d{2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}\.\d{3}(?:\s+.*)?$/;

  let cueCount = 0;
  for (const line of normalizedLines) {
    if (cueTimingPattern.test(line.trim())) {
      cueCount += 1;
    }
  }

  if (cueCount === 0) {
    return {
      valid: false,
      cueCount: 0,
      normalizedVtt: '',
      errorAr: 'لم يتم العثور على مقاطع توقيت صالحة بصيغة WebVTT (00:00:00.000 --> 00:00:03.000)',
    };
  }

  return {
    valid: true,
    cueCount,
    normalizedVtt: normalizedLines.join('\n').trim() + '\n',
  };
}

export interface ExistingLessonProgressSnapshot {
  watchedSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  isCompleted: boolean;
  completedAt: Date | null;
  lastClientSequence: number;
}

export interface IncomingLessonProgressUpdate {
  watchedSeconds: number;
  durationSeconds: number;
  isCompleted?: boolean;
  clientSequence?: number;
  resetPosition?: boolean;
}

/**
 * Monotonic lesson progress resolver:
 * - Rejects out-of-order delayed network ticks (`clientSequence < existing.lastClientSequence`)
 *   unless `resetPosition: true` is explicitly requested.
 * - Allows learners to restart a completed lesson (`resetPosition: true`, `watchedSeconds: 0`)
 *   while preserving `isCompleted: true`.
 */
export function resolveMonotonicLessonProgress(
  existing: ExistingLessonProgressSnapshot | null,
  incoming: IncomingLessonProgressUpdate,
): ExistingLessonProgressSnapshot & { ignoredOutOfOrder: boolean } {
  const prevSeq = existing?.lastClientSequence ?? 0;
  const incomingSeq = incoming.clientSequence;

  if (
    existing &&
    !incoming.resetPosition &&
    typeof incomingSeq === 'number' &&
    incomingSeq > 0 &&
    incomingSeq < prevSeq
  ) {
    return {
      ...existing,
      ignoredOutOfOrder: true,
    };
  }

  const safeDuration = Math.max(
    1,
    incoming.durationSeconds || existing?.durationSeconds || 1,
  );
  const clampedWatched = incoming.resetPosition
    ? 0
    : Math.max(0, Math.min(safeDuration, Math.round(incoming.watchedSeconds || 0)));

  const rawPct = Math.min(100, Math.round((clampedWatched / safeDuration) * 100));
  const wasCompleted = Boolean(existing?.isCompleted);
  const nowCompleted = Boolean(incoming.isCompleted) || rawPct >= 90 || wasCompleted;

  return {
    watchedSeconds: clampedWatched,
    durationSeconds: safeDuration,
    progressPercent: wasCompleted
      ? Math.max(rawPct, existing?.progressPercent ?? 0)
      : incoming.isCompleted
        ? 100
        : rawPct,
    isCompleted: nowCompleted,
    completedAt: nowCompleted ? existing?.completedAt ?? new Date() : null,
    lastClientSequence:
      typeof incomingSeq === 'number' && incomingSeq > prevSeq ? incomingSeq : prevSeq,
    ignoredOutOfOrder: false,
  };
}

export interface WatermarkPolicyConfig {
  enabled: boolean;
  opacity: number;
  moveIntervalSeconds: number;
  showMaskedPhone: boolean;
  showUserCode: boolean;
}

export const DEFAULT_WATERMARK_POLICY: WatermarkPolicyConfig = {
  enabled: true,
  opacity: 0.22,
  moveIntervalSeconds: 10,
  showMaskedPhone: true,
  showUserCode: true,
};

/**
 * Formats a non-sensitive learner identifier for client-side moving video watermark overlay.
 * Never exposes full phone numbers, emails, session tokens, or internal secrets.
 */
export function buildLearnerWatermarkText(
  user: { id: string; fullName: string; phoneE164?: string | null },
  policy: WatermarkPolicyConfig = DEFAULT_WATERMARK_POLICY,
): string {
  if (!policy.enabled) return '';
  const parts: string[] = [];
  const safeName = (user.fullName || 'متدرب بوصلة').trim().slice(0, 36);
  parts.push(safeName);

  if (policy.showMaskedPhone && user.phoneE164) {
    const digits = user.phoneE164.replace(/\D/g, '');
    if (digits.length >= 4) {
      parts.push(`•••${digits.slice(-4)}`);
    }
  }

  if (policy.showUserCode && user.id) {
    parts.push(`ID:${user.id.slice(-4).toUpperCase()}`);
  }

  return parts.join(' • ');
}

/**
 * Clamps reported active watch-time heartbeat delta against wall-clock elapsed time since the
 * previous heartbeat on the same playback session so seeks, duplicate tabs, or replayed pings
 * cannot inflate meaningful watch time.
 */
export function clampActiveWatchDelta(params: {
  reportedDeltaSeconds: number;
  isPaused: boolean;
  elapsedSinceLastHeartbeatMs: number | null;
  playbackRate?: number;
}): number {
  if (params.isPaused || params.reportedDeltaSeconds <= 0) {
    return 0;
  }
  const reported = Math.min(30, Math.max(0, Math.round(params.reportedDeltaSeconds)));
  if (params.elapsedSinceLastHeartbeatMs === null) {
    return Math.min(reported, 15);
  }
  const rateAllowance = Math.min(2, Math.max(1, params.playbackRate ?? 1.5));
  // Add +1s jitter tolerance for network scheduling variance
  const maxPlausible = Math.max(
    0,
    Math.ceil((params.elapsedSinceLastHeartbeatMs / 1000) * rateAllowance) + 1,
  );
  return Math.min(reported, maxPlausible, 30);
}

/**
 * Determines whether correct answers and explanations should be disclosed to the learner.
 */
export function shouldDiscloseQuizAnswers(params: {
  policy: QuizDisclosurePolicyType;
  passed: boolean;
  attemptCountAfterSubmit: number;
  maxAttempts?: number | null;
}): boolean {
  switch (params.policy) {
    case 'IMMEDIATE':
      return true;
    case 'NEVER':
      return false;
    case 'AFTER_PASS':
      return params.passed;
    case 'AFTER_MAX_ATTEMPTS':
      return Boolean(params.maxAttempts && params.attemptCountAfterSubmit >= params.maxAttempts);
    case 'AFTER_PASS_OR_MAX_ATTEMPTS':
    default:
      if (params.passed) return true;
      if (params.maxAttempts && params.attemptCountAfterSubmit >= params.maxAttempts) {
        return true;
      }
      return false;
  }
}

export interface CouponEvaluationSnapshot {
  isActive: boolean;
  discountType: 'PERCENT' | 'FIXED';
  /** If PERCENT -> integer/float 1..100; if FIXED -> piasters (cents). */
  discountValuePiastersOrPercent: number;
  maxDiscountPiasters?: number | null;
  minOrderPiasters?: number | null;
  applicableTargetType: CouponTargetTypeValue;
  applicableCourseId?: string | null;
  applicableLearningPathId?: string | null;
  applicableDiplomaId?: string | null;
  applicablePlanId?: string | null;
  usageLimit?: number | null;
  usageCount: number;
  perUserLimit?: number | null;
  userRedemptionCount: number;
  validFrom: Date;
  validTo?: Date | null;
}

export function evaluateCouponEligibilityAndDiscount(params: {
  coupon: CouponEvaluationSnapshot;
  targetType: Exclude<CouponTargetTypeValue, 'ALL'>;
  targetIds: string[];
  subtotalPiasters: number;
  eligibleSubtotalPiasters: number;
  now?: Date;
}): {
  eligible: boolean;
  reasonAr?: string;
  discountPiasters: number;
  finalTotalPiasters: number;
} {
  const now = params.now ?? new Date();
  const c = params.coupon;

  if (!c.isActive) {
    return {
      eligible: false,
      reasonAr: 'كوبون الخصم غير صالح أو معطّل',
      discountPiasters: 0,
      finalTotalPiasters: params.subtotalPiasters,
    };
  }
  if (c.validFrom.getTime() > now.getTime()) {
    return {
      eligible: false,
      reasonAr: 'كوبون الخصم لم يبدأ سريانه بعد',
      discountPiasters: 0,
      finalTotalPiasters: params.subtotalPiasters,
    };
  }
  if (c.validTo && c.validTo.getTime() < now.getTime()) {
    return {
      eligible: false,
      reasonAr: 'انتهت صلاحية كوبون الخصم',
      discountPiasters: 0,
      finalTotalPiasters: params.subtotalPiasters,
    };
  }
  if (c.usageLimit !== null && c.usageLimit !== undefined && c.usageCount >= c.usageLimit) {
    return {
      eligible: false,
      reasonAr: 'تم استنفاد الحد الأقصى لاستخدام هذا الكوبون',
      discountPiasters: 0,
      finalTotalPiasters: params.subtotalPiasters,
    };
  }
  if (
    c.perUserLimit !== null &&
    c.perUserLimit !== undefined &&
    c.userRedemptionCount >= c.perUserLimit
  ) {
    return {
      eligible: false,
      reasonAr: 'لقد استخدمت هذا الكوبون بالحد الأقصى المسموح لحسابك',
      discountPiasters: 0,
      finalTotalPiasters: params.subtotalPiasters,
    };
  }

  // Legacy compatibility: if applicableTargetType is ALL but applicableCourseId is set, treat as COURSE
  const effectiveTargetType: CouponTargetTypeValue =
    c.applicableTargetType === 'ALL' && c.applicableCourseId
      ? 'COURSE'
      : c.applicableTargetType;

  if (effectiveTargetType !== 'ALL' && effectiveTargetType !== params.targetType) {
    return {
      eligible: false,
      reasonAr: 'هذا الكوبون مخصص لنوع آخر من الباقات أو البرامج التدريبية',
      discountPiasters: 0,
      finalTotalPiasters: params.subtotalPiasters,
    };
  }

  const requiredSpecificId =
    effectiveTargetType === 'COURSE'
      ? c.applicableCourseId
      : effectiveTargetType === 'LEARNING_PATH'
        ? c.applicableLearningPathId
        : effectiveTargetType === 'DIPLOMA'
          ? c.applicableDiplomaId
          : effectiveTargetType === 'MEMBERSHIP_PLAN'
            ? c.applicablePlanId
            : null;

  if (requiredSpecificId && !params.targetIds.includes(requiredSpecificId)) {
    return {
      eligible: false,
      reasonAr: 'هذا الكوبون غير مخصص للعنصر المختار',
      discountPiasters: 0,
      finalTotalPiasters: params.subtotalPiasters,
    };
  }

  if (
    c.minOrderPiasters !== null &&
    c.minOrderPiasters !== undefined &&
    params.subtotalPiasters < c.minOrderPiasters
  ) {
    return {
      eligible: false,
      reasonAr: `الحد الأدنى لتطبيق هذا الكوبون هو ${(c.minOrderPiasters / 100).toFixed(2)} ج.م`,
      discountPiasters: 0,
      finalTotalPiasters: params.subtotalPiasters,
    };
  }

  if (params.eligibleSubtotalPiasters <= 0) {
    return {
      eligible: false,
      reasonAr: 'لا توجد عناصر مؤهلة للخصم في الطلب',
      discountPiasters: 0,
      finalTotalPiasters: params.subtotalPiasters,
    };
  }

  let discountPiasters = 0;
  if (c.discountType === 'PERCENT') {
    const pct = Math.min(100, Math.max(0, c.discountValuePiastersOrPercent));
    discountPiasters = Math.round((params.eligibleSubtotalPiasters * pct) / 100);
  } else {
    discountPiasters = Math.round(c.discountValuePiastersOrPercent);
  }

  if (c.maxDiscountPiasters !== null && c.maxDiscountPiasters !== undefined) {
    discountPiasters = Math.min(discountPiasters, c.maxDiscountPiasters);
  }
  discountPiasters = Math.max(0, Math.min(discountPiasters, params.eligibleSubtotalPiasters));

  return {
    eligible: true,
    discountPiasters,
    finalTotalPiasters: Math.max(0, params.subtotalPiasters - discountPiasters),
  };
}

// ============================================================================
// SECTION 8: PAYMOB AES-256-GCM SECRET ENCRYPTION & MASKING
// ============================================================================

const SECRET_MASK_PREFIX = '••••••••';

function getNodeCrypto(): any {
  const proc = (globalThis as any).process;
  if (proc && typeof proc.getBuiltinModule === 'function') {
    return proc.getBuiltinModule('node:crypto');
  }
  throw new Error('Node crypto module unavailable in this runtime');
}

export function encryptSecretAesGcm(plainText: string, masterKeyInput: string): string {
  const clean = (plainText || '').trim();
  if (!clean) return '';
  const nodeCrypto = getNodeCrypto();
  const key = nodeCrypto.createHash('sha256').update(masterKeyInput || 'bosla-default-key').digest();
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecretAesGcm(cipherText: string, masterKeyInput: string): string {
  const raw = (cipherText || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('enc:v1:')) {
    return raw;
  }
  const parts = raw.split(':');
  if (parts.length !== 5) {
    throw new Error('صيغة القيمة المشفرة غير صالحة');
  }
  const nodeCrypto = getNodeCrypto();
  const key = nodeCrypto.createHash('sha256').update(masterKeyInput || 'bosla-default-key').digest();
  const iv = Buffer.from(parts[2], 'base64');
  const authTag = Buffer.from(parts[3], 'base64');
  const encrypted = Buffer.from(parts[4], 'base64');
  const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function maskSecretValue(plainOrStored?: string | null): string {
  const val = (plainOrStored || '').trim();
  if (!val) return '';
  const tail = val.length >= 4 ? val.slice(-4) : '';
  return `${SECRET_MASK_PREFIX}${tail}`;
}

export function isMaskedSecretPlaceholder(input?: string | null): boolean {
  const val = (input || '').trim();
  if (!val) return false;
  return val.startsWith(SECRET_MASK_PREFIX) || /^\*{4,}/.test(val) || /^•{4,}/.test(val);
}

// ============================================================================
// SECTION 6: LIVE EDITOR XSS & URL SANITIZATION
// ============================================================================

export function sanitizeLiveEditorString(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\bon\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeLiveEditorHref(href: string): string {
  const trimmed = (href || '').trim();
  if (!trimmed) return '/';
  const lower = trimmed.toLowerCase().replace(/\s+/g, '');
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return '/';
  }
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return sanitizeLiveEditorString(trimmed);
  }
  return `/${sanitizeLiveEditorString(trimmed).replace(/^\/+/, '')}`;
}

export function sanitizeLiveEditorConfig<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    return sanitizeLiveEditorString(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeLiveEditorConfig(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (typeof v === 'string') {
        const lowerKey = k.toLowerCase();
        if (lowerKey.endsWith('href') || lowerKey.endsWith('url') || lowerKey === 'link') {
          out[k] = v.trim() ? sanitizeLiveEditorHref(v) : '';
        } else {
          out[k] = sanitizeLiveEditorString(v);
        }
      } else {
        out[k] = sanitizeLiveEditorConfig(v);
      }
    }
    return out as T;
  }
  return input;
}

// ============================================================================
// SECTION 2: 4-STEP COURSE WIZARD COMPLETENESS CHECK
// ============================================================================

export interface CourseWizardValidationIssue {
  step: 1 | 2 | 3 | 4;
  fieldId: string;
  labelAr: string;
  severity: 'BLOCKING' | 'WARNING';
}

export function evaluateCourseWizardCompleteness(params: {
  titleAr: string;
  descriptionAr: string;
  thumbnailUrl?: string | null;
  introVideoId?: string | null;
  isFree: boolean;
  priceEgp: number;
  allowIndividualPurchase: boolean;
  includedInMembership: boolean;
  sections: Array<{
    titleAr: string;
    lessons: Array<{
      titleAr: string;
      type: 'VIDEO' | 'ARTICLE' | 'QUIZ' | 'PDF';
      videoAssetId?: string | null;
      articleContentAr?: string | null;
      quizId?: string | null;
      isFreePreview?: boolean;
      attachments?: Array<unknown>;
    }>;
  }>;
  videosById?: Record<string, { id: string; status: string }>;
}): {
  readyToPublish: boolean;
  issues: CourseWizardValidationIssue[];
  stats: {
    totalSections: number;
    totalLessons: number;
    freePreviewLessons: number;
    lockedLessons: number;
    readyVideosCount: number;
    processingVideosCount: number;
    failedVideosCount: number;
  };
} {
  const issues: CourseWizardValidationIssue[] = [];
  const cleanTitle = (params.titleAr || '').trim();
  const cleanDesc = (params.descriptionAr || '').trim();

  if (cleanTitle.length < 3) {
    issues.push({
      step: 1,
      fieldId: 'cw-title',
      labelAr: 'عنوان الكورس قصير جداً (يجب ألا يقل عن 3 أحرف)',
      severity: 'BLOCKING',
    });
  }
  if (cleanDesc.length < 10) {
    issues.push({
      step: 1,
      fieldId: 'cw-desc',
      labelAr: 'وصف الكورس مطلوب (10 أحرف على الأقل لتوضيح مخرجات التعلم)',
      severity: 'BLOCKING',
    });
  }

  const hasCover = Boolean((params.thumbnailUrl || '').trim());
  if (!hasCover) {
    issues.push({
      step: 2,
      fieldId: 'cw-cover',
      labelAr: 'اختر أو ارفع صورة غلاف رئيسية لبطاقة الكورس',
      severity: 'BLOCKING',
    });
  }

  const sections = Array.isArray(params.sections) ? params.sections : [];
  let totalLessons = 0;
  let freePreviewLessons = 0;
  let lockedLessons = 0;
  let readyVideosCount = 0;
  let processingVideosCount = 0;
  let failedVideosCount = 0;
  const videosById = params.videosById || {};

  for (const sec of sections) {
    for (const les of sec.lessons || []) {
      totalLessons += 1;
      if (les.isFreePreview) {
        freePreviewLessons += 1;
      } else {
        lockedLessons += 1;
      }

      if (!les.titleAr || les.titleAr.trim().length < 2) {
        issues.push({
          step: 3,
          fieldId: 'cw-lessons',
          labelAr: 'يوجد درس بدون عنوان واضح في المحتوى',
          severity: 'BLOCKING',
        });
      }

      if (les.type === 'VIDEO') {
        if (!les.videoAssetId) {
          issues.push({
            step: 3,
            fieldId: 'cw-lessons',
            labelAr: `الدرس "${les.titleAr || 'بدون اسم'}" من نوع فيديو لكن لم يُربط بملف فيديو`,
            severity: 'BLOCKING',
          });
        } else {
          const asset = videosById[les.videoAssetId];
          if (asset) {
            if (asset.status === 'READY') {
              readyVideosCount += 1;
            } else if (asset.status === 'FAILED') {
              failedVideosCount += 1;
              issues.push({
                step: 3,
                fieldId: 'cw-lessons',
                labelAr: `فشل تجهيز الفيديو المرتبط بالدرس "${les.titleAr}" — يرجى إعادة التجهيز أو استبداله`,
                severity: 'BLOCKING',
              });
            } else {
              processingVideosCount += 1;
              issues.push({
                step: 3,
                fieldId: 'cw-lessons',
                labelAr: `الفيديو المرتبط بالدرس "${les.titleAr}" ما زال قيد التجهيز للبث التكيفي`,
                severity: 'BLOCKING',
              });
            }
          }
        }
      } else if (les.type === 'QUIZ' && !les.quizId) {
        issues.push({
          step: 3,
          fieldId: 'cw-lessons',
          labelAr: `الدرس "${les.titleAr || 'بدون اسم'}" من نوع اختبار لكن لم يُحدد له اختبار`,
          severity: 'BLOCKING',
        });
      }
    }
  }

  if (totalLessons === 0) {
    issues.push({
      step: 3,
      fieldId: 'cw-lessons',
      labelAr: 'أضف درساً واحداً على الأقل داخل محتوى الكورس قبل النشر',
      severity: 'BLOCKING',
    });
  }

  if (!params.isFree) {
    if (!params.allowIndividualPurchase && !params.includedInMembership) {
      issues.push({
        step: 4,
        fieldId: 'cw-price',
        labelAr: 'الكورس المدفوع يجب أن يكون متاحاً ضمن العضوية أو متاحاً للشراء الفردي',
        severity: 'BLOCKING',
      });
    }
    if (params.allowIndividualPurchase && (!Number.isFinite(params.priceEgp) || params.priceEgp <= 0)) {
      issues.push({
        step: 4,
        fieldId: 'cw-price',
        labelAr: 'أدخل سعر شراء فردي أكبر من صفر (ج.م) أو حوّل الكورس إلى مجاني',
        severity: 'BLOCKING',
      });
    }
  }

  const blockingIssues = issues.filter((i) => i.severity === 'BLOCKING');
  return {
    readyToPublish: blockingIssues.length === 0,
    issues,
    stats: {
      totalSections: sections.length,
      totalLessons,
      freePreviewLessons,
      lockedLessons,
      readyVideosCount,
      processingVideosCount,
      failedVideosCount,
    },
  };
}
