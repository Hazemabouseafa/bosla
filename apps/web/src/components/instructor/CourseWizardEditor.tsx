'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileDown,
  FileVideo,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  PlayCircle,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { evaluateCourseWizardCompleteness, slugifyTitle } from '@bosla/shared';
import {
  apiFetch,
  API_BASE_URL,
  difficultyLabelAr,
  ensureCsrfToken,
  formatEgp,
  formatNumber,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  VideoChunkUploader,
  type UploadedVideoReadyMeta,
} from '@/components/instructor/VideoChunkUploader';
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

export type WizardStepNumber = 1 | 2 | 3 | 4;
type AutoSaveState = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';

export interface CourseWizardEditorProps {
  mode: 'admin' | 'instructor';
  initialCourseId?: string | null;
  categories?: any[];
  instructors?: any[];
  onCourseCreated?: (courseId: string) => void;
  onCoursePublishedOrSubmitted?: (course: any) => void;
  onClose?: () => void;
}

export function CourseWizardEditor({
  mode,
  initialCourseId = null,
  categories: propCategories,
  instructors: propInstructors,
  onCourseCreated,
  onCoursePublishedOrSubmitted,
  onClose,
}: CourseWizardEditorProps) {
  const { user, pushToast } = useAuth();

  const [courseId, setCourseId] = useState<string | null>(initialCourseId);
  const [course, setCourse] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>(propCategories ?? []);
  const [instructors, setInstructors] = useState<any[]>(propInstructors ?? []);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(initialCourseId));

  // 4-step wizard state
  const [step, setStep] = useState<WizardStepNumber>(() => {
    if (typeof window !== 'undefined') {
      const s = Number(new URLSearchParams(window.location.search).get('step'));
      if (s === 1 || s === 2 || s === 3 || s === 4) return s;
    }
    return 1;
  });
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>('IDLE');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Step 1: Course Info
  const [titleAr, setTitleAr] = useState('');
  const [subtitleAr, setSubtitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>(
    'BEGINNER',
  );
  const [slug, setSlug] = useState('');
  const [objectivesText, setObjectivesText] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [certificateMode, setCertificateMode] = useState<
    'AUTOMATIC_ON_COMPLETION' | 'COMPETENCY_REQUEST_REQUIRED'
  >('AUTOMATIC_ON_COMPLETION');

  // Step 2: Course Presentation (Cover, Card Thumbnail, Intro Video, Poster)
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [introVideoAssetId, setIntroVideoAssetId] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [showIntroUploader, setShowIntroUploader] = useState(false);

  // Step 3: Curriculum & Lessons
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [activeSectionIdForLesson, setActiveSectionIdForLesson] = useState<string>('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonType, setNewLessonType] = useState<'VIDEO' | 'ARTICLE'>('VIDEO');
  const [newLessonDurationMin, setNewLessonDurationMin] = useState(10);
  const [newLessonVideoId, setNewLessonVideoId] = useState('');
  const [newLessonFreePreview, setNewLessonFreePreview] = useState(false);
  const [showBatchUploader, setShowBatchUploader] = useState(false);
  const [draggedLesson, setDraggedLesson] = useState<{
    sectionId: string;
    lessonId: string;
  } | null>(null);
  const [attachmentDrawerLesson, setAttachmentDrawerLesson] = useState<any | null>(null);
  const [attTitle, setAttTitle] = useState('');
  const [attFile, setAttFile] = useState<File | null>(null);
  const [attBusy, setAttBusy] = useState(false);

  // Step 4: Pricing, Availability & Preview
  const [isFree, setIsFree] = useState(false);
  const [priceEgp, setPriceEgp] = useState('450');
  const [compareAtPriceEgp, setCompareAtPriceEgp] = useState('');
  const [includedInMembership, setIncludedInMembership] = useState(true);
  const [allowIndividualPurchase, setAllowIndividualPurchase] = useState(true);
  const [previewRole, setPreviewRole] = useState<'VISITOR' | 'STUDENT'>('VISITOR');

  // Action busy locks (prevent double submit)
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [publishingBusy, setPublishingBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const hydratedCourseIdRef = useRef<string | null>(null);
  const dirtyRef = useRef<boolean>(false);

  const storageBackupKey = useMemo(
    () => `bosla_course_wizard_backup_${courseId || 'new'}`,
    [courseId],
  );

  const hydrateFromCourse = useCallback((c: any) => {
    setCourse(c);
    const ver = c.draftVersion ?? c.publishedVersion;
    if (hydratedCourseIdRef.current !== c.id) {
      hydratedCourseIdRef.current = c.id;
      setTitleAr(ver?.titleAr ?? '');
      setSubtitleAr(ver?.subtitleAr ?? '');
      setDescriptionAr(ver?.descriptionAr ?? '');
      setCategoryId(c.categoryId ?? '');
      setInstructorId(c.instructorId ?? '');
      setDifficulty(c.difficulty ?? 'BEGINNER');
      setSlug(c.slug ?? '');
      setThumbnailUrl(ver?.thumbnailUrl ?? '');
      setPosterUrl(ver?.posterUrl ?? '');
      setIntroVideoAssetId(ver?.introVideoAssetId ?? '');
      setObjectivesText(
        Array.isArray(ver?.learningObjectives) ? ver.learningObjectives.join('\n') : '',
      );
      setRequirementsText(
        Array.isArray(ver?.requirements) ? ver.requirements.join('\n') : '',
      );
      setCertificateMode(c.certificateMode ?? 'AUTOMATIC_ON_COMPLETION');
      setIsFree(Boolean(c.isFree));
      setPriceEgp(String(Math.round(Number(c.priceCents ?? 0) / 100)));
      setCompareAtPriceEgp(
        c.compareAtPriceCents ? String(Math.round(Number(c.compareAtPriceCents) / 100)) : '',
      );
      setIncludedInMembership(c.includedInMembership !== false);
      setAllowIndividualPurchase(c.allowIndividualPurchase !== false);
    }
    const firstSecId = ver?.sections?.[0]?.id;
    if (firstSecId) {
      setActiveSectionIdForLesson((prev) => prev || firstSecId);
    }
  }, []);

  const loadWizardData = useCallback(
    async (targetId?: string | null) => {
      const idToLoad = targetId !== undefined ? targetId : courseId;
      try {
        const promises: Promise<any>[] = [
          apiFetch<any>('/instructor/videos').catch(() => ({ items: [] })),
        ];
        if (categories.length === 0) {
          promises.push(apiFetch<any[]>('/catalog/categories').catch(() => []));
        } else {
          promises.push(Promise.resolve(categories));
        }
        if (mode === 'admin' && instructors.length === 0) {
          promises.push(apiFetch<any[]>('/admin/instructors').catch(() => []));
        } else {
          promises.push(Promise.resolve(instructors));
        }
        if (idToLoad) {
          promises.push(apiFetch<any>(`/instructor/courses/${idToLoad}`));
        }

        const [vRes, catsRes, instRes, courseRes] = await Promise.all(promises);
        setVideos(Array.isArray(vRes) ? vRes : vRes?.items ?? []);
        if (Array.isArray(catsRes) && catsRes.length > 0) {
          setCategories(catsRes);
          setCategoryId((prev) => prev || catsRes[0]?.id || '');
        }
        if (Array.isArray(instRes) && instRes.length > 0) {
          setInstructors(instRes);
          setInstructorId((prev) => prev || instRes[0]?.id || '');
        }
        if (courseRes) {
          hydrateFromCourse(courseRes);
        }
      } catch (err: any) {
        pushToast(err?.message || 'تعذر تحميل بيانات معالج الكورس', 'error');
      } finally {
        setLoading(false);
      }
    },
    [categories, courseId, hydrateFromCourse, instructors, mode, pushToast],
  );

  useEffect(() => {
    void loadWizardData(initialCourseId);
  }, [initialCourseId, loadWizardData]);

  // Build payload for saving draft metadata
  const buildMetadataPayload = useCallback(() => {
    const parsedPriceCents = isFree
      ? 0
      : Math.max(0, Math.round(Number(priceEgp || 0) * 100));
    const parsedCompareCents =
      !isFree && compareAtPriceEgp.trim()
        ? Math.max(0, Math.round(Number(compareAtPriceEgp) * 100))
        : null;

    const generatedSlug =
      slug.trim() ||
      `${slugifyTitle(titleAr.trim() || 'course', 'course')}-${Date.now()
        .toString(36)
        .slice(-4)}`;

    return {
      categoryId: categoryId || categories[0]?.id,
      ...(mode === 'admin' && instructorId ? { instructorId } : {}),
      slug: courseId ? (slug.trim() || undefined) : generatedSlug,
      titleAr: titleAr.trim(),
      subtitleAr: subtitleAr.trim() || undefined,
      descriptionAr: descriptionAr.trim(),
      difficulty,
      isFree,
      priceCents: parsedPriceCents,
      compareAtPriceCents: parsedCompareCents,
      includedInMembership: isFree ? true : includedInMembership,
      allowIndividualPurchase: isFree ? false : allowIndividualPurchase,
      certificateMode,
      thumbnailUrl: thumbnailUrl.trim() || null,
      posterUrl: posterUrl.trim() || null,
      introVideoAssetId: introVideoAssetId || null,
      learningObjectives: objectivesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      requirements: requirementsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }, [
    allowIndividualPurchase,
    categories,
    categoryId,
    certificateMode,
    compareAtPriceEgp,
    descriptionAr,
    difficulty,
    includedInMembership,
    instructorId,
    introVideoAssetId,
    isFree,
    mode,
    objectivesText,
    posterUrl,
    priceEgp,
    requirementsText,
    slug,
    subtitleAr,
    thumbnailUrl,
    titleAr,
  ]);

  const performServerSave = useCallback(
    async (opts?: { silent?: boolean }): Promise<string | null> => {
      const payload = buildMetadataPayload();

      // Backup to localStorage before network call
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageBackupKey, JSON.stringify(payload));
        } catch {
          // ignore storage quota
        }
      }

      if (!courseId) {
        // Need minimum fields to create initial draft on server
        const nextErrors: Record<string, string> = {};
        if (payload.titleAr.length < 3) {
          nextErrors.titleAr = 'يرجى إدخال عنوان الكورس (3 أحرف على الأقل).';
        }
        if (payload.descriptionAr.length < 20) {
          nextErrors.descriptionAr = 'يرجى إدخال وصف واضح للكورس (20 حرفاً على الأقل).';
        }
        if (!payload.categoryId) {
          nextErrors.categoryId = 'يرجى اختيار تصنيف الكورس.';
        }
        if (mode === 'admin' && !instructorId && instructors.length > 0) {
          nextErrors.instructorId = 'يرجى اختيار المدرب المسؤول عن الكورس.';
        }
        if (Object.keys(nextErrors).length > 0) {
          setFieldErrors(nextErrors);
          return null;
        }
        setFieldErrors({});
        setCreatingDraft(true);
        setAutoSaveState('SAVING');
        try {
          const endpoint =
            mode === 'admin' ? '/admin/courses' : '/instructor/courses';
          const created = await apiFetch<any>(endpoint, {
            method: 'POST',
            body: JSON.stringify({
              ...payload,
              instructorId:
                mode === 'admin'
                  ? instructorId || instructors[0]?.id
                  : user?.id,
            }),
          });
          const newId = created.id;
          setCourseId(newId);
          hydratedCourseIdRef.current = newId;
          setCourse(created);
          dirtyRef.current = false;
          setAutoSaveState('SAVED');
          setLastSavedAt(new Date().toLocaleTimeString('ar-EG'));
          onCourseCreated?.(newId);
          if (!opts?.silent) {
            pushToast('تم إنشاء مسودة الكورس وحفظها تلقائياً', 'success');
          }
          await loadWizardData(newId);
          return newId;
        } catch (err: any) {
          setAutoSaveState('ERROR');
          if (!opts?.silent) {
            pushToast(err?.message || 'تعذر حفظ مسودة الكورس', 'error');
          }
          return null;
        } finally {
          setCreatingDraft(false);
        }
      }

      // Existing course draft -> update metadata
      if (
        payload.titleAr.length < 3 ||
        payload.descriptionAr.length < 20 ||
        course?.draftVersion?.status === 'SUBMITTED_FOR_REVIEW'
      ) {
        return courseId;
      }

      setAutoSaveState('SAVING');
      try {
        const updated = await apiFetch<any>(`/instructor/courses/${courseId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setCourse(updated);
        dirtyRef.current = false;
        setAutoSaveState('SAVED');
        setLastSavedAt(new Date().toLocaleTimeString('ar-EG'));
        if (!opts?.silent) {
          pushToast('تم حفظ التعديلات في المسودة', 'success');
        }
        return courseId;
      } catch (err: any) {
        setAutoSaveState('ERROR');
        if (!opts?.silent) {
          pushToast(err?.message || 'تعذر حفظ المسودة — أعد المحاولة', 'error');
        }
        return null;
      }
    },
    [
      buildMetadataPayload,
      courseId,
      instructorId,
      instructors,
      loadWizardData,
      mode,
      onCourseCreated,
      pushToast,
      storageBackupKey,
      user?.id,
    ],
  );

  // Debounced auto-save when editing an existing course
  useEffect(() => {
    if (!courseId || !dirtyRef.current) return;
    const timer = window.setTimeout(() => {
      void performServerSave({ silent: true });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [
    courseId,
    titleAr,
    subtitleAr,
    descriptionAr,
    categoryId,
    difficulty,
    thumbnailUrl,
    posterUrl,
    introVideoAssetId,
    isFree,
    priceEgp,
    compareAtPriceEgp,
    includedInMembership,
    allowIndividualPurchase,
    certificateMode,
    objectivesText,
    requirementsText,
    performServerSave,
  ]);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const handleUploadCoverFile = async (file: File | null) => {
    if (!file) return;
    setCoverUploading(true);
    try {
      const csrf = await ensureCsrfToken();
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/instructor/media/covers`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: formData,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error?.message || 'تعذر رفع صورة الغلاف');
      }
      const json = await res.json();
      const url = json?.data?.url ?? json?.url;
      if (url) {
        setThumbnailUrl(url);
        markDirty();
        pushToast('تم رفع صورة غلاف الكورس بنجاح', 'success');
      }
    } catch (err: any) {
      pushToast(err?.message || 'فشل رفع صورة الغلاف', 'error');
    } finally {
      setCoverUploading(false);
    }
  };

  const draft = course?.draftVersion ?? course?.publishedVersion;
  const sections: any[] = useMemo(() => draft?.sections ?? [], [draft?.sections]);
  const allLessons: any[] = useMemo(
    () => sections.flatMap((s: any) => s.lessons ?? []),
    [sections],
  );

  // Ensure a default section exists for simple courses when adding lessons or batch uploading videos
  const ensureActiveSectionId = useCallback(async (): Promise<string | null> => {
    let activeCourseId = courseId;
    if (!activeCourseId) {
      activeCourseId = await performServerSave({ silent: true });
      if (!activeCourseId) return null;
    }

    if (activeSectionIdForLesson && sections.some((s) => s.id === activeSectionIdForLesson)) {
      return activeSectionIdForLesson;
    }
    if (sections[0]?.id) {
      setActiveSectionIdForLesson(sections[0].id);
      return sections[0].id;
    }

    const updated = await apiFetch<any>(`/instructor/courses/${activeCourseId}/sections`, {
      method: 'POST',
      body: JSON.stringify({
        titleAr: 'القسم الأول: المحتوى الأساسي للكورس',
        sortOrder: 0,
      }),
    });
    setCourse(updated);
    const createdSecId =
      updated?.draftVersion?.sections?.[0]?.id ??
      updated?.publishedVersion?.sections?.[0]?.id ??
      null;
    if (createdSecId) {
      setActiveSectionIdForLesson(createdSecId);
    }
    return createdSecId;
  }, [activeSectionIdForLesson, courseId, performServerSave, sections]);

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    let activeCourseId = courseId;
    if (!activeCourseId) {
      activeCourseId = await performServerSave();
      if (!activeCourseId) return;
    }
    try {
      const updated = await apiFetch<any>(`/instructor/courses/${activeCourseId}/sections`, {
        method: 'POST',
        body: JSON.stringify({
          titleAr: newSectionTitle.trim(),
          sortOrder: sections.length,
        }),
      });
      setCourse(updated);
      const newSecs = updated?.draftVersion?.sections ?? [];
      const latestSec = newSecs[newSecs.length - 1];
      if (latestSec?.id) {
        setActiveSectionIdForLesson(latestSec.id);
      }
      setNewSectionTitle('');
      pushToast('تمت إضافة القسم بنجاح', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إضافة القسم', 'error');
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;
    const secId = await ensureActiveSectionId();
    if (!secId || !courseId) return;

    const selectedVideo = videos.find((v) => v.id === newLessonVideoId);
    const durationSec =
      selectedVideo?.durationSeconds && selectedVideo.durationSeconds > 0
        ? selectedVideo.durationSeconds
        : Math.max(60, Number(newLessonDurationMin || 10) * 60);

    try {
      const updated = await apiFetch<any>(
        `/instructor/courses/${courseId}/sections/${secId}/lessons`,
        {
          method: 'POST',
          body: JSON.stringify({
            titleAr: newLessonTitle.trim(),
            type: newLessonType,
            durationSeconds: durationSec,
            isFreePreview: isFree ? true : newLessonFreePreview,
            videoAssetId: newLessonVideoId || null,
          }),
        },
      );
      setCourse(updated);
      setNewLessonTitle('');
      setNewLessonVideoId('');
      setNewLessonFreePreview(false);
      pushToast('تمت إضافة الدرس إلى القسم بنجاح', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إضافة الدرس', 'error');
    }
  };

  // Automatic draft lesson creation when batch video upload finishes processing
  const handleBatchVideoReady = useCallback(
    async (meta: UploadedVideoReadyMeta) => {
      const secId = await ensureActiveSectionId();
      const targetCourseId = courseId || hydratedCourseIdRef.current;
      if (!secId || !targetCourseId) return;

      try {
        const updated = await apiFetch<any>(
          `/instructor/courses/${targetCourseId}/sections/${secId}/lessons`,
          {
            method: 'POST',
            body: JSON.stringify({
              titleAr: meta.titleAr || 'درس فيديو جديد',
              type: 'VIDEO',
              durationSeconds: meta.durationSeconds > 0 ? meta.durationSeconds : 120,
              isFreePreview: isFree ? true : false, // Default locked for paid courses
              videoAssetId: meta.videoAssetId,
            }),
          },
        );
        setCourse(updated);
        const vRes = await apiFetch<any>('/instructor/videos').catch(() => []);
        setVideos(Array.isArray(vRes) ? vRes : vRes?.items ?? []);
        pushToast(
          `تم إنشاء درس "${meta.titleAr}" تلقائياً وربطه بالفيديو الجاهز (${formatNumber(
            meta.durationSeconds,
          )} ثانية)`,
          'success',
        );
      } catch (err: any) {
        pushToast(err?.message || 'تعذر إنشاء الدرس تلقائياً بعد رفع الفيديو', 'error');
      }
    },
    [courseId, ensureActiveSectionId, isFree, pushToast],
  );

  const handleToggleLessonFreePreview = async (lesson: any) => {
    if (!courseId) return;
    const nextVal = !lesson.isFreePreview;
    try {
      const updated = await apiFetch<any>(
        `/instructor/courses/${courseId}/lessons/${lesson.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            titleAr: lesson.titleAr,
            type: lesson.type,
            durationSeconds: lesson.durationSeconds ?? 0,
            isFreePreview: nextVal,
            videoAssetId: lesson.videoAssetId ?? null,
          }),
        },
      );
      setCourse(updated);
      pushToast(
        nextVal
          ? `تم فتح الدرس "${lesson.titleAr}" كمعاينة مجانية للجميع`
          : `تم قفل الدرس "${lesson.titleAr}" للمشتركين فقط`,
        'info',
      );
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث حالة المعاينة المجانية', 'error');
    }
  };

  const handleBulkPreviewMode = async (
    bulkMode: 'LOCK_ALL' | 'UNLOCK_ALL' | 'UNLOCK_FIRST_LESSON',
  ) => {
    if (!courseId || bulkBusy) return;
    setBulkBusy(true);
    try {
      const updated = await apiFetch<any>(
        `/instructor/courses/${courseId}/lessons/bulk-preview`,
        {
          method: 'PATCH',
          body: JSON.stringify({ mode: bulkMode }),
        },
      );
      setCourse(updated);
      const msg =
        bulkMode === 'LOCK_ALL'
          ? 'تم قفل جميع الدروس للمشتركين فقط'
          : bulkMode === 'UNLOCK_FIRST_LESSON'
          ? 'تم فتح أول درس فقط كمعاينة مجانية وقفل باقي الدروس'
          : 'تم فتح جميع الدروس كمعاينة مجانية';
      pushToast(msg, 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تطبيق التعديل الجماعي لإتاحة الدروس', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleMoveLesson = async (
    section: any,
    lessonIndex: number,
    direction: 'UP' | 'DOWN',
  ) => {
    if (!courseId) return;
    const lessonsList = [...(section.lessons ?? [])];
    const targetIndex = direction === 'UP' ? lessonIndex - 1 : lessonIndex + 1;
    if (targetIndex < 0 || targetIndex >= lessonsList.length) return;

    const [moved] = lessonsList.splice(lessonIndex, 1);
    lessonsList.splice(targetIndex, 0, moved);

    try {
      const updated = await apiFetch<any>(
        `/instructor/courses/${courseId}/sections/${section.id}/lessons/reorder`,
        {
          method: 'PUT',
          body: JSON.stringify({ lessonIds: lessonsList.map((l: any) => l.id) }),
        },
      );
      setCourse(updated);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إعادة ترتيب الدروس', 'error');
    }
  };

  const handleDropLesson = async (section: any, targetLessonId: string) => {
    if (!courseId || !draggedLesson || draggedLesson.sectionId !== section.id) {
      setDraggedLesson(null);
      return;
    }
    const lessonsList = [...(section.lessons ?? [])];
    const fromIdx = lessonsList.findIndex((l: any) => l.id === draggedLesson.lessonId);
    const toIdx = lessonsList.findIndex((l: any) => l.id === targetLessonId);
    setDraggedLesson(null);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const [moved] = lessonsList.splice(fromIdx, 1);
    lessonsList.splice(toIdx, 0, moved);
    try {
      const updated = await apiFetch<any>(
        `/instructor/courses/${courseId}/sections/${section.id}/lessons/reorder`,
        {
          method: 'PUT',
          body: JSON.stringify({ lessonIds: lessonsList.map((l: any) => l.id) }),
        },
      );
      setCourse(updated);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ ترتيب الدروس', 'error');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!courseId) return;
    try {
      const updated = await apiFetch<any>(
        `/instructor/courses/${courseId}/lessons/${lessonId}`,
        { method: 'DELETE' },
      );
      setCourse(updated);
      pushToast('تم حذف الدرس', 'info');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف الدرس', 'error');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!courseId) return;
    try {
      const updated = await apiFetch<any>(
        `/instructor/courses/${courseId}/sections/${sectionId}`,
        { method: 'DELETE' },
      );
      setCourse(updated);
      pushToast('تم حذف القسم', 'info');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف القسم', 'error');
    }
  };

  const handleUploadLessonAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !attachmentDrawerLesson || !attTitle.trim() || !attFile) return;
    setAttBusy(true);
    try {
      const csrf = await ensureCsrfToken();
      const fd = new FormData();
      fd.append('titleAr', attTitle.trim());
      fd.append('file', attFile);
      const res = await fetch(
        `${API_BASE_URL}/instructor/courses/${courseId}/lessons/${attachmentDrawerLesson.id}/attachments/upload`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
          body: fd,
        },
      );
      if (!res.ok) throw new Error('تعذر رفع المرفق');
      setAttTitle('');
      setAttFile(null);
      await loadWizardData(courseId);
      pushToast('تم رفع المرفق وربطه بالدرس', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر رفع المرفق', 'error');
    } finally {
      setAttBusy(false);
    }
  };

  // Completeness & Missing Requirements Checklist (Section 2)
  const completeness = useMemo(() => {
    const parsedPriceEgp = isFree ? 0 : Math.max(0, Number(priceEgp || 0));
    const videosById: Record<string, { id: string; status: string }> = {};
    for (const v of videos) {
      if (v?.id) {
        videosById[v.id] = { id: v.id, status: v.status || 'READY' };
      }
    }
    for (const sec of sections) {
      for (const l of sec.lessons ?? []) {
        if (l.videoAssetId && !videosById[l.videoAssetId]) {
          videosById[l.videoAssetId] = {
            id: l.videoAssetId,
            status: l.videoAsset?.status || 'READY',
          };
        }
      }
    }

    const res = evaluateCourseWizardCompleteness({
      titleAr,
      descriptionAr,
      thumbnailUrl,
      introVideoId: introVideoAssetId || null,
      isFree,
      priceEgp: parsedPriceEgp,
      allowIndividualPurchase,
      includedInMembership,
      sections: sections.map((sec: any) => ({
        titleAr: sec.titleAr,
        lessons: (sec.lessons ?? []).map((l: any) => ({
          titleAr: l.titleAr,
          type: l.type,
          videoAssetId: l.videoAssetId,
          isFreePreview: Boolean(l.isFreePreview),
          attachments: l.attachments ?? [],
        })),
      })),
      videosById,
    });

    const missingItems = res.issues.map((issue, idx) => ({
      code: `${issue.fieldId}_${idx}`,
      step: issue.step as WizardStepNumber,
      fieldKey: issue.fieldId,
      labelAr: issue.labelAr,
    }));
    const completionPercent = Math.max(
      10,
      Math.min(100, Math.round(((5 - Math.min(4, missingItems.length)) / 5) * 100)),
    );

    return {
      readyToPublish: res.readyToPublish && Boolean(categoryId || categories[0]?.id),
      missingItems,
      completionPercent: res.readyToPublish ? 100 : completionPercent,
      stats: res.stats,
    };
  }, [
    allowIndividualPurchase,
    categories,
    categoryId,
    descriptionAr,
    includedInMembership,
    introVideoAssetId,
    isFree,
    priceEgp,
    sections,
    thumbnailUrl,
    titleAr,
    videos,
  ]);

  const handlePublishOrSubmit = async () => {
    if (publishingBusy) return;
    setPublishingBusy(true);
    try {
      const activeId = await performServerSave({ silent: true });
      if (!activeId) {
        setPublishingBusy(false);
        return;
      }

      if (!completeness.readyToPublish) {
        pushToast(
          'يرجى استكمال المتطلبات الناقصة الموضحة في قائمة المراجعة قبل النشر.',
          'error',
        );
        setPublishingBusy(false);
        return;
      }

      if (mode === 'admin') {
        const res = await apiFetch<any>(`/admin/courses/${activeId}/publish`, {
          method: 'POST',
        });
        pushToast('تم اعتماد ونشر الكورس مباشرة في الأكاديمية!', 'success');
        await loadWizardData(activeId);
        onCoursePublishedOrSubmitted?.(res);
      } else {
        const res = await apiFetch<any>(`/instructor/courses/${activeId}/submit`, {
          method: 'POST',
        });
        pushToast('تم إرسال الكورس إلى الإدارة للمراجعة والاعتماد بنجاح', 'success');
        await loadWizardData(activeId);
        onCoursePublishedOrSubmitted?.(res);
      }
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إتمام عملية النشر أو الإرسال', 'error');
    } finally {
      setPublishingBusy(false);
    }
  };

  const handleNextStep = async (targetStep: WizardStepNumber) => {
    if (step === 1 && targetStep > 1) {
      const savedId = await performServerSave({ silent: true });
      if (!savedId) return;
    } else if (courseId && dirtyRef.current) {
      void performServerSave({ silent: true });
    }
    setStep(targetStep);
  };

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-400" />
        <p className="mt-2 text-sm font-semibold text-slate-300">
          جارٍ تحميل معالج إعداد الكورس...
        </p>
      </Card>
    );
  }

  const freeLessonsCount = allLessons.filter((l) => isFree || l.isFreePreview).length;
  const lockedLessonsCount = Math.max(0, allLessons.length - freeLessonsCount);

  const STEPS: Array<{ num: WizardStepNumber; title: string; subtitle: string }> = [
    { num: 1, title: '1. معلومات الكورس', subtitle: 'العنوان والوصف والتصنيف' },
    { num: 2, title: '2. واجهة الكورس', subtitle: 'الغلاف والفيديو التعريفي' },
    { num: 3, title: '3. المحتوى والدروس', subtitle: 'الأقسام والفيديوهات والمعاينة' },
    { num: 4, title: '4. السعر والمراجعة', subtitle: 'التسعير والمعاينة والنشر' },
  ];

  return (
    <div className="space-y-6" data-testid="course-wizard-editor">
      {/* Top Wizard Header Bar with Reliable Auto-Save Status */}
      <Card className="p-4 sm:p-5 border-indigo-500/25">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">
                {mode === 'admin' ? 'معالج الكورسات (المدير)' : 'معالج الكورسات (المدرب)'}
              </Badge>
              {course?.status && (
                <Badge
                  tone={
                    course.status === 'PUBLISHED'
                      ? 'success'
                      : course.status === 'IN_REVIEW' ||
                        course?.draftVersion?.status === 'SUBMITTED_FOR_REVIEW'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {course.status === 'PUBLISHED'
                    ? 'منشور'
                    : course.status === 'IN_REVIEW' ||
                      course?.draftVersion?.status === 'SUBMITTED_FOR_REVIEW'
                    ? 'قيد المراجعة الإدارية'
                    : 'مسودة'}
                </Badge>
              )}
              <span className="text-xs font-semibold text-slate-400 tabular-nums">
                نسبة الاكتمال: {formatNumber(completeness.completionPercent)}%
              </span>
            </div>
            <h2 className="mt-1 text-lg sm:text-xl font-extrabold text-slate-100">
              {titleAr.trim() || 'إنشاء كورس جديد خطوة بخطوة'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Reliable Auto-Save Indicator */}
            <div
              data-testid="wizard-autosave-status"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-bold"
            >
              {autoSaveState === 'SAVING' && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  <span className="text-indigo-300">جارٍ الحفظ...</span>
                </>
              )}
              {autoSaveState === 'SAVED' && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">
                    تم الحفظ {lastSavedAt ? `(${lastSavedAt})` : ''}
                  </span>
                </>
              )}
              {autoSaveState === 'ERROR' && (
                <button
                  type="button"
                  onClick={() => void performServerSave()}
                  className="inline-flex items-center gap-1 text-rose-400 hover:underline"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>تعذر الحفظ — إعادة المحاولة</span>
                </button>
              )}
              {autoSaveState === 'IDLE' && (
                <span className="text-slate-400">حفظ تلقائي للمسودة</span>
              )}
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="wizard-save-draft-btn"
              disabled={creatingDraft || autoSaveState === 'SAVING'}
              onClick={() => void performServerSave()}
            >
              <Save className="h-3.5 w-3.5" />
              حفظ المسودة الآن
            </Button>

            {onClose && (
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                إغلاق
              </Button>
            )}
          </div>
        </div>

        {/* 4-Step Stepper Navigation */}
        <div
          role="tablist"
          aria-label="خطوات إعداد الكورس"
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {STEPS.map((s) => {
            const isActive = step === s.num;
            const hasStepMissing = completeness.missingItems.some(
              (m) => m.step === s.num,
            );
            return (
              <button
                key={s.num}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`wizard-step-tab-${s.num}`}
                onClick={() => void handleNextStep(s.num)}
                className={`flex flex-col items-start rounded-xl border p-3 text-right transition-colors ${
                  isActive
                    ? 'border-indigo-400 bg-indigo-950/80 text-white shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="text-xs font-extrabold">{s.title}</span>
                  {!hasStepMissing && courseId ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : null}
                </div>
                <span className="mt-0.5 text-[11px] text-slate-400">{s.subtitle}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* STEP 1: Course Info */}
      {step === 1 && (
        <Card className="p-6 space-y-5" data-testid="wizard-step-1-panel">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-extrabold text-slate-100">
              الخطوة 1: المعلومات الأساسية للكورس
            </h3>
            <p className="text-xs text-slate-400">
              أدخل العنوان والوصف والتصنيف فقط للبدء. الحقول الإضافية المتقدمة اختيارية ومطوية لتسهيل الإعداد.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="عنوان الكورس بالعربية *"
                error={fieldErrors.titleAr}
                hint="مثال: الأمن الحيوي المتقدم في مزارع الدواجن التجارية"
              >
                <input
                  id="wizard-field-titleAr"
                  data-testid="wizard-input-title"
                  value={titleAr}
                  onChange={(e) => {
                    setTitleAr(e.target.value);
                    markDirty();
                  }}
                  placeholder="أدخل عنواناً واضحاً يصف موضوع الكورس..."
                  className={inputClassName}
                />
              </Field>
            </div>

            <Field label="التصنيف العلمي *" error={fieldErrors.categoryId}>
              <select
                id="wizard-field-categoryId"
                data-testid="wizard-select-category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  markDirty();
                }}
                className={selectClassName}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="المستوى العلمي *">
              <select
                data-testid="wizard-select-difficulty"
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(e.target.value as any);
                  markDirty();
                }}
                className={selectClassName}
              >
                <option value="BEGINNER">مبتدئ</option>
                <option value="INTERMEDIATE">متوسط</option>
                <option value="ADVANCED">متقدم</option>
              </select>
            </Field>

            {mode === 'admin' && instructors.length > 0 && (
              <div className="sm:col-span-2">
                <Field label="المدرب المسؤول عن الكورس *" error={fieldErrors.instructorId}>
                  <select
                    data-testid="wizard-select-instructor"
                    value={instructorId}
                    onChange={(e) => {
                      setInstructorId(e.target.value);
                      markDirty();
                    }}
                    className={selectClassName}
                  >
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.fullName} ({inst.email || inst.headlineAr || 'مدرب'})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="sm:col-span-2">
              <Field
                label="الوصف الكامل للكورس *"
                error={fieldErrors.descriptionAr}
                hint="اشرح بإيجاز ما سيتعلمه الدارس وكيف سيطبقه عملياً (20 حرفاً على الأقل)."
              >
                <textarea
                  id="wizard-field-descriptionAr"
                  data-testid="wizard-input-description"
                  rows={4}
                  value={descriptionAr}
                  onChange={(e) => {
                    setDescriptionAr(e.target.value);
                    markDirty();
                  }}
                  placeholder="يتناول هذا الكورس..."
                  className={textareaClassName}
                />
              </Field>
            </div>
          </div>

          {/* Progressive Disclosure for Advanced Optional Settings */}
          <details className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <summary className="cursor-pointer text-xs font-extrabold text-indigo-300">
              إعدادات متقدمة اختيارية (العنوان الفرعي، الرابط المخصص، مخرجات التعلم، نظام الشهادة)
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="العنوان الفرعي المختصر (اختياري)">
                <input
                  value={subtitleAr}
                  onChange={(e) => {
                    setSubtitleAr(e.target.value);
                    markDirty();
                  }}
                  placeholder="دليل تطبيقي للمهندسين والأطباء البيطريين"
                  className={inputClassName}
                />
              </Field>

              <Field
                label="الرابط المخصص Slug (اختياري — يُولّد تلقائياً عند تركه فارغاً)"
                hint="أحرف إنجليزية صغيرة وأرقام وشرطات فقط (مثال: poultry-biosecurity)"
              >
                <input
                  dir="ltr"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                    markDirty();
                  }}
                  placeholder="auto-generated-slug"
                  className={inputClassName}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="نظام إصدار الشهادة عند إتمام الكورس">
                  <select
                    value={certificateMode}
                    onChange={(e) => {
                      setCertificateMode(e.target.value as any);
                      markDirty();
                    }}
                    className={selectClassName}
                  >
                    <option value="AUTOMATIC_ON_COMPLETION">
                      شهادة إتمام تلقائية فور إنهاء الدروس والاختبارات
                    </option>
                    <option value="COMPETENCY_REQUEST_REQUIRED">
                      شهادة كفاءة مهنية (تتطلب مراجعة واعتماد الإدارة/المدرب)
                    </option>
                  </select>
                </Field>
              </div>

              <Field label="مخرجات التعلم (سطر لكل مهارة يكتسبها الدارس — اختياري)">
                <textarea
                  rows={3}
                  value={objectivesText}
                  onChange={(e) => {
                    setObjectivesText(e.target.value);
                    markDirty();
                  }}
                  placeholder="تصميم خطة تطهير العنابر&#10;إدارة التحصينات الميدانية"
                  className={textareaClassName}
                />
              </Field>

              <Field label="متطلبات سابقة لحضور الكورس (سطر لكل متطلب — اختياري)">
                <textarea
                  rows={3}
                  value={requirementsText}
                  onChange={(e) => {
                    setRequirementsText(e.target.value);
                    markDirty();
                  }}
                  placeholder="أساسيات الإنتاج الحيواني"
                  className={textareaClassName}
                />
              </Field>
            </div>
          </details>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="primary"
              data-testid="wizard-next-to-step-2"
              disabled={creatingDraft}
              onClick={() => void handleNextStep(2)}
            >
              <span>حفظ والمتابعة إلى واجهة الكورس</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: Course Presentation (Cover, Card Thumbnail, Intro Video, Poster) */}
      {step === 2 && (
        <Card className="p-6 space-y-6" data-testid="wizard-step-2-panel">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-extrabold text-slate-100">
              الخطوة 2: واجهة الكورس (صورة الغلاف والفيديو التعريفي)
            </h3>
            <p className="text-xs text-slate-400">
              ارفع صورة غلاف الكورس مع معاينة فورية لبطاقة الكورس، وحدد الفيديو التعريفي للكورس بشكل منفصل عن فيديوهات الدروس.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Cover Image Upload & Controls */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-dashed border-indigo-500/35 bg-slate-900/70 p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <ImageIcon className="h-5 w-5 text-indigo-400" />
                  <h4 className="text-sm font-extrabold text-slate-100">
                    صورة غلاف الكورس وصورة البطاقة *
                  </h4>
                </div>
                <p className="text-xs text-slate-400">
                  اسحب الصورة وأفلتها هنا أو اختر ملف صورة (PNG / JPG / WebP — يفضل نسبة 16:9).
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-900 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-indigo-800">
                    <Upload className="h-3.5 w-3.5" />
                    <span>
                      {coverUploading
                        ? 'جارٍ رفع الصورة...'
                        : thumbnailUrl
                        ? 'استبدال صورة الغلاف'
                        : 'رفع صورة الغلاف من جهازك'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      data-testid="wizard-cover-file-input"
                      disabled={coverUploading}
                      className="hidden"
                      onChange={(e) => void handleUploadCoverFile(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  {thumbnailUrl && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setThumbnailUrl('');
                        markDirty();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف الصورة
                    </Button>
                  )}
                </div>

                <Field label="أو أدخل رابط صورة الغلاف مباشرة">
                  <input
                    id="wizard-field-thumbnailUrl"
                    data-testid="wizard-input-thumbnail-url"
                    dir="ltr"
                    value={thumbnailUrl}
                    onChange={(e) => {
                      setThumbnailUrl(e.target.value);
                      markDirty();
                    }}
                    placeholder="/images/brand/course-biosecurity.webp"
                    className={inputClassName}
                  />
                </Field>
              </div>

              {/* Separate Intro Video & Custom Poster Section */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-100">
                      الفيديو التعريفي للكورس (Intro Video — اختياري ومنفصل عن الدروس)
                    </h4>
                    <p className="text-xs text-slate-400">
                      يظهر في صفحة تعريف الكورس للزوار قبل الاشتراك، ولا يُحتسب ضمن دروس الكورس المقفلة.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowIntroUploader((v) => !v)}
                  >
                    <FileVideo className="h-3.5 w-3.5" />
                    {showIntroUploader ? 'إخفاء رافع الفيديو التعريفي' : 'رفع فيديو تعريفي جديد'}
                  </Button>
                </div>

                {showIntroUploader && (
                  <VideoChunkUploader
                    allowMultiple={false}
                    compact
                    onCompleted={async (vidId) => {
                      const vRes = await apiFetch<any>('/instructor/videos').catch(() => []);
                      setVideos(Array.isArray(vRes) ? vRes : vRes?.items ?? []);
                      if (vidId) {
                        setIntroVideoAssetId(vidId);
                        markDirty();
                      }
                      setShowIntroUploader(false);
                    }}
                  />
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="اختر الفيديو التعريفي من مكتبة الفيديوهات الجاهزة">
                    <select
                      data-testid="wizard-select-intro-video"
                      value={introVideoAssetId}
                      onChange={(e) => {
                        setIntroVideoAssetId(e.target.value);
                        markDirty();
                      }}
                      className={selectClassName}
                    >
                      <option value="">— بدون فيديو تعريفي منفصل —</option>
                      {videos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.titleAr} (
                          {v.status === 'READY'
                            ? 'جاهز للتشغيل'
                            : v.status === 'PROCESSING'
                            ? 'جارٍ التجهيز'
                            : v.status}
                          )
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="صورة شاشة البداية للفيديو التعريفي (Poster URL — اختياري)"
                    hint="تظهر على مشغل الفيديو التعريفي قبل الضغط على تشغيل"
                  >
                    <input
                      dir="ltr"
                      value={posterUrl}
                      onChange={(e) => {
                        setPosterUrl(e.target.value);
                        markDirty();
                      }}
                      placeholder={thumbnailUrl || '/images/brand/course-biosecurity.webp'}
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Live Course Card Preview */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                <span className="text-xs font-extrabold text-indigo-300">
                  معاينة بطاقة الكورس في الموقع
                </span>
                <div className="overflow-hidden rounded-2xl border border-indigo-500/20 bg-[#0B1440]">
                  <div className="aspect-video w-full bg-slate-900 overflow-hidden">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={titleAr || 'معاينة غلاف الكورس'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-xs font-semibold">
                          لم يتم اختيار صورة غلاف بعد
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="info">
                        {categories.find((c) => c.id === categoryId)?.nameAr || 'تصنيف الكورس'}
                      </Badge>
                      <span className="text-xs font-bold text-indigo-300">
                        {difficultyLabelAr(difficulty)}
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-white line-clamp-2">
                      {titleAr || 'عنوان الكورس سيظهر هنا'}
                    </h4>
                    <p className="text-xs text-slate-300 line-clamp-2">
                      {subtitleAr || descriptionAr || 'وصف الكورس المختصر سيظهر هنا للدارسين...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleNextStep(1)}
            >
              <ChevronRight className="h-4 w-4" />
              <span>السابق: معلومات الكورس</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              data-testid="wizard-next-to-step-3"
              onClick={() => void handleNextStep(3)}
            >
              <span>حفظ والمتابعة إلى المحتوى والدروس</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Curriculum, Batch Video Upload & Free Preview Controls */}
      {step === 3 && (
        <div className="space-y-5" data-testid="wizard-step-3-panel">
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">
                  الخطوة 3: المحتوى والدروس وإعدادات المعاينة المجانية
                </h3>
                <p className="text-xs text-slate-400">
                  أضف الأقسام والدروس في نفس الشاشة، أو ارفع عدة فيديوهات دفعة واحدة لإنشاء مسودات الدروس تلقائياً. جميع الدروس مقفلة افتراضياً ما لم تحددها كمعاينة مجانية.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-testid="toggle-batch-video-uploader-btn"
                onClick={() => setShowBatchUploader((v) => !v)}
              >
                <FileVideo className="h-4 w-4" />
                {showBatchUploader
                  ? 'إخفاء رافع الفيديوهات المتعددة'
                  : 'رفع فيديوهات دفعة واحدة لإنشاء دروس تلقائياً'}
              </Button>
            </div>

            {showBatchUploader && (
              <VideoChunkUploader
                allowMultiple
                onBatchItemReady={(meta) => void handleBatchVideoReady(meta)}
              />
            )}

            {/* Quick Inline Forms: Add Section & Add Lesson on the same screen */}
            <div className="grid gap-4 lg:grid-cols-12">
              <form
                onSubmit={handleAddSection}
                className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"
              >
                <h4 className="text-xs font-extrabold text-indigo-300">
                  أ. إضافة قسم / محور جديد (اختياري للكورسات البسيطة)
                </h4>
                <Field label="عنوان القسم بالعربية">
                  <input
                    data-testid="wizard-new-section-title"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="مثال: المحور الأول — أساسيات التشخيص"
                    className={inputClassName}
                  />
                </Field>
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  data-testid="wizard-add-section-btn"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة القسم
                </Button>
              </form>

              <form
                onSubmit={handleAddLesson}
                className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"
              >
                <h4 className="text-xs font-extrabold text-indigo-300">
                  ب. إضافة درس جديد مباشرة (ينشئ قسماً افتراضياً تلقائياً إذا لم تضف قسماً)
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  {sections.length > 0 && (
                    <Field label="القسم">
                      <select
                        value={activeSectionIdForLesson || sections[0]?.id || ''}
                        onChange={(e) => setActiveSectionIdForLesson(e.target.value)}
                        className={selectClassName}
                      >
                        {sections.map((s: any, idx: number) => (
                          <option key={s.id} value={s.id}>
                            {idx + 1}. {s.titleAr}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <div className={sections.length > 0 ? 'sm:col-span-2' : 'sm:col-span-3'}>
                    <Field label="عنوان الدرس بالعربية *">
                      <input
                        data-testid="wizard-new-lesson-title"
                        value={newLessonTitle}
                        onChange={(e) => setNewLessonTitle(e.target.value)}
                        placeholder="مثال: بروتوكول استقبال الكتاكيت في اليوم الأول"
                        className={inputClassName}
                      />
                    </Field>
                  </div>

                  <Field label="نوع الدرس">
                    <select
                      value={newLessonType}
                      onChange={(e) => setNewLessonType(e.target.value as any)}
                      className={selectClassName}
                    >
                      <option value="VIDEO">درس فيديو</option>
                      <option value="ARTICLE">درس نصي / قراءة</option>
                    </select>
                  </Field>

                  <Field label="ربط بفيديو من المكتبة">
                    <select
                      data-testid="wizard-new-lesson-video"
                      value={newLessonVideoId}
                      onChange={(e) => setNewLessonVideoId(e.target.value)}
                      className={selectClassName}
                    >
                      <option value="">— اختر فيديو (أو ارفعه أعلاه) —</option>
                      {videos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.titleAr} ({v.status === 'READY' ? 'جاهز للتشغيل' : 'جارٍ التجهيز'})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="المدة التقديرية (دقائق)">
                    <input
                      type="number"
                      min={1}
                      value={newLessonDurationMin}
                      onChange={(e) => setNewLessonDurationMin(Number(e.target.value))}
                      className={inputClassName}
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      data-testid="wizard-new-lesson-free-preview"
                      checked={isFree ? true : newLessonFreePreview}
                      disabled={isFree}
                      onChange={(e) => setNewLessonFreePreview(e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                    <span>
                      معاينة مجانية — متاحة للجميع (الافتراضي: مقفل للمشتركين فقط)
                    </span>
                  </label>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    data-testid="wizard-add-lesson-btn"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    إضافة الدرس إلى المنهج
                  </Button>
                </div>
              </form>
            </div>

            {/* Bulk Free-Preview Availability Action Bar (Section 3) */}
            {allLessons.length > 0 && (
              <div
                data-testid="bulk-lesson-availability-bar"
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-950/35 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-extrabold text-indigo-200">
                    إتاحة الدروس للزوار:
                  </span>
                  <Badge tone="success">
                    {formatNumber(freeLessonsCount)} معاينة مجانية
                  </Badge>
                  <Badge tone="warning">
                    {formatNumber(lockedLessonsCount)} مقفل للمشتركين
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="bulk-unlock-first-btn"
                    disabled={bulkBusy}
                    onClick={() => void handleBulkPreviewMode('UNLOCK_FIRST_LESSON')}
                  >
                    <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                    فتح أول درس فقط كمعاينة مجانية
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="bulk-lock-all-btn"
                    disabled={bulkBusy}
                    onClick={() => void handleBulkPreviewMode('LOCK_ALL')}
                  >
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                    قفل جميع الدروس
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="bulk-unlock-all-btn"
                    disabled={bulkBusy}
                    onClick={() => void handleBulkPreviewMode('UNLOCK_ALL')}
                  >
                    فتح الكل كمعاينة
                  </Button>
                </div>
              </div>
            )}

            {/* Sections & Lessons Tree */}
            <div className="space-y-4">
              {sections.length === 0 ? (
                <AlertBanner tone="info">
                  لم تتم إضافة دروس بعد. يمكنك رفع عدة فيديوهات دفعة واحدة أعلاه أو إضافة أول درس مباشرة.
                </AlertBanner>
              ) : (
                sections.map((sec: any, sIdx: number) => (
                  <div
                    key={sec.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-indigo-400" />
                        <h4 className="text-sm font-extrabold text-slate-100 tabular-nums">
                          القسم {formatNumber(sIdx + 1)}: {sec.titleAr}
                        </h4>
                        <Badge tone="neutral">
                          {formatNumber((sec.lessons ?? []).length)} دروس
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteSection(sec.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {(sec.lessons ?? []).map((lesson: any, lIdx: number) => {
                        const matchedVid =
                          videos.find((v) => v.id === lesson.videoAssetId) ??
                          lesson.videoAsset;
                        const vidStatus =
                          matchedVid?.status ?? (lesson.videoAssetId ? 'READY' : null);
                        const isLessonFree = isFree || Boolean(lesson.isFreePreview);

                        return (
                          <div
                            key={lesson.id}
                            draggable
                            onDragStart={() =>
                              setDraggedLesson({ sectionId: sec.id, lessonId: lesson.id })
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => void handleDropLesson(sec, lesson.id)}
                            data-testid={`wizard-lesson-row-${lesson.id}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/90 px-3.5 py-2.5 text-xs transition-colors hover:border-slate-700"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {/* Keyboard & Mobile Accessible Up/Down Reorder Controls */}
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  aria-label="تحريك الدرس لأعلى"
                                  disabled={lIdx === 0}
                                  onClick={() => void handleMoveLesson(sec, lIdx, 'UP')}
                                  className="rounded bg-slate-800 p-0.5 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="تحريك الدرس لأسفل"
                                  disabled={lIdx === (sec.lessons ?? []).length - 1}
                                  onClick={() => void handleMoveLesson(sec, lIdx, 'DOWN')}
                                  className="rounded bg-slate-800 p-0.5 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-extrabold text-slate-100 tabular-nums">
                                    {formatNumber(lIdx + 1)}. {lesson.titleAr}
                                  </span>
                                  <Badge tone="info">{lesson.type}</Badge>
                                  {lesson.durationSeconds > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 tabular-nums">
                                      <Clock className="h-3 w-3" />
                                      {formatNumber(
                                        Math.max(1, Math.round(lesson.durationSeconds / 60)),
                                      )}{' '}
                                      دقيقة
                                    </span>
                                  )}
                                  {/* Video Readiness Status Badge */}
                                  {lesson.type === 'VIDEO' && (
                                    <>
                                      {!lesson.videoAssetId ? (
                                        <Badge tone="danger">بدون فيديو مرفوع</Badge>
                                      ) : vidStatus === 'READY' ? (
                                        <Badge tone="success">الفيديو جاهز للتشغيل</Badge>
                                      ) : vidStatus === 'FAILED' ? (
                                        <Badge tone="danger">تعذر تجهيز الفيديو</Badge>
                                      ) : (
                                        <Badge tone="warning">
                                          اكتمل الرفع — جارٍ التجهيز
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Free Preview vs Locked Toggle + Attachments + Delete */}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                data-testid={`lesson-free-preview-toggle-${lesson.id}`}
                                onClick={() => void handleToggleLessonFreePreview(lesson)}
                                disabled={isFree}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition-colors ${
                                  isLessonFree
                                    ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
                                    : 'border-amber-500/35 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'
                                }`}
                              >
                                {isLessonFree ? (
                                  <>
                                    <Unlock className="h-3.5 w-3.5" />
                                    <span>معاينة مجانية — متاحة للجميع</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-3.5 w-3.5" />
                                    <span>مقفل — للمشتركين فقط</span>
                                  </>
                                )}
                              </button>

                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setAttachmentDrawerLesson(lesson)}
                              >
                                <FileDown className="h-3.5 w-3.5" />
                                المرفقات ({formatNumber(lesson.attachments?.length ?? 0)})
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleDeleteLesson(lesson.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Inline Attachment Upload Panel when a lesson is selected */}
            {attachmentDrawerLesson && (
              <div className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-indigo-300">
                    إدارة مرفقات الدرس: {attachmentDrawerLesson.titleAr}
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAttachmentDrawerLesson(null)}
                  >
                    إغلاق
                  </Button>
                </div>
                <form
                  onSubmit={handleUploadLessonAttachment}
                  className="grid gap-3 sm:grid-cols-3 items-end"
                >
                  <Field label="عنوان الملف المرفق">
                    <input
                      value={attTitle}
                      onChange={(e) => setAttTitle(e.target.value)}
                      placeholder="مثال: جدول التحصينات PDF"
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="اختر الملف">
                    <input
                      type="file"
                      onChange={(e) => setAttFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-xs text-slate-300"
                    />
                  </Field>
                  <Button type="submit" variant="primary" size="sm" disabled={attBusy}>
                    {attBusy ? 'جارٍ الرفع...' : 'رفع المرفق'}
                  </Button>
                </form>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleNextStep(2)}
              >
                <ChevronRight className="h-4 w-4" />
                <span>السابق: واجهة الكورس</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                data-testid="wizard-next-to-step-4"
                onClick={() => void handleNextStep(4)}
              >
                <span>حفظ والمتابعة إلى السعر والمراجعة</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 4: Pricing, Visitor/Student Preview, Missing Checklist & Publish/Submit */}
      {step === 4 && (
        <div className="space-y-6" data-testid="wizard-step-4-panel">
          <Card className="p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-100">
                الخطوة 4: السعر والإتاحة والمراجعة النهائية قبل النشر
              </h3>
              <p className="text-xs text-slate-400">
                حدد سياسة تسعير الكورس، وعاين تجربة الكورس كزائر أو كطالب مشترك، وتأكد من اكتمال المتطلبات قبل النشر.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Pricing & Access Configuration */}
              <div className="lg:col-span-6 space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-100">
                    إعدادات السعر والاشتراك
                  </h4>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      data-testid="pricing-mode-paid"
                      onClick={() => {
                        setIsFree(false);
                        markDirty();
                      }}
                      className={`rounded-xl border p-3 text-right transition-colors ${
                        !isFree
                          ? 'border-indigo-400 bg-indigo-950/80 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <p className="text-xs font-extrabold">كورس مدفوع</p>
                      <p className="text-[11px] text-slate-400">
                        متاح عبر العضوية أو الشراء المنفرد
                      </p>
                    </button>

                    <button
                      type="button"
                      data-testid="pricing-mode-free"
                      onClick={() => {
                        setIsFree(true);
                        markDirty();
                      }}
                      className={`rounded-xl border p-3 text-right transition-colors ${
                        isFree
                          ? 'border-emerald-400 bg-emerald-950/70 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <p className="text-xs font-extrabold">كورس مجاني بالكامل</p>
                      <p className="text-[11px] text-slate-400">
                        جميع دروسه مفتوحة مجاناً
                      </p>
                    </button>
                  </div>

                  {!isFree && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="سعر الشراء المنفرد (بالجنيه المصري EGP) *">
                        <input
                          id="wizard-field-priceCents"
                          data-testid="wizard-input-price-egp"
                          type="number"
                          min={1}
                          value={priceEgp}
                          onChange={(e) => {
                            setPriceEgp(e.target.value);
                            markDirty();
                          }}
                          className={inputClassName}
                        />
                      </Field>

                      <Field label="السعر قبل الخصم (اختياري EGP)">
                        <input
                          type="number"
                          min={0}
                          value={compareAtPriceEgp}
                          onChange={(e) => {
                            setCompareAtPriceEgp(e.target.value);
                            markDirty();
                          }}
                          placeholder="650"
                          className={inputClassName}
                        />
                      </Field>

                      <div className="sm:col-span-2 space-y-2 pt-1">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
                          <input
                            type="checkbox"
                            checked={includedInMembership}
                            onChange={(e) => {
                              setIncludedInMembership(e.target.checked);
                              markDirty();
                            }}
                            className="h-4 w-4 rounded accent-indigo-600"
                          />
                          <span>مشمول ضمن باقات العضوية الشهرية والسنوية</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
                          <input
                            type="checkbox"
                            checked={allowIndividualPurchase}
                            onChange={(e) => {
                              setAllowIndividualPurchase(e.target.checked);
                              markDirty();
                            }}
                            className="h-4 w-4 rounded accent-indigo-600"
                          />
                          <span>السماح بشراء هذا الكورس منفرداً بدون عضوية</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Missing Requirements Checklist with Jump Links (Section 2) */}
                <div
                  data-testid="wizard-missing-checklist"
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-slate-100">
                      قائمة التحقق من اكتمال الكورس قبل النشر
                    </h4>
                    <Badge tone={completeness.readyToPublish ? 'success' : 'warning'}>
                      {completeness.readyToPublish
                        ? 'جاهز للنشر 100%'
                        : `متبقي ${formatNumber(completeness.missingItems.length)} متطلبات`}
                    </Badge>
                  </div>

                  {completeness.readyToPublish ? (
                    <AlertBanner tone="success" title="جميع متطلبات النشر مكتملة!">
                      الكورس يحتوي على العنوان، الوصف، التصنيف، صورة الغلاف، الدروس، وفيديوهات جاهزة للتشغيل.
                    </AlertBanner>
                  ) : (
                    <ul className="space-y-2">
                      {completeness.missingItems.map((item) => (
                        <li
                          key={item.code}
                          data-testid={`missing-item-${item.code}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 text-amber-200 font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span>{item.labelAr}</span>
                          </div>
                          <button
                            type="button"
                            data-testid={`jump-to-missing-${item.code}`}
                            onClick={() => {
                              setStep(item.step);
                              window.setTimeout(() => {
                                const el = document.getElementById(
                                  `wizard-field-${item.fieldKey}`,
                                );
                                el?.focus();
                              }, 80);
                            }}
                            className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-extrabold text-amber-200 hover:bg-amber-500/30"
                          >
                            الانتقال للخطوة {formatNumber(item.step)} ←
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Interactive Visitor vs. Student Preview (Section 2 & Section 3) */}
              <div
                data-testid="course-visitor-student-preview"
                className="lg:col-span-6 rounded-2xl border border-indigo-500/25 bg-slate-950/90 p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-100">
                      معاينة الكورس قبل النشر
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      تحقق من الفرق بين ما يراه الزائر غير المشترك وما يراه الطالب المشترك.
                    </p>
                  </div>

                  <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
                    <button
                      type="button"
                      data-testid="preview-as-visitor-btn"
                      onClick={() => setPreviewRole('VISITOR')}
                      className={`rounded-lg px-3 py-1 text-xs font-extrabold transition-colors ${
                        previewRole === 'VISITOR'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      معاينة كزائر
                    </button>
                    <button
                      type="button"
                      data-testid="preview-as-student-btn"
                      onClick={() => setPreviewRole('STUDENT')}
                      className={`rounded-lg px-3 py-1 text-xs font-extrabold transition-colors ${
                        previewRole === 'STUDENT'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      معاينة كطالب مشترك
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">
                      {previewRole === 'VISITOR'
                        ? 'منظور الزائر (قبل الشراء أو الاشتراك):'
                        : 'منظور الطالب المشترك (بعد التفعيل):'}
                    </span>
                    <span className="font-extrabold text-indigo-300">
                      {isFree
                        ? 'مجاني بالكامل'
                        : formatEgp(Math.round(Number(priceEgp || 0) * 100))}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950">
                    {allLessons.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-400">
                        أضف دروساً في الخطوة 3 لمعاينتها هنا.
                      </p>
                    ) : (
                      allLessons.map((lesson: any, idx: number) => {
                        const accessible =
                          previewRole === 'STUDENT' ||
                          isFree ||
                          Boolean(lesson.isFreePreview);
                        return (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {accessible ? (
                                <PlayCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                              )}
                              <span className="font-semibold text-slate-200 truncate">
                                {formatNumber(idx + 1)}. {lesson.titleAr}
                              </span>
                            </div>
                            <Badge tone={accessible ? 'success' : 'warning'}>
                              {accessible
                                ? previewRole === 'VISITOR'
                                  ? 'معاينة مجانية متاحة'
                                  : 'متاح للمشاهدة'
                                : 'مقفل — يتطلب اشتراك'}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {course?.slug && course?.status === 'PUBLISHED' && (
                    <div className="flex justify-end pt-1">
                      <Link
                        href={`/courses/${course.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-300 hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        فتح صفحة الكورس المنشورة في تبويب جديد
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Primary Publish / Submit Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleNextStep(3)}
              >
                <ChevronRight className="h-4 w-4" />
                <span>السابق: المحتوى والدروس</span>
              </Button>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={creatingDraft || publishingBusy}
                  onClick={() => void performServerSave()}
                >
                  <Save className="h-4 w-4" />
                  حفظ كمسودة والعودة لاحقاً
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  data-testid="wizard-primary-publish-or-submit-btn"
                  disabled={publishingBusy || !completeness.readyToPublish}
                  onClick={() => void handlePublishOrSubmit()}
                >
                  {publishingBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جارٍ التنفيذ...
                    </>
                  ) : mode === 'admin' ? (
                    <>
                      <Sparkles className="h-4 w-4" />
                      نشر الكورس مباشرة في الأكاديمية
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      إرسال الكورس للمراجعة الإدارية
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
