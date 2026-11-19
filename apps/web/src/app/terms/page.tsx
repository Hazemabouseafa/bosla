import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const cmsPage = await serverApiGet<any>('/catalog/pages/terms');

  return (
    <PublicPageLayout>
      <PageHero
        badge="الاتفاقية القانونية"
        title={cmsPage?.titleAr || 'الشروط والأحكام'}
        highlight="— بوصلة"
        subtitle="الضوابط المنظمة لاستخدام المنصة التعليمية وحقوق الملكية الفكرية للمحتوى البيطري."
      />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-6">
        <Card className="p-6 sm:p-8 space-y-4 text-sm leading-relaxed text-bosla-ink">
          <p>
            الحساب الشخصي في أكاديمية بوصلة مخصص للاستخدام الفردي من قبل صاحب العضوية ولا يجوز مشاركة بيانات الدخول أو إعادة نشر الدروس المرئية أو المرفقات خارج المنصة.
          </p>
          <p>
            تُجدد العضويات الشهرية والسنوية أو تُدار وفق سياسة الدفع الإلكتروني المعتمدة على المنصة، وتظل الشهادات المصدرة سارية وقابلة للتحقق الرقمي طالما اكتملت متطلبات اجتياز الكورس أو الدبلومة.
          </p>
        </Card>
      </section>
    </PublicPageLayout>
  );
}
