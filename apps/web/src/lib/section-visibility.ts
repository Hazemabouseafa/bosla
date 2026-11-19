export type SiteSectionKey =
  | 'hero'
  | 'metrics'
  | 'courses'
  | 'learningPaths'
  | 'offlineEvents'
  | 'diplomas'
  | 'journey'
  | 'specializationQuiz'
  | 'instructors'
  | 'memberships'
  | 'testimonials'
  | 'partners'
  | 'b2bLead'
  | 'faqs'
  | 'footerCta';

export interface SiteSectionMeta {
  key: SiteSectionKey;
  titleAr: string;
  descriptionAr: string;
  areaAr: 'الصفحة الرئيسية' | 'التذييل العام';
}

export const SITE_SECTIONS_CATALOG: SiteSectionMeta[] = [
  {
    key: 'hero',
    titleAr: 'البانر التعريفي الرئيسي (Hero)',
    descriptionAr: 'القسم الافتتاحي الأول بالصورة والعنوان التعريفي وأزرار الانطلاق.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'metrics',
    titleAr: 'شريط المؤشرات والإحصائيات الرقمية',
    descriptionAr: 'شريط أرقام الدورات والمدربين وساعات التدريب والأمان الميداني.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'courses',
    titleAr: 'قسم الكورسات التدريبية المختارة',
    descriptionAr: 'شبكة الدورات المعتمدة مع أزرار التصفية حسب التخصص والمجانية.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'learningPaths',
    titleAr: 'قسم المسارات التعليمية المهنية',
    descriptionAr: 'عرض المسارات المجمعة المتدرجة لتأهيل الطالب إلى مدير.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'offlineEvents',
    titleAr: 'قسم الفعاليات والكورسات الأوفلاين',
    descriptionAr: 'بطاقات المعسكرات الحضورية وورش العمل الميدانية وحجز التذاكر.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'diplomas',
    titleAr: 'قسم الدبلومات التطبيقية المعتمدة',
    descriptionAr: 'بطاقات الدبلومات الشاملة ومشاريع التخرج الميدانية.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'journey',
    titleAr: 'قسم خطوات رحلة التعلم (5 خطوات)',
    descriptionAr: 'المخطط الحركي للتدرج التعليمي من اكتشاف التخصص حتى القيادة.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'specializationQuiz',
    titleAr: 'قسم بوصلة التخصص التفاعلية',
    descriptionAr: 'الأداة التفاعلية التي ترشح المسار الأنسب بناءً على إجابات الزائر.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'instructors',
    titleAr: 'قسم نخبة المدربين والخبراء',
    descriptionAr: 'تعريف بأساتذة المنصة والاستشاريين الميدانيين وعدد دوراتهم.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'memberships',
    titleAr: 'قسم باقات العضوية والاشتراكات',
    descriptionAr: 'جدول ومميزات خطط الاشتراك الشهرية والسنوية للطلاب.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'testimonials',
    titleAr: 'قسم آراء وتجارب المتدربين',
    descriptionAr: 'بطاقات التقييمات والتوصيات المنشورة لطلاب وخريجي بوصلة.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'partners',
    titleAr: 'قسم شركاء النجاح والتدريب الصناعي',
    descriptionAr: 'شريط شعارات الشركات والمزارع الشريكة وزر طلب الرعاية.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'b2bLead',
    titleAr: 'قسم نموذج تدريب الشركات والأفراد',
    descriptionAr: 'نموذج استقبال طلبات التدريب المؤسسي (B2B) والاستشارات الفردية.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'faqs',
    titleAr: 'قسم الأسئلة الشائعة',
    descriptionAr: 'قائمة الأسئلة والأجوبة التفاعلية حول المنصة والشهادات والدفع.',
    areaAr: 'الصفحة الرئيسية',
  },
  {
    key: 'footerCta',
    titleAr: 'شريط الدعوة للتسجيل أعلى التذييل',
    descriptionAr: 'البانر التشجيعي الثابت أعلى الفوتر في جميع الصفحات العامة.',
    areaAr: 'التذييل العام',
  },
];

export type SectionVisibilityMap = Record<SiteSectionKey, boolean>;

export function resolveSectionVisibility(
  raw?: Record<string, unknown> | null,
): SectionVisibilityMap {
  const result = {} as SectionVisibilityMap;
  for (const item of SITE_SECTIONS_CATALOG) {
    const val = raw?.[item.key];
    result[item.key] = val === false ? false : true;
  }
  return result;
}
