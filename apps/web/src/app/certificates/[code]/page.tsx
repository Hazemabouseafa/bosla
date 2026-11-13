import React from 'react';
import Link from 'next/link';
import { Award, CheckCircle2 } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { AlertBanner, Badge, Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function CertificatePublicRecordPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert = await serverApiGet<any>(
    `/learning/certificates/verify/${encodeURIComponent(code)}`,
  );

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 space-y-6">
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
          <Card className="border-2 border-bosla-amber p-8 bg-gradient-to-br from-white to-amber-50/40 text-center space-y-5">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Award className="h-8 w-8" />
            </div>
            <Badge tone="success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              شهادة موثقة رسمياً — أكاديمية بوصلة
            </Badge>
            <h1 className="text-2xl font-extrabold text-bosla-navy sm:text-3xl">
              {cert.recipientNameAr || cert.recipientName}
            </h1>
            <p className="text-sm text-bosla-muted">أتم بنجاح متطلبات:</p>
            <p className="text-xl font-extrabold text-bosla-ink">
              {cert.titleAr ||
                cert.course?.publishedVersion?.titleAr ||
                cert.learningPath?.titleAr ||
                cert.diploma?.titleAr}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-bosla-line bg-white p-4 text-sm">
              <div>
                <p className="text-xs text-bosla-muted">رمز التحقق التسلسلي</p>
                <p dir="ltr" className="font-mono font-bold text-bosla-primary">
                  {cert.certificateCode}
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
