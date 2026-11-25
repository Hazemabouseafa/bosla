'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, Download, FileCheck2, Search, ShieldAlert } from 'lucide-react';
import { apiFetch, formatDate } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { AlertBanner, Badge, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

export default function VerifyCertificatePage() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performLookup = useCallback(async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const data = await apiFetch<any>(
        `/learning/credentials/verify/${encodeURIComponent(trimmed)}`,
      );
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'لم يتم العثور على شهادة أو خطاب توصية مسجّل بهذا الرمز.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const initialCode = sp.get('code');
    if (initialCode && initialCode.trim()) {
      setCode(initialCode.trim());
      void performLookup(initialCode.trim());
    }
  }, [performLookup]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLookup(code);
  };

  const isRecommendation =
    result?.credentialType === 'RECOMMENDATION' ||
    result?.type === 'RECOMMENDATION_LETTER';
  const isRevoked = Boolean(
    result?.revokedAt || result?.isValid === false || result?.status === 'REVOKED',
  );
  const resolvedCode = String(
    result?.code || result?.verificationCode || result?.certificateCode || '',
  );
  const accBodyName =
    result?.accreditation?.bodyNameAr || result?.accreditingBodyNameAr || null;
  const accBodyCode =
    result?.accreditation?.bodyCode || result?.accreditingBodyCode || null;
  const accAuthRef =
    result?.accreditation?.authorizationRef || result?.authorizationRef || null;
  const kindLabel =
    result?.credentialLabelAr ||
    result?.kindLabelAr ||
    (isRecommendation
      ? 'خطاب توصية معتمد من المدرب'
      : result?.kind === 'ACCREDITED_PROGRAM'
        ? 'شهادة برنامج تدريبي معتمد'
        : result?.kind === 'COMPETENCY'
          ? 'شهادة التدريب المهني والكفاءة التطبيقية'
          : 'شهادة إتمام وحضور');

  return (
    <PublicPageLayout>
      <PageHero
        badge="نظام التوثيق الرسمي الموحد"
        title="التحقق الفوري من"
        highlight="الشهادات وخطابات التوصية"
        subtitle="أدخل الرمز التسلسلي (مثال: BOSLA-2026-XXXX للشهادات أو BOSLA-REC-XXXX لخطابات التوصية) للتأكد من سريان الوثيقة واعتمادها دون كشف أي بيانات خاصة."
        align="center"
      />

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-6">
        <Card className="p-6 sm:p-8">
          <form onSubmit={handleVerify} className="space-y-4">
            <Field id="cert-code" label="رمز التحقق للشهادة أو خطاب التوصية" required>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="cert-code"
                  dir="ltr"
                  className={inputClassName}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="BOSLA-2026-XXXX أو BOSLA-REC-XXXX"
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

          {result && (
            <div
              className={`mt-6 rounded-2xl border bg-[#0B1440] p-6 space-y-4 ${
                isRevoked ? 'border-[#FF9CAA]/55' : 'border-[#77E2B5]/45'
              }`}
            >
              {isRevoked ? (
                <div className="flex flex-wrap items-center gap-2 text-[#FF9CAA] font-extrabold">
                  <ShieldAlert className="h-5 w-5 text-[#FF9CAA]" />
                  <span>
                    {isRecommendation
                      ? 'خطاب توصية مسحوب / ملغى — لم يعد سارياً'
                      : 'شهادة مسحوبة / ملغاة — لم تعد سارية'}
                  </span>
                  {result.revokedAt && (
                    <Badge tone="danger">ملغاة بتاريخ {formatDate(result.revokedAt)}</Badge>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-[#77E2B5] font-extrabold">
                  {isRecommendation ? (
                    <FileCheck2 className="h-5 w-5 text-[#77E2B5]" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-[#77E2B5]" />
                  )}
                  <span>
                    {isRecommendation
                      ? 'خطاب توصية موثّق وساري من مدرب في أكاديمية بوصلة'
                      : 'شهادة معتمدة وسارية من أكاديمية بوصلة'}
                  </span>
                  <Badge tone={result.kind === 'ACCREDITED_PROGRAM' ? 'purple' : 'info'}>
                    {kindLabel}
                  </Badge>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 text-sm pt-1">
                <div>
                  <p className="text-xs text-[#A9B1E0]">
                    {isRecommendation ? 'اسم المتدرب الموصى له' : 'اسم الحاصل على الشهادة'}
                  </p>
                  <p className="font-extrabold text-[#EEF0FF]">
                    {result.holderNameAr || result.recipientNameAr || result.recipientName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#A9B1E0]">الرمز المرجعي</p>
                  <p dir="ltr" className="font-mono font-bold text-[#8CA2FF] text-end sm:text-start">
                    {resolvedCode}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#A9B1E0]">البرنامج / الكورس</p>
                  <p className="font-bold text-[#EEF0FF]">
                    {result.contentTitleAr ||
                      result.programTitleAr ||
                      result.titleAr ||
                      result.course?.publishedVersion?.titleAr ||
                      result.learningPath?.titleAr ||
                      result.diploma?.titleAr ||
                      'برنامج تدريبي بأكاديمية بوصلة'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#A9B1E0]">
                    {isRecommendation ? 'تاريخ الاعتماد والمدرب' : 'تاريخ الإصدار'}
                  </p>
                  <p className="font-semibold tabular-nums text-[#EEF0FF]">
                    {isRecommendation ? (
                      <>
                        {result.instructorNameAr ? `${result.instructorNameAr} • ` : ''}
                        {result.issuedAt ? formatDate(result.issuedAt) : ''}
                      </>
                    ) : (
                      formatDate(result.issuedAt)
                    )}
                  </p>
                </div>
              </div>

              {!isRecommendation && !isRevoked && accBodyName && (
                <div className="rounded-xl border border-[#C084FC]/35 bg-[#6B21A8]/15 p-3 text-xs text-[#EEF0FF]">
                  الجهة المانحة للاعتماد: <strong>{accBodyName}</strong>
                  {accBodyCode ? ` (${accBodyCode})` : ''}
                  {accAuthRef ? ` • مرجع التفويض: ${accAuthRef}` : ''}
                </div>
              )}

              {!isRecommendation && resolvedCode && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Link href={`/certificates/${encodeURIComponent(resolvedCode)}`}>
                    <Button variant="outline" size="sm">
                      <Award className="h-4 w-4" />
                      فتح السجل الدائم للشهادة
                    </Button>
                  </Link>
                  {!isRevoked && (
                    <a
                      href={`/api/v1/lms/certificates/${encodeURIComponent(resolvedCode)}/download.svg`}
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
              )}
            </div>
          )}
        </Card>
      </section>
    </PublicPageLayout>
  );
}
