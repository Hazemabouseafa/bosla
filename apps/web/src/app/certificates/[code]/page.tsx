import React from 'react';
import Link from 'next/link';
import { Award, CheckCircle2 } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { AlertBanner, Badge, Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function CertificatePublicRecordPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert =
    (await serverApiGet<any>(`/lms/certificates/${encodeURIComponent(code)}/verify`)) ||
    (await serverApiGet<any>(`/learning/certificates/verify/${encodeURIComponent(code)}`));

  return (
    <PublicPageLayout>
      <PageHero
        badge="وثيقة رسمية موثقة"
        title="سجل التحقق من"
        highlight="شهادات بوصلة"
        subtitle="بيانات رسمية صادرة من قاعدة بيانات أكاديمية بوصلة للتحقق من اعتماد الخريجين."
        align="center"
      />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-6">
        {!cert ? (
          <AlertBanner tone="danger" title="الشهادة غير موجودة أو ملغاة">
            <p className="mb-4">
              تعذر التحقق من صحة الشهادة بالرمز {code}. تأكد من كتابة الرمز الصحيح.
            </p>
            <Link href="/certificates/verify">
              <Button variant="primary" size="sm">
                البحث برمز آخر
              </Button>
            </Link>
          </AlertBanner>
        ) : (
          <Card className="border-2 border-[#8CA2FF] p-8 text-center space-y-5">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-[#8CA2FF]/35 bg-[#7C95FF]/18 text-[#8CA2FF]">
              <Award className="h-8 w-8" />
            </div>
            <Badge tone={cert.kind === 'COMPETENCY' ? 'purple' : 'success'}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {cert.kind === 'COMPETENCY'
                ? 'شهادة الكفاءة المعتمدة — أكاديمية بوصلة'
                : 'شهادة إتمام الدورة (شهادة حضور) — أكاديمية بوصلة'}
            </Badge>
            <h2 className="text-2xl font-extrabold text-[#EEF0FF] sm:text-3xl">
              {cert.recipientNameAr || cert.recipientName}
            </h2>
            <p className="text-sm text-[#A9B1E0]">أتم بنجاح متطلبات:</p>
            <p className="text-xl font-extrabold text-[#8CA2FF]">
              {cert.titleAr ||
                cert.course?.publishedVersion?.titleAr ||
                cert.learningPath?.titleAr ||
                cert.diploma?.titleAr}
            </p>
            {cert.revokedAt && (
              <AlertBanner tone="danger" title="شهادة ملغاة / مسحوبة">
                تم إلغاء هذه الشهادة بتاريخ {new Date(cert.revokedAt).toLocaleDateString('ar-EG')} ولم تعد سارية.
              </AlertBanner>
            )}
            <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-[#22307A] bg-[#0B1440] p-4 text-sm">
              <div>
                <p className="text-xs text-[#A9B1E0]">رمز التحقق التسلسلي</p>
                <p dir="ltr" className="font-mono font-bold text-[#8CA2FF]">
                  {cert.certificateCode}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#A9B1E0]">تاريخ الإصدار</p>
                <p className="font-bold text-[#EEF0FF]">
                  {new Date(cert.issuedAt).toLocaleDateString('ar-EG')}
                  {cert.reissueCount > 0 ? ` (إعادة إصدار #${cert.reissueCount})` : ''}
                </p>
              </div>
            </div>
            {cert.qrSvg && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <div
                  className="rounded-xl bg-white p-2 shadow"
                  dangerouslySetInnerHTML={{ __html: cert.qrSvg }}
                />
                <p className="text-xs text-[#A9B1E0]">امسح رمز QR للتحقق الفوري من صحة الوثيقة</p>
              </div>
            )}
            {cert.accreditationNoticeAr && (
              <p className="text-xs text-[#A9B1E0]">{cert.accreditationNoticeAr}</p>
            )}
            <div className="pt-2">
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
