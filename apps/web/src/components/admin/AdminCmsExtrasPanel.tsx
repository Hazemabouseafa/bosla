'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Eye,
  EyeOff,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Badge,
  Button,
  Card,
  Field,
  inputClassName,
  textareaClassName,
} from '@/components/ui/primitives';

export function AdminCmsExtrasPanel() {
  const { pushToast } = useAuth();
  const [careers, setCareers] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [careerForm, setCareerForm] = useState({
    id: '',
    titleAr: '',
    departmentAr: '',
    locationAr: 'القاهرة / عن بُعد',
    employmentTypeAr: 'دوام كامل',
    summaryAr: '',
    applyUrl: '',
    applyEmail: '',
    isPublished: true,
    sortOrder: '0',
  });
  const [savingCareer, setSavingCareer] = useState(false);
  const [savingTrainers, setSavingTrainers] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, tRes] = await Promise.all([
        apiFetch<any[]>('/admin/careers'),
        apiFetch<any[]>('/admin/trainers/homepage'),
      ]);
      setCareers(Array.isArray(cRes) ? cRes : []);
      setTrainers(Array.isArray(tRes) ? tRes : []);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل إدارة الوظائف والمدربين', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveCareer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCareer(true);
    try {
      await apiFetch('/admin/careers', {
        method: 'POST',
        body: JSON.stringify({
          ...(careerForm.id ? { id: careerForm.id } : {}),
          titleAr: careerForm.titleAr.trim(),
          departmentAr: careerForm.departmentAr.trim() || null,
          locationAr: careerForm.locationAr.trim() || null,
          employmentTypeAr: careerForm.employmentTypeAr.trim() || null,
          summaryAr: careerForm.summaryAr.trim(),
          applyUrl: careerForm.applyUrl.trim() || null,
          applyEmail: careerForm.applyEmail.trim() || null,
          isPublished: careerForm.isPublished,
          sortOrder: Number(careerForm.sortOrder || 0),
        }),
      });
      pushToast('تم حفظ الفرصة الوظيفية بنجاح', 'success');
      setCareerForm({
        id: '',
        titleAr: '',
        departmentAr: '',
        locationAr: 'القاهرة / عن بُعد',
        employmentTypeAr: 'دوام كامل',
        summaryAr: '',
        applyUrl: '',
        applyEmail: '',
        isPublished: true,
        sortOrder: '0',
      });
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ الفرصة الوظيفية', 'error');
    } finally {
      setSavingCareer(false);
    }
  };

  const handleDeleteCareer = async (id: string) => {
    try {
      await apiFetch(`/admin/careers/${id}`, { method: 'DELETE' });
      pushToast('تم حذف الفرصة الوظيفية', 'info');
      await loadData();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الحذف', 'error');
    }
  };

  const moveTrainer = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= trainers.length) return;
    setTrainers((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next.map((item, i) => ({ ...item, homepageSortOrder: (i + 1) * 10 }));
    });
  };

  const toggleTrainerVisibility = (userId: string) => {
    setTrainers((prev) =>
      prev.map((t) =>
        t.userId === userId ? { ...t, showOnHomepage: !t.showOnHomepage } : t,
      ),
    );
  };

  const handleSaveTrainersOrder = async () => {
    setSavingTrainers(true);
    try {
      const res = await apiFetch<any[]>('/admin/trainers/homepage', {
        method: 'PUT',
        body: JSON.stringify({
          items: trainers.map((t, idx) => ({
            userId: t.userId,
            showOnHomepage: Boolean(t.showOnHomepage),
            homepageSortOrder: (idx + 1) * 10,
          })),
        }),
      });
      setTrainers(Array.isArray(res) ? res : trainers);
      pushToast('تم حفظ ترتيب وظهور المدربين على الصفحة الرئيسية', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حفظ ترتيب المدربين', 'error');
    } finally {
      setSavingTrainers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Careers Management */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-[#EEF0FF] flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#8CA2FF]" />
            إدارة صفحة الوظائف وفرص العمل (/careers)
          </h2>
          <p className="text-xs text-[#A9B1E0] mt-1">
            أضف فرص العمل المفتوحة مع رابط التقديم أو البريد المخصص، مع إمكانية النشر أو الإخفاء دون التأثير على الصفحة العامة.
          </p>
        </div>

        <form onSubmit={handleSaveCareer} className="grid gap-3 md:grid-cols-3 rounded-xl border border-[#8CA2FF]/15 bg-[#0B1440] p-4">
          <Field label="المسمى الوظيفي *" required>
            <input
              value={careerForm.titleAr}
              onChange={(e) => setCareerForm({ ...careerForm, titleAr: e.target.value })}
              placeholder="أخصائي إنتاج داجني / مصمم تعليمي"
              className={inputClassName}
              required
            />
          </Field>
          <Field label="القسم">
            <input
              value={careerForm.departmentAr}
              onChange={(e) => setCareerForm({ ...careerForm, departmentAr: e.target.value })}
              placeholder="المحتوى العلمي / العمليات"
              className={inputClassName}
            />
          </Field>
          <Field label="الموقع ونمط العمل">
            <input
              value={careerForm.locationAr}
              onChange={(e) => setCareerForm({ ...careerForm, locationAr: e.target.value })}
              placeholder="القاهرة / عن بُعد"
              className={inputClassName}
            />
          </Field>
          <div className="md:col-span-3">
            <Field label="وصف الدور والمهام *" required>
              <textarea
                rows={3}
                value={careerForm.summaryAr}
                onChange={(e) => setCareerForm({ ...careerForm, summaryAr: e.target.value })}
                placeholder="ملخص واضح للمهام والخبرة المطلوبة..."
                className={textareaClassName}
                required
              />
            </Field>
          </div>
          <Field label="رابط التقديم الخارجي (اختياري)">
            <input
              dir="ltr"
              value={careerForm.applyUrl}
              onChange={(e) => setCareerForm({ ...careerForm, applyUrl: e.target.value })}
              placeholder="https://forms..."
              className={inputClassName}
            />
          </Field>
          <Field label="أو بريد التقديم المباشر (اختياري)">
            <input
              dir="ltr"
              type="email"
              value={careerForm.applyEmail}
              onChange={(e) => setCareerForm({ ...careerForm, applyEmail: e.target.value })}
              placeholder="careers@boslaagri.com"
              className={inputClassName}
            />
          </Field>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-[#EEF0FF] pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={careerForm.isPublished}
                onChange={(e) => setCareerForm({ ...careerForm, isPublished: e.target.checked })}
              />
              منشورة للجمهور
            </label>
            <Button type="submit" variant="primary" size="sm" disabled={savingCareer}>
              <Plus className="h-4 w-4" />
              {savingCareer ? 'جاري الحفظ...' : careerForm.id ? 'تحديث الفرصة' : 'نشر الفرصة'}
            </Button>
          </div>
        </form>

        <div className="space-y-2 text-xs">
          {careers.length === 0 ? (
            <p className="text-[#A9B1E0]">لا توجد فرص وظيفية مضافة حالياً.</p>
          ) : (
            careers.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8CA2FF]/15 bg-[#070D2B] p-3.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#EEF0FF]">{job.titleAr}</span>
                    <Badge tone={job.isPublished ? 'success' : 'neutral'}>
                      {job.isPublished ? 'منشورة' : 'مسودة'}
                    </Badge>
                    {job.departmentAr && <Badge tone="info">{job.departmentAr}</Badge>}
                  </div>
                  <p className="text-[#A9B1E0] line-clamp-2">{job.summaryAr}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCareerForm({
                        id: job.id,
                        titleAr: job.titleAr,
                        departmentAr: job.departmentAr || '',
                        locationAr: job.locationAr || '',
                        employmentTypeAr: job.employmentTypeAr || '',
                        summaryAr: job.summaryAr,
                        applyUrl: job.applyUrl || '',
                        applyEmail: job.applyEmail || '',
                        isPublished: Boolean(job.isPublished),
                        sortOrder: String(job.sortOrder || 0),
                      })
                    }
                  >
                    تعديل
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => void handleDeleteCareer(job.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Homepage Trainers Ordering & Visibility */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#EEF0FF] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#77E2B5]" />
              ترتيب وظهور المدربين في شريط الصفحة الرئيسية (Marquee)
            </h2>
            <p className="text-xs text-[#A9B1E0] mt-1">
              حدّد المدربين الظاهرين في واجهة الأكاديمية ورتّب أولوية ظهورهم بالتسلسل الفعلي.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSaveTrainersOrder}
            disabled={savingTrainers || loading}
          >
            <Save className="h-4 w-4" />
            {savingTrainers ? 'جاري الحفظ...' : 'حفظ الترتيب'}
          </Button>
        </div>

        <div className="space-y-2 text-xs">
          {trainers.map((t, idx) => (
            <div
              key={t.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8CA2FF]/15 bg-[#070D2B] p-3"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1536B5]/25 font-bold text-[#8CA2FF] tabular-nums">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-bold text-[#EEF0FF]">{t.fullName}</p>
                  <p className="text-[#A9B1E0]">
                    {t.headlineAr || 'مدرب بالأكاديمية'} • {t.publishedCoursesCount || 0} كورسات منشورة
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveTrainer(idx, -1)}
                  disabled={idx === 0}
                  aria-label="تحريك لأعلى"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveTrainer(idx, 1)}
                  disabled={idx === trainers.length - 1}
                  aria-label="تحريك لأسفل"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={t.showOnHomepage ? 'success' : 'outline'}
                  size="sm"
                  onClick={() => toggleTrainerVisibility(t.userId)}
                >
                  {t.showOnHomepage ? (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      ظاهر بالرئيسية
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      مخفي
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
