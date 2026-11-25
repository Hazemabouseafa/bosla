'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Bookmark,
  CheckCircle2,
  CreditCard,
  Lock,
  PlayCircle,
  ShoppingCart,
  Tag,
  Users,
} from 'lucide-react';
import { apiFetch, formatEgp } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  addGuestCartItem,
  isInGuestWishlist,
  toggleGuestWishlistItem,
} from '@/lib/guest-commerce';
import { Button, inputClassName } from '@/components/ui/primitives';

export function SmartLearningCta({
  kind,
  targetId,
  slug,
  titleAr,
  thumbnailUrl,
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
  titleAr?: string;
  thumbnailUrl?: string | null;
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
  const [addingCart, setAddingCart] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [togglingWish, setTogglingWish] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<{
    discountCents: number;
    finalAmountCents: number;
    couponCode: string;
  } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

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
    apiFetch<any>('/memberships/me')
      .then((res) => {
        if (cancelled) return;
        const directMatched =
          kind === 'course'
            ? res?.directPurchases?.some((p: any) => p.courseId === targetId) ||
              res?.entitledCourseIds?.includes(targetId)
            : kind === 'path'
              ? res?.entitledPathIds?.includes(targetId)
              : res?.entitledDiplomaIds?.includes(targetId);
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

  const targetType =
    kind === 'course' ? 'COURSE' : kind === 'path' ? 'LEARNING_PATH' : 'DIPLOMA';

  useEffect(() => {
    if (!user) {
      setInWishlist(isInGuestWishlist(targetType, targetId));
      return;
    }
    apiFetch<any[]>('/commerce/wishlist')
      .then((list) => {
        if (!Array.isArray(list)) return;
        const found = list.some(
          (w) =>
            w.targetType === targetType &&
            (w.courseId === targetId || w.learningPathId === targetId || w.diplomaId === targetId),
        );
        setInWishlist(found);
      })
      .catch(() => {});
  }, [user, targetType, targetId]);

  const handleToggleWishlist = async () => {
    if (!user) {
      const added = toggleGuestWishlistItem({
        targetType,
        targetId,
        titleAr: titleAr || slug,
        slug,
        priceCents,
        thumbnailUrl,
      });
      setInWishlist(added);
      pushToast(
        added ? 'تم الحفظ في قائمة الرغبات المؤقتة' : 'تمت الإزالة من قائمة الرغبات',
        'info',
      );
      return;
    }
    setTogglingWish(true);
    try {
      const res = await apiFetch<any>('/commerce/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId }),
      });
      const added = Boolean(res?.saved ?? res?.inWishlist ?? !inWishlist);
      setInWishlist(added);
      pushToast(added ? 'تم الحفظ في المفضلة' : 'تمت الإزالة من المفضلة', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث قائمة الرغبات', 'error');
    } finally {
      setTogglingWish(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponPreview(null);
      return;
    }
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
    setCheckingCoupon(true);
    try {
      const res = await apiFetch<any>('/memberships/checkout-item/preview', {
        method: 'POST',
        body: JSON.stringify({
          targetType,
          targetId,
          couponCode: couponCode.trim(),
        }),
      });
      if (res?.discountCents > 0) {
        setCouponPreview({
          discountCents: res.discountCents,
          finalAmountCents: res.finalAmountCents,
          couponCode: res.couponCode || couponCode.trim(),
        });
        pushToast('تم تطبيق كوبون الخصم بنجاح', 'success');
      } else {
        setCouponPreview(null);
      }
    } catch (err: any) {
      setCouponPreview(null);
      pushToast(err?.message || 'كوبون الخصم غير صالح لهذا المحتوى', 'error');
    } finally {
      setCheckingCoupon(false);
    }
  };

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
      const res = await apiFetch<{ checkoutUrl: string }>('/memberships/checkout-item', {
        method: 'POST',
        body: JSON.stringify({
          targetType,
          targetId,
          couponCode: couponCode.trim() || undefined,
        }),
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

  const handleAddToCart = async () => {
    if (!user) {
      addGuestCartItem({
        targetType: 'COURSE',
        targetId,
        titleAr: titleAr || slug,
        slug,
        priceCents,
        thumbnailUrl,
      });
      pushToast('تم حفظ الكورس في سلتك المؤقتة — سجّل دخولك عند إتمام الشراء', 'success');
      router.push('/cart');
      return;
    }
    setAddingCart(true);
    try {
      await apiFetch('/commerce/cart/items', {
        method: 'POST',
        body: JSON.stringify({ courseId: targetId }),
      });
      pushToast('تمت إضافة الكورس إلى سلة المشتريات', 'success');
      router.push('/cart');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الإضافة للسلة', 'error');
    } finally {
      setAddingCart(false);
    }
  };

  const canBuyStandalone = !isFree && allowIndividualPurchase && Number(priceCents) > 0;
  const effectivePriceCents = couponPreview?.finalAmountCents ?? priceCents;

  const couponBar = canBuyStandalone && !hasAccess && (
    <div className="flex flex-wrap items-center gap-2 pt-1 max-w-md">
      <div className="relative flex-1 min-w-[180px]">
        <input
          dir="ltr"
          data-testid={`direct-coupon-input-${kind}`}
          className={`${inputClassName} py-1.5 text-xs`}
          placeholder="كود خصم (اختياري)"
          value={couponCode}
          onChange={(e) => {
            setCouponCode(e.target.value);
            if (!e.target.value.trim()) setCouponPreview(null);
          }}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={checkingCoupon || !couponCode.trim()}
        onClick={() => void handleApplyCoupon()}
      >
        <Tag className="h-3.5 w-3.5" />
        {checkingCoupon ? 'تحقق...' : 'تطبيق الكود'}
      </Button>
      {couponPreview && (
        <span className="text-xs font-extrabold text-[#77E2B5]">
          خصم {formatEgp(couponPreview.discountCents)} — الإجمالي: {formatEgp(couponPreview.finalAmountCents)}
        </span>
      )}
    </div>
  );

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
                <>
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
                      : `شراء الكورس منفرداً (${formatEgp(effectivePriceCents)})`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={addingCart}
                    onClick={() => void handleAddToCart()}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {addingCart ? 'جاري الإضافة...' : 'أضف للسلة'}
                  </Button>
                </>
              )}
              {includedInMembership ? (
                <Link href="/pricing">
                  <Button variant="outline" size="lg">
                    أو اشترك في العضوية الشاملة
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C084FC]/40 bg-[#6B21A8]/18 px-3.5 py-2 text-xs font-bold text-[#E9D5FF]">
                  <Lock className="h-3.5 w-3.5 text-[#C084FC]" />
                  غير مشمول في الاشتراك الشهري والسنوي — يتطلب شراء الكورس منفرداً
                </span>
              )}
            </>
          )}
          <Button
            type="button"
            variant={inWishlist ? 'secondary' : 'outline'}
            size="lg"
            aria-pressed={inWishlist}
            disabled={togglingWish}
            onClick={() => void handleToggleWishlist()}
          >
            <Bookmark className={`h-4 w-4 ${inWishlist ? 'fill-current text-[#F5B94A]' : ''}`} />
            {inWishlist ? 'محفوظ في الرغبات' : 'حفظ للمفضلة'}
          </Button>
        </div>
        {couponBar}
        {canBuyStandalone && !hasAccess && compareAtPriceCents && compareAtPriceCents > priceCents && (
          <p className="text-xs text-[#A9B1E0]">
            السعر الفردي: <strong className="text-[#E9D5FF] tabular-nums">{formatEgp(effectivePriceCents)}</strong>{' '}
            <s className="text-[#A9B1E0]/70 tabular-nums">{formatEgp(compareAtPriceCents)}</s> (وصول دائم لهذا الكورس دون التزام شهري)
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
                    ? `شراء المسار كاملاً (${formatEgp(effectivePriceCents)})`
                    : `شراء البرنامج / الدبلومة (${formatEgp(effectivePriceCents)})`}
              </Button>
            )}
            {includedInMembership ? (
              <Link href="/pricing">
                <Button variant={startSlug ? 'outline' : 'primary'} size="lg">
                  <Award className="h-4 w-4" />
                  {kind === 'path' ? 'أو اشترك في العضوية الشاملة' : 'أو اشترك عبر باقات العضوية'}
                </Button>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C084FC]/40 bg-[#6B21A8]/18 px-3.5 py-2 text-xs font-bold text-[#E9D5FF]">
                <Lock className="h-3.5 w-3.5 text-[#C084FC]" />
                برنامج خاص غير مشمول في العضوية الشهرية أو السنوية
              </span>
            )}
          </>
        )}
      </div>
      {couponBar}
    </div>
  );
}
