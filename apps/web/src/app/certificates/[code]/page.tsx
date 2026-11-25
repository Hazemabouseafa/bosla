import React from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, Download, ShieldAlert } from 'lucide-react';
import { formatDate, formatNumber, serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { AlertBanner, Badge, Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

function getCertKindMeta(kind?: string): {
  labelAr: string;
  tone: 'purple' | 'info' | 'success';
} {
  if (kind === 'ACCREDITED_PROGRAM') {
    return { labelAr: 'شهادة برنامج تدريبي معتمد', tone: 'purple' };
  }
  if (kind === 'COMPETENCY') {
    return { labelAr: 'شهادة التدريب المهني والكفاءة التطبيقية', tone: 'info' };
  }
  return { labelAr: 'شهادة إتمام الدورة (شهادة حضور)', tone: 'success' };
}

export default async function CertificatePublicRecordPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert =
    (await serverApiGet<any>(`/lms/certificates/${encodeURIComponent(code)}/verify`)) ||
    (await serverApiGet<any>(`/learning/credentials/verify/${encodeURIComponent(code)}`));

  const isRecommendation =
    cert?.credentialType === 'RECOMMENDATION' ||
    cert?.type === 'RECOMMENDATION_LETTER';
  const isRevoked = Boolean(cert?.revokedAt || cert?.isValid === false || cert?.status === 'REVOKED');
  const resolvedCode = String(cert?.code || cert?.verificationCode || cert?.certificateCode || code);
  const accBodyName = cert?.accreditation?.bodyNameAr || cert?.accreditingBodyNameAr || null;
  const accBodyCode = cert?.accreditation?.bodyCode || cert?.accreditingBodyCode || null;
  const accAuthRef = cert?.accreditation?.authorizationRef || cert?.authorizationRef || null;
  const kindMeta = isRecommendation
    ? { labelAr: 'خطاب توصية معتمد من المدرب', tone: 'purple' as const }
    : getCertKindMeta(cert?.kind);

  return (
    <PublicPageLayout>
      <PageHero
        badge="وثيقة رسمية موثقة"
        title="سجل التحقق من"
        highlight="شهادات بوصلة"
        subtitle="بيانات رسمية صادرة من قاعدة بيانات أكاديمية بوصلة للتحقق الفوري من حالة الشهادة واعتمادها."
        align="center"
      />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-6">
        {!cert ? (
          <AlertBanner tone="danger" title="الشهادة غير موجودة">
            <p className="mb-4">
              تعذر العثور على شهادة مسجّلة بالرمز <bdi dir="ltr">{code}</bdi>. تأكد من كتابة الرمز التسلسلي بشكل صحيح.
            </p>
            <Link href="/certificates/verify">
              <Button variant="primary" size="sm">
                البحث برمز آخر
              </Button>
            </Link>
          </AlertBanner>
        ) : (
          <Card
            className={`border-2 p-8 text-center space-y-5 ${
              isRevoked ? 'border-[#FF9CAA]/60' : 'border-[#8CA2FF]'
            }`}
          >
            <div
              className={`mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border ${
                isRevoked
                  ? 'border-[#FF9CAA]/45 bg-[#FF9CAA]/15 text-[#FF9CAA]'
                  : 'border-[#8CA2FF]/35 bg-[#7C95FF]/18 text-[#8CA2FF]'
              }`}
            >
              {isRevoked ? <ShieldAlert className="h-8 w-8" /> : <Award className="h-8 w-8" />}
            </div>

            {isRevoked ? (
              <Badge tone="danger">
                {isRecommendation ? 'خطاب توصية ملغى — غير ساري' : 'شهادة مسحوبة / ملغاة — غير سارية'}
              </Badge>
            ) : (
              <Badge tone={kindMeta.tone}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {cert.credentialLabelAr || cert.kindLabelAr || kindMeta.labelAr} — أكاديمية بوصلة
              </Badge>
            )}

            <h2 className="text-2xl font-extrabold text-[#EEF0FF] sm:text-3xl">
              {cert.holderNameAr || cert.recipientNameAr || cert.recipientName}
            </h2>
            <p className="text-sm text-[#A9B1E0]">
              {isRevoked ? 'الوثيقة المسحوبة كانت مرتبطة بـ:' : 'أتم بنجاح متطلبات:'}
            </p>
            <p className="text-xl font-extrabold text-[#8CA2FF]">
              {cert.contentTitleAr ||
                cert.programTitleAr ||
                cert.titleAr ||
                cert.course?.publishedVersion?.titleAr ||
                cert.learningPath?.titleAr ||
                cert.diploma?.titleAr}
            </p>
            {isRecommendation && cert.instructorNameAr && (
              <p className="text-xs text-[#A9B1E0]">
                صادر عن المدرب: <strong className="text-[#EEF0FF]">{cert.instructorNameAr}</strong>
              </p>
            )}

            {isRevoked && (
              <AlertBanner tone="danger" title="وثيقة ملغاة / مسحوبة رسمياً">
                تم سحب وإلغاء هذه الوثيقة بتاريخ {formatDate(cert.revokedAt)} ولم تعد صالحة للاستخدام الرسمي.
              </AlertBanner>
            )}

            {!isRecommendation && !isRevoked && accBodyName && (
              <div className="rounded-2xl border border-[#C084FC]/40 bg-[#6B21A8]/16 p-4 text-sm text-[#EEF0FF] space-y-1">
                <p className="font-extrabold text-[#E9D5FF]">
                  الجهة المانحة للاعتماد: {accBodyName}
                  {accBodyCode ? ` (${accBodyCode})` : ''}
                </p>
                {accAuthRef && (
                  <p className="text-xs text-[#A9B1E0]">
                    مرجع التفويض الرسمي: <bdi dir="ltr">{accAuthRef}</bdi>
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-[#22307A] bg-[#0B1440] p-4 text-sm">
              <div>
                <p className="text-xs text-[#A9B1E0]">رمز التحقق التسلسلي</p>
                <p dir="ltr" className="font-mono font-bold text-[#8CA2FF]">
                  {resolvedCode}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#A9B1E0]">تاريخ الإصدار</p>
                <p className="font-semibold tabular-nums text-[#EEF0FF]">
                  {formatDate(cert.issuedAt)}
                  {cert.reissueCount > 0 ? ` (إعادة إصدار #${formatNumber(cert.reissueCount)})` : ''}
                </p>
              </div>
            </div>

            {!isRevoked && cert.qrSvg && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <div
                  className="rounded-xl bg-white p-2 shadow"
                  dangerouslySetInnerHTML={{ __html: cert.qrSvg }}
                />
                <p className="text-xs text-[#A9B1E0]">امسح رمز QR للتحقق الفوري من صحة الوثيقة</p>
              </div>
            )}

            {cert.accreditationNoticeAr && !isRevoked && (
              <p className="text-xs text-[#A9B1E0]">{cert.accreditationNoticeAr}</p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!isRevoked && !isRecommendation && resolvedCode && (
                <a
                  href={`/api/v1/lms/certificates/${encodeURIComponent(resolvedCode)}/download.svg`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="primary">
                    <Download className="h-4 w-4" />
                    تحميل / طباعة الوثيقة الرسمية
                  </Button>
                </a>
              )}
              <Link href="/certificates/verify">
                <Button variant="outline">التحقق من شهادة أخرى</Button>
              </Link>
            </div>
          </Card>
        )}
      </section>
    </PublicPageLayout>
  );
}
