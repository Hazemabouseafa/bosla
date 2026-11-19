'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Lock,
  PlayCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { apiFetch, formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/primitives';

export function SmartLearningCta({
  kind,
  targetId,
  slug,
  isFree,
  priceCents = 0,
  compareAtPriceCents,
  includedInMembership = true,
  allowIndividualPurchase = true,
  firstCourseSlug,
  communityEnabled = true,
}: {
  kind: 'course' | 'path' | 'diploma';
  targetId: string;
  slug: string;
  isFree?: boolean;
  priceCents?: number;
  compareAtPriceCents?: number | null;
  includedInMembership?: boolean;
  allowIndividualPurchase?: boolean;
  firstCourseSlug?: string | null;
  communityEnabled?: boolean;
}) {
  const router = useRouter();
  const { user, pushToast } = useAuth();
  const [hasAccess, setHasAccess] = useState(Boolean(isFree));
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (isFree) {
      setHasAccess(true);
      return;
    }
    if (!user) {
      setHasAccess(false);
      return;
    }
    if (user.role === 'ADMIN' || user.role === 'INSTRUCTOR') {
      setHasAccess(true);
      return;
    }
    let cancelled = false;
    apiFetch<any>('/memberships/my-summary')
      .then((res) => {
        if (cancelled) return;
        const directMatched =
          kind === 'course'
            ? res?.directPurchases?.some((p: any) => p.courseId === targetId) ||
              res?.entitledCourseIds?.includes(targetId)
            : kind === 'path'
              ? res?.entitledPathIds?.includes(targetId)
              : res?.entitledDiplomaIds?.includes(targetId);
        // For items excluded from monthly/annual membership, only direct purchase unlocks access
        if (!includedInMembership) {
          const boughtDirect = (res?.directPurchases ?? []).some((p: any) =>
            kind === 'course'
              ? p.courseId === targetId
              : kind === 'path'
                ? p.learningPathId === targetId
                : p.diplomaId === targetId,
          );
          setHasAccess(Boolean(boughtDirect || directMatched));
          return;
        }
        setHasAccess(Boolean(directMatched));
      })
      .catch(() => {
        if (!cancelled) setHasAccess(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, kind, targetId, isFree, includedInMembership]);

  const handleDirectPurchase = async () => {
    if (!user) {
      const nextUrl =
        kind === 'course'
          ? `/courses/${slug}`
          : kind === 'path'
            ? `/learning-paths/${slug}`
            : `/diplomas/${slug}`;
      router.push(`/login?next=${encodeURIComponent(nextUrl)}`);
      return;
    }
    setBuying(true);
    try {
      const targetType =
        kind === 'course'
          ? 'COURSE'
          : kind === 'path'
            ? 'LEARNING_PATH'
            : 'DIPLOMA';
      const res = await apiFetch<{ checkoutUrl: string }>('/memberships/checkout-item', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId }),
      });
      if (res?.checkoutUrl) {
        router.push(res.checkoutUrl);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر بدء عملية الدفع الإلكتروني', 'error');
    } finally {
      setBuying(false);
    }
  };

  const canBuyStandalone = !isFree && allowIndividualPurchase && Number(priceCents) > 0;

  if (kind === 'course') {
    return (
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/learn/${slug}`}>
            <Button variant="primary" size="lg">
              <PlayCircle className="h-5 w-5" />
              دخول مشغل الكورس والدروس
            </Button>
          </Link>
          {communityEnabled && (
            <Link href={`/courses/${slug}/community`}>
              <Button variant="outline" size="lg">
                <Users className="h-5 w-5" />
                مجتمع الكورس
              </Button>
            </Link>
          )}
          {hasAccess ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#77E2B5]/40 bg-[#77E2B5]/15 px-4 py-2 text-xs font-extrabold text-[#77E2B5]">
              <CheckCircle2 className="h-4 w-4 text-[#77E2B5]" />
              {isFree ? 'محتوى مجاني مفتوح لك' : 'متاح ومفعّل في حسابك'}
            </span>
          ) : (
            <>
              {canBuyStandalone && (
                <Button
                  id="direct-buy-course-btn"
                  type="button"
                  variant="gold"
                  size="lg"
                  disabled={buying}
                  onClick={() => void handleDirectPurchase()}
                >
                  <CreditCard className="h-4 w-4" />
                  {buying
                    ? 'جاري تجهيز الدفع...'
                    : `شراء الكورس منفرداً (${formatEgp(priceCents)})`}
                </Button>
              )}
              {includedInMembership ? (
                <Link href="/pricing">
                  <Button variant="outline" size="lg">
                    أو اشترك في العضوية الشاملة
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F5B94A]/45 bg-[#F5B94A]/15 px-3.5 py-2 text-xs font-bold text-[#F5B94A]">
                  <Lock className="h-3.5 w-3.5" />
                  غير مشمول في الاشتراك الشهري والسنوي — يتطلب شراء الكورس منفرداً
                </span>
              )}
            </>
          )}
        </div>
        {canBuyStandalone && !hasAccess && compareAtPriceCents && compareAtPriceCents > priceCents && (
          <p className="text-xs text-[#A9B1E0]">
            السعر الفردي: <strong className="text-[#F5B94A]">{formatEgp(priceCents)}</strong>{' '}
            <s className="text-[#A9B1E0]/70">{formatEgp(compareAtPriceCents)}</s> (وصول دائم لهذا الكورس دون التزام شهري)
          </p>
        )}
      </div>
    );
  }

  const startSlug = firstCourseSlug;
  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        {startSlug && (
          <Link href={`/learn/${startSlug}`}>
            <Button variant="primary" size="lg">
              <PlayCircle className="h-5 w-5" />
              {kind === 'path' ? 'ابدأ بالكورس الأول في المسار' : 'ابدأ دراسة الدبلومة الآن'}
            </Button>
          </Link>
        )}
        {hasAccess ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#77E2B5]/40 bg-[#77E2B5]/15 px-4 py-2 text-xs font-extrabold text-[#77E2B5]">
            <CheckCircle2 className="h-4 w-4 text-[#77E2B5]" />
            مفعّل في حسابك
          </span>
        ) : (
          <>
            {canBuyStandalone && (
              <Button
                id={`direct-buy-${kind}-btn`}
                type="button"
                variant="gold"
                size="lg"
                disabled={buying}
                onClick={() => void handleDirectPurchase()}
              >
                <CreditCard className="h-4 w-4" />
                {buying
                  ? 'جاري تجهيز الدفع...'
                  : kind === 'path'
                    ? `شراء المسار كاملاً (${formatEgp(priceCents)})`
                    : `شراء البرنامج / الدبلومة (${formatEgp(priceCents)})`}
              </Button>
            )}
            {includedInMembership ? (
              <Link href="/pricing">
                <Button variant={startSlug ? 'outline' : 'primary'} size="lg">
                  <Sparkles className="h-4 w-4" />
                  {kind === 'path' ? 'أو اشترك في العضوية الشاملة' : 'أو اشترك عبر باقات العضوية'}
                </Button>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F5B94A]/45 bg-[#F5B94A]/15 px-3.5 py-2 text-xs font-bold text-[#F5B94A]">
                <Lock className="h-3.5 w-3.5" />
                برنامج خاص غير مشمول في العضوية الشهرية أو السنوية
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
