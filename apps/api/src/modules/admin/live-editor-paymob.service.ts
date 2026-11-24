import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import {
  decryptSecretAesGcm,
  encryptSecretAesGcm,
  isMaskedSecretPlaceholder,
  liveEditorDraftSaveSchema,
  liveEditorPublishSchema,
  maskSecretValue,
  paymobSettingsUpdateSchema,
  sanitizeLiveEditorConfig,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import type { AuthenticatedContextUser } from '../../core/decorators';
import { PrismaService } from '../../core/prisma.service';

export interface LiveSiteLayoutConfig {
  sectionOrder: string[];
  header: {
    brandNameAr: string;
    primaryCtaLabelAr: string;
    primaryCtaHref: string;
    loginLabelAr: string;
  };
  hero: {
    visible: boolean;
    titleAr: string;
    sloganAr: string;
    subtitleAr: string;
    primaryCtaLabelAr: string;
    primaryCtaHref: string;
    secondaryCtaLabelAr: string;
    secondaryCtaHref: string;
    backgroundDesktopUrl: string;
    backgroundMobileUrl: string;
  };
  scene2: {
    visible: boolean;
    titleAr: string;
    subtitleAr: string;
    backgroundDesktopUrl: string;
    backgroundMobileUrl: string;
  };
  pillars: {
    visible: boolean;
    titleAr: string;
    subtitleAr: string;
  };
  thesis: {
    visible: boolean;
    quoteAr: string;
  };
  elevation: {
    visible: boolean;
    titleAr: string;
    subtitleAr: string;
  };
  courses: {
    visible: boolean;
    titleAr: string;
    subtitleAr: string;
    selectedCourseIds: string[];
  };
  pricing: {
    visible: boolean;
    titleAr: string;
    subtitleAr: string;
    featuredPlanId: string;
    orderedPlanIds: string[];
  };
  partners: {
    visible: boolean;
    titleAr: string;
    subtitleAr: string;
  };
  partner_apply: {
    visible: boolean;
    titleAr: string;
    subtitleAr: string;
  };
  faq: {
    visible: boolean;
    titleAr: string;
    subtitleAr: string;
  };
  contact: {
    visible: boolean;
    titleAr: string;
    subtitleAr: string;
    whatsapp: string;
    email: string;
    addressAr: string;
  };
  footer: {
    copyrightAr: string;
    taglineAr: string;
  };
}

@Injectable()
export class LiveEditorAndPaymobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private getEncryptionKey(): string {
    return (
      process.env.PAYMOB_CONFIG_ENCRYPTION_KEY ||
      process.env.SESSION_SECRET ||
      'bosla-paymob-master-encryption-key-2026'
    );
  }

  async buildDefaultLayoutFromCurrentCms(): Promise<LiveSiteLayoutConfig> {
    const [homeCms, contactCms, plans] = await Promise.all([
      this.prisma.cmsPage.findUnique({ where: { slug: 'home' } }).catch(() => null),
      this.prisma.cmsPage.findUnique({ where: { slug: 'contact' } }).catch(() => null),
      this.prisma.membershipPlan
        .findMany({
          where: { isActive: true, isVisible: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, interval: true },
        })
        .catch(() => []),
    ]);

    const heroSec = (homeCms?.sections as any)?.hero ?? {};
    const contactSec = (contactCms?.sections as any) ?? {};
    const annualPlan = plans.find((p) => p.interval === 'ANNUAL') || plans[0];

    return {
      sectionOrder: [
        'hero',
        'scene2',
        'pillars',
        'thesis',
        'elevation',
        'courses',
        'pricing',
        'partners',
        'partner_apply',
        'faq',
        'contact',
      ],
      header: {
        brandNameAr: 'أكاديمية بوصلة',
        primaryCtaLabelAr: 'ابدأ الآن',
        primaryCtaHref: '/register',
        loginLabelAr: 'تسجيل الدخول',
      },
      hero: {
        visible: true,
        titleAr: homeCms?.titleAr || 'أكاديمية بوصلة',
        sloganAr:
          heroSec?.sloganAr || 'حيث تتقاطع الممارسة الميدانية مع قيادة الأعمال',
        subtitleAr:
          heroSec?.subtitleAr ||
          'منصة تأهيل تطبيقي متخصصة في الطب البيطري، تغذية الحيوان، إنتاج الدواجن، والإدارة التجارية للأجريبيزنس.',
        primaryCtaLabelAr: 'ابدأ الانضمام للأكاديمية',
        primaryCtaHref: '/register',
        secondaryCtaLabelAr: 'استكشف الكورسات المعتمدة',
        secondaryCtaHref: '#courses',
        backgroundDesktopUrl: '/images/homepage-threshold/scene1-hero-desktop.webp',
        backgroundMobileUrl: '/images/homepage-threshold/scene1-hero-mobile.webp',
      },
      scene2: {
        visible: true,
        titleAr: 'من الملاحظة الفردية إلى بروتوكول المنشأة',
        subtitleAr:
          'نربط التشخيص والتغذية وهندسة العنبر والإدارة بلغة تشغيل واحدة داخل المزرعة والشركة.',
        backgroundDesktopUrl: '/images/homepage-threshold/scene2-lab-desktop.webp',
        backgroundMobileUrl: '/images/homepage-threshold/scene2-lab-mobile.webp',
      },
      pillars: {
        visible: true,
        titleAr: 'أربعة أركان تشغيلية بلغة قرار واحدة',
        subtitleAr:
          'لا تعمل منشأة الإنتاج الحيواني كجزر معزولة. تبني بوصلة فهماً مترابطاً يجمع التشخيص، التغذية، هندسة العنبر، والإدارة التجارية داخل سياق تطبيقي واحد.',
      },
      thesis: {
        visible: true,
        quoteAr:
          'المعلومة النظريّة متاحة للجميع... الفارق الحقيقي يبدأ عند قرار اللحظة الميدانية.',
      },
      elevation: {
        visible: true,
        titleAr: 'تدرج التأهيل الميداني والإداري',
        subtitleAr:
          'تدرج تأهيلي صُمّم ليناسبك حيثما تقف الآن في مسيرتك الفنية أو الإدارية داخل القطاع.',
      },
      courses: {
        visible: true,
        titleAr: 'البرامج والكورسات التطبيقية المعتمدة',
        subtitleAr:
          'مناهج تطبيقية منشورة ومعتمدة من خبراء الميدان في الدواجن والطب البيطري والتغذية والأجريبيزنس.',
        selectedCourseIds: [],
      },
      pricing: {
        visible: true,
        titleAr: 'الباقات والأسعار',
        subtitleAr:
          'اختر باقة العضوية المناسبة لمسارك المهني مع وصول كامل للكورسات المشمولة طوال فترة الاشتراك.',
        featuredPlanId: annualPlan?.id || '',
        orderedPlanIds: plans.map((p) => p.id),
      },
      partners: {
        visible: true,
        titleAr: 'شركاؤنا في التدريب وقطاع الأعمال',
        subtitleAr: 'مؤسسات وشركات رائدة تثق في مخرجات بوصلة التطبيقية.',
      },
      partner_apply: {
        visible: true,
        titleAr: 'انضم كشريك استراتيجي مع بوصلة',
        subtitleAr: 'شراكات تأهيل الفرق، رعاية المناهج، واستضافة التدريب الميداني.',
      },
      faq: {
        visible: true,
        titleAr: 'الأسئلة الشائعة',
        subtitleAr: 'إجابات واضحة حول نظام الدراسة والشهادات والاشتراكات.',
      },
      contact: {
        visible: true,
        titleAr: 'انضباط القرار فوق أرضية الواقع',
        subtitleAr:
          'للاستفسارات الفردية أو لترتيب خطط التأهيل المؤسسي لفرق الشركات والمزارع ومصانع الأعلاف، تواصل مباشرة مع فريق بوصلة.',
        whatsapp: contactSec?.whatsapp || '201001226683',
        email: contactSec?.email || 'support@boslaagri.com',
        addressAr: 'القاهرة، جمهورية مصر العربية',
      },
      footer: {
        copyrightAr: 'جميع الحقوق محفوظة © أكاديمية بوصلة للإنتاج الحيواني والداجني',
        taglineAr: 'بوابة الدخول الآمن للمتدربين والمؤسسات المسجلة',
      },
    };
  }

  private mergeWithDefaultLayout(
    base: LiveSiteLayoutConfig,
    partial: Record<string, any> | null | undefined,
  ): LiveSiteLayoutConfig {
    if (!partial || typeof partial !== 'object') return base;
    const cleaned = sanitizeLiveEditorConfig(partial);
    return {
      sectionOrder:
        Array.isArray(cleaned.sectionOrder) && cleaned.sectionOrder.length > 0
          ? cleaned.sectionOrder
          : base.sectionOrder,
      header: { ...base.header, ...(cleaned.header || {}) },
      hero: { ...base.hero, ...(cleaned.hero || {}) },
      scene2: { ...base.scene2, ...(cleaned.scene2 || {}) },
      pillars: { ...base.pillars, ...(cleaned.pillars || {}) },
      thesis: { ...base.thesis, ...(cleaned.thesis || {}) },
      elevation: { ...base.elevation, ...(cleaned.elevation || {}) },
      courses: {
        ...base.courses,
        ...(cleaned.courses || {}),
        selectedCourseIds: Array.isArray(cleaned.courses?.selectedCourseIds)
          ? cleaned.courses.selectedCourseIds
          : base.courses.selectedCourseIds,
      },
      pricing: {
        ...base.pricing,
        ...(cleaned.pricing || {}),
        orderedPlanIds: Array.isArray(cleaned.pricing?.orderedPlanIds)
          ? cleaned.pricing.orderedPlanIds
          : base.pricing.orderedPlanIds,
      },
      partners: { ...base.partners, ...(cleaned.partners || {}) },
      partner_apply: { ...base.partner_apply, ...(cleaned.partner_apply || {}) },
      faq: { ...base.faq, ...(cleaned.faq || {}) },
      contact: { ...base.contact, ...(cleaned.contact || {}) },
      footer: { ...base.footer, ...(cleaned.footer || {}) },
    };
  }

  private async ensureBaselinePublishedRevision(pageKey = 'home') {
    const existingPublished = await this.prisma.siteLayoutRevision.findFirst({
      where: { pageKey, status: 'PUBLISHED' },
      orderBy: { versionNumber: 'desc' },
    });
    if (existingPublished) {
      return existingPublished;
    }

    const defaultConfig = await this.buildDefaultLayoutFromCurrentCms();
    return this.prisma.siteLayoutRevision.create({
      data: {
        pageKey,
        versionNumber: 1,
        status: 'PUBLISHED',
        config: defaultConfig as any,
        summaryAr: 'الإصدار الأساسي الافتراضي للموقع',
        editedByName: 'النظام',
        publishedByName: 'النظام',
        publishedAt: new Date(),
      },
    });
  }

  async getEditorState(pageKey = 'home') {
    const defaultLayout = await this.buildDefaultLayoutFromCurrentCms();
    const publishedRev = await this.ensureBaselinePublishedRevision(pageKey);
    const draftRev = await this.prisma.siteLayoutRevision.findFirst({
      where: { pageKey, status: 'DRAFT' },
      orderBy: { versionNumber: 'desc' },
    });

    const [history, availableCourses, availablePlans, partners, faqs] = await Promise.all([
      this.prisma.siteLayoutRevision.findMany({
        where: { pageKey },
        orderBy: { versionNumber: 'desc' },
        take: 30,
      }),
      this.prisma.course.findMany({
        where: { status: 'PUBLISHED', publishedVersionId: { not: null } },
        select: {
          id: true,
          slug: true,
          isFree: true,
          priceCents: true,
          currency: true,
          featuredOrder: true,
          category: { select: { nameAr: true } },
          instructor: { select: { fullName: true } },
          publishedVersion: {
            select: { titleAr: true, subtitleAr: true, thumbnailUrl: true, durationMinutes: true },
          },
        },
        orderBy: [{ featuredOrder: 'asc' }, { publishedAt: 'desc' }],
      }),
      this.prisma.membershipPlan.findMany({
        where: { isActive: true },
        include: {
          revisions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              _count: {
                select: {
                  courses: true,
                  learningPaths: true,
                  diplomas: true,
                },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.cmsPartner.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.cmsFaq.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);

    const publishedConfig = this.mergeWithDefaultLayout(
      defaultLayout,
      publishedRev.config as any,
    );
    const activeDraftConfig = draftRev
      ? this.mergeWithDefaultLayout(defaultLayout, draftRev.config as any)
      : publishedConfig;

    return {
      pageKey,
      publishedVersion: publishedRev.versionNumber,
      currentDraftVersion: draftRev ? draftRev.versionNumber : publishedRev.versionNumber,
      hasUnpublishedChanges: Boolean(draftRev && draftRev.versionNumber > publishedRev.versionNumber),
      publishedConfig,
      draftConfig: activeDraftConfig,
      publishedRevision: publishedRev,
      draftRevision: draftRev,
      history,
      availableCourses: availableCourses.map((c) => ({
        id: c.id,
        slug: c.slug,
        titleAr: c.publishedVersion?.titleAr || c.slug,
        subtitleAr: c.publishedVersion?.subtitleAr || '',
        thumbnailUrl: c.publishedVersion?.thumbnailUrl || null,
        durationMinutes: c.publishedVersion?.durationMinutes || 0,
        isFree: c.isFree,
        priceCents: c.priceCents,
        currency: c.currency,
        categoryNameAr: c.category?.nameAr || null,
        instructorNameAr: c.instructor?.fullName || '',
      })),
      availablePlans: availablePlans.map((p) => ({
        id: p.id,
        slug: p.slug,
        nameAr: p.nameAr,
        descriptionAr: p.descriptionAr,
        interval: p.interval,
        priceCents: p.priceCents,
        compareAtPriceCents: p.compareAtPriceCents,
        currency: p.currency,
        discountLabelAr: p.discountLabelAr,
        isActive: p.isActive,
        isVisible: p.isVisible,
        sortOrder: p.sortOrder,
        coursesCount: p.revisions[0]?._count?.courses ?? 0,
        pathsCount: p.revisions[0]?._count?.learningPaths ?? 0,
        diplomasCount: p.revisions[0]?._count?.diplomas ?? 0,
      })),
      partners,
      faqs,
    };
  }

  async saveDraft(actor: AuthenticatedContextUser, rawBody: unknown, ip?: string) {
    const parsed = liveEditorDraftSaveSchema.parse(rawBody);
    const pageKey = parsed.pageKey || 'home';
    const defaultLayout = await this.buildDefaultLayoutFromCurrentCms();
    const publishedRev = await this.ensureBaselinePublishedRevision(pageKey);

    const latestRev = await this.prisma.siteLayoutRevision.findFirst({
      where: { pageKey },
      orderBy: { versionNumber: 'desc' },
    });
    const currentDraft = await this.prisma.siteLayoutRevision.findFirst({
      where: { pageKey, status: 'DRAFT' },
      orderBy: { versionNumber: 'desc' },
    });

    const expectedVersion = currentDraft
      ? currentDraft.versionNumber
      : publishedRev.versionNumber;

    if (
      parsed.baseVersion !== undefined &&
      parsed.baseVersion !== null &&
      parsed.baseVersion !== expectedVersion &&
      !(currentDraft === null && parsed.baseVersion === 0)
    ) {
      throw new ConflictException({
        code: 'LIVE_EDITOR_VERSION_CONFLICT',
        message:
          'تم تعديل مسودة الموقع من قِبل مدير آخر. يرجى تحديث بيانات المحرر أولاً لتجنب الكتابة فوق التعديلات الحديثة.',
        expectedVersion,
        receivedBaseVersion: parsed.baseVersion,
      });
    }

    const sanitizedConfig = this.mergeWithDefaultLayout(defaultLayout, parsed.config);
    const nextVersionNumber = (latestRev?.versionNumber ?? 1) + 1;

    const draft = currentDraft
      ? await this.prisma.siteLayoutRevision.update({
          where: { id: currentDraft.id },
          data: {
            versionNumber: nextVersionNumber,
            config: sanitizedConfig as any,
            summaryAr: parsed.summaryAr || 'حفظ مسودة تخصيص الموقع',
            editedById: actor.id,
            editedByName: actor.fullName,
          },
        })
      : await this.prisma.siteLayoutRevision.create({
          data: {
            pageKey,
            versionNumber: nextVersionNumber,
            status: 'DRAFT',
            config: sanitizedConfig as any,
            summaryAr: parsed.summaryAr || 'حفظ مسودة تخصيص الموقع',
            editedById: actor.id,
            editedByName: actor.fullName,
          },
        });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ADMIN_LIVE_EDITOR_DRAFT_SAVED',
      entityType: 'SiteLayoutRevision',
      entityId: draft.id,
      metadata: {
        pageKey,
        versionNumber: draft.versionNumber,
        summaryAr: draft.summaryAr,
      },
      ipAddress: ip,
    });

    return {
      draft,
      currentDraftVersion: draft.versionNumber,
      publishedVersion: publishedRev.versionNumber,
    };
  }

  async publishDraft(actor: AuthenticatedContextUser, rawBody: unknown, ip?: string) {
    const parsed = liveEditorPublishSchema.parse(rawBody ?? {});
    const pageKey = parsed.pageKey || 'home';
    const defaultLayout = await this.buildDefaultLayoutFromCurrentCms();
    const publishedRev = await this.ensureBaselinePublishedRevision(pageKey);
    const currentDraft = await this.prisma.siteLayoutRevision.findFirst({
      where: { pageKey, status: 'DRAFT' },
      orderBy: { versionNumber: 'desc' },
    });

    const sourceRev = currentDraft || publishedRev;
    if (
      parsed.baseVersion !== undefined &&
      parsed.baseVersion !== null &&
      parsed.baseVersion !== sourceRev.versionNumber
    ) {
      throw new ConflictException({
        code: 'LIVE_EDITOR_VERSION_CONFLICT',
        message: 'يوجد إصدار أحدث لمسودة الموقع — يرجى تحديث الصفحة قبل النشر.',
        expectedVersion: sourceRev.versionNumber,
      });
    }

    const latestRev = await this.prisma.siteLayoutRevision.findFirst({
      where: { pageKey },
      orderBy: { versionNumber: 'desc' },
    });
    const nextPubVersion = (latestRev?.versionNumber ?? 1) + 1;
    const finalConfig = this.mergeWithDefaultLayout(defaultLayout, sourceRev.config as any);

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.siteLayoutRevision.updateMany({
        where: { pageKey, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });
      await tx.siteLayoutRevision.deleteMany({
        where: { pageKey, status: 'DRAFT' },
      });

      const createdPub = await tx.siteLayoutRevision.create({
        data: {
          pageKey,
          versionNumber: nextPubVersion,
          status: 'PUBLISHED',
          config: finalConfig as any,
          summaryAr:
            parsed.summaryAr || sourceRev.summaryAr || `نشر إصدار الموقع رقم ${nextPubVersion}`,
          editedById: sourceRev.editedById || actor.id,
          editedByName: sourceRev.editedByName || actor.fullName,
          publishedById: actor.id,
          publishedByName: actor.fullName,
          publishedAt: new Date(),
        },
      });

      // Sync CmsPage('home') & CmsPage('contact') so SSR /catalog/pages/home stays consistent
      await tx.cmsPage
        .upsert({
          where: { slug: 'home' },
          update: {
            titleAr: finalConfig.hero.titleAr,
            sections: {
              hero: {
                sloganAr: finalConfig.hero.sloganAr,
                subtitleAr: finalConfig.hero.subtitleAr,
              },
            } as any,
            updatedById: actor.id,
          },
          create: {
            slug: 'home',
            titleAr: finalConfig.hero.titleAr,
            sections: {
              hero: {
                sloganAr: finalConfig.hero.sloganAr,
                subtitleAr: finalConfig.hero.subtitleAr,
              },
            } as any,
            updatedById: actor.id,
          },
        })
        .catch(() => {});

      return createdPub;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ADMIN_LIVE_EDITOR_PUBLISHED',
      entityType: 'SiteLayoutRevision',
      entityId: published.id,
      metadata: {
        pageKey,
        versionNumber: published.versionNumber,
        summaryAr: published.summaryAr,
      },
      ipAddress: ip,
    });

    return {
      published,
      publishedVersion: published.versionNumber,
      nextDraftVersion: published.versionNumber,
    };
  }

  async rollbackToRevision(
    actor: AuthenticatedContextUser,
    revisionId: string,
    ip?: string,
  ) {
    const target = await this.prisma.siteLayoutRevision.findUnique({
      where: { id: revisionId },
    });
    if (!target) {
      throw new NotFoundException('الإصدار المطلوب استرجاعه غير موجود');
    }

    const defaultLayout = await this.buildDefaultLayoutFromCurrentCms();
    const latestRev = await this.prisma.siteLayoutRevision.findFirst({
      where: { pageKey: target.pageKey },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersion = (latestRev?.versionNumber ?? 1) + 1;
    const restoredConfig = this.mergeWithDefaultLayout(defaultLayout, target.config as any);

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.siteLayoutRevision.updateMany({
        where: { pageKey: target.pageKey, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });
      await tx.siteLayoutRevision.deleteMany({
        where: { pageKey: target.pageKey, status: 'DRAFT' },
      });

      const created = await tx.siteLayoutRevision.create({
        data: {
          pageKey: target.pageKey,
          versionNumber: nextVersion,
          status: 'PUBLISHED',
          config: restoredConfig as any,
          summaryAr: `استرجاع الإصدار السابق رقم ${target.versionNumber}`,
          editedById: actor.id,
          editedByName: actor.fullName,
          publishedById: actor.id,
          publishedByName: actor.fullName,
          publishedAt: new Date(),
        },
      });

      await tx.cmsPage
        .update({
          where: { slug: 'home' },
          data: {
            titleAr: restoredConfig.hero.titleAr,
            sections: {
              hero: {
                sloganAr: restoredConfig.hero.sloganAr,
                subtitleAr: restoredConfig.hero.subtitleAr,
              },
            } as any,
            updatedById: actor.id,
          },
        })
        .catch(() => {});

      return created;
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ADMIN_LIVE_EDITOR_ROLLBACK',
      entityType: 'SiteLayoutRevision',
      entityId: published.id,
      metadata: {
        restoredFromRevisionId: target.id,
        restoredFromVersion: target.versionNumber,
        newVersionNumber: published.versionNumber,
      },
      ipAddress: ip,
    });

    return {
      published,
      publishedVersion: published.versionNumber,
      nextDraftVersion: published.versionNumber,
    };
  }

  async getPublicLiveLayout(pageKey = 'home') {
    const defaultLayout = await this.buildDefaultLayoutFromCurrentCms();
    const publishedRev = await this.ensureBaselinePublishedRevision(pageKey);
    const layout = this.mergeWithDefaultLayout(defaultLayout, publishedRev.config as any);

    const [rawPlans, partners, faqs] = await Promise.all([
      this.prisma.membershipPlan.findMany({
        where: { isActive: true, isVisible: true },
        include: {
          revisions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              _count: {
                select: {
                  courses: true,
                  learningPaths: true,
                  diplomas: true,
                },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.cmsPartner.findMany({
        where: { isPublished: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.cmsFaq.findMany({
        where: { isPublished: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const orderedPlanIds = layout.pricing.orderedPlanIds || [];
    const sortedPlans = [...rawPlans].sort((a, b) => {
      const idxA = orderedPlanIds.indexOf(a.id);
      const idxB = orderedPlanIds.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.sortOrder - b.sortOrder;
    });

    const pricingPlans = sortedPlans.map((p) => ({
      id: p.id,
      slug: p.slug,
      nameAr: p.nameAr,
      descriptionAr: p.descriptionAr,
      interval: p.interval,
      priceCents: p.priceCents,
      compareAtPriceCents: p.compareAtPriceCents,
      currency: p.currency,
      discountLabelAr: p.discountLabelAr,
      isFeatured:
        layout.pricing.featuredPlanId
          ? p.id === layout.pricing.featuredPlanId
          : p.interval === 'ANNUAL',
      coursesCount: p.revisions[0]?._count?.courses ?? 0,
      pathsCount: p.revisions[0]?._count?.learningPaths ?? 0,
      diplomasCount: p.revisions[0]?._count?.diplomas ?? 0,
      autoRenewSupported: false,
    }));

    return {
      pageKey,
      versionNumber: publishedRev.versionNumber,
      publishedAt: publishedRev.publishedAt,
      layout,
      pricingPlans,
      partners,
      faqs,
    };
  }

  // ==========================================================================
  // SECTION 8: ENCRYPTED PAYMOB CONFIGURATION (TEST & LIVE)
  // ==========================================================================

  private decryptOrEmpty(cipherText?: string | null): string {
    if (!cipherText) return '';
    try {
      return decryptSecretAesGcm(cipherText, this.getEncryptionKey());
    } catch {
      return '';
    }
  }

  private buildWebhookUrls() {
    const publicBase = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      'https://bosla.academy'
    ).replace(/\/$/, '');
    return {
      transactionWebhookUrl: `${publicBase}/api/v1/payments/paymob/webhook`,
      commerceWebhookUrl: `${publicBase}/api/v1/commerce/webhooks/paymob`,
      returnCallbackUrl: `${publicBase}/membership/checkout-result`,
    };
  }

  private computePaymobReadiness(params: {
    isEnabled: boolean;
    mode: 'TEST' | 'LIVE';
    testApiKeyPlain: string;
    testIntegrationId?: string | null;
    testIframeId?: string | null;
    testHmacPlain: string;
    liveApiKeyPlain: string;
    liveIntegrationId?: string | null;
    liveIframeId?: string | null;
    liveHmacPlain: string;
  }) {
    const testMissing: string[] = [];
    if (!params.testApiKeyPlain) testMissing.push('API Key (بيئة الاختبار Test)');
    if (!params.testIntegrationId?.trim()) testMissing.push('Integration ID (بطاقات Test)');
    if (!params.testIframeId?.trim()) testMissing.push('iFrame ID (بيئة الاختبار Test)');
    if (!params.testHmacPlain) testMissing.push('HMAC Secret (بيئة الاختبار Test)');

    const liveMissing: string[] = [];
    if (!params.liveApiKeyPlain) liveMissing.push('API Key (بيئة الإنتاج Live)');
    if (!params.liveIntegrationId?.trim()) liveMissing.push('Integration ID (بطاقات Live)');
    if (!params.liveIframeId?.trim()) liveMissing.push('iFrame ID (بيئة الإنتاج Live)');
    if (!params.liveHmacPlain) liveMissing.push('HMAC Secret (بيئة الإنتاج Live)');

    const testReady = testMissing.length === 0;
    const liveReady = liveMissing.length === 0;
    const activeMissing = params.mode === 'LIVE' ? liveMissing : testMissing;
    const activeModeReady = params.mode === 'LIVE' ? liveReady : testReady;

    return {
      testReady,
      liveReady,
      activeModeReady,
      testMissing,
      liveMissing,
      activeMissing,
    };
  }

  async getPaymobConfigForAdmin() {
    const row = await this.prisma.paymentGatewayConfig.findUnique({
      where: { providerKey: 'PAYMOB' },
    });

    const testApiKeyPlain = this.decryptOrEmpty(row?.testApiKeyEnc) || process.env.PAYMOB_API_KEY || '';
    const testHmacPlain =
      this.decryptOrEmpty(row?.testHmacSecretEnc) || process.env.PAYMOB_HMAC_SECRET || '';
    const testSecretPlain = this.decryptOrEmpty(row?.testSecretKeyEnc);

    const liveApiKeyPlain = this.decryptOrEmpty(row?.liveApiKeyEnc);
    const liveHmacPlain = this.decryptOrEmpty(row?.liveHmacSecretEnc);
    const liveSecretPlain = this.decryptOrEmpty(row?.liveSecretKeyEnc);

    const mode = (row?.mode || 'TEST') as 'TEST' | 'LIVE';
    const isEnabled = row ? row.isEnabled : Boolean(process.env.PAYMOB_API_KEY);
    const testIntegrationId = row?.testIntegrationId ?? process.env.PAYMOB_INTEGRATION_ID ?? '';
    const testWalletIntegrationId = row?.testWalletIntegrationId ?? '';
    const testIframeId = row?.testIframeId ?? process.env.PAYMOB_IFRAME_ID ?? '';
    const testPublicKey = row?.testPublicKey ?? '';

    const liveIntegrationId = row?.liveIntegrationId ?? '';
    const liveWalletIntegrationId = row?.liveWalletIntegrationId ?? '';
    const liveIframeId = row?.liveIframeId ?? '';
    const livePublicKey = row?.livePublicKey ?? '';

    const readiness = this.computePaymobReadiness({
      isEnabled,
      mode,
      testApiKeyPlain,
      testIntegrationId,
      testIframeId,
      testHmacPlain,
      liveApiKeyPlain,
      liveIntegrationId,
      liveIframeId,
      liveHmacPlain,
    });

    return {
      providerKey: 'PAYMOB',
      isEnabled,
      mode,
      currency: row?.currency || 'EGP',
      testIntegrationId,
      testWalletIntegrationId,
      testIframeId,
      testPublicKey,
      testApiKeyMasked: maskSecretValue(testApiKeyPlain),
      testHmacSecretMasked: maskSecretValue(testHmacPlain),
      testSecretKeyMasked: maskSecretValue(testSecretPlain),
      hasTestApiKey: Boolean(testApiKeyPlain),
      hasTestHmacSecret: Boolean(testHmacPlain),
      hasTestSecretKey: Boolean(testSecretPlain),
      liveIntegrationId,
      liveWalletIntegrationId,
      liveIframeId,
      livePublicKey,
      liveApiKeyMasked: maskSecretValue(liveApiKeyPlain),
      liveHmacSecretMasked: maskSecretValue(liveHmacPlain),
      liveSecretKeyMasked: maskSecretValue(liveSecretPlain),
      hasLiveApiKey: Boolean(liveApiKeyPlain),
      hasLiveHmacSecret: Boolean(liveHmacPlain),
      hasLiveSecretKey: Boolean(liveSecretPlain),
      updatedByName: row?.updatedByName || null,
      updatedAt: row?.updatedAt || null,
      lastVerifiedAt: row?.lastVerifiedAt || null,
      lastVerifyStatus: row?.lastVerifyStatus || null,
      lastVerifyMessageAr: row?.lastVerifyMessageAr || null,
      readiness,
      webhooks: this.buildWebhookUrls(),
      fieldGuides: [
        {
          field: 'API Key',
          whereToGetAr:
            'من لوحة تحكم Paymob Accept مصر ← Settings ← Account Info ← API Key.',
        },
        {
          field: 'Integration ID',
          whereToGetAr:
            'من Developers ← Payment Integrations ← انسخ رقم Integration ID الخاص بالبطاقات البنكية (Online Card) أو المحافظ.',
        },
        {
          field: 'iFrame ID',
          whereToGetAr:
            'من Developers ← iFrames ← انسخ رقم الإطار (iFrame ID) المخصص لصفحة إدخال البطاقة.',
        },
        {
          field: 'HMAC Secret',
          whereToGetAr:
            'من Settings ← Account Info ← HMAC Secret (يُستخدم للتحقق التشفيري SHA-512 من إشعارات الدفع Webhook).',
        },
      ],
    };
  }

  async updatePaymobConfigForAdmin(
    actor: AuthenticatedContextUser,
    rawBody: unknown,
    ip?: string,
  ) {
    const parsed = paymobSettingsUpdateSchema.parse(rawBody);
    const existing = await this.prisma.paymentGatewayConfig.findUnique({
      where: { providerKey: 'PAYMOB' },
    });
    const key = this.getEncryptionKey();

    const resolveEncryptedField = (
      incomingVal: string | null | undefined,
      existingCipher: string | null | undefined,
    ): string | null => {
      if (incomingVal === undefined) {
        return existingCipher ?? null;
      }
      const trimmed = (incomingVal || '').trim();
      if (!trimmed) {
        return null;
      }
      if (isMaskedSecretPlaceholder(trimmed)) {
        return existingCipher ?? null;
      }
      return encryptSecretAesGcm(trimmed, key);
    };

    const testApiKeyEnc = resolveEncryptedField(parsed.testApiKey, existing?.testApiKeyEnc);
    const testHmacSecretEnc = resolveEncryptedField(
      parsed.testHmacSecret,
      existing?.testHmacSecretEnc,
    );
    const testSecretKeyEnc = resolveEncryptedField(
      parsed.testSecretKey,
      existing?.testSecretKeyEnc,
    );

    const liveApiKeyEnc = resolveEncryptedField(parsed.liveApiKey, existing?.liveApiKeyEnc);
    const liveHmacSecretEnc = resolveEncryptedField(
      parsed.liveHmacSecret,
      existing?.liveHmacSecretEnc,
    );
    const liveSecretKeyEnc = resolveEncryptedField(
      parsed.liveSecretKey,
      existing?.liveSecretKeyEnc,
    );

    const changedFields: string[] = ['isEnabled', 'mode', 'currency'];
    if (parsed.testApiKey && !isMaskedSecretPlaceholder(parsed.testApiKey)) {
      changedFields.push('testApiKey');
    }
    if (parsed.testHmacSecret && !isMaskedSecretPlaceholder(parsed.testHmacSecret)) {
      changedFields.push('testHmacSecret');
    }
    if (parsed.liveApiKey && !isMaskedSecretPlaceholder(parsed.liveApiKey)) {
      changedFields.push('liveApiKey');
    }
    if (parsed.liveHmacSecret && !isMaskedSecretPlaceholder(parsed.liveHmacSecret)) {
      changedFields.push('liveHmacSecret');
    }

    await this.prisma.paymentGatewayConfig.upsert({
      where: { providerKey: 'PAYMOB' },
      update: {
        isEnabled: parsed.isEnabled,
        mode: parsed.mode,
        currency: parsed.currency || 'EGP',
        testApiKeyEnc,
        testIntegrationId:
          parsed.testIntegrationId !== undefined
            ? parsed.testIntegrationId?.trim() || null
            : existing?.testIntegrationId,
        testWalletIntegrationId:
          parsed.testWalletIntegrationId !== undefined
            ? parsed.testWalletIntegrationId?.trim() || null
            : existing?.testWalletIntegrationId,
        testIframeId:
          parsed.testIframeId !== undefined
            ? parsed.testIframeId?.trim() || null
            : existing?.testIframeId,
        testHmacSecretEnc,
        testPublicKey:
          parsed.testPublicKey !== undefined
            ? parsed.testPublicKey?.trim() || null
            : existing?.testPublicKey,
        testSecretKeyEnc,
        liveApiKeyEnc,
        liveIntegrationId:
          parsed.liveIntegrationId !== undefined
            ? parsed.liveIntegrationId?.trim() || null
            : existing?.liveIntegrationId,
        liveWalletIntegrationId:
          parsed.liveWalletIntegrationId !== undefined
            ? parsed.liveWalletIntegrationId?.trim() || null
            : existing?.liveWalletIntegrationId,
        liveIframeId:
          parsed.liveIframeId !== undefined
            ? parsed.liveIframeId?.trim() || null
            : existing?.liveIframeId,
        liveHmacSecretEnc,
        livePublicKey:
          parsed.livePublicKey !== undefined
            ? parsed.livePublicKey?.trim() || null
            : existing?.livePublicKey,
        liveSecretKeyEnc,
        updatedById: actor.id,
        updatedByName: actor.fullName,
      },
      create: {
        providerKey: 'PAYMOB',
        isEnabled: parsed.isEnabled,
        mode: parsed.mode,
        currency: parsed.currency || 'EGP',
        testApiKeyEnc,
        testIntegrationId: parsed.testIntegrationId?.trim() || null,
        testWalletIntegrationId: parsed.testWalletIntegrationId?.trim() || null,
        testIframeId: parsed.testIframeId?.trim() || null,
        testHmacSecretEnc,
        testPublicKey: parsed.testPublicKey?.trim() || null,
        testSecretKeyEnc,
        liveApiKeyEnc,
        liveIntegrationId: parsed.liveIntegrationId?.trim() || null,
        liveWalletIntegrationId: parsed.liveWalletIntegrationId?.trim() || null,
        liveIframeId: parsed.liveIframeId?.trim() || null,
        liveHmacSecretEnc,
        livePublicKey: parsed.livePublicKey?.trim() || null,
        liveSecretKeyEnc,
        updatedById: actor.id,
        updatedByName: actor.fullName,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ADMIN_PAYMOB_CONFIG_UPDATED',
      entityType: 'PaymentGatewayConfig',
      entityId: 'PAYMOB',
      metadata: {
        isEnabled: parsed.isEnabled,
        mode: parsed.mode,
        currency: parsed.currency,
        changedFields,
      },
      ipAddress: ip,
    });

    return this.getPaymobConfigForAdmin();
  }

  async verifyPaymobConfigForAdmin(actor: AuthenticatedContextUser, ip?: string) {
    const row = await this.prisma.paymentGatewayConfig.findUnique({
      where: { providerKey: 'PAYMOB' },
    });

    const testApiKeyPlain = this.decryptOrEmpty(row?.testApiKeyEnc) || process.env.PAYMOB_API_KEY || '';
    const testHmacPlain =
      this.decryptOrEmpty(row?.testHmacSecretEnc) || process.env.PAYMOB_HMAC_SECRET || '';
    const liveApiKeyPlain = this.decryptOrEmpty(row?.liveApiKeyEnc);
    const liveHmacPlain = this.decryptOrEmpty(row?.liveHmacSecretEnc);

    const mode = (row?.mode || 'TEST') as 'TEST' | 'LIVE';
    const isEnabled = row ? row.isEnabled : false;
    const readiness = this.computePaymobReadiness({
      isEnabled,
      mode,
      testApiKeyPlain,
      testIntegrationId: row?.testIntegrationId ?? process.env.PAYMOB_INTEGRATION_ID,
      testIframeId: row?.testIframeId ?? process.env.PAYMOB_IFRAME_ID,
      testHmacPlain,
      liveApiKeyPlain,
      liveIntegrationId: row?.liveIntegrationId,
      liveIframeId: row?.liveIframeId,
      liveHmacPlain,
    });

    const activeHmac = mode === 'LIVE' ? liveHmacPlain : testHmacPlain;
    let hmacSelfTestOk = false;
    if (activeHmac) {
      const digest = createHmac('sha512', activeHmac).update('bosla-paymob-self-test').digest('hex');
      hmacSelfTestOk = digest.length === 128;
    }

    const readyForActiveMode = readiness.activeModeReady && hmacSelfTestOk;
    const status = readyForActiveMode ? 'READY' : 'INCOMPLETE';
    const messageAr = readyForActiveMode
      ? `إعدادات Paymob لبيئة (${mode === 'LIVE' ? 'الإنتاج الفعلي Live' : 'الاختبار Test'}) مكتملة وجاهزة ومفاتيح التوقيع SHA-512 صالحة.`
      : `توجد حقول مطلوبة غير مكتملة في بيئة (${mode === 'LIVE' ? 'Live' : 'Test'}): ${readiness.activeMissing.join('، ')}`;

    if (row) {
      await this.prisma.paymentGatewayConfig.update({
        where: { id: row.id },
        data: {
          lastVerifiedAt: new Date(),
          lastVerifyStatus: status,
          lastVerifyMessageAr: messageAr,
        },
      });
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ADMIN_PAYMOB_CONFIG_VERIFIED',
      entityType: 'PaymentGatewayConfig',
      entityId: 'PAYMOB',
      metadata: {
        mode,
        readyForActiveMode,
        missingCount: readiness.activeMissing.length,
      },
      ipAddress: ip,
    });

    return {
      mode,
      isEnabled,
      readyForActiveMode,
      hmacSelfTestOk,
      status,
      messageAr,
      readiness,
      webhooks: this.buildWebhookUrls(),
    };
  }
}
