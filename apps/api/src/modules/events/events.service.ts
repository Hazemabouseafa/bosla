import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import type { OfflineEventStatus } from '@bosla/db';
import {
  adminEventRegistrationStatusSchema,
  normalizePhoneToE164,
  offlineEventCheckoutSchema,
  offlineEventSchema,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import { lockOfflineEventAndCheckCapacity } from '../../core/event-capacity.helper';
import { PrismaService } from '../../core/prisma.service';
import { PaymobClient } from '../membership/paymob.client';

@Injectable()
export class EventsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymobClient) private readonly paymob: PaymobClient,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private generateTicketCode(): string {
    return `EVT-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private async getSeatsBookedMap(eventIds: string[]): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.prisma.offlineEventRegistration.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventIds },
        status: { in: ['CONFIRMED', 'ATTENDED'] },
      },
      _sum: { seatsCount: true },
    });
    return new Map(rows.map((r) => [r.eventId, Number(r._sum.seatsCount ?? 0)]));
  }

  private async getPaidRevenueMap(eventIds: string[]): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.prisma.paymentTransaction.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: eventIds },
        status: 'PAID',
      },
      _sum: { amountCents: true },
    });
    return new Map(
      rows
        .filter((r) => Boolean(r.eventId))
        .map((r) => [r.eventId as string, Number(r._sum.amountCents ?? 0)]),
    );
  }

  // ============================================================
  // PUBLIC & STUDENT CATALOG + PAYMOB TICKET CHECKOUT
  // ============================================================

  async listPublicEvents(params?: { city?: string; search?: string }) {
    const events = await this.prisma.offlineEvent.findMany({
      where: {
        status: 'PUBLISHED',
        ...(params?.city?.trim() ? { cityAr: params.city.trim() } : {}),
        ...(params?.search?.trim()
          ? {
              OR: [
                { titleAr: { contains: params.search.trim(), mode: 'insensitive' } },
                { subtitleAr: { contains: params.search.trim(), mode: 'insensitive' } },
                { descriptionAr: { contains: params.search.trim(), mode: 'insensitive' } },
                { venueNameAr: { contains: params.search.trim(), mode: 'insensitive' } },
                { cityAr: { contains: params.search.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        instructor: {
          select: { id: true, fullName: true, headlineAr: true, avatarUrl: true },
        },
      },
      orderBy: [{ featuredOrder: 'asc' }, { startsAt: 'asc' }],
    });

    const bookedMap = await this.getSeatsBookedMap(events.map((e) => e.id));

    return events.map((ev) => {
      const seatsBooked = bookedMap.get(ev.id) ?? 0;
      return {
        ...ev,
        seatsBooked,
        remainingSeats: Math.max(0, ev.capacity - seatsBooked),
      };
    });
  }

  async getPublicEventBySlug(slug: string, userId?: string | null) {
    const event = await this.prisma.offlineEvent.findUnique({
      where: { slug },
      include: {
        instructor: {
          select: { id: true, fullName: true, headlineAr: true, bioAr: true, avatarUrl: true },
        },
      },
    });

    if (!event || event.status === 'DRAFT') {
      throw new NotFoundException('الفعالية غير موجودة');
    }

    const bookedMap = await this.getSeatsBookedMap([event.id]);
    const seatsBooked = bookedMap.get(event.id) ?? 0;

    let myRegistration = null;
    if (userId) {
      myRegistration = await this.prisma.offlineEventRegistration.findFirst({
        where: {
          eventId: event.id,
          userId,
          status: { in: ['CONFIRMED', 'ATTENDED'] },
        },
        include: {
          paymentTransaction: {
            select: {
              id: true,
              merchantOrderId: true,
              status: true,
              amountCents: true,
              paidAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return {
      ...event,
      seatsBooked,
      remainingSeats: Math.max(0, event.capacity - seatsBooked),
      myRegistration,
    };
  }

  async listMyRegistrations(userId: string) {
    return this.prisma.offlineEventRegistration.findMany({
      where: { userId },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            titleAr: true,
            thumbnailUrl: true,
            categoryLabelAr: true,
            cityAr: true,
            venueNameAr: true,
            venueAddressAr: true,
            startsAt: true,
            endsAt: true,
            status: true,
            speakerNameAr: true,
          },
        },
        paymentTransaction: {
          select: {
            id: true,
            merchantOrderId: true,
            status: true,
            amountCents: true,
            paidAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async initiateEventCheckout(userId: string, eventId: string, rawBody: unknown) {
    const parsed = offlineEventCheckoutSchema.parse(rawBody ?? {});

    const [user, event] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.offlineEvent.findUnique({ where: { id: eventId } }),
    ]);

    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('الحساب غير نشط لإتمام حجز الفعالية');
    }
    if (!event || event.status !== 'PUBLISHED') {
      throw new NotFoundException('الفعالية غير متاحة للحجز حالياً');
    }

    const existingActive = await this.prisma.offlineEventRegistration.findFirst({
      where: {
        eventId: event.id,
        userId: user.id,
        status: { in: ['CONFIRMED', 'ATTENDED'] },
      },
    });
    if (existingActive) {
      throw new ConflictException(`لديك حجز مؤكد بالفعل في هذه الفعالية (${existingActive.ticketCode})`);
    }

    const bookedAgg = await this.prisma.offlineEventRegistration.aggregate({
      where: {
        eventId: event.id,
        status: { in: ['CONFIRMED', 'ATTENDED'] },
      },
      _sum: { seatsCount: true },
    });
    const seatsBooked = Number(bookedAgg._sum.seatsCount ?? 0);
    if (seatsBooked + parsed.seatsCount > event.capacity) {
      throw new BadRequestException('عذراً، عدد المقاعد المتبقية في الفعالية لا يكفي للعدد المطلوب');
    }

    const amountCents = event.priceCents * parsed.seatsCount;
    const attendeeNameAr = parsed.attendeeNameAr?.trim() || user.fullName;
    const rawPhone = parsed.attendeePhone?.trim();
    const attendeePhoneE164 = rawPhone
      ? (normalizePhoneToE164(rawPhone, '+20') ?? rawPhone)
      : user.phoneE164;
    const ticketCode = this.generateTicketCode();

    // Free open event support (without Paymob charge when priceCents === 0)
    if (amountCents === 0) {
      const registration = await this.prisma.$transaction(async (tx) => {
        const cap = await lockOfflineEventAndCheckCapacity(tx, {
          eventId: event.id,
          requestedSeats: parsed.seatsCount,
        });
        if (!cap.allowed) {
          throw new BadRequestException('عذراً، عدد المقاعد المتبقية في الفعالية لا يكفي للعدد المطلوب');
        }
        const duplicateActive = await tx.offlineEventRegistration.findFirst({
          where: {
            eventId: event.id,
            userId: user.id,
            status: { in: ['CONFIRMED', 'ATTENDED'] },
          },
        });
        if (duplicateActive) {
          throw new ConflictException(`لديك حجز مؤكد بالفعل في هذه الفعالية (${duplicateActive.ticketCode})`);
        }
        return tx.offlineEventRegistration.create({
          data: {
            eventId: event.id,
            userId: user.id,
            status: 'CONFIRMED',
            ticketCode,
            seatsCount: parsed.seatsCount,
            amountCents: 0,
            currency: event.currency,
            attendeeNameAr,
            attendeePhoneE164,
            notes: parsed.notes?.trim() || null,
            paidAt: new Date(),
          },
        });
      });

      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'EVENT_FREE_REGISTRATION_CONFIRMED',
        entityType: 'OfflineEventRegistration',
        entityId: registration.id,
        metadata: { eventId: event.id, ticketCode, seatsCount: parsed.seatsCount },
      });

      return {
        free: true,
        status: 'CONFIRMED',
        ticketCode,
        amountCents: 0,
        currency: event.currency,
        registration,
      };
    }

    const merchantOrderId = `BOSLA-EVT-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const apiUrl = process.env.API_URL || 'http://localhost:4000';

    const { tx, registration } = await this.prisma.$transaction(async (db) => {
      const createdTx = await db.paymentTransaction.create({
        data: {
          userId: user.id,
          targetType: 'OFFLINE_EVENT',
          eventId: event.id,
          amountCents,
          currency: event.currency,
          status: 'INITIATED',
          merchantOrderId,
        },
      });

      const createdReg = await db.offlineEventRegistration.create({
        data: {
          eventId: event.id,
          userId: user.id,
          status: 'PENDING_PAYMENT',
          ticketCode,
          seatsCount: parsed.seatsCount,
          amountCents,
          currency: event.currency,
          attendeeNameAr,
          attendeePhoneE164,
          notes: parsed.notes?.trim() || null,
          paymentTransactionId: createdTx.id,
        },
      });

      return { tx: createdTx, registration: createdReg };
    });

    const itemTitle =
      parsed.seatsCount > 1
        ? `${event.titleAr} (${parsed.seatsCount} مقاعد)`
        : event.titleAr;

    const paymobResult = await this.paymob.createCheckout({
      amountCents,
      currency: event.currency,
      merchantOrderId,
      billingUser: {
        fullName: attendeeNameAr,
        email: user.email,
        phoneE164: attendeePhoneE164 ?? user.phoneE164,
      },
      planNameAr: itemTitle,
      returnUrl: `${appUrl}/membership/checkout-result?merchantOrderId=${encodeURIComponent(
        merchantOrderId,
      )}`,
      webhookUrl: `${apiUrl}/api/v1/payments/paymob/webhook`,
    });

    await this.prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        status: 'PENDING',
        paymobOrderId: paymobResult.paymobOrderId,
        paymobIntentionId: paymobResult.paymobIntentionId,
        paymentKey: paymobResult.paymentKey,
        rawInitPayload: paymobResult.rawPayload as any,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'EVENT_CHECKOUT_INITIATED',
      entityType: 'PaymentTransaction',
      entityId: tx.id,
      metadata: {
        eventId: event.id,
        registrationId: registration.id,
        seatsCount: parsed.seatsCount,
        amountCents,
        mode: paymobResult.mode,
      },
    });

    return {
      free: false,
      transactionId: tx.id,
      merchantOrderId,
      ticketCode,
      amountCents,
      currency: event.currency,
      mode: paymobResult.mode,
      checkoutUrl: paymobResult.checkoutUrl,
    };
  }

  // ============================================================
  // ADMIN-ONLY OFFLINE EVENTS MANAGEMENT
  // ============================================================

  async listEventsForAdmin() {
    const events = await this.prisma.offlineEvent.findMany({
      include: {
        instructor: { select: { id: true, fullName: true, headlineAr: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const ids = events.map((e) => e.id);
    const [bookedMap, revenueMap] = await Promise.all([
      this.getSeatsBookedMap(ids),
      this.getPaidRevenueMap(ids),
    ]);

    return events.map((ev) => {
      const seatsBooked = bookedMap.get(ev.id) ?? 0;
      const paidRevenueCents = revenueMap.get(ev.id) ?? 0;
      return {
        ...ev,
        seatsBooked,
        remainingSeats: Math.max(0, ev.capacity - seatsBooked),
        paidRevenueCents,
      };
    });
  }

  private parseEventDates(startsAtRaw: string, endsAtRaw?: string | null) {
    const startsAt = new Date(startsAtRaw);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('صيغة تاريخ ووقت البدء غير صالحة');
    }
    let endsAt: Date | null = null;
    if (endsAtRaw && endsAtRaw.trim()) {
      endsAt = new Date(endsAtRaw);
      if (Number.isNaN(endsAt.getTime())) {
        throw new BadRequestException('صيغة تاريخ الانتهاء غير صالحة');
      }
      if (endsAt < startsAt) {
        throw new BadRequestException('يجب أن يكون وقت الانتهاء بعد وقت البدء');
      }
    }
    return { startsAt, endsAt };
  }

  async createEventByAdmin(adminId: string, rawInput: unknown, ip?: string) {
    const parsed = offlineEventSchema.parse(rawInput);
    const existingSlug = await this.prisma.offlineEvent.findUnique({ where: { slug: parsed.slug } });
    if (existingSlug) {
      throw new ConflictException('الرابط المختصر مستخدم بالفعل لفعالية أخرى');
    }

    const { startsAt, endsAt } = this.parseEventDates(parsed.startsAt, parsed.endsAt);

    let instructorId: string | null = null;
    if (parsed.instructorId && parsed.instructorId.trim()) {
      const inst = await this.prisma.user.findUnique({
        where: { id: parsed.instructorId.trim() },
        select: { id: true },
      });
      if (!inst) {
        throw new BadRequestException('المدرب المحدد غير موجود');
      }
      instructorId = inst.id;
    }

    const created = await this.prisma.offlineEvent.create({
      data: {
        slug: parsed.slug,
        titleAr: parsed.titleAr,
        subtitleAr: parsed.subtitleAr?.trim() || null,
        descriptionAr: parsed.descriptionAr,
        thumbnailUrl: parsed.thumbnailUrl?.trim() || null,
        categoryLabelAr: parsed.categoryLabelAr,
        cityAr: parsed.cityAr,
        venueNameAr: parsed.venueNameAr,
        venueAddressAr: parsed.venueAddressAr,
        mapUrl: parsed.mapUrl?.trim() || null,
        startsAt,
        endsAt,
        priceCents: parsed.priceCents,
        compareAtPriceCents: parsed.compareAtPriceCents ?? null,
        capacity: parsed.capacity,
        status: parsed.status,
        highlights: parsed.highlights,
        speakerNameAr: parsed.speakerNameAr?.trim() || null,
        instructorId,
        createdById: adminId,
        featuredOrder: parsed.featuredOrder ?? null,
      },
      include: {
        instructor: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_OFFLINE_EVENT_CREATED',
      entityType: 'OfflineEvent',
      entityId: created.id,
      metadata: {
        slug: created.slug,
        priceCents: created.priceCents,
        capacity: created.capacity,
        status: created.status,
      },
      ipAddress: ip,
    });

    return {
      ...created,
      seatsBooked: 0,
      remainingSeats: created.capacity,
      paidRevenueCents: 0,
    };
  }

  async updateEventByAdmin(adminId: string, eventId: string, rawInput: unknown, ip?: string) {
    const existing = await this.prisma.offlineEvent.findUnique({ where: { id: eventId } });
    if (!existing) {
      throw new NotFoundException('الفعالية غير موجودة');
    }

    const parsed = offlineEventSchema.parse(rawInput);
    const dupSlug = await this.prisma.offlineEvent.findFirst({
      where: { slug: parsed.slug, id: { not: eventId } },
      select: { id: true },
    });
    if (dupSlug) {
      throw new ConflictException('الرابط المختصر مستخدم بالفعل لفعالية أخرى');
    }

    const { startsAt, endsAt } = this.parseEventDates(parsed.startsAt, parsed.endsAt);

    let instructorId: string | null = null;
    if (parsed.instructorId && parsed.instructorId.trim()) {
      const inst = await this.prisma.user.findUnique({
        where: { id: parsed.instructorId.trim() },
        select: { id: true },
      });
      if (!inst) {
        throw new BadRequestException('المدرب المحدد غير موجود');
      }
      instructorId = inst.id;
    }

    const updated = await this.prisma.offlineEvent.update({
      where: { id: eventId },
      data: {
        slug: parsed.slug,
        titleAr: parsed.titleAr,
        subtitleAr: parsed.subtitleAr?.trim() || null,
        descriptionAr: parsed.descriptionAr,
        thumbnailUrl: parsed.thumbnailUrl?.trim() || null,
        categoryLabelAr: parsed.categoryLabelAr,
        cityAr: parsed.cityAr,
        venueNameAr: parsed.venueNameAr,
        venueAddressAr: parsed.venueAddressAr,
        mapUrl: parsed.mapUrl?.trim() || null,
        startsAt,
        endsAt,
        priceCents: parsed.priceCents,
        compareAtPriceCents: parsed.compareAtPriceCents ?? null,
        capacity: parsed.capacity,
        status: parsed.status,
        highlights: parsed.highlights,
        speakerNameAr: parsed.speakerNameAr?.trim() || null,
        instructorId,
        featuredOrder: parsed.featuredOrder ?? null,
      },
      include: {
        instructor: { select: { id: true, fullName: true } },
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_OFFLINE_EVENT_UPDATED',
      entityType: 'OfflineEvent',
      entityId: eventId,
      metadata: { slug: updated.slug, priceCents: updated.priceCents, status: updated.status },
      ipAddress: ip,
    });

    return updated;
  }

  async setEventStatusByAdmin(
    adminId: string,
    eventId: string,
    status: OfflineEventStatus,
    ip?: string,
  ) {
    const existing = await this.prisma.offlineEvent.findUnique({ where: { id: eventId } });
    if (!existing) throw new NotFoundException('الفعالية غير موجودة');

    const updated = await this.prisma.offlineEvent.update({
      where: { id: eventId },
      data: { status },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_OFFLINE_EVENT_STATUS_CHANGED',
      entityType: 'OfflineEvent',
      entityId: eventId,
      metadata: { fromStatus: existing.status, toStatus: status },
      ipAddress: ip,
    });

    return updated;
  }

  async deleteEventByAdmin(adminId: string, eventId: string, ip?: string) {
    const existing = await this.prisma.offlineEvent.findUnique({ where: { id: eventId } });
    if (!existing) throw new NotFoundException('الفعالية غير موجودة');

    const confirmedCount = await this.prisma.offlineEventRegistration.count({
      where: { eventId, status: { in: ['CONFIRMED', 'ATTENDED'] } },
    });
    if (confirmedCount > 0) {
      throw new BadRequestException(
        'لا يمكن حذف فعالية بها حجوزات مؤكدة؛ قم بتغيير حالتها إلى ملغاة أو استرداد الحجوزات أولاً.',
      );
    }

    const paidTxCount = await this.prisma.paymentTransaction.count({
      where: { eventId, status: 'PAID' },
    });
    if (paidTxCount > 0) {
      throw new BadRequestException(
        'لا يمكن حذف فعالية مرتبطة بمعاملات دفع مسددة حفاظاً على السجل المالي.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.offlineEventRegistration.deleteMany({ where: { eventId } });
      await tx.paymentTransaction.deleteMany({ where: { eventId } });
      await tx.offlineEvent.delete({ where: { id: eventId } });
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_OFFLINE_EVENT_DELETED',
      entityType: 'OfflineEvent',
      entityId: eventId,
      metadata: { titleAr: existing.titleAr },
      ipAddress: ip,
    });

    return { deleted: true, id: eventId };
  }

  async listEventRegistrationsForAdmin(eventId: string) {
    const event = await this.prisma.offlineEvent.findUnique({
      where: { id: eventId },
      select: { id: true, titleAr: true, capacity: true, priceCents: true, startsAt: true, cityAr: true },
    });
    if (!event) throw new NotFoundException('الفعالية غير موجودة');

    const registrations = await this.prisma.offlineEventRegistration.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, fullName: true, phoneE164: true, email: true } },
        paymentTransaction: {
          select: {
            id: true,
            merchantOrderId: true,
            status: true,
            amountCents: true,
            paidAt: true,
            verifiedHmac: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { event, registrations };
  }

  async updateRegistrationStatusByAdmin(
    adminId: string,
    regId: string,
    rawInput: unknown,
    ip?: string,
  ) {
    const parsed = adminEventRegistrationStatusSchema.parse(rawInput);
    const existing = await this.prisma.offlineEventRegistration.findUnique({ where: { id: regId } });
    if (!existing) throw new NotFoundException('الحجز غير موجود');

    const now = new Date();
    const updated = await this.prisma.offlineEventRegistration.update({
      where: { id: regId },
      data: {
        status: parsed.status,
        ...(parsed.status === 'ATTENDED' ? { checkedInAt: now, paidAt: existing.paidAt ?? now } : {}),
        ...(parsed.status === 'CONFIRMED' ? { paidAt: existing.paidAt ?? now, cancelledAt: null } : {}),
        ...(parsed.status === 'CANCELLED' || parsed.status === 'REFUNDED' ? { cancelledAt: now } : {}),
      },
    });

    await this.audit.log({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'ADMIN_EVENT_REGISTRATION_STATUS_UPDATED',
      entityType: 'OfflineEventRegistration',
      entityId: regId,
      metadata: { fromStatus: existing.status, toStatus: parsed.status, ticketCode: existing.ticketCode },
      ipAddress: ip,
    });

    return updated;
  }
}
