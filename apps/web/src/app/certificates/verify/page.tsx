'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { AlertBanner, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

export default function VerifyCertificatePage() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cert, setCert] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    setCert(null);
    setBusy(true);
    try {
      const data = await apiFetch<any>(
        `/learning/certificates/verify/${encodeURIComponent(trimmed)}`,
      );
      setCert(data);
    } catch (err: any) {
      setError(err?.message || 'لم يتم العثور على شهادة صالحة بهذا الرمز.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicPageLayout>
      <PageHero
        badge="نظام توثيق الشهادات"
        title="التحقق الفوري من"
        highlight="شهادات أكاديمية بوصلة"
        subtitle="أدخل الرمز التسلسلي المطبوع على الشهادة (مثال: BOSLA-CERT-...) للتأكد من موثوقيتها وتاريخ إصدارها."
        align="center"
      />

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-6">
        <Card className="p-6 sm:p-8">
          <form onSubmit={handleVerify} className="space-y-4">
            <Field id="cert-code" label="رمز التحقق للشهادة" required>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="cert-code"
                  dir="ltr"
                  className={inputClassName}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="BOSLA-CERT-XXXX"
                  required
                />
                <Button type="submit" variant="primary" disabled={busy} className="shrink-0">
                  <Search className="h-4 w-4" />
                  {busy ? 'جاري التحقق...' : 'تحقق الآن'}
                </Button>
              </div>
            </Field>
          </form>

          {error && (
            <div className="mt-5">
              <AlertBanner tone="danger">{error}</AlertBanner>
            </div>
          )}

          {cert && (
            <div className="mt-6 rounded-2xl border border-[#77E2B5]/45 bg-[#0B1440] p-6 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[#77E2B5] font-extrabold">
                <CheckCircle2 className="h-5 w-5 text-[#77E2B5]" />
                <span>شهادة معتمدة وصالحة من أكاديمية بوصلة</span>
                <span className="rounded-full border border-[#8CA2FF]/40 bg-[#7C95FF]/15 px-2.5 py-0.5 text-xs text-[#EEF0FF]">
                  {cert.kind === 'COMPETENCY'
                    ? 'شهادة الكفاءة المعتمدة'
                    : 'شهادة إتمام الدورة (شهادة حضور)'}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-sm pt-2">
                <div>
                  <p className="text-xs text-[#A9B1E0]">اسم الحاصل على الشهادة</p>
                  <p className="font-extrabold text-[#EEF0FF]">
                    {cert.recipientNameAr || cert.recipientName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#A9B1E0]">الرمز المرجعي</p>
                  <p dir="ltr" className="font-mono font-bold text-[#8CA2FF] text-end sm:text-start">
                    {cert.certificateCode}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#A9B1E0]">البرنامج / الكورس</p>
                  <p className="font-bold text-[#EEF0FF]">
                    {cert.titleAr ||
                      cert.course?.publishedVersion?.titleAr ||
                      cert.learningPath?.titleAr ||
                      cert.diploma?.titleAr}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-bosla-muted">تاريخ الإصدار</p>
                  <p className="font-bold text-bosla-ink">
                    {new Date(cert.issuedAt).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <Link href={`/certificates/${encodeURIComponent(cert.certificateCode)}`}>
                  <Button variant="outline" size="sm">
                    <Award className="h-4 w-4" />
                    فتح الرابط الدائم للشهادة
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </section>
    </PublicPageLayout>
  );
}
