'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { CourseCommunityPanel } from '@/components/community/CourseCommunityPanel';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { Button } from '@/components/ui/primitives';

export default function CourseCommunityPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [questionId, setQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setQuestionId(sp.get('question'));
  }, []);

  if (!slug) return null;

  return (
    <PublicPageLayout>
      <section className="relative overflow-hidden bg-bosla-navy pb-16 pt-10 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bosla-blueprint-grid opacity-30"
        />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center rounded-full border border-[#8CA2FF]/40 bg-[#7C95FF]/15 px-3 py-1 text-xs font-extrabold text-[#8CA2FF]">
              مجتمع الكورس والمناقشات العلمية
            </span>
            <h1 className="text-2xl font-extrabold text-[#EEF0FF] sm:text-3xl">
              تفاعل مباشر مع المدرب والزملاء
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/courses/${slug}`}>
              <Button variant="glass" size="sm">
                <ArrowRight className="h-4 w-4" />
                تفاصيل الكورس
              </Button>
            </Link>
            <Link href={`/learn/${slug}`}>
              <Button variant="primary" size="sm">
                <PlayCircle className="h-4 w-4" />
                العودة إلى مشغل الدروس
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-8 max-w-5xl px-4 pb-14 sm:px-6 space-y-6">
        <CourseCommunityPanel courseSlug={slug} initialQuestionId={questionId} />
      </section>
    </PublicPageLayout>
  );
}
