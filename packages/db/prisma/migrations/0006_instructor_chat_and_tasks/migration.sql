-- CreateEnum
CREATE TYPE "InstructorTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "InstructorTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INSTRUCTOR_TASK_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'INSTRUCTOR_TASK_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'INSTRUCTOR_CHAT_MESSAGE';

-- CreateTable
CREATE TABLE "InstructorTask" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "courseId" TEXT,
    "titleAr" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "priority" "InstructorTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "InstructorTaskStatus" NOT NULL DEFAULT 'TODO',
    "dueAt" TIMESTAMP(3),
    "adminNotesAr" TEXT,
    "instructorNotesAr" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorChatMessage" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "taskId" TEXT,
    "bodyAr" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "isSystemTaskEvent" BOOLEAN NOT NULL DEFAULT false,
    "readByInstructorAt" TIMESTAMP(3),
    "readByAdminAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstructorTask_instructorId_status_priority_idx" ON "InstructorTask"("instructorId", "status", "priority");

-- CreateIndex
CREATE INDEX "InstructorTask_assignedById_createdAt_idx" ON "InstructorTask"("assignedById", "createdAt");

-- CreateIndex
CREATE INDEX "InstructorTask_courseId_idx" ON "InstructorTask"("courseId");

-- CreateIndex
CREATE INDEX "InstructorChatMessage_instructorId_createdAt_idx" ON "InstructorChatMessage"("instructorId", "createdAt");

-- CreateIndex
CREATE INDEX "InstructorChatMessage_senderId_idx" ON "InstructorChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "InstructorChatMessage_taskId_idx" ON "InstructorChatMessage"("taskId");

-- AddForeignKey
ALTER TABLE "InstructorTask" ADD CONSTRAINT "InstructorTask_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorTask" ADD CONSTRAINT "InstructorTask_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorTask" ADD CONSTRAINT "InstructorTask_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorChatMessage" ADD CONSTRAINT "InstructorChatMessage_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorChatMessage" ADD CONSTRAINT "InstructorChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorChatMessage" ADD CONSTRAINT "InstructorChatMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "InstructorTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
