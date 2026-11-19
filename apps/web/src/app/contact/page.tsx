'use client';

import React, { useState } from 'react';
import { PhoneCall, Send } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { AlertBanner, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

export default function ContactPage() {
  const [type, setType] = useState<'CORPORATE_B2B' | 'INDIVIDUAL'>('CORPORATE_B2B');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sector, setSector] = useState('دواجن');
  const [teamSize, setTeamSize] = useState('15-50');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await apiFetch('/catalog/leads', {
        method: 'POST',
        body: JSON.stringify({
          type,
          fullName,
          companyName: type === 'CORPORATE_B2B' ? companyName : undefined,
          phoneNumber,
          countryCode: '+20',
          sector,
          teamSize: type === 'CORPORATE_B2B' ? teamSize : undefined,
          need: 'استشارة أو تدريب مؤسسي',
          timeline: 'خلال شهر',
          notes,
        }),
      });
      setSuccess('تم استلام رسالتك بنجاح وسيتواصل معك فريق بوصلة قريباً.');
      setFullName('');
      setCompanyName('');
      setPhoneNumber('');
      setNotes('');
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء إرسال الطلب.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicPageLayout>
      <PageHero
        badge="تواصل معنا"
        title="التدريب المؤسسي"
        highlight="واستشارات الأفراد"
        subtitle="سواء كنت مديراً لشركة إنتاج داجني تبحث عن تأهيل الأطباء والمهندسين، أو خريجاً يبحث عن المسار التدريبي الأنسب — فريقنا جاهز لمساعدتك."
      />

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 grid gap-8 md:grid-cols-12">
        <div className="md:col-span-5 space-y-5">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-[#8CA2FF]" />
              قنوات التواصل المباشرة
            </h2>
            <p className="text-sm leading-[1.7] text-[#A9B1E0]">
              تواصل مباشرة مع مستشاري التدريب المؤسسي لإعداد برامج متخصصة للمزارع وشركات الأعلاف والأدوية البيطرية.
            </p>
            <a
              href="https://wa.me/201001226683"
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-[#8CA2FF]/45 bg-[#7C95FF]/18 px-4 py-3 text-sm font-extrabold text-[#8CA2FF] hover:bg-[#7C95FF]/28 transition-colors"
            >
              واتساب خدمة العملاء: ‎+20 100 122 6683
            </a>
          </Card>
        </div>

        <Card className="md:col-span-7 p-6 sm:p-8">
          <div className="flex gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-1 mb-5">
            <button
              type="button"
              onClick={() => setType('CORPORATE_B2B')}
              className={`min-h-[44px] flex-1 rounded-lg py-2.5 text-sm font-extrabold transition-colors cursor-pointer ${
                type === 'CORPORATE_B2B'
                  ? 'bg-[#7C95FF] text-[#070D2B]'
                  : 'text-[#A9B1E0] hover:bg-[#18266E] hover:text-[#EEF0FF]'
              }`}
            >
              تدريب الشركات والمزارع
            </button>
            <button
              type="button"
              onClick={() => setType('INDIVIDUAL')}
              className={`min-h-[44px] flex-1 rounded-lg py-2.5 text-sm font-extrabold transition-colors cursor-pointer ${
                type === 'INDIVIDUAL'
                  ? 'bg-[#7C95FF] text-[#070D2B]'
                  : 'text-[#A9B1E0] hover:bg-[#18266E] hover:text-[#EEF0FF]'
              }`}
            >
              استشارة فردية
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {success && <AlertBanner tone="success">{success}</AlertBanner>}
            {error && <AlertBanner tone="danger">{error}</AlertBanner>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="c-name" label="الاسم الكامل" required>
                <input
                  id="c-name"
                  className={inputClassName}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </Field>
              <Field id="c-phone" label="رقم الموبايل / واتساب" required>
                <input
                  id="c-phone"
                  dir="ltr"
                  className={inputClassName}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="01012345678"
                  required
                />
              </Field>
            </div>

            {type === 'CORPORATE_B2B' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="c-comp" label="اسم الشركة / المزرعة" required>
                  <input
                    id="c-comp"
                    className={inputClassName}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </Field>
                <Field id="c-size" label="عدد المتدربين">
                  <select
                    id="c-size"
                    className={inputClassName}
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                  >
                    <option value="5-15">5-15 متدرب</option>
                    <option value="15-50">15-50 متدرب</option>
                    <option value="50-200">50-200 متدرب</option>
                    <option value="200+">200+ متدرب</option>
                  </select>
                </Field>
              </div>
            )}

            <Field id="c-sector" label="القطاع">
              <select
                id="c-sector"
                className={inputClassName}
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              >
                <option value="دواجن">دواجن وتفريخ</option>
                <option value="ماشية">ماشية وألبان</option>
                <option value="أدوية">أدوية بيطرية وإضافات</option>
                <option value="أخرى">تخصص آخر</option>
              </select>
            </Field>

            <Field id="c-notes" label="رسالتك أو متطلبات التدريب">
              <textarea
                id="c-notes"
                rows={4}
                className={inputClassName}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              <Send className="h-4 w-4" />
              {busy ? 'جاري الإرسال...' : 'إرسال الطلب'}
            </Button>
          </form>
        </Card>
      </section>
    </PublicPageLayout>
  );
}
