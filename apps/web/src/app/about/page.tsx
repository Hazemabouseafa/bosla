import React from 'react';
import Link from 'next/link';
import { Award, Compass, ShieldCheck, Users } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Badge, Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const cmsPage = await serverApiGet<any>('/catalog/pages/about');

  return (
    <PublicPageLayout>
      <section className="bg-gradient-to-l from-bosla-navy to-bosla-primary text-white py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-4">
          <Badge className="bg-white/15 text-bosla-amber border-bosla-amber/40">
            من الطالب إلى المدير
          </Badge>
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            {cmsPage?.titleAr || 'عن أكاديمية بوصلة — BOSLA Academy'}
          </h1>
          <p className="text-base text-indigo-100 leading-relaxed max-w-3xl">
            {cmsPage?.subtitleAr ||
              'جسر علمي وتطبيقي ينقل طلاب الطب البيطري والزراعة والخريجين والمهندسين إلى مستوى الاحتراف الميداني والقيادة الإدارية.'}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <Card className="p-6 space-y-2">
            <Compass className="h-7 w-7 text-bosla-primary" />
            <h2 className="text-lg font-extrabold text-bosla-ink">منهج تطبيقي حقيقي</h2>
            <p className="text-xs leading-relaxed text-bosla-muted">
              دروس مصورة من داخل المزارع ومصانع الأعلاف مع ملفات تشغيلية وحسابات علائق حقيقية.
            </p>
          </Card>
          <Card className="p-6 space-y-2">
            <ShieldCheck className="h-7 w-7 text-bosla-success" />
            <h2 className="text-lg font-extrabold text-bosla-ink">حماية وأمان حديث</h2>
            <p className="text-xs leading-relaxed text-bosla-muted">
              اعتماد كامل على مفاتيح Passkey FIDO2 وتوثيق Google OIDC بدون أي رموز OTP أو تعقيد.
            </p>
          </Card>
          <Card className="p-6 space-y-2">
            <Award className="h-7 w-7 text-bosla-amber" />
            <h2 className="text-lg font-extrabold text-bosla-ink">مسارات وشهادات موثقة</h2>
            <p className="text-xs leading-relaxed text-bosla-muted">
              كل شهادة تصدرها المنصة مزودة برمز تحقق علني للشركات وأصحاب الأعمال.
            </p>
          </Card>
        </div>

        <Card className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Users className="h-6 w-6 text-bosla-primary shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-extrabold text-bosla-ink">
                انضم إلى أكثر من 5,000 متدرب في العالم العربي
              </h2>
              <p className="text-sm text-bosla-muted mt-1">
                ابدأ باستعراض الكورسات أو اختر باقة العضوية الشاملة اليوم.
              </p>
            </div>
          </div>
          <Link href="/courses">
            <Button variant="primary">تصفح الكورسات</Button>
          </Link>
        </Card>
      </section>
    </PublicPageLayout>
  );
}
