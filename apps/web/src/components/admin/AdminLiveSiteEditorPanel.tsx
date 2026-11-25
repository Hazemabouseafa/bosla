'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  History,
  Layout,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  apiFetch,
  API_BASE_URL,
  ensureCsrfToken,
  formatEgp,
  formatNumber,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
  selectClassName,
  textareaClassName,
} from '@/components/ui/primitives';

type EditorTargetArea =
  | 'sections'
  | 'header'
  | 'hero'
  | 'storytelling'
  | 'courses'
  | 'trainers'
  | 'testimonials'
  | 'pricing'
  | 'partners'
  | 'careers'
  | 'faqs'
  | 'social'
  | 'contact'
  | 'footer'
  | 'history';

const SECTION_LABELS_AR: Record<string, string> = {
  hero: 'المشهد الافتتاحي (Hero)',
  storytelling: 'رحلة التعلّم والتطبيق والتطور المهني',
  scene2: 'المعيار الميداني (Scene 2)',
  pillars: 'الأركان التشغيلية الأربعة',
  thesis: 'ركيزة الفهم الميداني',
  elevation: 'من الطالب إلى المدير',
  courses: 'البرامج والكورسات التطبيقية',
  pricing: 'الباقات والأسعار',
  trainers: 'المدربون والخبراء',
  testimonials: 'آراء المتدربين (يُخفى تلقائياً عند عدم النشر)',
  partners: 'شركاؤنا',
  partner_apply: 'انضم كشريك نجاح',
  careers: 'الوظائف والانضمام',
  faq: 'الأسئلة الشائعة',
  contact: 'التواصل المباشر',
};

type ViewportSize = 'DESKTOP' | 'TABLET' | 'MOBILE';

export function AdminLiveSiteEditorPanel({
  onNavigateToPlansManagement,
}: {
  onNavigateToPlansManagement?: () => void;
}) {
  const { pushToast } = useAuth();

  const [loading, setLoading] = useState(true);
  const [stateData, setStateData] = useState<any | null>(null);
  const [draftConfig, setDraftConfig] = useState<any | null>(null);
  const [baseVersion, setBaseVersion] = useState<number>(1);
  const [activeArea, setActiveArea] = useState<EditorTargetArea>('hero');
  const [viewport, setViewport] = useState<ViewportSize>('DESKTOP');

  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [publishSummary, setPublishSummary] = useState('');
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null);

  const loadEditorState = useCallback(async () => {
    setLoading(true);
    setConflictError(null);
    try {
      const res = await apiFetch<any>('/admin/live-editor/state?pageKey=home');
      setStateData(res);
      const cfg = res?.draft?.config ?? res?.draftConfig ?? res?.publishedConfig ?? {};
      setDraftConfig(structuredClone(cfg));
      setBaseVersion(
        res?.draft?.versionNumber ??
          res?.currentDraftVersion ??
          res?.published?.versionNumber ??
          0,
      );
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل بيانات محرر الموقع المباشر', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadEditorState();
  }, [loadEditorState]);

  const handleSaveDraft = async () => {
    if (!draftConfig || savingDraft) return;
    setSavingDraft(true);
    setConflictError(null);
    try {
      const res = await apiFetch<any>('/admin/live-editor/draft', {
        method: 'PUT',
        body: JSON.stringify({
          pageKey: 'home',
          baseVersion,
          summaryAr: publishSummary.trim() || 'حفظ مسودة تخصيص الموقع',
          config: draftConfig,
        }),
      });
      const cfg = res?.draft?.config ?? res?.draftConfig ?? draftConfig;
      setDraftConfig(structuredClone(cfg));
      const nextVer =
        res?.draft?.versionNumber ?? res?.currentDraftVersion ?? baseVersion;
      setBaseVersion(nextVer);
      setStateData((prev: any) => ({
        ...prev,
        ...res,
        hasUnpublishedChanges: true,
      }));
      pushToast('تم حفظ المسودة بنجاح (لم تُنشر للزوار بعد)', 'success');
    } catch (err: any) {
      if (err?.status === 409 || String(err?.message || '').includes('تعارض')) {
        setConflictError(
          err?.message ||
            'حدث تعارض في الإصدار لأن مسؤولاً آخر قام بتحديث الصفحة. يرجى تحديث الحالة.',
        );
      } else {
        pushToast(err?.message || 'تعذر حفظ المسودة', 'error');
      }
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    if (!draftConfig || publishing) return;
    setPublishing(true);
    setConflictError(null);
    try {
      // Save latest draft state first, then publish
      const draftRes = await apiFetch<any>('/admin/live-editor/draft', {
        method: 'PUT',
        body: JSON.stringify({
          pageKey: 'home',
          baseVersion,
          summaryAr: publishSummary.trim() || 'تحديث قبل النشر',
          config: draftConfig,
        }),
      });
      const currentBase =
        draftRes?.draft?.versionNumber ??
        draftRes?.currentDraftVersion ??
        baseVersion;

      const pubRes = await apiFetch<any>('/admin/live-editor/publish', {
        method: 'POST',
        body: JSON.stringify({
          pageKey: 'home',
          baseVersion: currentBase,
          summaryAr:
            publishSummary.trim() || 'نشر تعديلات واجهة الموقع من المحرر المباشر',
        }),
      });
      const nextBase =
        pubRes?.nextDraftVersion ??
        pubRes?.draft?.versionNumber ??
        pubRes?.published?.versionNumber ??
        currentBase + 1;
      setBaseVersion(nextBase);
      setStateData((prev: any) => ({
        ...prev,
        ...pubRes,
        hasUnpublishedChanges: false,
      }));
      setPublishSummary('');
      pushToast('تم نشر التعديلات للزوار بنجاح!', 'success');
    } catch (err: any) {
      if (err?.status === 409 || String(err?.message || '').includes('تعارض')) {
        setConflictError(
          err?.message ||
            'حدث تعارض في الإصدار لأن مسؤولاً آخر قام بالنشر قبلك. يرجى تحديث الحالة.',
        );
      } else {
        pushToast(err?.message || 'تعذر نشر التعديلات', 'error');
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (revisionId: string) => {
    if (rollingBackId) return;
    setRollingBackId(revisionId);
    try {
      await apiFetch<any>(
        `/admin/live-editor/rollback/${revisionId}?pageKey=home`,
        { method: 'POST' },
      );
      await loadEditorState();
      pushToast('تمت استعادة الإصدار السابق ونشره للزوار فوراً', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر استعادة الإصدار السابق', 'error');
    } finally {
      setRollingBackId(null);
    }
  };

  const handleUploadMedia = async (
    file: File | null,
    targetKey: 'heroImage1Url' | 'heroImage2Url',
  ) => {
    if (!file) return;
    setUploadingImageKey(targetKey);
    try {
      const csrf = await ensureCsrfToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE_URL}/instructor/media/covers`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        body: fd,
      });
      if (!res.ok) throw new Error('تعذر رفع الصورة');
      const json = await res.json();
      const url = json?.data?.url ?? json?.url;
      if (url) {
        setDraftConfig((prev: any) => ({
          ...prev,
          hero: {
            ...prev.hero,
            [targetKey]: url,
          },
        }));
        pushToast('تم رفع الصورة وتحديث المعاينة المباشرة', 'success');
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر رفع الصورة', 'error');
    } finally {
      setUploadingImageKey(null);
    }
  };

  if (loading || !draftConfig) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-400" />
        <p className="mt-2 text-sm font-semibold text-slate-300">
          جارٍ تحميل محرر واجهة الموقع المباشر (Live Editor)...
        </p>
      </Card>
    );
  }

  const availableCourses: any[] =
    stateData?.availableCourses ?? stateData?.availablePublishedCourses ?? [];
  const availablePlans: any[] = stateData?.availablePlans ?? [];
  const historyList: any[] = stateData?.revisions ?? stateData?.history ?? [];

  const moveSection = (index: number, direction: 'UP' | 'DOWN') => {
    const secs = [...(draftConfig.sections ?? [])];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= secs.length) return;
    const [moved] = secs.splice(index, 1);
    secs.splice(targetIdx, 0, moved);
    setDraftConfig({ ...draftConfig, sections: secs });
  };

  const toggleSectionVisibility = (key: string) => {
    const secs = (draftConfig.sections ?? []).map((s: any) =>
      s.key === key ? { ...s, visible: !s.visible } : s,
    );
    setDraftConfig({ ...draftConfig, sections: secs });
  };

  const AREA_TABS: Array<{ id: EditorTargetArea; label: string }> = [
    { id: 'hero', label: 'الـ Hero والمشهد' },
    { id: 'storytelling', label: 'رحلة التعلّم والتطبيق' },
    { id: 'sections', label: 'ترتيب وإظهار الأقسام' },
    { id: 'header', label: 'الهيدر والإعلان' },
    { id: 'courses', label: 'الكورسات المميزة' },
    { id: 'trainers', label: 'شريط المدربين' },
    { id: 'testimonials', label: 'آراء المتدربين' },
    { id: 'pricing', label: 'الباقات والأسعار' },
    { id: 'partners', label: 'الشركاء' },
    { id: 'careers', label: 'الوظائف' },
    { id: 'faqs', label: 'الأسئلة الشائعة' },
    { id: 'social', label: 'التواصل الاجتماعي' },
    { id: 'contact', label: 'بيانات التواصل' },
    { id: 'footer', label: 'الفوتر والتحقق' },
    { id: 'history', label: `سجل الإصدارات (${formatNumber(historyList.length)})` },
  ];

  const previewWidthClass =
    viewport === 'MOBILE'
      ? 'max-w-[375px] mx-auto'
      : viewport === 'TABLET'
      ? 'max-w-[768px] mx-auto'
      : 'w-full';

  return (
    <div className="space-y-5" data-testid="admin-live-site-editor">
      {/* Top Control Bar: Version Status, Viewport Switcher, Save Draft vs Publish */}
      <Card className="p-4 sm:p-5 border-indigo-500/25">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">تخصيص الموقع (Live Editor)</Badge>
              <Badge tone="success">
                الإصدار المنشور للزوار: v{formatNumber(stateData?.published?.versionNumber ?? 1)}
              </Badge>
              {stateData?.hasUnpublishedChanges ? (
                <Badge tone="warning">يوجد تعديلات مسودة غير منشورة</Badge>
              ) : (
                <Badge tone="info">المسودة مطابقة للمنشور</Badge>
              )}
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-slate-100">
              إدارة الصفحة الرئيسية والهيدر والفوتر والباقات بمعاينة فورية
            </h2>
            <p className="text-xs text-slate-400">
              عدّل النصوص والصور والأزرار وترتيب الأقسام في المسودة دون التأثير على الزوار، ثم اضغط «نشر التعديلات» عند الاعتماد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Viewport Switcher: Desktop / Tablet / Mobile */}
            <div
              className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1"
              role="group"
              aria-label="حجم شاشة المعاينة"
            >
              <button
                type="button"
                data-testid="live-editor-viewport-desktop"
                onClick={() => setViewport('DESKTOP')}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                  viewport === 'DESKTOP'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>ديسكتوب</span>
              </button>
              <button
                type="button"
                data-testid="live-editor-viewport-tablet"
                onClick={() => setViewport('TABLET')}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                  viewport === 'TABLET'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Tablet className="h-3.5 w-3.5" />
                <span>تابلت</span>
              </button>
              <button
                type="button"
                data-testid="live-editor-viewport-mobile"
                onClick={() => setViewport('MOBILE')}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                  viewport === 'MOBILE'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>موبايل</span>
              </button>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="live-editor-save-draft-btn"
              disabled={savingDraft || publishing}
              onClick={() => void handleSaveDraft()}
            >
              {savingDraft ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              حفظ كمسودة
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="live-editor-publish-btn"
              disabled={publishing || savingDraft}
              onClick={() => void handlePublish()}
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              نشر التعديلات للزوار
            </Button>
          </div>
        </div>

        {conflictError && (
          <div className="mt-4" data-testid="live-editor-conflict-banner">
            <AlertBanner tone="danger" title="تعارض في إصدار التعديل (Optimistic Lock 409)">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{conflictError}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadEditorState()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  تحديث الحالة لأحدث إصدار
                </Button>
              </div>
            </AlertBanner>
          </div>
        )}
      </Card>

      {/* Main Split Workspace: Controls (5 cols) + Interactive Live Preview (7 cols) */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Right/Start Column in RTL: Section Navigation + Active Section Form */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-3">
            <div className="flex flex-wrap gap-1.5">
              {AREA_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`live-editor-tab-${t.id}`}
                  onClick={() => setActiveArea(t.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${
                    activeArea === t.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            {/* 1. HERO SETTINGS */}
            {activeArea === 'hero' && (
              <div className="space-y-4" data-testid="live-editor-panel-hero">
                <h3 className="text-sm font-extrabold text-slate-100">
                  تعديل قسم الـ Hero والمشهد الانتقالي
                </h3>
                <Field label="الشارة العلوية (Badge)">
                  <input
                    data-testid="live-editor-hero-badge"
                    value={draftConfig.hero?.badgeAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        hero: { ...draftConfig.hero, badgeAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="العنوان الرئيسي في الـ Hero">
                  <input
                    data-testid="live-editor-hero-title"
                    value={draftConfig.hero?.titleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        hero: { ...draftConfig.hero, titleAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="الوصف الفرعي في الـ Hero">
                  <textarea
                    rows={3}
                    data-testid="live-editor-hero-subtitle"
                    value={draftConfig.hero?.subtitleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        hero: { ...draftConfig.hero, subtitleAr: e.target.value },
                      })
                    }
                    className={textareaClassName}
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="نص الزر الرئيسي">
                    <input
                      value={draftConfig.hero?.primaryCtaLabelAr ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          hero: {
                            ...draftConfig.hero,
                            primaryCtaLabelAr: e.target.value,
                          },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="رابط الزر الرئيسي">
                    <input
                      dir="ltr"
                      value={draftConfig.hero?.primaryCtaHref ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          hero: {
                            ...draftConfig.hero,
                            primaryCtaHref: e.target.value,
                          },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="نص الزر الثانوي">
                    <input
                      value={draftConfig.hero?.secondaryCtaLabelAr ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          hero: {
                            ...draftConfig.hero,
                            secondaryCtaLabelAr: e.target.value,
                          },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="رابط الزر الثانوي">
                    <input
                      dir="ltr"
                      value={draftConfig.hero?.secondaryCtaHref ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          hero: {
                            ...draftConfig.hero,
                            secondaryCtaHref: e.target.value,
                          },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>

                {/* Hero Scene 1 & Scene 2 Media Upload / Replacement */}
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <span className="text-xs font-extrabold text-slate-200">
                      صورة المشهد الأول (Hero Scene 1)
                    </span>
                    <input
                      dir="ltr"
                      value={draftConfig.hero?.heroImage1Url ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          hero: { ...draftConfig.hero, heroImage1Url: e.target.value },
                        })
                      }
                      className={`${inputClassName} text-xs`}
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-800">
                      <Upload className="h-3 w-3" />
                      <span>
                        {uploadingImageKey === 'heroImage1Url'
                          ? 'جارٍ الرفع...'
                          : 'رفع صورة بديلة'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          void handleUploadMedia(
                            e.target.files?.[0] ?? null,
                            'heroImage1Url',
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <span className="text-xs font-extrabold text-slate-200">
                      صورة المشهد الثاني (Scroll Scene 2)
                    </span>
                    <input
                      dir="ltr"
                      value={draftConfig.hero?.heroImage2Url ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          hero: { ...draftConfig.hero, heroImage2Url: e.target.value },
                        })
                      }
                      className={`${inputClassName} text-xs`}
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-800">
                      <Upload className="h-3 w-3" />
                      <span>
                        {uploadingImageKey === 'heroImage2Url'
                          ? 'جارٍ الرفع...'
                          : 'رفع صورة بديلة'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          void handleUploadMedia(
                            e.target.files?.[0] ?? null,
                            'heroImage2Url',
                          )
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <label className="space-y-1 text-xs text-slate-300">
                    <span>نقطة الارتكاز الأفقي لـ Hero ({draftConfig.hero?.focalX ?? 50}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={draftConfig.hero?.focalX ?? 50}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          hero: { ...draftConfig.hero, focalX: Number(e.target.value) },
                        })
                      }
                      className="w-full accent-indigo-500"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-300">
                    <span>نقطة الارتكاز الرأسي لـ Hero ({draftConfig.hero?.focalY ?? 42}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={draftConfig.hero?.focalY ?? 42}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          hero: { ...draftConfig.hero, focalY: Number(e.target.value) },
                        })
                      }
                      className="w-full accent-indigo-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 1.5 STORYTELLING SECTION */}
            {activeArea === 'storytelling' && (
              <div className="space-y-4" data-testid="live-editor-panel-storytelling">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-100">
                    تخصيص رحلة التعلّم ← التطبيق ← التطور المهني
                  </h3>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={draftConfig.storytelling?.visible !== false}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          storytelling: {
                            ...draftConfig.storytelling,
                            visible: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-indigo-600"
                    />
                    <span>ظاهر بالرئيسية</span>
                  </label>
                </div>
                <Field label="عنوان القسم">
                  <input
                    value={draftConfig.storytelling?.titleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        storytelling: { ...draftConfig.storytelling, titleAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="الوصف المختصر">
                  <textarea
                    rows={2}
                    value={draftConfig.storytelling?.subtitleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        storytelling: { ...draftConfig.storytelling, subtitleAr: e.target.value },
                      })
                    }
                    className={textareaClassName}
                  />
                </Field>
                <div className="space-y-2.5">
                  {(draftConfig.storytelling?.steps ?? []).map((st: any, idx: number) => (
                    <div key={st.stepNumber || idx} className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-300">#{st.stepNumber || `0${idx + 1}`}</span>
                        <input
                          value={st.titleAr ?? ''}
                          onChange={(e) => {
                            const nextSteps = [...(draftConfig.storytelling?.steps ?? [])];
                            nextSteps[idx] = { ...nextSteps[idx], titleAr: e.target.value };
                            setDraftConfig({
                              ...draftConfig,
                              storytelling: { ...draftConfig.storytelling, steps: nextSteps },
                            });
                          }}
                          className={`${inputClassName} h-8 text-xs font-bold`}
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={st.descriptionAr ?? ''}
                        onChange={(e) => {
                          const nextSteps = [...(draftConfig.storytelling?.steps ?? [])];
                          nextSteps[idx] = { ...nextSteps[idx], descriptionAr: e.target.value };
                          setDraftConfig({
                            ...draftConfig,
                            storytelling: { ...draftConfig.storytelling, steps: nextSteps },
                          });
                        }}
                        className={`${textareaClassName} text-xs`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 1.7 TRAINERS MARQUEE SETTINGS */}
            {activeArea === 'trainers' && (
              <div className="space-y-4" data-testid="live-editor-panel-trainers">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-100">
                    قسم المدربين والخبراء (Marquee)
                  </h3>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={draftConfig.trainers?.visible !== false}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          trainers: { ...draftConfig.trainers, visible: e.target.checked },
                        })
                      }
                      className="h-4 w-4 accent-indigo-600"
                    />
                    <span>ظاهر بالرئيسية</span>
                  </label>
                </div>
                <Field label="عنوان القسم">
                  <input
                    value={draftConfig.trainers?.titleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        trainers: { ...draftConfig.trainers, titleAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="الوصف الفرعي">
                  <input
                    value={draftConfig.trainers?.subtitleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        trainers: { ...draftConfig.trainers, subtitleAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label={`سرعة التمرير التلقائي (${draftConfig.trainers?.autoSpeedSeconds ?? 32} ثانية للدورة)`}>
                  <input
                    type="range"
                    min={15}
                    max={80}
                    value={draftConfig.trainers?.autoSpeedSeconds ?? 32}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        trainers: {
                          ...draftConfig.trainers,
                          autoSpeedSeconds: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-indigo-500"
                  />
                </Field>
                <AlertBanner tone="info" title="ترتيب وإظهار المدربين">
                  لترتيب المدربين وإظهارهم في الرئيسية، انتقل إلى قسم «الشركاء والآراء والوظائف والمدربون» من القائمة الجانبية.
                </AlertBanner>
              </div>
            )}

            {/* 1.8 TESTIMONIALS SETTINGS */}
            {activeArea === 'testimonials' && (
              <div className="space-y-4" data-testid="live-editor-panel-testimonials">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-100">
                    قسم آراء المتدربين (يُخفى عند عدم النشر)
                  </h3>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={draftConfig.testimonials?.visible !== false}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          testimonials: { ...draftConfig.testimonials, visible: e.target.checked },
                        })
                      }
                      className="h-4 w-4 accent-indigo-600"
                    />
                    <span>تفعيل العرض عند النشر</span>
                  </label>
                </div>
                <Field label="عنوان القسم">
                  <input
                    value={draftConfig.testimonials?.titleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        testimonials: { ...draftConfig.testimonials, titleAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="الوصف المختصر">
                  <input
                    value={draftConfig.testimonials?.subtitleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        testimonials: { ...draftConfig.testimonials, subtitleAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <AlertBanner tone="info" title="آراء حقيقية فقط">
                  تتم إضافة الآراء المعتمدة من صفحة إدارة المحتوى، ويُخفى هذا القسم تلقائياً إذا كان عدد الآراء المنشورة صفراً.
                </AlertBanner>
              </div>
            )}

            {/* 1.9 CAREERS SETTINGS */}
            {activeArea === 'careers' && (
              <div className="space-y-4" data-testid="live-editor-panel-careers">
                <Field label="عنوان صفحة الوظائف">
                  <input
                    value={draftConfig.careers?.titleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        careers: { ...draftConfig.careers, titleAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="عنوان رابط الوظائف بالقائمة">
                  <input
                    value={draftConfig.careers?.navLabelAr ?? 'الوظائف'}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        careers: { ...draftConfig.careers, navLabelAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="الوصف التعريفي">
                  <textarea
                    rows={2}
                    value={draftConfig.careers?.subtitleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        careers: { ...draftConfig.careers, subtitleAr: e.target.value },
                      })
                    }
                    className={textareaClassName}
                  />
                </Field>
              </div>
            )}

            {/* 1.95 SOCIAL MEDIA LINKS */}
            {activeArea === 'social' && (
              <div className="space-y-3" data-testid="live-editor-panel-social">
                <h3 className="text-sm font-extrabold text-slate-100">
                  روابط التواصل الاجتماعي الرسمية (تظهر عند إدخالها فقط)
                </h3>
                {[
                  { key: 'facebookUrl', label: 'فيسبوك (Facebook)' },
                  { key: 'youtubeUrl', label: 'يوتيوب (YouTube)' },
                  { key: 'linkedinUrl', label: 'لينكدإن (LinkedIn)' },
                  { key: 'instagramUrl', label: 'إنستجرام (Instagram)' },
                  { key: 'xUrl', label: 'منصة X' },
                ].map((s) => (
                  <Field key={s.key} label={s.label}>
                    <input
                      dir="ltr"
                      placeholder="https://..."
                      value={draftConfig.social?.[s.key] ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          social: { ...draftConfig.social, [s.key]: e.target.value },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                ))}
              </div>
            )}

            {/* 2. SECTIONS ORDER & VISIBILITY */}
            {activeArea === 'sections' && (() => {
              const sectionList: Array<{ key: string; labelAr: string; visible: boolean }> =
                Array.isArray(draftConfig.sections) && draftConfig.sections.length > 0
                  ? draftConfig.sections
                  : (Array.isArray(draftConfig.sectionOrder) ? draftConfig.sectionOrder : []).map((k: string) => ({
                      key: k,
                      labelAr: SECTION_LABELS_AR[k] || k,
                      visible: draftConfig[k]?.visible !== false,
                    }));
              const moveAnySection = (index: number, direction: 'UP' | 'DOWN') => {
                if (Array.isArray(draftConfig.sections) && draftConfig.sections.length > 0) {
                  moveSection(index, direction);
                  return;
                }
                const order = [...(draftConfig.sectionOrder ?? [])];
                const targetIdx = direction === 'UP' ? index - 1 : index + 1;
                if (targetIdx < 0 || targetIdx >= order.length) return;
                const [moved] = order.splice(index, 1);
                order.splice(targetIdx, 0, moved);
                setDraftConfig({ ...draftConfig, sectionOrder: order });
              };
              const toggleAnyVisibility = (key: string) => {
                if (Array.isArray(draftConfig.sections) && draftConfig.sections.length > 0) {
                  toggleSectionVisibility(key);
                  return;
                }
                const currentObj = draftConfig[key] && typeof draftConfig[key] === 'object' ? draftConfig[key] : {};
                setDraftConfig({
                  ...draftConfig,
                  [key]: { ...currentObj, visible: currentObj.visible === false },
                });
              };
              return (
                <div className="space-y-3" data-testid="live-editor-panel-sections">
                  <h3 className="text-sm font-extrabold text-slate-100">
                    ترتيب أقسام الصفحة الرئيسية وإظهارها أو إخفاؤها
                  </h3>
                  <div className="space-y-2">
                    {sectionList.map((sec, idx) => (
                      <div
                        key={sec.key}
                        data-testid={`live-editor-section-row-${sec.key}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveAnySection(idx, 'UP')}
                              aria-label="تحريك القسم لأعلى"
                              className="rounded bg-slate-800 p-0.5 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === sectionList.length - 1}
                              onClick={() => moveAnySection(idx, 'DOWN')}
                              aria-label="تحريك القسم لأسفل"
                              className="rounded bg-slate-800 p-0.5 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="font-extrabold text-slate-100">
                            {formatNumber(idx + 1)}. {sec.labelAr}
                          </span>
                        </div>

                        <button
                          type="button"
                          data-testid={`live-editor-toggle-sec-${sec.key}`}
                          onClick={() => toggleAnyVisibility(sec.key)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold ${
                            sec.visible
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {sec.visible ? (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              <span>ظاهر</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              <span>مخفي</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 3. HEADER SETTINGS */}
            {activeArea === 'header' && (
              <div className="space-y-4" data-testid="live-editor-panel-header">
                <h3 className="text-sm font-extrabold text-slate-100">
                  إعدادات الهيدر وشريط الإعلان العلوي
                </h3>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(draftConfig.header?.showAnnouncement)}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        header: {
                          ...draftConfig.header,
                          showAnnouncement: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <span>إظهار شريط الإعلان العلوي فوق الهيدر</span>
                </label>

                <Field label="نص شريط الإعلان العلوي">
                  <input
                    value={draftConfig.header?.announcementTextAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        header: {
                          ...draftConfig.header,
                          announcementTextAr: e.target.value,
                        },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="نص زر الإجراء في الهيدر">
                    <input
                      value={draftConfig.header?.ctaLabelAr ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          header: { ...draftConfig.header, ctaLabelAr: e.target.value },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="رابط زر الهيدر">
                    <input
                      dir="ltr"
                      value={draftConfig.header?.ctaHref ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          header: { ...draftConfig.header, ctaHref: e.target.value },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* 4. FEATURED COURSES PICKER */}
            {activeArea === 'courses' && (
              <div className="space-y-3" data-testid="live-editor-panel-courses">
                <h3 className="text-sm font-extrabold text-slate-100">
                  اختيار الكورسات المميزة في الصفحة الرئيسية
                </h3>
                <p className="text-xs text-slate-400">
                  تظهر الكورسات المنشورة فقط. الكورسات في حالة مسودة لا تظهر للزوار أبداً.
                </p>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {availableCourses.map((c) => {
                    const selectedIds: string[] =
                      draftConfig.featuredCourseIds ?? [];
                    const isChecked = selectedIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selectedIds, c.id]
                                : selectedIds.filter((id) => id !== c.id);
                              setDraftConfig({
                                ...draftConfig,
                                featuredCourseIds: next,
                              });
                            }}
                            className="h-4 w-4 rounded accent-indigo-600"
                          />
                          <span className="font-bold text-slate-100 truncate">
                            {c.titleAr}
                          </span>
                        </div>
                        <Badge tone={c.isFree ? 'success' : 'info'}>
                          {c.isFree ? 'مجاني' : formatEgp(c.priceCents)}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. PRICING SECTION SETTINGS */}
            {activeArea === 'pricing' && (
              <div className="space-y-4" data-testid="live-editor-panel-pricing">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-100">
                    إعدادات قسم الباقات والأسعار في الصفحة الرئيسية
                  </h3>
                  {onNavigateToPlansManagement && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={onNavigateToPlansManagement}
                    >
                      إدارة أسعار الباقات الفعلية ←
                    </Button>
                  )}
                </div>

                {availablePlans.filter((p) => p.isActive && p.isVisible).length === 0 && (
                  <div data-testid="live-editor-no-plans-warning">
                    <AlertBanner tone="warning" title="لا توجد باقات عضوية منشورة حالياً">
                      يتم إخفاء قسم الأسعار تلقائياً للزوار في الصفحة الرئيسية حتى يتم تفعيل ونشر باقة واحدة على الأقل.
                    </AlertBanner>
                  </div>
                )}

                <Field label="عنوان قسم الأسعار">
                  <input
                    data-testid="live-editor-pricing-title"
                    value={draftConfig.pricing?.titleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        pricing: { ...draftConfig.pricing, titleAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="الوصف الفرعي لقسم الأسعار">
                  <input
                    value={draftConfig.pricing?.subtitleAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        pricing: { ...draftConfig.pricing, subtitleAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="الباقة المميزة (Featured Plan)">
                    <select
                      data-testid="live-editor-featured-plan-select"
                      value={draftConfig.pricing?.featuredPlanId ?? ''}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pricing: {
                            ...draftConfig.pricing,
                            featuredPlanId: e.target.value || null,
                          },
                        })
                      }
                      className={selectClassName}
                    >
                      <option value="">— تلقائي (الباقة السنوية) —</option>
                      {availablePlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameAr} ({formatEgp(p.priceCents)})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="نص شارة الباقة المميزة">
                    <input
                      value={draftConfig.pricing?.featuredBadgeAr ?? 'الأكثر اختياراً'}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          pricing: {
                            ...draftConfig.pricing,
                            featuredBadgeAr: e.target.value,
                          },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-extrabold text-slate-200">
                    تحديد الباقات المعروضة وترتيبها:
                  </span>
                  {availablePlans.map((p) => {
                    const selectedIds: string[] =
                      draftConfig.pricing?.selectedPlanIds ?? [];
                    const isChecked =
                      selectedIds.length === 0 || selectedIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const current =
                                selectedIds.length === 0
                                  ? availablePlans.map((pl) => pl.id)
                                  : selectedIds;
                              const next = e.target.checked
                                ? [...current, p.id]
                                : current.filter((id) => id !== p.id);
                              setDraftConfig({
                                ...draftConfig,
                                pricing: {
                                  ...draftConfig.pricing,
                                  selectedPlanIds: next,
                                },
                              });
                            }}
                            className="h-4 w-4 rounded accent-indigo-600"
                          />
                          <span className="font-bold text-slate-100">{p.nameAr}</span>
                        </div>
                        <Badge tone="purple">{formatEgp(p.priceCents)}</Badge>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. PARTNERS EDITOR */}
            {activeArea === 'partners' && (
              <div className="space-y-4" data-testid="live-editor-panel-partners">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-100">
                    إدارة قسم الشركاء وزر الانضمام في الرئيسية
                  </h3>
                </div>
                {!Array.isArray(draftConfig.partners) ? (
                  <div className="space-y-3">
                    <Field label="عنوان قسم الشركاء">
                      <input
                        value={draftConfig.partners?.titleAr ?? 'شركاؤنا في التدريب وقطاع الأعمال'}
                        onChange={(e) =>
                          setDraftConfig({
                            ...draftConfig,
                            partners: { ...draftConfig.partners, titleAr: e.target.value },
                          })
                        }
                        className={inputClassName}
                      />
                    </Field>
                    <Field label="الوصف المختصر">
                      <input
                        value={draftConfig.partners?.subtitleAr ?? ''}
                        onChange={(e) =>
                          setDraftConfig({
                            ...draftConfig,
                            partners: { ...draftConfig.partners, subtitleAr: e.target.value },
                          })
                        }
                        className={inputClassName}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="نص زر الانضمام كشريك">
                        <input
                          value={draftConfig.partners?.ctaLabelAr ?? 'انضم كشريك نجاح'}
                          onChange={(e) =>
                            setDraftConfig({
                              ...draftConfig,
                              partners: { ...draftConfig.partners, ctaLabelAr: e.target.value },
                            })
                          }
                          className={inputClassName}
                        />
                      </Field>
                      <Field label="وجهة الزر (Href)">
                        <input
                          dir="ltr"
                          value={draftConfig.partners?.ctaHref ?? '#partner-apply'}
                          onChange={(e) =>
                            setDraftConfig({
                              ...draftConfig,
                              partners: { ...draftConfig.partners, ctaHref: e.target.value },
                            })
                          }
                          className={inputClassName}
                        />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {(draftConfig.partners ?? []).map((p: any, idx: number) => (
                      <div key={p.id || idx} className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
                        <input
                          value={p.nameAr ?? ''}
                          onChange={(e) => {
                            const next = [...draftConfig.partners];
                            next[idx] = { ...next[idx], nameAr: e.target.value };
                            setDraftConfig({ ...draftConfig, partners: next });
                          }}
                          className={`${inputClassName} h-8 text-xs`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 7. FAQS EDITOR */}
            {activeArea === 'faqs' && (
              <div className="space-y-3" data-testid="live-editor-panel-faqs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-100">
                    إدارة الأسئلة الشائعة في الصفحة الرئيسية
                  </h3>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setDraftConfig({
                        ...draftConfig,
                        faqs: [
                          ...(draftConfig.faqs ?? []),
                          {
                            id: `faq_${Date.now()}`,
                            questionAr: 'سؤال جديد؟',
                            answerAr: 'الإجابة التفصيلية هنا...',
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    إضافة سؤال
                  </Button>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {(draftConfig.faqs ?? []).map((f: any, idx: number) => (
                    <div
                      key={f.id || idx}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          value={f.questionAr ?? ''}
                          onChange={(e) => {
                            const next = [...(draftConfig.faqs ?? [])];
                            next[idx] = { ...next[idx], questionAr: e.target.value };
                            setDraftConfig({ ...draftConfig, faqs: next });
                          }}
                          className={`${inputClassName} h-8 text-xs font-bold`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = (draftConfig.faqs ?? []).filter(
                              (_: any, i: number) => i !== idx,
                            );
                            setDraftConfig({ ...draftConfig, faqs: next });
                          }}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={f.answerAr ?? ''}
                        onChange={(e) => {
                          const next = [...(draftConfig.faqs ?? [])];
                          next[idx] = { ...next[idx], answerAr: e.target.value };
                          setDraftConfig({ ...draftConfig, faqs: next });
                        }}
                        className={`${textareaClassName} text-xs`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. CONTACT DETAILS */}
            {activeArea === 'contact' && (
              <div className="space-y-3" data-testid="live-editor-panel-contact">
                <h3 className="text-sm font-extrabold text-slate-100">
                  تعديل بيانات التواصل المباشر
                </h3>
                <Field label="البريد الإلكتروني الرسمي">
                  <input
                    dir="ltr"
                    value={draftConfig.contact?.email ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        contact: { ...draftConfig.contact, email: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="رقم الهاتف">
                  <input
                    dir="ltr"
                    value={draftConfig.contact?.phone ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        contact: { ...draftConfig.contact, phone: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="رقم واتساب">
                  <input
                    dir="ltr"
                    value={draftConfig.contact?.whatsapp ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        contact: { ...draftConfig.contact, whatsapp: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="العنوان الجغرافي بالعربية">
                  <input
                    value={draftConfig.contact?.addressAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        contact: { ...draftConfig.contact, addressAr: e.target.value },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
              </div>
            )}

            {/* 9. FOOTER SETTINGS */}
            {activeArea === 'footer' && (
              <div className="space-y-3" data-testid="live-editor-panel-footer">
                <h3 className="text-sm font-extrabold text-slate-100">
                  إعدادات الفوتر وروابط التحقق والوظائف
                </h3>
                <Field label="النص التعريفي في الفوتر (Tagline)">
                  <textarea
                    rows={2}
                    value={draftConfig.footer?.taglineAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        footer: { ...draftConfig.footer, taglineAr: e.target.value },
                      })
                    }
                    className={textareaClassName}
                  />
                </Field>
                <Field label="نص حقوق الملكية (Copyright)">
                  <input
                    value={draftConfig.footer?.copyrightAr ?? draftConfig.footer?.copyrightTextAr ?? ''}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        footer: {
                          ...draftConfig.footer,
                          copyrightAr: e.target.value,
                          copyrightTextAr: e.target.value,
                        },
                      })
                    }
                    className={inputClassName}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="عنوان رابط التحقق من الشهادات">
                    <input
                      value={draftConfig.footer?.verifyLabelAr ?? 'التحقق من الشهادات والتوصيات'}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          footer: { ...draftConfig.footer, verifyLabelAr: e.target.value },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="عنوان رابط الوظائف بالفوتر">
                    <input
                      value={draftConfig.footer?.careersLabelAr ?? 'الوظائف والانضمام إلينا'}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          footer: { ...draftConfig.footer, careersLabelAr: e.target.value },
                        })
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* 10. VERSION HISTORY & ROLLBACK */}
            {activeArea === 'history' && (
              <div className="space-y-3" data-testid="live-editor-panel-history">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-extrabold text-slate-100">
                    سجل الإصدارات المنشورة والرجوع لإصدار سابق (Rollback)
                  </h3>
                </div>
                <div className="space-y-2.5 max-h-80 overflow-y-auto">
                  {historyList.map((rev) => (
                    <div
                      key={rev.id}
                      data-testid={`live-editor-history-item-${rev.versionNumber}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge tone="purple">v{formatNumber(rev.versionNumber)}</Badge>
                          <span className="font-extrabold text-slate-100">
                            {rev.summaryAr || 'إصدار منشور'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          نُشر بواسطة: {rev.publishedBy?.fullName || 'النظام'} •{' '}
                          {rev.publishedAt
                            ? new Date(rev.publishedAt).toLocaleString('ar-EG')
                            : ''}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        data-testid={`live-editor-rollback-btn-${rev.id}`}
                        disabled={rollingBackId === rev.id}
                        onClick={() => void handleRollback(rev.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {rollingBackId === rev.id ? 'جارٍ الاستعادة...' : 'استعادة هذا الإصدار'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Publish Summary Note */}
            <div className="border-t border-slate-800 pt-3">
              <Field label="ملاحظة التعديل / الإصدار (تُحفظ في سجل التدقيق Audit Log)">
                <input
                  data-testid="live-editor-summary-input"
                  value={publishSummary}
                  onChange={(e) => setPublishSummary(e.target.value)}
                  placeholder="مثال: تحديث عنوان الـ Hero وإبراز الباقة السنوية"
                  className={inputClassName}
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* Left/End Column in RTL: Interactive Live Preview Frame */}
        <div className="lg:col-span-7">
          <Card className="p-4 bg-slate-950 border-slate-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Layout className="h-4 w-4 text-indigo-400" />
                <span className="font-extrabold text-slate-200">
                  المعاينة الحية المباشرة (انقر على أي قسم في المعاينة لتعديله فوراً)
                </span>
              </div>
              <Badge tone="info">
                {viewport === 'DESKTOP'
                  ? 'عرض ديسكتوب (100%)'
                  : viewport === 'TABLET'
                  ? 'عرض تابلت (768px)'
                  : 'عرض موبايل (375px)'}
              </Badge>
            </div>

            {/* Interactive Responsive Preview Container */}
            <div
              data-testid="live-editor-preview-pane"
              className={`${previewWidthClass} overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#050A24] text-[#EEF0FF] shadow-2xl transition-all duration-200`}
            >
              {/* Preview Header & Announcement */}
              <div
                onClick={() => setActiveArea('header')}
                className={`cursor-pointer border-b border-[#8CA2FF]/15 transition-colors hover:ring-2 hover:ring-indigo-400 ${
                  activeArea === 'header' ? 'ring-2 ring-indigo-400' : ''
                }`}
              >
                {draftConfig.header?.showAnnouncement &&
                  draftConfig.header?.announcementTextAr && (
                    <div className="bg-[#7C3AED] px-3 py-1.5 text-center text-[11px] font-extrabold text-white">
                      {draftConfig.header.announcementTextAr}
                    </div>
                  )}
                <div className="flex items-center justify-between bg-[#070D2B] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <img
                      src="/images/brand/bosla-logo.webp"
                      alt="BOSLA"
                      className="h-7 w-auto"
                    />
                    <span className="text-xs font-extrabold text-white">
                      أكاديمية بوصلة
                    </span>
                  </div>
                  <span className="rounded-lg bg-[#6B21A8] px-3 py-1 text-xs font-bold text-white">
                    {draftConfig.header?.ctaLabelAr || 'ابدأ التعلم الآن'}
                  </span>
                </div>
              </div>

              {/* Ordered Homepage Sections Preview */}
              {(Array.isArray(draftConfig.sections) && draftConfig.sections.length > 0
                ? draftConfig.sections
                : (Array.isArray(draftConfig.sectionOrder) ? draftConfig.sectionOrder : ['hero', 'storytelling', 'courses', 'trainers', 'pricing', 'partners', 'faq', 'contact']).map((k: string) => ({
                    key: k,
                    visible: draftConfig[k]?.visible !== false,
                  }))
              ).map((sec: any) => {
                if (!sec.visible) return null;

                if (sec.key === 'hero') {
                  return (
                    <div
                      key="hero"
                      onClick={() => setActiveArea('hero')}
                      className={`relative cursor-pointer overflow-hidden border-b border-[#8CA2FF]/15 p-6 sm:p-8 transition-all hover:ring-2 hover:ring-indigo-400 ${
                        activeArea === 'hero' ? 'ring-2 ring-indigo-400' : ''
                      }`}
                    >
                      <img
                        src={
                          draftConfig.hero?.backgroundDesktopUrl ||
                          draftConfig.hero?.heroImage1Url ||
                          '/images/homepage-threshold/hero-scene1-desktop.webp'
                        }
                        alt=""
                        style={{
                          objectPosition: `${draftConfig.hero?.focalX ?? 50}% ${draftConfig.hero?.focalY ?? 42}%`,
                        }}
                        className="absolute inset-0 h-full w-full object-cover opacity-35"
                      />
                      <div className="relative z-10 max-w-lg space-y-3">
                        <span className="inline-block rounded-full border border-[#C084FC]/40 bg-[#7C3AED]/20 px-3 py-1 text-[11px] font-extrabold text-[#E9D5FF]">
                          {draftConfig.hero?.badgeAr}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                          {draftConfig.hero?.titleAr}
                        </h3>
                        <p className="text-xs text-[#C2CAF2] leading-relaxed">
                          {draftConfig.hero?.subtitleAr}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="rounded-lg bg-[#6B21A8] px-4 py-2 text-xs font-extrabold text-white">
                            {draftConfig.hero?.primaryCtaLabelAr}
                          </span>
                          <span className="rounded-lg border border-[#C084FC]/40 bg-[#070D2B]/80 px-4 py-2 text-xs font-bold text-white">
                            {draftConfig.hero?.secondaryCtaLabelAr}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (sec.key === 'storytelling') {
                  return (
                    <div
                      key="storytelling"
                      onClick={() => setActiveArea('storytelling')}
                      className={`cursor-pointer border-b border-[#8CA2FF]/15 bg-[#060C28] p-5 space-y-2 hover:ring-2 hover:ring-indigo-400 ${
                        activeArea === 'storytelling' ? 'ring-2 ring-indigo-400' : ''
                      }`}
                    >
                      <h4 className="text-sm font-extrabold text-white">
                        {draftConfig.storytelling?.titleAr || 'رحلة التعلّم والتطبيق والتطور المهني'}
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        {(draftConfig.storytelling?.steps ?? []).map((st: any, idx: number) => (
                          <div key={idx} className="rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] p-2">
                            <p className="font-bold text-[#8CA2FF]">{st.stepNumber}</p>
                            <p className="font-semibold text-white truncate">{st.titleAr}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (sec.key === 'trainers') {
                  return (
                    <div
                      key="trainers"
                      onClick={() => setActiveArea('trainers')}
                      className={`cursor-pointer border-b border-[#8CA2FF]/15 bg-[#070D2B] p-5 text-xs space-y-1 hover:ring-2 hover:ring-indigo-400 ${
                        activeArea === 'trainers' ? 'ring-2 ring-indigo-400' : ''
                      }`}
                    >
                      <h4 className="text-sm font-extrabold text-white">
                        {draftConfig.trainers?.titleAr || 'نخبة المدربين وخبراء الميدان'}
                      </h4>
                      <p className="text-[#A9B1E0]">
                        شريط أفقي متواصل (Marquee) • سرعة {draftConfig.trainers?.autoSpeedSeconds ?? 32} ثانية
                      </p>
                    </div>
                  );
                }

                if (sec.key === 'partners') {
                  return (
                    <div
                      key="partners"
                      onClick={() => setActiveArea('partners')}
                      className={`cursor-pointer border-b border-[#8CA2FF]/15 bg-[#050A24] p-5 text-xs flex items-center justify-between gap-2 hover:ring-2 hover:ring-indigo-400 ${
                        activeArea === 'partners' ? 'ring-2 ring-indigo-400' : ''
                      }`}
                    >
                      <div>
                        <h4 className="text-sm font-extrabold text-white">
                          {(!Array.isArray(draftConfig.partners) && draftConfig.partners?.titleAr) || 'شركاؤنا'}
                        </h4>
                      </div>
                      <span className="rounded-lg border border-[#C084FC]/40 px-2.5 py-1 text-[11px] font-bold text-[#E9D5FF]">
                        {(!Array.isArray(draftConfig.partners) && draftConfig.partners?.ctaLabelAr) || 'انضم كشريك نجاح'}
                      </span>
                    </div>
                  );
                }

                if (sec.key === 'courses') {
                  const chosenIds: string[] = draftConfig.featuredCourseIds ?? [];
                  const previewCourses =
                    chosenIds.length > 0
                      ? availableCourses.filter((c) => chosenIds.includes(c.id))
                      : availableCourses.slice(0, 3);
                  return (
                    <div
                      key="courses"
                      onClick={() => setActiveArea('courses')}
                      className={`cursor-pointer border-b border-[#8CA2FF]/15 bg-[#081032] p-5 space-y-3 hover:ring-2 hover:ring-indigo-400 ${
                        activeArea === 'courses' ? 'ring-2 ring-indigo-400' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-extrabold text-white">
                          الكورسات والبرامج المعتمدة ({formatNumber(previewCourses.length)})
                        </h4>
                        <Badge tone="info">انقر لتخصيص الكورسات</Badge>
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {previewCourses.slice(0, 4).map((c) => (
                          <div
                            key={c.id}
                            className="rounded-xl border border-[#8CA2FF]/20 bg-[#0B1440] p-3 text-xs space-y-1"
                          >
                            <p className="font-extrabold text-white truncate">{c.titleAr}</p>
                            <p className="text-[11px] text-[#8CA2FF]">
                              {c.isFree ? 'مجاني' : formatEgp(c.priceCents)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (sec.key === 'pricing') {
                  const selectedIds: string[] =
                    draftConfig.pricing?.selectedPlanIds ?? [];
                  const activePlans = availablePlans.filter(
                    (p) =>
                      p.isActive &&
                      p.isVisible &&
                      (selectedIds.length === 0 || selectedIds.includes(p.id)),
                  );
                  return (
                    <div
                      key="pricing"
                      onClick={() => setActiveArea('pricing')}
                      className={`cursor-pointer border-b border-[#8CA2FF]/15 bg-[#060B23] p-5 space-y-3 hover:ring-2 hover:ring-indigo-400 ${
                        activeArea === 'pricing' ? 'ring-2 ring-indigo-400' : ''
                      }`}
                    >
                      <div className="text-center space-y-1">
                        <h4 className="text-base font-extrabold text-white">
                          {draftConfig.pricing?.titleAr || 'الباقات والأسعار'}
                        </h4>
                        <p className="text-xs text-[#A9B1E0]">
                          {draftConfig.pricing?.subtitleAr}
                        </p>
                      </div>
                      {activePlans.length === 0 ? (
                        <p className="text-center text-xs text-amber-300">
                          (قسم الأسعار مخفي للزوار لعدم وجود باقات منشورة)
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {activePlans.map((pl) => {
                            const isFeat =
                              draftConfig.pricing?.featuredPlanId
                                ? draftConfig.pricing.featuredPlanId === pl.id
                                : pl.interval === 'ANNUAL';
                            return (
                              <div
                                key={pl.id}
                                className={`rounded-2xl p-4 text-xs space-y-2 ${
                                  isFeat
                                    ? 'border-2 border-[#C084FC] bg-[#181654]'
                                    : 'border border-[#8CA2FF]/20 bg-[#0B1440]'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-white">
                                    {pl.nameAr}
                                  </span>
                                  {isFeat && (
                                    <span className="rounded-full bg-[#7C3AED] px-2 py-0.5 text-[10px] font-extrabold text-white">
                                      {draftConfig.pricing?.featuredBadgeAr ||
                                        'الأكثر اختياراً'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-lg font-extrabold text-white tabular-nums">
                                  {formatEgp(pl.priceCents)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                if (sec.key === 'faqs') {
                  return (
                    <div
                      key="faqs"
                      onClick={() => setActiveArea('faqs')}
                      className={`cursor-pointer border-b border-[#8CA2FF]/15 bg-[#070E2C] p-5 space-y-2 hover:ring-2 hover:ring-indigo-400 ${
                        activeArea === 'faqs' ? 'ring-2 ring-indigo-400' : ''
                      }`}
                    >
                      <h4 className="text-sm font-extrabold text-white">
                        الأسئلة الشائعة ({formatNumber((draftConfig.faqs ?? []).length)})
                      </h4>
                      {(draftConfig.faqs ?? []).slice(0, 2).map((f: any, i: number) => (
                        <div
                          key={f.id || i}
                          className="rounded-xl border border-[#8CA2FF]/15 bg-[#0B1440] p-2.5 text-xs"
                        >
                          <p className="font-bold text-white">{f.questionAr}</p>
                          <p className="text-[11px] text-[#A9B1E0] truncate">{f.answerAr}</p>
                        </div>
                      ))}
                    </div>
                  );
                }

                if (sec.key === 'contact') {
                  return (
                    <div
                      key="contact"
                      onClick={() => setActiveArea('contact')}
                      className={`cursor-pointer border-b border-[#8CA2FF]/15 bg-[#070D2B] p-5 text-xs space-y-1 hover:ring-2 hover:ring-indigo-400 ${
                        activeArea === 'contact' ? 'ring-2 ring-indigo-400' : ''
                      }`}
                    >
                      <h4 className="text-sm font-extrabold text-white">
                        التواصل المباشر
                      </h4>
                      <p className="text-[#A9B1E0]">
                        {draftConfig.contact?.email} • {draftConfig.contact?.phone} •{' '}
                        {draftConfig.contact?.addressAr}
                      </p>
                    </div>
                  );
                }

                return null;
              })}

              {/* Preview Footer */}
              <div
                onClick={() => setActiveArea('footer')}
                className={`cursor-pointer bg-[#04081C] px-5 py-4 text-center text-[11px] text-[#A9B1E0] space-y-1 hover:ring-2 hover:ring-indigo-400 ${
                  activeArea === 'footer' ? 'ring-2 ring-indigo-400' : ''
                }`}
              >
                <p className="font-semibold text-white">
                  {draftConfig.footer?.taglineAr}
                </p>
                <p>{draftConfig.footer?.copyrightTextAr}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
