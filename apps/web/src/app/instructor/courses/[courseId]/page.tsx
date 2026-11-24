'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, Eye, RotateCcw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { CourseWizardEditor } from '@/components/instructor/CourseWizardEditor';
import { InstructorShell } from '@/components/layout/SiteShell';
import {
  AlertBanner,
  Badge,
  Button,
  SkeletonDashboardGrid,
} from '@/components/ui/primitives';

export default function InstructorCourseEditorPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;
  const { user, isLoading: authLoading, pushToast } = useAuth();

  const [course, setCourse] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCourseSummary = useCallback(async () => {
    if (!courseId || !user) return;
    try {
      const cRes = await apiFetch<any>(`/instructor/courses/${courseId}`);
      setCourse(cRes);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل بيانات الكورس', 'error');
    } finally {
      setLoading(false);
    }
  }, [courseId, user, pushToast]);

  useEffect(() => {
    if (user) void loadCourseSummary();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, loadCourseSummary]);

  const handleWithdraw = async () => {
    if (!courseId) return;
    try {
      await apiFetch(`/instructor/courses/${courseId}/withdraw`, {
        method: 'POST',
      });
      pushToast('تم سحب الكورس من المراجعة لإجراء تعديلات إضافية', 'info');
      await loadCourseSummary();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر سحب الطلب', 'error');
    }
  };

  if (authLoading || loading) {
    return (
      <InstructorShell>
        <SkeletonDashboardGrid />
      </InstructorShell>
    );
  }

  const isAdminUser =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    (Array.isArray(user?.roles) &&
      (user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')));

  return (
    <InstructorShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={isAdminUser ? '/admin' : '/instructor'}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-400 hover:underline"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              العودة إلى لوحة الكورسات
            </Link>
            {course?.slug && (
              <Badge tone="neutral">
                <span dir="ltr">{course.slug}</span>
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(course?.status === 'IN_REVIEW' ||
              course?.draftVersion?.status === 'SUBMITTED_FOR_REVIEW') && (
              <Button variant="secondary" size="sm" onClick={() => void handleWithdraw()}>
                <RotateCcw className="h-4 w-4" />
                سحب من المراجعة للتعديل
              </Button>
            )}
            {course?.slug && course?.status === 'PUBLISHED' && (
              <Link href={`/courses/${course.slug}`} target="_blank">
                <Button variant="secondary" size="sm">
                  <Eye className="h-4 w-4" />
                  معاينة الكورس المنشور
                </Button>
              </Link>
            )}
          </div>
        </div>

        {course?.draftVersion?.reviewFeedbackAr && (
          <AlertBanner tone="warning" title="ملاحظات الإدارة على النسخة المرسلة">
            {course.draftVersion.reviewFeedbackAr}
          </AlertBanner>
        )}

        <CourseWizardEditor
          mode={isAdminUser ? 'admin' : 'instructor'}
          initialCourseId={courseId}
          onCoursePublishedOrSubmitted={() => void loadCourseSummary()}
        />
      </div>
    </InstructorShell>
  );
}
