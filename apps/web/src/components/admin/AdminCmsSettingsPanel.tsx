'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  Eye,
  EyeOff,
  HelpCircle,
  MessageSquareQuote,
  Plus,
  Save,
  Send,
  Settings,
  Star,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

/**
 * Unified Admin Full-Control CMS, SiteSettings, Student Reviews Moderation & Broadcast Notifications Panel
 */
export function AdminCmsSettingsPanel({ courses }: { courses: any[] }) {
  const { pushToast } = useAuth();
  const [collections, setCollections] = useState<{
    testimonials: any[];
    partners: any[];
    faqs: any[];
    settings: Record<string, any>;
  }>({ testimonials: [], partners: [], faqs: [], settings: {} });
  const [reviews, setReviews] = useState<any[]>([]);

  // SiteSetting: platform form
  const [siteNameAr, setSiteNameAr] = useState('أكاديمية بوصلة');
  const [sloganAr, setSloganAr] = useState('من الطالب إلى المدير');
  const [whatsappNumber, setWhatsappNumber] = useState('201001226683');
  const [supportEmail, setSupportEmail] = useState('support@boslaagri.com');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Broadcast notification state
  const [audience, setAudience] = useState<'ALL_ACTIVE' | 'STUDENTS' | 'INSTRUCTORS' | 'COURSE_ENROLLED'>('ALL_ACTIVE');
  const [broadcastCourseId, setBroadcastCourseId] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastUrl, setBroadcastUrl] = useState('/courses');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Quick Add Testimonial / Partner / FAQ
  const [tName, setTName] = useState('');
  const [tRole, setTRole] = useState('');
  const [tQuote, setTQuote] = useState('');

  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');

  const [fQ, setFQ] = useState('');
  const [fA, setFA] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [col, revs] = await Promise.all([
        apiFetch<any>('/admin/cms/collections'),
        apiFetch<any[]>('/admin/reviews'),
      ]);
      setCollections({
        testimonials: col?.testimonials || [],
        partners: col?.partners || [],
        faqs: col?.faqs || [],
        settings: col?.settings || {},
      });
      setReviews(Array.isArray(revs) ? revs : []);

      const plat = col?.settings?.platform;
      if (plat) {
        if (plat.siteNameAr) setSiteNameAr(plat.siteNameAr);
        if (plat.sloganAr) setSloganAr(plat.sloganAr);
        if (plat.whatsappNumber) setWhatsappNumber(plat.whatsappNumber);
        if (plat.supportEmail) setSupportEmail(plat.supportEmail);
        if (plat.socialLinks?.facebook) setFacebookUrl(plat.socialLinks.facebook);
        if (plat.socialLinks?.instagram) setInstagramUrl(plat.socialLinks.instagram);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل إعدادات المنصة ومحتوى CMS', 'error');
    }
  }, [pushToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!broadcastCourseId && courses.length > 0) {
      setBroadcastCourseId(courses[0].id);
    }
  }, [courses, broadcastCourseId]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const currentPlat = collections.settings?.platform || {};
      await apiFetch('/admin/settings/platform', {
        method: 'PUT',
        body: JSON.stringify({
          value: {
            ...currentPlat,
            siteNameAr: siteNameAr.trim(),
            sloganAr: sloganAr.trim(),
            whatsappNumber: whatsappNumber.trim(),
            supportEmail: supportEmail.trim(),
            socialLinks: {
              ...(currentPlat.socialLinks || {}),
              facebook: facebookUrl.trim(),
              instagram: instagramUrl.trim(),
              whatsapp: whatsappNumber.trim()
                ? `https://wa.me/${whatsappNumber.trim().replace(/\D/g, '')}`
                : currentPlat.socialLinks?.whatsapp || '',
            },
          },
        }),
      });
      pushToast('تم حفظ إعدادات المنصة العامة بنجاح', 'success');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ الإعدادات', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingBroadcast(true);
    try {
      const res = await apiFetch<{ recipientsCount: number }>('/admin/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          audience,
          courseId: audience === 'COURSE_ENROLLED' ? broadcastCourseId : undefined,
          titleAr: broadcastTitle.trim(),
          bodyAr: broadcastBody.trim(),
          actionUrl: broadcastUrl.trim() || '/courses',
        }),
      });
      pushToast(`تم إرسال الإشعار الجماعي إلى ${res.recipientsCount} مستخدم بنجاح`, 'success');
      setBroadcastTitle('');
      setBroadcastBody('');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال الإشعار', 'error');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleToggleReview = async (rev: any) => {
    try {
      await apiFetch(`/admin/reviews/${rev.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !rev.isPublished }),
      });
      pushToast(!rev.isPublished ? 'تم إظهار التقييم للزوار' : 'تم إخفاء التقييم', 'info');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر التحديث', 'error');
    }
  };

  const handleDeleteReview = async (id: string) => {
    try {
      await apiFetch(`/admin/reviews/${id}`, { method: 'DELETE' });
      pushToast('تم حذف التقييم', 'info');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الحذف', 'error');
    }
  };

  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/cms/testimonials', {
        method: 'POST',
        body: JSON.stringify({
          studentNameAr: tName.trim(),
          roleTitleAr: tRole.trim(),
          quoteAr: tQuote.trim(),
          rating: 5,
          isPublished: true,
        }),
      });
      setTName('');
      setTRole('');
      setTQuote('');
      pushToast('تمت إضافة الشهادة لصفحة الرئيسية', 'success');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الإضافة', 'error');
    }
  };

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/cms/partners', {
        method: 'POST',
        body: JSON.stringify({
          nameAr: pName.trim(),
          descriptionAr: pDesc.trim() || null,
          isPublished: true,
        }),
      });
      setPName('');
      setPDesc('');
      pushToast('تمت إضافة الشريك', 'success');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الإضافة', 'error');
    }
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/cms/faqs', {
        method: 'POST',
        body: JSON.stringify({
          questionAr: fQ.trim(),
          answerAr: fA.trim(),
          isPublished: true,
        }),
      });
      setFQ('');
      setFA('');
      pushToast('تمت إضافة السؤال الشائع', 'success');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الإضافة', 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Platform Global Settings & Broadcast Notifications */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#8CA2FF]" />
            إعدادات المنصة والتواصل العامة
          </h2>
          <form onSubmit={handleSaveSettings} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="set-name" label="اسم الأكاديمية">
                <input
                  id="set-name"
                  className={inputClassName}
                  value={siteNameAr}
                  onChange={(e) => setSiteNameAr(e.target.value)}
                />
              </Field>
              <Field id="set-slogan" label="الشعار التعريفي">
                <input
                  id="set-slogan"
                  className={inputClassName}
                  value={sloganAr}
                  onChange={(e) => setSloganAr(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="set-wa" label="رقم واتساب الرسمي">
                <input
                  id="set-wa"
                  dir="ltr"
                  className={inputClassName}
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
              </Field>
              <Field id="set-email" label="بريد الدعم الفني">
                <input
                  id="set-email"
                  dir="ltr"
                  className={inputClassName}
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="set-fb" label="رابط فيسبوك">
                <input
                  id="set-fb"
                  dir="ltr"
                  className={inputClassName}
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                />
              </Field>
              <Field id="set-ig" label="رابط إنستغرام">
                <input
                  id="set-ig"
                  dir="ltr"
                  className={inputClassName}
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                />
              </Field>
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={savingSettings}>
              <Save className="h-4 w-4" />
              {savingSettings ? 'جاري الحفظ...' : 'حفظ إعدادات المنصة'}
            </Button>
          </form>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#F5B94A]" />
            إرسال إشعار جماعي مباشر
          </h2>
          <form onSubmit={handleBroadcast} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="bc-aud" label="الفئة المستهدفة">
                <select
                  id="bc-aud"
                  className={inputClassName}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                >
                  <option value="ALL_ACTIVE">جميع الحسابات النشطة</option>
                  <option value="STUDENTS">الطلاب فقط</option>
                  <option value="INSTRUCTORS">المدربون فقط</option>
                  <option value="COURSE_ENROLLED">طلاب كورس محدد</option>
                </select>
              </Field>
              <Field id="bc-url" label="رابط التوجيه عند النقر">
                <input
                  id="bc-url"
                  dir="ltr"
                  className={inputClassName}
                  value={broadcastUrl}
                  onChange={(e) => setBroadcastUrl(e.target.value)}
                />
              </Field>
            </div>

            {audience === 'COURSE_ENROLLED' && (
              <Field id="bc-course" label="اختر الكورس">
                <select
                  id="bc-course"
                  className={inputClassName}
                  value={broadcastCourseId}
                  onChange={(e) => setBroadcastCourseId(e.target.value)}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field id="bc-title" label="عنوان الإشعار" required>
              <input
                id="bc-title"
                className={inputClassName}
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="مثال: افتتاح مسار عملي جديد"
                required
              />
            </Field>
            <Field id="bc-body" label="نص الرسالة" required>
              <textarea
                id="bc-body"
                rows={2}
                className={inputClassName}
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" variant="gold" size="sm" disabled={sendingBroadcast}>
              <Send className="h-4 w-4" />
              {sendingBroadcast ? 'جاري الإرسال...' : 'إرسال الإشعار الآن'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Course Reviews Moderation */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
          <Star className="h-5 w-5 text-[#F5B94A]" />
          إدارة ومراجعة تقييمات الكورسات ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-xs text-[#A9B1E0]">لا توجد تقييمات طلابية مسجلة حتى الآن.</p>
        ) : (
          <div className="space-y-2.5 text-xs">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-[#EEF0FF]">{rev.user?.fullName}</span>
                    <Badge tone="warning">{rev.rating} / 5 ★</Badge>
                    <Badge tone={rev.isPublished ? 'success' : 'neutral'}>
                      {rev.isPublished ? 'ظاهر' : 'مخفي'}
                    </Badge>
                  </div>
                  <p className="text-[#8CA2FF]">
                    {rev.course?.publishedVersion?.titleAr ||
                      rev.course?.draftVersion?.titleAr ||
                      rev.course?.slug}
                  </p>
                  {rev.commentAr && <p className="text-[#A9B1E0]">{rev.commentAr}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleToggleReview(rev)}
                  >
                    {rev.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {rev.isPublished ? 'إخفاء' : 'إظهار'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void handleDeleteReview(rev.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Testimonials, Partners & FAQs CRUD */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Testimonials */}
        <Card className="p-5 space-y-4">
          <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <MessageSquareQuote className="h-4 w-4 text-[#8CA2FF]" />
            آراء وتجارب الطلاب ({collections.testimonials.length})
          </h3>
          <form onSubmit={handleAddTestimonial} className="space-y-2.5 text-xs">
            <input
              aria-label="اسم الطالب في التوصية"
              className={inputClassName}
              placeholder="اسم الطالب"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              required
            />
            <input
              aria-label="الصفة أو الوظيفة"
              className={inputClassName}
              placeholder="مثال: مدير مزرعة ألبان"
              value={tRole}
              onChange={(e) => setTRole(e.target.value)}
              required
            />
            <textarea
              aria-label="نص التجربة"
              rows={2}
              className={inputClassName}
              placeholder="اقتباس الطالب حول المنصة..."
              value={tQuote}
              onChange={(e) => setTQuote(e.target.value)}
              required
            />
            <Button type="submit" variant="outline" size="sm" className="w-full">
              <Plus className="h-3.5 w-3.5" />
              إضافة رأي طالب
            </Button>
          </form>
          <div className="space-y-2 text-xs max-h-56 overflow-y-auto">
            {collections.testimonials.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[#22307A] bg-[#0B1440] p-2.5 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[#EEF0FF]">{item.studentNameAr}</p>
                  <p className="text-[#A9B1E0] line-clamp-2">{item.quoteAr}</p>
                </div>
                <button
                  type="button"
                  aria-label={`حذف رأي ${item.studentNameAr}`}
                  onClick={() =>
                    void apiFetch(`/admin/cms/testimonials/${item.id}`, { method: 'DELETE' }).then(
                      loadData,
                    )
                  }
                  className="text-[#FF9CAA] p-1 hover:bg-[#18266E] rounded cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Partners */}
        <Card className="p-5 space-y-4">
          <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#8CA2FF]" />
            شركاء النجاح ({collections.partners.length})
          </h3>
          <form onSubmit={handleAddPartner} className="space-y-2.5 text-xs">
            <input
              aria-label="اسم الشريك"
              className={inputClassName}
              placeholder="اسم الشركة أو المؤسسة"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              required
            />
            <input
              aria-label="وصف الشراكة"
              className={inputClassName}
              placeholder="وصف مختصر (اختياري)"
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
            />
            <Button type="submit" variant="outline" size="sm" className="w-full">
              <Plus className="h-3.5 w-3.5" />
              إضافة شريك
            </Button>
          </form>
          <div className="space-y-2 text-xs max-h-56 overflow-y-auto">
            {collections.partners.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-[#22307A] bg-[#0B1440] p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[#EEF0FF]">{p.nameAr}</p>
                  {p.descriptionAr && <p className="text-[#A9B1E0] truncate">{p.descriptionAr}</p>}
                </div>
                <button
                  type="button"
                  aria-label={`حذف شريك ${p.nameAr}`}
                  onClick={() =>
                    void apiFetch(`/admin/cms/partners/${p.id}`, { method: 'DELETE' }).then(loadData)
                  }
                  className="text-[#FF9CAA] p-1 hover:bg-[#18266E] rounded cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* FAQs */}
        <Card className="p-5 space-y-4">
          <h3 className="text-base font-extrabold text-[#EEF0FF] flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-[#8CA2FF]" />
            الأسئلة الشائعة ({collections.faqs.length})
          </h3>
          <form onSubmit={handleAddFaq} className="space-y-2.5 text-xs">
            <input
              aria-label="السؤال الشائع"
              className={inputClassName}
              placeholder="السؤال..."
              value={fQ}
              onChange={(e) => setFQ(e.target.value)}
              required
            />
            <textarea
              aria-label="الإجابة"
              rows={2}
              className={inputClassName}
              placeholder="الإجابة الواضحة للطالب..."
              value={fA}
              onChange={(e) => setFA(e.target.value)}
              required
            />
            <Button type="submit" variant="outline" size="sm" className="w-full">
              <Plus className="h-3.5 w-3.5" />
              إضافة سؤال وإجابة
            </Button>
          </form>
          <div className="space-y-2 text-xs max-h-56 overflow-y-auto">
            {collections.faqs.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-[#22307A] bg-[#0B1440] p-2.5 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[#EEF0FF]">{f.questionAr}</p>
                  <p className="text-[#A9B1E0] line-clamp-2">{f.answerAr}</p>
                </div>
                <button
                  type="button"
                  aria-label={`حذف سؤال ${f.questionAr}`}
                  onClick={() =>
                    void apiFetch(`/admin/cms/faqs/${f.id}`, { method: 'DELETE' }).then(loadData)
                  }
                  className="text-[#FF9CAA] p-1 hover:bg-[#18266E] rounded cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
