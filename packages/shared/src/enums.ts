export const USER_ROLES = ['ADMIN', 'INSTRUCTOR', 'STUDENT'] as const;
export type UserRole = (typeof USER_ROLES)[number];

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

export const SUBSCRIPTION_STATUSES = [
  'PENDING_PAYMENT',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
