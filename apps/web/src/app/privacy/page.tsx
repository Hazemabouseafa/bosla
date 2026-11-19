import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const cmsPage = await serverApiGet<any>('/catalog/pages/privacy');

  return (
    <PublicPageLayout>
      <PageHero
        badge="السياسات والخصوصية"
        title={cmsPage?.titleAr || 'سياسة الخصوصية وحماية البيانات'}
        highlight="— بوصلة"
        subtitle="التزامنا الكامل بأمان حسابات الطلاب والمدربين وحوكمة البيانات التعليمية."
      />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-6">
        <Card className="p-6 sm:p-8 space-y-4 text-sm leading-relaxed text-bosla-ink">
          <p>
            تلتزم أكاديمية بوصلة بحماية خصوصية بيانات المتدربين والمدربين وفق أعلى معايير الأمان. يتم حفظ كلمات المرور وبيانات الدخول بأحدث أساليب التشفير والحماية دون تخزين أي مفاتيح خاصة على الخادم.
          </p>
          <p>
            تُحفظ بيانات التقدم التعليمي والشهادات وسجلات الدفع الإلكتروني المشفرة لأغراض تأمين الحساب وتفعيل العضوية وإصدار الشهادات المعتمدة فقط.
          </p>
        </Card>
      </section>
    </PublicPageLayout>
  );
}
