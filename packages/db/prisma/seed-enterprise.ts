import { PrismaClient, type UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

interface SeedEnterpriseContext {
  adminId: string;
  instructorIds: string[];
  demoStudentId: string;
  coursesBySlug: Record<string, string>;
}

const ROLE_DEFS: Array<{ code: UserRole; nameAr: string; descriptionAr: string }> = [
  { code: 'SUPER_ADMIN', nameAr: 'مدير النظام الأعلى (Super Admin)', descriptionAr: 'تحكم كامل بالمنصة والأدوار والصلاحيات والإعدادات الحساسة.' },
  { code: 'ADMIN', nameAr: 'إدارة المنصة (Admin)', descriptionAr: 'صلاحيات إدارية شاملة متوافقة مع الحسابات الأساسية.' },
  { code: 'ACADEMY_MANAGER', nameAr: 'مدير الأكاديمية (Academy Manager)', descriptionAr: 'إدارة العمليات الأكاديمية والمحتوى والمدربين واعتماد البائعين.' },
  { code: 'TRAINING_COORDINATOR', nameAr: 'منسق التدريب (Training Coordinator)', descriptionAr: 'إدارة الجدولة التدريبية والحضور والتسجيلات والفعاليات.' },
  { code: 'INSTRUCTOR', nameAr: 'مدرب / محاضر (Trainer)', descriptionAr: 'إدارة الكورسات المسندة والتقييمات والواجبات وكشف الحساب المستقل.' },
  { code: 'FINANCE_OFFICER', nameAr: 'مسؤول مالي (Finance Officer)', descriptionAr: 'إدارة المدفوعات والعمولات والتسويات والمصروفات والمطابقة المالية فقط.' },
  { code: 'STUDENT', nameAr: 'متدرب (Student)', descriptionAr: 'الوصول للمحتوى المصرح به والشهادات والتذاكر وطلبات الدعم.' },
  { code: 'AFFILIATE_SELLER', nameAr: 'بائع / مسوّق بالعمولة (Affiliate / Seller)', descriptionAr: 'الوصول لبوابة البائع والأكواد وروابط الإحالة والمبيعات والعمولات الخاصة به فقط.' },
  { code: 'SUPPORT', nameAr: 'خدمة العملاء والدعم (Support)', descriptionAr: 'إدارة التذاكر وطلبات الاسترداد والمساعدة دون صلاحية اعتماد أو صرف مالي.' },
];

const PERMISSION_DEFS: Array<{ code: string; module: string; nameAr: string; descriptionAr: string }> = [
  { code: 'rbac.manage', module: 'RBAC', nameAr: 'إدارة الأدوار والصلاحيات', descriptionAr: 'تعيين الأدوار وتعديل مصفوفة الصلاحيات' },
  { code: 'audit.read', module: 'RBAC', nameAr: 'عرض سجل التدقيق', descriptionAr: 'الاطلاع على سجل العمليات الحساسة' },
  { code: 'settings.manage', module: 'Platform', nameAr: 'إعدادات المنصة', descriptionAr: 'إدارة إعدادات المنصة والأقسام' },
  { code: 'courses.manage', module: 'Academic', nameAr: 'إدارة الكورسات', descriptionAr: 'إنشاء وتعديل الكورسات والمسارات والدبلومات' },
  { code: 'courses.publish', module: 'Academic', nameAr: 'نشر الكورسات', descriptionAr: 'اعتماد ونشر الكورسات في المتجر' },
  { code: 'courses.teach_assigned', module: 'Academic', nameAr: 'التدريس بالكورسات المسندة', descriptionAr: 'إدارة الدروس والطلاب بالكورسات المسندة' },
  { code: 'training.coordinate', module: 'Academic', nameAr: 'تنسيق التدريب', descriptionAr: 'جدولة الجلسات وإدارة الدفعات وقوائم الانتظار' },
  { code: 'attendance.manage', module: 'Academic', nameAr: 'إدارة الحضور', descriptionAr: 'رصد حضور وغياب المتدربين' },
  { code: 'lms.grade', module: 'Academic', nameAr: 'تصحيح الاختبارات والواجبات', descriptionAr: 'تصحيح الأسئلة المقالية والواجبات والمشاريع' },
  { code: 'certificates.issue', module: 'Certificates', nameAr: 'إصدار الشهادات', descriptionAr: 'إصدار وإعادة إصدار شهادات الحضور والكفاءة' },
  { code: 'certificates.revoke', module: 'Certificates', nameAr: 'إلغاء الشهادات', descriptionAr: 'سحب وإلغاء الشهادات الصادرة' },
  { code: 'events.manage', module: 'Academic', nameAr: 'إدارة الفعاليات الحضورية', descriptionAr: 'إدارة الورش والفعاليات الاوفلاين' },
  { code: 'community.moderate', module: 'Community', nameAr: 'إدارة المجتمعات', descriptionAr: 'إشراف ومراجعة أسئلة ونقاشات المجتمعات' },
  { code: 'orders.read', module: 'Commerce', nameAr: 'عرض الطلبات', descriptionAr: 'الاطلاع على الطلبات والفواتير' },
  { code: 'orders.manual_payment', module: 'Finance', nameAr: 'تسجيل المدفوعات اليدوية', descriptionAr: 'توثيق التحويل البنكي والدفع النقدي والجزئي' },
  { code: 'orders.refund', module: 'Finance', nameAr: 'تنفيذ الاستردادات', descriptionAr: 'معالجة الاسترداد الكامل والجزئي وعكس العمولات' },
  { code: 'payments.allocate_manual', module: 'Finance', nameAr: 'إعادة توزيع المدفوعات', descriptionAr: 'تعديل توزيع الدفعات الجزئية على بنود الطلب' },
  { code: 'finance.dashboard.read', module: 'Finance', nameAr: 'لوحة المالية والتقارير', descriptionAr: 'الاطلاع على الإيرادات والأرباح والتدفق النقدي' },
  { code: 'finance.expenses.manage', module: 'Finance', nameAr: 'إدارة المصروفات', descriptionAr: 'تسجيل ومراجعة مصروفات الأكاديمية' },
  { code: 'finance.period.close', module: 'Finance', nameAr: 'إغلاق الفترات المحاسبية', descriptionAr: 'إغلاق الفترات الشهرية ومنع التعديل الرجعي' },
  { code: 'finance.reconcile', module: 'Finance', nameAr: 'المطابقة المالية', descriptionAr: 'تشغيل ومراجعة تقارير المطابقة المالية' },
  { code: 'instructor.finance.manage', module: 'Finance', nameAr: 'عقود ومستحقات المدربين', descriptionAr: 'إدارة عقود ونسب وصرفيات المدربين' },
  { code: 'sellers.manage', module: 'Sellers', nameAr: 'إدارة البائعين والأكواد', descriptionAr: 'مراجعة طلبات البائعين واعتمادهم وإيقافهم' },
  { code: 'sellers.portal', module: 'Sellers', nameAr: 'بوابة البائع', descriptionAr: 'عرض الأكواد والمبيعات والعمولات الشخصية فقط' },
  { code: 'commissions.rules.manage', module: 'Sellers', nameAr: 'قواعد عمولات البائعين', descriptionAr: 'إدارة قواعد العمولة الثابتة وسقف العمولة' },
  { code: 'commissions.approve', module: 'Finance', nameAr: 'اعتماد العمولات', descriptionAr: 'مراجعة واعتماد أو تعليق عمولات البائعين' },
  { code: 'settlements.create', module: 'Finance', nameAr: 'إنشاء التسويات الشهرية', descriptionAr: 'تجهيز كشوف التسوية الشهرية للبائعين (Maker)' },
  { code: 'settlements.approve', module: 'Finance', nameAr: 'اعتماد التسويات الشهرية', descriptionAr: 'اعتماد التسويات وفق مبدأ Maker-Checker' },
  { code: 'settlements.payout', module: 'Finance', nameAr: 'تنفيذ الصرف للبائعين', descriptionAr: 'توثيق التحويلات البنكية وإغلاق الصرف' },
  { code: 'crm.manage', module: 'CRM', nameAr: 'إدارة العملاء المحتملين والحملات', descriptionAr: 'إدارة المسار البيعي والحملات التسويقية' },
  { code: 'b2b.manage', module: 'B2B', nameAr: 'إدارة المؤسسات والشركات', descriptionAr: 'إدارة الجهات والعقود والمقاعد المؤسسية' },
  { code: 'b2b.org_admin', module: 'B2B', nameAr: 'بوابة مسؤول المؤسسة', descriptionAr: 'إدارة متدربي ومقاعد المؤسسة الخاصة به فقط' },
  { code: 'support.manage', module: 'Support', nameAr: 'إدارة تذاكر الدعم', descriptionAr: 'الرد على تذاكر الدعم وإدارة SLA' },
  { code: 'learning.access', module: 'Learning', nameAr: 'الوصول التعليمي', descriptionAr: 'مشاهدة الكورسات وحل الاختبارات والواجبات' },
];

const ALL_CODES = PERMISSION_DEFS.map((p) => p.code);

const DEFAULT_ROLE_PERMS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ALL_CODES,
  ADMIN: ALL_CODES,
  ACADEMY_MANAGER: [
    'audit.read', 'courses.manage', 'courses.publish', 'training.coordinate',
    'attendance.manage', 'lms.grade', 'certificates.issue', 'certificates.revoke',
    'events.manage', 'community.moderate', 'orders.read', 'sellers.manage',
    'commissions.rules.manage', 'crm.manage', 'b2b.manage', 'instructor.finance.manage',
    'support.manage', 'learning.access',
  ],
  TRAINING_COORDINATOR: [
    'courses.manage', 'training.coordinate', 'attendance.manage', 'lms.grade',
    'certificates.issue', 'events.manage', 'b2b.manage', 'learning.access',
  ],
  INSTRUCTOR: ['courses.teach_assigned', 'attendance.manage', 'lms.grade', 'learning.access'],
  FINANCE_OFFICER: [
    'audit.read', 'orders.read', 'orders.manual_payment', 'orders.refund',
    'payments.allocate_manual', 'finance.dashboard.read', 'finance.expenses.manage',
    'finance.period.close', 'finance.reconcile', 'instructor.finance.manage',
    'commissions.rules.manage', 'commissions.approve', 'settlements.create',
    'settlements.approve', 'settlements.payout', 'learning.access',
  ],
  AFFILIATE_SELLER: ['sellers.portal', 'learning.access'],
  SUPPORT: ['orders.read', 'support.manage', 'crm.manage', 'community.moderate', 'learning.access'],
  STUDENT: ['learning.access'],
};

export async function seedEnterpriseData(prisma: PrismaClient, ctx: SeedEnterpriseContext) {
  // 1. Seed Roles, Permissions & RolePermission matrix
  const roleMap = new Map<UserRole, string>();
  for (const r of ROLE_DEFS) {
    const saved = await prisma.roleDefinition.upsert({
      where: { code: r.code },
      update: { nameAr: r.nameAr, descriptionAr: r.descriptionAr },
      create: { code: r.code, nameAr: r.nameAr, descriptionAr: r.descriptionAr, isSystem: true },
    });
    roleMap.set(r.code, saved.id);
  }

  const permMap = new Map<string, string>();
  for (const p of PERMISSION_DEFS) {
    const saved = await prisma.permissionDefinition.upsert({
      where: { code: p.code },
      update: { module: p.module, nameAr: p.nameAr, descriptionAr: p.descriptionAr },
      create: p,
    });
    permMap.set(p.code, saved.id);
  }

  for (const [roleCode, permCodes] of Object.entries(DEFAULT_ROLE_PERMS) as Array<[UserRole, string[]]>) {
    const roleId = roleMap.get(roleCode);
    if (!roleId) continue;
    for (const permCode of permCodes) {
      const permissionId = permMap.get(permCode);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  // Ensure existing primary admin/instructors/student have matching UserRoleAssignments
  const assignRole = async (userId: string, roleCode: UserRole) => {
    const roleId = roleMap.get(roleCode);
    if (!roleId) return;
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId, assignedById: ctx.adminId },
    });
  };

  await assignRole(ctx.adminId, 'ADMIN');
  await assignRole(ctx.adminId, 'SUPER_ADMIN');
  for (const iid of ctx.instructorIds) {
    await assignRole(iid, 'INSTRUCTOR');
  }
  await assignRole(ctx.demoStudentId, 'STUDENT');

  // 2. Seed Enterprise Staff & Seller Demo Accounts (additive, non-conflicting phones)
  const staffPasswordHash = await argon2.hash('BoslaEnterprise#2026', { type: argon2.argon2id });

  const enterpriseAccounts: Array<{
    phoneE164: string;
    email: string;
    fullName: string;
    role: UserRole;
  }> = [
    { phoneE164: '+201000000301', email: 'manager@bosla-academy.com', fullName: 'أ/ كريم منصور — مدير الأكاديمية', role: 'ACADEMY_MANAGER' },
    { phoneE164: '+201000000302', email: 'coordinator@bosla-academy.com', fullName: 'أ/ سارة عادل — منسق التدريب', role: 'TRAINING_COORDINATOR' },
    { phoneE164: '+201000000303', email: 'finance.maker@bosla-academy.com', fullName: 'أ/ طارق الشاذلي — مسؤول مالي', role: 'FINANCE_OFFICER' },
    { phoneE164: '+201000000304', email: 'finance.checker@bosla-academy.com', fullName: 'أ/ ندى محمود — مراجع مالي معتمد', role: 'FINANCE_OFFICER' },
    { phoneE164: '+201000000305', email: 'support@bosla-academy.com', fullName: 'أ/ عمر خليل — خدمة العملاء', role: 'SUPPORT' },
    { phoneE164: '+201000000306', email: 'seller.demo@bosla-academy.com', fullName: 'أحمد حسام — بائع معتمد', role: 'AFFILIATE_SELLER' },
  ];

  const createdAccounts = new Map<string, string>();
  for (const acct of enterpriseAccounts) {
    const user = await prisma.user.upsert({
      where: { phoneE164: acct.phoneE164 },
      update: { fullName: acct.fullName, role: acct.role, status: 'ACTIVE' },
      create: {
        phoneE164: acct.phoneE164,
        email: acct.email,
        fullName: acct.fullName,
        role: acct.role,
        status: 'ACTIVE',
        authProvider: 'PHONE_PASSWORD',
        passwordHash: staffPasswordHash,
      },
    });
    createdAccounts.set(acct.email, user.id);
    await assignRole(user.id, acct.role);
  }

  // 3. Seed Approved Seller + SellerCode + Commission Rules (matching 100, 150, 200 EGP reference!)
  const sellerUserId = createdAccounts.get('seller.demo@bosla-academy.com')!;
  const seller = await prisma.seller.upsert({
    where: { userId: sellerUserId },
    update: { status: 'APPROVED', kycVerified: true, payoutVerified: true },
    create: {
      userId: sellerUserId,
      status: 'APPROVED',
      fullName: 'أحمد حسام — بائع معتمد',
      phoneE164: '+201000000306',
      email: 'seller.demo@bosla-academy.com',
      nationalIdNumber: '29501011234567',
      idDocumentUrl: '/uploads/kyc-demo-seller.pdf',
      experienceSummaryAr: 'خبرة 5 سنوات في التسويق للدورات البيطرية ومجتمعات الأطباء والمهندسين الزراعيين في مصر.',
      marketingChannelsAr: 'فيسبوك، لينكدإن، مجموعات الأطباء البيطريين',
      payoutMethodType: 'BANK_TRANSFER',
      payoutAccountName: 'أحمد حسام محمد',
      payoutAccountDetails: 'CIB Egypt — EG380019000500000000263180002',
      kycVerified: true,
      payoutVerified: true,
      verifiedById: ctx.adminId,
      verifiedAt: new Date(),
      minPayoutAmount: '500.00',
    },
  });

  await prisma.sellerCode.upsert({
    where: { code: 'BOSLA2026' },
    update: { isActive: true },
    create: {
      sellerId: seller.id,
      code: 'BOSLA2026',
      allowedCourseIds: [],
      isActive: true,
    },
  });

  // Course Default Commission Rules (100, 150, 200 EGP) for first 3 published courses
  const courseSlugs = Object.keys(ctx.coursesBySlug);
  const referenceCommissionAmounts = ['100.00', '150.00', '200.00'];
  const effectiveStart = new Date('2025-01-01T00:00:00Z');

  for (let i = 0; i < Math.min(3, courseSlugs.length); i++) {
    const courseId = ctx.coursesBySlug[courseSlugs[i]];
    if (!courseId) continue;
    const existingRule = await prisma.sellerCommissionRule.findFirst({
      where: { courseId, sellerId: null, isActive: true },
    });
    if (!existingRule) {
      await prisma.sellerCommissionRule.create({
        data: {
          courseId,
          sellerId: null,
          fixedAmount: referenceCommissionAmounts[i],
          capPercent: '50.00',
          effectiveFrom: effectiveStart,
          effectiveTo: null,
          isActive: true,
          createdById: ctx.adminId,
        },
      });
    }
  }

  // Marketing Materials for Seller Portal
  if ((await prisma.marketingMaterial.count()) === 0) {
    await prisma.marketingMaterial.createMany({
      data: [
        {
          titleAr: 'نص تسويقي جاهز — كورسات الدواجن والطب البيطري',
          descriptionAr: 'مناسب لمنشورات فيسبوك ولينكدإن مع رابط الإحالة الخاص بك.',
          assetType: 'COPY',
          copyTextAr: 'ابدأ رحلتك العملية في إدارة مزارع الدواجن والطب البيطري مع خبراء أكاديمية بوصلة. استخدم كود الإحالة الخاص بي عند التسجيل!',
          courseId: courseSlugs[0] ? ctx.coursesBySlug[courseSlugs[0]] : null,
        },
        {
          titleAr: 'بانر تعريفي — الأكاديمية الرائدة في الطب البيطري',
          descriptionAr: 'صورة دعائية عالية الدقة للاستخدام في الحملات.',
          assetType: 'BANNER',
          assetUrl: '/images/brand/track-poultry.webp',
          courseId: courseSlugs[0] ? ctx.coursesBySlug[courseSlugs[0]] : null,
        },
      ],
    });
  }

  // 4. Sample Coupon
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: { isActive: true },
    create: {
      code: 'WELCOME10',
      discountType: 'PERCENT',
      discountValue: '10.00',
      maxDiscountAmount: '250.00',
      minOrderAmount: '300.00',
      usageLimit: 500,
      validFrom: effectiveStart,
      isActive: true,
      createdById: ctx.adminId,
    },
  });

  // 5. CRM Pipeline Stages
  const pipelineStages = [
    { key: 'NEW', nameAr: 'عميل محتمل جديد', sortOrder: 1, colorHex: '#6C4DF6', isDefault: true },
    { key: 'CONTACTED', nameAr: 'تم التواصل', sortOrder: 2, colorHex: '#3B82F6', isDefault: false },
    { key: 'QUALIFIED', nameAr: 'مؤهل للتسجيل', sortOrder: 3, colorHex: '#F5B841', isDefault: false },
    { key: 'PROPOSAL', nameAr: 'عرض سعر / متابعة', sortOrder: 4, colorHex: '#F97316', isDefault: false },
    { key: 'WON', nameAr: 'تم التسجيل', sortOrder: 5, colorHex: '#10B981', isDefault: false },
    { key: 'LOST', nameAr: 'غير مهتم حالياً', sortOrder: 6, colorHex: '#64748B', isDefault: false },
  ];
  for (const s of pipelineStages) {
    await prisma.crmPipelineStage.upsert({
      where: { key: s.key },
      update: { nameAr: s.nameAr, sortOrder: s.sortOrder, colorHex: s.colorHex },
      create: s,
    });
  }

  // 6. Default Certificate Templates
  await prisma.certificateTemplate.upsert({
    where: { key: 'bosla-attendance-v1' },
    update: {},
    create: {
      key: 'bosla-attendance-v1',
      nameAr: 'قالب شهادة الحضور والإتمام المعتمد',
      kind: 'ATTENDANCE_COMPLETION',
      headlineAr: 'شهادة إتمام وحضور دورة تدريبية',
      bodyTemplateAr: 'تشهد أكاديمية بوصلة للتدريب البيطري والإنتاج الحيواني بإتمام المتدرب/ة {{recipientName}} لكافة متطلبات الدورة التدريبية: {{title}}.',
      primaryColor: '#0F1A4A',
      accentColor: '#F5B841',
      signatureNameAr: 'الإدارة الأكاديمية — أكاديمية بوصلة',
      isDefault: true,
    },
  });

  await prisma.certificateTemplate.upsert({
    where: { key: 'bosla-competency-v1' },
    update: {},
    create: {
      key: 'bosla-competency-v1',
      nameAr: 'قالب شهادة الكفاءة المهنية المعتمدة',
      kind: 'COMPETENCY',
      headlineAr: 'شهادة كفاءة وتقييم تطبيقي',
      bodyTemplateAr: 'تشهد أكاديمية بوصلة باجتياز المتدرب/ة {{recipientName}} للتقييم التطبيقي والاختبار النهائي بكفاءة للبرنامج: {{title}}.',
      primaryColor: '#4A43D9',
      accentColor: '#10B981',
      signatureNameAr: 'لجنة الاعتماد والتقييم — أكاديمية بوصلة',
      isDefault: true,
    },
  });

  // 7. Instructor Profile & Default Contract (deductSellerCommission = false!)
  if (ctx.instructorIds[0]) {
    await prisma.instructorProfile.upsert({
      where: { userId: ctx.instructorIds[0] },
      update: {},
      create: {
        userId: ctx.instructorIds[0],
        specializations: ['إدارة مزارع الدواجن', 'الأمان الحيوي', 'التهوية والتحكم البيئي'],
        yearsExperience: 14,
        approvalStatus: 'APPROVED',
        reviewedById: ctx.adminId,
        reviewedAt: new Date(),
      },
    });
    const existingContract = await prisma.instructorContract.findFirst({
      where: { instructorId: ctx.instructorIds[0], isActive: true },
    });
    if (!existingContract) {
      await prisma.instructorContract.create({
        data: {
          instructorId: ctx.instructorIds[0],
          titleAr: 'عقد تدريب وتقديم دورات 2026',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2026-12-31T23:59:59Z'),
          defaultSharePercent: '35.00',
          deductSellerCommission: false,
          isActive: true,
          createdById: ctx.adminId,
        },
      });
    }
  }

  // 8. Sample B2B Organization & Cohort
  if ((await prisma.organization.count()) === 0) {
    const org = await prisma.organization.create({
      data: {
        nameAr: 'مجموعة الوادي للإنتاج الداجني والأعلاف',
        type: 'COMPANY',
        taxNumber: 'TAX-EG-40129910',
        contactNameAr: 'م/ محمود الشرقاوي',
        contactPhone: '+201099887766',
        contactEmail: 'hr@wadi-agri.example.com',
        seatCapacity: 50,
      },
    });
    await prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: ctx.demoStudentId,
        orgRole: 'ORG_ADMIN',
        departmentAr: 'التدريب والتطوير',
      },
    });
    const firstCourseId = courseSlugs[0] ? ctx.coursesBySlug[courseSlugs[0]] : null;
    if (firstCourseId) {
      await prisma.organizationContract.create({
        data: {
          organizationId: org.id,
          contractNumber: 'B2B-2026-001',
          titleAr: 'اتفاقية تأهيل مهندسي المزارع 2026',
          quotationAmount: '45000.00',
          discountPercent: '15.00',
          validFrom: new Date('2026-01-01T00:00:00Z'),
          validTo: new Date('2026-12-31T23:59:59Z'),
          assignedCourseIds: [firstCourseId],
          createdById: ctx.adminId,
        },
      });
      await prisma.trainingCohort.create({
        data: {
          courseId: firstCourseId,
          organizationId: org.id,
          titleAr: 'دفعة ربيع 2026 — مجموعة الوادي',
          startsAt: new Date(Date.now() + 7 * 86400_000),
          endsAt: new Date(Date.now() + 60 * 86400_000),
          maxSeats: 30,
        },
      });
    }
  }

  // 9. Sample Question Bank, Training Session, Assignment & Support Ticket
  const firstCourseId = courseSlugs[0] ? ctx.coursesBySlug[courseSlugs[0]] : null;
  if (firstCourseId && (await prisma.questionBankCategory.count()) === 0) {
    const qCat = await prisma.questionBankCategory.create({
      data: { nameAr: 'بنك أسئلة إدارة مزارع الدواجن', descriptionAr: 'أسئلة اختيار من متعدد وصح/خطأ ومقالية للتقييم.' },
    });
    await prisma.questionBankItem.createMany({
      data: [
        {
          categoryId: qCat.id,
          courseId: firstCourseId,
          questionType: 'MCQ',
          promptAr: 'ما هي نسبة الرطوبة النسبية المثالية خلال الأسبوع الأول للتحضين؟',
          options: [
            { id: 'a', textAr: '50% إلى 65%' },
            { id: 'b', textAr: '15% إلى 25%' },
            { id: 'c', textAr: '85% إلى 95%' },
          ],
          correctAnswer: 'a',
          explanationAr: 'الحفاظ على رطوبة 50-65% يمنع جفاف الكتاكيت ويقلل الإجهاد التنفسي.',
          defaultPoints: 2,
          createdById: ctx.instructorIds[0] ?? ctx.adminId,
        },
        {
          categoryId: qCat.id,
          courseId: firstCourseId,
          questionType: 'TRUE_FALSE',
          promptAr: 'ارتفاع تركيز الأمونيا فوق 25 جزء في المليون يؤثر سلباً على معامل التحويل الغذائي.',
          options: [
            { id: 'true', textAr: 'صواب' },
            { id: 'false', textAr: 'خطأ' },
          ],
          correctAnswer: 'true',
          explanationAr: 'الأمونيا المرتفعة تضر الأغشية التنفسية وتقلل استهلاك العلف والنمو.',
          defaultPoints: 1,
          createdById: ctx.instructorIds[0] ?? ctx.adminId,
        },
        {
          categoryId: qCat.id,
          courseId: firstCourseId,
          questionType: 'WRITTEN',
          promptAr: 'اشرح بإيجاز خطة ضبط التهوية الدنيا في الشتاء لعنبر 10,000 طائر بعمر 7 أيام.',
          defaultPoints: 5,
          createdById: ctx.instructorIds[0] ?? ctx.adminId,
        },
      ],
    });
  }

  if (firstCourseId && (await prisma.trainingSession.count()) === 0) {
    await prisma.trainingSession.create({
      data: {
        courseId: firstCourseId,
        instructorId: ctx.instructorIds[0] ?? null,
        titleAr: 'جلسة تفاعلية مباشرة — مراجعة حسابات التهوية والـ FCR',
        sessionType: 'HYBRID',
        startsAt: new Date(Date.now() + 3 * 86400_000),
        endsAt: new Date(Date.now() + 3 * 86400_000 + 2 * 3600_000),
        venueAr: 'قاعة بوصلة التدريبية — مدينة نصر، القاهرة',
        manualMeetingUrl: 'https://meet.bosla-academy.example/live-fcr-review',
      },
    });
  }

  if (firstCourseId && (await prisma.assignment.count()) === 0) {
    await prisma.assignment.create({
      data: {
        courseId: firstCourseId,
        titleAr: 'مشروع تطبيقي: إعداد جدول متابعة دورة تسمين 35 يوم',
        instructionsAr: 'قم بإعداد خطة متكاملة لدرجات الحرارة والرطوبة ومعدل استهلاك العلف المتوقع لدورة تسمين 10,000 طائر مع توضيح نقاط الفحص اليومية.',
        maxScore: 100,
        passingScore: 70,
        isPracticalProject: true,
        rubric: [
          { criterionAr: 'دقة منحنى الحرارة والتهوية', maxPoints: 40 },
          { criterionAr: 'حسابات العلف ومعامل التحويل', maxPoints: 35 },
          { criterionAr: 'خطة الأمان الحيوي والتطهير', maxPoints: 25 },
        ],
        createdById: ctx.instructorIds[0] ?? ctx.adminId,
      },
    });
  }

  if ((await prisma.supportTicket.count()) === 0) {
    await prisma.supportTicket.create({
      data: {
        ticketNumber: 'TKT-2026-0001',
        userId: ctx.demoStudentId,
        category: 'CERTIFICATES',
        priority: 'MEDIUM',
        status: 'OPEN',
        subjectAr: 'استفسار حول إصدار شهادة الكفاءة بعد إتمام الكورس',
        descriptionAr: 'أتممت 100% من دروس كورس إدارة مزارع الدواجن وأرغب في معرفة خطوات التقديم على شهادة الكفاءة المهنية.',
        assignedAgentId: createdAccounts.get('support@bosla-academy.com') ?? null,
        slaDueAt: new Date(Date.now() + 24 * 3600_000),
      },
    });
  }
}
