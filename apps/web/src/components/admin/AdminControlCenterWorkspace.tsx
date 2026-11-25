'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  BookOpen,
  BookPlus,
  CalendarClock,
  CheckCircle2,
  Command,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileEdit,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  Trash2,
  UserCog,
  UserPlus,
} from 'lucide-react';
import { slugifyTitle } from '@bosla/shared';
import { apiFetch, formatDate, formatDateTime, formatEgp } from '@/lib/api';
import { downloadCsv } from '@/lib/csv-export';
import {
  ALL_ASSIGNABLE_ROLES,
  getCourseStatusMeta,
  getDefaultDashboardForUser,
  getDifficultyLabel,
  getIntervalLabel,
  getPaymentStatusMeta,
  getRecoveryStatusMeta,
  getRoleBadgeTone,
  getRoleLabel,
  getUserStatusMeta,
} from '@/lib/labels';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell';
import { AdminCommunitiesPanel } from '@/components/community/AdminCommunitiesPanel';
import { AdminCmsSettingsPanel } from '@/components/admin/AdminCmsSettingsPanel';
import { AdminOfflineEventsPanel } from '@/components/admin/AdminOfflineEventsPanel';
import { AdminOverviewLedger } from '@/components/admin/AdminOverviewLedger';
import { AdminSectionVisibilityPanel } from '@/components/admin/AdminSectionVisibilityPanel';
import { AdminFinanceProgramsPanel } from '@/components/admin/AdminFinanceProgramsPanel';
import { AdminInstructorCollabPanel } from '@/components/admin/AdminInstructorCollabPanel';
import { AdminCrmProfessionalPanel } from '@/components/admin/AdminCrmProfessionalPanel';
import { AdminEnterpriseSuitePanel } from '@/components/admin/AdminEnterpriseSuitePanel';
import { AdminCommandPalette, type CommandItem } from '@/components/admin/AdminCommandPalette';
import {
  AdminCreateCourseModal,
  AdminEditCoursePanel,
} from '@/components/admin/AdminCourseModals';
import {
  AdminDiplomaFormModal,
  AdminGradeSubmissionModal,
  AdminPathFormModal,
} from '@/components/admin/AdminCatalogModals';
import { AdminMediaControlPanel } from '@/components/admin/AdminMediaControlPanel';
import {
  AdminCmsPageModal,
  AdminMembershipPlanModal,
} from '@/components/admin/AdminMembershipModals';
import {
  AdminCreateUserModal,
  AdminUserDetailPanel,
} from '@/components/admin/AdminUserControlPanel';
import { AdminCouponsAndTemplatesPanel } from '@/components/admin/AdminCouponsAndTemplatesPanel';
import { AdminLiveSiteEditorPanel } from '@/components/admin/AdminLiveSiteEditorPanel';
import { AdminPaymobSettingsPanel } from '@/components/admin/AdminPaymobSettingsPanel';
import {
  Badge,
  Button,
  Card,
  Field,
  NativeModal,
  PasswordInput,
  inputClassName,
} from '@/components/ui/primitives';

import { AdminGoogleAndMailSettingsPanel } from '@/components/admin/AdminGoogleAndMailSettingsPanel';
import { AdminSupportManualGrantPanel } from '@/components/admin/AdminSupportManualGrantPanel';
import { AdminCmsExtrasPanel } from '@/components/admin/AdminCmsExtrasPanel';
import { AdminRecommendationsPanel } from '@/components/admin/AdminRecommendationsPanel';
import {
  ADMIN_NAV_DESCRIPTORS,
  type AdminSectionKey,
  buildAdminAccordionNavItems,
  canAccessAdminSection,
  hasFullAdminAuthority,
  resolveLegacyAdminRedirectUrl,
} from '@/components/admin/AdminNavMap';

export function AdminControlCenterWorkspace({
  initialSection = 'overview',
}: {
  initialSection?: AdminSectionKey;
}) {
  const router = useRouter();
  const { user, isLoading: authLoading, pushToast } = useAuth();
  const [activeSection] = useState<AdminSectionKey>(initialSection);
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<any | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [diplomas, setDiplomas] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [paymentsData, setPaymentsData] = useState<any | null>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<any[]>([]);
  const [cmsPages, setCmsPages] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [offlineEvents, setOfflineEvents] = useState<any[]>([]);

  // Search & filter state
  const [courseSearch, setCourseSearch] = useState('');
  const [courseStatusFilter, setCourseStatusFilter] = useState<string>('ALL');
  const [overviewCoursePage, setOverviewCoursePage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [confirmDeleteCourseId, setConfirmDeleteCourseId] = useState<string | null>(null);

  // Editorial review state
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string>>({});

  // Course modals
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);

  // Create instructor modal
  const [instModalOpen, setInstModalOpen] = useState(false);
  const [instName, setInstName] = useState('');
  const [instPhone, setInstPhone] = useState('');
  const [instEmail, setInstEmail] = useState('');
  const [instPassword, setInstPassword] = useState('');
  const [instHeadline, setInstHeadline] = useState('');

  // New Category form
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catSlugManual, setCatSlugManual] = useState(false);

  // Learning Path & Diploma & Grading modals
  const [pathModalOpen, setPathModalOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<any | null>(null);
  const [dipModalOpen, setDipModalOpen] = useState(false);
  const [editingDiploma, setEditingDiploma] = useState<any | null>(null);
  const [gradingSubmission, setGradingSubmission] = useState<any | null>(null);

  // Membership Plan & Page modals
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [editingPage, setEditingPage] = useState<any | null>(null);

  // Full Control Executive State
  const [commandOpen, setCommandOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [confirmDeletePathId, setConfirmDeletePathId] = useState<string | null>(null);
  const [confirmDeleteDiplomaId, setConfirmDeleteDiplomaId] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [showWebhooks, setShowWebhooks] = useState(false);


  const [liveArea, setLiveArea] = useState<'editor' | 'sections'>('editor');
  const [settingsFocus, setSettingsFocus] = useState<'all' | 'paymob'>('all');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('area') === 'sections') setLiveArea('sections');
    if (sp.get('section') === 'paymob') setSettingsFocus('paymob');
  }, []);

  const userPerms = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);
  const isFullAdmin = useMemo(() => hasFullAdminAuthority(user), [user]);
  const hasPerm = useCallback(
    (code: string) => isFullAdmin || userPerms.has(code),
    [isFullAdmin, userPerms],
  );
  const canViewSection = useMemo(
    () => canAccessAdminSection(activeSection, user),
    [activeSection, user],
  );

  const navigateToSection = useCallback(
    (sec: AdminSectionKey) => {
      setEditingCourse(null);
      setSelectedUserId(null);
      const target = ADMIN_NAV_DESCRIPTORS.find((d) => d.section === sec)?.href || '/admin';
      router.push(target);
    },
    [router],
  );

  const navigateToLegacyOrSection = useCallback(
    (rawTab: string) => {
      const isDirectSection = ADMIN_NAV_DESCRIPTORS.some((d) => d.section === rawTab);
      if (isDirectSection) {
        navigateToSection(rawTab as AdminSectionKey);
        return;
      }
      const mapped = resolveLegacyAdminRedirectUrl(new URLSearchParams({ tab: rawTab }));
      router.push(mapped || '/admin');
    },
    [navigateToSection, router],
  );

  const loadEverything = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const safe = <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
        promise.catch(() => fallback);

      const [
        ov,
        q,
        coursesRes,
        usersRes,
        cats,
        pathsRes,
        diplomasRes,
        subsRes,
        plansRes,
        payRes,
        certsRes,
        recRes,
        cmsRes,
        auditRes,
        eventsRes,
      ] = await Promise.all([
        safe(apiFetch<any>('/admin/overview'), null),
        safe(apiFetch<any[]>('/admin/editorial/queue'), []),
        safe(apiFetch<any[]>('/admin/courses'), []),
        safe(apiFetch<any[]>('/admin/users'), []),
        safe(apiFetch<any[]>('/admin/categories'), []),
        safe(apiFetch<any[]>('/admin/learning-paths'), []),
        safe(apiFetch<any[]>('/admin/diplomas'), []),
        safe(apiFetch<any[]>('/admin/diplomas/submissions'), []),
        safe(apiFetch<any[]>('/admin/membership-plans'), []),
        safe(apiFetch<any>('/admin/payments'), null),
        safe(apiFetch<any[]>('/admin/certificates'), []),
        safe(apiFetch<any[]>('/admin/support-recovery'), []),
        safe(apiFetch<any[]>('/admin/cms/pages'), []),
        safe(apiFetch<any[]>('/admin/audit-logs?limit=60'), []),
        safe(apiFetch<any[]>('/admin/events'), []),
      ]);

      setOverview(ov);
      setQueue(Array.isArray(q) ? q : []);
      if (Array.isArray(coursesRes) && coursesRes.length > 0) {
        setAllCourses(coursesRes);
      } else {
        const pubCourses = await safe(apiFetch<any[]>('/catalog/courses'), []);
        setAllCourses(Array.isArray(pubCourses) ? pubCourses : []);
      }
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setPaths(Array.isArray(pathsRes) ? pathsRes : []);
      setDiplomas(Array.isArray(diplomasRes) ? diplomasRes : []);
      setSubmissions(Array.isArray(subsRes) ? subsRes : []);
      setPlans(Array.isArray(plansRes) ? plansRes : []);
      setPaymentsData(payRes);
      setCertificates(Array.isArray(certsRes) ? certsRes : []);
      setRecoveryRequests(Array.isArray(recRes) ? recRes : []);
      setCmsPages(Array.isArray(cmsRes) ? cmsRes : []);
      setAuditLogs(Array.isArray(auditRes) ? auditRes : []);
      setOfflineEvents(Array.isArray(eventsRes) ? eventsRes : []);
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحميل لوحة التحكم الإدارية', 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const nextHref = ADMIN_NAV_DESCRIPTORS.find((d) => d.section === activeSection)?.href || '/admin';
      router.replace(`/login?next=${encodeURIComponent(nextHref)}`);
      return;
    }
    const staffRoles = new Set([
      'ADMIN',
      'SUPER_ADMIN',
      'ACADEMY_MANAGER',
      'TRAINING_COORDINATOR',
      'FINANCE_OFFICER',
      'SUPPORT',
    ]);
    const userRoles = new Set([user.role, ...(user.roles || [])]);
    const hasStaffAccess = Array.from(userRoles).some((r) => staffRoles.has(r));
    if (!hasStaffAccess) {
      router.replace(
        user.role === 'INSTRUCTOR'
          ? '/instructor'
          : user.role === 'AFFILIATE_SELLER'
            ? '/seller'
            : '/student',
      );
      return;
    }
    if (!canViewSection) {
      setLoading(false);
      return;
    }
    void loadEverything();
  }, [authLoading, user, router, loadEverything, activeSection, canViewSection]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleReview = async (
    versionId: string,
    decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT',
  ) => {
    const comment =
      reviewComments[versionId]?.trim() ||
      (decision === 'APPROVE' ? 'معتمد للنشر وفق معايير بوصلة' : 'يرجى استكمال المراجعة');
    try {
      await apiFetch(`/admin/editorial/versions/${versionId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment }),
      });
      pushToast('تم تسجيل قرار المراجعة الإدارية', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تنفيذ القرار', 'error');
    }
  };

  const handlePublish = async (versionId: string) => {
    try {
      await apiFetch(`/admin/editorial/versions/${versionId}/publish`, {
        method: 'POST',
      });
      pushToast('تم نشر الكورس للطلاب بنجاح!', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر النشر (تأكد من اعتماده أولاً)', 'error');
    }
  };

  const handleDirectCoursePublish = async (courseId: string) => {
    try {
      await apiFetch(`/admin/courses/${courseId}/publish`, { method: 'POST' });
      pushToast('تم نشر الكورس للطلاب بنجاح!', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر نشر الكورس', 'error');
    }
  };

  const handleUnpublish = async (courseId: string) => {
    try {
      await apiFetch(`/admin/courses/${courseId}/unpublish`, {
        method: 'POST',
      });
      pushToast('تم إيقاف نشر الكورس', 'info');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إيقاف النشر', 'error');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await apiFetch(`/admin/courses/${courseId}`, { method: 'DELETE' });
      setConfirmDeleteCourseId(null);
      setSelectedCourseIds((prev) => prev.filter((id) => id !== courseId));
      pushToast('تم حذف الكورس بنجاح', 'info');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف الكورس', 'error');
    }
  };

  const handleDuplicateCourse = async (courseId: string) => {
    try {
      await apiFetch(`/admin/courses/${courseId}/duplicate`, { method: 'POST' });
      pushToast('تم نسخ الكورس كمسودة جديدة بنجاح', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر نسخ الكورس', 'error');
    }
  };

  const handleBulkCourseAction = async (action: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE') => {
    if (selectedCourseIds.length === 0) return;
    try {
      const res = await apiFetch<{ processedCount: number }>('/admin/courses/bulk-action', {
        method: 'POST',
        body: JSON.stringify({ courseIds: selectedCourseIds, action }),
      });
      setSelectedCourseIds([]);
      pushToast(`تم تنفيذ الإجراء الجماعي على ${res.processedCount} كورس بنجاح`, 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تنفيذ الإجراء الجماعي', 'error');
    }
  };

  const handleDeletePath = async (id: string) => {
    try {
      await apiFetch(`/admin/learning-paths/${id}`, { method: 'DELETE' });
      setConfirmDeletePathId(null);
      pushToast('تم حذف المسار التعليمي', 'info');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف المسار', 'error');
    }
  };

  const handleDeleteDiploma = async (id: string) => {
    try {
      await apiFetch(`/admin/diplomas/${id}`, { method: 'DELETE' });
      setConfirmDeleteDiplomaId(null);
      pushToast('تم حذف الدبلومة', 'info');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف الدبلومة', 'error');
    }
  };

  const handleUpdateSubscriptionStatus = async (
    subId: string,
    status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED',
    extendDays?: number,
  ) => {
    try {
      await apiFetch(`/admin/subscriptions/${subId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, ...(extendDays ? { extendDays } : {}) }),
      });
      pushToast('تم تحديث الاشتراك بنجاح', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر تحديث الاشتراك', 'error');
    }
  };

  const handleSchedule = async (courseId: string) => {
    const dt = scheduleTimes[courseId];
    if (!dt) {
      pushToast('اختر تاريخاً ووقتاً مستقبلياً أولاً', 'error');
      return;
    }
    try {
      await apiFetch(`/admin/editorial/courses/${courseId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ scheduledPublishAt: new Date(dt).toISOString() }),
      });
      pushToast('تم جدولة النشر بنجاح', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الجدولة', 'error');
    }
  };

  const handleUserRoleChange = async (
    targetUserId: string,
    role: string,
    status: string,
  ) => {
    try {
      await apiFetch(`/admin/users/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role, status }),
      });
      pushToast('تم تحديث صلاحيات وحالة الحساب', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر التحديث', 'error');
    }
  };

  const handleCreateInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/instructors', {
        method: 'POST',
        body: JSON.stringify({
          fullName: instName,
          phoneNumber: instPhone,
          countryCode: '+20',
          email: instEmail.trim() || undefined,
          password: instPassword,
          headlineAr: instHeadline,
          activateImmediately: true,
        }),
      });
      pushToast('تم إنشاء حساب المدرب وتفعيله بنجاح', 'success');
      setInstModalOpen(false);
      setInstName('');
      setInstPhone('');
      setInstEmail('');
      setInstPassword('');
      setInstHeadline('');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر إنشاء المدرب', 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSlug = (catSlug.trim() || slugifyTitle(catName, 'cat')).toLowerCase();
    try {
      await apiFetch('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ slug: finalSlug, nameAr: catName.trim() }),
      });
      setCatSlug('');
      setCatName('');
      setCatSlugManual(false);
      pushToast('تم حفظ القسم بنجاح', 'success');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر الحفظ', 'error');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await apiFetch(`/admin/categories/${categoryId}`, { method: 'DELETE' });
      pushToast('تم حذف القسم', 'info');
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر حذف القسم', 'error');
    }
  };

  const handleResolveRecovery = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await apiFetch<any>(`/admin/support-recovery/${requestId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          resolutionNotes: status === 'APPROVED' ? 'تم التحقق وإصدار رمز تعيين' : 'بيانات غير كافية',
        }),
      });
      if (res.supportResetToken) {
        await navigator.clipboard?.writeText(res.supportResetToken).catch(() => {});
        pushToast(`تمت الموافقة! رمز الاسترداد: ${res.supportResetToken}`, 'success');
      } else {
        pushToast('تم تحديث حالة طلب الاسترداد', 'info');
      }
      await loadEverything();
    } catch (err: any) {
      pushToast(err?.message || 'تعذر المعالجة', 'error');
    }
  };

  const openEditCoursePanel = useCallback((course: any) => {
    setSelectedUserId(null);
    setEditingCourse(course);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);


  const effectiveUserRoles = useMemo(
    () => new Set<string>([user?.role || '', ...(user?.roles || [])].filter(Boolean)),
    [user],
  );
  const roleDash = useMemo(() => getDefaultDashboardForUser(user), [user]);

  const commandItems: CommandItem[] = useMemo(() => {
    const navCmds: CommandItem[] = [
      { id: 'tab-overview', label: 'نظرة عامة والبنية', category: 'تنقل سريع', onSelect: () => { navigateToSection('overview'); } },
      { id: 'tab-instructor-collab', label: 'التواصل المباشر وشات ومهام المدربين', category: 'تنقل سريع', onSelect: () => { navigateToSection('instructor_collab'); } },
      { id: 'tab-editorial', label: 'إدارة ومراجعة الكورسات', category: 'تنقل سريع', onSelect: () => { navigateToSection('editorial'); } },
      { id: 'tab-finance', label: 'المالية والمدربون وطلبات الكفاءة', category: 'تنقل سريع', onSelect: () => { navigateToSection('finance'); } },
      { id: 'tab-media', label: 'مكتبة الوسائط والأصول (صور وفيديو)', category: 'تنقل سريع', onSelect: () => { navigateToSection('media'); } },
      { id: 'tab-events', label: 'الفعاليات والكورسات الأوفلاين', category: 'تنقل سريع', onSelect: () => { navigateToSection('events'); } },
      { id: 'tab-sections', label: 'التحكم في إظهار وإخفاء أقسام الموقع', category: 'تنقل سريع', onSelect: () => { router.push('/admin/live-editor?area=sections'); } },
      { id: 'tab-users', label: 'إدارة المستخدمين والصلاحيات 360°', category: 'تنقل سريع', onSelect: () => { navigateToSection('users'); } },
      { id: 'tab-memberships', label: 'العضويات والاشتراكات والمدفوعات', category: 'تنقل سريع', onSelect: () => { navigateToSection('memberships'); } },
      { id: 'tab-cms', label: 'إعدادات المنصة والتقييمات والإشعارات', category: 'تنقل سريع', onSelect: () => { navigateToSection('cms_leads'); } },
    ];
    const quickCmds: CommandItem[] = [
      { id: 'act-new-course', label: 'إنشاء كورس جديد على المنصة', category: 'إجراءات فورية', onSelect: () => setCreateCourseOpen(true) },
      { id: 'act-new-user', label: 'إنشاء حساب مستخدم جديد (طالب/مدرب/مدير)', category: 'إجراءات فورية', onSelect: () => setCreateUserOpen(true) },
      { id: 'act-refresh', label: 'تحديث بيانات لوحة التحكم الآن', category: 'إجراءات فورية', onSelect: () => void loadEverything() },
    ];
    const courseCmds: CommandItem[] = allCourses.slice(0, 30).map((c) => ({
      id: `course-${c.id}`,
      label: c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug,
      subtitle: `${c.instructor?.fullName || ''} • /${c.slug}`,
      category: 'كورسات',
      onSelect: () => openEditCoursePanel(c),
    }));
    const userCmds: CommandItem[] = users.slice(0, 30).map((u) => ({
      id: `user-${u.id}`,
      label: u.fullName,
      subtitle: `${u.phoneE164 || u.email || ''} • ${getRoleLabel(u.role)}`,
      category: 'حسابات المستخدمين',
      onSelect: () => {
        setEditingCourse(null);
        navigateToSection('users');
        setSelectedUserId(u.id);
      },
    }));
    return [...quickCmds, ...navCmds, ...courseCmds, ...userCmds];
  }, [allCourses, users, loadEverything, openEditCoursePanel, navigateToSection, router]);

  const navItems: DashboardNavItem[] = useMemo(
    () =>
      buildAdminAccordionNavItems({
        activeSection,
        user,
        queueCount: overview?.queues?.pendingEditorialReviews ?? queue.length,
        eventsCount: offlineEvents.length,
        usersCount: users.length,
        onItemNavigate: () => {
          setEditingCourse(null);
          setSelectedUserId(null);
        },
      }),
    [activeSection, user, overview, queue.length, offlineEvents.length, users.length],
  );

  if (authLoading || loading) {
    return (
      <div className="bosla-admin-scope min-h-dvh bg-[#050A24] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#8CA2FF]/20 bg-[#0B1440] p-8 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-xl border border-[#8CA2FF]/25 bg-[#0F1A4A] flex items-center justify-center">
            <img
              src="/images/brand/bosla-logo.webp"
              alt="شعار بوصلة"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          </div>
          <p className="text-sm font-bold text-[#EEF0FF]">جاري تحميل لوحة التحكم الإدارية...</p>
          <p className="text-xs text-[#A9B1E0]">تهيئة البيانات والصلاحيات والتقارير التشغيلية</p>
        </div>
      </div>
    );
  }

  const activeDescriptor = ADMIN_NAV_DESCRIPTORS.find((d) => d.section === activeSection);
  const dynamicTitle = editingCourse
    ? `تعديل كورس: ${editingCourse.publishedVersion?.titleAr || editingCourse.draftVersion?.titleAr || editingCourse.slug}`
    : selectedUserId
      ? 'ملف المستخدم وإدارة الصلاحيات 360°'
      : activeDescriptor?.label || 'إدارة الأكاديمية';
  const dynamicBreadcrumb = editingCourse
    ? 'لوحة الإدارة / المحتوى الأكاديمي / تعديل الكورس'
    : selectedUserId
      ? 'لوحة الإدارة / المستخدمون والصلاحيات / ملف 360°'
      : `لوحة الإدارة / ${activeDescriptor?.breadcrumbGroup || 'الرئيسية والتقارير'} / ${activeDescriptor?.label || ''}`;

  const studentCount = Number(overview?.usersByRole?.STUDENT ?? 0);
  const instructorCount = Number(overview?.usersByRole?.INSTRUCTOR ?? 0);
  const adminCount = Number(overview?.usersByRole?.ADMIN ?? 0);

  const filteredCourses = allCourses.filter((c) => {
    if (courseStatusFilter !== 'ALL' && c.status !== courseStatusFilter) return false;
    if (!courseSearch.trim()) return true;
    const q = courseSearch.trim().toLowerCase();
    const title = (c.publishedVersion?.titleAr || c.draftVersion?.titleAr || '').toLowerCase();
    const inst = (c.instructor?.fullName || '').toLowerCase();
    const cat = (c.category?.nameAr || '').toLowerCase();
    return title.includes(q) || inst.includes(q) || cat.includes(q) || c.slug.includes(q);
  });

  const filteredUsers = users.filter((u) => {
    if (userRoleFilter !== 'ALL') {
      const uRoles = [u.role, ...(u.assignedUserRoles || []).map((a: any) => a.role?.code)].filter(Boolean);
      if (!uRoles.includes(userRoleFilter)) return false;
    }
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return (
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.phoneE164 || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });


  return (
    <DashboardShell
      variant="admin"
      portalBadge={isFullAdmin ? 'بوابة الإدارة والتشغيل' : roleDash.portalBadgeAr}
      breadcrumbLabel={dynamicBreadcrumb}
      portalTitle={dynamicTitle}
      portalSubtitle={
        isFullAdmin
          ? 'مركز التحكم الإداري والرقابة التشغيلية لأكاديمية بوصلة'
          : `${user?.fullName || ''} — ${roleDash.portalSubtitleAr}`
      }
      navItems={navItems}
      searchPlaceholder={isFullAdmin ? 'أوامر سريعة (Ctrl+K)' : undefined}
      onSearchTrigger={isFullAdmin ? () => setCommandOpen(true) : undefined}
      headerActions={
        isFullAdmin ? (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setCommandOpen(true)} aria-label="أوامر سريعة (Ctrl+K)" className="!min-h-[38px] !px-2.5 xl:!px-3 text-xs whitespace-nowrap">
              <Command className="h-3.5 w-3.5 text-[#8CA2FF]" />
              <span className="hidden md:inline">أوامر سريعة (Ctrl+K)</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateCourseOpen(true)} aria-label="إضافة كورس جديد" className="!min-h-[38px] !px-2.5 xl:!px-3 text-xs whitespace-nowrap">
              <BookPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">إضافة كورس جديد</span>
              <span className="sm:hidden">كورس</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void loadEverything()} aria-label="تحديث البيانات" className="!min-h-[38px] !px-2.5 xl:!px-3 text-xs whitespace-nowrap">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden 2xl:inline">تحديث البيانات</span>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={getRoleBadgeTone(user?.role)}>{getRoleLabel(user?.role)}</Badge>
            {effectiveUserRoles.has('AFFILIATE_SELLER') && (
              <Link href="/seller">
                <Button variant="outline" size="sm">بوابة البائع المعتمد</Button>
              </Link>
            )}
            {effectiveUserRoles.has('INSTRUCTOR') && (
              <Link href="/instructor">
                <Button variant="outline" size="sm">بوابة المدرب</Button>
              </Link>
            )}
          </div>
        )
      }
      sidebarFooter={
        isFullAdmin && overview ? (
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-bosla-muted">طابور المراجعة</span>
            <span className="font-extrabold text-[#F5B94A]">
              {overview.queues?.pendingEditorialReviews ?? queue.length} معلق
            </span>
          </div>
        ) : (
          <div className="space-y-1 text-[11px]">
            <div className="font-extrabold text-bosla-ink">{getRoleLabel(user?.role)}</div>
            <div className="text-bosla-muted">صلاحيات مفعّلة: {(user?.permissions || []).length} صلاحية</div>
          </div>
        )
      }
    >
      <div className="space-y-6">
        {!authLoading && user && !canViewSection ? (
          <Card className="p-8 text-center space-y-4 border-rose-500/30">
            <ShieldAlert className="h-10 w-10 text-rose-400 mx-auto" />
            <h2 className="text-xl font-black text-bosla-ink">ليس لديك صلاحية للوصول إلى هذا القسم</h2>
            <p className="text-xs text-bosla-muted max-w-md mx-auto">
              تم رفض عرض صفحة «{activeDescriptor?.label || activeSection}» (403) لأن حسابك الحالي لا يمتلك الصلاحية المطلوبة.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Button variant="primary" size="sm" onClick={() => router.push(navItems[0]?.href || '/admin')}>
                العودة إلى القسم المتاح
              </Button>
            </div>
          </Card>
        ) : editingCourse ? (
          <AdminEditCoursePanel
            course={editingCourse}
            onClose={() => setEditingCourse(null)}
            categories={categories}
            users={users}
            onUpdated={async (updatedCourse) => {
              await loadEverything();
              if (updatedCourse) {
                setEditingCourse((prev: any) =>
                  prev ? { ...prev, ...updatedCourse } : updatedCourse,
                );
              }
            }}
            onPublish={async (id) => {
              await handleDirectCoursePublish(id);
              setEditingCourse((prev: any) =>
                prev ? { ...prev, status: 'PUBLISHED' } : prev,
              );
            }}
            onUnpublish={async (id) => {
              await handleUnpublish(id);
              setEditingCourse((prev: any) =>
                prev ? { ...prev, status: 'UNPUBLISHED' } : prev,
              );
            }}
          />
        ) : (
          <>
        {/* TAB: OVERVIEW (Architectural Cobalt Operations Ledger) */}
        {activeSection === 'overview' && overview && (
          <AdminOverviewLedger
            overview={overview}
            allCourses={allCourses}
            queueCount={overview.queues?.pendingEditorialReviews ?? queue.length}
            offlineEvents={offlineEvents}
            paymentsData={paymentsData}
            studentCount={studentCount}
            instructorCount={instructorCount}
            adminCount={adminCount}
            overviewCoursePage={overviewCoursePage}
            setOverviewCoursePage={setOverviewCoursePage}
            onOpenCreateCourse={() => setCreateCourseOpen(true)}
            onOpenCreateInstructor={() => setInstModalOpen(true)}
            onSelectTab={(nextTab) => {
              navigateToLegacyOrSection(String(nextTab));
            }}
            onEditCourse={openEditCoursePanel}
          />
        )}

        {activeSection === 'overview' && !overview && !loading && (
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-bosla-ink">
              مرحباً {user?.fullName || ''} — اختصارات الأقسام المصرح بها
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {navItems.filter((item) => item.id !== 'overview').map((item) => (
                <Link
                  key={item.id}
                  href={item.href || '/admin'}
                  className="rounded-xl border border-bosla-line p-4 hover:border-[#8CA2FF]/50 transition-colors flex items-center gap-3 text-sm font-bold text-bosla-ink"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* TAB: COURSES & EDITORIAL PUBLISHING */}
        {activeSection === 'editorial' && (
          <div className="space-y-8">
            {/* Editorial Queue */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold text-bosla-ink">
                  طابور المراجعة والنشر التحريري ({queue.length})
                </h2>
                <Button variant="primary" size="sm" onClick={() => setCreateCourseOpen(true)}>
                  <BookPlus className="h-4 w-4" />
                  إضافة كورس جديد
                </Button>
              </div>
              {queue.length === 0 ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-[#8CA2FF]/16 bg-[#09123A] px-4 py-3 text-xs sm:text-sm text-[#A9B1E0]">
                  <CheckCircle2 className="h-4 w-4 text-[#77E2B5] shrink-0" />
                  <span>طابور المراجعة فارغ حالياً — جميع الطلبات تمت معالجتها.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {queue.map((ver) => {
                    const st = getCourseStatusMeta(ver.status);
                    return (
                      <Card key={ver.id} className="p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge tone={st.tone}>{st.label}</Badge>
                              <span className="text-xs font-bold text-bosla-muted">
                                الإصدار رقم {ver.versionNumber} • المدرب: {ver.course?.instructor?.fullName}
                              </span>
                            </div>
                            <h3 className="mt-1 text-lg font-extrabold text-bosla-ink">
                              {ver.titleAr}
                            </h3>
                          </div>
                          <Link href={`/instructor/courses/${ver.courseId}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                              معاينة الدروس
                            </Button>
                          </Link>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            className={inputClassName}
                            placeholder="ملاحظات المراجعة الإدارية (مطلوبة عند طلب تعديلات أو الرفض)"
                            value={reviewComments[ver.id] || ''}
                            onChange={(e) =>
                              setReviewComments((prev) => ({
                                ...prev,
                                [ver.id]: e.target.value,
                              }))
                            }
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleReview(ver.id, 'APPROVE')}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              اعتماد الكورس
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReview(ver.id, 'REQUEST_CHANGES')}
                            >
                              طلب تعديلات
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleReview(ver.id, 'REJECT')}
                            >
                              رفض
                            </Button>
                            {ver.status === 'APPROVED' && (
                              <Button
                                variant="gold"
                                size="sm"
                                onClick={() => handlePublish(ver.id)}
                              >
                                نشر فوري للطلاب
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Full Courses Management */}
            <div className="space-y-4 pt-2 border-t border-bosla-line">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-bosla-ink">
                    إدارة جميع الكورسات ({filteredCourses.length} من {allCourses.length})
                  </h2>
                  <p className="text-xs text-bosla-muted">
                    أنشئ كورساً جديداً، عدّل بياناته، افتح محرر الدروس، أو تحكم في نشره وإيقافه
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="h-4 w-4 text-[#A9B1E0] absolute top-3.5 start-3 pointer-events-none" />
                    <input
                      type="search"
                      aria-label="بحث في الكورسات"
                      placeholder="ابحث باسم الكورس أو المدرب..."
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      className="min-h-[44px] w-60 rounded-xl border border-[#22307A] bg-[#0B1440] ps-9 pe-3 text-sm text-[#EEF0FF] placeholder:text-[#A9B1E0]/70 focus:border-[#8CA2FF] focus:outline-none"
                    />
                  </div>
                  <select
                    aria-label="تصفية حسب الحالة"
                    value={courseStatusFilter}
                    onChange={(e) => setCourseStatusFilter(e.target.value)}
                    className="min-h-[44px] rounded-xl border border-[#22307A] bg-[#0B1440] px-3 text-sm font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
                  >
                    <option value="ALL">جميع الحالات</option>
                    <option value="PUBLISHED">منشور للطلاب</option>
                    <option value="DRAFT">مسودة</option>
                    <option value="SUBMITTED_FOR_REVIEW">قيد المراجعة</option>
                    <option value="UNPUBLISHED">موقوف</option>
                    <option value="ARCHIVED">مؤرشف</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadCsv(
                        'bosla-courses',
                        ['المعرف', 'العنوان', 'الرابط', 'الحالة', 'المدرب', 'التخصص', 'مجاني', 'الطلاب'],
                        filteredCourses.map((c) => [
                          c.id,
                          c.publishedVersion?.titleAr || c.draftVersion?.titleAr || c.slug,
                          c.slug,
                          c.status,
                          c.instructor?.fullName || '',
                          c.category?.nameAr || '',
                          c.isFree ? 'نعم' : 'لا',
                          c._count?.enrollments ?? 0,
                        ]),
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                    تصدير CSV
                  </Button>
                </div>
              </div>

              {selectedCourseIds.length > 0 && (
                <Card className="p-3.5 border-[#8CA2FF]/45 bg-[#0B1440] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#8CA2FF]">
                    تم تحديد {selectedCourseIds.length} كورس للإجراء الجماعي:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => void handleBulkCourseAction('PUBLISH')}
                    >
                      نشر المحدد
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleBulkCourseAction('UNPUBLISH')}
                    >
                      إيقاف نشر المحدد
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void handleBulkCourseAction('ARCHIVE')}
                    >
                      <Archive className="h-3.5 w-3.5" />
                      أرشفة المحدد
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCourseIds([])}
                    >
                      إلغاء التحديد
                    </Button>
                  </div>
                </Card>
              )}

              {filteredCourses.length === 0 ? (
                <Card className="p-8 text-center space-y-3">
                  <BookOpen className="h-8 w-8 mx-auto text-bosla-muted" />
                  <p className="text-sm font-bold text-bosla-muted">لا توجد كورسات مطابقة لبحثك.</p>
                  <Button variant="primary" size="sm" onClick={() => setCreateCourseOpen(true)}>
                    <BookPlus className="h-4 w-4" />
                    إضافة كورس جديد
                  </Button>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredCourses.map((c) => {
                    const st = getCourseStatusMeta(c.status);
                    const ver = c.publishedVersion || c.draftVersion;
                    const title = ver?.titleAr || c.slug;
                    const canDelete =
                      (c._count?.enrollments ?? 0) === 0 &&
                      (c._count?.certificates ?? 0) === 0;
                    const confirmingDelete = confirmDeleteCourseId === c.id;
                    const isChecked = selectedCourseIds.includes(c.id);

                    return (
                      <Card key={c.id} className="p-5 space-y-4 bosla-card-hover">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="checkbox"
                              aria-label={`تحديد كورس ${title}`}
                              checked={isChecked}
                              onChange={(e) =>
                                setSelectedCourseIds((prev) =>
                                  e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                                )
                              }
                              className="mt-1 h-4 w-4 shrink-0 accent-[#7C95FF] cursor-pointer"
                            />
                            {ver?.thumbnailUrl ? (
                              <img
                                src={ver.thumbnailUrl}
                                alt={title}
                                className="h-16 w-24 shrink-0 rounded-xl object-cover border border-bosla-line"
                              />
                            ) : (
                              <div className="h-16 w-24 shrink-0 rounded-xl bg-[#0B1440] border border-[#22307A] flex items-center justify-center text-[#8CA2FF]">
                                <BookOpen className="h-6 w-6" />
                              </div>
                            )}
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge tone={st.tone}>{st.label}</Badge>
                                <Badge tone={c.isFree ? 'success' : 'neutral'}>
                                  {c.isFree ? 'مجاني' : getDifficultyLabel(c.difficulty)}
                                </Badge>
                                {Number(c.featuredOrder ?? 0) > 0 && (
                                  <Badge tone="info">أولوية #{c.featuredOrder}</Badge>
                                )}
                              </div>
                              <h3 className="text-sm font-extrabold text-bosla-ink line-clamp-2">
                                {title}
                              </h3>
                              <p className="text-[11px] text-bosla-muted">
                                المدرب: {c.instructor?.fullName || 'غير محدد'}
                                {c.category?.nameAr ? ` • ${c.category.nameAr}` : ''} •{' '}
                                {c._count?.enrollments ?? 0} طالب مسجل
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/instructor/courses/${c.id}`}>
                            <Button variant="primary" size="sm">
                              <ExternalLink className="h-3.5 w-3.5" />
                              فتح محرر المنهج
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditCoursePanel(c)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            تعديل البيانات
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDuplicateCourse(c.id)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            نسخ
                          </Button>
                          {c.status !== 'PUBLISHED' ? (
                            <Button
                              variant="gold"
                              size="sm"
                              onClick={() => void handleDirectCoursePublish(c.id)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              نشر فوري
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleUnpublish(c.id)}
                            >
                              إيقاف النشر
                            </Button>
                          )}

                          {canDelete &&
                            (confirmingDelete ? (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => void handleDeleteCourse(c.id)}
                                >
                                  تأكيد الحذف
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmDeleteCourseId(null)}
                                >
                                  إلغاء
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDeleteCourseId(c.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-[#FF9CAA]" />
                                حذف
                              </Button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#8CA2FF]/15">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="datetime-local"
                              dir="ltr"
                              aria-label={`موعد جدولة نشر ${title}`}
                              className="!w-48 min-h-[38px] rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] px-2.5 text-xs text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
                              value={scheduleTimes[c.id] || ''}
                              onChange={(e) =>
                                setScheduleTimes((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="!min-h-[38px]"
                              onClick={() => void handleSchedule(c.id)}
                            >
                              <CalendarClock className="h-3.5 w-3.5" />
                              جدولة النشر
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}


        {activeSection === 'media' && <AdminMediaControlPanel infrastructure={overview?.infrastructure} />}

        {activeSection === 'users' && (
          <div className="space-y-8">
            {selectedUserId ? (
              <AdminUserDetailPanel
                userId={selectedUserId}
                currentAdminId={user?.id}
                plans={plans}
                courses={allCourses}
                paths={paths}
                diplomas={diplomas}
                onClose={() => setSelectedUserId(null)}
                onGlobalRefresh={loadEverything}
              />
            ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-bosla-ink">
                إدارة الحسابات والأدوار ({filteredUsers.length})
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="h-4 w-4 text-bosla-muted absolute top-3 start-3 pointer-events-none" />
                  <input
                    type="search"
                    aria-label="بحث في الحسابات"
                    placeholder="ابحث بالاسم أو الهاتف..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="min-h-[44px] w-56 rounded-xl border border-[#22307A] bg-[#0B1440] ps-9 pe-3 text-sm text-[#EEF0FF] placeholder:text-[#A9B1E0]/70 focus:border-[#8CA2FF] focus:outline-none"
                  />
                </div>
                <select
                  aria-label="تصفية حسب الدور"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-[#22307A] bg-[#0B1440] px-3 text-xs font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
                >
                  <option value="ALL">جميع الأدوار ({users.length})</option>
                  {ALL_ASSIGNABLE_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={() => setCreateUserOpen(true)}>
                  <Plus className="h-4 w-4" />
                  إضافة مستخدم جديد
                </Button>
                <Button variant="primary" size="sm" onClick={() => setInstModalOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  إضافة مدرب جديد
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(
                      'bosla-users',
                      ['المعرف', 'الاسم', 'الهاتف', 'البريد', 'الدور', 'الحالة', 'تاريخ التسجيل'],
                      filteredUsers.map((u) => [
                        u.id,
                        u.fullName,
                        u.phoneE164 || '',
                        u.email || '',
                        u.role,
                        u.status,
                        formatDate(u.createdAt),
                      ]),
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  تصدير CSV
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden p-0 border-[#8CA2FF]/18 bg-[#09123A]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-start text-sm">
                  <thead>
                    <tr className="text-[#C5CEF9]">
                      <th className="py-3.5 px-4 text-start">الاسم</th>
                      <th className="py-3.5 px-4 text-start">الهاتف / البريد</th>
                      <th className="py-3.5 px-4 text-start">الدور</th>
                      <th className="py-3.5 px-4 text-start">الحالة</th>
                      <th className="py-3.5 px-4 text-start">التحكم السريع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-sm text-[#A9B1E0]">
                          لا توجد حسابات مطابقة لمعايير البحث والتصفية الحالية.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                      const uMeta = getUserStatusMeta(u.status);
                      return (
                        <tr key={u.id} className="hover:bg-[#13205E]/55 transition-colors">
                          <td className="py-3 px-4 font-bold text-[#EEF0FF] whitespace-nowrap">{u.fullName}</td>
                          <td className="py-3 px-4 text-[#A9B1E0] font-mono text-xs whitespace-nowrap" dir="ltr">
                            {u.phoneE164 || u.email || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge tone={getRoleBadgeTone(u.role)} className="bosla-admin-pill-nowrap">
                                {getRoleLabel(u.role)}
                              </Badge>
                              {(u.assignedUserRoles || [])
                                .map((a: any) => a.role?.code)
                                .filter((rc: string) => rc && rc !== u.role)
                                .map((rc: string) => (
                                  <Badge key={rc} tone={getRoleBadgeTone(rc)} className="bosla-admin-pill-nowrap">
                                    + {getRoleLabel(rc)}
                                  </Badge>
                                ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge tone={uMeta.tone} className="bosla-admin-pill-nowrap">
                              <span
                                aria-hidden="true"
                                className={`h-1.5 w-1.5 rounded-full ${
                                  uMeta.tone === 'success'
                                    ? 'bg-[#77E2B5]'
                                    : uMeta.tone === 'warning'
                                      ? 'bg-[#F5B94A]'
                                      : 'bg-[#FF9CAA]'
                                }`}
                              />
                              {uMeta.label}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <Button
                                variant="outline"
                                size="sm"
                                className="!min-h-[36px]"
                                onClick={() => setSelectedUserId(u.id)}
                              >
                                <UserCog className="h-3.5 w-3.5 text-[#8CA2FF]" />
                                إدارة 360°
                              </Button>
                              <select
                                aria-label={`تغيير دور ${u.fullName}`}
                                value={u.role}
                                disabled={u.id === user?.id}
                                onChange={(e) =>
                                  void handleUserRoleChange(u.id, e.target.value, u.status)
                                }
                                className="min-h-[36px] rounded-lg border border-[#8CA2FF]/20 bg-[#0B1440] px-2.5 text-xs font-bold text-[#EEF0FF] focus:border-[#8CA2FF] focus:outline-none"
                              >
                                {ALL_ASSIGNABLE_ROLES.map((r) => (
                                  <option key={r.code} value={r.code}>{r.label}</option>
                                ))}
                              </select>

                              {u.id !== user?.id &&
                                (u.status !== 'SUSPENDED' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="!min-h-[36px] !text-[#FF9CAA] hover:!bg-[#FF9CAA]/15"
                                    onClick={() => void handleUserRoleChange(u.id, u.role, 'SUSPENDED')}
                                  >
                                    تعليق
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="!min-h-[36px] !border-[#77E2B5]/40 !text-[#77E2B5]"
                                    onClick={() => void handleUserRoleChange(u.id, u.role, 'ACTIVE')}
                                  >
                                    تنشيط
                                  </Button>
                                ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          )}
            {hasPerm('rbac.manage') && (
              <AdminEnterpriseSuitePanel
                forcedSection="rbac"
                hideTopSubNav
                courses={allCourses}
              />
            )}
          </div>
        )}

        {/* TAB: LEARNING PATHS, DIPLOMAS, CATEGORIES & GRADING */}
        {activeSection === 'paths_diplomas' && (
          <div className="space-y-8">
            {/* Categories */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-bosla-ink">الأقسام والتخصصات</h2>
              <form onSubmit={handleCreateCategory} className="flex flex-wrap items-center gap-3">
                <input
                  className={`${inputClassName} !w-full sm:!w-56`}
                  placeholder="اسم القسم بالعربية"
                  value={catName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCatName(v);
                    if (!catSlugManual) setCatSlug(slugifyTitle(v, 'cat'));
                  }}
                  required
                />
                <input
                  dir="ltr"
                  className={`${inputClassName} !w-full sm:!w-48 font-mono text-xs`}
                  placeholder="slug-name"
                  value={catSlug}
                  onChange={(e) => {
                    setCatSlugManual(true);
                    setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                  }}
                  required
                />
                <Button type="submit" variant="primary" size="sm">
                  <Plus className="h-4 w-4" />
                  إضافة قسم
                </Button>
              </form>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="inline-flex items-center gap-2 rounded-full border border-[#8CA2FF]/35 bg-[#0B1440] px-3.5 py-1.5 text-xs font-bold text-[#EEF0FF]"
                  >
                    <span>
                      {cat.nameAr} ({cat._count?.courses ?? 0})
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCategory(cat.id)}
                      aria-label={`حذف قسم ${cat.nameAr}`}
                      className="text-[#FF9CAA] hover:text-white cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </Card>

            {/* Learning Paths */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-extrabold text-bosla-ink">
                  المسارات التعليمية ({paths.length})
                </h2>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingPath(null);
                    setPathModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  إنشاء مسار تعلم
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {paths.map((p) => {
                  const st = getCourseStatusMeta(p.status);
                  return (
                    <Card key={p.id} className="p-5 space-y-3 bosla-card-hover">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {p.thumbnailUrl ? (
                            <img
                              src={p.thumbnailUrl}
                              alt={`غلاف ${p.titleAr}`}
                              className="h-12 w-16 shrink-0 rounded-lg object-cover border border-bosla-line bg-bosla-bg"
                            />
                          ) : null}
                          <h3 className="text-base font-extrabold text-bosla-ink truncate">{p.titleAr}</h3>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <p className="text-xs text-bosla-muted">
                        يضم {p.courses?.length ?? 0} كورسات
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingPath(p);
                            setPathModalOpen(true);
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          تعديل المسار
                        </Button>
                        {p.status !== 'PUBLISHED' ? (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() =>
                              void apiFetch(`/admin/learning-paths/${p.id}/status`, {
                                method: 'POST',
                                body: JSON.stringify({ status: 'PUBLISHED' }),
                              }).then(loadEverything)
                            }
                          >
                            نشر المسار
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void apiFetch(`/admin/learning-paths/${p.id}/status`, {
                                method: 'POST',
                                body: JSON.stringify({ status: 'UNPUBLISHED' }),
                              }).then(loadEverything)
                            }
                          >
                            إيقاف النشر
                          </Button>
                        )}
                        {confirmDeletePathId === p.id ? (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void handleDeletePath(p.id)}
                            >
                              تأكيد حذف المسار
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeletePathId(null)}
                            >
                              إلغاء
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeletePathId(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[#FF9CAA]" />
                            حذف
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Diplomas & Submissions */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-extrabold text-[#EEF0FF] flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-[#F5B94A]" />
                  الدبلومات التطبيقية وتقييم المشاريع ({diplomas.length})
                </h2>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => {
                    setEditingDiploma(null);
                    setDipModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  إنشاء دبلومة جديدة
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {diplomas.map((d) => {
                  const st = getCourseStatusMeta(d.status);
                  return (
                    <Card key={d.id} className="p-5 space-y-3 bosla-card-hover">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-extrabold text-bosla-ink">
                          {d.titleAr} ({d.totalHours} ساعة)
                        </h3>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <p className="text-xs text-bosla-muted">
                        تضم {d.courses?.length ?? 0} كورسات تدريبية
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingDiploma(d);
                            setDipModalOpen(true);
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          تعديل الدبلومة
                        </Button>
                        {d.status !== 'PUBLISHED' ? (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() =>
                              void apiFetch(`/admin/diplomas/${d.id}/status`, {
                                method: 'POST',
                                body: JSON.stringify({ status: 'PUBLISHED' }),
                              }).then(loadEverything)
                            }
                          >
                            نشر الدبلومة
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void apiFetch(`/admin/diplomas/${d.id}/status`, {
                                method: 'POST',
                                body: JSON.stringify({ status: 'UNPUBLISHED' }),
                              }).then(loadEverything)
                            }
                          >
                            إيقاف النشر
                          </Button>
                        )}
                        {confirmDeleteDiplomaId === d.id ? (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void handleDeleteDiploma(d.id)}
                            >
                              تأكيد حذف الدبلومة
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteDiplomaId(null)}
                            >
                              إلغاء
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteDiplomaId(d.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[#FF9CAA]" />
                            حذف
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {submissions.length > 0 && (
                <Card className="p-5 space-y-3">
                  <h3 className="text-base font-extrabold text-bosla-ink">
                    تسليمات مشاريع الدبلومات ({submissions.length})
                  </h3>
                  {submissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-3.5 text-xs"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <p className="font-extrabold text-bosla-ink">
                          {sub.user?.fullName} — {sub.assessment?.diploma?.titleAr}
                        </p>
                        <p className="text-bosla-muted line-clamp-2">{sub.submissionText}</p>
                        {sub.feedbackAr && (
                          <p className="text-bosla-tealText font-semibold">
                            ملاحظات التقييم: {sub.feedbackAr}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.scorePercent !== null && (
                          <Badge tone={sub.passed ? 'success' : 'danger'}>
                            النتيجة: {sub.scorePercent}% ({sub.passed ? 'ناجح' : 'لم يجتز'})
                          </Badge>
                        )}
                        <Button
                          variant={sub.scorePercent === null ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setGradingSubmission(sub)}
                        >
                          {sub.scorePercent === null ? 'مراجعة وتقييم المشروع' : 'تعديل التقييم'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          </div>
        )}


        {/* TAB: MEMBERSHIPS & SUBSCRIPTIONS */}
        {activeSection === 'memberships' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-bosla-ink">
                خطط العضوية والمحتوى المشمول ({plans.length})
              </h2>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingPlan(null);
                  setPlanModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                إضافة باقة عضوية جديدة
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {plans.map((p) => {
                const rev = p.revisions?.[0];
                return (
                  <Card key={p.id} className="p-5 space-y-3 bosla-card-hover">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-extrabold text-bosla-ink">{p.nameAr}</h3>
                      <div className="flex items-center gap-1.5">
                        <Badge tone="info">{getIntervalLabel(p.interval)}</Badge>
                        <Badge tone={p.isActive ? 'success' : 'neutral'}>
                          {p.isActive ? 'مفعّلة' : 'موقوفة'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-2xl font-extrabold text-[#EEF0FF]">
                      {formatEgp(p.priceCents)}
                    </p>
                    <p className="text-xs text-bosla-muted">
                      المشتركون: {p._count?.subscriptions ?? 0} • تشمل {rev?.courses?.length ?? 0} كورس،{' '}
                      {rev?.learningPaths?.length ?? 0} مسار، و{rev?.diplomas?.length ?? 0} دبلومة
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPlan(p);
                        setPlanModalOpen(true);
                      }}
                    >
                      تعديل السعر والمحتوى المشمول
                    </Button>
                  </Card>
                );
              })}
            </div>

            {paymentsData && (
              <div className="space-y-6">
                <Card className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-extrabold text-bosla-ink">
                      الاشتراكات النشطة والسابقة ({(paymentsData.subscriptions ?? []).length})
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        downloadCsv(
                          'bosla-subscriptions',
                          ['المشترك', 'الهاتف', 'الباقة', 'الحالة', 'تاريخ الانتهاء'],
                          (paymentsData.subscriptions ?? []).map((s: any) => [
                            s.user?.fullName || '',
                            s.user?.phoneE164 || '',
                            s.plan?.nameAr || '',
                            s.status,
                            formatDate(s.currentPeriodEnd),
                          ]),
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      تصدير الاشتراكات CSV
                    </Button>
                  </div>
                  {(paymentsData.subscriptions ?? []).length === 0 ? (
                    <p className="text-xs text-bosla-muted">لا توجد اشتراكات مسجلة حتى الآن.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {(paymentsData.subscriptions ?? []).slice(0, 25).map((sub: any) => (
                        <div
                          key={sub.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-3"
                        >
                          <div>
                            <p className="font-extrabold text-[#EEF0FF]">
                              {sub.user?.fullName} — {sub.plan?.nameAr}
                            </p>
                            <p className="text-bosla-muted">
                              <span dir="ltr">{sub.user?.phoneE164}</span> • ينتهي:{' '}
                              {formatDate(sub.currentPeriodEnd)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={sub.status === 'ACTIVE' ? 'success' : 'neutral'}>
                              {sub.status}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleUpdateSubscriptionStatus(sub.id, 'ACTIVE', 30)}
                            >
                              تمديد +30 يوم
                            </Button>
                            {sub.status !== 'CANCELLED' ? (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => void handleUpdateSubscriptionStatus(sub.id, 'CANCELLED')}
                              >
                                إلغاء
                              </Button>
                            ) : (
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => void handleUpdateSubscriptionStatus(sub.id, 'ACTIVE')}
                              >
                                إعادة تفعيل
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-extrabold text-bosla-ink">
                      أحدث معاملات الدفع ({(paymentsData.payments ?? []).length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowWebhooks((v) => !v)}
                      >
                        <Sliders className="h-4 w-4" />
                        {showWebhooks ? 'إخفاء سجل Webhooks' : `فحص سجل Webhooks (${(paymentsData.webhooks ?? []).length})`}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadCsv(
                            'bosla-payments',
                            ['العميل', 'الباقة / الفعالية', 'رقم الطلب', 'المبلغ (جنيه)', 'الحالة'],
                            (paymentsData.payments ?? []).map((tx: any) => [
                              tx.user?.fullName || '',
                              tx.plan?.nameAr || tx.event?.titleAr || '',
                              tx.merchantOrderId,
                              (tx.amountCents / 100).toFixed(2),
                              tx.status,
                            ]),
                          )
                        }
                      >
                        <Download className="h-4 w-4" />
                        تصدير المدفوعات CSV
                      </Button>
                    </div>
                  </div>
                  {(paymentsData.payments ?? []).length === 0 ? (
                    <p className="text-xs text-bosla-muted">لا توجد معاملات دفع مسجلة حتى الآن.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {(paymentsData.payments ?? []).slice(0, 20).map((tx: any) => {
                        const pMeta = getPaymentStatusMeta(tx.status);
                        return (
                          <div
                            key={tx.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-bosla-line p-3"
                          >
                            <span>
                              <strong>{tx.user?.fullName}</strong> — {tx.plan?.nameAr || tx.event?.titleAr || 'معاملة إلكترونية'} (
                              <code dir="ltr">{tx.merchantOrderId}</code>)
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{formatEgp(tx.amountCents)}</span>
                              <Badge tone={pMeta.tone}>{pMeta.label}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showWebhooks && (
                    <div className="pt-3 border-t border-bosla-line space-y-2 text-xs">
                      <p className="font-extrabold text-[#8CA2FF]">
                        سجل استجابات بوابة الدفع (Webhook Events)
                      </p>
                      {(paymentsData.webhooks ?? []).slice(0, 20).map((wh: any) => (
                        <div
                          key={wh.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#22307A] bg-[#0B1440] px-3 py-2"
                        >
                          <span dir="ltr" className="font-mono text-[#A9B1E0]">
                            {wh.provider} • {wh.eventType} • {wh.externalId}
                          </span>
                          <Badge tone={wh.processed ? 'success' : 'warning'}>
                            {wh.processed ? 'معالج' : 'معلق'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}


        {activeSection === 'analytics' && (
          <AdminEnterpriseSuitePanel
            forcedSection="analytics"
            hideTopSubNav
            courses={allCourses}
          />
        )}

        {activeSection === 'audit' && (
          <div className="space-y-8">
            <AdminEnterpriseSuitePanel
              forcedSection="audit"
              hideTopSubNav
              courses={allCourses}
            />
            <Card className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-bosla-ink">
                  سجل العمليات والأحداث الإدارية ({auditLogs.length})
                </h2>
                <input
                  type="search"
                  aria-label="تصفية سجل الأحداث"
                  placeholder="صفّ بالعملية أو اسم المنفذ..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="min-h-[40px] w-60 rounded-xl border border-[#22307A] bg-[#0B1440] px-3 text-xs text-[#EEF0FF] placeholder:text-[#A9B1E0]/70 focus:border-[#8CA2FF] focus:outline-none"
                />
              </div>
              <div className="space-y-1.5 max-h-96 overflow-y-auto text-xs">
                {auditLogs
                  .filter((log) => {
                    if (!auditSearch.trim()) return true;
                    const q = auditSearch.trim().toLowerCase();
                    return (
                      (log.action || '').toLowerCase().includes(q) ||
                      (log.actor?.fullName || '').toLowerCase().includes(q) ||
                      (log.entityType || '').toLowerCase().includes(q)
                    );
                  })
                  .map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[#8CA2FF]/12 py-2.5 px-1 tabular-nums"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <code dir="ltr" className="rounded bg-[#080F33] px-1.5 py-0.5 font-mono font-bold text-[#8CA2FF]">{log.action}</code>
                      <span>{log.actor?.fullName || 'النظام'} ({log.entityType})</span>
                    </span>
                    <span className="text-[#A9B1E0]">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeSection === 'lms' && (
          <AdminEnterpriseSuitePanel
            forcedSection="lms"
            hideTopSubNav
            courses={allCourses}
          />
        )}

        {activeSection === 'events' && (
          <AdminOfflineEventsPanel
            events={offlineEvents}
            users={users}
            onReload={loadEverything}
          />
        )}

        {activeSection === 'communities' && <AdminCommunitiesPanel />}

        {activeSection === 'instructor_collab' && (
          <AdminInstructorCollabPanel
            allCourses={allCourses}
            pushToast={pushToast}
          />
        )}

        {activeSection === 'support' && (
          <div className="space-y-8">
            {hasPerm('membership.grant') && (
              <AdminSupportManualGrantPanel onGranted={loadEverything} />
            )}
            {(hasPerm('support.manage') || hasPerm('users.manage')) && (
              <>
            <Card className="p-6 space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#EEF0FF]">
                <ShieldAlert className="h-5 w-5 text-[#FF9CAA]" />
                طلبات مساعدة استرداد الحساب ({recoveryRequests.length})
              </h2>
              {recoveryRequests.length === 0 ? (
                <p className="text-xs text-bosla-muted">لا توجد طلبات استرداد معلقة.</p>
              ) : (
                <div className="space-y-3">
                  {recoveryRequests.map((req) => {
                    const rMeta = getRecoveryStatusMeta(req.status);
                    return (
                      <div
                        key={req.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bosla-line p-4 text-xs"
                      >
                        <div>
                          <p className="font-extrabold text-bosla-ink">
                            {req.fullName} — <span dir="ltr">{req.phoneE164}</span>
                          </p>
                          <p className="text-bosla-muted mt-1">{req.notes}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={rMeta.tone}>{rMeta.label}</Badge>
                          {req.status === 'PENDING' && (
                            <>
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => void handleResolveRecovery(req.id, 'APPROVED')}
                              >
                                اعتماد وإصدار رمز تعيين
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => void handleResolveRecovery(req.id, 'REJECTED')}
                              >
                                رفض
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

              </>
            )}
            {hasPerm('support.manage') && (
              <AdminEnterpriseSuitePanel
                forcedSection="support"
                hideTopSubNav
                courses={allCourses}
              />
            )}
          </div>
        )}

        {activeSection === 'finance' && (
          <div className="space-y-8">
            {(isFullAdmin || hasPerm('instructor.finance.manage')) && (
              <AdminFinanceProgramsPanel
                courses={allCourses}
                paths={paths}
                diplomas={diplomas}
                users={users}
                onReload={loadEverything}
              />
            )}
            {(isFullAdmin || hasPerm('finance.dashboard.read') || hasPerm('orders.read')) && (
              <AdminEnterpriseSuitePanel
                forcedSection="finance"
                hideTopSubNav
                courses={allCourses}
              />
            )}
          </div>
        )}

        {activeSection === 'sellers' && (
          <AdminEnterpriseSuitePanel
            forcedSection="sellers"
            hideTopSubNav
            courses={allCourses}
          />
        )}

        {activeSection === 'coupons' && (
          <AdminCouponsAndTemplatesPanel
            mode="coupons"
            courses={allCourses}
            paths={paths}
            diplomas={diplomas}
            plans={plans}
          />
        )}

        {activeSection === 'crm' && (
          <div className="space-y-8">
            <AdminCrmProfessionalPanel courses={allCourses} />
            <AdminEnterpriseSuitePanel
              forcedSection="crm"
              hideTopSubNav
              courses={allCourses}
            />
          </div>
        )}

        {activeSection === 'b2b' && (
          <AdminEnterpriseSuitePanel
            forcedSection="b2b"
            hideTopSubNav
            courses={allCourses}
          />
        )}

        {activeSection === 'certificates' && (
          <div className="space-y-8">
            <AdminCouponsAndTemplatesPanel
              mode="templates"
              courses={allCourses}
              paths={paths}
              diplomas={diplomas}
              plans={plans}
            />
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-bosla-ink">
                الشهادات الصادرة ({certificates.length})
              </h2>
              <div className="space-y-2 text-xs">
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex flex-wrap items-center justify-between rounded-xl border border-bosla-line p-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold">{cert.recipientNameAr}</p>
                        <Badge
                          tone={
                            cert.kind === 'ACCREDITED_PROGRAM'
                              ? 'success'
                              : cert.kind === 'COMPETENCY'
                                ? 'purple'
                                : 'neutral'
                          }
                        >
                          {cert.kind === 'ACCREDITED_PROGRAM'
                            ? 'شهادة برنامج معتمد'
                            : cert.kind === 'COMPETENCY'
                              ? 'شهادة تدريب مهني وكفاءة'
                              : 'شهادة إتمام وحضور'}
                        </Badge>
                      </div>
                      <p className="text-bosla-muted">
                        {cert.titleAr} • <code dir="ltr">{cert.certificateCode}</code>
                      </p>
                    </div>
                    {cert.revokedAt ? (
                      <div className="flex items-center gap-2">
                        <Badge tone="danger">ملغاة</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void apiFetch(`/admin/certificates/${cert.id}/restore`, {
                              method: 'POST',
                            }).then(loadEverything)
                          }
                        >
                          استعادة الشهادة
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void apiFetch(`/admin/certificates/${cert.id}/revoke`, {
                            method: 'POST',
                          }).then(loadEverything)
                        }
                      >
                        إلغاء الشهادة
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
            <AdminRecommendationsPanel />
          </div>
        )}

        {activeSection === 'live_editor' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={liveArea === 'editor' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setLiveArea('editor')}
              >
                محرر الموقع المباشر (Live Editor)
              </Button>
              <Button
                variant={liveArea === 'sections' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setLiveArea('sections')}
              >
                إظهار وإخفاء الأقسام العامة
              </Button>
            </div>
            {liveArea === 'editor' ? (
              <AdminLiveSiteEditorPanel
                onNavigateToPlansManagement={() => navigateToSection('memberships')}
              />
            ) : (
              <AdminSectionVisibilityPanel />
            )}
          </div>
        )}

        {activeSection === 'cms_leads' && (
          <div className="space-y-8">
            <AdminCmsExtrasPanel />
            <AdminCmsSettingsPanel courses={allCourses} />
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-bosla-ink">
                صفحات الموقع التعريفية ({cmsPages.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                {cmsPages.map((pg) => (
                  <div
                    key={pg.id}
                    className="rounded-xl border border-bosla-line p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-extrabold text-bosla-ink">{pg.titleAr}</p>
                        <Badge tone={pg.isPublished ? 'success' : 'neutral'}>
                          {pg.isPublished ? 'منشورة' : 'مخفية'}
                        </Badge>
                      </div>
                      <p dir="ltr" className="font-mono text-bosla-muted mt-1">
                        /{pg.slug}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPage(pg)}
                    >
                      <FileEdit className="h-3.5 w-3.5" />
                      تعديل بيانات الصفحة
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        )}

        {activeSection === 'settings' && (
          <div className="space-y-8">
            {settingsFocus !== 'paymob' && <AdminGoogleAndMailSettingsPanel mode="both" />}
            <AdminPaymobSettingsPanel />
          </div>
        )}
          </>
        )}

        {/* Modular Admin Course Create Modal */}
        <AdminCreateCourseModal
          open={createCourseOpen}
          onClose={() => setCreateCourseOpen(false)}
          categories={categories}
          users={users}
          onCreated={async (created, openEditorAfter) => {
            if (openEditorAfter && created?.id) {
              router.push(`/instructor/courses/${created.id}`);
              return;
            }
            await loadEverything();
            navigateToSection('editorial');
          }}
        />

        {/* Create Instructor Modal */}
        <NativeModal
          open={instModalOpen}
          onClose={() => setInstModalOpen(false)}
          title="إنشاء حساب مدرب جديد"
        >
          <form onSubmit={handleCreateInstructor} className="space-y-4">
            <Field id="ai-name" label="الاسم الكامل" required>
              <input
                id="ai-name"
                className={inputClassName}
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="ai-phone" label="رقم الهاتف المحمول" required>
                <input
                  id="ai-phone"
                  dir="ltr"
                  className={inputClassName}
                  value={instPhone}
                  onChange={(e) => setInstPhone(e.target.value)}
                  placeholder="01012345678"
                  required
                />
              </Field>
              <Field id="ai-email" label="البريد الإلكتروني (اختياري)">
                <input
                  id="ai-email"
                  type="email"
                  dir="ltr"
                  className={inputClassName}
                  value={instEmail}
                  onChange={(e) => setInstEmail(e.target.value)}
                />
              </Field>
            </div>
            <Field id="ai-head" label="التخصص / المسمى الوظيفي">
              <input
                id="ai-head"
                className={inputClassName}
                value={instHeadline}
                onChange={(e) => setInstHeadline(e.target.value)}
              />
            </Field>
            <Field id="ai-pass" label="كلمة المرور المؤقتة" required>
              <PasswordInput
                id="ai-pass"
                value={instPassword}
                onChange={(e) => setInstPassword(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" variant="primary" className="w-full">
              إنشاء حساب المدرب
            </Button>
          </form>
        </NativeModal>

        {/* Modular Path, Diploma, Grading, Membership & Page Modals */}
        <AdminPathFormModal
          open={pathModalOpen}
          editingPath={editingPath}
          onClose={() => {
            setPathModalOpen(false);
            setEditingPath(null);
          }}
          allCourses={allCourses}
          onSaved={loadEverything}
        />

        <AdminDiplomaFormModal
          open={dipModalOpen}
          editingDiploma={editingDiploma}
          onClose={() => {
            setDipModalOpen(false);
            setEditingDiploma(null);
          }}
          allCourses={allCourses}
          onSaved={loadEverything}
        />

        <AdminGradeSubmissionModal
          submission={gradingSubmission}
          onClose={() => setGradingSubmission(null)}
          onGraded={loadEverything}
        />

        <AdminMembershipPlanModal
          open={planModalOpen}
          plan={editingPlan}
          onClose={() => {
            setPlanModalOpen(false);
            setEditingPlan(null);
          }}
          allCourses={allCourses}
          paths={paths}
          diplomas={diplomas}
          onSaved={loadEverything}
        />

        <AdminCmsPageModal
          page={editingPage}
          onClose={() => setEditingPage(null)}
          onSaved={loadEverything}
        />

        <AdminCreateUserModal
          open={createUserOpen}
          onClose={() => setCreateUserOpen(false)}
          onCreated={loadEverything}
        />

        <AdminCommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          items={commandItems}
        />
      </div>
    </DashboardShell>
  );
}
