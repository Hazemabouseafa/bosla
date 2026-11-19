import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  supportSatisfactionSchema,
  supportTicketCreateSchema,
  supportTicketReplySchema,
  supportTicketUpdateSchema,
  toPiasters,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';

const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

@Injectable()
export class SupportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private isSupportStaff(user: AuthenticatedContextUser): boolean {
    return (
      user.permissions.includes('support.manage') ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN')
    );
  }

  private computeSlaDueAt(priority: string): Date {
    const hours =
      priority === 'URGENT' ? 4 : priority === 'HIGH' ? 12 : priority === 'MEDIUM' ? 24 : 48;
    return new Date(Date.now() + hours * 3600_000);
  }

  async createTicket(user: AuthenticatedContextUser, body: unknown, ipAddress?: string) {
    const parsed = supportTicketCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات التذكرة غير صالحة');
    }

    const seq = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `TKT-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}-${seq}`;

    const saved = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: user.id,
        category: parsed.data.category,
        priority: parsed.data.priority,
        status: 'OPEN',
        subjectAr: parsed.data.subjectAr,
        descriptionAr: parsed.data.descriptionAr,
        slaDueAt: this.computeSlaDueAt(parsed.data.priority),
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SUPPORT_TICKET_CREATED',
      entityType: 'SupportTicket',
      entityId: saved.id,
      metadata: { ticketNumber, category: saved.category, priority: saved.priority },
      ipAddress,
    });

    return saved;
  }

  async listTickets(user: AuthenticatedContextUser, params: { status?: string; priority?: string; mineOnly?: boolean }) {
    const staff = this.isSupportStaff(user);
    const filterUser = !staff || params.mineOnly;

    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        ...(filterUser ? { userId: user.id } : {}),
        ...(params.status ? { status: params.status as any } : {}),
        ...(params.priority ? { priority: params.priority as any } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 150,
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true, email: true } },
        assignedAgent: { select: { id: true, fullName: true } },
        replies: {
          where: staff ? undefined : { isInternalNote: false },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, fullName: true, role: true } } },
        },
      },
    });

    return tickets;
  }

  async replyToTicket(
    user: AuthenticatedContextUser,
    ticketId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const raw = (body ?? {}) as Record<string, unknown>;
    const parsed = supportTicketReplySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'نص الرد غير صالح');
    }

    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('تذكرة الدعم غير موجودة');

    const staff = this.isSupportStaff(user);
    if (!staff && ticket.userId !== user.id) {
      throw new ForbiddenException('لا يمكنك الرد على تذكرة مستخدم آخر');
    }

    const isInternalNote = staff ? Boolean(parsed.data.isInternalNote) : false;

    // Safe attachment check (no traversal, strict MIME allowlist)
    let attachmentUrl: string | null = null;
    let attachmentMimeType: string | null = null;
    if (typeof raw.attachmentUrl === 'string' && raw.attachmentUrl.trim()) {
      const url = raw.attachmentUrl.trim();
      if (url.includes('..') || (!url.startsWith('/uploads/') && !url.startsWith('https://'))) {
        throw new BadRequestException('رابط المرفق غير آمن');
      }
      const mime = typeof raw.attachmentMimeType === 'string' ? raw.attachmentMimeType.trim() : '';
      if (!ALLOWED_ATTACHMENT_MIMES.has(mime)) {
        throw new BadRequestException('نوع الملف المرفق غير مسموح به (المسموح: PNG, JPEG, WEBP, PDF)');
      }
      attachmentUrl = url;
      attachmentMimeType = mime;
    }

    const reply = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportTicketReply.create({
        data: {
          ticketId: ticket.id,
          authorId: user.id,
          bodyAr: parsed.data.bodyAr,
          isInternalNote,
          attachmentUrl,
          attachmentMimeType,
        },
      });

      if (staff && !isInternalNote) {
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: {
            firstRespondedAt: ticket.firstRespondedAt ?? new Date(),
            status: ticket.status === 'OPEN' ? 'WAITING_USER' : ticket.status,
          },
        });
        await tx.notification.createMany({
          data: [
            {
              userId: ticket.userId,
              type: 'SUPPORT_TICKET_UPDATED',
              titleAr: `رد جديد على التذكرة ${ticket.ticketNumber}`,
              bodyAr: parsed.data.bodyAr.slice(0, 140),
              actionUrl: '/support',
              dedupKey: `ticket-reply-${created.id}`,
            },
          ],
          skipDuplicates: true,
        });
      }

      return created;
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: isInternalNote ? 'SUPPORT_TICKET_INTERNAL_NOTE' : 'SUPPORT_TICKET_REPLIED',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      metadata: { replyId: reply.id, isInternalNote },
      ipAddress,
    });

    return reply;
  }

  async updateTicket(
    actor: AuthenticatedContextUser,
    ticketId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    const parsed = supportTicketUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات تحديث التذكرة غير صالحة');
    }

    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('تذكرة الدعم غير موجودة');

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.priority
          ? { priority: parsed.data.priority, slaDueAt: this.computeSlaDueAt(parsed.data.priority) }
          : {}),
        ...(parsed.data.assignedAgentId !== undefined
          ? { assignedAgentId: parsed.data.assignedAgentId }
          : {}),
        ...(parsed.data.status === 'RESOLVED' || parsed.data.status === 'CLOSED'
          ? { resolvedAt: ticket.resolvedAt ?? new Date() }
          : {}),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'SUPPORT_TICKET_UPDATED',
      entityType: 'SupportTicket',
      entityId: ticketId,
      metadata: parsed.data as any,
      ipAddress,
    });

    return updated;
  }

  async submitSatisfactionRating(user: AuthenticatedContextUser, ticketId: string, body: unknown) {
    const parsed = supportSatisfactionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'التقييم يجب أن يكون من 1 إلى 5');
    }
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('تذكرة الدعم غير موجودة');
    if (ticket.userId !== user.id) {
      throw new ForbiddenException('لا يمكنك تقييم تذكرة مستخدم آخر');
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        satisfactionRating: parsed.data.rating,
        satisfactionCommentAr: parsed.data.commentAr ?? null,
      },
    });
  }

  // ============================================================
  // EXECUTIVE ANALYTICS & KPIs (DAILY / MONTHLY / ANNUAL)
  // ============================================================

  async getExecutiveAnalytics() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalUsers,
      newUsersMonth,
      activeEnrollments,
      completedLessons,
      totalProgressRows,
      ordersYear,
      sellersTop,
      tickets,
      orgs,
      waitlistTotal,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.courseEnrollment.count(),
      this.prisma.lessonProgress.count({ where: { isCompleted: true } }),
      this.prisma.lessonProgress.count(),
      this.prisma.order.findMany({
        where: { createdAt: { gte: startOfYear }, status: { in: ['PAID', 'PARTIALLY_PAID'] } },
        select: { paidAmount: true, paidAt: true, createdAt: true, accountingType: true },
      }),
      this.prisma.seller.findMany({
        where: { status: 'APPROVED' },
        take: 10,
        select: {
          id: true,
          fullName: true,
          _count: { select: { attributedOrders: true, commissions: true } },
          commissions: {
            where: { status: { not: 'REVERSED' } },
            select: { netAmount: true },
          },
        },
      }),
      this.prisma.supportTicket.findMany({
        select: { status: true, slaDueAt: true, resolvedAt: true, satisfactionRating: true },
      }),
      this.prisma.organization.findMany({
        select: { seatCapacity: true, _count: { select: { members: true } } },
      }),
      this.prisma.courseWaitlist.count(),
    ]);

    const sumOrdersSince = (since: Date) =>
      ordersYear
        .filter((o) => (o.paidAt ?? o.createdAt) >= since)
        .reduce((s, o) => s + toPiasters(o.paidAmount.toString()), 0) / 100;

    const ratedTickets = tickets.filter((t) => t.satisfactionRating !== null);
    const avgCsat =
      ratedTickets.length > 0
        ? Number(
            (
              ratedTickets.reduce((s, t) => s + (t.satisfactionRating || 0), 0) / ratedTickets.length
            ).toFixed(2),
          )
        : null;

    const totalB2bSeats = orgs.reduce((s, o) => s + o.seatCapacity, 0);
    const usedB2bSeats = orgs.reduce((s, o) => s + o._count.members, 0);

    return {
      generatedAtUtc: now.toISOString(),
      salesEgp: {
        daily: sumOrdersSince(startOfDay),
        monthly: sumOrdersSince(startOfMonth),
        annual: sumOrdersSince(startOfYear),
      },
      learningKpis: {
        totalUsers,
        newUsersThisMonth: newUsersMonth,
        activeEnrollments,
        lessonCompletionRatePercent:
          totalProgressRows > 0 ? Math.round((completedLessons / totalProgressRows) * 100) : 0,
        waitlistDemandCount: waitlistTotal,
      },
      b2bKpis: {
        organizationsCount: orgs.length,
        totalSeats: totalB2bSeats,
        usedSeats: usedB2bSeats,
        utilizationPercent: totalB2bSeats > 0 ? Math.round((usedB2bSeats / totalB2bSeats) * 100) : 0,
      },
      supportKpis: {
        totalTickets: tickets.length,
        openTickets: tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
        resolvedTickets: tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
        averageCsat: avgCsat,
      },
      topSellers: sellersTop
        .map((s) => ({
          id: s.id,
          fullName: s.fullName,
          ordersCount: s._count.attributedOrders,
          totalNetCommissionsEgp:
            s.commissions.reduce((acc, c) => acc + toPiasters(c.netAmount.toString()), 0) / 100,
        }))
        .sort((a, b) => b.totalNetCommissionsEgp - a.totalNetCommissionsEgp),
    };
  }
}
