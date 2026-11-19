import React from 'react';
import Link from 'next/link';
import { Award, Compass, ShieldCheck, Users } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const cmsPage = await serverApiGet<any>('/catalog/pages/about');

  return (
    <PublicPageLayout>
      <PageHero
        badge="من الطالب إلى المدير"
        title={cmsPage?.titleAr || 'عن أكاديمية بوصلة —'}
        highlight="BOSLA Academy"
        subtitle={
          cmsPage?.subtitleAr ||
          'جسر علمي وتطبيقي ينقل طلاب الطب البيطري والزراعة والخريجين والمهندسين إلى مستوى الاحتراف الميداني والقيادة الإدارية.'
        }
      />

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <Card className="scroll-reveal-up scroll-stagger-1 bosla-card-hover p-6 space-y-2.5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#22307A] bg-[#0B1440] text-[#8CA2FF]">
              <Compass className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-extrabold text-[#EEF0FF]">منهج تطبيقي حقيقي</h2>
            <p className="text-sm leading-[1.7] text-[#A9B1E0]">
              دروس مصورة من داخل المزارع ومصانع الأعلاف مع ملفات تشغيلية وحسابات علائق حقيقية.
            </p>
          </Card>
          <Card className="scroll-reveal-up scroll-stagger-2 bosla-card-hover p-6 space-y-2.5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#22307A] bg-[#0B1440] text-[#8CA2FF]">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-extrabold text-[#EEF0FF]">حماية وأمان حديث</h2>
            <p className="text-sm leading-[1.7] text-[#A9B1E0]">
              تسجيل دخول سريع وآمن لحسابك مع حفظ كامل لتقدمك التعليمي وشهاداتك المعتمدة في أي وقت.
            </p>
          </Card>
          <Card className="scroll-reveal-up scroll-stagger-3 bosla-card-hover p-6 space-y-2.5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#22307A] bg-[#0B1440] text-[#77E2B5]">
              <Award className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-extrabold text-[#EEF0FF]">مسارات وشهادات موثقة</h2>
            <p className="text-sm leading-[1.7] text-[#A9B1E0]">
              كل شهادة تصدرها المنصة مزودة برمز تحقق علني للشركات وأصحاب الأعمال.
            </p>
          </Card>
        </div>

        <Card className="scroll-reveal-up p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-[#8CA2FF]/40 bg-[#0B1440] text-[#EEF0FF]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#22307A] bg-[#0F1A4A] text-[#8CA2FF]">
              <Users className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-[#EEF0FF]">
                تواصل مع مجتمع الكوادر البيطرية والداجنة في بوصلة
              </h2>
              <p className="text-sm text-[#A9B1E0] mt-1">
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
