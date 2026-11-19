export type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'purple';

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

const COURSE_STATUS_MAP: Record<string, StatusMeta> = {
  DRAFT: { label: 'مسودة قيد التجهيز', tone: 'neutral' },
  SUBMITTED_FOR_REVIEW: { label: 'قيد المراجعة الإدارية', tone: 'warning' },
  CHANGES_REQUESTED: { label: 'يتطلب تعديلات', tone: 'danger' },
  APPROVED: { label: 'معتمد وجاهز للنشر', tone: 'info' },
  PUBLISHED: { label: 'منشور للطلاب', tone: 'success' },
  SCHEDULED: { label: 'مجدول للنشر', tone: 'purple' },
  UNPUBLISHED: { label: 'موقوف عن العرض', tone: 'neutral' },
  ARCHIVED: { label: 'مؤرشف', tone: 'neutral' },
};

const USER_STATUS_MAP: Record<string, StatusMeta> = {
  ACTIVE: { label: 'حساب مفعّل', tone: 'success' },
  ENROLLMENT_PENDING: { label: 'بانتظار استكمال التفعيل', tone: 'warning' },
  LOCKED: { label: 'مقفل مؤقتاً', tone: 'danger' },
  SUSPENDED: { label: 'موقوف إدارياً', tone: 'danger' },
};

const PAYMENT_STATUS_MAP: Record<string, StatusMeta> = {
  PAID: { label: 'مدفوعة ومؤكدة', tone: 'success' },
  PENDING: { label: 'قيد الانتظار', tone: 'warning' },
  INITIATED: { label: 'تم بدء الدفع', tone: 'info' },
  FAILED: { label: 'عملية غير مكتملة', tone: 'danger' },
  CANCELLED: { label: 'ملغاة', tone: 'neutral' },
  REFUNDED: { label: 'مبلغ مسترد', tone: 'purple' },
};

const LEAD_STATUS_MAP: Record<string, StatusMeta> = {
  NEW: { label: 'طلب جديد', tone: 'info' },
  CONTACTED: { label: 'تم التواصل', tone: 'warning' },
  QUALIFIED: { label: 'فرصة مؤهلة', tone: 'purple' },
  CONVERTED: { label: 'تم التعاقد', tone: 'success' },
  CLOSED: { label: 'مغلق', tone: 'neutral' },
};

const RECOVERY_STATUS_MAP: Record<string, StatusMeta> = {
  PENDING: { label: 'طلب معلق', tone: 'warning' },
  APPROVED: { label: 'تمت الموافقة', tone: 'success' },
  REJECTED: { label: 'مرفوض', tone: 'danger' },
  COMPLETED: { label: 'تم الاسترداد', tone: 'success' },
};

const VIDEO_STATUS_MAP: Record<string, StatusMeta> = {
  READY: { label: 'جاهز للعرض', tone: 'success' },
  PROCESSING: { label: 'جاري تجهيز الفيديو', tone: 'warning' },
  UPLOADED: { label: 'في قائمة المعالجة', tone: 'info' },
  FAILED: { label: 'تعذرت المعالجة', tone: 'danger' },
};

export const USER_ROLE_LABELS: Record<string, string> = {
  STUDENT: 'طالب / متدرب',
  INSTRUCTOR: 'مدرب معتمد',
  ADMIN: 'مدير المنصة',
  SUPER_ADMIN: 'مدير النظام الأعلى',
  ACADEMY_MANAGER: 'مدير الأكاديمية',
  TRAINING_COORDINATOR: 'منسق التدريب',
  FINANCE_OFFICER: 'مسؤول مالي',
  AFFILIATE_SELLER: 'بائع / مسوّق بالعمولة',
  SUPPORT: 'خدمة العملاء والدعم',
};

export const COMMISSION_STATUS_MAP: Record<string, StatusMeta> = {
  ON_HOLD: { label: 'قيد الانتظار (14 يوماً)', tone: 'warning' },
  ELIGIBLE: { label: 'مؤهلة للاعتماد', tone: 'info' },
  APPROVED: { label: 'معتمدة للصرف', tone: 'purple' },
  PAID: { label: 'تم الصرف', tone: 'success' },
  DISPUTED: { label: 'معلّقة / قيد المراجعة', tone: 'danger' },
  REVERSED: { label: 'معكوسة (مستردة)', tone: 'neutral' },
};

export const SELLER_STATUS_MAP: Record<string, StatusMeta> = {
  PENDING: { label: 'قيد المراجعة', tone: 'warning' },
  CHANGES_REQUESTED: { label: 'مطلوب تعديلات', tone: 'info' },
  APPROVED: { label: 'بائع معتمد', tone: 'success' },
  REJECTED: { label: 'مرفوض', tone: 'danger' },
  SUSPENDED: { label: 'موقوف مؤقتاً', tone: 'danger' },
};

export const ORDER_STATUS_MAP: Record<string, StatusMeta> = {
  DRAFT: { label: 'مسودة', tone: 'neutral' },
  PENDING_PAYMENT: { label: 'بانتظار السداد', tone: 'warning' },
  PARTIALLY_PAID: { label: 'مدفوع جزئياً', tone: 'info' },
  PAID: { label: 'مدفوع بالكامل', tone: 'success' },
  CANCELLED: { label: 'ملغى', tone: 'neutral' },
  REFUNDED: { label: 'مسترد', tone: 'purple' },
};

export const PAYOUT_STATUS_MAP: Record<string, StatusMeta> = {
  DRAFT: { label: 'مسودة تسوية (Maker)', tone: 'warning' },
  APPROVED: { label: 'معتمدة للصرف (Checker)', tone: 'info' },
  PAID: { label: 'تم التحويل', tone: 'success' },
  FAILED: { label: 'فشل التحويل', tone: 'danger' },
  CANCELLED: { label: 'ملغاة', tone: 'neutral' },
  CARRIED_FORWARD: { label: 'مرحّلة للدورة القادمة', tone: 'purple' },
};

export function getCommissionStatusMeta(status?: string | null): StatusMeta {
  return COMMISSION_STATUS_MAP[status || 'ON_HOLD'] || { label: status || 'قيد الانتظار', tone: 'neutral' };
}

export function getSellerStatusMeta(status?: string | null): StatusMeta {
  return SELLER_STATUS_MAP[status || 'PENDING'] || { label: status || 'قيد المراجعة', tone: 'neutral' };
}

export function getOrderStatusMeta(status?: string | null): StatusMeta {
  return ORDER_STATUS_MAP[status || 'PENDING_PAYMENT'] || { label: status || 'بانتظار السداد', tone: 'neutral' };
}

export function getPayoutStatusMeta(status?: string | null): StatusMeta {
  return PAYOUT_STATUS_MAP[status || 'DRAFT'] || { label: status || 'مسودة', tone: 'neutral' };
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: 'مبتدئ',
  INTERMEDIATE: 'متوسط',
  ADVANCED: 'متقدم',
};

export const BILLING_INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: 'باقة شهرية',
  QUARTERLY: 'باقة ربع سنوية',
  ANNUAL: 'باقة سنوية',
};

export function getCourseStatusMeta(status?: string | null): StatusMeta {
  return COURSE_STATUS_MAP[status || 'DRAFT'] || { label: status || 'مسودة', tone: 'neutral' };
}

export function getUserStatusMeta(status?: string | null): StatusMeta {
  return USER_STATUS_MAP[status || 'ACTIVE'] || { label: status || 'نشط', tone: 'neutral' };
}

export function getPaymentStatusMeta(status?: string | null): StatusMeta {
  return PAYMENT_STATUS_MAP[status || 'PENDING'] || { label: status || 'غير معروف', tone: 'neutral' };
}

export function getLeadStatusMeta(status?: string | null): StatusMeta {
  return LEAD_STATUS_MAP[status || 'NEW'] || { label: status || 'جديد', tone: 'neutral' };
}

export function getRecoveryStatusMeta(status?: string | null): StatusMeta {
  return RECOVERY_STATUS_MAP[status || 'PENDING'] || { label: status || 'معلق', tone: 'neutral' };
}

export function getVideoStatusMeta(status?: string | null): StatusMeta {
  return VIDEO_STATUS_MAP[status || 'UPLOADED'] || { label: status || 'قيد الرفع', tone: 'neutral' };
}

export function getDifficultyLabel(level?: string | null): string {
  return DIFFICULTY_LABELS[level || 'BEGINNER'] || 'مبتدئ';
}

export function getRoleLabel(role?: string | null): string {
  return USER_ROLE_LABELS[role || 'STUDENT'] || 'طالب';
}

export function getIntervalLabel(interval?: string | null): string {
  return BILLING_INTERVAL_LABELS[interval || 'MONTHLY'] || interval || '';
}

const OFFLINE_EVENT_STATUS_MAP: Record<string, StatusMeta> = {
  DRAFT: { label: 'مسودة إدارية', tone: 'neutral' },
  PUBLISHED: { label: 'متاح للحجز الآن', tone: 'success' },
  COMPLETED: { label: 'فعالية منتهية', tone: 'info' },
  CANCELLED: { label: 'ملغاة', tone: 'danger' },
};

const EVENT_REG_STATUS_MAP: Record<string, StatusMeta> = {
  PENDING_PAYMENT: { label: 'بانتظار إتمام الدفع', tone: 'warning' },
  CONFIRMED: { label: 'حجز مؤكد ومدفوع', tone: 'success' },
  ATTENDED: { label: 'تم الحضور', tone: 'info' },
  CANCELLED: { label: 'ملغى', tone: 'neutral' },
  REFUNDED: { label: 'مبلغ مسترد', tone: 'purple' },
};

export function getOfflineEventStatusMeta(status?: string | null): StatusMeta {
  return OFFLINE_EVENT_STATUS_MAP[status || 'DRAFT'] || { label: status || 'مسودة', tone: 'neutral' };
}

export function getEventRegistrationStatusMeta(status?: string | null): StatusMeta {
  return EVENT_REG_STATUS_MAP[status || 'PENDING_PAYMENT'] || { label: status || 'قيد المعالجة', tone: 'neutral' };
}

export const COVER_IMAGE_PRESETS: Array<{ label: string; url: string }> = [
  { label: 'إدارة المزارع والعنابر', url: '/images/brand/course-farm-management.webp' },
  { label: 'الأمن الحيوي والوقاية', url: '/images/brand/course-biosecurity.webp' },
  { label: 'تركيب الأعلاف والتغذية', url: '/images/brand/course-feed-formulation.webp' },
  { label: 'التسويق والمبيعات البيطرية', url: '/images/brand/course-vet-marketing.webp' },
  { label: 'مسار إنتاج الدواجن', url: '/images/brand/track-poultry.webp' },
  { label: 'العيادات والطب البيطري', url: '/images/brand/track-vet.webp' },
  { label: 'إنتاج الألبان والماشية', url: '/images/brand/track-cattle.webp' },
  { label: 'الاستزراع السمكي', url: '/images/brand/track-fish.webp' },
  { label: 'سلامة الغذاء والمصانع', url: '/images/brand/track-food.webp' },
  { label: 'التحليلات المعملية والتشخيص', url: '/images/brand/track-lab.webp' },
  { label: 'الذكاء الاصطناعي في الزراعة', url: '/images/brand/track-ai.webp' },
];

export interface AssignableRoleMeta {
  code: string;
  label: string;
  portalLabel: string;
  portalHref: string;
  badgeTone: BadgeTone;
  descriptionAr: string;
}

export const ALL_ASSIGNABLE_ROLES: AssignableRoleMeta[] = [
  {
    code: 'STUDENT',
    label: 'طالب / متدرب',
    portalLabel: 'بوابة المتدرب',
    portalHref: '/student',
    badgeTone: 'neutral',
    descriptionAr: 'متابعة الكورسات المسجلة والشهادات والتذاكر الشخصية',
  },
  {
    code: 'INSTRUCTOR',
    label: 'مدرب معتمد',
    portalLabel: 'لوحة المدرب',
    portalHref: '/instructor',
    badgeTone: 'info',
    descriptionAr: 'إدارة الكورسات المسندة والفيديوهات والواجبات وكشف الحساب المستقل',
  },
  {
    code: 'AFFILIATE_SELLER',
    label: 'بائع معتمد / مسوّق بالعمولة',
    portalLabel: 'لوحة البائع والعمولات',
    portalHref: '/seller',
    badgeTone: 'success',
    descriptionAr: 'بوابة البائع المخصصة: الأكواد ورموز QR والطلبات والعمولات والتسويات الشخصية فقط',
  },
  {
    code: 'SUPPORT',
    label: 'خدمة العملاء والدعم الفني',
    portalLabel: 'لوحة خدمة العملاء',
    portalHref: '/admin',
    badgeTone: 'warning',
    descriptionAr: 'لوحة تذاكر الدعم الفني: عرض التذاكر والرد عليها وإغلاقها ومتابعة الـ CRM بدون صلاحيات مالية',
  },
  {
    code: 'FINANCE_OFFICER',
    label: 'مسؤول / مراجع مالي',
    portalLabel: 'لوحة الإدارة المالية',
    portalHref: '/admin',
    badgeTone: 'purple',
    descriptionAr: 'لوحة العمليات المالية فقط: الدفعات والاسترداد واعتماد العمولات والتسويات (Maker-Checker) والمطابقة',
  },
  {
    code: 'TRAINING_COORDINATOR',
    label: 'منسق التدريب',
    portalLabel: 'لوحة منسق التدريب',
    portalHref: '/admin',
    badgeTone: 'info',
    descriptionAr: 'لوحة التنسيق التدريبي: الجلسات والحضور والغياب وبنك الأسئلة والواجبات وقوائم الانتظار',
  },
  {
    code: 'ACADEMY_MANAGER',
    label: 'مدير الأكاديمية',
    portalLabel: 'لوحة مدير الأكاديمية',
    portalHref: '/admin',
    badgeTone: 'purple',
    descriptionAr: 'إدارة البائعين وقواعد العمولات والـ CRM والمؤسسات B2B والتدريب والدعم والتحليلات',
  },
  {
    code: 'ADMIN',
    label: 'مدير المنصة',
    portalLabel: 'لوحة الإدارة الشاملة',
    portalHref: '/admin',
    badgeTone: 'purple',
    descriptionAr: 'صلاحيات إدارية شاملة على كافة أقسام المنصة',
  },
  {
    code: 'SUPER_ADMIN',
    label: 'مدير النظام الأعلى',
    portalLabel: 'لوحة المدير الأعلى',
    portalHref: '/admin',
    badgeTone: 'purple',
    descriptionAr: 'تحكم كامل بالمنصة ومصفوفة الأدوار والصلاحيات والتدقيق والمالية',
  },
];

export function getRoleBadgeTone(role?: string | null): BadgeTone {
  return ALL_ASSIGNABLE_ROLES.find((r) => r.code === role)?.badgeTone || 'neutral';
}

export function getDefaultDashboardForUser(user?: {
  role?: string | null;
  roles?: string[];
  organizationIds?: string[];
} | null): {
  href: string;
  label: string;
  portalBadgeAr: string;
  portalTitleAr: string;
  portalSubtitleAr: string;
} {
  const primary = user?.role || 'STUDENT';
  const allRoles = new Set<string>([primary, ...(user?.roles || [])]);

  if (allRoles.has('SUPER_ADMIN') || allRoles.has('ADMIN')) {
    return {
      href: '/admin',
      label: 'لوحة الإدارة الشاملة',
      portalBadgeAr: 'القيادة العليا • التحكم الشامل 360°',
      portalTitleAr: 'لوحة المدير الأعلى لمنصة بوصلة',
      portalSubtitleAr: 'إدارة الأدوار والصلاحيات، الكورسات، البائعين، المالية، الـ CRM، المؤسسات، والدعم الفني',
    };
  }
  if (primary === 'SUPPORT') {
    return {
      href: '/admin',
      label: 'لوحة خدمة العملاء',
      portalBadgeAr: 'بوابة خدمة العملاء والدعم الفني',
      portalTitleAr: 'لوحة تحكم خدمة العملاء وتذاكر الدعم',
      portalSubtitleAr: 'عرض تذاكر الدعم الفني، الرد على المتدربين، إضافة ملاحظات داخلية، وإغلاق التذاكر المحلولة',
    };
  }
  if (primary === 'FINANCE_OFFICER') {
    return {
      href: '/admin',
      label: 'لوحة الإدارة المالية',
      portalBadgeAr: 'بوابة الإدارة المالية والمراجعة (Maker-Checker)',
      portalTitleAr: 'لوحة تحكم المسؤول المالي والمراجع المالي',
      portalSubtitleAr: 'إدارة المدفوعات، الاستردادات، اعتماد عمولات البائعين، التسويات الشهرية، والمطابقة المالية',
    };
  }
  if (primary === 'ACADEMY_MANAGER') {
    return {
      href: '/admin',
      label: 'لوحة مدير الأكاديمية',
      portalBadgeAr: 'بوابة إدارة الأكاديمية والعمليات',
      portalTitleAr: 'لوحة تحكم مدير الأكاديمية',
      portalSubtitleAr: 'اعتماد البائعين وقواعد العمولات، منظومة الـ CRM، المؤسسات B2B، التدريب، والتقارير التنفيذية',
    };
  }
  if (primary === 'TRAINING_COORDINATOR') {
    return {
      href: '/admin',
      label: 'لوحة منسق التدريب',
      portalBadgeAr: 'بوابة التنسيق التدريبي والأكاديمي',
      portalTitleAr: 'لوحة تحكم منسق التدريب',
      portalSubtitleAr: 'جدولة الجلسات التدريبية، رصد الحضور والغياب، قوائم الانتظار، بنك الأسئلة، وتصحيح الواجبات',
    };
  }
  if (primary === 'AFFILIATE_SELLER') {
    return {
      href: '/seller',
      label: 'لوحة البائع والعمولات',
      portalBadgeAr: 'بوابة البائع المعتمد',
      portalTitleAr: 'لوحة البائع والعمولات',
      portalSubtitleAr: 'متابعة حصرية لأكوادك، روابط الإحالة، رموز QR، الطلبات المنسوبة، والعمولات الشهرية',
    };
  }
  if (primary === 'INSTRUCTOR') {
    return {
      href: '/instructor',
      label: 'بوابة المدرب',
      portalBadgeAr: 'بوابة المدرب المعتمد',
      portalTitleAr: 'لوحة المدرب وإدارة المحتوى',
      portalSubtitleAr: 'إدارة الكورسات المسندة والفيديوهات والواجبات وكشف الحساب المالي المستقل',
    };
  }
  return {
    href: '/student',
    label: 'بوابتي التعليمية',
    portalBadgeAr: 'بوابة المتدرب',
    portalTitleAr: 'مساحتي التعليمية',
    portalSubtitleAr: 'متابعة الكورسات المسجلة والشهادات والتقدم الدراسي',
  };
}

