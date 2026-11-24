'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, Download, Search, ShieldAlert } from 'lucide-react';
import { apiFetch, formatDate } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { AlertBanner, Badge, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

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
      setError(err?.message || 'لم يتم العثور على شهادة مسجّلة بهذا الرمز.');
    } finally {
      setBusy(false);
    }
  };

  const isRevoked = Boolean(cert?.revokedAt || cert?.isValid === false || cert?.status === 'REVOKED');
  const kindLabel =
    cert?.kindLabelAr ||
    (cert?.kind === 'ACCREDITED_PROGRAM'
      ? 'شهادة برنامج تدريبي معتمد'
      : cert?.kind === 'COMPETENCY'
        ? 'شهادة التدريب المهني والكفاءة التطبيقية'
        : 'شهادة إتمام الدورة (شهادة حضور)');

  return (
    <PublicPageLayout>
      <PageHero
        badge="نظام توثيق الشهادات"
        title="التحقق الفوري من"
        highlight="شهادات أكاديمية بوصلة"
        subtitle="أدخل الرمز التسلسلي المطبوع على الشهادة (مثال: BOSLA-2026-XXXX) للتأكد من سريانها ونوع اعتمادها."
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
                  placeholder="BOSLA-2026-XXXX"
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
            <div
              className={`mt-6 rounded-2xl border bg-[#0B1440] p-6 space-y-4 ${
                isRevoked ? 'border-[#FF9CAA]/55' : 'border-[#77E2B5]/45'
              }`}
            >
              {isRevoked ? (
                <div className="flex flex-wrap items-center gap-2 text-[#FF9CAA] font-extrabold">
                  <ShieldAlert className="h-5 w-5 text-[#FF9CAA]" />
                  <span>شهادة مسحوبة / ملغاة — لم تعد سارية</span>
                  <Badge tone="danger">ملغاة بتاريخ {formatDate(cert.revokedAt)}</Badge>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-[#77E2B5] font-extrabold">
                  <CheckCircle2 className="h-5 w-5 text-[#77E2B5]" />
                  <span>شهادة معتمدة وسارية من أكاديمية بوصلة</span>
                  <Badge tone={cert.kind === 'ACCREDITED_PROGRAM' ? 'purple' : 'info'}>
                    {kindLabel}
                  </Badge>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 text-sm pt-1">
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
                  <p className="text-xs text-[#A9B1E0]">تاريخ الإصدار</p>
                  <p className="font-semibold tabular-nums text-[#EEF0FF]">
                    {formatDate(cert.issuedAt)}
                  </p>
                </div>
              </div>

              {!isRevoked && cert.kind === 'ACCREDITED_PROGRAM' && cert.accreditingBodyNameAr && (
                <div className="rounded-xl border border-[#C084FC]/35 bg-[#6B21A8]/15 p-3 text-xs text-[#EEF0FF]">
                  الجهة المانحة للاعتماد: <strong>{cert.accreditingBodyNameAr}</strong>
                  {cert.accreditingBodyCode ? ` (${cert.accreditingBodyCode})` : ''}
                  {cert.authorizationRef ? ` • مرجع التفويض: ${cert.authorizationRef}` : ''}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Link href={`/certificates/${encodeURIComponent(cert.certificateCode)}`}>
                  <Button variant="outline" size="sm">
                    <Award className="h-4 w-4" />
                    فتح السجل الدائم للشهادة
                  </Button>
                </Link>
                {!isRevoked && (
                  <a
                    href={`/api/v1/lms/certificates/${encodeURIComponent(cert.certificateCode)}/download.svg`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="primary" size="sm">
                      <Download className="h-4 w-4" />
                      تنزيل الوثيقة (SVG)
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </Card>
      </section>
    </PublicPageLayout>
  );
}
