export const USER_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'ACADEMY_MANAGER',
  'TRAINING_COORDINATOR',
  'INSTRUCTOR',
  'FINANCE_OFFICER',
  'STUDENT',
  'AFFILIATE_SELLER',
  'SUPPORT',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const COURSE_DELIVERY_MODES = ['ONLINE', 'OFFLINE', 'HYBRID'] as const;
export type CourseDeliveryMode = (typeof COURSE_DELIVERY_MODES)[number];

export const ORDER_CLASSIFICATIONS = [
  'COURSE_PURCHASE',
  'MONTHLY_MEMBERSHIP',
  'ANNUAL_MEMBERSHIP',
] as const;
export type OrderClassification = (typeof ORDER_CLASSIFICATIONS)[number];

export const SELLER_APPLICATION_STATUSES = [
  'PENDING',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
] as const;
export type SellerApplicationStatus = (typeof SELLER_APPLICATION_STATUSES)[number];

export const SELLER_ACCOUNT_STATUSES = ['APPROVED', 'SUSPENDED'] as const;
export type SellerAccountStatus = (typeof SELLER_ACCOUNT_STATUSES)[number];

export const COMMISSION_STATUSES = [
  'PENDING_PAYMENT',
  'ON_HOLD',
  'ELIGIBLE',
  'APPROVED',
  'INCLUDED_IN_PAYOUT',
  'PAID',
  'REVERSED',
  'DISPUTED',
] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const PAYOUT_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PAID',
  'PAYOUT_FAILED',
  'FROZEN',
  'CARRIED_FORWARD',
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const USER_STATUSES = [
  'ENROLLMENT_PENDING',
  'ACTIVE',
  'LOCKED',
  'SUSPENDED',
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Strictly ONLY 3 educational content types (no Program type). */
export const CONTENT_TYPES = ['COURSE', 'LEARNING_PATH', 'DIPLOMA'] as const;
export type EducationalContentType = (typeof CONTENT_TYPES)[number];

export const EDITORIAL_STATUSES = [
  'DRAFT',
  'SUBMITTED_FOR_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED',
] as const;
export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];

export const MEMBERSHIP_INTERVALS = ['MONTHLY', 'ANNUAL'] as const;
export type MembershipInterval = (typeof MEMBERSHIP_INTERVALS)[number];

export const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const LESSON_TYPES = ['VIDEO', 'ARTICLE', 'QUIZ'] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const VIDEO_PROCESSING_STATUSES = [
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
] as const;
export type VideoProcessingStatus = (typeof VIDEO_PROCESSING_STATUSES)[number];

export const VIDEO_QUALITY_PROFILES = ['480p', '720p', '1080p'] as const;
export type VideoQualityProfile = (typeof VIDEO_QUALITY_PROFILES)[number];

export const PAYMENT_STATUSES = [
  'INITIATED',
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'CANCELLED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_TARGET_TYPES = ['MEMBERSHIP', 'OFFLINE_EVENT'] as const;
export type PaymentTargetType = (typeof PAYMENT_TARGET_TYPES)[number];

export const OFFLINE_EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED'] as const;
export type OfflineEventStatus = (typeof OFFLINE_EVENT_STATUSES)[number];

export const EVENT_REGISTRATION_STATUSES = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'ATTENDED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type EventRegistrationStatus = (typeof EVENT_REGISTRATION_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  'PENDING_PAYMENT',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const COMMUNITY_POST_TYPES = ['QUESTION', 'DISCUSSION', 'ANNOUNCEMENT'] as const;
export type CommunityPostType = (typeof COMMUNITY_POST_TYPES)[number];

export const COMMUNITY_POST_STATUSES = ['ACTIVE', 'HIDDEN', 'REMOVED'] as const;
export type CommunityPostStatus = (typeof COMMUNITY_POST_STATUSES)[number];

export const COMMUNITY_TARGET_TYPES = ['POST', 'COMMENT'] as const;
export type CommunityTargetType = (typeof COMMUNITY_TARGET_TYPES)[number];

export const COMMUNITY_REACTION_TYPES = ['LIKE'] as const;
export type CommunityReactionType = (typeof COMMUNITY_REACTION_TYPES)[number];

export const COMMUNITY_REPORT_STATUSES = [
  'PENDING',
  'REVIEWED',
  'ACTION_TAKEN',
  'DISMISSED',
] as const;
export type CommunityReportStatus = (typeof COMMUNITY_REPORT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'COMMUNITY_NEW_LESSON_QUESTION',
  'COMMUNITY_NEW_COURSE_QUESTION',
  'COMMUNITY_INSTRUCTOR_REPLY',
  'COMMUNITY_COMMENT_REPLY',
  'COMMUNITY_ACCEPTED_ANSWER',
  'COMMUNITY_POST_MODERATED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
