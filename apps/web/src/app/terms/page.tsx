import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const cmsPage = await serverApiGet<any>('/catalog/pages/terms');

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-6">
        <Badge tone="info">الاتفاقية القانونية</Badge>
        <h1 className="text-3xl font-extrabold text-bosla-ink">
          {cmsPage?.titleAr || 'الشروط والأحكام — أكاديمية بوصلة'}
        </h1>
        <Card className="p-6 sm:p-8 space-y-4 text-sm leading-relaxed text-bosla-ink">
          <p>
            الحساب الشخصي في أكاديمية بوصلة مخصص للاستخدام الفردي من قبل صاحب العضوية ولا يجوز مشاركة بيانات الدخول أو إعادة نشر الدروس المرئية أو المرفقات خارج المنصة.
          </p>
          <p>
            تُجدد العضويات الشهرية والسنوية أو تُدار وفق سياسة الدفع الإلكتروني المعتمدة عبر بوابة Paymob، وتظل الشهادات المصدرة سارية وقابلة للتحقق الرقمي طالما اكتملت متطلبات اجتياز الكورس أو الدبلومة.
          </p>
        </Card>
      </section>
    </PublicPageLayout>
  );
}
