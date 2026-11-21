'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, LifeBuoy, MessageSquare, Send, ShieldCheck, Star } from 'lucide-react';
import { apiFetch, formatDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageHero } from '@/components/layout/PageHero';
import { PublicPageLayout } from '@/components/layout/SiteShell';
import { AlertBanner, Badge, Button, Card, Field, inputClassName } from '@/components/ui/primitives';

export default function SupportPortalPage() {
  const { user, isLoading: loading, pushToast } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [category, setCategory] = useState('TECHNICAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [subjectAr, setSubjectAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [agentMode, setAgentMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSupportStaff = Boolean(
    user &&
      (user.role === 'SUPPORT' ||
        user.role === 'ADMIN' ||
        user.role === 'SUPER_ADMIN' ||
        (user.permissions || []).includes('support.manage')),
  );

  const loadTickets = useCallback(async () => {
    if (!user) return;
    try {
      const endpoint = isSupportStaff && agentMode ? '/support/tickets' : '/support/tickets?mineOnly=true';
      const res = await apiFetch<any[]>(endpoint);
      setTickets(Array.isArray(res) ? res : []);
    } catch {
      setTickets([]);
    }
  }, [user, isSupportStaff, agentMode]);

  useEffect(() => {
    if (isSupportStaff) setAgentMode(true);
  }, [isSupportStaff]);

  useEffect(() => {
    if (!loading && user) void loadTickets();
  }, [loading, user, loadTickets]);

  const handleCloseTicket = async (ticketId: string, status: 'RESOLVED' | 'CLOSED') => {
    setBusy(true);
    try {
      await apiFetch(`/support/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      pushToast(status === 'RESOLVED' ? 'تم حل التذكرة بنجاح' : 'تم إغلاق التذكرة نهائياً', 'success');
      await loadTickets();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة التذكرة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ category, priority, subjectAr, descriptionAr }),
      });
      pushToast('تم فتح تذكرة الدعم بنجاح وسيتابعها الفريق قريباً', 'success');
      setSubjectAr('');
      setDescriptionAr('');
      await loadTickets();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر فتح التذكرة', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async (ticketId: string) => {
    const bodyAr = (replyDrafts[ticketId] || '').trim();
    if (!bodyAr) return;
    setBusy(true);
    try {
      await apiFetch(`/support/tickets/${encodeURIComponent(ticketId)}/replies`, {
        method: 'POST',
        body: JSON.stringify({ bodyAr, isInternalNote: false }),
      });
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
      pushToast('تم إرسال الرد', 'success');
      await loadTickets();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال الرد', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRate = async (ticketId: string, rating: number) => {
    setBusy(true);
    try {
      await apiFetch(`/support/tickets/${encodeURIComponent(ticketId)}/satisfaction`, {
        method: 'POST',
        body: JSON.stringify({ rating }),
      });
      pushToast('شكراً لتقييمك لخدمة الدعم!', 'success');
      await loadTickets();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ التقييم', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicPageLayout>
      <PageHero
        badge="مركز المساعدة والدعم الفني"
        title="تذاكر الدعم"
        highlight="والمساعدة المباشرة"
        subtitle="افتح تذكرة دعم لأي استفسار تقني أو مالي أو يتعلق بالشهادات وتابع الردود ومستوى جودة الخدمة."
      />

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-8">
        {!loading && !user ? (
          <Card className="p-8 text-center space-y-4">
            <LifeBuoy className="mx-auto h-10 w-10 text-[#8CA2FF]" />
            <h2 className="text-xl font-extrabold text-[#EEF0FF]">سجّل دخولك لفتح ومتابعة تذاكر الدعم</h2>
            <Link href="/login"><Button variant="primary">تسجيل الدخول</Button></Link>
          </Card>
        ) : (
          <>
            {isSupportStaff && (
              <Card className="p-5 border-[#7C95FF]/50 bg-[#0F1A4A] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-6 w-6 text-[#8CA2FF] shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-base font-extrabold text-[#EEF0FF]">وضع موظف خدمة العملاء والدعم الفني</h2>
                    <p className="text-xs text-[#A9B1E0]">
                      لديك صلاحية عرض جميع تذاكر العملاء، الرد عليها، وإغلاقها — كما يمكنك الدخول مباشرة إلى لوحة خدمة العملاء المتكاملة.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={agentMode ? 'primary' : 'outline'}
                    onClick={() => setAgentMode((prev) => !prev)}
                  >
                    {agentMode ? 'عرض تذاكري فقط' : 'عرض جميع تذاكر العملاء'}
                  </Button>
                  <Link href="/admin">
                    <Button size="sm" variant="primary">فتح لوحة خدمة العملاء الكاملة</Button>
                  </Link>
                </div>
              </Card>
            )}

            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-[#EEF0FF]">فتح تذكرة دعم جديدة</h2>
              <form onSubmit={handleCreateTicket} className="grid gap-4 sm:grid-cols-2">
                <Field label="التصنيف">
                  <select className={inputClassName} value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="TECHNICAL">دعم تقني وتشغيل الفيديو</option>
                    <option value="BILLING">المدفوعات والفواتير والاسترداد</option>
                    <option value="CONTENT">المحتوى التعليمي والاختبارات</option>
                    <option value="CERTIFICATES">الشهادات والتحقق</option>
                    <option value="OTHER">استفسار عام</option>
                  </select>
                </Field>
                <Field label="الأولوية">
                  <select className={inputClassName} value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="LOW">عادية</option>
                    <option value="MEDIUM">متوسطة</option>
                    <option value="HIGH">مرتفعة</option>
                    <option value="URGENT">عاجلة</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="موضوع التذكرة">
                    <input className={inputClassName} required value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} placeholder="ملخص المشكلة أو الاستفسار..." />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="تفاصيل المشكلة">
                    <textarea rows={3} className={inputClassName} required value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} placeholder="اكتب كافة التفاصيل التي تساعد الفريق على حل مشكلتك سريعاً..." />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="primary" disabled={busy}>
                    <Send className="h-4 w-4" /> إرسال التذكرة
                  </Button>
                </div>
              </form>
            </Card>

            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-[#EEF0FF] flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#8CA2FF]" />{' '}
                {isSupportStaff && agentMode ? `جميع تذاكر العملاء (${tickets.length})` : `تذاكري (${tickets.length})`}
              </h2>
              {tickets.length === 0 ? (
                <AlertBanner tone="info" title="لا توجد تذاكر حالياً">
                  يمكنك فتح تذكرة جديدة من النموذج أعلاه وسيتواصل معك فريق الدعم.
                </AlertBanner>
              ) : (
                tickets.map((t) => (
                  <Card key={t.id} className="p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span dir="ltr" className="text-xs font-mono text-[#8CA2FF]">{t.ticketNumber}</span>
                        <h3 className="font-extrabold text-[#EEF0FF]">{t.subjectAr}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="info">{t.category}</Badge>
                        <Badge tone={t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'success' : 'warning'}>{t.status}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-[#A9B1E0]">{t.descriptionAr}</p>

                    {(t.replies || []).length > 0 && (
                      <div className="space-y-2 border-t border-[#22307A] pt-3">
                        {t.replies.map((r: any) => (
                          <div key={r.id} className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 text-sm">
                            <div className="flex justify-between text-xs text-[#8CA2FF] mb-1">
                              <span className="font-bold">{r.author?.fullName}</span>
                              <span className="tabular-nums">{formatDateTime(r.createdAt)}</span>
                            </div>
                            <p className="text-[#EEF0FF]">{r.bodyAr}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <input
                        className={`${inputClassName} flex-1 min-w-[200px]`}
                        placeholder="أضف رداً أو توضيحاً..."
                        value={replyDrafts[t.id] || ''}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      />
                      <Button size="sm" variant="primary" disabled={busy} onClick={() => handleReply(t.id)}>
                        إرسال
                      </Button>
                      {isSupportStaff && t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                        <>
                          <Button size="sm" variant="success" disabled={busy} onClick={() => void handleCloseTicket(t.id, 'RESOLVED')}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> حل التذكرة
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleCloseTicket(t.id, 'CLOSED')}>
                            إغلاق التذكرة
                          </Button>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#22307A] pt-3 text-xs">
                      <span className="text-[#A9B1E0]">قيّم جودة الدعم الفني:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={busy}
                            onClick={() => handleRate(t.id, star)}
                            className={`p-1 rounded ${
                              (t.satisfactionRating || 0) >= star ? 'text-amber-400' : 'text-[#5A669E]'
                            }`}
                            aria-label={`تقييم ${star} من 5`}
                          >
                            <Star className="h-4 w-4 fill-current" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </PublicPageLayout>
  );
}
