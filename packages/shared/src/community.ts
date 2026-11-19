import { z } from 'zod';
import {
  COMMUNITY_POST_TYPES,
  COMMUNITY_REPORT_STATUSES,
  COMMUNITY_TARGET_TYPES,
} from './enums';

export const COMMUNITY_POST_FILTERS = [
  'all',
  'questions',
  'lesson_questions',
  'unanswered',
  'answered',
  'announcements',
] as const;
export type CommunityPostFilter = (typeof COMMUNITY_POST_FILTERS)[number];

export const COMMUNITY_POST_SORTS = ['latest', 'relevant'] as const;
export type CommunityPostSort = (typeof COMMUNITY_POST_SORTS)[number];

export const COMMUNITY_MODERATION_ACTIONS = [
  'PIN',
  'UNPIN',
  'LOCK',
  'UNLOCK',
  'HIDE',
  'REMOVE',
  'RESTORE',
  'MARK_ANSWERED',
  'MARK_UNANSWERED',
] as const;
export type CommunityModerationAction = (typeof COMMUNITY_MODERATION_ACTIONS)[number];

/**
 * Strips potentially unsafe HTML tags & control characters while preserving Arabic & UTF-8 text.
 */
export function sanitizeCommunityText(value: string): string {
  let cleaned = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    ) {
      continue;
    }
    cleaned += value[i];
  }
  return cleaned.replace(/<[^>]*>/g, '').trim();
}

export function formatVideoTimestamp(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const createCommunityPostSchema = z
  .object({
    lessonId: z.string().trim().min(1).max(80).optional().nullable(),
    type: z.enum(COMMUNITY_POST_TYPES).default('QUESTION'),
    title: z
      .string()
      .transform(sanitizeCommunityText)
      .pipe(
        z
          .string()
          .min(4, 'عنوان السؤال أو المشاركة يجب أن لا يقل عن 4 أحرف')
          .max(200, 'العنوان طويل جدًا (الحد الأقصى 200 حرف)'),
      ),
    body: z
      .string()
      .transform(sanitizeCommunityText)
      .pipe(
        z
          .string()
          .min(8, 'تفاصيل السؤال أو المناقشة يجب أن لا تقل عن 8 أحرف')
          .max(5000, 'النص طويل جدًا (الحد الأقصى 5000 حرف)'),
      ),
    videoTimestampSeconds: z
      .number({ invalid_type_error: 'الوقت المحدد من الفيديو غير صالح' })
      .int('الوقت المحدد يجب أن يكون رقمًا صحيحًا بالثواني')
      .min(0, 'الوقت المحدد من الفيديو لا يمكن أن يكون بالسالب')
      .max(86400, 'الوقت المحدد يتجاوز الحد المسموح')
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      data.videoTimestampSeconds !== null &&
      data.videoTimestampSeconds !== undefined &&
      !data.lessonId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['videoTimestampSeconds'],
        message: 'لا يمكن ربط وقت من الفيديو دون تحديد الدرس المرتبط',
      });
    }
    if (
      data.videoTimestampSeconds !== null &&
      data.videoTimestampSeconds !== undefined &&
      data.type !== 'QUESTION'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'الأسئلة فقط يمكن ربطها بوقت محدد داخل فيديو الدرس',
      });
    }
  });

export const createCommunityCommentSchema = z.object({
  parentCommentId: z.string().trim().min(1).max(80).optional().nullable(),
  body: z
    .string()
    .transform(sanitizeCommunityText)
    .pipe(
      z
        .string()
        .min(2, 'نص الرد يجب أن لا يقل عن حرفين')
        .max(3000, 'نص الرد طويل جدًا (الحد الأقصى 3000 حرف)'),
    ),
});

export const acceptCommunityAnswerSchema = z.object({
  commentId: z.string().trim().min(1, 'معرف التعليق مطلوب').max(80),
});

export const moderateCommunityPostSchema = z.object({
  action: z.enum(COMMUNITY_MODERATION_ACTIONS),
  reason: z
    .string()
    .transform(sanitizeCommunityText)
    .pipe(z.string().max(500))
    .optional()
    .nullable(),
});

export const updateCommunitySettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  adminDisabled: z.boolean().optional(),
  allowStudentDiscussions: z.boolean().optional(),
});

export const createCommunityReportSchema = z.object({
  targetType: z.enum(COMMUNITY_TARGET_TYPES),
  targetId: z.string().trim().min(1).max(80),
  reason: z
    .string()
    .transform(sanitizeCommunityText)
    .pipe(
      z
        .string()
        .min(3, 'يرجى تحديد سبب البلاغ')
        .max(150, 'سبب البلاغ طويل جدًا'),
    ),
  details: z
    .string()
    .transform(sanitizeCommunityText)
    .pipe(z.string().max(1000))
    .optional()
    .nullable(),
});

export const resolveCommunityReportSchema = z.object({
  status: z.enum(COMMUNITY_REPORT_STATUSES).refine((v) => v !== 'PENDING', {
    message: 'حالة المعالجة مطلوبة',
  }),
  removeTarget: z.boolean().optional().default(false),
  resolutionNotes: z
    .string()
    .transform(sanitizeCommunityText)
    .pipe(z.string().max(500))
    .optional()
    .nullable(),
});

export const updateNotificationPreferencesSchema = z.object({
  notifyOnInstructorReply: z.boolean().optional(),
  notifyOnDiscussionReply: z.boolean().optional(),
  notifyOnAcceptedAnswer: z.boolean().optional(),
  notifyOnNewStudentQuestion: z.boolean().optional(),
});
