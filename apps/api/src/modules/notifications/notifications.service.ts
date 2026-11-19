import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationType } from '@bosla/shared';
import { updateNotificationPreferencesSchema } from '@bosla/shared';
import { PrismaService } from '../../core/prisma.service';
import { CommunityNotificationJobPayload, RedisService } from '../../core/redis.service';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  private preferenceKeyForType(
    type: NotificationType,
  ):
    | 'notifyOnNewStudentQuestion'
    | 'notifyOnInstructorReply'
    | 'notifyOnDiscussionReply'
    | 'notifyOnAcceptedAnswer'
    | null {
    switch (type) {
      case 'COMMUNITY_NEW_LESSON_QUESTION':
      case 'COMMUNITY_NEW_COURSE_QUESTION':
        return 'notifyOnNewStudentQuestion';
      case 'COMMUNITY_INSTRUCTOR_REPLY':
        return 'notifyOnInstructorReply';
      case 'COMMUNITY_COMMENT_REPLY':
        return 'notifyOnDiscussionReply';
      case 'COMMUNITY_ACCEPTED_ANSWER':
        return 'notifyOnAcceptedAnswer';
      default:
        return null;
    }
  }

  async dispatchCommunityNotifications(items: CommunityNotificationJobPayload[]): Promise<void> {
    if (items.length === 0) return;

    const userIds = Array.from(new Set(items.map((i) => i.userId)));
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
    });
    const prefMap = new Map(prefs.map((p) => [p.userId, p]));

    const filtered = items.filter((item) => {
      const pref = prefMap.get(item.userId);
      if (!pref) return true;
      const key = this.preferenceKeyForType(item.type);
      if (!key) return true;
      return Boolean(pref[key]);
    });

    if (filtered.length === 0) return;

    const queued = await this.redis.enqueueCommunityNotifications(filtered);
    if (!queued) {
      await this.prisma.notification.createMany({
        data: filtered.map((item) => ({
          userId: item.userId,
          type: item.type,
          titleAr: item.titleAr,
          bodyAr: item.bodyAr,
          actionUrl: item.actionUrl,
          dedupKey: item.dedupKey,
          courseId: item.courseId ?? null,
          postId: item.postId ?? null,
          commentId: item.commentId ?? null,
          lessonId: item.lessonId ?? null,
        })),
        skipDuplicates: true,
      });
    }
  }

  async listUserNotifications(userId: string, limit = 25, cursor?: string) {
    const take = Math.min(Math.max(limit, 1), 50);
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    const hasMore = items.length > take;
    const sliced = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore ? sliced[sliced.length - 1]?.id ?? null : null;

    return {
      items: sliced,
      unreadCount,
      nextCursor,
    };
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(userId: string, rawInput: unknown) {
    const parsed = updateNotificationPreferencesSchema.parse(rawInput);
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: parsed,
      create: {
        userId,
        ...parsed,
      },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('الإشعار غير موجود');
    }
    if (existing.isRead) return existing;

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updatedCount: res.count };
  }
}
