export interface CommunityAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  headlineAr: string | null;
  isCourseInstructor: boolean;
  isAdminModerator: boolean;
}

export interface CommunityAccessDecision {
  allowed: boolean;
  reason: string;
  messageAr: string;
  canModerate: boolean;
  canPost: boolean;
}

export interface CommunitySettingsSummary {
  isEnabled: boolean;
  adminDisabled: boolean;
  allowStudentDiscussions: boolean;
}

export interface CommunityAcceptedCommentPreview {
  id: string;
  body: string;
  createdAt: string;
  author: CommunityAuthor;
}

export interface CommunityPostSummary {
  id: string;
  courseId: string;
  courseSlug: string;
  lessonId: string | null;
  lessonStableKey: string | null;
  lessonTitleAr: string | null;
  type: 'DISCUSSION' | 'QUESTION' | 'ANNOUNCEMENT';
  title: string;
  body: string;
  videoTimestampSeconds: number | null;
  videoTimestampLabel: string | null;
  status: 'ACTIVE' | 'HIDDEN' | 'REMOVED';
  isPinned: boolean;
  isLocked: boolean;
  isAnswered: boolean;
  acceptedCommentId: string | null;
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
  instructorParticipated: boolean;
  author: CommunityAuthor;
  acceptedComment: CommunityAcceptedCommentPreview | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityCommentItem {
  id: string;
  postId: string;
  parentCommentId: string | null;
  body: string;
  likeCount: number;
  viewerHasLiked: boolean;
  isAcceptedAnswer: boolean;
  author: CommunityAuthor;
  createdAt: string;
  updatedAt: string;
  replies: CommunityCommentItem[];
}

export interface CommunityPostDetailResponse {
  post: CommunityPostSummary;
  comments: CommunityCommentItem[];
  permissions: CommunityAccessDecision;
}

export interface CommunityCoursePostsResponse {
  course: {
    id: string;
    slug: string;
    status: string;
    isFree: boolean;
    instructorId: string;
    publishedVersionId: string | null;
    titleAr: string;
  };
  settings: CommunitySettingsSummary;
  access: CommunityAccessDecision;
  items: CommunityPostSummary[];
  nextCursor: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  titleAr: string;
  bodyAr: string;
  actionUrl: string;
  isRead: boolean;
  readAt: string | null;
  courseId: string | null;
  postId: string | null;
  commentId: string | null;
  lessonId: string | null;
  createdAt: string;
}

export interface NotificationPreferenceItem {
  notifyOnNewStudentQuestion: boolean;
  notifyOnInstructorReply: boolean;
  notifyOnDiscussionReply: boolean;
  notifyOnAcceptedAnswer: boolean;
}
