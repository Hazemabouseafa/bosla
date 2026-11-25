import React from 'react';
import Link from 'next/link';
import { Briefcase, ExternalLink, Mail, MapPin } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { AlertBanner, Badge, Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function CareersPage() {
  const jobs = (await serverApiGet<any[]>('/catalog/careers')) || [];

  return (
    <PublicPageLayout>
      <PageHero
        badge="انضم لفريق بوصلة"
        title="الوظائف"
        highlight="وفرص العمل والانضمام إلينا"
        subtitle="فرص العمل والتدريس وإعداد المحتوى العلمي والتقني المتاحة حالياً في أكاديمية بوصلة وشركائها."
        align="center"
      />

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-6">
        {jobs.length === 0 ? (
          <Card className="p-8 text-center space-y-4">
            <Briefcase className="mx-auto h-10 w-10 text-[#8CA2FF]" />
            <h2 className="text-xl font-extrabold text-[#EEF0FF]">
              لا توجد شواغر وظيفية معلنة في الوقت الحالي
            </h2>
            <p className="text-sm text-[#A9B1E0] max-w-lg mx-auto">
              تابع هذه الصفحة باستمرار للتعرف على الوظائف الجديدة في مجالات التدريب البيطري والإنتاج الحيواني وتطوير المحتوى.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Link href="/courses">
                <Button variant="primary">استكشف الكورسات</Button>
              </Link>
              <Link href="/support">
                <Button variant="outline">مركز الدعم والمساعدة</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <AlertBanner tone="info" title={`الوظائف المتاحة الآن (${jobs.length})`}>
              اضغط على زر التقديم المرفق بكل فرصة لإرسال سيرتك الذاتية عبر القناة المعتمدة للوظيفة.
            </AlertBanner>
            <div className="grid gap-5 md:grid-cols-2">
              {jobs.map((job) => {
                const hasUrl = Boolean(job.applyUrl && /^https?:\/\//i.test(job.applyUrl));
                const hasEmail = Boolean(job.applyEmail && job.applyEmail.includes('@'));
                return (
                  <Card key={job.id} className="p-6 flex flex-col justify-between gap-4 border-[#22307A]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {job.employmentTypeAr && <Badge tone="purple">{job.employmentTypeAr}</Badge>}
                        {job.departmentAr && <Badge tone="info">{job.departmentAr}</Badge>}
                      </div>
                      <h2 className="text-lg font-extrabold text-[#EEF0FF]">{job.titleAr}</h2>
                      {job.locationAr && (
                        <p className="flex items-center gap-1.5 text-xs text-[#A9B1E0]">
                          <MapPin className="h-3.5 w-3.5 text-[#8CA2FF]" />
                          {job.locationAr}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm leading-relaxed text-[#C2CAF2] whitespace-pre-line">
                        {job.summaryAr}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-[#22307A] pt-4">
                      {hasUrl && (
                        <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="primary" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                            التقديم للوظيفة
                          </Button>
                        </a>
                      )}
                      {hasEmail && (
                        <a href={`mailto:${job.applyEmail}?subject=${encodeURIComponent(`تقديم وظيفة: ${job.titleAr}`)}`}>
                          <Button variant={hasUrl ? 'outline' : 'primary'} size="sm">
                            <Mail className="h-3.5 w-3.5" />
                            تقديم عبر البريد ({job.applyEmail})
                          </Button>
                        </a>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </PublicPageLayout>
  );
}
