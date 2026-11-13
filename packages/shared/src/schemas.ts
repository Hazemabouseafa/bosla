import { z } from 'zod';
import {
  DIFFICULTY_LEVELS,
  EDITORIAL_STATUSES,
  LESSON_TYPES,
  MEMBERSHIP_INTERVALS,
  USER_ROLES,
} from './enums';
import { normalizePhoneToE164 } from './phone';

export const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب أن لا تقل عن 8 أحرف')
  .max(128, 'كلمة المرور طويلة جدًا')
  .regex(/[A-Za-z\u0600-\u06FF]/, 'يجب أن تحتوي كلمة المرور على حرف واحد على الأقل')
  .regex(/\d/, 'يجب أن تحتوي كلمة المرور على رقم واحد على الأقل');

export const phoneRegisterSchema = z
  .object({
    fullName: z.string().trim().min(2, 'الاسم الكامل مطلوب').max(120),
    countryCode: z.string().trim().default('+20'),
    phoneNumber: z.string().trim().min(8, 'رقم الموبايل مطلوب').max(25),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'يجب الموافقة على الشروط والأحكام وسياسة الخصوصية' }),
    }),
    acceptPrivacy: z.literal(true, {
      errorMap: () => ({ message: 'يجب الموافقة على سياسة الخصوصية' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => normalizePhoneToE164(data.phoneNumber, data.countryCode) !== null,
    {
      message: 'رقم الموبايل غير صالح بالصيغة الدولية',
      path: ['phoneNumber'],
    },
  );

export const phoneLoginSchema = z.object({
  countryCode: z.string().trim().default('+20'),
  phoneNumber: z.string().trim().min(6, 'أدخل رقم الموبايل'),
  password: z.string().min(1, 'أدخل كلمة المرور'),
});

export const googleAuthSchema = z.object({
  credential: z.string().min(10, 'رمز مصادقة جوجل غير صالح'),
});

export const recoveryIdentifySchema = z.object({
  countryCode: z.string().trim().default('+20'),
  phoneNumber: z.string().trim().min(6, 'أدخل رقم الموبايل المسجل'),
});

export const recoveryWithCodeSchema = z.object({
  countryCode: z.string().trim().default('+20'),
  phoneNumber: z.string().trim().min(6, 'أدخل رقم الموبايل المسجل'),
  recoveryCode: z
    .string()
    .trim()
    .min(8, 'كود الاسترداد غير صالح')
    .max(64),
});

export const resetPasswordConfirmSchema = z
  .object({
    resetToken: z.string().min(20, 'رمز إعادة التعيين غير صالح'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

export const supportRecoverySchema = z.object({
  countryCode: z.string().trim().default('+20'),
  phoneNumber: z.string().trim().min(6, 'رقم الموبايل مطلوب'),
  fullName: z.string().trim().min(2, 'الاسم الكامل مطلوب').max(120),
  notes: z.string().trim().min(10, 'يرجى توضيح تفاصيل المساعدة المطلوبة').max(1000),
});

export const createCourseSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'الرابط المختصر يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطة فقط'),
  categoryId: z.string().optional().nullable(),
  isFree: z.boolean().default(false),
  difficulty: z.enum(DIFFICULTY_LEVELS).default('BEGINNER'),
  titleAr: z.string().trim().min(3, 'عنوان الكورس مطلوب').max(200),
  subtitleAr: z.string().trim().max(260).optional().nullable(),
  descriptionAr: z.string().trim().min(10, 'وصف الكورس مطلوب').max(5000),
  thumbnailUrl: z.string().trim().max(500).optional().nullable(),
  learningObjectives: z.array(z.string().trim().min(2)).default([]),
  requirements: z.array(z.string().trim().min(2)).default([]),
});

export const updateCourseVersionSchema = createCourseSchema.partial().extend({
  introVideoId: z.string().optional().nullable(),
  sections: z
    .array(
      z.object({
        id: z.string().optional(),
        titleAr: z.string().trim().min(2),
        descriptionAr: z.string().trim().optional().nullable(),
        sortOrder: z.number().int().min(0),
        lessons: z
          .array(
            z.object({
              id: z.string().optional(),
              stableKey: z.string().trim().min(2).optional(),
              titleAr: z.string().trim().min(2),
              descriptionAr: z.string().trim().optional().nullable(),
              type: z.enum(LESSON_TYPES),
              isFreePreview: z.boolean().default(false),
              durationSeconds: z.number().int().min(0).default(0),
              sortOrder: z.number().int().min(0),
              videoAssetId: z.string().optional().nullable(),
              articleContentAr: z.string().optional().nullable(),
              quizId: z.string().optional().nullable(),
            }),
          )
          .default([]),
      }),
    )
    .optional(),
});

export const editorialReviewDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT']),
  comment: z.string().trim().min(3, 'التعليق مطلوب عند المراجعة').max(2000),
});

export const schedulePublishSchema = z.object({
  scheduledPublishAt: z.string().datetime({ message: 'صيغة التاريخ غير صالحة' }),
});

export const learningPathSchema = z.object({
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/),
  titleAr: z.string().trim().min(3).max(200),
  subtitleAr: z.string().trim().max(260).optional().nullable(),
  descriptionAr: z.string().trim().min(10).max(5000),
  thumbnailUrl: z.string().trim().max(500).optional().nullable(),
  learningObjectives: z.array(z.string().trim().min(2)).default([]),
  completionCriteria: z
    .object({
      requireAllCourses: z.boolean().default(true),
      minQuizAveragePercent: z.number().int().min(0).max(100).default(70),
    })
    .default({ requireAllCourses: true, minQuizAveragePercent: 70 }),
  courseLinks: z
    .array(
      z.object({
        courseId: z.string().min(1),
        sortOrder: z.number().int().min(0),
        isRequired: z.boolean().default(true),
      }),
    )
    .default([]),
});

export const diplomaSchema = z.object({
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/),
  titleAr: z.string().trim().min(3).max(200),
  subtitleAr: z.string().trim().max(260).optional().nullable(),
  descriptionAr: z.string().trim().min(10).max(5000),
  thumbnailUrl: z.string().trim().max(500).optional().nullable(),
  totalHours: z.number().int().min(0).default(0),
  hourBreakdown: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        hours: z.number().int().min(0),
        color: z.string().trim().min(3),
      }),
    )
    .optional(),
  completionRequirements: z
    .object({
      requireAllCourses: z.boolean().default(true),
      minAssessmentScorePercent: z.number().int().min(0).max(100).default(70),
      requireFinalProject: z.boolean().default(false),
    })
    .default({
      requireAllCourses: true,
      minAssessmentScorePercent: 70,
      requireFinalProject: false,
    }),
  hasOptionalFinalProject: z.boolean().default(true),
  certificateEnabled: z.boolean().default(true),
  courseLinks: z
    .array(
      z.object({
        courseId: z.string().min(1),
        sortOrder: z.number().int().min(0),
        isRequired: z.boolean().default(true),
      }),
    )
    .default([]),
});

export const membershipPlanSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  interval: z.enum(MEMBERSHIP_INTERVALS),
  nameAr: z.string().trim().min(2).max(150),
  descriptionAr: z.string().trim().min(5).max(1000),
  priceCents: z.number().int().min(0),
  compareAtPriceCents: z.number().int().min(0).optional().nullable(),
  discountLabelAr: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
  isVisible: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  entitlementMode: z
    .enum(['SNAPSHOT_ON_SUBSCRIBE', 'FOLLOW_LATEST_PLAN'])
    .default('FOLLOW_LATEST_PLAN'),
  courseIds: z.array(z.string()).default([]),
  learningPathIds: z.array(z.string()).default([]),
  diplomaIds: z.array(z.string()).default([]),
  notesAr: z.string().trim().max(500).optional().nullable(),
});

export const updateLessonProgressSchema = z.object({
  watchedSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().min(0),
  isCompleted: z.boolean().optional(),
});

export const createQuizSchema = z.object({
  titleAr: z.string().trim().min(2).max(200),
  descriptionAr: z.string().trim().max(1000).optional().nullable(),
  passingScorePercent: z.number().int().min(1).max(100).default(70),
  maxAttempts: z.number().int().min(1).optional().nullable(),
  timeLimitMinutes: z.number().int().min(1).optional().nullable(),
  questions: z
    .array(
      z.object({
        questionTextAr: z.string().trim().min(3),
        options: z
          .array(
            z.object({
              id: z.string().trim().min(1),
              textAr: z.string().trim().min(1),
            }),
          )
          .min(2),
        correctOptionId: z.string().trim().min(1),
        explanationAr: z.string().trim().optional().nullable(),
        points: z.number().int().min(1).default(1),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const submitQuizAttemptSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

export const initiateUploadSchema = z.object({
  courseId: z.string().optional().nullable(),
  titleAr: z.string().trim().min(2).max(200),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  totalBytes: z.number().int().positive(),
  chunkSizeBytes: z.number().int().min(65536).max(20 * 1024 * 1024).optional(),
});

export const leadSubmissionSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'CORPORATE_B2B', 'SPONSOR', 'WAITLIST']),
  fullName: z.string().trim().min(2).max(150),
  companyName: z.string().trim().max(150).optional().nullable(),
  phoneNumber: z.string().trim().min(8).max(25),
  countryCode: z.string().trim().default('+20'),
  roleLabel: z.string().trim().max(120).optional().nullable(),
  interest: z.string().trim().max(250).optional().nullable(),
  sector: z.string().trim().max(120).optional().nullable(),
  teamSize: z.string().trim().max(80).optional().nullable(),
  need: z.string().trim().max(150).optional().nullable(),
  timeline: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const adminUpdateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
  status: z.enum(['ENROLLMENT_PENDING', 'ACTIVE', 'LOCKED', 'SUSPENDED']).optional(),
});

export const editorialStatusSchema = z.enum(EDITORIAL_STATUSES);
