import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding BOSLA Academy database...');

  const defaultAdminPassword = await argon2.hash('BoslaAdmin#2026', {
    type: argon2.argon2id,
  });
  const defaultInstructorPassword = await argon2.hash('BoslaInstructor#2026', {
    type: argon2.argon2id,
  });
  const defaultStudentPassword = await argon2.hash('BoslaStudent#2026', {
    type: argon2.argon2id,
  });

  // 1. Principal Users (ADMIN, INSTRUCTOR, STUDENT)
  const admin = await prisma.user.upsert({
    where: { phoneE164: '+201000000001' },
    update: {},
    create: {
      fullName: 'إدارة أكاديمية بوصلة',
      email: 'admin@boslaagri.com',
      phoneE164: '+201000000001',
      passwordHash: defaultAdminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      authProvider: 'PHONE_PASSWORD',
      headlineAr: 'الإدارة التنفيذية لأكاديمية بوصلة',
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
    },
  });

  const instructorsSeed = [
    {
      phoneE164: '+201000000101',
      email: 'elhosseiny@boslaagri.com',
      fullName: 'د/ الحسيني داود',
      headlineAr: 'خبير إدارة مزارع الدواجن',
      bioAr: 'أكثر من ١٥ عامًا من الخبرة العملية في إدارة وتطوير مشروعات ومزارع الدواجن الحديثة في مصر والشرق الأوسط.',
      avatarUrl: '/images/brand/instructor-1.webp',
    },
    {
      phoneE164: '+201000000102',
      email: 'sayed.serag@boslaagri.com',
      fullName: 'د/ سيد سراج',
      headlineAr: 'استشاري تغذية الدواجن وصياغة العلائق',
      bioAr: 'متخصص في تركيب العلائق الاقتصادية وتعظيم معامل التحويل الغذائي لمزارع التسمين والبياض.',
      avatarUrl: '/images/brand/instructor-2.webp',
    },
    {
      phoneE164: '+201000000103',
      email: 'atef.sherif@boslaagri.com',
      fullName: 'د/ عاطف شريف',
      headlineAr: 'خبير الأمان الحيوي ومكافحة الأوبئة',
      bioAr: 'خبير تطبيق أنظمة الأمان الحيوي الصارمة والوقاية الوبائية لحماية القطعان التجارية.',
      avatarUrl: '/images/brand/instructor-3.webp',
    },
    {
      phoneE164: '+201000000104',
      email: 'yassin.eldeeb@boslaagri.com',
      fullName: 'م/ محمد ياسين الديب',
      headlineAr: 'خبير التسويق البيطري وإدارة المبيعات',
      bioAr: 'قيادي في شركات الأدوية والأعلاف البيطرية، متخصص في بناء فرق المبيعات والتسويق الميداني.',
      avatarUrl: '/images/brand/instructor-4.webp',
    },
    {
      phoneE164: '+201000000105',
      email: 'mohy.nawara@boslaagri.com',
      fullName: 'د/ محي نوارة',
      headlineAr: 'استشاري أمراض الدواجن والتحصين',
      bioAr: 'خبير التشخيص الحقلي وبرامج المناعة والتحصينات في قطعان الدواجن.',
      avatarUrl: '/images/brand/instructor-5.webp',
    },
    {
      phoneE164: '+201000000106',
      email: 'turki.saraqbi@boslaagri.com',
      fullName: 'د/ تركي سراقبي',
      headlineAr: 'خبير الإنتاج الداجني والتحكم البيئي',
      bioAr: 'متخصص في التهوية المغلقة والتحكم البيئي في عنابر التسمين والأمهات.',
      avatarUrl: '/images/brand/instructor-6.webp',
    },
    {
      phoneE164: '+201000000107',
      email: 'ahmed.elsharaky@boslaagri.com',
      fullName: 'م/ أحمد الشراكي',
      headlineAr: 'مدير تشغيل ومشروعات زراعية',
      bioAr: 'متخصص في إدارة سلاسل الإمداد والتشغيل المالي لمزارع ومصانع الإنتاج الحيواني.',
      avatarUrl: '/images/brand/instructor-7.webp',
    },
    {
      phoneE164: '+201000000108',
      email: 'ahmed.elshimy@boslaagri.com',
      fullName: 'د/ أحمد الشيمي',
      headlineAr: 'خبير الطب البيطري التطبيقي',
      bioAr: 'مدرب متخصص في تأهيل طلاب وخريجي الطب البيطري لسوق العمل العملي.',
      avatarUrl: '/images/brand/instructor-8.webp',
    },
  ];

  const instructors = [];
  for (const item of instructorsSeed) {
    const inst = await prisma.user.upsert({
      where: { phoneE164: item.phoneE164 },
      update: {
        fullName: item.fullName,
        headlineAr: item.headlineAr,
        bioAr: item.bioAr,
        avatarUrl: item.avatarUrl,
      },
      create: {
        ...item,
        passwordHash: defaultInstructorPassword,
        role: 'INSTRUCTOR',
        status: 'ACTIVE',
        authProvider: 'PHONE_PASSWORD',
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
    });
    instructors.push(inst);
  }

  const demoStudent = await prisma.user.upsert({
    where: { phoneE164: '+201000000201' },
    update: {},
    create: {
      fullName: 'أحمد محمد علي',
      email: 'student@boslaagri.com',
      phoneE164: '+201000000201',
      passwordHash: defaultStudentPassword,
      role: 'STUDENT',
      status: 'ACTIVE',
      authProvider: 'PHONE_PASSWORD',
      headlineAr: 'طالب بكلية الطب البيطري',
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
    },
  });

  // 2. Categories (from client's 9 tracks)
  const categoriesData = [
    {
      slug: 'poultry',
      nameAr: 'الدواجن',
      descriptionAr: 'كورسات إدارة مزارع الدواجن وتغذيتها والتحكم البيئي من الأساسيات إلى الاحتراف.',
      thumbnailUrl: '/images/brand/track-poultry.webp',
      isAvailable: true,
      sortOrder: 1,
    },
    {
      slug: 'veterinary',
      nameAr: 'الطب البيطري',
      descriptionAr: 'الأمان الحيوي وتشخيص الأمراض والرعاية البيطرية العملية للطلاب والخريجين.',
      thumbnailUrl: '/images/brand/track-vet.webp',
      isAvailable: true,
      sortOrder: 2,
    },
    {
      slug: 'marketing-sales',
      nameAr: 'التسويق والمبيعات',
      descriptionAr: 'تسويق المنتجات البيطرية واستراتيجيات المبيعات وبناء العلاقات في السوق المصري.',
      thumbnailUrl: '/images/brand/track-mkt.webp',
      isAvailable: true,
      sortOrder: 3,
    },
    {
      slug: 'cattle',
      nameAr: 'إنتاج الماشية',
      descriptionAr: 'إدارة مزارع الألبان والتسمين ورعاية المجترات.',
      thumbnailUrl: '/images/brand/track-cattle.webp',
      isAvailable: false,
      sortOrder: 4,
    },
    {
      slug: 'aquaculture',
      nameAr: 'الاستزراع السمكي',
      descriptionAr: 'أنظمة الاستزراع السمكي وجودة المياه وصحة الأحياء المائية.',
      thumbnailUrl: '/images/brand/track-fish.webp',
      isAvailable: false,
      sortOrder: 5,
    },
    {
      slug: 'pets',
      nameAr: 'الحيوانات الأليفة',
      descriptionAr: 'طب وجراحة ورعاية الحيوانات الأليفة والخيول.',
      thumbnailUrl: '/images/brand/track-pets.webp',
      isAvailable: false,
      sortOrder: 6,
    },
    {
      slug: 'laboratory',
      nameAr: 'التحاليل المخبرية',
      descriptionAr: 'التشخيص المخبري والميكروبيولوجيا وتحليل العينات البيطرية.',
      thumbnailUrl: '/images/brand/track-lab.webp',
      isAvailable: false,
      sortOrder: 7,
    },
    {
      slug: 'food-safety',
      nameAr: 'سلامة الغذاء والجودة',
      descriptionAr: 'HACCP وأيزو 22000 وتفتيش اللحوم والألبان ومنتجات الأصل الحيواني.',
      thumbnailUrl: '/images/brand/track-food.webp',
      isAvailable: false,
      sortOrder: 8,
    },
    {
      slug: 'ai-agritech',
      nameAr: 'الذكاء الاصطناعي',
      descriptionAr: 'تطبيقات الذكاء الاصطناعي وتحليل البيانات في المزارع وشركات الأجريبيزنس.',
      thumbnailUrl: '/images/brand/track-ai.webp',
      isAvailable: false,
      sortOrder: 9,
    },
  ];

  const categoriesBySlug: Record<string, string> = {};
  for (const cat of categoriesData) {
    const saved = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    categoriesBySlug[cat.slug] = saved.id;
  }

  // 3. Quizzes & Flagship Courses (4 Published + 1 Draft)
  const bioQuiz = await prisma.quiz.upsert({
    where: { id: 'seed-quiz-biosecurity' },
    update: {},
    create: {
      id: 'seed-quiz-biosecurity',
      titleAr: 'اختبار أساسيات الأمان الحيوي',
      descriptionAr: 'اختبر استيعابك لبروتوكولات العزل والتطهير ومنع انتقال العدوى داخل المزارع.',
      passingScorePercent: 70,
      createdById: instructors[2].id,
      questions: {
        create: [
          {
            questionTextAr: 'ما هو الهدف الأساسي من تطبيق الأمان الحيوي الهيكلي في مزارع الدواجن؟',
            options: [
              { id: 'a', textAr: 'إنشاء حواجز مادية وتنظيمية تمنع دخول مسببات الأمراض إلى المزرعة' },
              { id: 'b', textAr: 'زيادة استهلاك المضادات الحيوية الوقائية فقط' },
              { id: 'c', textAr: 'إلغاء الحاجة إلى التطهير بين الدورات' },
            ],
            correctOptionId: 'a',
            explanationAr: 'الأمان الحيوي الهيكلي يركز على الموقع، الأسوار، غرف التغيير، ومنع الاختلاط.',
            points: 1,
            sortOrder: 1,
          },
          {
            questionTextAr: 'ما الإجراء الصحيح عند دخول سيارة علف إلى المزرعة؟',
            options: [
              { id: 'a', textAr: 'السماح بدخولها دون تطهير إذا كانت قادمة من مزرعة مجاورة' },
              { id: 'b', textAr: 'إبقاء التفريغ خارج السور أو المرور عبر حوض وبوابة تطهير معتمدة بتركيز صحيح' },
              { id: 'c', textAr: 'غسل الإطارات بالماء فقط بدون مطهر' },
            ],
            correctOptionId: 'b',
            explanationAr: 'مركبات الأعلاف من أخطر نواقل العدوى بين المزارع وتتطلب نقطة تفريغ خارجية أو تطهير كامل.',
            points: 1,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const farmQuiz = await prisma.quiz.upsert({
    where: { id: 'seed-quiz-farm-mgmt' },
    update: {},
    create: {
      id: 'seed-quiz-farm-mgmt',
      titleAr: 'اختبار مؤشرات الأداء في مزارع التسمين',
      descriptionAr: 'حساب معامل التحويل الغذائي FCR ومؤشر الكفاءة الأوروبي EPEF.',
      passingScorePercent: 70,
      createdById: instructors[0].id,
      questions: {
        create: [
          {
            questionTextAr: 'إذا استهلك القطيع 3200 كجم علف لإنتاج 2000 كجم وزن حي، فما هو معامل التحويل الغذائي FCR؟',
            options: [
              { id: 'a', textAr: '1.60' },
              { id: 'b', textAr: '0.625' },
              { id: 'c', textAr: '2.10' },
            ],
            correctOptionId: 'a',
            explanationAr: 'FCR = إجمالي العلف المستهلك ÷ إجمالي الوزن الحي = 3200 ÷ 2000 = 1.60.',
            points: 1,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  const coursesSeed = [
    {
      slug: 'poultry-farm-management',
      instructorId: instructors[0].id,
      categoryId: categoriesBySlug['poultry'],
      isFree: false,
      difficulty: 'INTERMEDIATE' as const,
      featuredOrder: 1,
      titleAr: 'إدارة مزارع الدواجن الحديثة',
      subtitleAr: 'من تجهيز العنبر حتى التسويق وحساب الربحية',
      descriptionAr:
        'مسار عملي شامل لإدارة مزارع التسمين والبياض في السوق المصري: تجهيز واستقبال الكتاكيت، إدارة التهوية والحرارة والرطوبة، متابعة الأوزان ومعدلات التحويل، وبناء تقارير التشغيل اليومية والمالية.',
      thumbnailUrl: '/images/brand/course-farm-management.webp',
      durationMinutes: 340,
      learningObjectives: [
        'إعداد خطة استقبال الكتاكيت خلال أول ٧ أيام باحترافية',
        'حساب وتحليل مؤشرات الأداء FCR و EPEF وتقليل الفاقد',
        'إدارة أنظمة التهوية الدنيا والانتقالية والنفقية صيفًا وشتاءً',
        'قراءة القوائم المالية التشغيلية للدورة واتخاذ قرارات البيع',
      ],
      requirements: ['اهتمام بالعمل في قطاع الدواجن أو دراسة الطب البيطري / الزراعة'],
      sections: [
        {
          titleAr: 'الوحدة الأولى: التجهيز والاستقبال',
          sortOrder: 1,
          lessons: [
            {
              stableKey: 'farm-intro',
              titleAr: 'مقدمة في الإدارة الحديثة لمزارع الدواجن',
              type: 'ARTICLE' as const,
              isFreePreview: true,
              durationSeconds: 420,
              sortOrder: 1,
              articleContentAr:
                'تبدأ إدارة المزرعة الناجحة قبل وصول الكتكوت بأسبوعين عبر التطهير القياسي، ضبط الفرشة، ومعايرة حساسات الحرارة والرطوبة والتهوية الدنيا. في هذه المنصة ستتدرج من أساسيات المزرعة حتى إعداد تقرير الإدارة المالية للدورة.',
            },
            {
              stableKey: 'farm-reception',
              titleAr: 'بروتوكول استقبال الكتكوت خلال أول ٧٢ ساعة',
              type: 'ARTICLE' as const,
              isFreePreview: false,
              durationSeconds: 780,
              sortOrder: 2,
              articleContentAr:
                'يشمل فحص حرارة الأرضية (٣٠-٣٢ مئوية)، اختبار امتلاء الحوصلة عند ٢٤ ساعة بنسبة تتجاوز ٩٥٪، وضبط شدة الإضاءة وتوزيع المعالف والسقايات.',
            },
            {
              stableKey: 'farm-kpi-quiz',
              titleAr: 'تقييم مؤشرات الأداء FCR',
              type: 'QUIZ' as const,
              isFreePreview: false,
              durationSeconds: 300,
              sortOrder: 3,
              quizId: farmQuiz.id,
            },
          ],
        },
      ],
    },
    {
      slug: 'poultry-feed-formulation',
      instructorId: instructors[1].id,
      categoryId: categoriesBySlug['poultry'],
      isFree: false,
      difficulty: 'ADVANCED' as const,
      featuredOrder: 2,
      titleAr: 'فن صياغة وتركيب العلائق للدواجن',
      subtitleAr: 'صياغة العلائق المثلى لأعلى إنتاجية وأقل تكلفة تغذية',
      descriptionAr:
        'تعلم الاحتياجات الغذائية حسب السلالة والعمر، تقييم جودة الخامات (الذرة، الصويا، الجلوتين، الإضافات)، واستخدام البرمجة الخطية لإنتاج علائق اقتصادية متوازنة.',
      thumbnailUrl: '/images/brand/course-feed-formulation.webp',
      durationMinutes: 260,
      learningObjectives: [
        'حساب توازن الطاقة والأحماض الأمينية المهضومة',
        'تقييم جودة خامات الأعلاف وتفادي السموم الفطرية',
        'تصميم علائق البادي والنامي والناهي بأقل تكلفة للطن',
      ],
      requirements: ['معرفة مبدئية بمكونات الأعلاف أو إنتاج الدواجن'],
      sections: [
        {
          titleAr: 'الوحدة الأولى: أسس التغذية والخامات',
          sortOrder: 1,
          lessons: [
            {
              stableKey: 'feed-basics',
              titleAr: 'تقييم خامات الأعلاف والطاقة الممثلة',
              type: 'ARTICLE' as const,
              isFreePreview: true,
              durationSeconds: 540,
              sortOrder: 1,
              articleContentAr:
                'تمثل التغذية نحو ٧٠٪ من تكلفة الإنتاج الداجني. يتناول هذا الدرس طرق التحليل الكيميائي لخامات الذرة وكسب الصويا وضبط نسبة البروتين والطاقة.',
            },
          ],
        },
      ],
    },
    {
      slug: 'biosecurity-fundamentals',
      instructorId: instructors[2].id,
      categoryId: categoriesBySlug['veterinary'],
      isFree: true,
      difficulty: 'BEGINNER' as const,
      featuredOrder: 3,
      titleAr: 'أساسيات الأمان الحيوي ومكافحة الأوبئة',
      subtitleAr: 'كورس مجاني — بروتوكولات الأمان الحيوي لحماية القطعان',
      descriptionAr:
        'ابدأ رحلتك في أكاديمية بوصلة بهذا الكورس المجاني التطبيقي: العزل الحيوي، برامج التطهير الفعالة، إدارة حركة الأفراد والمعدات، ومنع تسرب الأمراض الفيروسية والبكتيرية.',
      thumbnailUrl: '/images/brand/course-biosecurity.webp',
      durationMinutes: 150,
      learningObjectives: [
        'بناء خطة أمان حيوي عملية للمزرعة بخطوات قابلة للتطبيق',
        'اختيار المطهرات المناسبة حسب نوع المسبب المرضي ودرجة العسر',
        'إدارة سجل الزوار وحركة المركبات والمخلفات الآمنة',
      ],
      requirements: ['لا توجد متطلبات مسبقة — متاح مجانًا للطلاب والخريجين'],
      sections: [
        {
          titleAr: 'الوحدة الأولى: ركائز الأمان الحيوي',
          sortOrder: 1,
          lessons: [
            {
              stableKey: 'bio-pillars',
              titleAr: 'الأمان الحيوي التصوري والهيكلي والتشغيلي',
              type: 'ARTICLE' as const,
              isFreePreview: true,
              durationSeconds: 480,
              sortOrder: 1,
              articleContentAr:
                'ينقسم الأمان الحيوي إلى ثلاثة مستويات متكاملة: التصوري (اختيار الموقع والبعد عن المزارع الأخرى)، الهيكلي (الأسوار ومغاطس التطهير)، والتشغيلي (الانضباط اليومي للعمال والزوار).',
            },
            {
              stableKey: 'bio-quiz',
              titleAr: 'اختبار الأمان الحيوي التطبيقي',
              type: 'QUIZ' as const,
              isFreePreview: true,
              durationSeconds: 300,
              sortOrder: 2,
              quizId: bioQuiz.id,
            },
          ],
        },
      ],
    },
    {
      slug: 'vet-marketing-strategies',
      instructorId: instructors[3].id,
      categoryId: categoriesBySlug['marketing-sales'],
      isFree: false,
      difficulty: 'INTERMEDIATE' as const,
      featuredOrder: 4,
      titleAr: 'التسويق البيطري واستراتيجيات البيع',
      subtitleAr: 'بناء مسيرة المندوب الطبي ومدير المبيعات في السوق البيطري',
      descriptionAr:
        'تعلم مهارات البيع الاستشاري للأدوية واللقاحات والأعلاف البيطرية، إدارة مناطق البيع، التفاوض مع الموزعين وأصحاب المزارع، ومتابعة التحصيل والأهداف البيعية.',
      thumbnailUrl: '/images/brand/course-vet-marketing.webp',
      durationMinutes: 220,
      learningObjectives: [
        'إدارة الزيارة البيعية للمزرعة أو العيادة باحترافية',
        'التعامل مع الاعتراضات السعرية والفنية بثقة',
        'بناء خطة منطقة بيعية ورفع معدل الاحتفاظ بالعملاء',
      ],
      requirements: ['مناسب لطلاب وخريجي الطب البيطري والزراعة والعاملين بالمبيعات'],
      sections: [
        {
          titleAr: 'الوحدة الأولى: البيع الاستشاري في الأجريبيزنس',
          sortOrder: 1,
          lessons: [
            {
              stableKey: 'mkt-consultative',
              titleAr: 'من البيع التقليدي إلى الشراكة الاستشارية مع المربي',
              type: 'ARTICLE' as const,
              isFreePreview: true,
              durationSeconds: 600,
              sortOrder: 1,
              articleContentAr:
                'المربي لا يشتري عبوة دواء فقط؛ بل يشتري أمان القطيع وتقليل النفوق وزيادة العائد. يتناول الدرس خطوات بناء الثقة وتحليل احتياج العميل قبل طرح الحل.',
            },
          ],
        },
      ],
    },
  ];

  const coursesBySlug: Record<string, string> = {};
  for (const c of coursesSeed) {
    let existing = await prisma.course.findUnique({ where: { slug: c.slug } });
    if (!existing) {
      existing = await prisma.course.create({
        data: {
          slug: c.slug,
          instructorId: c.instructorId,
          categoryId: c.categoryId,
          status: 'PUBLISHED',
          isFree: c.isFree,
          difficulty: c.difficulty,
          publishedAt: new Date(),
          featuredOrder: c.featuredOrder,
        },
      });
      const version = await prisma.courseVersion.create({
        data: {
          courseId: existing.id,
          versionNumber: 1,
          status: 'PUBLISHED',
          titleAr: c.titleAr,
          subtitleAr: c.subtitleAr,
          descriptionAr: c.descriptionAr,
          thumbnailUrl: c.thumbnailUrl,
          durationMinutes: c.durationMinutes,
          learningObjectives: c.learningObjectives,
          requirements: c.requirements,
          submittedAt: new Date(),
          reviewedById: admin.id,
          reviewedAt: new Date(),
          reviewNotes: 'معتمد ومنشور عند الإطلاق',
          publishedById: admin.id,
          publishedAt: new Date(),
          sections: {
            create: c.sections.map((sec) => ({
              titleAr: sec.titleAr,
              sortOrder: sec.sortOrder,
              lessons: {
                create: sec.lessons.map((l) => ({
                  stableKey: l.stableKey,
                  titleAr: l.titleAr,
                  type: l.type,
                  isFreePreview: l.isFreePreview,
                  durationSeconds: l.durationSeconds,
                  sortOrder: l.sortOrder,
                  articleContentAr: l.articleContentAr,
                  quizId: 'quizId' in l ? l.quizId : undefined,
                })),
              },
            })),
          },
        },
      });
      await prisma.course.update({
        where: { id: existing.id },
        data: { publishedVersionId: version.id, draftVersionId: version.id },
      });
    }
    coursesBySlug[c.slug] = existing.id;
  }

  // 4. Learning Paths (reusing existing courses without duplication)
  const poultryPath = await prisma.learningPath.upsert({
    where: { slug: 'poultry-specialist-path' },
    update: {},
    create: {
      slug: 'poultry-specialist-path',
      titleAr: 'مسار أخصائي إنتاج وإدارة الدواجن',
      subtitleAr: 'من الأمان الحيوي إلى إدارة المزارع وصياغة العلائق',
      descriptionAr:
        'مسار تعليمي متسلسل يربط بين الأمان الحيوي وإدارة مزارع الدواجن وتغذيتها لتأهيل الطالب أو الخريج لقيادة العنابر والمزارع بكفاءة.',
      thumbnailUrl: '/images/brand/track-poultry.webp',
      learningObjectives: [
        'إتقان الأمان الحيوي ومنع الأوبئة',
        'قيادة التشغيل اليومي لمزارع الدواجن',
        'تصميم العلائق وتحسين معامل التحويل الغذائي',
      ],
      completionCriteria: { requireAllCourses: true, minQuizAveragePercent: 70 },
      status: 'PUBLISHED',
      publishedAt: new Date(),
      featuredOrder: 1,
      courses: {
        create: [
          { courseId: coursesBySlug['biosecurity-fundamentals'], sortOrder: 1, isRequired: true },
          { courseId: coursesBySlug['poultry-farm-management'], sortOrder: 2, isRequired: true },
          { courseId: coursesBySlug['poultry-feed-formulation'], sortOrder: 3, isRequired: true },
        ],
      },
    },
  });

  const vetCareerPath = await prisma.learningPath.upsert({
    where: { slug: 'vet-commercial-leader-path' },
    update: {},
    create: {
      slug: 'vet-commercial-leader-path',
      titleAr: 'مسار القيادة التجارية والتسويق البيطري',
      subtitleAr: 'من الطالب إلى المندوب الطبي ومدير المنطقة',
      descriptionAr:
        'يجمع هذا المسار بين المعرفة الفنية بالأمان الحيوي وإدارة المزارع وبين مهارات التسويق والبيع الاستشاري في شركات الأدوية والأعلاف البيطرية.',
      thumbnailUrl: '/images/brand/track-mkt.webp',
      learningObjectives: [
        'فهم لغة المربي والمزارع واحتياجات القطيع',
        'بناء علاقات مستدامة مع الموزعين وكبار العملاء',
        'التخطيط لمسار التدرج الوظيفي من مندوب إلى مدير مبيعات',
      ],
      completionCriteria: { requireAllCourses: true, minQuizAveragePercent: 70 },
      status: 'PUBLISHED',
      publishedAt: new Date(),
      featuredOrder: 2,
      courses: {
        create: [
          { courseId: coursesBySlug['biosecurity-fundamentals'], sortOrder: 1, isRequired: true },
          { courseId: coursesBySlug['vet-marketing-strategies'], sortOrder: 2, isRequired: true },
          { courseId: coursesBySlug['poultry-farm-management'], sortOrder: 3, isRequired: false },
        ],
      },
    },
  });

  // 5. Diplomas (140-hour Poultry Diploma + Vet Marketing Diploma reusing existing courses)
  const poultryDiploma = await prisma.diploma.upsert({
    where: { slug: 'poultry-farm-management-diploma' },
    update: {},
    create: {
      slug: 'poultry-farm-management-diploma',
      titleAr: 'الدبلومة المهنية في إدارة مزارع الدواجن',
      subtitleAr: '١٤٠ ساعة — ١٢ وحدة و١٠ مهام محاكاة عملية',
      descriptionAr:
        'بدل ما تحفظ، تدير مزرعة افتراضية وتواجه عشر مهام قرار، وتتعلم من نتيجة كل قرار. تشمل الكورسات الأساسية في الأمان الحيوي وإدارة المزارع وصياغة العلائق مع مشروع تخرج تطبيقي.',
      thumbnailUrl: '/images/brand/course-farm-management.webp',
      totalHours: 140,
      hourBreakdown: [
        { label: '٧٠ ساعة محتوى أساسي', hours: 70, color: '#6f86ff' },
        { label: '٣٠ ساعة تطبيق عملي', hours: 30, color: '#9bb0ff' },
        { label: '٢٠ ساعة دراسات حالة', hours: 20, color: '#1fa574' },
        { label: '٢٠ ساعة مشروع التخرج', hours: 20, color: '#f5b94a' },
      ],
      completionRequirements: {
        requireAllCourses: true,
        minAssessmentScorePercent: 75,
        requireFinalProject: true,
      },
      hasOptionalFinalProject: false,
      certificateEnabled: true,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      featuredOrder: 1,
      courses: {
        create: [
          { courseId: coursesBySlug['biosecurity-fundamentals'], sortOrder: 1, isRequired: true },
          { courseId: coursesBySlug['poultry-farm-management'], sortOrder: 2, isRequired: true },
          { courseId: coursesBySlug['poultry-feed-formulation'], sortOrder: 3, isRequired: true },
        ],
      },
      assessments: {
        create: [
          {
            titleAr: 'مشروع التخرج: خطة تشغيل دورة تسمين متكاملة (٥٠ ألف طائر)',
            descriptionAr:
              'قدّم خطة متكاملة تشمل الأمان الحيوي، جدول العلف والتكلفة المتوقعة، ومنحنى درجات الحرارة والتهوية.',
            isFinalProject: true,
            isOptional: false,
            passingScorePercent: 75,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  const mktDiploma = await prisma.diploma.upsert({
    where: { slug: 'vet-marketing-sales-diploma' },
    update: {},
    create: {
      slug: 'vet-marketing-sales-diploma',
      titleAr: 'الدبلومة المهنية في التسويق والمبيعات للشركات البيطرية',
      subtitleAr: 'من الأساسيات إلى الاحتراف لمن يعمل في شركات الأدوية والأعلاف والمنتجات البيطرية',
      descriptionAr:
        'تغطي الأساسيات، التسويق الرقمي، بناء العلامة التجارية، استراتيجيات المبيعات، التحليل والبيانات، والاحتراف وبناء المسيرة المهنية.',
      thumbnailUrl: '/images/brand/course-vet-marketing.webp',
      totalHours: 90,
      hourBreakdown: [
        { label: '٤٠ ساعة استراتيجيات ومبيعات', hours: 40, color: '#6f86ff' },
        { label: '٢٥ ساعة تسويق رقمي وبناء علامة', hours: 25, color: '#9bb0ff' },
        { label: '١٥ ساعة تحليل بيانات السوق', hours: 15, color: '#1fa574' },
        { label: '١٠ ساعات خطة مسار مهني', hours: 10, color: '#f5b94a' },
      ],
      completionRequirements: {
        requireAllCourses: true,
        minAssessmentScorePercent: 70,
        requireFinalProject: false,
      },
      hasOptionalFinalProject: true,
      certificateEnabled: true,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      featuredOrder: 2,
      courses: {
        create: [
          { courseId: coursesBySlug['vet-marketing-strategies'], sortOrder: 1, isRequired: true },
          { courseId: coursesBySlug['biosecurity-fundamentals'], sortOrder: 2, isRequired: true },
        ],
      },
    },
  });

  // 6. Academy-wide Memberships (Monthly & Annual) + Revisions
  const existingMonthly = await prisma.membershipPlan.findUnique({ where: { slug: 'monthly' } });
  if (!existingMonthly) {
    const monthly = await prisma.membershipPlan.create({
      data: {
        slug: 'monthly',
        interval: 'MONTHLY',
        nameAr: 'العضوية الشهرية الشاملة',
        descriptionAr: 'وصول كامل شهريًا لجميع الكورسات والمسارات والدبلومات المشمولة في الأكاديمية مع الاختبارات والشهادات.',
        priceCents: 39900,
        compareAtPriceCents: 60000,
        discountLabelAr: 'عرض الإطلاق ٣٣٪',
        currency: 'EGP',
        isActive: true,
        isVisible: true,
        sortOrder: 1,
      },
    });
    const monthlyRev = await prisma.membershipPlanRevision.create({
      data: {
        planId: monthly.id,
        versionNumber: 1,
        priceCents: monthly.priceCents,
        entitlementMode: 'FOLLOW_LATEST_PLAN',
        notesAr: 'النسخة التأسيسية للعضوية الشهرية',
        createdById: admin.id,
        courses: {
          create: Object.values(coursesBySlug).map((courseId) => ({ courseId })),
        },
        learningPaths: {
          create: [{ learningPathId: poultryPath.id }, { learningPathId: vetCareerPath.id }],
        },
        diplomas: {
          create: [{ diplomaId: poultryDiploma.id }, { diplomaId: mktDiploma.id }],
        },
      },
    });
    await prisma.membershipPlan.update({
      where: { id: monthly.id },
      data: { currentRevisionId: monthlyRev.id },
    });
  }

  const existingAnnual = await prisma.membershipPlan.findUnique({ where: { slug: 'annual' } });
  if (!existingAnnual) {
    const annual = await prisma.membershipPlan.create({
      data: {
        slug: 'annual',
        interval: 'ANNUAL',
        nameAr: 'العضوية السنوية الاحترافية',
        descriptionAr: 'أفضل قيمة: وصول سنوي كامل لكل الكورسات والمسارات والدبلومات والتحديثات المستمرة مع أولوية التقييمات والشهادات.',
        priceCents: 299000,
        compareAtPriceCents: 478800,
        discountLabelAr: 'وفّر ٣٨٪ سنويًا',
        currency: 'EGP',
        isActive: true,
        isVisible: true,
        sortOrder: 2,
      },
    });
    const annualRev = await prisma.membershipPlanRevision.create({
      data: {
        planId: annual.id,
        versionNumber: 1,
        priceCents: annual.priceCents,
        entitlementMode: 'FOLLOW_LATEST_PLAN',
        notesAr: 'النسخة التأسيسية للعضوية السنوية',
        createdById: admin.id,
        courses: {
          create: Object.values(coursesBySlug).map((courseId) => ({ courseId })),
        },
        learningPaths: {
          create: [{ learningPathId: poultryPath.id }, { learningPathId: vetCareerPath.id }],
        },
        diplomas: {
          create: [{ diplomaId: poultryDiploma.id }, { diplomaId: mktDiploma.id }],
        },
      },
    });
    await prisma.membershipPlan.update({
      where: { id: annual.id },
      data: { currentRevisionId: annualRev.id },
    });
  }

  // Give demo student an active subscription so local verification works immediately
  const annualPlan = await prisma.membershipPlan.findUnique({ where: { slug: 'annual' } });
  if (annualPlan?.currentRevisionId) {
    const existingSub = await prisma.subscription.findFirst({
      where: { userId: demoStudent.id, status: 'ACTIVE' },
    });
    if (!existingSub) {
      await prisma.subscription.create({
        data: {
          userId: demoStudent.id,
          planId: annualPlan.id,
          planRevisionId: annualPlan.currentRevisionId,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          autoRenewSupported: false,
        },
      });
    }
  }

  // 7. CMS Pages, Testimonials, Partners, FAQs & Site Settings
  await prisma.cmsPage.upsert({
    where: { slug: 'home' },
    update: {},
    create: {
      slug: 'home',
      titleAr: 'أكاديمية بوصلة | من الطالب إلى المدير',
      seoTitleAr: 'أكاديمية بوصلة | من الطالب إلى المدير في الطب البيطري والأجريبيزنس',
      seoDescriptionAr:
        'مسارات تعليمية وتدريبية عملية في القطاع البيطري والأجريبيزنس، من التعلّم إلى الاحتراف عبر عضوية أكاديمية شاملة.',
      isPublished: true,
      updatedById: admin.id,
      sections: {
        hero: {
          titleAr: 'أكاديمية بوصلة',
          sloganAr: 'من الطالب إلى المدير',
          subtitleAr:
            'مستقبل التعليم البيطري والأجريبيزنس: مسارات عملية من أول سنة في الكلية حتى قيادة المزرعة أو المصنع أو الشركة.',
          leadAr: 'مسارات تعليمية وتدريبية تطوّر مهاراتك العملية، وتجهّزك لسوق العمل المصري والعربي.',
          heroImageUrl: '/images/brand/hero-banner.webp',
          promoBadgeAr: 'ابدأ مجانًا بكورس الأمان الحيوي أو اشترك في العضوية الشاملة',
        },
        stats: [
          { value: '+5000', label: 'طالب نشط' },
          { value: '+200', label: 'فرصة تدريب وشغل' },
          { value: '+50', label: 'شركة شريكة' },
          { value: '4.9 ★', label: 'متوسط التقييم' },
        ],
        personas: [
          {
            titleAr: 'طالب في الكلية',
            subtitleAr: 'أبني أساس مهني قبل التخرج',
            recommendedCourseSlug: 'biosecurity-fundamentals',
            steps: [
              ['سنة أولى وثانية: الأساس', '٤–٦ أسابيع'],
              ['سنة ثالثة: التطبيق', '٦–٨ أسابيع'],
              ['سنة رابعة: التخصص', '٨–١٢ أسبوعًا'],
              ['قبل التخرج: الانطلاق', '٢–٣ أسابيع'],
            ],
          },
          {
            titleAr: 'خريج جديد',
            subtitleAr: 'أدخل سوق العمل بثقة',
            recommendedCourseSlug: 'poultry-farm-management',
            steps: [
              ['الأساس المشترك', '٢–٣ أسابيع'],
              ['التخصص', '٨–١٢ أسبوعًا'],
              ['التعميق المهني', '٤–٦ أسابيع'],
              ['الانطلاق', 'أسبوعان'],
            ],
          },
          {
            titleAr: 'شغال في شركة أو مصنع',
            subtitleAr: 'أتطور وأترقى في شغلي',
            recommendedCourseSlug: 'vet-marketing-strategies',
            steps: [
              ['ابدأ بالأساس', '٤–٦ أسابيع'],
              ['طبّق في موقعك', '٦–٨ أسابيع'],
              ['ارتقِ بمستواك', '٤–٦ أسابيع'],
            ],
          },
          {
            titleAr: 'مدير أو صاحب منشأة',
            subtitleAr: 'أطوّر فريقي ومنشأتي',
            recommendedCourseSlug: 'poultry-farm-management',
            steps: [
              ['تأسيس الفريق', '٤–٦ أسابيع'],
              ['رفع الكفاءة', '٦–٨ أسابيع'],
              ['الإدارة والنمو', '٤–٦ أسابيع'],
            ],
          },
        ],
      },
    },
  });

  const staticPages = [
    {
      slug: 'about',
      titleAr: 'عن أكاديمية بوصلة',
      seoTitleAr: 'عن أكاديمية بوصلة | رؤيتنا ورسالتنا',
      seoDescriptionAr: 'منصة الأجري-بيزنس الأولى لتأهيل طلاب وخريجي الطب البيطري والزراعة من الطالب إلى المدير.',
      sections: {
        bodyAr:
          'تعمل أكاديمية بوصلة على سد الفجوة بين الدراسة الأكاديمية ومتطلبات التشغيل الفعلي في المزارع ومصانع الأعلاف وشركات الأدوية البيطرية عبر مسارات عملية ودبلومات تطبيقية يقودها خبراء الصناعة.',
      },
    },
    {
      slug: 'contact',
      titleAr: 'تواصل معنا',
      seoTitleAr: 'تواصل مع فريق أكاديمية بوصلة',
      seoDescriptionAr: 'تواصل مع خدمة الطلاب أو اطلب برامج تدريب مخصصة للشركات والمصانع.',
      sections: {
        whatsapp: '+201001226683',
        email: 'support@boslaagri.com',
        addressAr: 'القاهرة، جمهورية مصر العربية',
      },
    },
    {
      slug: 'privacy',
      titleAr: 'سياسة الخصوصية',
      seoTitleAr: 'سياسة الخصوصية | أكاديمية بوصلة',
      seoDescriptionAr: 'كيف تحمي أكاديمية بوصلة بيانات الطلاب وحساباتهم ومفاتيح المرور.',
      sections: {
        bodyAr:
          'تلتزم أكاديمية بوصلة بحماية خصوصية بياناتك الشخصية والتعليمية. نستخدم التشفير القياسي لكلمات المرور (Argon2id) ومفاتيح المرور (WebAuthn/FIDO2) ولا نشارك بياناتك مع أطراف خارجية غير مصرح لها.',
      },
    },
    {
      slug: 'terms',
      titleAr: 'الشروط والأحكام',
      seoTitleAr: 'الشروط والأحكام | أكاديمية بوصلة',
      seoDescriptionAr: 'شروط استخدام منصة أكاديمية بوصلة والعضويات التعليمية.',
      sections: {
        bodyAr:
          'العضوية شخصية وتمنحك حق الوصول إلى المحتوى التعليمي المشمول طوال فترة الاشتراك الساري. يُحظر إعادة توزيع أو مشاركة الفيديوهات أو المواد التدريبية خارج المنصة.',
      },
    },
  ];

  for (const page of staticPages) {
    await prisma.cmsPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: { ...page, isPublished: true, updatedById: admin.id },
    });
  }

  if ((await prisma.cmsTestimonial.count()) === 0) {
    await prisma.cmsTestimonial.createMany({
      data: [
        {
          studentNameAr: 'أحمد محمد علي',
          roleTitleAr: 'مندوب طبي',
          companyAr: 'Poulpharm Egypt',
          quoteAr: 'بوصلة غيّرت مساري تمامًا. من طالب مش عارف يروح فين، لمندوب طبي في شركة دواجن كبيرة في ٣ شهور بس.',
          rating: 5,
          sortOrder: 1,
        },
        {
          studentNameAr: 'منة الله كرم',
          roleTitleAr: 'مديرة مزرعة',
          companyAr: 'Delta Farms Group',
          quoteAr: 'الكورسات العملية والإرشاد فرّقوا معايا كتير. حسيت إني بتعلم من ناس شايفة السوق من جوّه مش من بره.',
          rating: 5,
          sortOrder: 2,
        },
        {
          studentNameAr: 'عمر السيد',
          roleTitleAr: 'أخصائي تغذية',
          companyAr: 'Cargill Egypt',
          quoteAr: 'بوصلة تستاهل أضعاف سعرها. خريطة المسار اللي أخدتها وضّحت لي كل خطوة محتاج أعملها.',
          rating: 5,
          sortOrder: 3,
        },
      ],
    });
  }

  if ((await prisma.cmsPartner.count()) === 0) {
    await prisma.cmsPartner.createMany({
      data: [
        {
          nameAr: 'شركة تراست كير Trust Care',
          logoUrl: '/images/brand/partner-trust-care.webp',
          descriptionAr: 'شريك نجاح في التدريب التطبيقي للقطاع البيطري.',
          sortOrder: 1,
        },
        {
          nameAr: 'أمّات OMMAT',
          logoUrl: '/images/brand/partner-ommat.webp',
          descriptionAr: 'شريك نجاح في صناعة الدواجن وإنتاج الأمهات.',
          sortOrder: 2,
        },
      ],
    });
  }

  if ((await prisma.cmsFaq.count()) === 0) {
    await prisma.cmsFaq.createMany({
      data: [
        {
          questionAr: 'هل المحتوى مناسب لطلاب لسه بيدرسوا؟',
          answerAr: 'أيوه، المحتوى مرتب من الأساسيات للاحترافية، ومناسب من السنة الأولى حتى الخريجين الجدد.',
          sortOrder: 1,
        },
        {
          questionAr: 'هل في فرص تدريب وشغل حقيقية؟',
          answerAr: 'بنعمل شراكات مع شركات في الأجريبيزنس، وتقدر تقدّم على الفرص المتاحة من خلال المنصة.',
          sortOrder: 2,
        },
        {
          questionAr: 'أنا شغال بدوام كامل، هل ينفع معايا؟',
          answerAr: 'أيوه، التعلّم أونلاين ومرن، فتقدر تتعلم بعد ساعات العمل وتطبّق مباشرة في موقعك.',
          sortOrder: 3,
        },
        {
          questionAr: 'هل في متابعة ودعم؟',
          answerAr: 'أيوه، فيه إرشاد من خبراء ومجتمع من الطلاب والمتخصصين وفريق دعم يساعدك.',
          sortOrder: 4,
        },
      ],
    });
  }

  await prisma.siteSetting.upsert({
    where: { key: 'platform' },
    update: {},
    create: {
      key: 'platform',
      updatedById: admin.id,
      value: {
        siteNameAr: 'أكاديمية بوصلة',
        siteNameEn: 'BOSLA ACADEMY',
        sloganAr: 'من الطالب إلى المدير',
        whatsappNumber: '201001226683',
        supportEmail: 'support@boslaagri.com',
        socialLinks: {
          facebook: 'https://www.facebook.com/BoslaAgri',
          instagram: 'https://www.instagram.com/bosla_career/',
          whatsapp: 'https://wa.me/201001226683',
        },
        videoPolicy: {
          maxUploadBytes: 2147483648,
          instructorQuotaBytes: 21474836480,
          allowedQualities: ['480p', '720p', '1080p'],
          diskAlertThresholdPercent: 85,
        },
      },
    },
  });

  // 8. Specialization Finder (Database-driven career quiz & taxonomy from client reference)
  if ((await prisma.specializationQuestion.count()) === 0) {
    await prisma.specializationQuestion.createMany({
      data: [
        {
          sortOrder: 1,
          promptAr: 'أكتر مادة حبيتها في الكلية؟',
          options: [
            { label: 'التشريح والباثولوجي', weights: 'c2l1', species: '' },
            { label: 'الميكروبيولوجي والمعمل', weights: 'l2q1', species: '' },
            { label: 'التغذية والإنتاج الحيواني', weights: 'p2d1', species: '' },
            { label: 'الأدوية والفارماكولوجي', weights: 'm1c1q1', species: '' },
          ],
        },
        {
          sortOrder: 2,
          promptAr: 'تحب يومك يعدّي فين؟',
          options: [
            { label: 'في مزرعة وسط القطعان', weights: 'p2c1', species: '' },
            { label: 'في عيادة أو مستشفى بيطري', weights: 'c2', species: '' },
            { label: 'في معمل ومعدات', weights: 'l2q1', species: '' },
            { label: 'في شركة وبين العملاء', weights: 'm2d1', species: '' },
            { label: 'في مصنع وخطوط إنتاج', weights: 'k2q1p1', species: '' },
            { label: 'في المخازن والتوريد والتصدير', weights: 's2p1', species: '' },
          ],
        },
        {
          sortOrder: 3,
          promptAr: 'أي حيوان أقرب لقلبك؟',
          options: [
            { label: 'الدواجن', weights: '', species: 'p' },
            { label: 'الماشية والأبقار', weights: '', species: 'r' },
            { label: 'الحيوانات الأليفة والخيول', weights: '', species: 't' },
            { label: 'الأسماك والاستزراع المائي', weights: '', species: 'f' },
            { label: 'مش فارق معايا', weights: '', species: '' },
          ],
        },
        {
          sortOrder: 4,
          promptAr: 'مشروع تخرجك المثالي؟',
          options: [
            { label: 'تحليل بيانات أداء مزرعة', weights: 'd2p1', species: '' },
            { label: 'تجربة معملية وبحث', weights: 'l2', species: '' },
            { label: 'خطة تسويق لمنتج بيطري', weights: 'm2', species: '' },
            { label: 'حالة علاجية وتشخيص', weights: 'c2', species: '' },
            { label: 'تحسين خط إنتاج أو نظام جودة', weights: 'k2q1', species: '' },
            { label: 'خطة مالية وتشغيلية لشركة', weights: 'b2d1', species: '' },
          ],
        },
        {
          sortOrder: 5,
          promptAr: 'إيه أهم حاجة في الوظيفة؟',
          options: [
            { label: 'دخل أعلى وفرص نمو سريعة', weights: 'm2p1', species: '' },
            { label: 'استقرار ونظام واضح', weights: 'q2', species: '' },
            { label: 'خبرة علمية عميقة وسمعة', weights: 'l1c1d1', species: '' },
            { label: 'حرية وبناء مشروعي', weights: 'm1p1d1', species: '' },
          ],
        },
        {
          sortOrder: 6,
          promptAr: 'بعد التخرج عايز؟',
          options: [
            { label: 'تدريب عملي في مزرعة مباشرة', weights: 'p2c1', species: '' },
            { label: 'ماجستير ودراسات عليا', weights: 'l2d1', species: '' },
            { label: 'شركة أدوية أو أعلاف', weights: 'm1q1p1', species: '' },
            { label: 'عيادة أو مستشفى', weights: 'c2', species: '' },
            { label: 'إدارة سلسلة توريد وتصدير', weights: 's2m1', species: '' },
            { label: 'منصب إداري داخل شركة', weights: 'b2d1', species: '' },
          ],
        },
      ],
    });
  }

  if ((await prisma.specializationDomain.count()) === 0) {
    const domainsSeed: Array<{
      slug: string;
      nameAr: string;
      descriptionAr: string;
      weightsCode: string;
      speciesCode: string;
      subfields: Array<{
        nameAr: string;
        descriptionAr: string;
        leaves: Array<{ nameAr: string; courseSlug?: string }>;
      }>;
    }> = [
      {
        slug: 'poultry',
        nameAr: 'الدواجن',
        descriptionAr: 'صحة وإنتاج القطعان من الكتكوت للسوق',
        weightsCode: 'p2c1',
        speciesCode: 'p',
        subfields: [
          {
            nameAr: 'صحة القطعان',
            descriptionAr: 'تشخيص الأمراض والوقاية منها',
            leaves: [
              { nameAr: 'أمراض الدواجن' },
              { nameAr: 'التحصين والمناعة' },
              { nameAr: 'التشريح المرضي للدواجن' },
              { nameAr: 'الأمان الحيوي للمزارع', courseSlug: 'biosecurity-fundamentals' },
            ],
          },
          {
            nameAr: 'إنتاج التسمين',
            descriptionAr: 'إدارة دورة التسمين بكفاءة',
            leaves: [
              { nameAr: 'إدارة مزارع التسمين', courseSlug: 'poultry-farm-management' },
              { nameAr: 'التهوية والتحكم البيئي' },
              { nameAr: 'كفاءة التحويل الغذائي' },
            ],
          },
          {
            nameAr: 'البيض والأمهات',
            descriptionAr: 'إنتاج البيض والتفريخ',
            leaves: [
              { nameAr: 'إدارة الأمهات' },
              { nameAr: 'إدارة المفرخات' },
              { nameAr: 'إنتاج بيض المائدة' },
            ],
          },
        ],
      },
      {
        slug: 'nutrition-genetics',
        nameAr: 'التغذية والوراثة والتناسل',
        descriptionAr: 'علوم الإنتاج الحيواني التي ترفع الكفاءة',
        weightsCode: 'p2l1d1',
        speciesCode: '',
        subfields: [
          {
            nameAr: 'التغذية',
            descriptionAr: 'صياغة العلائق وجودتها',
            leaves: [
              { nameAr: 'صياغة العلائق', courseSlug: 'poultry-feed-formulation' },
              { nameAr: 'إضافات الأعلاف وبدائلها' },
              { nameAr: 'جودة الأعلاف والمواد الخام' },
              { nameAr: 'تصنيع الأعلاف' },
            ],
          },
          {
            nameAr: 'الوراثة والتربية',
            descriptionAr: 'تحسين السلالات بالانتخاب',
            leaves: [{ nameAr: 'الوراثة الكمية' }, { nameAr: 'الانتخاب الجينومي' }, { nameAr: 'برامج التربية' }],
          },
        ],
      },
      {
        slug: 'animal-health-industry',
        nameAr: 'صناعة الصحة الحيوانية',
        descriptionAr: 'الشركات التي تصنّع وتبيع وتسجّل الدواء والعلف',
        weightsCode: 'm2c1q1',
        speciesCode: '',
        subfields: [
          {
            nameAr: 'المبيعات والتسويق',
            descriptionAr: 'علاقات السوق والموزعين',
            leaves: [
              { nameAr: 'مبيعات الأدوية البيطرية', courseSlug: 'vet-marketing-strategies' },
              { nameAr: 'التسويق البيطري', courseSlug: 'vet-marketing-strategies' },
              { nameAr: 'إدارة الموزعين والحسابات' },
            ],
          },
          {
            nameAr: 'الدعم الفني',
            descriptionAr: 'حلقة الوصل بين المنتج والعميل',
            leaves: [{ nameAr: 'الدعم الفني الميداني' }, { nameAr: 'التدريب وتثقيف العملاء' }],
          },
        ],
      },
      {
        slug: 'agribusiness-management',
        nameAr: 'إدارة الأعمال والتقنية الزراعية',
        descriptionAr: 'إدارة المشروعات والبيانات وريادة الأعمال',
        weightsCode: 'd2p1m1',
        speciesCode: '',
        subfields: [
          {
            nameAr: 'إدارة المزارع',
            descriptionAr: 'تشغيل مالي وإداري ناجح',
            leaves: [
              { nameAr: 'إدارة المزارع', courseSlug: 'poultry-farm-management' },
              { nameAr: 'الإدارة المالية للمزرعة' },
              { nameAr: 'دراسة الجدوى وخطة العمل' },
            ],
          },
          {
            nameAr: 'التقنيات الذكية',
            descriptionAr: 'بيانات وأتمتة وحساسات',
            leaves: [{ nameAr: 'الزراعة الدقيقة' }, { nameAr: 'تحليل بيانات المزارع' }],
          },
        ],
      },
      {
        slug: 'pets-equine',
        nameAr: 'الحيوانات الأليفة والخيول',
        descriptionAr: 'تشخيص وعلاج الكلاب والقطط والخيول والحيوانات الغريبة',
        weightsCode: 'c2',
        speciesCode: 't',
        subfields: [
          {
            nameAr: 'الباطنة والأورام',
            descriptionAr: 'تشخيص الأمراض الداخلية وعلاجها',
            leaves: [{ nameAr: 'القلب والأوعية' }, { nameAr: 'الجهاز الهضمي والكلى' }],
          },
          {
            nameAr: 'الجراحة والتخدير',
            descriptionAr: 'غرف العمليات ورعاية ما حول الجراحة',
            leaves: [{ nameAr: 'جراحة الأنسجة الرخوة' }, { nameAr: 'جراحة العظام والمفاصل' }],
          },
        ],
      },
      {
        slug: 'cattle-ruminants',
        nameAr: 'الماشية والمجترات',
        descriptionAr: 'صحة وإنتاج الأبقار والأغنام',
        weightsCode: 'p2c1',
        speciesCode: 'r',
        subfields: [
          {
            nameAr: 'الأبقار',
            descriptionAr: 'ألبان ولحوم وعجول',
            leaves: [{ nameAr: 'صحة قطعان الألبان' }, { nameAr: 'إنتاج اللحم' }, { nameAr: 'تربية العجول' }],
          },
        ],
      },
      {
        slug: 'aquaculture',
        nameAr: 'الأسماك والاستزراع المائي',
        descriptionAr: 'صحة وإنتاج الأسماك والروبيان',
        weightsCode: 'p2l1',
        speciesCode: 'f',
        subfields: [
          {
            nameAr: 'صحة الأحياء المائية',
            descriptionAr: 'أمراض الأسماك وتشخيصها',
            leaves: [{ nameAr: 'أمراض الأسماك' }, { nameAr: 'الأمان الحيوي للمزارع السمكية' }],
          },
        ],
      },
      {
        slug: 'lab-research',
        nameAr: 'المعمل والبحث العلمي',
        descriptionAr: 'التشخيص والتجارب وراء الكواليس',
        weightsCode: 'l2c1',
        speciesCode: '',
        subfields: [
          {
            nameAr: 'الميكروبيولوجيا والمناعة',
            descriptionAr: 'الكائنات الدقيقة والمناعة واللقاحات',
            leaves: [{ nameAr: 'البكتيريا والفطريات' }, { nameAr: 'المناعة واللقاحات' }],
          },
        ],
      },
      {
        slug: 'food-safety-public-health',
        nameAr: 'الصحة العامة وسلامة الغذاء',
        descriptionAr: 'حماية الإنسان والحيوان معًا (الصحة الواحدة)',
        weightsCode: 'q2l1d1',
        speciesCode: '',
        subfields: [
          {
            nameAr: 'سلامة الغذاء',
            descriptionAr: 'من المزرعة إلى المائدة',
            leaves: [{ nameAr: 'تفتيش اللحوم والمجازر' }, { nameAr: 'HACCP وأيزو 22000' }],
          },
        ],
      },
      {
        slug: 'factories-food-processing',
        nameAr: 'المصانع والتصنيع الغذائي',
        descriptionAr: 'تشغيل مصانع الأعلاف واللحوم والألبان والبيض',
        weightsCode: 'k2q2p1',
        speciesCode: '',
        subfields: [
          {
            nameAr: 'مصانع الأعلاف',
            descriptionAr: 'إنتاج علف ثابت الجودة',
            leaves: [{ nameAr: 'تشغيل مصنع الأعلاف' }, { nameAr: 'ضبط جودة التصنيع' }],
          },
        ],
      },
      {
        slug: 'corporate-management',
        nameAr: 'الإدارة والأعمال المؤسسية',
        descriptionAr: 'قيادة الشركات وأرقامها وفرقها',
        weightsCode: 'b2d2m1',
        speciesCode: '',
        subfields: [
          {
            nameAr: 'المبيعات والحسابات',
            descriptionAr: 'بيع للشركات وإدارة العملاء الكبار',
            leaves: [{ nameAr: 'مبيعات الشركات B2B' }, { nameAr: 'إدارة الحسابات الرئيسية' }],
          },
        ],
      },
      {
        slug: 'supply-chain-trade',
        nameAr: 'سلاسل الإمداد والتجارة',
        descriptionAr: 'من المورّد للعميل وللتصدير',
        weightsCode: 's2m1d1',
        speciesCode: '',
        subfields: [
          {
            nameAr: 'اللوجستيات والتصدير',
            descriptionAr: 'نقل وتصدير وتخطيط',
            leaves: [{ nameAr: 'النقل المبرد' }, { nameAr: 'التصدير والجمارك' }],
          },
        ],
      },
    ];

    let dOrder = 1;
    for (const dom of domainsSeed) {
      await prisma.specializationDomain.create({
        data: {
          slug: dom.slug,
          nameAr: dom.nameAr,
          descriptionAr: dom.descriptionAr,
          weightsCode: dom.weightsCode,
          speciesCode: dom.speciesCode,
          sortOrder: dOrder++,
          subfields: {
            create: dom.subfields.map((sf, sIdx) => ({
              nameAr: sf.nameAr,
              descriptionAr: sf.descriptionAr,
              sortOrder: sIdx + 1,
              leaves: {
                create: sf.leaves.map((lf, lIdx) => ({
                  nameAr: lf.nameAr,
                  sortOrder: lIdx + 1,
                  mappedCourseId: lf.courseSlug ? coursesBySlug[lf.courseSlug] : undefined,
                })),
              },
            })),
          },
        },
      });
    }
  }

  console.log('Seed complete! Admin:', admin.phoneE164, 'Student:', demoStudent.phoneE164);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
