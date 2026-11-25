'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, FileText, Printer, Send, ShieldCheck, XCircle } from 'lucide-react';
import { apiFetch, formatDate } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  inputClassName,
} from '@/components/ui/primitives';

const REC_STATUS_META: Record<
  string,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
  PENDING: { label: 'بانتظار كتابة واعتماد المدرب', tone: 'warning' },
  DRAFT_INSTRUCTOR: { label: 'المدرب يكتب المسودة', tone: 'info' },
  APPROVED: { label: 'معتمد وصادر', tone: 'success' },
  REJECTED: { label: 'مرفوض من المدرب', tone: 'danger' },
  REVOKED: { label: 'مسحوب / ملغى', tone: 'danger' },
};

export function StudentCredentialsPanel({
  certificates,
  enrolledCourses,
  pathProgress,
  catalogCourses,
  catalogPaths,
  onReload,
}: {
  certificates: any[];
  enrolledCourses: any[];
  pathProgress: any[];
  catalogCourses: any[];
  catalogPaths: any[];
  onReload?: () => void;
}) {
  const { pushToast } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [targetKey, setTargetKey] = useState('');
  const [studentGoalAr, setStudentGoalAr] = useState('');
  const [submittingRec, setSubmittingRec] = useState(false);

  const [printCertDetail, setPrintCertDetail] = useState<any | null>(null);
  const [loadingCertDetail, setLoadingCertDetail] = useState(false);
  const [printRec, setPrintRec] = useState<any | null>(null);

  const loadRecommendations = useCallback(async () => {
    setRecLoading(true);
    try {
      const res = await apiFetch<any[]>('/learning/recommendations/my');
      setRecommendations(Array.isArray(res) ? res : []);
    } catch {
      setRecommendations([]);
    } finally {
      setRecLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  const requestOptions: Array<{
    value: string;
    label: string;
    targetType: 'COURSE' | 'LEARNING_PATH';
    targetId: string;
  }> = [];
  const seen = new Set<string>();
  for (const ec of enrolledCourses || []) {
    const cId = ec.courseId || ec.id;
    if (cId && !seen.has(`COURSE:${cId}`)) {
      seen.add(`COURSE:${cId}`);
      requestOptions.push({
        value: `COURSE:${cId}`,
        label: `كورس: ${ec.titleAr || ec.publishedVersion?.titleAr || cId}`,
        targetType: 'COURSE',
        targetId: cId,
      });
    }
  }
  for (const pp of pathProgress || []) {
    if (pp.id && !seen.has(`LEARNING_PATH:${pp.id}`)) {
      seen.add(`LEARNING_PATH:${pp.id}`);
      requestOptions.push({
        value: `LEARNING_PATH:${pp.id}`,
        label: `مسار: ${pp.titleAr || pp.id}`,
        targetType: 'LEARNING_PATH',
        targetId: pp.id,
      });
    }
  }
  if (requestOptions.length === 0) {
    for (const c of (catalogCourses || []).slice(0, 6)) {
      if (c.id && !seen.has(`COURSE:${c.id}`)) {
        seen.add(`COURSE:${c.id}`);
        requestOptions.push({
          value: `COURSE:${c.id}`,
          label: `كورس: ${c.publishedVersion?.titleAr || c.slug}`,
          targetType: 'COURSE',
          targetId: c.id,
        });
      }
    }
    for (const p of (catalogPaths || []).slice(0, 4)) {
      if (p.id && !seen.has(`LEARNING_PATH:${p.id}`)) {
        seen.add(`LEARNING_PATH:${p.id}`);
        requestOptions.push({
          value: `LEARNING_PATH:${p.id}`,
          label: `مسار: ${p.titleAr}`,
          targetType: 'LEARNING_PATH',
          targetId: p.id,
        });
      }
    }
  }

  const handleRequestRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = requestOptions.find((o) => o.value === targetKey) || requestOptions[0];
    if (!chosen) {
      pushToast('اختر برنامجاً أو كورساً أولاً لتقديم طلب التوصية', 'error');
      return;
    }
    const goal =
      studentGoalAr.trim().length >= 10
        ? studentGoalAr.trim()
        : `أرغب في الحصول على خطاب توصية مهنية لإثبات إتمام ${chosen.label} والتقديم في قطاع العمل.`;

    setSubmittingRec(true);
    try {
      await apiFetch('/learning/recommendations/request', {
        method: 'POST',
        body: JSON.stringify({
          targetType: chosen.targetType,
          courseId: chosen.targetType === 'COURSE' ? chosen.targetId : undefined,
          learningPathId: chosen.targetType === 'LEARNING_PATH' ? chosen.targetId : undefined,
          studentGoalAr: goal,
        }),
      });
      pushToast('تم إرسال طلب خطاب التوصية إلى المدرب المختص بنجاح', 'success');
      setStudentGoalAr('');
      await loadRecommendations();
      onReload?.();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إرسال طلب التوصية', 'error');
    } finally {
      setSubmittingRec(false);
    }
  };

  const openPrintableCertificate = async (certId: string) => {
    setLoadingCertDetail(true);
    try {
      const detail = await apiFetch<any>(
        `/learning/certificates/${encodeURIComponent(certId)}/detail`,
      );
      setPrintCertDetail(detail);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل تفاصيل الشهادة للطباعة', 'error');
    } finally {
      setLoadingCertDetail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Issued Certificates */}
      <Card className="p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink">
          <Award className="h-5 w-5 text-[#77E2B5]" />
          شهادات الحضور والإتمام المعتمدة ({certificates.length})
        </h2>
        {certificates.length === 0 ? (
          <p className="text-sm text-bosla-muted">
            تُصدر شهادة الحضور والإتمام تلقائياً فور إنهاء 100% من دروس الكورس أو المسار التعليمي.
          </p>
        ) : (
          <div className="space-y-2.5">
            {certificates.map((cert: any) => (
              <div
                key={cert.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#77E2B5]/35 bg-[#0B1440]/85 p-3.5"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-[#EEF0FF]">{cert.titleAr}</p>
                    <Badge
                      tone={
                        cert.kind === 'ACCREDITED_PROGRAM'
                          ? 'purple'
                          : cert.kind === 'COMPETENCY'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {cert.kind === 'ACCREDITED_PROGRAM'
                        ? 'شهادة دبلومة / برنامج معتمد'
                        : cert.kind === 'COMPETENCY'
                          ? 'شهادة التدريب المهني والكفاءة'
                          : cert.learningPathId
                            ? 'شهادة حضور مسار تعليمي'
                            : 'شهادة حضور وإتمام كورس'}
                    </Badge>
                  </div>
                  <p dir="ltr" className="font-mono text-xs text-[#8CA2FF] text-end sm:text-start">
                    {cert.certificateCode}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={loadingCertDetail}
                    onClick={() => void openPrintableCertificate(cert.id)}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    عرض / طباعة PDF
                  </Button>
                  <Link href={`/certificates/${encodeURIComponent(cert.certificateCode)}`}>
                    <Button variant="outline" size="sm">
                      صفحة التحقق
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recommendation Letters Section */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-bosla-ink">
            <FileText className="h-5 w-5 text-[#F5B94A]" />
            خطابات التوصية المعتمدة من المدربين ({recommendations.length})
          </h2>
          <p className="text-xs text-bosla-muted mt-1">
            اطلب خطاب توصية شخصي بعد إنهاء برنامجك؛ يقوم المدرب نفسه بصياغة الخطاب واعتماده ولا يصدر أي خطاب آلياً.
          </p>
        </div>

        <form onSubmit={handleRequestRecommendation} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end rounded-xl border border-bosla-line p-4">
          <Field label="الكورس أو المسار المرتبط">
            <select
              className={inputClassName}
              value={targetKey || requestOptions[0]?.value || ''}
              onChange={(e) => setTargetKey(e.target.value)}
            >
              {requestOptions.length === 0 && <option value="">لا توجد برامج متاحة</option>}
              {requestOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الهدف المهني / ملاحظاتك للمدرب (10 أحرف فأكثر)">
            <input
              className={inputClassName}
              placeholder="مثال: أرغب بالتقديم لوظيفة إشراف مزارع دواجن..."
              value={studentGoalAr}
              onChange={(e) => setStudentGoalAr(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" size="sm" disabled={submittingRec || requestOptions.length === 0}>
            <Send className="h-3.5 w-3.5" />
            {submittingRec ? 'جاري الإرسال...' : 'طلب خطاب توصية'}
          </Button>
        </form>

        {recLoading ? (
          <p className="text-xs text-bosla-muted">جاري تحميل خطابات التوصية...</p>
        ) : recommendations.length === 0 ? (
          <p className="text-xs text-bosla-muted">لم تطلب أي خطاب توصية حتى الآن.</p>
        ) : (
          <div className="space-y-2.5">
            {recommendations.map((rec) => {
              const st = REC_STATUS_META[rec.status] || { label: rec.status, tone: 'neutral' as const };
              return (
                <div
                  key={rec.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-bosla-ink text-sm">
                        {rec.course?.publishedVersion?.titleAr || rec.learningPath?.titleAr || 'برنامج بوصلة'}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <p className="text-bosla-muted">
                      المدرب: {rec.instructor?.fullName} • تاريخ الطلب: {formatDate(rec.requestedAt || rec.createdAt)}
                      {rec.verificationCode && (
                        <>
                          {' • '}
                          <code dir="ltr" className="text-[#8CA2FF] font-mono">
                            {rec.verificationCode}
                          </code>
                        </>
                      )}
                    </p>
                    {rec.status === 'REJECTED' && rec.rejectionReasonAr && (
                      <p className="text-rose-300 font-semibold flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" />
                        سبب الرفض: {rec.rejectionReasonAr}
                      </p>
                    )}
                    {rec.status === 'REVOKED' && rec.revokeReasonAr && (
                      <p className="text-rose-300 font-semibold">
                        سبب الإبطال: {rec.revokeReasonAr}
                      </p>
                    )}
                  </div>
                  {rec.status === 'APPROVED' && (
                    <div className="flex items-center gap-2">
                      <Button variant="primary" size="sm" onClick={() => setPrintRec(rec)}>
                        <Printer className="h-3.5 w-3.5" />
                        عرض وطباعة PDF
                      </Button>
                      <Link href={`/certificates/verify?code=${encodeURIComponent(rec.verificationCode)}`}>
                        <Button variant="outline" size="sm">
                          تحقق عام
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Printable Certificate Sheet Modal */}
      <NativeModal
        open={Boolean(printCertDetail)}
        onClose={() => setPrintCertDetail(null)}
        title="معاينة وطباعة الشهادة (PDF)"
      >
        {printCertDetail && (() => {
          const cert = printCertDetail.certificate ?? printCertDetail;
          const tpl = printCertDetail.template ?? cert?.template;
          const layout = tpl?.layoutConfig || {};
          const pos = (k: string, defX: number, defY: number, defSize = 18) => ({
            left: `${layout[k]?.xPercent ?? defX}%`,
            top: `${layout[k]?.yPercent ?? defY}%`,
            fontSize: `${layout[k]?.fontSizePx ?? layout[k]?.fontSize ?? defSize}px`,
            color: layout[k]?.color || '#0B1440',
          });

          return (
            <div className="space-y-4">
              {(printCertDetail.isPreviewOnly || !tpl?.templateImageUrl) && (
                <AlertBanner tone="warning" title="نموذج معاينة مؤقت">
                  لم ترفع الإدارة صورة التصميم الرسمي المعتمد لهذا القالب بعد — يمكنك معاينة البيانات أو طباعتها كإثبات مؤقت لحين اعتماد القالب النهائي.
                </AlertBanner>
              )}

              <div className="bosla-print-sheet relative overflow-hidden rounded-xl border border-bosla-line bg-white text-[#0B1440] shadow-lg">
                {tpl?.templateImageUrl ? (
                  <div className="relative aspect-[1.414/1] w-full">
                    <img
                      src={tpl.templateImageUrl}
                      alt={cert.titleAr}
                      className="h-full w-full object-cover"
                    />
                    {layout.recipientName?.visible !== false && (
                      <span
                        style={pos('recipientName', 50, 45, 24)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 font-black text-center whitespace-nowrap"
                      >
                        {cert.recipientNameAr}
                      </span>
                    )}
                    {layout.programTitle?.visible !== false && (
                      <span
                        style={pos('programTitle', 50, 57, 17)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 font-bold text-center whitespace-nowrap"
                      >
                        {cert.titleAr}
                      </span>
                    )}
                    {layout.issueDate?.visible !== false && (
                      <span
                        style={pos('issueDate', 25, 78, 13)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 font-semibold whitespace-nowrap"
                      >
                        {formatDate(cert.issuedAt)}
                      </span>
                    )}
                    {layout.verificationCode?.visible !== false && (
                      <span
                        style={pos('verificationCode', 75, 78, 12)}
                        dir="ltr"
                        className="absolute -translate-x-1/2 -translate-y-1/2 font-mono font-bold whitespace-nowrap"
                      >
                        {cert.certificateCode}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative p-8 text-center space-y-4 border-[8px] border-[#1536B5]/20 min-h-[340px] flex flex-col justify-center">
                    <span className="pointer-events-none select-none absolute inset-0 flex items-center justify-center text-2xl font-black text-[#1536B5]/10 -rotate-12">
                      نموذج معاينة مؤقت — أكاديمية بوصلة
                    </span>
                    <p className="text-xs font-extrabold tracking-wide text-[#4A1FB0]">
                      أكاديمية بوصلة للتدريب التطبيقي • BOSLA ACADEMY
                    </p>
                    <h3 className="text-2xl font-black text-[#0A2A8A]">
                      {cert.learningPathId ? 'شهادة إتمام وحضور مسار تدريبي' : 'شهادة إتمام وحضور كورس'}
                    </h3>
                    <p className="text-sm text-slate-600">تشهد الأكاديمية بأن المتدرب/ة</p>
                    <p className="text-2xl font-black text-[#1536B5]">{cert.recipientNameAr}</p>
                    <p className="text-sm text-slate-600">قد أتمّ المتطلبات الكاملة للبرنامج التدريبي</p>
                    <p className="text-lg font-extrabold text-[#2F1675]">{cert.titleAr}</p>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-600">
                      <span>تاريخ الإصدار: {formatDate(cert.issuedAt)}</span>
                      <span dir="ltr" className="font-mono font-bold">
                        {cert.certificateCode}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 no-print">
                <Button variant="primary" size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  طباعة / حفظ كـ PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPrintCertDetail(null)}>
                  إغلاق
                </Button>
              </div>
            </div>
          );
        })()}
      </NativeModal>

      {/* Printable Recommendation Letter Modal */}
      <NativeModal
        open={Boolean(printRec)}
        onClose={() => setPrintRec(null)}
        title="خطاب توصية مهنية معتمد — جاهز للطباعة (PDF)"
      >
        {printRec && (
          <div className="space-y-4">
            <div className="bosla-print-sheet rounded-xl border border-slate-200 bg-white p-8 text-[#0B1440] space-y-5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-extrabold text-[#4A1FB0]">أكاديمية بوصلة • BOSLA ACADEMY</p>
                  <h3 className="text-xl font-black text-[#0A2A8A]">
                    {printRec.letterTitleAr || 'خطاب توصية مهنية'}
                  </h3>
                </div>
                <div className="text-end text-xs text-slate-600">
                  <p>تاريخ الاعتماد: {formatDate(printRec.approvedAt || printRec.requestedAt)}</p>
                  <p dir="ltr" className="font-mono font-bold text-[#1536B5]">
                    {printRec.verificationCode}
                  </p>
                </div>
              </div>

              <div className="text-sm leading-loose whitespace-pre-line text-slate-800">
                {printRec.letterBodyAr}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 border-t border-slate-200 pt-4 text-xs text-slate-700">
                <div>
                  <p className="font-bold text-slate-500">مُصدر التوصية (المدرب):</p>
                  <p className="font-extrabold text-[#0A2A8A]">{printRec.instructor?.fullName}</p>
                  {printRec.instructor?.headlineAr && <p>{printRec.instructor.headlineAr}</p>}
                </div>
                <div className="sm:text-end">
                  <p className="font-bold text-slate-500">التحقق الإلكتروني:</p>
                  <p className="flex items-center sm:justify-end gap-1 text-emerald-700 font-bold">
                    <ShieldCheck className="h-4 w-4" />
                    موثّق برمز {printRec.verificationCode} عبر bosla.academy/certificates/verify
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 no-print">
              <Button variant="primary" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                طباعة / حفظ كـ PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPrintRec(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        )}
      </NativeModal>
    </div>
  );
}
