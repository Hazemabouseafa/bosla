-- CreateEnum
CREATE TYPE "CommunityPostType" AS ENUM ('QUESTION', 'DISCUSSION', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "CommunityPostStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "CommunityTargetType" AS ENUM ('POST', 'COMMENT');

-- CreateEnum
CREATE TYPE "CommunityReactionType" AS ENUM ('LIKE');

-- CreateEnum
CREATE TYPE "CommunityReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COMMUNITY_NEW_LESSON_QUESTION', 'COMMUNITY_NEW_COURSE_QUESTION', 'COMMUNITY_INSTRUCTOR_REPLY', 'COMMUNITY_COMMENT_REPLY', 'COMMUNITY_ACCEPTED_ANSWER', 'COMMUNITY_POST_MODERATED');

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PLAYER',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCommunitySettings" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adminDisabled" BOOLEAN NOT NULL DEFAULT false,
    "allowStudentDiscussions" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseCommunitySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT,
    "lessonStableKey" TEXT,
    "lessonTitleSnapshot" TEXT,
    "authorId" TEXT NOT NULL,
    "type" "CommunityPostType" NOT NULL DEFAULT 'QUESTION',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "videoTimestampSeconds" INTEGER,
    "status" "CommunityPostStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isAnswered" BOOLEAN NOT NULL DEFAULT false,
    "acceptedCommentId" TEXT,
    "firstInstructorReplyAt" TIMESTAMP(3),
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CommunityComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "CommunityTargetType" NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "type" "CommunityReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "targetType" "CommunityTargetType" NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityModerationLog" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "titleAr" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "actionUrl" TEXT NOT NULL,
    "dedupKey" TEXT,
    "courseId" TEXT,
    "postId" TEXT,
    "commentId" TEXT,
    "lessonId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifyOnInstructorReply" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnDiscussionReply" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnAcceptedAnswer" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnNewStudentQuestion" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseEnrollment_courseId_startedAt_idx" ON "CourseEnrollment"("courseId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_userId_courseId_key" ON "CourseEnrollment"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCommunitySettings_courseId_key" ON "CourseCommunitySettings"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPost_acceptedCommentId_key" ON "CommunityPost"("acceptedCommentId");

-- CreateIndex
CREATE INDEX "CommunityPost_courseId_deletedAt_status_isPinned_createdAt_idx" ON "CommunityPost"("courseId", "deletedAt", "status", "isPinned", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_courseId_lessonId_deletedAt_createdAt_idx" ON "CommunityPost"("courseId", "lessonId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_courseId_lessonStableKey_deletedAt_createdAt_idx" ON "CommunityPost"("courseId", "lessonStableKey", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_courseId_type_isAnswered_deletedAt_idx" ON "CommunityPost"("courseId", "type", "isAnswered", "deletedAt");

-- CreateIndex
CREATE INDEX "CommunityPost_authorId_createdAt_idx" ON "CommunityPost"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityComment_postId_deletedAt_createdAt_idx" ON "CommunityComment"("postId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityComment_parentCommentId_idx" ON "CommunityComment"("parentCommentId");

-- CreateIndex
CREATE INDEX "CommunityComment_authorId_idx" ON "CommunityComment"("authorId");

-- CreateIndex
CREATE INDEX "CommunityReaction_postId_idx" ON "CommunityReaction"("postId");

-- CreateIndex
CREATE INDEX "CommunityReaction_commentId_idx" ON "CommunityReaction"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityReaction_userId_postId_type_key" ON "CommunityReaction"("userId", "postId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityReaction_userId_commentId_type_key" ON "CommunityReaction"("userId", "commentId", "type");

-- CreateIndex
CREATE INDEX "CommunityReport_status_createdAt_idx" ON "CommunityReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityReport_courseId_status_idx" ON "CommunityReport"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityReport_reporterId_postId_key" ON "CommunityReport"("reporterId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityReport_reporterId_commentId_key" ON "CommunityReport"("reporterId", "commentId");

-- CreateIndex
CREATE INDEX "CommunityModerationLog_courseId_createdAt_idx" ON "CommunityModerationLog"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityModerationLog_actorId_createdAt_idx" ON "CommunityModerationLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupKey_key" ON "Notification"("userId", "dedupKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommunitySettings" ADD CONSTRAINT "CourseCommunitySettings_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommunitySettings" ADD CONSTRAINT "CourseCommunitySettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_acceptedCommentId_fkey" FOREIGN KEY ("acceptedCommentId") REFERENCES "CommunityComment"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "CommunityComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityModerationLog" ADD CONSTRAINT "CommunityModerationLog_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityModerationLog" ADD CONSTRAINT "CommunityModerationLog_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityModerationLog" ADD CONSTRAINT "CommunityModerationLog_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityModerationLog" ADD CONSTRAINT "CommunityModerationLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Safe non-destructive backfill for existing courses & active learners
INSERT INTO "CourseCommunitySettings" ("id", "courseId", "isEnabled", "adminDisabled", "allowStudentDiscussions", "updatedAt")
SELECT
    'ccs_' || substr(md5("id"), 1, 20),
    "id",
    true,
    false,
    true,
    CURRENT_TIMESTAMP
FROM "Course"
ON CONFLICT ("courseId") DO NOTHING;

INSERT INTO "CourseEnrollment" ("id", "userId", "courseId", "source", "startedAt")
SELECT
    'enr_' || substr(md5("userId" || ':' || "courseId"), 1, 20),
    "userId",
    "courseId",
    'BACKFILL_PROGRESS',
    MIN("lastWatchedAt")
FROM "LessonProgress"
GROUP BY "userId", "courseId"
ON CONFLICT ("userId", "courseId") DO NOTHING;


