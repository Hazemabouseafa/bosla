import React from 'react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const cmsPage = await serverApiGet<any>('/catalog/pages/privacy');

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-6">
        <Badge tone="info">السياسات والخصوصية</Badge>
        <h1 className="text-3xl font-extrabold text-bosla-ink">
          {cmsPage?.titleAr || 'سياسة الخصوصية وحماية البيانات — أكاديمية بوصلة'}
        </h1>
        <Card className="p-6 sm:p-8 space-y-4 text-sm leading-relaxed text-bosla-ink">
          <p>
            تلتزم أكاديمية بوصلة بحماية بيانات المتدربين والمدربين وفق أعلى المعايير الأمنية. لا يتم تخزين كلمات المرور كنص صريح أبداً بل باستخدام تشفير Argon2id، كما يتم توثيق أجهزة Passkey عبر بروتوكول WebAuthn/FIDO2 القياسي دون تخزين أي مفاتيح خاصة على الخادم.
          </p>
          <p>
            لا تستخدم المنصة أي رسائل OTP أو تحقق هاتفي عبر طرف ثالث. تُحفظ بيانات التقدم التعليمي والشهادات وسجلات الدفع عبر Paymob لأغراض تفعيل العضوية وإصدار الشهادات المعتمدة فقط.
          </p>
        </Card>
      </section>
    </PublicPageLayout>
  );
}
