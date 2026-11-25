'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, CheckCircle2, FileText, RefreshCw, XCircle } from 'lucide-react';
import { apiFetch, formatDate } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
  textareaClassName,
} from '@/components/ui/primitives';

const STATUS_META: Record<
  string,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
  PENDING: { label: 'بانتظار مراجعة المدرب', tone: 'warning' },
  DRAFT_INSTRUCTOR: { label: 'مسودة المدرب (تحت الإعداد)', tone: 'info' },
  APPROVED: { label: 'معتمد وصادر للمتدرب', tone: 'success' },
  REJECTED: { label: 'مرفوض', tone: 'danger' },
  REVOKED: { label: 'ملغى', tone: 'danger' },
};

export function InstructorRecommendationsPanel() {
  const { pushToast } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { letterTitleAr: string; letterBodyAr: string; rejectionReasonAr: string }>
  >({});

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any[]>('/instructor/recommendations');
      const list = Array.isArray(res) ? res : [];
      setItems(list);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const r of list) {
          if (!next[r.id]) {
            next[r.id] = {
              letterTitleAr: r.letterTitleAr || '',
              letterBodyAr: r.letterBodyAr || '',
              rejectionReasonAr: r.rejectionReasonAr || '',
            };
          }
        }
        return next;
      });
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل طلبات خطابات التوصية', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleSaveDraft = async (id: string) => {
    const d = drafts[id];
    if (!d || d.letterBodyAr.trim().length < 20) {
      pushToast('اكتب نص المسودة بخط المدرب (20 حرفاً على الأقل) قبل الحفظ', 'error');
      return;
    }
    setBusyId(id);
    try {
      await apiFetch(`/instructor/recommendations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          letterTitleAr: d.letterTitleAr.trim() || undefined,
          letterBodyAr: d.letterBodyAr.trim(),
        }),
      });
      pushToast('تم حفظ مسودة خطاب التوصية بنجاح', 'success');
      await loadList();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ المسودة', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (id: string) => {
    const d = drafts[id];
    if (!d || d.letterBodyAr.trim().length < 20) {
      pushToast(
        'يجب كتابة نص خطاب التوصية الفعلي بخط المدرب (20 حرفاً على الأقل) قبل الاعتماد',
        'error',
      );
      return;
    }
    setBusyId(id);
    try {
      await apiFetch(`/instructor/recommendations/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          letterTitleAr: d.letterTitleAr.trim() || undefined,
          letterBodyAr: d.letterBodyAr.trim(),
        }),
      });
      pushToast('تم اعتماد وإصدار خطاب التوصية النهائي برمز تحقق مستقل', 'success');
      await loadList();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر اعتماد خطاب التوصية', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    const d = drafts[id];
    const reason = (d?.rejectionReasonAr || '').trim();
    if (!reason || reason.length < 5) {
      pushToast('يرجى كتابة سبب الرفض (5 أحرف على الأقل) قبل الإرسال', 'error');
      return;
    }
    setBusyId(id);
    try {
      await apiFetch(`/instructor/recommendations/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReasonAr: reason }),
      });
      pushToast('تم رفض الطلب وإبلاغ المتدرب بالسبب', 'info');
      await loadList();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر رفض الطلب', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-bosla-ink">
            <Award className="h-5 w-5 text-[#F5B94A]" />
            طلبات خطابات التوصية المعتمدة ({items.length})
          </h2>
          <p className="text-xs text-bosla-muted mt-1">
            اكتب نص خطاب التوصية الفعلي بنفسك لكل متدرب مؤهل — لا يتم استخدام أي قوالب آلية جاهزة، وبمجرد الاعتماد يصبح نص الخطاب غير قابل للتعديل.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadList()} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
          تحديث القائمة
        </Button>
      </div>

      {loading ? (
        <Card className="p-6 text-center text-xs text-bosla-muted">جاري تحميل الطلبات...</Card>
      ) : items.length === 0 ? (
        <AlertBanner tone="info" title="لا توجد طلبات خطاب توصية حالياً">
          ستظهر هنا جميع طلبات المتدربين الموجهة لك في الكورسات والمسارات التي تشرف عليها.
        </AlertBanner>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const st = STATUS_META[item.status] || { label: item.status, tone: 'neutral' as const };
            const draft = drafts[item.id] || {
              letterTitleAr: '',
              letterBodyAr: '',
              rejectionReasonAr: '',
            };
            const isEditable = item.status === 'PENDING' || item.status === 'DRAFT_INSTRUCTOR';

            return (
              <Card key={item.id} className="p-5 space-y-4 border-bosla-line">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-bosla-ink">
                        {item.student?.fullName || 'متدرب'}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {item.verificationCode && (
                        <code
                          dir="ltr"
                          className="rounded bg-[#0B1440] px-2 py-0.5 font-mono text-[11px] text-[#8CA2FF]"
                        >
                          {item.verificationCode}
                        </code>
                      )}
                    </div>
                    <p className="text-xs text-bosla-muted">
                      البرنامج: {item.course?.publishedVersion?.titleAr || item.learningPath?.titleAr || 'برنامج تدريبي'}
                      {' • '}
                      تاريخ الطلب: {formatDate(item.requestedAt || item.createdAt)}
                    </p>
                    {item.studentGoalAr && (
                      <p className="text-xs text-bosla-ink/90 rounded-lg border border-bosla-line/60 bg-[#0B1440]/40 px-3 py-2 mt-2">
                        <strong>هدف المتدرب:</strong> {item.studentGoalAr}
                      </p>
                    )}
                  </div>
                </div>

                {isEditable ? (
                  <div className="space-y-3 border-t border-bosla-line pt-3">
                    <Field label="عنوان / صفة الخطاب (اختياري)">
                      <input
                        className={inputClassName}
                        placeholder="مثال: خطاب توصية مهنية في إدارة وتطوير عنابر التسمين"
                        value={draft.letterTitleAr}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, letterTitleAr: e.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="نص خطاب التوصية الكامل (يُكتب بخط المدرب)" required>
                      <textarea
                        rows={5}
                        className={textareaClassName}
                        placeholder="اكتب تقييمك وتوصيتك المهنية الحقيقية حول أداء المتدرب ومهاراته التطبيقية والتزامه خلال البرنامج..."
                        value={draft.letterBodyAr}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, letterBodyAr: e.target.value },
                          }))
                        }
                      />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
                      <Field label="سبب الرفض أو ملاحظات للمتدرب (مطلوب عند الرفض فقط)">
                        <input
                          className={inputClassName}
                          placeholder="اذكر السبب بوضوح للمتدرب..."
                          value={draft.rejectionReasonAr}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, rejectionReasonAr: e.target.value },
                            }))
                          }
                        />
                      </Field>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => void handleSaveDraft(item.id)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          حفظ كمسودة
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => void handleApprove(item.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          اعتماد وإصدار الخطاب
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => void handleReject(item.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          رفض
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-bosla-line p-4 space-y-2 bg-[#0B1440]/50 text-xs">
                    {item.letterTitleAr && <p className="font-bold text-bosla-ink">{item.letterTitleAr}</p>}
                    {item.letterBodyAr && (
                      <p className="whitespace-pre-line leading-relaxed text-bosla-muted">
                        {item.letterBodyAr}
                      </p>
                    )}
                    {item.rejectionReasonAr && (
                      <p className="text-rose-300 font-semibold">سبب الرفض: {item.rejectionReasonAr}</p>
                    )}
                    {item.revokeReasonAr && (
                      <p className="text-rose-300 font-semibold">سبب الإبطال: {item.revokeReasonAr}</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
