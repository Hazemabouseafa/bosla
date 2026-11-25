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

export function BoslaPartnerApplySection({
  titleAr = 'انضم كشريك',
  subtitleAr = 'نرحب بشراكات شركات الأدوية البيطرية ومصانع الأعلاف ومزارع الإنتاج الحيواني والداجني لبناء برامج تأهيل متخصصة، رعاية مسارات تطبيقية، أو تنسيق فرص تدريب ميداني للخريجين.',
}: {
  titleAr?: string;
  subtitleAr?: string;
}) {
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
      className="relative border-t border-[#4A1FB0]/18 bg-[#ADD5F0] py-16 sm:py-20 text-[#17243D]"
      aria-labelledby="partner-apply-heading"
    >
      <div className="mx-auto grid max-w-[1320px] px-4 sm:px-8 gap-10 lg:grid-cols-12 items-start">
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#351078]">
              <Handshake className="h-4 w-4 text-[#4A1FB0]" strokeWidth={1.8} aria-hidden="true" />
              <span>التعاون المؤسسي والرعاية</span>
            </div>
            <h2
              id="partner-apply-heading"
              className="text-[clamp(1.8rem,3.1vw,2.6rem)] font-black leading-[1.28] text-[#17243D] bosla-display-font"
            >
              {titleAr}
            </h2>
            <p className="text-sm sm:text-base leading-[1.8] font-medium text-[#263959]">
              {subtitleAr}
            </p>
          </div>

          <ul className="space-y-3 border-t border-[#17243D]/14 pt-5 text-sm font-bold text-[#17243D]">
            <li className="flex items-start gap-2.5">
              <span className="mt-2 h-2 w-2 rounded-full bg-[#4A1FB0] shrink-0" aria-hidden="true" />
              <span>برامج تأهيل فني وتجاري مخصصة لفرق البيطريين ومهندسي الإنتاج والمبيعات</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-2 h-2 w-2 rounded-full bg-[#4A1FB0] shrink-0" aria-hidden="true" />
              <span>رعاية محتوى تطبيقي أو ورش عمل أوفلاين متخصصة في القطاع</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-2 h-2 w-2 rounded-full bg-[#4A1FB0] shrink-0" aria-hidden="true" />
              <span>ربط الكوادر المؤهلة بفرص التدريب العملي داخل منشآت الشركاء</span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border-2 border-[#4A1FB0]/28 bg-[#C6E2F5] p-6 sm:p-8 space-y-5 shadow-[0_20px_44px_-28px_rgba(21,35,68,0.25)]"
            noValidate={false}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#17243D]/12 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#17243D] bosla-display-font">
                  تقديم طلب شراكة
                </h3>
                <p className="text-xs sm:text-sm font-medium text-[#263959] mt-0.5">
                  أدخل بيانات المسؤول والمؤسسة ومجال التعاون المطلوب
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#4A1FB0] text-white shrink-0">
                <Building2 className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-[#BE123C]/40 bg-[#FFF1F2] px-4 py-3 text-sm font-bold text-[#BE123C]"
              >
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-xl border border-[#0F5C4E]/35 bg-[#F0FDFA] px-4 py-3 text-sm font-bold text-[#0F5C4E]"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{successMsg}</span>
              </div>
            )}

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
                <label htmlFor="partner-full-name" className="block text-sm font-extrabold text-[#17243D]">
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
                  className="w-full min-h-[46px] rounded-xl border border-[#4A1FB0]/25 bg-[#FFFFFF] px-3.5 text-sm text-[#17243D] placeholder:text-[#64748B] focus:border-[#4A1FB0] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="partner-org-name" className="block text-sm font-extrabold text-[#17243D]">
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
                  className="w-full min-h-[46px] rounded-xl border border-[#4A1FB0]/25 bg-[#FFFFFF] px-3.5 text-sm text-[#17243D] placeholder:text-[#64748B] focus:border-[#4A1FB0] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="partner-phone" className="block text-sm font-extrabold text-[#17243D]">
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
                  className="w-full min-h-[46px] rounded-xl border border-[#4A1FB0]/25 bg-[#FFFFFF] px-3.5 text-end text-sm text-[#17243D] placeholder:text-[#64748B] focus:border-[#4A1FB0] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="partner-email" className="block text-sm font-extrabold text-[#17243D]">
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
                  className="w-full min-h-[46px] rounded-xl border border-[#4A1FB0]/25 bg-[#FFFFFF] px-3.5 text-end text-sm text-[#17243D] placeholder:text-[#64748B] focus:border-[#4A1FB0] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="partner-interest" className="block text-sm font-extrabold text-[#17243D]">
                مجال الشراكة المطلوب *
              </label>
              <select
                id="partner-interest"
                value={partnershipInterest}
                onChange={(e) =>
                  setPartnershipInterest(e.target.value as (typeof PARTNER_INTEREST_TYPES)[number])
                }
                className="w-full min-h-[46px] rounded-xl border border-[#4A1FB0]/25 bg-[#FFFFFF] px-3.5 text-sm font-semibold text-[#17243D] focus:border-[#4A1FB0] focus:outline-none"
              >
                {PARTNER_INTEREST_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="partner-notes" className="block text-sm font-extrabold text-[#17243D]">
                نبذة أو تفاصيل إضافية (اختياري)
              </label>
              <textarea
                id="partner-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="حجم الفريق المستهدف، القطاع، أو المقترح المبدئي للتعاون"
                className="w-full min-h-[96px] rounded-xl border border-[#4A1FB0]/25 bg-[#FFFFFF] p-3.5 text-sm text-[#17243D] placeholder:text-[#64748B] focus:border-[#4A1FB0] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#4A1FB0] px-7 text-sm font-extrabold text-white transition-colors hover:bg-[#351078] disabled:opacity-60 cursor-pointer"
            >
              <Send className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.8} aria-hidden="true" />
              <span>{busy ? 'جاري إرسال طلب الشراكة...' : 'إرسال طلب الشراكة'}</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
