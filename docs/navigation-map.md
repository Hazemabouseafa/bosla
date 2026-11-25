# خريطة إعادة تنظيم لوحة التحكم والقائمة الجانبية (BOSLA Academy)

توثّق هذه الخريطة عملية تفكيك الشاشات المتكدسة وتحويل القائمة الجانبية إلى بنية RTL من مستويين قابلة للفتح والإغلاق دون إسقاط أي وظيفة أو صلاحية قائمة.

## 1. لوحة الإدارة والأدوار الإدارية (`ADMIN`, `SUPER_ADMIN`, `ACADEMY_MANAGER`, `TRAINING_COORDINATOR`, `FINANCE_OFFICER`, `SUPPORT`)

| الوظيفة الحالية | القسم الجديد (Accordion Group) | الصفحة المستهدفة (Dedicated Route) | التوافق الخلفي (`?tab=...`) |
| --- | --- | --- | --- |
| نظرة عامة والبنية + المهام العاجلة | الرئيسية والتقارير | `/admin` (أو `/admin?tab=overview`) | `/admin?tab=overview` |
| التحليلات والتقارير التنفيذية (من المنظومة الشاملة) | الرئيسية والتقارير | `/admin/analytics` | `/admin?tab=enterprise&section=analytics` |
| سجل التدقيق المالي والإداري | الرئيسية والتقارير | `/admin/audit` | `/admin?tab=enterprise&section=audit` |
| إدارة ومراجعة الكورسات (`editorial`) | المحتوى الأكاديمي والبرامج | `/admin/courses` | `/admin?tab=editorial` |
| المسارات والدبلومات ومشاريع الدبلومات (`paths_diplomas`) | المحتوى الأكاديمي والبرامج | `/admin/programs` | `/admin?tab=paths_diplomas` |
| مكتبة الوسائط والأصول والفيديوهات (`media`) | المحتوى الأكاديمي والبرامج | `/admin/media` | `/admin?tab=media` |
| الجلسات وبنك الأسئلة والواجبات (من المنظومة الشاملة) | التدريب والفعاليات والمجتمعات | `/admin/lms` | `/admin?tab=enterprise&section=lms` |
| الفعاليات الأوفلاين والحضور (`events`) | التدريب والفعاليات والمجتمعات | `/admin/events` | `/admin?tab=events` |
| إدارة المجتمعات وبلاغات المحتوى (`communities`) | التدريب والفعاليات والمجتمعات | `/admin/communities` | `/admin?tab=communities` |
| المستخدمون والصلاحيات 360° والأدوار (مدمج من `users` + `enterprise.rbac`) | المستخدمون والمدربون والدعم | `/admin/users` | `/admin?tab=users` و`section=rbac` |
| التواصل ومهام المدربين وطلبات التوصية (`instructor_collab`) | المستخدمون والمدربون والدعم | `/admin/instructors/tasks` | `/admin?tab=instructor_collab` |
| مكتب الدعم الفني ومنح العضوية اليدوي | المستخدمون والمدربون والدعم | `/admin/support` (و`/support` لعضو الدعم) | `/admin?tab=enterprise&section=support` |
| العضويات والاشتراكات (`memberships`) | العضويات والمبيعات والمالية | `/admin/memberships` | `/admin?tab=memberships` |
| الطلبات والمدفوعات والتسويات والعمولات (مدمج من `finance` + `enterprise.finance`) | العضويات والمبيعات والمالية | `/admin/finance` | `/admin?tab=finance` و`section=finance` |
| البائعون وقواعد العمولات (من المنظومة الشاملة) | العضويات والمبيعات والمالية | `/admin/sellers` | `/admin?tab=enterprise&section=sellers` |
| الكوبونات (`coupons_templates`) | العضويات والمبيعات والمالية | `/admin/coupons` | `/admin?tab=coupons_templates` |
| إدارة علاقات العملاء والعملاء المحتملون والمؤسسات B2B | المؤسسات وعلاقات العملاء | `/admin/crm` | `/admin?tab=enterprise&section=crm` |
| المؤسسات والدفعات (B2B) | المؤسسات وعلاقات العملاء | `/admin/b2b` | `/admin?tab=enterprise&section=b2b` |
| الشهادات وقوالب الشهادات والتوصيات والاسترداد | الشهادات والاعتماد والتوصيات | `/admin/certificates` | `/admin?tab=security_certs` و`coupons_templates` |
| Live Editor وتخصيص أقسام الواجهة | الموقع والمحتوى والتسويق | `/admin/live-editor` | `/admin?tab=live_editor` و`sections` |
| الشركاء وآراء العملاء وفرص التوظيف والـ CMS | الموقع والمحتوى والتسويق | `/admin/cms` | `/admin?tab=cms_leads` |
| الإعدادات العامة، تسجيل الدخول بجوجل، البريد SMTP، وبوابة الدفع Paymob | الإعدادات والتكاملات | `/admin/settings` (مع `?section=general\|google\|mail\|paymob`) | `/admin?tab=paymob_settings` |

## 2. بوابة المتدرب (`STUDENT` - `/student`)

| الوظيفة الحالية | القسم الجديد | المسار / التبويب المستهدف |
| --- | --- | --- |
| نظرة عامة المتدرب («كمّل تعلّمك»، تقدم الكورسات والمسارات، حالة العضوية، المهام المجدولة) | مساحتي التعليمية | `/student` (`?tab=overview`) |
| كورساتي، المفضلة، وسلة الشراء | مساحتي التعليمية | `/student?tab=library` و`/cart` |
| المسارات والدبلومات وإحصاءات التقدم | التطوير المهني | `/student?tab=tracks` |
| الشهادات المكتسبة وخطابات التوصية والتحقق | الشهادات والتوصيات | `/student?tab=credentials` و`/certificates/verify` |
| تذاكر الدعم والتواصل والأمان والملف الشخصي | الحساب والدعم | `/support` و`/student/settings` |

## 3. بوابة المدرب (`INSTRUCTOR` - `/instructor`)

| الوظيفة الحالية | القسم الجديد | المسار المستهدف |
| --- | --- | --- |
| لوحة الكورسات ومسودات التعديل (المعالج ذو 4 خطوات) | التدريس والمحتوى | `/instructor` |
| مكتبة الفيديوهات والترجمة التلقائية | التدريس والمحتوى | `/instructor/videos` |
| مهامي، الشات الإداري، وطلبات خطابات التوصية | التواصل والاعتمادات | `/instructor?tab=tasks` و`/instructor?tab=recommendations` |
| كشف الأرباح والدفعات والملف الأكاديمي | التقارير والحساب | `/instructor?tab=earnings` و`/student/settings` |

## 4. البوابات المتخصصة الأخرى

- **خدمة العملاء والدعم (`/support`)**: قسم **التذاكر والاستفسارات** (`/support`) + قسم **منح العضوية اليدوي** (`/support?tab=grants` — يظهر فقط لحاملي صلاحية `membership.grant` أو الإدارة العليا).
- **البائعون (`/seller`)**: قسم **الأداء والإحالات** (`/seller`) + **المواد التسويقية والطلبات** (`/seller?tab=materials`).
- **مسؤول المؤسسة B2B (`/org`)**: قسم **إدارة المقاعد والموظفين** (`/org`) + **التقارير والفواتير** (`/org?tab=reports`).
