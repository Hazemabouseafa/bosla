'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AlertBanner, Button } from '@/components/ui/primitives';
import { type LearningPathCardData } from '@/components/catalog/LearningPathCard';
import { AuthenticatedHomeHub } from './AuthenticatedHomeHub';
import { PublicExhibitionHome } from './PublicExhibitionHome';

export interface HomeBundle {
  homePage?: any;
  settings?: Record<string, any> | null;
  sectionVisibility?: Record<string, boolean> | null;
  categories: Array<{
    id: string;
    slug: string;
    nameAr: string;
    descriptionAr: string | null;
    iconUrl?: string | null;
    thumbnailUrl?: string | null;
  }>;
  courses: Array<{
    id: string;
    slug: string;
    isFree: boolean;
    difficulty: string;
    category: { id: string; slug: string; nameAr: string };
    instructor: {
      id: string;
      fullName: string;
      headlineAr: string | null;
      avatarUrl: string | null;
    };
    publishedVersion: {
      titleAr: string;
      subtitleAr: string | null;
      descriptionAr: string;
      thumbnailUrl: string | null;
      durationMinutes: number;
      sections: Array<{ id: string; _count: { lessons: number } }>;
    } | null;
  }>;
  learningPaths: LearningPathCardData[];
  diplomas: Array<{
    id: string;
    slug: string;
    titleAr: string;
    descriptionAr: string;
    totalHours: number;
    thumbnailUrl: string | null;
  }>;
  instructors: Array<{
    id: string;
    fullName: string;
    headlineAr: string | null;
    bioAr: string | null;
    avatarUrl: string | null;
    _count?: { instructedCourses: number };
  }>;
  plans: Array<{
    id: string;
    slug: string;
    nameAr: string;
    interval: 'MONTHLY' | 'ANNUAL';
    priceCents: number;
    discountLabelAr: string | null;
  }>;
  offlineEvents?: Array<{
    id: string;
    slug: string;
    titleAr: string;
    subtitleAr?: string | null;
    descriptionAr: string;
    thumbnailUrl?: string | null;
    categoryLabelAr: string;
    cityAr: string;
    venueNameAr: string;
    startsAt: string;
    priceCents: number;
    compareAtPriceCents?: number | null;
    capacity: number;
    remainingSeats: number;
    speakerNameAr?: string | null;
    instructor?: { id: string; fullName: string; avatarUrl?: string | null } | null;
  }>;
  testimonials: Array<{
    id: string;
    studentNameAr?: string;
    authorName?: string;
    roleTitleAr?: string | null;
    authorRoleAr?: string | null;
    companyAr?: string | null;
    quoteAr: string;
    rating: number;
  }>;
  partners: Array<{
    id: string;
    name?: string;
    nameAr?: string;
    descriptionAr?: string | null;
    logoUrl: string | null;
  }>;
  faqs: Array<{ id: string; questionAr: string; answerAr: string }>;
  specialization: {
    questions: Array<{
      id: string;
      stepOrder?: number;
      promptAr: string;
      options: Array<{
        label?: string;
        labelAr?: string;
        weights?: string;
        species?: string;
        dimensionWeights?: Record<string, number>;
        speciesWeights?: Record<string, number>;
      }>;
    }>;
    domains: any[];
  };
}

export function HomeExperience({ data }: { data: HomeBundle | null }) {
  const { user, requiresPasskeyEnrollment } = useAuth();
  const isUnlocked = Boolean(user && !requiresPasskeyEnrollment);

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <AlertBanner tone="warning" title="جارٍ تهيئة اتصال المنصة">
          <p className="mb-4">
            لم نتمكن من جلب بيانات المنصة من خادم الواجهة الخلفية في هذه اللحظة.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button variant="primary">تسجيل الدخول</Button>
            </Link>
            <Link href="/about">
              <Button variant="outline">عن أكاديمية بوصلة</Button>
            </Link>
          </div>
        </AlertBanner>
      </div>
    );
  }

  if (isUnlocked && user) {
    return <AuthenticatedHomeHub data={data} user={user} />;
  }

  return <PublicExhibitionHome data={data} />;
}
