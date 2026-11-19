'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import { slugifyTitle } from '@bosla/shared';
import { apiFetch, formatEgp } from '@/lib/api';
import { downloadCsv } from '@/lib/csv-export';
import {
  COVER_IMAGE_PRESETS,
  getEventRegistrationStatusMeta,
  getOfflineEventStatusMeta,
  getPaymentStatusMeta,
} from '@/lib/labels';
import { useAuth } from '@/lib/auth-context';
import { ImageUploadField } from '@/components/media/ImageUploadField';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
  textareaClassName,
} from '@/components/ui/primitives';

function toLocalDateTimeInput(value?: string | Date | null): string {
  if (!value) {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminOfflineEventsPanel({
  events,
  users,
  onReload,
}: {
  events: any[];
  users: any[];
  onReload: () => Promise<void>;
}) {
  const { pushToast } = useAuth();
  const [search, setSearch] = useState('');
  const [editorMode, setEditorMode] = useState<'list' | 'form' | 'registrations'>('list');
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form fields
  const [titleAr, setTitleAr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [subtitleAr, setSubtitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState(COVER_IMAGE_PRESETS[0]?.url || '');
  const [categoryLabelAr, setCategoryLabelAr] = useState('تدريب ميداني');
  const [cityAr, setCityAr] = useState('القاهرة');
  const [venueNameAr, setVenueNameAr] = useState('');
  const [venueAddressAr, setVenueAddressAr] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [startsAt, setStartsAt] = useState(toLocalDateTimeInput(null));
  const [endsAt, setEndsAt] = useState('');
  const [priceEgp, setPriceEgp] = useState('850');
  const [compareAtEgp, setCompareAtEgp] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'>('PUBLISHED');
  const [highlightsText, setHighlightsText] = useState('');
  const [speakerNameAr, setSpeakerNameAr] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [featuredOrder, setFeaturedOrder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registrations roster state
  const [rosterEvent, setRosterEvent] = useState<any | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const instructors = useMemo(
    () => users.filter((u) => u.role === 'INSTRUCTOR' || u.role === 'ADMIN'),
    [users],
  );

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (ev) =>
        (ev.titleAr || '').toLowerCase().includes(q) ||
        (ev.cityAr || '').toLowerCase().includes(q) ||
        (ev.venueNameAr || '').toLowerCase().includes(q) ||
        (ev.slug || '').toLowerCase().includes(q),
    );
  }, [events, search]);

  const totalBooked = events.reduce((sum, ev) => sum + Number(ev.seatsBooked || 0), 0);
  const totalEventRevenueCents = events.reduce(
    (sum, ev) => sum + Number(ev.paidRevenueCents || 0),
    0,
  );
  const publishedCount = events.filter((e) => e.status === 'PUBLISHED').length;

  const openCreateForm = () => {
    setEditingEvent(null);
    setTitleAr('');
    setSlug('');
    setSlugManual(false);
    setSubtitleAr('');
    setDescriptionAr('');
    setThumbnailUrl(COVER_IMAGE_PRESETS[0]?.url || '');
    setCategoryLabelAr('تدريب ميداني');
    setCityAr('القاهرة');
    setVenueNameAr('');
    setVenueAddressAr('');
    setMapUrl('');
    setStartsAt(toLocalDateTimeInput(null));
    setEndsAt('');
    setPriceEgp('850');
    setCompareAtEgp('');
    setCapacity('30');
    setStatus('PUBLISHED');
    setHighlightsText('');
    setSpeakerNameAr('');
    setInstructorId('');
    setFeaturedOrder('');
    setError(null);
    setEditorMode('form');
  };

  const openEditForm = (ev: any) => {
    setEditingEvent(ev);
    setTitleAr(ev.titleAr || '');
    setSlug(ev.slug || '');
    setSlugManual(true);
    setSubtitleAr(ev.subtitleAr || '');
    setDescriptionAr(ev.descriptionAr || '');
    setThumbnailUrl(ev.thumbnailUrl || COVER_IMAGE_PRESETS[0]?.url || '');
    setCategoryLabelAr(ev.categoryLabelAr || 'تدريب ميداني');
    setCityAr(ev.cityAr || '');
    setVenueNameAr(ev.venueNameAr || '');
    setVenueAddressAr(ev.venueAddressAr || '');
    setMapUrl(ev.mapUrl || '');
    setStartsAt(toLocalDateTimeInput(ev.startsAt));
    setEndsAt(ev.endsAt ? toLocalDateTimeInput(ev.endsAt) : '');
    setPriceEgp(String(Math.round(Number(ev.priceCents || 0) / 100)));
    setCompareAtEgp(
      ev.compareAtPriceCents ? String(Math.round(Number(ev.compareAtPriceCents) / 100)) : '',
    );
    setCapacity(String(ev.capacity || 30));
    setStatus(ev.status || 'DRAFT');
    setHighlightsText(Array.isArray(ev.highlights) ? ev.highlights.join('\n') : '');
    setSpeakerNameAr(ev.speakerNameAr || '');
    setInstructorId(ev.instructorId || '');
    setFeaturedOrder(
      ev.featuredOrder !== null && ev.featuredOrder !== undefined ? String(ev.featuredOrder) : '',
    );
    setError(null);
    setEditorMode('form');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const priceNum = Number(priceEgp);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        throw new Error('أدخل سعراً صحيحاً بالجنيه المصري');
      }
      const compareNum = compareAtEgp.trim() ? Number(compareAtEgp) : null;
      const safeSlug =
        slug.trim() ||
        `${slugifyTitle(titleAr) || 'offline-event'}-${Date.now().toString().slice(-4)}`;

      const payload = {
        slug: safeSlug,
        titleAr: titleAr.trim(),
        subtitleAr: subtitleAr.trim() || null,
        descriptionAr: descriptionAr.trim(),
        thumbnailUrl: thumbnailUrl.trim() || null,
        categoryLabelAr: categoryLabelAr.trim() || 'ورشة تطبيقية',
        cityAr: cityAr.trim(),
        venueNameAr: venueNameAr.trim(),
        venueAddressAr: venueAddressAr.trim(),
        mapUrl: mapUrl.trim() || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt.trim() ? new Date(endsAt).toISOString() : null,
        priceCents: Math.round(priceNum * 100),
        compareAtPriceCents: compareNum !== null && !Number.isNaN(compareNum) ? Math.round(compareNum * 100) : null,
        capacity: Number(capacity) || 30,
        status,
        highlights: highlightsText
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length >= 2),
        speakerNameAr: speakerNameAr.trim() || null,
        instructorId: instructorId.trim() || null,
        featuredOrder: featuredOrder.trim() ? Number(featuredOrder) : null,
      };

      if (editingEvent) {
        await apiFetch(`/admin/events/${editingEvent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        pushToast('تم تحديث بيانات وسعر الفعالية الأوفلاين بنجاح', 'success');
      } else {
        await apiFetch('/admin/events', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        pushToast('تم إنشاء الفعالية الأوفلاين وتفعيل سعرها المستقل والحجز الإلكتروني!', 'success');
      }
      setEditorMode('list');
      setEditingEvent(null);
      await onReload();
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ الفعالية');
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (eventId: string, nextStatus: string) => {
    try {
      await apiFetch(`/admin/events/${eventId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: nextStatus }),
      });
      pushToast('تم تحديث حالة الفعالية بنجاح', 'success');
      await onReload();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث الحالة', 'error');
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await apiFetch(`/admin/events/${eventId}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      pushToast('تم حذف الفعالية بنجاح', 'success');
      await onReload();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف الفعالية', 'error');
    }
  };

  const openRoster = async (ev: any) => {
    setRosterEvent(ev);
    setEditorMode('registrations');
    setLoadingRoster(true);
    try {
      const res = await apiFetch<{ event: any; registrations: any[] }>(
        `/admin/events/${ev.id}/registrations`,
      );
      setRegistrations(res.registrations ?? []);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل سجل الحجوزات', 'error');
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleRegistrationStatus = async (regId: string, nextStatus: string) => {
    try {
      await apiFetch(`/admin/events/registrations/${regId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      pushToast('تم تحديث حالة التذكرة بنجاح', 'success');
      if (rosterEvent) await openRoster(rosterEvent);
      await onReload();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة الحجز', 'error');
    }
  };

  if (editorMode === 'form') {
    return (
      <Card className="p-6 space-y-6 border-[#8CA2FF]/45">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22307A] pb-4">
          <div>
            <Badge tone="purple">إدارة حصرية لمدير المنصة</Badge>
            <h2 className="mt-1.5 text-xl font-extrabold text-[#EEF0FF]">
              {editingEvent ? `تعديل الفعالية: ${editingEvent.titleAr}` : 'إنشاء فعالية / كورس أوفلاين جديد'}
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B1E0]">
              يتم تسعير الفعالية بشكل مستقل ويُتاح السداد إلكترونياً عبر البطاقة أو المحفظة.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditorMode('list')}>
            <ArrowRight className="h-4 w-4" />
            العودة لقائمة الفعاليات
          </Button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          <div className="grid gap-4 md:grid-cols-2">
            <Field id="ev-title" label="عنوان الفعالية / الكورس الأوفلاين" required>
              <input
                id="ev-title"
                className={inputClassName}
                required
                value={titleAr}
                onChange={(e) => {
                  const val = e.target.value;
                  setTitleAr(val);
                  if (!slugManual) {
                    setSlug(slugifyTitle(val));
                  }
                }}
                placeholder="مثال: معسكر إدارة عنابر التسمين — القاهرة"
              />
            </Field>

            <Field id="ev-slug" label="الرابط المختصر (Slug بالإنجليزية)" required>
              <input
                id="ev-slug"
                dir="ltr"
                className={inputClassName}
                required
                value={slug}
                onChange={(e) => {
                  setSlugManual(true);
                  setSlug(e.target.value);
                }}
                placeholder="poultry-bootcamp-cairo"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field id="ev-subtitle" label="عنوان فرعي مختصر (اختياري)">
              <input
                id="ev-subtitle"
                className={inputClassName}
                value={subtitleAr}
                onChange={(e) => setSubtitleAr(e.target.value)}
                placeholder="ورشة تطبيقية داخل المزرعة + شهادة حضور معتمدة"
              />
            </Field>

            <Field id="ev-category" label="نوع الفعالية">
              <input
                id="ev-category"
                className={inputClassName}
                value={categoryLabelAr}
                onChange={(e) => setCategoryLabelAr(e.target.value)}
                placeholder="تدريب ميداني / ورشة معملية / ملتقى"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ev-price-egp" label="سعر التذكرة المستقل (بالجنيه المصري)" required>
              <input
                id="ev-price-egp"
                dir="ltr"
                type="number"
                min={0}
                className={inputClassName}
                required
                value={priceEgp}
                onChange={(e) => setPriceEgp(e.target.value)}
              />
            </Field>

            <Field id="ev-compare-egp" label="السعر قبل الخصم (اختياري)">
              <input
                id="ev-compare-egp"
                dir="ltr"
                type="number"
                min={0}
                className={inputClassName}
                value={compareAtEgp}
                onChange={(e) => setCompareAtEgp(e.target.value)}
                placeholder="مثال: 1500"
              />
            </Field>

            <Field id="ev-capacity" label="السعة الاستيعابية (عدد المقاعد)" required>
              <input
                id="ev-capacity"
                dir="ltr"
                type="number"
                min={1}
                className={inputClassName}
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ev-city" label="المدينة / المحافظة" required>
              <input
                id="ev-city"
                className={inputClassName}
                required
                value={cityAr}
                onChange={(e) => setCityAr(e.target.value)}
                placeholder="القاهرة / الجيزة / الإسكندرية"
              />
            </Field>

            <Field id="ev-venue" label="اسم المكان / القاعة / المزرعة" required>
              <input
                id="ev-venue"
                className={inputClassName}
                required
                value={venueNameAr}
                onChange={(e) => setVenueNameAr(e.target.value)}
                placeholder="فندق تريومف / مزرعة العاشر"
              />
            </Field>

            <Field id="ev-address" label="العنوان التفصيلي" required>
              <input
                id="ev-address"
                className={inputClassName}
                required
                value={venueAddressAr}
                onChange={(e) => setVenueAddressAr(e.target.value)}
                placeholder="شارع ... متفرع من ..."
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ev-starts-at" label="تاريخ ووقت البدء" required>
              <input
                id="ev-starts-at"
                dir="ltr"
                type="datetime-local"
                className={inputClassName}
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </Field>

            <Field id="ev-ends-at" label="وقت الانتهاء (اختياري)">
              <input
                id="ev-ends-at"
                dir="ltr"
                type="datetime-local"
                className={inputClassName}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </Field>

            <Field id="ev-status" label="حالة النشر والحجز">
              <select
                id="ev-status"
                className={inputClassName}
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="PUBLISHED">منشورة ومتاحة للحجز الإلكتروني</option>
                <option value="DRAFT">مسودة إدارية (مخفية)</option>
                <option value="COMPLETED">منتهية</option>
                <option value="CANCELLED">ملغاة</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ev-speaker" label="اسم المحاضر الرئيسي">
              <input
                id="ev-speaker"
                className={inputClassName}
                value={speakerNameAr}
                onChange={(e) => setSpeakerNameAr(e.target.value)}
                placeholder="مثال: د. أحمد فوزي الشرقاوي"
              />
            </Field>

            <Field id="ev-instructor-id" label="ربط بملف مدرب مسجل (اختياري)">
              <select
                id="ev-instructor-id"
                className={inputClassName}
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
              >
                <option value="">— بدون ربط —</option>
                {instructors.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.fullName}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="ev-map-url" label="رابط خرائط Google (اختياري)">
              <input
                id="ev-map-url"
                dir="ltr"
                type="url"
                className={inputClassName}
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </Field>
          </div>

          <Field id="ev-description" label="الوصف الكامل والبرنامج التدريبي" required>
            <textarea
              id="ev-description"
              rows={4}
              className={textareaClassName}
              required
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              placeholder="اشرح تفاصيل اليوم التدريبي الأوفلاين والفئة المستهدفة وما يشمله السعر..."
            />
          </Field>

          <Field id="ev-highlights" label="محاور التطبيق العملي (نقطة واحدة في كل سطر)">
            <textarea
              id="ev-highlights"
              rows={3}
              className={textareaClassName}
              value={highlightsText}
              onChange={(e) => setHighlightsText(e.target.value)}
              placeholder="تطبيق عملي على أجهزة قياس جودة الهواء\nملفات تشغيل متكاملة وشهادة حضور"
            />
          </Field>

          <ImageUploadField
            inputId="ev-image-file"
            urlInputId="ev-thumb"
            label="صورة غلاف الفعالية الأوفلاين (رفع مباشر من جهازك)"
            value={thumbnailUrl}
            onChange={setThumbnailUrl}
            presets={COVER_IMAGE_PRESETS}
          />

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#22307A] pt-4">
            <Button type="button" variant="outline" onClick={() => setEditorMode('list')}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              <CheckCircle2 className="h-4 w-4" />
              {busy
                ? 'جاري الحفظ...'
                : editingEvent
                  ? 'حفظ تعديلات الفعالية'
                  : 'إنشاء وتفعيل الحجز الإلكتروني'}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  if (editorMode === 'registrations' && rosterEvent) {
    return (
      <Card className="p-6 space-y-5 border-[#8CA2FF]/45">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22307A] pb-4">
          <div>
            <Badge tone="info">سجل التذاكر والحضور</Badge>
            <h2 className="mt-1.5 text-xl font-extrabold text-[#EEF0FF]">
              المسجلون في: {rosterEvent.titleAr}
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B1E0]">
              السعر: {formatEgp(rosterEvent.priceCents)} • المقاعد المؤكدة:{' '}
              {rosterEvent.seatsBooked} من {rosterEvent.capacity}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `bosla-event-${rosterEvent.slug}-attendees`,
                  ['كود التذكرة', 'الاسم', 'الهاتف', 'المقاعد', 'المبلغ (ج.م)', 'حالة الحجز', 'مرجع الدفع'],
                  registrations.map((r) => [
                    r.ticketCode,
                    r.attendeeNameAr,
                    r.attendeePhoneE164 || r.user?.phoneE164 || '',
                    String(r.seatsCount),
                    (r.amountCents / 100).toFixed(2),
                    r.status,
                    r.paymentTransaction?.merchantOrderId || '',
                  ]),
                )
              }
            >
              <Download className="h-4 w-4" />
              تصدير المشاركين CSV
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditorMode('list')}>
              <ArrowRight className="h-4 w-4" />
              العودة للفعاليات
            </Button>
          </div>
        </div>

        {loadingRoster ? (
          <p className="py-8 text-center text-sm text-[#A9B1E0]">جاري تحميل قائمة الحجوزات...</p>
        ) : registrations.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#A9B1E0]">
            لا توجد حجوزات مسجلة لهذه الفعالية بعد.
          </p>
        ) : (
          <div className="space-y-3">
            {registrations.map((reg) => {
              const rMeta = getEventRegistrationStatusMeta(reg.status);
              const pMeta = reg.paymentTransaction
                ? getPaymentStatusMeta(reg.paymentTransaction.status)
                : null;
              return (
                <div
                  key={reg.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-4 text-xs sm:text-sm"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code dir="ltr" className="font-mono font-extrabold text-[#8CA2FF]">
                        {reg.ticketCode}
                      </code>
                      <span className="font-extrabold text-[#EEF0FF]">{reg.attendeeNameAr}</span>
                      <Badge tone={rMeta.tone}>{rMeta.label}</Badge>
                      {pMeta && (
                        <Badge tone={pMeta.tone}>السداد: {pMeta.label}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#A9B1E0]">
                      <span dir="ltr">{reg.attendeePhoneE164 || reg.user?.phoneE164 || '—'}</span> •{' '}
                      {reg.seatsCount} مقعد • الإجمالي: {formatEgp(reg.amountCents)}
                      {reg.paymentTransaction?.merchantOrderId && (
                        <>
                          {' '}
                          • الطلب: <code dir="ltr">{reg.paymentTransaction.merchantOrderId}</code>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {reg.status !== 'ATTENDED' && (
                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        onClick={() => void handleRegistrationStatus(reg.id, 'ATTENDED')}
                      >
                        تسجيل حضور
                      </Button>
                    )}
                    {reg.status !== 'CANCELLED' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRegistrationStatus(reg.id, 'CANCELLED')}
                      >
                        إلغاء الحجز
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#EEF0FF]">
            الفعاليات والكورسات الأوفلاين ({events.length})
          </h2>
          <p className="text-sm text-[#A9B1E0] mt-0.5">
            صلاحية الإنشاء والتسعير وإدارة المقاعد مخصصة لمدير المنصة فقط، مع السداد الإلكتروني.
          </p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          إضافة فعالية أو كورس أوفلاين
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#8CA2FF]/30 bg-[#7C95FF]/15 text-[#8CA2FF]">
            <Calendar className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-[#A9B1E0]">الفعاليات المنشورة للحجز</p>
            <p className="text-xl font-extrabold text-[#EEF0FF]">{publishedCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#F5B94A]/30 bg-[#F5B94A]/15 text-[#F5B94A]">
            <Ticket className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-[#A9B1E0]">المقاعد المحجوزة والمؤكدة</p>
            <p className="text-xl font-extrabold text-[#EEF0FF]">{totalBooked}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#77E2B5]/30 bg-[#77E2B5]/15 text-[#77E2B5]">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-[#A9B1E0]">إيرادات الفعاليات الإلكترونية</p>
            <p className="text-xl font-extrabold text-[#77E2B5]">{formatEgp(totalEventRevenueCents)}</p>
          </div>
        </Card>
      </div>

      <div className="relative max-w-md">
        <label htmlFor="admin-events-search" className="visually-hidden">
          ابحث في الفعاليات الأوفلاين
        </label>
        <input
          id="admin-events-search"
          type="search"
          className={`${inputClassName} ps-9`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بعنوان الفعالية أو المدينة أو المكان..."
        />
        <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-[#A9B1E0]" />
      </div>

      {filteredEvents.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-base font-extrabold text-[#EEF0FF]">لا توجد فعاليات أوفلاين حالياً</p>
          <p className="text-sm text-[#A9B1E0]">
            ابدأ بإنشاء أول ورشة أو معسكر أوفلاين مع تحديد السعر المستقل وتفعيل الحجز والدفع الإلكتروني.
          </p>
          <div className="flex justify-center">
            <Button type="button" variant="primary" onClick={openCreateForm}>
              <Plus className="h-4 w-4" />
              إضافة أول فعالية أوفلاين
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredEvents.map((ev) => {
            const st = getOfflineEventStatusMeta(ev.status);
            return (
              <Card key={ev.id} className="p-5 space-y-4 bosla-card-hover">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <img
                      src={ev.thumbnailUrl || '/images/brand/course-farm-management.webp'}
                      alt={ev.titleAr}
                      className="h-16 w-24 shrink-0 rounded-xl object-cover border border-[#22307A] bg-[#0B1440]"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <Badge tone="purple">{ev.categoryLabelAr}</Badge>
                      </div>
                      <h3 className="text-base font-extrabold text-[#EEF0FF] line-clamp-2">
                        {ev.titleAr}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs">
                  <div>
                    <p className="text-[#A9B1E0]">السعر المستقل</p>
                    <p className="font-extrabold text-[#F5B94A] text-sm mt-0.5">
                      {ev.priceCents === 0 ? 'مجاناً' : formatEgp(ev.priceCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#A9B1E0]">المقاعد المحجوزة</p>
                    <p className="font-extrabold text-[#8CA2FF] text-sm mt-0.5">
                      {ev.seatsBooked} / {ev.capacity}
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 text-[#A9B1E0]">
                    <MapPin className="h-3.5 w-3.5 text-[#8CA2FF]" />
                    <span>
                      {ev.cityAr} — {ev.venueNameAr}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 text-[#A9B1E0]">
                    <Calendar className="h-3.5 w-3.5 text-[#8CA2FF]" />
                    <span>
                      {new Date(ev.startsAt).toLocaleString('ar-EG', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEditForm(ev)}>
                    <Edit3 className="h-3.5 w-3.5" />
                    تعديل
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void openRoster(ev)}>
                    <Users className="h-3.5 w-3.5" />
                    الحجوزات ({ev._count?.registrations ?? 0})
                  </Button>
                  {ev.status !== 'PUBLISHED' ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => void handleStatusChange(ev.id, 'PUBLISHED')}
                    >
                      نشر للحجز
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleStatusChange(ev.id, 'DRAFT')}
                    >
                      تحويل لمسودة
                    </Button>
                  )}
                  <Link href={`/events/${ev.slug}`} target="_blank">
                    <Button type="button" variant="ghost" size="sm">
                      <ExternalLink className="h-3.5 w-3.5" />
                      معاينة
                    </Button>
                  </Link>
                  {confirmDeleteId === ev.id ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDelete(ev.id)}
                      >
                        تأكيد الحذف
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        تراجع
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteId(ev.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#FF9CAA]" />
                      حذف
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
