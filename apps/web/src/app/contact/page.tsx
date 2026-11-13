'use client';

import React, { useState } from 'react';
import { PhoneCall, Send } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { AlertBanner, Badge, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

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
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 grid gap-8 md:grid-cols-12">
        <div className="md:col-span-5 space-y-5">
          <Badge tone="info">تواصل معنا</Badge>
          <h1 className="text-3xl font-extrabold text-bosla-ink">
            التدريب المؤسسي واستشارات الأفراد
          </h1>
          <p className="text-sm leading-relaxed text-bosla-muted">
            سواء كنت مديراً لشركة إنتاج داجني تبحث عن تأهيل الأطباء والمهندسين، أو خريجاً يبحث عن المسار التدريبي الأنسب — فريقنا جاهز لمساعدتك.
          </p>
          <Card className="p-5 space-y-3">
            <p className="text-sm font-extrabold text-bosla-navy flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-bosla-success" />
              قنوات التواصل المباشرة
            </p>
            <a
              href="https://wa.me/201001226683"
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-extrabold text-emerald-900 hover:bg-emerald-100"
            >
              واتساب خدمة العملاء: ‎+20 100 122 6683
            </a>
          </Card>
        </div>

        <Card className="md:col-span-7 p-6 sm:p-8">
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setType('CORPORATE_B2B')}
              className={`flex-1 rounded-xl border py-2.5 text-xs font-extrabold cursor-pointer ${
                type === 'CORPORATE_B2B'
                  ? 'border-bosla-navy bg-bosla-navy text-white'
                  : 'border-bosla-line bg-white text-bosla-ink'
              }`}
            >
              تدريب شركات B2B
            </button>
            <button
              type="button"
              onClick={() => setType('INDIVIDUAL')}
              className={`flex-1 rounded-xl border py-2.5 text-xs font-extrabold cursor-pointer ${
                type === 'INDIVIDUAL'
                  ? 'border-bosla-primary bg-bosla-primary text-white'
                  : 'border-bosla-line bg-white text-bosla-ink'
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
