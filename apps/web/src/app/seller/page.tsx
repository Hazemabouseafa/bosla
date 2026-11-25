'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BadgeDollarSign,
  Bell,
  Clock,
  Copy,
  Download,
  FileText,
  LayoutDashboard,
  Megaphone,
  QrCode,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { apiFetch, formatDate, formatNumber } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  getCommissionStatusMeta,
  getOrderStatusMeta,
  getPayoutStatusMeta,
  getSellerStatusMeta,
} from '@/lib/labels';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { BentoKpiCard } from '@/components/dashboard/DashboardWidgets';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  inputClassName,
} from '@/components/ui/primitives';

type SellerTab = 'overview' | 'codes' | 'orders' | 'commissions' | 'payouts' | 'materials' | 'notifications';

export default function SellerPortalPage() {
  const { user, isLoading: loading, pushToast } = useAuth();
  const [tab, setTab] = useState<SellerTab>('overview');
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedPayout, setSelectedPayout] = useState<any>(null);

  // Seller application form state
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    nationalIdNumber: '',
    idDocumentUrl: '/uploads/kyc-id-document.pdf',
    experienceSummaryAr: '',
    marketingChannelsAr: '',
    payoutMethodType: 'BANK_TRANSFER',
    payoutAccountName: '',
    payoutAccountDetails: '',
  });

  const loadPortal = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<any>('/sellers/portal');
      setData(res);
      if (!res?.hasSellerProfile) {
        setForm((prev) => ({
          ...prev,
          fullName: prev.fullName || user.fullName || '',
          phoneNumber: prev.phoneNumber || user.phoneE164 || '',
          email: prev.email || user.email || '',
        }));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر تحميل بوابة البائع');
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) void loadPortal();
  }, [loading, user, loadPortal]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      await apiFetch('/sellers/apply', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      pushToast('تم إرسال طلب الانضمام كبائع بنجاح وسيتم مراجعته من الإدارة', 'success');
      await loadPortal();
    } catch (err: any) {
      setErrorMsg(err?.message || 'يرجى استكمال كافة البيانات المطلوبة');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast(`تم نسخ ${label}`, 'success');
    } catch {
      pushToast('تعذر النسخ التلقائي', 'error');
    }
  };

  const handleDownloadQr = (code: string, qrSvg: string) => {
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bosla-seller-${code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenPayoutDetail = async (payoutId: string) => {
    try {
      const detail = await apiFetch<any>(`/sellers/portal/payouts/${encodeURIComponent(payoutId)}`);
      setSelectedPayout(detail);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر عرض تفاصيل التسوية', 'error');
    }
  };

  if (!loading && !user) {
    return (
      <PublicPageLayout>
        <section className="mx-auto max-w-xl px-4 py-16">
          <Card className="p-8 text-center space-y-4">
            <BadgeDollarSign className="mx-auto h-10 w-10 text-[#8CA2FF]" />
            <h1 className="text-2xl font-extrabold text-[#EEF0FF]">بوابة البائعين والتسويق بالعمولة</h1>
            <p className="text-sm text-[#A9B1E0]">
              سجّل دخولك للتقديم كبائع فردي معتمد، الحصول على كود الإحالة ورمز QR، ومتابعة عمولاتك وتسوياتك الشهرية.
            </p>
            <Link href="/login"><Button variant="primary">تسجيل الدخول</Button></Link>
          </Card>
        </section>
      </PublicPageLayout>
    );
  }

  // Application form view for non-sellers or rejected/changes_requested applicants
  if (data && (!data.hasSellerProfile || data.status === 'CHANGES_REQUESTED' || data.status === 'REJECTED')) {
    return (
      <PublicPageLayout>
        <section className="mx-auto max-w-3xl px-4 py-12 space-y-6">
          <Card className="p-6 sm:p-8 space-y-6 border border-[#22307A] bg-[#0F1A4A]">
            <div className="space-y-2">
              <Badge tone="purple">برنامج البائعين الأفراد — الإصدار 1.2</Badge>
              <h1 className="text-2xl font-extrabold text-[#EEF0FF]">التقديم كبائع معتمد في أكاديمية بوصلة</h1>
              <p className="text-sm text-[#A9B1E0]">
                احصل على كود إحالة خاص ورمز QR وعمولات ثابتة واضحة على كل كورس مباع عبرك مع لوحة متابعة وتسويات شهرية شفافة.
              </p>
            </div>

            {data.status === 'CHANGES_REQUESTED' && (
              <AlertBanner tone="warning" title="مطلوب تعديلات على طلبك السابق">
                {data.seller?.applications?.[0]?.reviewNotesAr || 'يرجى تحديث البيانات وإعادة الإرسال.'}
              </AlertBanner>
            )}
            {data.status === 'REJECTED' && (
              <AlertBanner tone="danger" title="تم رفض الطلب السابق">
                {data.seller?.applications?.[0]?.reviewNotesAr || 'يمكنك تعديل بياناتك وإعادة التقديم.'}
              </AlertBanner>
            )}
            {errorMsg && <AlertBanner tone="danger" title="خطأ">{errorMsg}</AlertBanner>}

            <form onSubmit={handleApply} className="grid gap-4 sm:grid-cols-2">
              <Field label="الاسم الكامل (كما في الهوية)">
                <input className={inputClassName} required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <Field label="رقم الهاتف">
                <input dir="ltr" className={inputClassName} required value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
              </Field>
              <Field label="البريد الإلكتروني">
                <input dir="ltr" type="email" className={inputClassName} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="رقم الهوية الوطنية">
                <input dir="ltr" className={inputClassName} required value={form.nationalIdNumber} onChange={(e) => setForm({ ...form, nationalIdNumber: e.target.value })} />
              </Field>
              <Field label="رابط مستند إثبات الهوية (KYC)">
                <input dir="ltr" className={inputClassName} required value={form.idDocumentUrl} onChange={(e) => setForm({ ...form, idDocumentUrl: e.target.value })} />
              </Field>
              <Field label="وسيلة استلام المستحقات">
                <select className={inputClassName} value={form.payoutMethodType} onChange={(e) => setForm({ ...form, payoutMethodType: e.target.value })}>
                  <option value="BANK_TRANSFER">تحويل بنكي</option>
                  <option value="INSTAPAY">إنستاباي (InstaPay)</option>
                  <option value="VODAFONE_CASH">محفظة إلكترونية</option>
                  <option value="WALLET">محفظة رقمية أخرى</option>
                </select>
              </Field>
              <Field label="اسم صاحب حساب التحويل">
                <input className={inputClassName} required value={form.payoutAccountName} onChange={(e) => setForm({ ...form, payoutAccountName: e.target.value })} />
              </Field>
              <Field label="رقم الحساب / IBAN / المحفظة">
                <input dir="ltr" className={inputClassName} required value={form.payoutAccountDetails} onChange={(e) => setForm({ ...form, payoutAccountDetails: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="قنواتك التسويقية (اختياري)">
                  <input className={inputClassName} value={form.marketingChannelsAr} onChange={(e) => setForm({ ...form, marketingChannelsAr: e.target.value })} placeholder="فيسبوك، لينكدإن، مجموعات متخصصة..." />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="نبذة عن خبرتك في التسويق أو المبيعات">
                  <textarea rows={3} required className={inputClassName} value={form.experienceSummaryAr} onChange={(e) => setForm({ ...form, experienceSummaryAr: e.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" disabled={busy}>
                  {busy ? 'جاري الإرسال...' : 'إرسال طلب الانضمام كبائع'}
                </Button>
              </div>
            </form>
          </Card>
        </section>
      </PublicPageLayout>
    );
  }

  const navItems: DashboardNavItem[] = [
    { id: 'overview', label: 'ملخص الأداء', group: 'الأداء والتسويق', icon: <LayoutDashboard className="h-4 w-4" />, active: tab === 'overview', onClick: () => setTab('overview') },
    { id: 'codes', label: 'الأكواد والروابط و QR', group: 'الأداء والتسويق', icon: <QrCode className="h-4 w-4" />, active: tab === 'codes', onClick: () => setTab('codes'), badge: data?.codes?.length },
    { id: 'materials', label: 'المواد التسويقية', group: 'الأداء والتسويق', icon: <Megaphone className="h-4 w-4" />, active: tab === 'materials', onClick: () => setTab('materials') },
    { id: 'orders', label: 'الطلبات المنسوبة', group: 'المبيعات والعمولات', icon: <ShoppingBag className="h-4 w-4" />, active: tab === 'orders', onClick: () => setTab('orders'), badge: data?.orders?.length },
    { id: 'commissions', label: 'سجل العمولات', group: 'المبيعات والعمولات', icon: <BadgeDollarSign className="h-4 w-4" />, active: tab === 'commissions', onClick: () => setTab('commissions'), badge: data?.commissions?.length },
    { id: 'payouts', label: 'التسويات والصرف', group: 'المبيعات والعمولات', icon: <Wallet className="h-4 w-4" />, active: tab === 'payouts', onClick: () => setTab('payouts'), badge: data?.payouts?.length },
    { id: 'notifications', label: 'الإشعارات', group: 'الحساب والتنبيهات', icon: <Bell className="h-4 w-4" />, active: tab === 'notifications', onClick: () => setTab('notifications') },
  ];

  const sellerMeta = getSellerStatusMeta(data?.status);
  const summary = data?.summary || {};

  return (
    <DashboardShell
      portalBadge="بوابة البائع المعتمد"
      portalTitle="لوحة البائع والعمولات"
      portalSubtitle="متابعة حصرية لبياناتك، أكوادك، مبيعاتك، عمولاتك، وتسوياتك الشهرية"
      navItems={navItems}
      sidebarCtaLabel="العودة للمتجر"
      sidebarCtaHref="/courses"
    >
      <div className="space-y-6">
        {data?.status === 'PENDING' && (
          <AlertBanner tone="warning" title="طلبك قيد المراجعة الإدارية">
            تم استلام ملفك بنجاح وسيتم تفعيل أكواد الإحالة فور اعتماد الطلب والتحقق من بياناتك.
          </AlertBanner>
        )}
        {data?.status === 'SUSPENDED' && (
          <AlertBanner tone="danger" title="حساب البائع موقوف مؤقتاً">
            {data.seller?.suspensionReasonAr || 'تم تجميد الأكواد والصرفيات لحين مراجعة الإدارة.'}
          </AlertBanner>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#22307A] bg-[#0F1A4A] p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-[#EEF0FF]">{data?.seller?.fullName}</h2>
              <Badge tone={sellerMeta.tone}>{sellerMeta.label}</Badge>
            </div>
            <p className="text-xs text-[#A9B1E0]">
              وسيلة الصرف: {data?.seller?.payoutMethodType} — {data?.seller?.payoutAccountName} ({data?.seller?.kycVerified && data?.seller?.payoutVerified ? 'موثّق للصرف' : 'بانتظار التوثيق'})
            </p>
          </div>
          <p className="text-xs font-bold text-[#8CA2FF]">
            الحد الأدنى للصرف الشهري: {formatNumber(data?.seller?.minPayoutAmount ?? 500)} ج.م
          </p>
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <BentoKpiCard value={`${formatNumber(summary.totalSalesEgp ?? 0)} ج.م`} label="إجمالي المبيعات المحصّلة" delta={`${formatNumber(summary.totalAttributedOrders ?? 0)} طلبات / ${formatNumber(summary.totalSoldCourses ?? 0)} دورات`} icon={<ShoppingBag className="h-5 w-5" />} />
              <BentoKpiCard value={`${formatNumber(summary.onHoldCommissionsEgp ?? 0)} ج.م`} label="عمولات قيد الانتظار (14 يوماً)" deltaTone="warning" icon={<Clock className="h-5 w-5" />} />
              <BentoKpiCard value={`${formatNumber((summary.eligibleCommissionsEgp ?? 0) + (summary.approvedCommissionsEgp ?? 0))} ج.م`} label="مؤهلة ومعتمدة للصرف" delta={`معتمدة: ${formatNumber(summary.approvedCommissionsEgp ?? 0)} ج.م`} deltaTone="info" icon={<BadgeDollarSign className="h-5 w-5" />} />
              <BentoKpiCard value={`${formatNumber(summary.paidCommissionsEgp ?? 0)} ج.م`} label="إجمالي العمولات المصروفة" delta={summary.openReversalDebitEgp > 0 ? `مديونية عكس: ${formatNumber(summary.openReversalDebitEgp)} ج.م` : 'رصيد سليم'} deltaTone={summary.openReversalDebitEgp > 0 ? 'danger' : 'success'} icon={<Wallet className="h-5 w-5" />} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-[#A9B1E0]">عمولات مؤهلة (ELIGIBLE)</p>
                <p className="text-xl font-semibold tabular-nums text-[#EEF0FF]">{formatNumber(summary.eligibleCommissionsEgp ?? 0)} ج.م</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-[#A9B1E0]">تسويات قيد الاعتماد / الصرف</p>
                <p className="text-xl font-semibold tabular-nums text-[#8CA2FF]">{formatNumber(summary.pendingPayoutsEgp ?? 0)} ج.م</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-[#A9B1E0]">عمولات معكوسة (مستردة)</p>
                <p className="text-xl font-semibold tabular-nums text-rose-300">{formatNumber(summary.reversedCommissionsEgp ?? 0)} ج.م</p>
              </Card>
            </div>
          </div>
        )}

        {tab === 'codes' && (
          <div className="grid gap-5 md:grid-cols-2">
            {(data?.codes || []).length === 0 ? (
              <Card className="p-6 text-sm text-[#A9B1E0]">لم تصدر لك أكواد إحالة بعد.</Card>
            ) : (
              data.codes.map((c: any) => (
                <Card key={c.id} className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span dir="ltr" className="text-xl font-mono font-extrabold text-[#8CA2FF]">{c.code}</span>
                    <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'نشط' : 'موقوف'}</Badge>
                  </div>
                  <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs break-all" dir="ltr">
                    {c.referralUrl}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="primary" onClick={() => handleCopy(c.code, 'الكود')}>
                      <Copy className="h-3.5 w-3.5" /> نسخ الكود
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCopy(c.referralUrl, 'رابط الإحالة')}>
                      <Copy className="h-3.5 w-3.5" /> نسخ الرابط
                    </Button>
                    {c.qrSvg && (
                      <Button size="sm" variant="outline" onClick={() => handleDownloadQr(c.code, c.qrSvg)}>
                        <Download className="h-3.5 w-3.5" /> تحميل QR
                      </Button>
                    )}
                  </div>
                  {c.qrSvg && (
                    <div
                      className="inline-block rounded-xl bg-white p-2"
                      dangerouslySetInnerHTML={{ __html: c.qrSvg }}
                    />
                  )}
                  <p className="text-xs text-[#A9B1E0]">مرات الاستخدام: {c.usageCount}</p>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'orders' && (
          <Card className="p-5 overflow-x-auto">
            <h3 className="text-base font-extrabold text-[#EEF0FF] mb-4">الطلبات المنسوبة لك ({data?.orders?.length ?? 0})</h3>
            <table className="w-full text-sm text-start">
              <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                <tr>
                  <th className="py-2 px-3">رقم الطلب</th>
                  <th className="py-2 px-3">الكود</th>
                  <th className="py-2 px-3">الكورسات</th>
                  <th className="py-2 px-3">المحصّل</th>
                  <th className="py-2 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22307A]/60">
                {(data?.orders || []).map((o: any) => {
                  const meta = getOrderStatusMeta(o.status);
                  return (
                    <tr key={o.id}>
                      <td dir="ltr" className="py-3 px-3 font-mono text-[#8CA2FF]">{o.orderNumber}</td>
                      <td dir="ltr" className="py-3 px-3 font-mono">{o.sellerCodeSnapshot}</td>
                      <td className="py-3 px-3">{(o.items || []).map((i: any) => i.courseTitleSnapshotAr).join('، ')}</td>
                      <td className="py-3 px-3 font-semibold tabular-nums">{formatNumber(Number(o.paidAmount))} ج.م</td>
                      <td className="py-3 px-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'commissions' && (
          <Card className="p-5 overflow-x-auto">
            <h3 className="text-base font-extrabold text-[#EEF0FF] mb-4">سجل العمولات التفصيلي ({data?.commissions?.length ?? 0})</h3>
            <table className="w-full text-sm text-start">
              <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                <tr>
                  <th className="py-2 px-3">الطلب</th>
                  <th className="py-2 px-3">الكورس</th>
                  <th className="py-2 px-3">المطبّقة</th>
                  <th className="py-2 px-3">المعكوسة</th>
                  <th className="py-2 px-3">الصافي</th>
                  <th className="py-2 px-3">الاستحقاق (القاهرة)</th>
                  <th className="py-2 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22307A]/60">
                {(data?.commissions || []).map((c: any) => {
                  const meta = getCommissionStatusMeta(c.status);
                  return (
                    <tr key={c.id}>
                      <td dir="ltr" className="py-3 px-3 font-mono text-[#8CA2FF]">{c.order?.orderNumber}</td>
                      <td className="py-3 px-3">{c.course?.publishedVersion?.titleAr || c.course?.slug}</td>
                      <td className="py-3 px-3 tabular-nums">{formatNumber(Number(c.appliedAmount))} ج.م</td>
                      <td className="py-3 px-3 tabular-nums text-rose-300">{formatNumber(Number(c.reversedAmount))} ج.م</td>
                      <td className="py-3 px-3 font-semibold tabular-nums text-emerald-300">{formatNumber(Number(c.netAmount))} ج.م</td>
                      <td className="py-3 px-3 text-xs tabular-nums text-[#A9B1E0]">{formatDate(c.eligibleAt)}</td>
                      <td className="py-3 px-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'payouts' && (
          <Card className="p-5 overflow-x-auto">
            <h3 className="text-base font-extrabold text-[#EEF0FF] mb-4">كشوف التسوية الشهرية وسجل الصرف</h3>
            <table className="w-full text-sm text-start">
              <thead className="border-b border-[#22307A] text-xs text-[#A9B1E0]">
                <tr>
                  <th className="py-2 px-3">رقم التسوية</th>
                  <th className="py-2 px-3">الشهر</th>
                  <th className="py-2 px-3">الإجمالي</th>
                  <th className="py-2 px-3">خصم عكس</th>
                  <th className="py-2 px-3">صافي الصرف</th>
                  <th className="py-2 px-3">الحالة</th>
                  <th className="py-2 px-3">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22307A]/60">
                {(data?.payouts || []).map((p: any) => {
                  const meta = getPayoutStatusMeta(p.status);
                  return (
                    <tr key={p.id}>
                      <td dir="ltr" className="py-3 px-3 font-mono text-[#8CA2FF]">{p.settlementNumber}</td>
                      <td dir="ltr" className="py-3 px-3">{p.periodYear}-{String(p.periodMonth).padStart(2, '0')}</td>
                      <td className="py-3 px-3 tabular-nums">{formatNumber(Number(p.grossCommissionAmount))} ج.م</td>
                      <td className="py-3 px-3 tabular-nums text-rose-300">{formatNumber(Number(p.reversalDebitDeducted))} ج.م</td>
                      <td className="py-3 px-3 font-semibold tabular-nums text-emerald-300">{formatNumber(Number(p.netPayableAmount))} ج.م</td>
                      <td className="py-3 px-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="py-3 px-3">
                        <Button size="sm" variant="outline" onClick={() => handleOpenPayoutDetail(p.id)}>
                          <FileText className="h-3.5 w-3.5" /> الكشف
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'materials' && (
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.materials || []).map((m: any) => (
              <Card key={m.id} className="p-5 space-y-3">
                <Badge tone="info">{m.assetType}</Badge>
                <h3 className="font-extrabold text-[#EEF0FF]">{m.titleAr}</h3>
                {m.descriptionAr && <p className="text-xs text-[#A9B1E0]">{m.descriptionAr}</p>}
                {m.copyTextAr && (
                  <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-xs text-[#EEF0FF] space-y-2">
                    <p>{m.copyTextAr}</p>
                    <Button size="sm" variant="outline" onClick={() => handleCopy(m.copyTextAr, 'النص التسويقي')}>
                      <Copy className="h-3.5 w-3.5" /> نسخ النص
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-3">
            {(data?.notifications || []).length === 0 ? (
              <Card className="p-6 text-sm text-[#A9B1E0]">لا توجد إشعارات حالياً.</Card>
            ) : (
              data.notifications.map((n: any) => (
                <Card key={n.id} className="p-4 flex justify-between items-start gap-3">
                  <div>
                    <p className="font-bold text-[#EEF0FF]">{n.titleAr}</p>
                    <p className="text-xs text-[#A9B1E0]">{n.bodyAr}</p>
                  </div>
                  <span className="text-[11px] tabular-nums text-[#A9B1E0] shrink-0">
                    {formatDate(n.createdAt)}
                  </span>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <NativeModal
        open={Boolean(selectedPayout)}
        onClose={() => setSelectedPayout(null)}
        title={selectedPayout ? `كشف تسوية — ${selectedPayout.settlementNumber}` : 'كشف التسوية'}
      >
        {selectedPayout && (
          <div className="space-y-4 text-sm text-[#EEF0FF]">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-4 tabular-nums">
              <div><p className="text-xs text-[#A9B1E0]">إجمالي العمولات</p><p className="font-semibold">{formatNumber(Number(selectedPayout.grossCommissionAmount))} ج.م</p></div>
              <div><p className="text-xs text-[#A9B1E0]">خصم عكس العمولات</p><p className="font-semibold text-rose-300">{formatNumber(Number(selectedPayout.reversalDebitDeducted))} ج.م</p></div>
              <div><p className="text-xs text-[#A9B1E0]">صافي الصرف</p><p className="font-semibold text-emerald-300">{formatNumber(Number(selectedPayout.netPayableAmount))} ج.م</p></div>
              <div><p className="text-xs text-[#A9B1E0]">مرجع التحويل</p><p dir="ltr" className="font-mono">{selectedPayout.transferReference || '—'}</p></div>
            </div>
            {selectedPayout.notesAr && <p className="text-xs text-[#A9B1E0]">{selectedPayout.notesAr}</p>}
            <div className="space-y-2">
              <p className="font-bold">البنود المدرجة ({formatNumber(selectedPayout.items?.length ?? 0)})</p>
              {selectedPayout.items?.map((it: any) => (
                <div key={it.id} className="flex justify-between rounded-lg border border-[#22307A] p-2.5 text-xs">
                  <span>{it.commission?.order?.orderNumber} — {it.commission?.course?.publishedVersion?.titleAr || it.commission?.course?.slug}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(Number(it.amount))} ج.م</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </NativeModal>
    </DashboardShell>
  );
}
