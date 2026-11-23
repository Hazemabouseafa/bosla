'use client';

import React, { useState } from 'react';
import { Building2, CheckCircle2, Handshake, Send } from 'lucide-react';
import { PARTNER_INTEREST_TYPES, partnerApplicationSchema } from '@bosla/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const PARTNER_INTEREST_OPTIONS: Array<{
  value: (typeof PARTNER_INTEREST_TYPES)[number];
  label: string;
}> = [
  { value: 'CORPORATE_TRAINING', label: 'تأهيل وتدريب فرق الشركة والمزارع' },
  { value: 'CURRICULUM_SPONSORSHIP', label: 'رعاية كورس أو برنامج تخصصي' },
  { value: 'FIELD_INTERNSHIP', label: 'استضافة وتدريب ميداني للخريجين' },
  { value: 'EVENT_PARTNERSHIP', label: 'شراكة فعاليات وملتقيات علمية' },
  { value: 'RESEARCH_COOP', label: 'تعاون تقني وبحثي مشترك' },
];

export function BoslaPartnerApplySection() {
  const { pushToast } = useAuth();

  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [partnershipInterest, setPartnershipInterest] =
    useState<(typeof PARTNER_INTEREST_TYPES)[number]>('CORPORATE_TRAINING');
  const [notes, setNotes] = useState('');
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsed = partnerApplicationSchema.safeParse({
      fullName,
      organizationName,
      phoneNumber: phoneNumber.trim() || undefined,
      email: email.trim() || undefined,
      partnershipInterest,
      notes: notes.trim() || undefined,
      website: websiteHoneypot,
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMsg(firstIssue?.message || 'يرجى التحقق من البيانات المدخلة');
      return;
    }

    setBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; messageAr?: string }>(
        '/catalog/partner-applications',
        {
          method: 'POST',
          skipCsrf: true,
          body: JSON.stringify({
            fullName: fullName.trim(),
            organizationName: organizationName.trim(),
            phoneNumber: phoneNumber.trim() || undefined,
            countryCode: '+20',
            email: email.trim() || undefined,
            partnershipInterest,
            notes: notes.trim() || undefined,
            website: websiteHoneypot,
          }),
        },
      );
      if (!res?.ok) {
        throw new Error('تعذر تسجيل الطلب على الخادم');
      }
      const msg =
        res.messageAr || 'تم استلام طلب الشراكة بنجاح وسيتم مراجعته من إدارة أكاديمية بوصلة';
      setSuccessMsg(msg);
      setFullName('');
      setOrganizationName('');
      setPhoneNumber('');
      setEmail('');
      setNotes('');
      setWebsiteHoneypot('');
      pushToast(msg, 'success');
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'تعذر إرسال طلب الشراكة حالياً، يرجى المحاولة لاحقاً';
      setErrorMsg(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="partner-apply"
      className="relative border-t border-[#22307A] bg-[#070D2B]"
      style={{ padding: 'clamp(72px, 10vw, 118px) clamp(18px, 4vw, 36px)' }}
      aria-labelledby="partner-apply-heading"
    >
      <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-12 items-start">
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#C084FC]">
              <Handshake className="h-4 w-4 text-[#C084FC]" strokeWidth={1.6} aria-hidden="true" />
              <span>التعاون المؤسسي والرعاية</span>
            </span>
            <h2
              id="partner-apply-heading"
              className="text-[clamp(1.75rem,3vw,2.65rem)] font-bold leading-[1.3] text-[#EEF0FF] bosla-display-font"
            >
              انضم كشريك
            </h2>
            <p className="text-sm sm:text-base leading-[1.8] text-[#C2CAF2]">
              نرحب بشراكات شركات الأدوية البيطرية ومصانع الأعلاف ومزارع الإنتاج الحيواني والداجني
              لبناء برامج تأهيل متخصصة، رعاية مسارات تطبيقية، أو تنسيق فرص تدريب ميداني للخريجين.
            </p>
          </div>

          <ul className="space-y-3 border-t border-[#22307A] pt-5 text-sm text-[#C2CAF2]">
            <li className="flex items-start gap-2.5">
              <span
                className="mt-2 h-1.5 w-1.5 rounded-full bg-[#C084FC] shrink-0"
                aria-hidden="true"
              />
              <span>برامج تأهيل فني وتجاري مخصصة لفرق البيطريين ومهندسي الإنتاج والمبيعات</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="mt-2 h-1.5 w-1.5 rounded-full bg-[#C084FC] shrink-0"
                aria-hidden="true"
              />
              <span>رعاية محتوى تطبيقي أو ورش عمل أوفلاين متخصصة في القطاع</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="mt-2 h-1.5 w-1.5 rounded-full bg-[#C084FC] shrink-0"
                aria-hidden="true"
              />
              <span>ربط الكوادر المؤهلة بفرص التدريب العملي داخل منشآت الشركاء</span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#22307A] bg-[#0B1440]/92 p-6 sm:p-8 space-y-5"
            noValidate={false}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#22307A] pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#EEF0FF] bosla-display-font">
                  تقديم طلب شراكة
                </h3>
                <p className="text-xs sm:text-sm text-[#A9B1E0] mt-0.5">
                  أدخل بيانات المسؤول والمؤسسة ومجال التعاون المطلوب
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#C084FC]/30 bg-[#6B21A8]/20 text-[#C084FC] shrink-0">
                <Building2 className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
              </span>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-lg border border-[#FF9CAA]/45 bg-[#FF9CAA]/10 px-4 py-3 text-sm font-semibold text-[#FF9CAA]"
              >
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-lg border border-[#77E2B5]/45 bg-[#77E2B5]/10 px-4 py-3 text-sm font-semibold text-[#77E2B5]"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Honeypot input hidden cleanly from real users & screen readers */}
            <div className="visually-hidden" aria-hidden="true">
              <label htmlFor="partner-website-trap">الموقع الإلكتروني</label>
              <input
                id="partner-website-trap"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={websiteHoneypot}
                onChange={(e) => setWebsiteHoneypot(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="partner-full-name" className="block text-sm font-semibold text-[#EEF0FF]">
                  الاسم الكامل *
                </label>
                <input
                  id="partner-full-name"
                  type="text"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="الاسم الثلاثي"
                  className="w-full min-h-[46px] rounded-lg border border-[#22307A] bg-[#050A24] px-3.5 text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="partner-org-name" className="block text-sm font-semibold text-[#EEF0FF]">
                  اسم الشركة أو المؤسسة *
                </label>
                <input
                  id="partner-org-name"
                  type="text"
                  required
                  minLength={2}
                  autoComplete="organization"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="اسم الشركة، المزرعة، أو المعمل"
                  className="w-full min-h-[46px] rounded-lg border border-[#22307A] bg-[#050A24] px-3.5 text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="partner-phone" className="block text-sm font-semibold text-[#EEF0FF]">
                  رقم الهاتف (أو أدخل البريد)
                </label>
                <input
                  id="partner-phone"
                  type="tel"
                  dir="ltr"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="01001234567"
                  className="w-full min-h-[46px] rounded-lg border border-[#22307A] bg-[#050A24] px-3.5 text-end text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="partner-email" className="block text-sm font-semibold text-[#EEF0FF]">
                  البريد الإلكتروني الرسمي
                </label>
                <input
                  id="partner-email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partnerships@company.com"
                  className="w-full min-h-[46px] rounded-lg border border-[#22307A] bg-[#050A24] px-3.5 text-end text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="partner-interest" className="block text-sm font-semibold text-[#EEF0FF]">
                مجال الشراكة المطلوب *
              </label>
              <select
                id="partner-interest"
                value={partnershipInterest}
                onChange={(e) =>
                  setPartnershipInterest(e.target.value as (typeof PARTNER_INTEREST_TYPES)[number])
                }
                className="w-full min-h-[46px] rounded-lg border border-[#22307A] bg-[#050A24] px-3.5 text-sm text-[#EEF0FF] focus:border-[#C084FC] focus:outline-none"
              >
                {PARTNER_INTEREST_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="partner-notes" className="block text-sm font-semibold text-[#EEF0FF]">
                نبذة أو تفاصيل إضافية (اختياري)
              </label>
              <textarea
                id="partner-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="حجم الفريق المستهدف، القطاع، أو المقترح المبدئي للتعاون"
                className="w-full min-h-[96px] rounded-lg border border-[#22307A] bg-[#050A24] p-3.5 text-sm text-[#EEF0FF] placeholder:text-[#8E9BD2] focus:border-[#C084FC] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-[#6B21A8] px-7 text-sm font-bold text-white transition-colors hover:bg-[#7E22CE] active:bg-[#581C87] disabled:opacity-60 cursor-pointer"
            >
              <Send className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.6} aria-hidden="true" />
              <span>{busy ? 'جاري إرسال طلب الشراكة...' : 'إرسال طلب الشراكة'}</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
