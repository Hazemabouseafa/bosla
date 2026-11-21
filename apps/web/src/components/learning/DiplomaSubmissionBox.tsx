'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AlertBanner, Badge, Button, Field, inputClassName } from '@/components/ui/primitives';

export function DiplomaSubmissionBox({
  assessmentId,
  diplomaSlug,
}: {
  assessmentId: string;
  diplomaSlug?: string;
}) {
  const { user, pushToast } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusData, setStatusData] = useState<any | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMyStatus = async () => {
    if (!user || !diplomaSlug) return;
    setLoadingStatus(true);
    try {
      const data = await apiFetch<any>(`/learning/diplomas/${diplomaSlug}/my-status`);
      setStatusData(data);
    } catch {
      // Optional status lookup
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadMyStatus();
  }, [user?.id, diplomaSlug]);

  if (!user) {
    return (
      <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3.5 text-xs text-[#EEF0FF] flex items-center justify-between gap-2">
        <span>سجّل الدخول بحساب مشترك لتسليم مشروع الدبلومة</span>
        <Link href="/login">
          <Button variant="primary" size="sm">
            تسجيل الدخول
          </Button>
        </Link>
      </div>
    );
  }

  const existingSub = statusData?.submissions?.find(
    (s: any) => s.diplomaAssessmentId === assessmentId,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      await apiFetch(`/learning/diplomas/assessments/${assessmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ submissionText: text }),
      });
      setResult('تم استلام تسليمك بنجاح وإرساله لمراجعة المدربين والإدارة.');
      setText('');
      pushToast('تم تسليم مشروع الدبلومة', 'success');
      await loadMyStatus();
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال التسليم — تأكد من نشاط عضويتك.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 pt-2 border-t border-bosla-line">
      {statusData && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0B1440] px-3 py-2 text-xs border border-[#22307A]">
          <span className="font-bold text-[#A9B1E0]">
            تقدم كورسات الدبلومة:{' '}
            <strong className="text-[#EEF0FF]">
              {statusData.completedRequiredCourses} / {statusData.totalRequiredCourses}
            </strong>
          </span>
          {statusData.certificate ? (
            <Link
              href={`/certificates/${statusData.certificate.certificateCode}`}
              className="inline-flex items-center gap-1 font-extrabold text-[#77E2B5] hover:underline"
            >
              <Award className="h-3.5 w-3.5" />
              شهادتك جاهزة ({statusData.certificate.certificateCode})
            </Link>
          ) : statusData.hasEntitlement ? (
            <Badge tone="success">عضويتك مفعّلة للدبلومة</Badge>
          ) : (
            <Badge tone="warning">يتطلب عضوية سارية</Badge>
          )}
        </div>
      )}

      {existingSub && (
        <div className="rounded-xl border border-[#22307A] bg-[#0B1440] p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-[#EEF0FF] flex items-center gap-1.5">
              {existingSub.passed === true ? (
                <CheckCircle2 className="h-4 w-4 text-[#77E2B5]" />
              ) : (
                <Clock className="h-4 w-4 text-[#F5B94A]" />
              )}
              حالة تسليمك السابق
            </span>
            {existingSub.passed === true ? (
              <Badge tone="success">اجتياز ({existingSub.scorePercent}%)</Badge>
            ) : existingSub.passed === false ? (
              <Badge tone="danger">يحتاج تعديل ({existingSub.scorePercent}%)</Badge>
            ) : (
              <Badge tone="warning">قيد التقييم</Badge>
            )}
          </div>
          {existingSub.feedbackAr && (
            <p className="text-bosla-ink bg-bosla-bg rounded-lg px-2.5 py-1.5">
              <strong>ملاحظات الإدارة:</strong> {existingSub.feedbackAr}
            </p>
          )}
        </div>
      )}

      {!loadingStatus && statusData && !statusData.hasEntitlement ? (
        <AlertBanner tone="warning" title="التسليم متاح للمشتركين">
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
            <span>اشترك في باقة تشمل هذه الدبلومة لتتمكن من رفع مشروعك واستخراج الشهادة المعتمدة.</span>
            <Link href="/pricing">
              <Button variant="primary" size="sm">
                <Award className="h-3.5 w-3.5" />
                عرض خطط العضوية
              </Button>
            </Link>
          </div>
        </AlertBanner>
      ) : existingSub?.passed ? (
        <AlertBanner tone="success">
          مبارك! تم اعتماد مشروع الدبلومة بنجاح.
          {statusData?.certificate && (
            <Link
              href={`/certificates/${statusData.certificate.certificateCode}`}
              className="underline font-extrabold ms-2"
            >
              عرض الشهادة المعتمدة
            </Link>
          )}
        </AlertBanner>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {result && <AlertBanner tone="success">{result}</AlertBanner>}
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}
          <Field id={`ass-${assessmentId}`} label="رابط أو ملخص المشروع العملي" required>
            <textarea
              id={`ass-${assessmentId}`}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب خطة التقييم أو الصق رابط ملف المشروع التطبيقي (10 أحرف على الأقل)..."
              className={inputClassName}
              required
              minLength={10}
            />
          </Field>
          <Button type="submit" variant="navy" size="sm" disabled={busy}>
            {busy
              ? 'جاري التسليم...'
              : existingSub
                ? 'تحديث وإعادة التسليم'
                : 'تسليم التقييم الآن'}
          </Button>
        </form>
      )}
    </div>
  );
}
