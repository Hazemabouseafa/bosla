import { z } from 'zod';
import {
  ALL_SYSTEM_ROLES,
  PERMISSION_CODES,
} from './rbac';

export const systemRoleCodeSchema = z.enum(ALL_SYSTEM_ROLES);
export const permissionCodeSchema = z.enum(PERMISSION_CODES);

export const userRolesAssignSchema = z.object({
  primaryRole: systemRoleCodeSchema,
  extraRoles: z.array(systemRoleCodeSchema).default([]),
});

export const rolePermissionsUpdateSchema = z.object({
  permissions: z.array(permissionCodeSchema),
});

// Seller onboarding & codes
export const sellerApplySchema = z.object({
  fullName: z.string().trim().min(2, 'الاسم الكامل مطلوب').max(120),
  phoneNumber: z.string().trim().min(6, 'رقم الهاتف مطلوب').max(30),
  countryCode: z.string().trim().default('+20'),
  email: z.string().trim().email('بريد إلكتروني غير صالح').optional().nullable(),
  nationalIdNumber: z.string().trim().min(6, 'رقم الهوية الوطنية مطلوب').max(40),
  idDocumentUrl: z.string().trim().min(4, 'مستند الهوية مطلوب').max(500),
  experienceSummaryAr: z.string().trim().min(10, 'يرجى كتابة نبذة عن خبرتك التسويقية (10 أحرف على الأقل)').max(3000),
  marketingChannelsAr: z.string().trim().max(1000).optional().nullable(),
  payoutMethodType: z.enum(['BANK_TRANSFER', 'INSTAPAY', 'VODAFONE_CASH', 'WALLET']),
  payoutAccountName: z.string().trim().min(2, 'اسم صاحب الحساب مطلوب').max(150),
  payoutAccountDetails: z.string().trim().min(4, 'بيانات استلام المستحقات مطلوبة').max(400),
});

export const sellerReviewApplicationSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'CHANGES_REQUESTED']),
  reviewNotesAr: z.string().trim().max(2000).optional().nullable(),
  initialCode: z.string().trim().max(30).optional(),
  verifyKycAndPayout: z.boolean().default(true),
});

export const sellerStatusChangeSchema = z.object({
  status: z.enum(['APPROVED', 'SUSPENDED']),
  reasonAr: z.string().trim().min(3, 'السبب مطلوب').max(1000),
  kycVerified: z.boolean().optional(),
  payoutVerified: z.boolean().optional(),
});

export const createSellerCodeSchema = z.object({
  code: z.string().trim().min(4, 'الكود لا يقل عن 4 خانات').max(30),
  allowedCourseIds: z.array(z.string().trim().min(1)).default([]),
});

// Commission Rules (Course Default OR Seller + Course override — NEVER global)
export const upsertCommissionRuleSchema = z.object({
  courseId: z.string().trim().min(1, 'معرف الكورس مطلوب'),
  sellerId: z.string().trim().optional().nullable(),
  fixedAmountEgp: z.coerce
    .number()
    .min(0, 'مبلغ العمولة الثابت يجب أن يكون 0 أو أكثر')
    .max(500_000),
  capPercent: z.coerce.number().min(1).max(100).default(50),
  effectiveFrom: z.string().min(4, 'تاريخ بداية السريان مطلوب'),
  effectiveTo: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

// Coupons & Cart / E-Commerce Orders
export const couponCreateSchema = z.object({
  code: z.string().trim().min(3).max(40),
  discountType: z.enum(['PERCENT', 'FIXED']),
  discountValue: z.coerce.number().positive('قيمة الخصم يجب أن تكون أكبر من صفر'),
  maxDiscountAmount: z.coerce.number().positive().optional().nullable(),
  minOrderAmount: z.coerce.number().min(0).optional().nullable(),
  applicableCourseId: z.string().trim().optional().nullable(),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  validFrom: z.string().optional(),
  validTo: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const cartAddItemSchema = z.object({
  courseId: z.string().trim().min(1, 'معرف الكورس مطلوب'),
});

export const orderPreviewOrCreateSchema = z.object({
  courseIds: z.array(z.string().trim().min(1)).min(1, 'اختر كورساً واحداً على الأقل').max(50),
  couponCode: z.string().trim().optional().nullable(),
  sellerCode: z.string().trim().optional().nullable(),
  clearSellerPrefill: z.boolean().optional(),
  paymentMethod: z
    .enum(['PAYMOB_CARD', 'PAYMOB_WALLET', 'BANK_TRANSFER', 'MANUAL_CASH', 'OFFLINE_TRAINING', 'INSTITUTIONAL'])
    .default('PAYMOB_CARD'),
  deviceFingerprint: z.string().trim().max(120).optional().nullable(),
  notesAr: z.string().trim().max(1000).optional().nullable(),
});

export const recordManualPaymentSchema = z.object({
  amountEgp: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  paymentMethod: z.enum(['BANK_TRANSFER', 'MANUAL_CASH', 'OFFLINE_TRAINING', 'INSTITUTIONAL']),
  receiptReference: z.string().trim().min(2, 'رقم المرجع أو الإيصال مطلوب').max(150),
  bankName: z.string().trim().max(120).optional().nullable(),
  proofUrl: z.string().trim().max(500).optional().nullable(),
  notesAr: z.string().trim().max(1000).optional().nullable(),
});

export const manualAllocationOverrideSchema = z.object({
  allocations: z
    .array(
      z.object({
        orderItemId: z.string().trim().min(1),
        allocatedAmountEgp: z.coerce.number().min(0),
      }),
    )
    .min(1),
  reasonAr: z.string().trim().min(5, 'سبب التعديل اليدوي مطلوب').max(1000),
});

export const orderAttributionOverrideSchema = z.object({
  sellerCode: z.string().trim().min(4).max(30),
  reasonAr: z.string().trim().min(5, 'سبب تغيير الإسناد مطلوب').max(1000),
});

export const refundRequestSchema = z.object({
  orderId: z.string().trim().min(1),
  orderItemId: z.string().trim().optional().nullable(),
  refundAmountEgp: z.coerce.number().positive('مبلغ الاسترداد يجب أن يكون أكبر من صفر'),
  refundType: z.enum(['FULL', 'PARTIAL', 'CHARGEBACK']).default('FULL'),
  revokeAccess: z.boolean().default(false),
  reasonAr: z.string().trim().min(3, 'سبب الاسترداد مطلوب').max(1000),
});

export const commissionReviewDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'DISPUTE', 'RESOLVE_TO_ELIGIBLE', 'REVERSE']),
  reasonAr: z.string().trim().min(3, 'السبب مطلوب').max(1000),
});

export const bulkApproveCommissionsSchema = z.object({
  commissionIds: z.array(z.string().trim().min(1)).min(1),
  reasonAr: z.string().trim().max(500).optional(),
});

export const createSettlementSchema = z.object({
  sellerId: z.string().trim().min(1),
  periodYear: z.coerce.number().int().min(2020).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  minPayoutEgp: z.coerce.number().min(0).default(500),
  notesAr: z.string().trim().max(1000).optional().nullable(),
});

export const markPayoutSchema = z.object({
  transferReference: z.string().trim().min(3, 'مرجع التحويل البنكي مطلوب').max(150),
  paymentProofUrl: z.string().trim().max(500).optional().nullable(),
  notesAr: z.string().trim().max(1000).optional().nullable(),
});

export const failPayoutSchema = z.object({
  failureReasonAr: z.string().trim().min(3, 'سبب فشل التحويل مطلوب').max(1000),
});

export const financialExpenseSchema = z.object({
  categoryAr: z.string().trim().min(2, 'بند المصروف مطلوب').max(120),
  courseId: z.string().trim().optional().nullable(),
  descriptionAr: z.string().trim().min(3).max(1000),
  amountEgp: z.coerce.number().positive(),
  incurredAt: z.string().min(4),
  receiptRef: z.string().trim().max(150).optional().nullable(),
});

// Instructor Profile & Contract Extensions
export const instructorContractSchema = z.object({
  instructorId: z.string().trim().min(1),
  titleAr: z.string().trim().min(3).max(200),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  defaultSharePercent: z.coerce.number().min(0).max(100).default(35),
  deductSellerCommission: z.boolean().default(false),
  documentUrl: z.string().trim().max(500).optional().nullable(),
});

export const instructorProfileUpdateSchema = z.object({
  specializations: z.array(z.string().trim().min(1)).default([]),
  yearsExperience: z.coerce.number().int().min(0).max(80).default(0),
  cvUrl: z.string().trim().max(500).optional().nullable(),
  approvalStatus: z.enum(['NEW', 'UNDER_REVIEW', 'APPROVED', 'SUSPENDED']).optional(),
  reviewNotesAr: z.string().trim().max(1000).optional().nullable(),
});

const emptyToNull = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? null : val;

const optionalEmailSchema = z.preprocess(
  emptyToNull,
  z.string().trim().email('بريد إلكتروني غير صالح').nullable().optional(),
);

const optionalNullableStr = (max = 500) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

// CRM & Marketing
export const crmLeadCreateSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'CORPORATE_B2B', 'SPONSOR', 'WAITLIST']).default('INDIVIDUAL'),
  fullName: z.string().trim().min(2, 'اسم العميل مطلوب').max(120),
  companyName: optionalNullableStr(150),
  phoneNumber: z.string().trim().min(6, 'رقم الهاتف مطلوب').max(30),
  email: optionalEmailSchema,
  roleLabel: optionalNullableStr(120),
  sector: optionalNullableStr(120),
  teamSize: optionalNullableStr(80),
  timeline: optionalNullableStr(120),
  interest: optionalNullableStr(300),
  interestedCourseId: optionalNullableStr(120),
  leadScore: z.coerce.number().int().min(0).max(100).optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  pipelineStageKey: z.string().trim().default('NEW'),
  assignedToId: optionalNullableStr(120),
  campaignId: optionalNullableStr(120),
  consentMarketing: z.boolean().default(false),
  notes: optionalNullableStr(2000),
});

export const crmLeadUpdateSchema = crmLeadCreateSchema.partial();

export const crmActivitySchema = z.object({
  activityType: z.enum(['CALL', 'NOTE', 'FOLLOW_UP', 'STAGE_CHANGE']),
  summaryAr: z.string().trim().min(2, 'ملخص النشاط مطلوب').max(2000),
  dueAt: optionalNullableStr(100),
  pipelineStageKey: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
});

export const marketingCampaignSchema = z.object({
  nameAr: z.string().trim().min(2, 'اسم الحملة مطلوب').max(200),
  channel: z.string().trim().min(2, 'قناة الحملة مطلوبة').max(100),
  budgetEgp: z.coerce.number().min(0).default(0),
  spendEgp: z.coerce.number().min(0).default(0),
  couponId: optionalNullableStr(120),
  startDate: z.string().min(4),
  endDate: optionalNullableStr(100),
  notesAr: optionalNullableStr(1000),
});

export const marketingCampaignUpdateSchema = marketingCampaignSchema.partial();

// B2B Organization
export const organizationCreateSchema = z.object({
  nameAr: z.string().trim().min(2).max(200),
  type: z.enum(['COMPANY', 'UNIVERSITY']).default('COMPANY'),
  taxNumber: z.string().trim().max(80).optional().nullable(),
  contactNameAr: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(6).max(30),
  contactEmail: z.string().trim().email().optional().nullable(),
  seatCapacity: z.coerce.number().int().min(1).max(50000).default(20),
});

export const organizationMemberAssignSchema = z.object({
  userId: z.string().trim().min(1),
  orgRole: z.enum(['ORG_ADMIN', 'LEARNER']).default('LEARNER'),
  departmentAr: z.string().trim().max(120).optional().nullable(),
});

export const organizationBulkEnrollSchema = z.object({
  courseId: z.string().trim().min(1),
  cohortId: z.string().trim().optional().nullable(),
  userIds: z.array(z.string().trim().min(1)).min(1).max(500),
});

export const organizationContractCreateSchema = z.object({
  organizationId: z.string().trim().min(1),
  titleAr: z.string().trim().min(3).max(200),
  quotationAmountEgp: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  validFrom: z.string().min(4),
  validTo: z.string().optional().nullable(),
  assignedCourseIds: z.array(z.string().trim().min(1)).default([]),
});

// Advanced LMS (Question Bank, Sessions, Attendance, Assignments)
export const questionBankItemSchema = z.object({
  categoryId: z.string().trim().optional().nullable(),
  courseId: z.string().trim().optional().nullable(),
  questionType: z.enum(['MCQ', 'TRUE_FALSE', 'WRITTEN']),
  promptAr: z.string().trim().min(3).max(2000),
  options: z.array(z.object({ id: z.string(), textAr: z.string() })).optional().nullable(),
  correctAnswer: z.string().trim().max(500).optional().nullable(),
  explanationAr: z.string().trim().max(1500).optional().nullable(),
  defaultPoints: z.coerce.number().int().min(1).max(100).default(1),
});

export const trainingSessionSchema = z.object({
  courseId: z.string().trim().min(1),
  cohortId: z.string().trim().optional().nullable(),
  titleAr: z.string().trim().min(3).max(200),
  sessionType: z.enum(['ONLINE_LIVE', 'OFFLINE_CLASS', 'HYBRID']).default('ONLINE_LIVE'),
  startsAt: z.string().min(4),
  endsAt: z.string().min(4),
  venueAr: z.string().trim().max(300).optional().nullable(),
  manualMeetingUrl: z.string().trim().max(500).optional().nullable(),
  recordingUrl: z.string().trim().max(500).optional().nullable(),
  instructorId: z.string().trim().optional().nullable(),
});

export const markAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        userId: z.string().trim().min(1),
        status: z.enum(['PRESENT', 'ABSENT', 'EXCUSED']),
        notesAr: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .min(1),
});

export const assignmentCreateSchema = z.object({
  courseId: z.string().trim().min(1),
  lessonId: z.string().trim().optional().nullable(),
  titleAr: z.string().trim().min(3).max(200),
  instructionsAr: z.string().trim().min(5).max(5000),
  maxScore: z.coerce.number().int().min(1).max(1000).default(100),
  passingScore: z.coerce.number().int().min(0).max(1000).default(60),
  dueAt: z.string().optional().nullable(),
  isPracticalProject: z.boolean().default(false),
  rubric: z.array(z.object({ criterionAr: z.string(), maxPoints: z.coerce.number().int().min(1) })).optional().nullable(),
});

export const assignmentSubmitSchema = z.object({
  submissionTextAr: z.string().trim().min(5).max(10000),
  attachmentUrl: z.string().trim().max(500).optional().nullable(),
});

export const assignmentGradeSchema = z.object({
  score: z.coerce.number().int().min(0).max(1000),
  feedbackAr: z.string().trim().max(2000).optional().nullable(),
  rubricScores: z.record(z.coerce.number().min(0)).optional().nullable(),
  requestResubmit: z.boolean().default(false),
});

// Support Tickets
export const supportTicketCreateSchema = z.object({
  category: z.enum(['TECHNICAL', 'BILLING', 'CONTENT', 'CERTIFICATES', 'OTHER']).default('OTHER'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  subjectAr: z.string().trim().min(4, 'موضوع التذكرة مطلوب').max(200),
  descriptionAr: z.string().trim().min(10, 'وصف المشكلة مطلوب (10 أحرف على الأقل)').max(5000),
});

export const supportTicketReplySchema = z.object({
  bodyAr: z.string().trim().min(2).max(5000),
  isInternalNote: z.boolean().default(false),
});

export const supportTicketUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedAgentId: z.string().trim().optional().nullable(),
});

export const supportSatisfactionSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  commentAr: z.string().trim().max(1000).optional().nullable(),
});
