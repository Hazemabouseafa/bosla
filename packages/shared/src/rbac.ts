/**
 * Enterprise Fine-Grained RBAC Definitions, Roles & Explicit Permission Matrix
 */

export const ALL_SYSTEM_ROLES = [
  'SUPER_ADMIN',
  'ADMIN', // Backward-compatible alias for Super Admin / legacy seeded admins
  'ACADEMY_MANAGER',
  'TRAINING_COORDINATOR',
  'INSTRUCTOR',
  'FINANCE_OFFICER',
  'STUDENT',
  'AFFILIATE_SELLER',
  'SUPPORT',
] as const;

export type SystemRoleCode = (typeof ALL_SYSTEM_ROLES)[number];

export const PERMISSION_CODES = [
  // Platform & RBAC
  'rbac.manage',
  'audit.read',
  'settings.manage',

  // Academic & Operations
  'courses.manage',
  'courses.publish',
  'courses.teach_assigned',
  'training.coordinate',
  'attendance.manage',
  'lms.grade',
  'certificates.issue',
  'certificates.revoke',
  'events.manage',
  'community.moderate',

  // E-Commerce & Financial Engine
  'orders.read',
  'orders.manual_payment',
  'orders.refund',
  'payments.allocate_manual',
  'finance.dashboard.read',
  'finance.expenses.manage',
  'finance.period.close',
  'finance.reconcile',
  'instructor.finance.manage',

  // Sellers & Commissions
  'sellers.manage',
  'sellers.portal',
  'commissions.rules.manage',
  'commissions.approve',
  'settlements.create',
  'settlements.approve', // Maker-Checker enforced separately
  'settlements.payout',

  // CRM, B2B & Support
  'crm.manage',
  'b2b.manage',
  'b2b.org_admin',
  'support.manage',

  // Student Learning
  'learning.access',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const ROLE_METADATA: Record<
  SystemRoleCode,
  { nameAr: string; descriptionAr: string; isAdminPortalRole: boolean }
> = {
  SUPER_ADMIN: {
    nameAr: 'مدير النظام الأعلى (Super Admin)',
    descriptionAr: 'تحكم كامل بالمنصة والأدوار والصلاحيات والإعدادات الحساسة.',
    isAdminPortalRole: true,
  },
  ADMIN: {
    nameAr: 'إدارة المنصة (Admin)',
    descriptionAr: 'صلاحيات إدارية شاملة متوافقة مع الحسابات الأساسية.',
    isAdminPortalRole: true,
  },
  ACADEMY_MANAGER: {
    nameAr: 'مدير الأكاديمية (Academy Manager)',
    descriptionAr: 'إدارة العمليات الأكاديمية والمحتوى والمدربين واعتماد البائعين.',
    isAdminPortalRole: true,
  },
  TRAINING_COORDINATOR: {
    nameAr: 'منسق التدريب (Training Coordinator)',
    descriptionAr: 'إدارة الجدولة التدريبية والحضور والتسجيلات والفعاليات.',
    isAdminPortalRole: true,
  },
  INSTRUCTOR: {
    nameAr: 'مدرب / محاضر (Trainer)',
    descriptionAr: 'إدارة الكورسات المسندة والتقييمات والواجبات وكشف الحساب المستقل.',
    isAdminPortalRole: false,
  },
  FINANCE_OFFICER: {
    nameAr: 'مسؤول مالي (Finance Officer)',
    descriptionAr: 'إدارة المدفوعات والعمولات والتسويات والمصروفات والمطابقة المالية فقط.',
    isAdminPortalRole: true,
  },
  STUDENT: {
    nameAr: 'متدرب (Student)',
    descriptionAr: 'الوصول للمحتوى المصرح به والشهادات والتذاكر وطلبات الدعم.',
    isAdminPortalRole: false,
  },
  AFFILIATE_SELLER: {
    nameAr: 'بائع / مسوّق بالعمولة (Affiliate / Seller)',
    descriptionAr: 'الوصول لبوابة البائع والأكواد وروابط الإحالة والمبيعات والعمولات الخاصة به فقط.',
    isAdminPortalRole: false,
  },
  SUPPORT: {
    nameAr: 'خدمة العملاء والدعم (Support)',
    descriptionAr: 'إدارة التذاكر وطلبات الاسترداد والمساعدة دون صلاحية اعتماد أو صرف مالي.',
    isAdminPortalRole: true,
  },
};

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleCode, PermissionCode[]> = {
  SUPER_ADMIN: [...PERMISSION_CODES],
  ADMIN: [...PERMISSION_CODES],
  ACADEMY_MANAGER: [
    'audit.read',
    'courses.manage',
    'courses.publish',
    'training.coordinate',
    'attendance.manage',
    'lms.grade',
    'certificates.issue',
    'certificates.revoke',
    'events.manage',
    'community.moderate',
    'orders.read',
    'sellers.manage',
    'commissions.rules.manage',
    'crm.manage',
    'b2b.manage',
    'instructor.finance.manage',
    'support.manage',
    'learning.access',
  ],
  TRAINING_COORDINATOR: [
    'courses.manage',
    'training.coordinate',
    'attendance.manage',
    'lms.grade',
    'certificates.issue',
    'events.manage',
    'b2b.manage',
    'learning.access',
  ],
  INSTRUCTOR: ['courses.teach_assigned', 'attendance.manage', 'lms.grade', 'learning.access'],
  FINANCE_OFFICER: [
    'audit.read',
    'orders.read',
    'orders.manual_payment',
    'orders.refund',
    'payments.allocate_manual',
    'finance.dashboard.read',
    'finance.expenses.manage',
    'finance.period.close',
    'finance.reconcile',
    'instructor.finance.manage',
    'commissions.rules.manage',
    'commissions.approve',
    'settlements.create',
    'settlements.approve',
    'settlements.payout',
    'learning.access',
  ],
  AFFILIATE_SELLER: ['sellers.portal', 'learning.access'],
  SUPPORT: ['orders.read', 'support.manage', 'crm.manage', 'community.moderate', 'learning.access'],
  STUDENT: ['learning.access'],
};

export function resolvePermissionsFromRoles(roles: readonly SystemRoleCode[]): Set<PermissionCode> {
  const perms = new Set<PermissionCode>();
  for (const r of roles) {
    const list = DEFAULT_ROLE_PERMISSIONS[r] ?? [];
    for (const p of list) {
      perms.add(p);
    }
  }
  return perms;
}

/**
 * Checks whether a primary role or any assigned secondary role belongs to the
 * target role set. Treats `ADMIN` and `SUPER_ADMIN` symmetrically when either is
 * checked via `isAdminRole`.
 */
export function hasAnyRole(
  allowedRoles: readonly string[],
  primaryRole?: string | null,
  extraRoles?: readonly string[] | null,
): boolean {
  if (primaryRole && allowedRoles.includes(primaryRole)) return true;
  if (extraRoles?.some((r) => allowedRoles.includes(r))) return true;
  return false;
}

/**
 * Checks whether a user holds platform-wide admin authority (`ADMIN` or `SUPER_ADMIN`)
 * either as their primary role or in their resolved multi-role set.
 */
export function isAdminRole(
  primaryRole?: string | null,
  extraRoles?: readonly string[] | null,
): boolean {
  return hasAnyRole(['ADMIN', 'SUPER_ADMIN'], primaryRole, extraRoles);
}
