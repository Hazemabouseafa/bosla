import { z } from 'zod';
import {
  DIFFICULTY_LEVELS,
  EDITORIAL_STATUSES,
  EVENT_REGISTRATION_STATUSES,
  LESSON_TYPES,
  MEMBERSHIP_INTERVALS,
  OFFLINE_EVENT_STATUSES,
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
      message: 'أدخل رقم موبايل صحيحاً',
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
  priceCents: z.coerce.number().int().min(0).optional(),
  compareAtPriceCents: z.coerce.number().int().min(0).optional().nullable(),
  includedInMembership: z.boolean().optional(),
  allowIndividualPurchase: z.boolean().optional(),
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
  priceCents: z.coerce.number().int().min(0).optional(),
  compareAtPriceCents: z.coerce.number().int().min(0).optional().nullable(),
  includedInMembership: z.boolean().optional(),
  allowIndividualPurchase: z.boolean().optional(),
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
  priceCents: z.coerce.number().int().min(0).optional(),
  compareAtPriceCents: z.coerce.number().int().min(0).optional().nullable(),
  includedInMembership: z.boolean().optional(),
  allowIndividualPurchase: z.boolean().optional(),
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

export const adminCreateCourseSchema = createCourseSchema.extend({
  instructorId: z.string().trim().min(1).optional().nullable(),
  publishImmediately: z.boolean().default(false),
  featuredOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const adminUpdateCourseSchema = adminCreateCourseSchema.partial().extend({
  isPublished: z.boolean().optional(),
});

export const adminCreateUserSchema = z.object({
  fullName: z.string().trim().min(2, 'الاسم الكامل مطلوب').max(120),
  phoneNumber: z.string().trim().min(8, 'رقم الموبايل مطلوب').max(25),
  countryCode: z.string().trim().default('+20'),
  email: z
    .union([z.string().trim().email('أدخل بريداً إلكترونياً صحيحاً'), z.literal('')])
    .optional()
    .nullable(),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل').max(128),
  role: z.enum(USER_ROLES).default('STUDENT'),
  extraRoles: z.array(z.enum(USER_ROLES)).optional(),
  status: z.enum(['ENROLLMENT_PENDING', 'ACTIVE', 'LOCKED', 'SUSPENDED']).default('ACTIVE'),
  headlineAr: z.string().trim().max(180).optional().nullable(),
  bioAr: z.string().trim().max(2000).optional().nullable(),
});

export const adminUpdateUserProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'الاسم الكامل مطلوب').max(120).optional(),
  email: z
    .union([z.string().trim().email('أدخل بريداً إلكترونياً صحيحاً'), z.literal('')])
    .optional()
    .nullable(),
  phoneNumber: z.string().trim().min(8).max(25).optional(),
  countryCode: z.string().trim().default('+20'),
  role: z.enum(USER_ROLES).optional(),
  extraRoles: z.array(z.enum(USER_ROLES)).optional(),
  status: z.enum(['ENROLLMENT_PENDING', 'ACTIVE', 'LOCKED', 'SUSPENDED']).optional(),
  headlineAr: z.string().trim().max(180).optional().nullable(),
  bioAr: z.string().trim().max(2000).optional().nullable(),
  newPassword: z
    .union([z.string().min(8, 'كلمة المرور الجديدة 8 أحرف على الأقل').max(128), z.literal('')])
    .optional(),
});

export const adminGrantSubscriptionSchema = z.object({
  userId: z.string().trim().min(1, 'المستخدم مطلوب'),
  planId: z.string().trim().min(1, 'خطة العضوية مطلوبة'),
  durationDays: z.coerce.number().int().min(1).max(1825).optional(),
});

export const adminUpdateSubscriptionStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'CANCELLED', 'EXPIRED']),
  extendDays: z.coerce.number().int().min(1).max(1825).optional(),
});

export const adminGrantEnrollmentSchema = z.object({
  userId: z.string().trim().min(1, 'المستخدم مطلوب'),
  courseId: z.string().trim().min(1, 'الكورس مطلوب'),
  source: z.string().trim().max(60).default('ADMIN_GRANTED'),
});

export const adminIssueCertificateSchema = z.object({
  userId: z.string().trim().min(1, 'المستخدم مطلوب'),
  targetType: z.enum(['COURSE', 'LEARNING_PATH', 'DIPLOMA']),
  courseId: z.string().trim().optional().nullable(),
  learningPathId: z.string().trim().optional().nullable(),
  diplomaId: z.string().trim().optional().nullable(),
  recipientNameAr: z.string().trim().min(2).max(150).optional(),
});

export const adminBulkCoursesActionSchema = z.object({
  courseIds: z.array(z.string().min(1)).min(1, 'اختر كورساً واحداً على الأقل').max(100),
  action: z.enum(['PUBLISH', 'UNPUBLISH', 'ARCHIVE']),
});

export const adminBroadcastNotificationSchema = z.object({
  audience: z.enum(['ALL_ACTIVE', 'STUDENTS', 'INSTRUCTORS', 'COURSE_ENROLLED']),
  courseId: z.string().trim().optional().nullable(),
  titleAr: z.string().trim().min(3, 'عنوان الإشعار مطلوب').max(120),
  bodyAr: z.string().trim().min(5, 'نص الإشعار مطلوب').max(500),
  actionUrl: z.string().trim().min(1).max(300).default('/courses'),
});

export const submitDiplomaProjectSchema = z.object({
  submissionText: z
    .string()
    .trim()
    .min(10, 'يرجى كتابة ملخص أو رابط المشروع التطبيقي (10 أحرف على الأقل)')
    .max(5000),
});

export const gradeDiplomaSubmissionSchema = z.object({
  scorePercent: z.coerce.number().int().min(0, 'الدرجة بين 0 و 100').max(100, 'الدرجة بين 0 و 100'),
  feedbackAr: z.string().trim().max(2000).optional().nullable(),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(120).optional(),
  email: z
    .union([z.string().trim().email('أدخل بريداً إلكترونياً صحيحاً'), z.literal('')])
    .optional()
    .nullable(),
  headlineAr: z.string().trim().max(180).optional().nullable(),
  bioAr: z.string().trim().max(2000).optional().nullable(),
});

export const editorialStatusSchema = z.enum(EDITORIAL_STATUSES);

export const offlineEventSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3, 'الرابط المختصر لا يقل عن 3 أحرف')
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'الرابط المختصر يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطة فقط'),
  titleAr: z.string().trim().min(3, 'عنوان الفعالية مطلوب').max(200),
  subtitleAr: z.string().trim().max(260).optional().nullable(),
  descriptionAr: z.string().trim().min(10, 'وصف الفعالية مطلوب (10 أحرف على الأقل)').max(5000),
  thumbnailUrl: z.string().trim().max(500).optional().nullable(),
  categoryLabelAr: z.string().trim().min(2).max(80).default('ورشة تطبيقية'),
  cityAr: z.string().trim().min(2, 'المدينة مطلوبة').max(100),
  venueNameAr: z.string().trim().min(2, 'اسم المكان أو القاعة مطلوب').max(200),
  venueAddressAr: z.string().trim().min(3, 'العنوان التفصيلي مطلوب').max(300),
  mapUrl: z.string().trim().max(500).optional().nullable(),
  startsAt: z.string().min(4, 'تاريخ ووقت البدء مطلوب'),
  endsAt: z.string().optional().nullable(),
  priceCents: z.coerce.number().int().min(0, 'السعر يجب أن يكون 0 أو أكثر').max(50_000_000),
  compareAtPriceCents: z.coerce.number().int().min(0).max(50_000_000).optional().nullable(),
  capacity: z.coerce.number().int().min(1, 'السعة الاستيعابية لا تقل عن 1').max(10000).default(30),
  status: z.enum(OFFLINE_EVENT_STATUSES).default('DRAFT'),
  highlights: z.array(z.string().trim().min(2)).default([]),
  speakerNameAr: z.string().trim().max(150).optional().nullable(),
  instructorId: z.string().trim().optional().nullable(),
  featuredOrder: z.coerce.number().int().min(0).max(9999).optional().nullable(),
});

export const offlineEventCheckoutSchema = z.object({
  seatsCount: z.coerce.number().int().min(1).max(5).default(1),
  attendeeNameAr: z.string().trim().min(2, 'اسم الحاضر مطلوب').max(120).optional(),
  attendeePhone: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const adminEventRegistrationStatusSchema = z.object({
  status: z.enum(EVENT_REGISTRATION_STATUSES),
});

export const directItemCheckoutSchema = z.object({
  targetType: z.enum(['COURSE', 'LEARNING_PATH', 'DIPLOMA']),
  targetId: z.string().trim().min(1, 'معرف الكورس أو البرنامج مطلوب'),
});

export const programInstructorAssignmentsSchema = z.object({
  assignments: z
    .array(
      z.object({
        instructorId: z.string().trim().min(1, 'معرف المدرب مطلوب'),
        roleTitleAr: z.string().trim().min(2).max(120).default('مدرب مشارك'),
        revenueSharePercent: z.coerce
          .number()
          .min(0, 'النسبة لا تقل عن 0%')
          .max(100, 'النسبة لا تزيد عن 100%'),
        isPrimary: z.boolean().default(false),
      }),
    )
    .default([]),
});

export const instructorPayoutSchema = z.object({
  amountCents: z.coerce.number().int().positive('مبلغ الدفعة يجب أن يكون أكبر من صفر'),
  paymentMethodAr: z.string().trim().min(2).max(120).default('تحويل بنكي'),
  notesAr: z.string().trim().max(1000).optional().nullable(),
});

export const competencyRequestCreateSchema = z.object({
  targetType: z.enum(['COURSE', 'LEARNING_PATH', 'DIPLOMA']).default('COURSE'),
  courseId: z.string().trim().optional().nullable(),
  learningPathId: z.string().trim().optional().nullable(),
  diplomaId: z.string().trim().optional().nullable(),
  studentNotesAr: z.string().trim().max(2000).optional().nullable(),
  evidenceUrl: z.string().trim().max(500).optional().nullable(),
});

export const competencyRequestReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reviewNotesAr: z.string().trim().max(2000).optional().nullable(),
});

export const courseInstructorReviewSchema = z.object({
  courseId: z.string().trim().min(1, 'معرف الكورس مطلوب'),
  instructorId: z.string().trim().optional().nullable(),
  learningPathId: z.string().trim().optional().nullable(),
  diplomaId: z.string().trim().optional().nullable(),
  rating: z.coerce.number().int().min(1, 'التقييم من 1 إلى 5').max(5, 'التقييم من 1 إلى 5'),
  instructorRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  commentAr: z.string().trim().max(2000).optional().nullable(),
});

export const subscriberQuestionCreateSchema = z.object({
  topicAr: z.string().trim().min(2).max(80).default('عام'),
  titleAr: z.string().trim().min(5, 'عنوان السؤال لا يقل عن 5 أحرف').max(220),
  bodyAr: z.string().trim().min(10, 'تفاصيل السؤال لا تقل عن 10 أحرف').max(5000),
  courseId: z.string().trim().optional().nullable(),
});

export const subscriberAnswerCreateSchema = z.object({
  bodyAr: z.string().trim().min(5, 'الإجابة لا تقل عن 5 أحرف').max(5000),
});
