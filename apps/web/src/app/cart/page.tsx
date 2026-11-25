'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  CheckCircle2,
  CreditCard,
  FileText,
  Plus,
  Receipt,
  ShoppingCart,
  Tag,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { apiFetch, formatDate, formatNumber } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  addGuestCartItem,
  getGuestCartItems,
  getGuestWishlistItems,
  type GuestTargetRef,
  removeGuestCartItem,
  toggleGuestWishlistItem,
} from '@/lib/guest-commerce';
import { getOrderStatusMeta } from '@/lib/labels';
import { PageHero } from '@/components/layout/PageHero';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  inputClassName,
} from '@/components/ui/primitives';

export default function CartAndCheckoutPage() {
  const { user, isLoading: loading, pushToast } = useAuth();
  const [cart, setCart] = useState<any>(null);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [guestCart, setGuestCart] = useState<GuestTargetRef[]>([]);
  const [guestWishlist, setGuestWishlist] = useState<GuestTargetRef[]>([]);
  const [catalogCourses, setCatalogCourses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [sellerCode, setSellerCode] = useState('');
  const [clearPrefill, setClearPrefill] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('PAYMOB_CARD');
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const refreshGuestStorage = useCallback(() => {
    setGuestCart(getGuestCartItems());
    setGuestWishlist(getGuestWishlistItems());
  }, []);

  const loadAll = useCallback(async () => {
    refreshGuestStorage();
    try {
      const cat = await apiFetch<any>('/catalog/courses?limit=24');
      setCatalogCourses(Array.isArray(cat?.items) ? cat.items : Array.isArray(cat) ? cat : []);
    } catch {
      // ignore
    }

    if (!user) return;
    try {
      const [c, myOrders, myWish] = await Promise.all([
        apiFetch<any>('/commerce/cart'),
        apiFetch<any[]>('/commerce/orders/my'),
        apiFetch<any[]>('/commerce/wishlist').catch(() => []),
      ]);
      setCart(c);
      setOrders(Array.isArray(myOrders) ? myOrders : []);
      setWishlist(Array.isArray(myWish) ? myWish : []);
      if (c?.prefilledSellerCode && !sellerCode && !clearPrefill) {
        setSellerCode(c.prefilledSellerCode);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر تحميل بيانات السلة');
    }
  }, [user, sellerCode, clearPrefill, refreshGuestStorage]);

  const handleRemoveWishlistItem = async (itemId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/commerce/wishlist/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      pushToast('تمت الإزالة من قائمة الرغبات', 'info');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر إزالة العنصر من المفضلة');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!loading) void loadAll();
  }, [loading, loadAll]);

  const handleAddToCart = async (courseId: string) => {
    setBusy(true);
    setErrorMsg('');
    try {
      const updated = await apiFetch<any>('/commerce/cart/items', {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      });
      setCart(updated);
      setPreview(null);
      pushToast('تمت إضافة الكورس إلى السلة', 'success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر إضافة الكورس');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveFromCart = async (courseId: string) => {
    setBusy(true);
    try {
      const updated = await apiFetch<any>(`/commerce/cart/items/${encodeURIComponent(courseId)}`, {
        method: 'DELETE',
      });
      setCart(updated);
      setPreview(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر حذف الكورس');
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (!cart?.items?.length) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await apiFetch<any>('/commerce/orders/preview', {
        method: 'POST',
        body: JSON.stringify({
          courseIds: cart.items.map((i: any) => i.courseId),
          couponCode: couponCode.trim() || null,
          sellerCode: sellerCode.trim() || null,
          clearSellerPrefill: clearPrefill,
          paymentMethod,
        }),
      });
      setPreview(res);
      pushToast('تم احتساب إجمالي الطلب وتطبيق الأكواد بنجاح', 'success');
    } catch (err: any) {
      setPreview(null);
      setErrorMsg(err?.message || 'تعذر التحقق من الكود أو احتساب الطلب');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckout = async () => {
    if (!cart?.items?.length) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await apiFetch<any>('/commerce/orders', {
        method: 'POST',
        body: JSON.stringify({
          courseIds: cart.items.map((i: any) => i.courseId),
          couponCode: couponCode.trim() || null,
          sellerCode: sellerCode.trim() || null,
          clearSellerPrefill: clearPrefill,
          paymentMethod,
        }),
      });
      pushToast(`تم إنشاء الطلب رقم ${res.order.orderNumber} بنجاح`, 'success');
      setPreview(null);
      setCouponCode('');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر إنشاء الطلب');
    } finally {
      setBusy(false);
    }
  };

  const handleSandboxConfirm = async (orderNumber: string) => {
    setBusy(true);
    setErrorMsg('');
    try {
      await apiFetch(`/commerce/orders/${encodeURIComponent(orderNumber)}/sandbox-confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      pushToast('تم تأكيد السداد الإلكتروني وتفعيل الوصول للكورسات فوراً', 'success');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر تأكيد الدفع التجريبي');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenInvoice = async (orderId: string) => {
    try {
      const inv = await apiFetch<any>(`/commerce/orders/${encodeURIComponent(orderId)}/invoice`);
      setSelectedInvoice(inv);
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر فتح الفاتورة');
    }
  };

  return (
    <PublicPageLayout>
      <PageHero
        badge="سلة الدورات وإتمام الطلب"
        title="شراء الدورات"
        highlight="وإصدار الفواتير"
        subtitle="أضف كورساً واحداً أو عدة كورسات في طلب واحد، وطبّق كوبونات الخصم أو كود البائع، وتابع حالة مدفوعاتك وفواتيرك."
      />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
        {!loading && !user ? (
          <div className="space-y-6">
            <Card className="p-8 text-center space-y-4">
              <ShoppingCart className="mx-auto h-10 w-10 text-[#8CA2FF]" />
              <h2 className="text-xl font-extrabold text-[#EEF0FF]">
                السلة وقائمة المحفوظات قبل تسجيل الدخول
              </h2>
              <p className="text-sm text-[#A9B1E0]">
                يتم حفظ اختياراتك محلياً ونقلها تلقائياً إلى حسابك فور تسجيل الدخول أو التسجيل لإتمام السداد الإلكتروني.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/login?next=/cart">
                  <Button variant="primary">تسجيل الدخول لإتمام الشراء</Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline">إنشاء حساب جديد</Button>
                </Link>
              </div>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 space-y-4">
                <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-[#8CA2FF]" />
                  سلتك المؤقتة ({guestCart.length})
                </h3>
                {guestCart.length === 0 ? (
                  <p className="text-xs text-[#A9B1E0]">لم تضف دورات إلى السلة المؤقتة بعد.</p>
                ) : (
                  <div className="space-y-2.5">
                    {guestCart.map((gc) => (
                      <div
                        key={`${gc.targetType}:${gc.targetId}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#EEF0FF] truncate">{gc.titleAr || gc.slug}</p>
                          {typeof gc.priceCents === 'number' && (
                            <p className="text-[#8CA2FF] tabular-nums">
                              {formatNumber(Math.round(gc.priceCents / 100))} ج.م
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            removeGuestCartItem(gc.targetType, gc.targetId);
                            refreshGuestStorage();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card id="wishlist" className="p-6 space-y-4">
                <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-[#F5B94A]" />
                  قائمة الرغبات المؤقتة ({guestWishlist.length})
                </h3>
                {guestWishlist.length === 0 ? (
                  <p className="text-xs text-[#A9B1E0]">لم تحفظ أي كورسات أو مسارات في المفضلة بعد.</p>
                ) : (
                  <div className="space-y-2.5">
                    {guestWishlist.map((gw) => (
                      <div
                        key={`${gw.targetType}:${gw.targetId}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs"
                      >
                        <span className="font-bold text-[#EEF0FF] truncate">{gw.titleAr || gw.slug}</span>
                        <div className="flex items-center gap-1.5">
                          {gw.targetType === 'COURSE' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                addGuestCartItem(gw);
                                refreshGuestStorage();
                                pushToast('تم النقل إلى السلة المؤقتة', 'success');
                              }}
                            >
                              للسلة
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              toggleGuestWishlistItem(gw);
                              refreshGuestStorage();
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <>
            {errorMsg && <AlertBanner tone="danger" title="تنبيه">{errorMsg}</AlertBanner>}

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Cart Items & Quick Add */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-[#8CA2FF]" />
                      الكورسات في سلتك ({cart?.itemCount ?? 0})
                    </h2>
                    <Link href="/courses">
                      <Button variant="outline" size="sm">استكشف المزيد من الكورسات</Button>
                    </Link>
                  </div>

                  {!cart?.items?.length ? (
                    <div className="rounded-2xl border border-dashed border-[#22307A] p-6 text-center space-y-2">
                      <p className="text-sm font-bold text-[#EEF0FF]">السلة فارغة حالياً</p>
                      <p className="text-xs text-[#A9B1E0]">يمكنك إضافة الكورسات من القائمة أدناه أو من صفحة الكورسات.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.items.map((item: any, idx: number) => (
                        <div
                          key={item.courseId}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#22307A] bg-[#0B1440] p-4"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs font-bold text-[#8CA2FF]">بند #{idx + 1}</p>
                            <Link
                              href={`/courses/${item.slug}`}
                              className="text-sm font-extrabold text-[#EEF0FF] hover:text-[#8CA2FF]"
                            >
                              {item.titleAr}
                            </Link>
                            <div className="flex items-center gap-2 text-xs text-[#A9B1E0]">
                              <Badge tone="info">{item.deliveryMode === 'OFFLINE' ? 'حضوري' : item.deliveryMode === 'HYBRID' ? 'هجين' : 'أونلاين'}</Badge>
                              <span className="font-semibold tabular-nums text-[#EEF0FF]">{formatNumber(item.priceEgp)} ج.م</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => handleRemoveFromCart(item.courseId)}
                          >
                            <Trash2 className="h-4 w-4" />
                            إزالة
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Saved Wishlist */}
                <Card id="wishlist" className="p-6 space-y-4">
                  <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
                    <Bookmark className="h-4 w-4 text-[#F5B94A]" />
                    قائمة الرغبات والمحفوظات ({wishlist.length})
                  </h3>
                  {wishlist.length === 0 ? (
                    <p className="text-xs text-[#A9B1E0]">
                      احفظ أي كورس أو مسار أو دبلومة في المفضلة للوصول السريع لاحقاً.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {wishlist.map((item) => {
                        const title =
                          item.course?.publishedVersion?.titleAr ||
                          item.learningPath?.titleAr ||
                          item.diploma?.titleAr ||
                          'برنامج بوصلة';
                        const slugHref = item.course?.slug
                          ? `/courses/${item.course.slug}`
                          : item.learningPath?.slug
                            ? `/learning-paths/${item.learningPath.slug}`
                            : item.diploma?.slug
                              ? `/diplomas/${item.diploma.slug}`
                              : '/courses';
                        return (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs"
                          >
                            <Link href={slugHref} className="font-bold text-[#EEF0FF] hover:text-[#8CA2FF] truncate">
                              {title}
                            </Link>
                            <div className="flex items-center gap-2">
                              {item.courseId && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  disabled={busy}
                                  onClick={() => void handleAddToCart(item.courseId)}
                                >
                                  أضف للسلة
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void handleRemoveWishlistItem(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* Quick add available courses */}
                {catalogCourses.length > 0 && (
                  <Card className="p-6 space-y-4">
                    <h3 className="text-base font-extrabold text-[#EEF0FF]">أضف كورسات أخرى لطلبك</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {catalogCourses
                        .filter((c) => c.allowIndividualPurchase !== false)
                        .slice(0, 6)
                        .map((c) => {
                          const inCart = cart?.items?.some((i: any) => i.courseId === c.id);
                          return (
                            <div
                              key={c.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[#EEF0FF] truncate">
                                  {c.titleAr || c.publishedVersion?.titleAr || c.slug}
                                </p>
                                <p className="text-xs font-semibold tabular-nums text-[#8CA2FF]">
                                  {formatNumber((c.priceCents ?? 45000) / 100)} ج.م
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant={inCart ? 'outline' : 'primary'}
                                disabled={busy || inCart}
                                onClick={() => handleAddToCart(c.id)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                {inCart ? 'بالسلة' : 'أضف'}
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                  </Card>
                )}
              </div>

              {/* Checkout Summary Sidebar */}
              <div className="space-y-4">
                <Card className="p-6 space-y-4 border border-[#34469E]">
                  <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[#8CA2FF]" />
                    ملخص الطلب والسداد
                  </h2>

                  <Field label="كوبون خصم (اختياري)">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-[#A9B1E0] shrink-0" />
                      <input
                        dir="ltr"
                        className={inputClassName}
                        placeholder="WELCOME10"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                      />
                    </div>
                  </Field>

                  <Field label="كود البائع / الإحالة (اختياري)">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-[#A9B1E0] shrink-0" />
                        <input
                          dir="ltr"
                          className={inputClassName}
                          placeholder="BOSLA2026"
                          value={sellerCode}
                          onChange={(e) => {
                            setSellerCode(e.target.value);
                            setClearPrefill(false);
                          }}
                        />
                      </div>
                      {sellerCode && (
                        <button
                          type="button"
                          className="text-xs font-bold text-[#A9B1E0] hover:text-[#EEF0FF] underline"
                          onClick={() => {
                            setSellerCode('');
                            setClearPrefill(true);
                            setPreview(null);
                          }}
                        >
                          إزالة كود الإحالة من هذا الطلب
                        </button>
                      )}
                    </div>
                  </Field>

                  <Field label="وسيلة السداد">
                    <select
                      className={inputClassName}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="PAYMOB_CARD">بطاقة بنكية إلكترونية (فيزا / ماستركارد / ميزة)</option>
                      <option value="PAYMOB_WALLET">محفظة إلكترونية</option>
                      <option value="BANK_TRANSFER">تحويل بنكي (يتطلب توثيق مالي)</option>
                      <option value="OFFLINE_TRAINING">سداد نقدي / تدريب حضوري بالأكاديمية</option>
                    </select>
                  </Field>

                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={busy || !cart?.items?.length}
                    onClick={handlePreview}
                  >
                    احتساب السعر والتحقق من الأكواد
                  </Button>

                  <div className="rounded-2xl border border-[#22307A] bg-[#0B1440] p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-[#A9B1E0]">
                      <span>المجموع الفرعي</span>
                      <span className="font-semibold tabular-nums text-[#EEF0FF]">
                        {formatNumber(preview?.subtotalEgp ?? cart?.subtotalEgp ?? 0)} ج.م
                      </span>
                    </div>
                    {preview?.discountEgp > 0 && (
                      <div className="flex justify-between text-emerald-300">
                        <span>الخصم (<bdi>{preview.couponCode}</bdi>)</span>
                        <span className="font-semibold tabular-nums">- {formatNumber(preview.discountEgp)} ج.م</span>
                      </div>
                    )}
                    {preview?.sellerCode && (
                      <div className="flex justify-between text-[#8CA2FF] text-xs">
                        <span>كود البائع المطبّق</span>
                        <span dir="ltr" className="font-mono font-bold">{preview.sellerCode}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-[#22307A] pt-2 text-base font-semibold text-[#EEF0FF]">
                      <span>الإجمالي النهائي</span>
                      <span className="tabular-nums">{formatNumber(preview?.totalEgp ?? cart?.subtotalEgp ?? 0)} ج.م</span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={busy || !cart?.items?.length}
                    onClick={handleCheckout}
                  >
                    تأكيد وإنشاء الطلب الآن
                  </Button>
                </Card>
              </div>
            </div>

            {/* Order History & Invoices */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[#8CA2FF]" />
                سجل طلباتي وفواتيري ({orders.length})
              </h2>

              {orders.length === 0 ? (
                <p className="text-sm text-[#A9B1E0]">لا توجد طلبات مسجلة حتى الآن.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-start">
                    <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                      <tr>
                        <th className="py-2 px-3">رقم الطلب</th>
                        <th className="py-2 px-3">البنود</th>
                        <th className="py-2 px-3">الإجمالي</th>
                        <th className="py-2 px-3">المدفوع</th>
                        <th className="py-2 px-3">الحالة</th>
                        <th className="py-2 px-3">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#22307A]/60">
                      {orders.map((ord) => {
                        const meta = getOrderStatusMeta(ord.status);
                        return (
                          <tr key={ord.id}>
                            <td dir="ltr" className="py-3 px-3 font-mono font-bold text-[#8CA2FF]">
                              {ord.orderNumber}
                            </td>
                            <td className="py-3 px-3 text-[#EEF0FF]">
                              {(ord.items || []).map((it: any) => it.courseTitleSnapshotAr).join(' + ')}
                            </td>
                            <td className="py-3 px-3 font-semibold tabular-nums text-[#EEF0FF]">
                              {formatNumber(Number(ord.totalAmount))} ج.م
                            </td>
                            <td className="py-3 px-3 font-semibold tabular-nums text-emerald-300">
                              {formatNumber(Number(ord.paidAmount))} ج.م
                            </td>
                            <td className="py-3 px-3">
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleOpenInvoice(ord.id)}>
                                  <FileText className="h-3.5 w-3.5" />
                                  الفاتورة
                                </Button>
                                {(ord.status === 'PENDING_PAYMENT' || ord.status === 'PARTIALLY_PAID') && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    disabled={busy}
                                    onClick={() => handleSandboxConfirm(ord.orderNumber)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    تأكيد السداد الإلكتروني
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </section>

      <NativeModal
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice ? `فاتورة رسمية — ${selectedInvoice.invoiceNumber}` : 'فاتورة'}
      >
        {selectedInvoice && (
          <div className="space-y-4 text-sm text-[#EEF0FF]">
            <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 space-y-1">
              <p className="font-extrabold text-[#8CA2FF]">{selectedInvoice.issuerAr}</p>
              <p>العميل: {selectedInvoice.customer?.fullName}</p>
              <p>رقم الطلب: <span dir="ltr" className="font-mono">{selectedInvoice.orderNumber}</span></p>
              <p>تاريخ الإصدار: {formatDate(selectedInvoice.issuedAt)}</p>
            </div>
            <div className="space-y-2">
              {selectedInvoice.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between rounded-lg border border-[#22307A] p-3">
                  <span>{item.titleAr}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(item.finalPriceEgp)} ج.م</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-4 space-y-1 tabular-nums">
              <div className="flex justify-between"><span>الإجمالي</span><span className="font-semibold">{formatNumber(selectedInvoice.totalEgp)} ج.م</span></div>
              <div className="flex justify-between text-emerald-300"><span>المدفوع</span><span className="font-semibold">{formatNumber(selectedInvoice.paidEgp)} ج.م</span></div>
              <div className="flex justify-between text-amber-300"><span>المتبقي</span><span className="font-semibold">{formatNumber(selectedInvoice.remainingEgp)} ج.م</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => window.print()}>طباعة الفاتورة</Button>
              <Button variant="primary" onClick={() => setSelectedInvoice(null)}>إغلاق</Button>
            </div>
          </div>
        )}
      </NativeModal>
    </PublicPageLayout>
  );
}
