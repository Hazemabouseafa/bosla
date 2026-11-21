'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { apiFetch, formatDateTime, formatEgp, formatTimeOnly } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { getEventRegistrationStatusMeta, getOfflineEventStatusMeta } from '@/lib/labels';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
  textareaClassName,
} from '@/components/ui/primitives';

export interface EventDetailData {
  id: string;
  slug: string;
  titleAr: string;
  subtitleAr?: string | null;
  descriptionAr: string;
  thumbnailUrl?: string | null;
  categoryLabelAr: string;
  cityAr: string;
  venueNameAr: string;
  venueAddressAr: string;
  mapUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  currency: string;
  capacity: number;
  seatsBooked: number;
  remainingSeats: number;
  status: string;
  highlights: string[];
  speakerNameAr?: string | null;
  instructor?: {
    id: string;
    fullName: string;
    headlineAr?: string | null;
    bioAr?: string | null;
    avatarUrl?: string | null;
  } | null;
  myRegistration?: {
    id: string;
    ticketCode: string;
    status: string;
    seatsCount: number;
    amountCents: number;
    attendeeNameAr: string;
    paidAt?: string | null;
  } | null;
}

export function EventDetailClient({ initialEvent }: { initialEvent: EventDetailData }) {
  const router = useRouter();
  const { user, requiresPasskeyEnrollment, pushToast } = useAuth();

  const [event, setEvent] = useState<EventDetailData>(initialEvent);
  const [seatsCount, setSeatsCount] = useState(1);
  const [attendeeNameAr, setAttendeeNameAr] = useState('');
  const [attendeePhone, setAttendeePhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setAttendeeNameAr((prev) => prev || user.fullName || '');
      setAttendeePhone((prev) => prev || user.phoneE164 || '');
      apiFetch<EventDetailData>(`/events/${encodeURIComponent(initialEvent.slug)}`)
        .then(setEvent)
        .catch(() => {});
    }
  }, [user, initialEvent.slug]);

  const maxOrderSeats = Math.max(1, Math.min(5, event.remainingSeats || 1));
  const totalAmountCents = event.priceCents * seatsCount;
  const statusMeta = getOfflineEventStatusMeta(event.status);
  const isBookable = event.status === 'PUBLISHED' && event.remainingSeats > 0;
  const speakerName = event.speakerNameAr || event.instructor?.fullName || 'فريق خبراء بوصلة';

  const startFormatted = formatDateTime(event.startsAt, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const endFormatted = event.endsAt
    ? formatTimeOnly(event.endsAt, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/events/${event.slug}`)}`);
      return;
    }
    if (requiresPasskeyEnrollment) {
      router.push('/security/passkey-setup');
      return;
    }

    setBusy(true);
    try {
      const res = await apiFetch<{
        free: boolean;
        status?: string;
        ticketCode: string;
        merchantOrderId?: string;
        checkoutUrl?: string;
        amountCents: number;
      }>(`/events/${event.id}/checkout`, {
        method: 'POST',
        body: JSON.stringify({
          seatsCount,
          attendeeNameAr: attendeeNameAr.trim() || user.fullName,
          attendeePhone: attendeePhone.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      if (res.free) {
        pushToast(`تم تأكيد حجزك المجاني بنجاح! كود التذكرة: ${res.ticketCode}`, 'success');
        const refreshed = await apiFetch<EventDetailData>(
          `/events/${encodeURIComponent(event.slug)}`,
        );
        setEvent(refreshed);
        return;
      }

      if (res.checkoutUrl) {
        pushToast('تم تجهيز فاتورة الحجز للدفع الإلكتروني', 'info');
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setError(err?.message || 'تعذر بدء عملية الدفع لحجز الفعالية حالياً');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Dark Midnight Banner Header */}
      <section className="relative overflow-hidden border-b border-[#22307A] bg-[#0B1440] py-10 sm:py-12">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                <Badge tone="info">{event.categoryLabelAr}</Badge>
                <Badge tone="purple">كورس أوفلاين • حضور فعلي</Badge>
              </div>

              <h1 className="text-2xl font-extrabold leading-tight text-[#EEF0FF] sm:text-4xl">
                {event.titleAr}
              </h1>

              {event.subtitleAr && (
                <p className="text-base leading-[1.7] text-[#A9B1E0]">
                  {event.subtitleAr}
                </p>
              )}

              <div className="grid gap-3 pt-2 sm:grid-cols-2 text-sm text-[#EEF0FF]">
                <div className="flex items-start gap-2.5 rounded-xl border border-[#22307A] bg-[#0F1A4A] p-3">
                  <Calendar className="h-5 w-5 shrink-0 text-[#8CA2FF]" />
                  <div>
                    <p className="text-xs font-bold text-[#A9B1E0]">الموعد والتوقيت</p>
                    <p className="font-extrabold mt-0.5">
                      {startFormatted}
                      {endFormatted ? ` — حتى ${endFormatted}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl border border-[#22307A] bg-[#0F1A4A] p-3">
                  <MapPin className="h-5 w-5 shrink-0 text-[#F5B94A]" />
                  <div>
                    <p className="text-xs font-bold text-[#A9B1E0]">المكان والعنوان</p>
                    <p className="font-extrabold mt-0.5">
                      {event.cityAr} — {event.venueNameAr}
                    </p>
                    <p className="text-xs text-[#A9B1E0] mt-0.5">{event.venueAddressAr}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-[#22307A] bg-[#0F1A4A]">
                <img
                  src={event.thumbnailUrl || '/images/brand/course-farm-management.webp'}
                  alt={event.titleAr}
                  className="aspect-[16/10] w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content + Booking Sidebar */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7 space-y-6">
            <Card className="p-6 space-y-3">
              <h2 className="text-xl font-extrabold text-[#EEF0FF]">
                تفاصيل الفعالية والبرنامج الميداني
              </h2>
              <p className="text-base leading-[1.8] text-[#A9B1E0] whitespace-pre-line">
                {event.descriptionAr}
              </p>
            </Card>

            {event.highlights?.length > 0 && (
              <Card className="p-6 space-y-4">
                <h2 className="text-xl font-extrabold text-[#EEF0FF]">
                  محاور التطبيق العملي والمخرجات
                </h2>
                <ul className="space-y-3">
                  {event.highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-[#EEF0FF]">
                      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[#77E2B5]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="p-6 space-y-3">
              <h2 className="text-lg font-extrabold text-[#EEF0FF]">المحاضر والجهة المنفذة</h2>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#8CA2FF]/30 bg-[#7C95FF]/15 text-[#8CA2FF]">
                  <Users className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-base font-extrabold text-[#EEF0FF]">{speakerName}</p>
                  {event.instructor?.headlineAr && (
                    <p className="text-xs sm:text-sm text-[#A9B1E0]">
                      {event.instructor.headlineAr}
                    </p>
                  )}
                </div>
              </div>
              {event.mapUrl && (
                <div className="pt-2">
                  <a
                    href={event.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#8CA2FF] hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    عرض الموقع على خرائط Google
                  </a>
                </div>
              )}
            </Card>
          </div>

          {/* Sticky Booking & Online Checkout Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <Card className="p-6 space-y-5 border-[#8CA2FF]/45 bg-[#0F1A4A]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#22307A] pb-4">
                <div>
                  <p className="text-xs font-bold text-[#8CA2FF]">سعر التذكرة المستقل</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[#EEF0FF]">
                      {event.priceCents === 0 ? 'مجاناً' : formatEgp(event.priceCents)}
                    </span>
                    <span className="text-xs font-bold text-[#A9B1E0]">/ للمقعد</span>
                    {event.compareAtPriceCents && event.compareAtPriceCents > event.priceCents && (
                      <span className="text-sm line-through text-[#A9B1E0]">
                        {formatEgp(event.compareAtPriceCents)}
                      </span>
                    )}
                  </div>
                </div>
                <Badge tone={event.remainingSeats > 0 ? 'success' : 'danger'}>
                  {event.remainingSeats > 0
                    ? `متاح ${event.remainingSeats} من ${event.capacity} مقعد`
                    : 'اكتمل العدد'}
                </Badge>
              </div>

              <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 text-xs sm:text-sm text-[#A9B1E0] flex items-center gap-2.5">
                <CreditCard className="h-5 w-5 shrink-0 text-[#8CA2FF]" />
                <span>
                  هذا الكورس الأوفلاين يُحجز بتذكرة مستقلة (منفصلة عن باقات العضوية الشهرية والسنوية) والدفع مؤمّن إلكترونياً.
                </span>
              </div>

              {event.myRegistration ? (
                <div className="rounded-2xl border border-[#77E2B5]/45 bg-[#0B1440] p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#77E2B5]">
                      <CheckCircle2 className="h-5 w-5" />
                      تم تأكيد حجزك في الفعالية!
                    </span>
                    {(() => {
                      const regMeta = getEventRegistrationStatusMeta(event.myRegistration.status);
                      return <Badge tone={regMeta.tone}>{regMeta.label}</Badge>;
                    })()}
                  </div>
                  <div className="space-y-1 text-sm text-[#A9B1E0]">
                    <p>
                      كود التذكرة:{' '}
                      <code dir="ltr" className="font-mono font-extrabold text-[#8CA2FF]">
                        {event.myRegistration.ticketCode}
                      </code>
                    </p>
                    <p>
                      الحاضر: <strong className="text-[#EEF0FF]">{event.myRegistration.attendeeNameAr}</strong>
                    </p>
                    <p>
                      المقاعد المحجوزة:{' '}
                      <strong className="text-[#EEF0FF]">{event.myRegistration.seatsCount}</strong> • المبلغ:{' '}
                      <strong className="text-[#EEF0FF]">
                        {formatEgp(event.myRegistration.amountCents)}
                      </strong>
                    </p>
                  </div>
                  <Link href="/student">
                    <Button variant="primary" className="w-full mt-2">
                      <Ticket className="h-4 w-4" />
                      عرض تذاكري في لوحة المتدرب
                    </Button>
                  </Link>
                </div>
              ) : !isBookable ? (
                <AlertBanner tone="warning">
                  {event.status === 'COMPLETED'
                    ? 'انتهى موعد هذه الفعالية التدريبية.'
                    : event.status === 'CANCELLED'
                      ? 'تم إلغاء هذه الفعالية من قبل إدارة المنصة.'
                      : 'عذراً، اكتمل العدد المتاح للمقاعد في هذه الفعالية.'}
                </AlertBanner>
              ) : (
                <form onSubmit={handleCheckout} className="space-y-4">
                  {error && (
                    <AlertBanner tone="danger">{error}</AlertBanner>
                  )}

                  <Field id="event-seats" label="عدد المقاعد المطلوبة" required>
                    <select
                      id="event-seats"
                      name="seatsCount"
                      className={inputClassName}
                      value={seatsCount}
                      onChange={(e) => setSeatsCount(Number(e.target.value))}
                    >
                      {Array.from({ length: maxOrderSeats }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n === 1 ? 'مقعد واحد (1)' : `${n} مقاعد`}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field id="event-attendee-name" label="الاسم الكامل على شهادة الحضور" required>
                    <input
                      id="event-attendee-name"
                      name="attendeeNameAr"
                      type="text"
                      required
                      autoComplete="name"
                      className={inputClassName}
                      value={attendeeNameAr}
                      onChange={(e) => setAttendeeNameAr(e.target.value)}
                      placeholder="مثال: د. كريم طارق"
                    />
                  </Field>

                  <Field id="event-attendee-phone" label="رقم الهاتف للتواصل قبل الموعد">
                    <input
                      id="event-attendee-phone"
                      name="attendeePhone"
                      type="tel"
                      dir="ltr"
                      autoComplete="tel"
                      className={inputClassName}
                      value={attendeePhone}
                      onChange={(e) => setAttendeePhone(e.target.value)}
                      placeholder="01001234567"
                    />
                  </Field>

                  <Field id="event-notes" label="ملاحظات إضافية (اختياري)">
                    <textarea
                      id="event-notes"
                      name="notes"
                      rows={2}
                      className={textareaClassName}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="مثال: تخصص الدواجن / جهة العمل..."
                    />
                  </Field>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={busy}
                  >
                    {busy
                      ? 'جاري التحويل لبوابة الدفع الإلكتروني...'
                      : !user
                        ? `سجّل الدخول لحجز مقعدك (${formatEgp(totalAmountCents)})`
                        : totalAmountCents === 0
                          ? 'تأكيد الحجز المجاني الآن'
                          : `احجز الآن وادفع إلكترونياً (${formatEgp(totalAmountCents)})`}
                    <ArrowLeft className="h-4 w-4" />
                  </Button>

                  <p className="text-center text-xs flex items-center justify-center gap-1.5 text-[#A9B1E0]">
                    <ShieldCheck className="h-4 w-4 text-[#8CA2FF]" />
                    تصدر التذكرة برمز حجز فريد فور تأكيد السداد الإلكتروني
                  </p>
                </form>
              )}
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
