import React from 'react';
import Link from 'next/link';
import { Award, Briefcase, Building2, LifeBuoy, Mail, PhoneCall } from 'lucide-react';
import { serverApiGet } from '@/lib/api';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { PageHero } from '@/components/layout/PageHero';
import { Button, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function ContactHubPage() {
  const liveLayout = await serverApiGet<any>('/catalog/live-layout');
  const layout = liveLayout?.layout;
  const contact = layout?.contact;
  const social = layout?.social;

  const socialItems = [
    { label: 'فيسبوك', href: social?.facebookUrl },
    { label: 'يوتيوب', href: social?.youtubeUrl },
    { label: 'لينكدإن', href: social?.linkedinUrl },
    { label: 'إنستجرام', href: social?.instagramUrl },
    { label: 'منصة X', href: social?.xUrl },
  ].filter((s) => Boolean(s.href && /^https?:\/\//i.test(s.href)));

  return (
    <PublicPageLayout>
      <PageHero
        badge="القنوات الرسمية لأكاديمية بوصلة"
        title="التدريب المؤسسي"
        highlight="والدعم والشراكات المباشرة"
        subtitle="للمتابعة الأكاديمية والفنية والشراكات المؤسسية أو الاستفسار عن الدفعات التدريبية، يمكنك الوصول مباشرة إلى القناة المناسبة هنا."
      />

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6 space-y-4 border-[#22307A]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#8CA2FF]/30 bg-[#0B1440] text-[#8CA2FF]">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-[#EEF0FF]">الدعم الفني وخدمة المتدربين</h2>
                <p className="text-xs text-[#A9B1E0]">للحسابات والاشتراكات والتشغيل والشهادات</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-[#C2CAF2]">
              افتح تذكرة دعم داخل حسابك أو تواصل عبر القنوات المباشرة للحصول على متابعة دقيقة وسريعة.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/support">
                <Button variant="primary" size="sm">مركز الدعم والتذاكر</Button>
              </Link>
              <Link href="/certificates/verify">
                <Button variant="outline" size="sm">
                  <Award className="h-4 w-4" />
                  التحقق من الشهادات
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="p-6 space-y-4 border-[#22307A]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#C084FC]/30 bg-[#6B21A8]/20 text-[#C084FC]">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-[#EEF0FF]">الشراكات وتدريب الشركات</h2>
                <p className="text-xs text-[#A9B1E0]">للمزارع ومصانع الأعلاف والشركات البيطرية</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-[#C2CAF2]">
              انضم كشريك نجاح أو قدّم طلب انضمام برنامج مؤسسي مباشرة عبر نموذج الشراكات الرسمي.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/#partner-apply">
                <Button variant="primary" size="sm">طلب شراكة مؤسسية</Button>
              </Link>
              <Link href="/careers">
                <Button variant="outline" size="sm">
                  <Briefcase className="h-4 w-4" />
                  الوظائف والانضمام إلينا
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {(contact?.whatsapp || contact?.email || contact?.phone || socialItems.length > 0) && (
          <Card className="p-6 space-y-4 border-[#22307A]">
            <h2 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-[#8CA2FF]" />
              بيانات التواصل والقنوات الرسمية المعتمدة
            </h2>
            <div className="flex flex-wrap gap-3 text-xs">
              {contact?.whatsapp && (
                <a
                  href={`https://wa.me/${contact.whatsapp.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#77E2B5]/35 bg-[#77E2B5]/10 px-4 py-2.5 font-bold text-[#77E2B5]"
                >
                  واتساب: <bdi dir="ltr">{contact.whatsapp}</bdi>
                </a>
              )}
              {contact?.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#8CA2FF]/35 bg-[#0B1440] px-4 py-2.5 font-bold text-[#EEF0FF]"
                >
                  <Mail className="h-3.5 w-3.5 text-[#8CA2FF]" />
                  <bdi dir="ltr">{contact.email}</bdi>
                </a>
              )}
              {socialItems.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#C084FC]/35 bg-[#6B21A8]/15 px-4 py-2.5 font-bold text-[#E9D5FF]"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </Card>
        )}
      </section>
    </PublicPageLayout>
  );
}
