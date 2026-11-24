'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { CourseWizardEditor } from '@/components/instructor/CourseWizardEditor';

export function AdminCreateCourseModal({
  open = true,
  categories,
  instructors,
  users,
  onClose,
  onCreated,
}: {
  open?: boolean;
  categories: any[];
  instructors?: any[];
  users?: any[];
  onClose: () => void;
  onCreated: (created?: any, openEditorAfter?: boolean) => void | Promise<void>;
}) {
  const resolvedInstructors = useMemo(() => {
    if (Array.isArray(instructors) && instructors.length > 0) return instructors;
    if (Array.isArray(users) && users.length > 0) {
      const filtered = users.filter(
        (u) =>
          u.role === 'INSTRUCTOR' ||
          u.role === 'ADMIN' ||
          u.role === 'SUPER_ADMIN' ||
          (Array.isArray(u.assignedUserRoles) &&
            u.assignedUserRoles.some((r: any) => r.role?.code === 'INSTRUCTOR')),
      );
      return filtered.length > 0 ? filtered : users;
    }
    return [];
  }, [instructors, users]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="إنشاء كورس جديد (4 خطوات)"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-extrabold text-slate-100">
            معالج إنشاء ونشر كورس جديد (4 خطوات)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <CourseWizardEditor
          mode="admin"
          categories={categories}
          instructors={resolvedInstructors}
          onCourseCreated={(newId) => {
            void onCreated({ id: newId }, false);
          }}
          onCoursePublishedOrSubmitted={(course) => {
            void onCreated(course, false);
            onClose();
          }}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

export function AdminEditCoursePanel({
  course,
  onClose,
  categories,
  users,
  onUpdated,
}: {
  course: any;
  onClose: () => void;
  categories: any[];
  users?: any[];
  onUpdated?: (updatedCourse?: any) => void | Promise<void>;
  onPublish?: (id: string) => void | Promise<void>;
  onUnpublish?: (id: string) => void | Promise<void>;
}) {
  const resolvedInstructors = useMemo(() => {
    if (Array.isArray(users) && users.length > 0) {
      const filtered = users.filter(
        (u) =>
          u.role === 'INSTRUCTOR' ||
          u.role === 'ADMIN' ||
          u.role === 'SUPER_ADMIN',
      );
      return filtered.length > 0 ? filtered : users;
    }
    return [];
  }, [users]);

  if (!course?.id) return null;

  return (
    <CourseWizardEditor
      mode="admin"
      initialCourseId={course.id}
      categories={categories}
      instructors={resolvedInstructors}
      onCoursePublishedOrSubmitted={(updated) => {
        void onUpdated?.(updated);
      }}
      onClose={onClose}
    />
  );
}

export function AdminCourseCurriculumModal({
  courseId,
  onClose,
  onUpdated,
}: {
  courseId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="إدارة محتوى الكورس والدروس"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-extrabold text-slate-100">
            معالج إدارة وتحديث الكورس والدروس (4 خطوات)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <CourseWizardEditor
          mode="admin"
          initialCourseId={courseId}
          onCoursePublishedOrSubmitted={() => {
            onUpdated();
            onClose();
          }}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
