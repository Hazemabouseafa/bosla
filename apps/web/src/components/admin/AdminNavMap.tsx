import type { DashboardNavItem } from '@/components/layout/DashboardShell';
import type { SessionUser } from '@/lib/auth-context';
import React from 'react';
import {
  Award,
  BarChart3,
  BookCheck,
  Building2,
  CreditCard,
  Eye,
  FileSearch,
  FileText,
  Film,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Settings,
  Ticket,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';

export type AdminSectionKey =
  | 'overview'
  | 'analytics'
  | 'audit'
  | 'editorial'
  | 'paths_diplomas'
  | 'media'
  | 'lms'
  | 'events'
  | 'communities'
  | 'users'
  | 'instructor_collab'
  | 'support'
  | 'memberships'
  | 'finance'
  | 'sellers'
  | 'coupons'
  | 'crm'
  | 'b2b'
  | 'certificates'
  | 'live_editor'
  | 'cms_leads'
  | 'settings';

export interface AdminNavDescriptor {
  section: AdminSectionKey;
  href: string;
  label: string;
  group: string;
  breadcrumbGroup: string;
  requiredPerms?: string[];
  adminOnly?: boolean;
  icon: (opts: { queueCount: number; eventsCount: number; usersCount: number }) => React.ReactNode;
  badge?: (opts: { queueCount: number; eventsCount: number; usersCount: number }) => number | undefined;
}

export const ADMIN_NAV_DESCRIPTORS: AdminNavDescriptor[] = [
  {
    section: 'overview',
    href: '/admin',
    label: 'نظرة عامة والبنية',
    group: 'الرئيسية والتقارير',
    breadcrumbGroup: 'الرئيسية والتقارير',
    icon: () => <LayoutDashboard className="h-4 w-4" />,
  },
  {
    section: 'analytics',
    href: '/admin/analytics',
    label: 'التحليلات والتقارير التنفيذية',
    group: 'الرئيسية والتقارير',
    breadcrumbGroup: 'الرئيسية والتقارير',
    requiredPerms: ['audit.read'],
    icon: () => <BarChart3 className="h-4 w-4" />,
  },
  {
    section: 'audit',
    href: '/admin/audit',
    label: 'سجل التدقيق المالي والإداري',
    group: 'الرئيسية والتقارير',
    breadcrumbGroup: 'الرئيسية والتقارير',
    requiredPerms: ['audit.read'],
    icon: () => <FileSearch className="h-4 w-4" />,
  },
  {
    section: 'editorial',
    href: '/admin/courses',
    label: 'إدارة ومراجعة الكورسات',
    group: 'المحتوى الأكاديمي والبرامج',
    breadcrumbGroup: 'المحتوى الأكاديمي والبرامج',
    requiredPerms: ['courses.manage', 'courses.publish'],
    icon: () => <BookCheck className="h-4 w-4" />,
    badge: ({ queueCount }) => (queueCount > 0 ? queueCount : undefined),
  },
  {
    section: 'paths_diplomas',
    href: '/admin/programs',
    label: 'المسارات والدبلومات',
    group: 'المحتوى الأكاديمي والبرامج',
    breadcrumbGroup: 'المحتوى الأكاديمي والبرامج',
    requiredPerms: ['courses.manage'],
    icon: () => <Layers className="h-4 w-4" />,
  },
  {
    section: 'media',
    href: '/admin/media',
    label: 'مكتبة الوسائط والأصول',
    group: 'المحتوى الأكاديمي والبرامج',
    breadcrumbGroup: 'المحتوى الأكاديمي والبرامج',
    requiredPerms: ['courses.manage'],
    icon: () => <Film className="h-4 w-4" />,
  },
  {
    section: 'lms',
    href: '/admin/lms',
    label: 'الجلسات وبنك الأسئلة والواجبات',
    group: 'التدريب والفعاليات والمجتمعات',
    breadcrumbGroup: 'التدريب والفعاليات والمجتمعات',
    requiredPerms: ['training.coordinate', 'lms.grade'],
    icon: () => <FileText className="h-4 w-4" />,
  },
  {
    section: 'events',
    href: '/admin/events',
    label: 'الفعاليات الأوفلاين والحضور',
    group: 'التدريب والفعاليات والمجتمعات',
    breadcrumbGroup: 'التدريب والفعاليات والمجتمعات',
    requiredPerms: ['events.manage', 'training.coordinate'],
    icon: () => <Ticket className="h-4 w-4" />,
    badge: ({ eventsCount }) => (eventsCount > 0 ? eventsCount : undefined),
  },
  {
    section: 'communities',
    href: '/admin/communities',
    label: 'إدارة المجتمعات والبلاغات',
    group: 'التدريب والفعاليات والمجتمعات',
    breadcrumbGroup: 'التدريب والفعاليات والمجتمعات',
    requiredPerms: ['community.moderate'],
    icon: () => <MessageSquare className="h-4 w-4" />,
  },
  {
    section: 'users',
    href: '/admin/users',
    label: 'المستخدمون والصلاحيات 360°',
    group: 'المستخدمون والمدربون والدعم',
    breadcrumbGroup: 'المستخدمون والمدربون والدعم',
    requiredPerms: ['rbac.manage', 'users.manage'],
    adminOnly: false,
    icon: () => <Users className="h-4 w-4" />,
    badge: ({ usersCount }) => (usersCount > 0 ? usersCount : undefined),
  },
  {
    section: 'instructor_collab',
    href: '/admin/instructors/tasks',
    label: 'التواصل ومهام المدربين',
    group: 'المستخدمون والمدربون والدعم',
    breadcrumbGroup: 'المستخدمون والمدربون والدعم',
    requiredPerms: ['courses.manage', 'training.coordinate'],
    icon: () => <MessageSquare className="h-4 w-4" />,
  },
  {
    section: 'support',
    href: '/admin/support',
    label: 'مكتب الدعم ومنح العضوية',
    group: 'المستخدمون والمدربون والدعم',
    breadcrumbGroup: 'المستخدمون والمدربون والدعم',
    requiredPerms: ['support.manage', 'membership.grant'],
    icon: () => <LifeBuoy className="h-4 w-4" />,
  },
  {
    section: 'memberships',
    href: '/admin/memberships',
    label: 'العضويات والاشتراكات',
    group: 'العضويات والمبيعات والمالية',
    breadcrumbGroup: 'العضويات والمبيعات والمالية',
    requiredPerms: ['orders.read', 'settings.manage'],
    icon: () => <CreditCard className="h-4 w-4" />,
  },
  {
    section: 'finance',
    href: '/admin/finance',
    label: 'المالية والطلبات والتسويات',
    group: 'العضويات والمبيعات والمالية',
    breadcrumbGroup: 'العضويات والمبيعات والمالية',
    requiredPerms: ['finance.dashboard.read', 'orders.read', 'instructor.finance.manage'],
    icon: () => <Wallet className="h-4 w-4" />,
  },
  {
    section: 'sellers',
    href: '/admin/sellers',
    label: 'البائعون وقواعد العمولات',
    group: 'العضويات والمبيعات والمالية',
    breadcrumbGroup: 'العضويات والمبيعات والمالية',
    requiredPerms: ['sellers.manage', 'commissions.rules.manage', 'commissions.approve'],
    icon: () => <UserCheck className="h-4 w-4" />,
  },
  {
    section: 'coupons',
    href: '/admin/coupons',
    label: 'كوبونات الخصم والعروض',
    group: 'العضويات والمبيعات والمالية',
    breadcrumbGroup: 'العضويات والمبيعات والمالية',
    requiredPerms: ['courses.manage', 'orders.read'],
    icon: () => <Ticket className="h-4 w-4" />,
  },
  {
    section: 'crm',
    href: '/admin/crm',
    label: 'إدارة علاقات العملاء (CRM)',
    group: 'المؤسسات وعلاقات العملاء',
    breadcrumbGroup: 'المؤسسات وعلاقات العملاء',
    requiredPerms: ['crm.manage'],
    icon: () => <TrendingUp className="h-4 w-4" />,
  },
  {
    section: 'b2b',
    href: '/admin/b2b',
    label: 'المؤسسات والدفعات (B2B)',
    group: 'المؤسسات وعلاقات العملاء',
    breadcrumbGroup: 'المؤسسات وعلاقات العملاء',
    requiredPerms: ['b2b.manage', 'b2b.org_admin'],
    icon: () => <Building2 className="h-4 w-4" />,
  },
  {
    section: 'certificates',
    href: '/admin/certificates',
    label: 'الشهادات والقوالب والتوصيات',
    group: 'الشهادات والاعتماد والتوصيات',
    breadcrumbGroup: 'الشهادات والاعتماد والتوصيات',
    requiredPerms: ['certificates.issue', 'certificates.revoke', 'recommendations.manage'],
    icon: () => <Award className="h-4 w-4" />,
  },
  {
    section: 'live_editor',
    href: '/admin/live-editor',
    label: 'تخصيص الموقع (Live Editor)',
    group: 'الموقع والمحتوى والتسويق',
    breadcrumbGroup: 'الموقع والمحتوى والتسويق',
    requiredPerms: ['settings.manage'],
    icon: () => <Eye className="h-4 w-4" />,
  },
  {
    section: 'cms_leads',
    href: '/admin/cms',
    label: 'الشركاء والآراء والوظائف والمدربون',
    group: 'الموقع والمحتوى والتسويق',
    breadcrumbGroup: 'الموقع والمحتوى والتسويق',
    requiredPerms: ['settings.manage', 'careers.manage'],
    icon: () => <FileText className="h-4 w-4" />,
  },
  {
    section: 'settings',
    href: '/admin/settings',
    label: 'الإعدادات، Google، SMTP، وPaymob',
    group: 'الإعدادات والتكاملات',
    breadcrumbGroup: 'الإعدادات والتكاملات',
    requiredPerms: ['settings.manage'],
    icon: () => <Settings className="h-4 w-4" />,
  },
];

export function hasFullAdminAuthority(user: SessionUser | null): boolean {
  if (!user) return false;
  const roles = new Set([user.role, ...(user.roles || [])]);
  return roles.has('ADMIN') || roles.has('SUPER_ADMIN');
}

export function canAccessAdminSection(section: AdminSectionKey, user: SessionUser | null): boolean {
  if (!user) return false;
  if (hasFullAdminAuthority(user)) return true;
  if (section === 'overview') {
    const allowedPortalRoles = [
      'ACADEMY_MANAGER',
      'TRAINING_COORDINATOR',
      'FINANCE_OFFICER',
      'SUPPORT',
    ];
    const roles = [user.role, ...(user.roles || [])];
    return roles.some((r) => allowedPortalRoles.includes(r));
  }
  const desc = ADMIN_NAV_DESCRIPTORS.find((d) => d.section === section);
  if (!desc) return false;
  if (!desc.requiredPerms || desc.requiredPerms.length === 0) return true;
  const permSet = new Set(user.permissions || []);
  return desc.requiredPerms.some((p) => permSet.has(p));
}

export function buildAdminAccordionNavItems(params: {
  activeSection: AdminSectionKey;
  user: SessionUser | null;
  queueCount?: number;
  eventsCount?: number;
  usersCount?: number;
  onItemNavigate?: () => void;
}): DashboardNavItem[] {
  const counts = {
    queueCount: params.queueCount ?? 0,
    eventsCount: params.eventsCount ?? 0,
    usersCount: params.usersCount ?? 0,
  };

  return ADMIN_NAV_DESCRIPTORS.filter((d) => canAccessAdminSection(d.section, params.user)).map(
    (d) => ({
      id: d.section,
      label: d.label,
      group: d.group,
      href: d.href,
      active: params.activeSection === d.section,
      badge: d.badge?.(counts),
      icon: d.icon(counts),
      onClick: params.onItemNavigate,
    }),
  );
}

/**
 * Maps legacy /admin?tab=...&section=... links cleanly to dedicated /admin/... routes
 * while preserving unrelated query params (e.g., instructorId, section).
 */
export function resolveLegacyAdminRedirectUrl(searchParams: URLSearchParams): string | null {
  const legacyTab = searchParams.get('tab');
  if (!legacyTab || legacyTab === 'overview') return null;

  const extraParams = new URLSearchParams(searchParams.toString());
  extraParams.delete('tab');

  let targetPath = '/admin';
  switch (legacyTab) {
    case 'live_editor':
    case 'sections':
      targetPath = '/admin/live-editor';
      if (legacyTab === 'sections') extraParams.set('area', 'sections');
      break;
    case 'paymob_settings':
      targetPath = '/admin/settings';
      extraParams.set('section', 'paymob');
      break;
    case 'coupons_templates':
      targetPath = '/admin/coupons';
      break;
    case 'instructor_collab':
      targetPath = '/admin/instructors/tasks';
      break;
    case 'editorial':
      targetPath = '/admin/courses';
      break;
    case 'finance':
      targetPath = '/admin/finance';
      break;
    case 'media':
      targetPath = '/admin/media';
      break;
    case 'events':
      targetPath = '/admin/events';
      break;
    case 'communities':
      targetPath = '/admin/communities';
      break;
    case 'users':
      targetPath = '/admin/users';
      break;
    case 'paths_diplomas':
      targetPath = '/admin/programs';
      break;
    case 'memberships':
      targetPath = '/admin/memberships';
      break;
    case 'security_certs':
      targetPath = '/admin/certificates';
      break;
    case 'cms_leads':
      targetPath = '/admin/cms';
      break;
    case 'enterprise': {
      const sub = extraParams.get('section') || 'analytics';
      extraParams.delete('section');
      if (sub === 'rbac') targetPath = '/admin/users';
      else if (sub === 'sellers') targetPath = '/admin/sellers';
      else if (sub === 'finance') targetPath = '/admin/finance';
      else if (sub === 'crm') targetPath = '/admin/crm';
      else if (sub === 'b2b') targetPath = '/admin/b2b';
      else if (sub === 'lms') targetPath = '/admin/lms';
      else if (sub === 'support') targetPath = '/admin/support';
      else if (sub === 'audit') targetPath = '/admin/audit';
      else targetPath = '/admin/analytics';
      break;
    }
    default:
      return null;
  }

  const qs = extraParams.toString();
  return qs ? `${targetPath}?${qs}` : targetPath;
}
