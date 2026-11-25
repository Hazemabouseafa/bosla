import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { normalizePhoneToE164, rankSpecializationDomains } from '@bosla/shared';
import { PrismaService } from '../../core/prisma.service';

const PARTNERSHIP_INTEREST_LABELS: Record<string, string> = {
  CORPORATE_TRAINING: 'تأهيل وتدريب فرق الشركات والمزارع',
  CURRICULUM_SPONSORSHIP: 'رعاية محتوى أو برنامج تخصصي',
  FIELD_INTERNSHIP: 'استضافة وتدريب ميداني للخريجين',
  EVENT_PARTNERSHIP: 'شراكة فعاليات وملتقيات علمية',
  RESEARCH_COOP: 'تعاون تقني وبحثي مشترك',
};

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getHomeBundle() {
    const [
      homePage,
      categories,
      featuredCourses,
      featuredPaths,
      featuredDiplomas,
      instructors,
      testimonials,
      partners,
      faqs,
      platformSetting,
      sectionVisibilitySetting,
      plans,
      domains,
      questions,
      offlineEvents,
    ] = await Promise.all([
      this.prisma.cmsPage.findUnique({ where: { slug: 'home' } }),
      this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.course.findMany({
        where: { status: 'PUBLISHED', publishedVersionId: { not: null } },
        include: {
          category: true,
          instructor: {
            select: { id: true, fullName: true, headlineAr: true, avatarUrl: true },
          },
          publishedVersion: {
            include: {
              sections: {
                orderBy: { sortOrder: 'asc' },
                include: { _count: { select: { lessons: true } } },
              },
            },
          },
        },
        orderBy: [{ featuredOrder: 'asc' }, { publishedAt: 'desc' }],
      }),
      this.prisma.learningPath.findMany({
        where: { status: 'PUBLISHED' },
        include: {
          courses: {
            orderBy: { sortOrder: 'asc' },
            include: {
              course: {
                include: {
                  publishedVersion: {
                    select: { titleAr: true, thumbnailUrl: true, durationMinutes: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ featuredOrder: 'asc' }, { publishedAt: 'desc' }],
      }),
      this.prisma.diploma.findMany({
        where: { status: 'PUBLISHED' },
        include: {
          courses: {
            orderBy: { sortOrder: 'asc' },
            include: {
              course: {
                include: {
                  publishedVersion: {
                    select: { titleAr: true, thumbnailUrl: true, durationMinutes: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ featuredOrder: 'asc' }, { publishedAt: 'desc' }],
      }),
      this.prisma.user.findMany({
        where: { role: 'INSTRUCTOR', status: 'ACTIVE' },
        select: {
          id: true,
          fullName: true,
          headlineAr: true,
          bioAr: true,
          avatarUrl: true,
          createdAt: true,
          instructorProfile: {
            select: {
              specializations: true,
              yearsExperience: true,
              approvalStatus: true,
              showOnHomepage: true,
              homepageSortOrder: true,
            },
          },
          instructedCourses: {
            where: { status: 'PUBLISHED' },
            select: {
              id: true,
              slug: true,
              publishedVersion: {
                select: {
                  titleAr: true,
                  thumbnailUrl: true,
                  durationMinutes: true,
                },
              },
            },
            orderBy: { publishedAt: 'desc' },
            take: 8,
          },
          _count: { select: { instructedCourses: { where: { status: 'PUBLISHED' } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.cmsTestimonial.findMany({
        where: { isPublished: true },
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
      this.prisma.siteSetting.findUnique({ where: { key: 'platform' } }),
      this.prisma.siteSetting.findUnique({ where: { key: 'section_visibility' } }),
      this.prisma.membershipPlan.findMany({
        where: { isActive: true, isVisible: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.specializationDomain.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          subfields: {
            orderBy: { sortOrder: 'asc' },
            include: {
              leaves: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  mappedCourse: {
                    select: {
                      id: true,
                      slug: true,
                      status: true,
                      isFree: true,
                      publishedVersion: { select: { titleAr: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.specializationQuestion.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.offlineEvent.findMany({
        where: { status: 'PUBLISHED' },
        include: {
          instructor: {
            select: { id: true, fullName: true, headlineAr: true, avatarUrl: true },
          },
        },
        orderBy: [{ featuredOrder: 'asc' }, { startsAt: 'asc' }],
        take: 6,
      }),
    ]);

    const bookedRows = offlineEvents.length
      ? await this.prisma.offlineEventRegistration.groupBy({
          by: ['eventId'],
          where: {
            eventId: { in: offlineEvents.map((e) => e.id) },
            status: { in: ['CONFIRMED', 'ATTENDED'] },
          },
          _sum: { seatsCount: true },
        })
      : [];
    const bookedMap = new Map(bookedRows.map((r) => [r.eventId, Number(r._sum.seatsCount ?? 0)]));

    return {
      homePage,
      categories,
      courses: featuredCourses,
      learningPaths: featuredPaths,
      diplomas: featuredDiplomas,
      offlineEvents: offlineEvents.map((ev) => {
        const seatsBooked = bookedMap.get(ev.id) ?? 0;
        return {
          ...ev,
          seatsBooked,
          remainingSeats: Math.max(0, ev.capacity - seatsBooked),
        };
      }),
      instructors: instructors
        .filter((inst) => inst.instructorProfile?.showOnHomepage !== false)
        .sort(
          (a, b) =>
            (a.instructorProfile?.homepageSortOrder ?? 100) -
            (b.instructorProfile?.homepageSortOrder ?? 100),
        ),
      testimonials,
      partners,
      faqs,
      settings: platformSetting?.value ?? null,
      sectionVisibility: (sectionVisibilitySetting?.value as Record<string, boolean> | null) ?? null,
      plans,
      specialization: {
        questions,
        domains,
      },
    };
  }

  async getPublicSectionVisibility(): Promise<Record<string, boolean>> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: 'section_visibility' },
    });
    return (row?.value as Record<string, boolean> | null) ?? {};
  }

  async getHomepageCourses() {
    const now = new Date();
    const [rows, partners] = await Promise.all([
      this.prisma.course.findMany({
        where: {
          status: 'PUBLISHED',
          publishedVersionId: { not: null },
          publishedVersion: { is: { status: 'PUBLISHED' } },
          AND: [
            { OR: [{ availabilityStartAt: null }, { availabilityStartAt: { lte: now } }] },
            { OR: [{ availabilityEndAt: null }, { availabilityEndAt: { gte: now } }] },
          ],
        },
        select: {
          id: true,
          slug: true,
          isFree: true,
          priceCents: true,
          currency: true,
          includedInMembership: true,
          allowIndividualPurchase: true,
          difficulty: true,
          deliveryMode: true,
          featuredOrder: true,
          publishedAt: true,
          category: {
            select: {
              id: true,
              slug: true,
              nameAr: true,
              sortOrder: true,
            },
          },
          instructor: {
            select: {
              id: true,
              fullName: true,
              headlineAr: true,
              avatarUrl: true,
            },
          },
          publishedVersion: {
            select: {
              titleAr: true,
              subtitleAr: true,
              thumbnailUrl: true,
              durationMinutes: true,
              sections: {
                select: {
                  _count: {
                    select: { lessons: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ featuredOrder: 'asc' }, { publishedAt: 'desc' }],
      }),
      this.prisma.cmsPartner.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          nameAr: true,
          logoUrl: true,
          websiteUrl: true,
          descriptionAr: true,
        },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    // Enforce deterministic featured ordering: explicit featuredOrder ascending first, then newest published
    const sorted = [...rows].sort((a, b) => {
      const fa = a.featuredOrder;
      const fb = b.featuredOrder;
      if (fa !== null && fb !== null) return fa - fb;
      if (fa !== null) return -1;
      if (fb !== null) return 1;
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    });

    const courses = sorted
      .filter((c) => Boolean(c.publishedVersion))
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        isFree: c.isFree,
        priceCents: c.priceCents,
        currency: c.currency,
        includedInMembership: c.includedInMembership,
        allowIndividualPurchase: c.allowIndividualPurchase,
        difficulty: c.difficulty,
        deliveryMode: c.deliveryMode,
        featuredOrder: c.featuredOrder,
        publishedAt: c.publishedAt,
        category: c.category
          ? { id: c.category.id, slug: c.category.slug, nameAr: c.category.nameAr }
          : null,
        instructor: {
          id: c.instructor.id,
          fullName: c.instructor.fullName,
          headlineAr: c.instructor.headlineAr,
          avatarUrl: c.instructor.avatarUrl,
        },
        titleAr: c.publishedVersion!.titleAr,
        subtitleAr: c.publishedVersion!.subtitleAr,
        thumbnailUrl: c.publishedVersion!.thumbnailUrl,
        durationMinutes: c.publishedVersion!.durationMinutes,
        lessonCount: c.publishedVersion!.sections.reduce(
          (acc, sec) => acc + (sec._count?.lessons ?? 0),
          0,
        ),
      }));

    const categoryMap = new Map<
      string,
      { id: string; slug: string; nameAr: string; sortOrder: number }
    >();
    for (const row of sorted) {
      if (row.category && !categoryMap.has(row.category.id)) {
        categoryMap.set(row.category.id, row.category);
      }
    }

    const categories = Array.from(categoryMap.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ id, slug, nameAr }) => ({ id, slug, nameAr }));

    const uniqueInstructorIds = new Set(courses.map((c) => c.instructor.id));

    return {
      courses,
      categories,
      partners,
      stats: {
        publishedCoursesCount: courses.length,
        activeInstructorsCount: uniqueInstructorIds.size,
      },
    };
  }

  async listPublishedCourses(query: {
    search?: string;
    categorySlug?: string;
    difficulty?: string;
    freeOnly?: boolean;
  }) {
    const courses = await this.prisma.course.findMany({
      where: {
        status: 'PUBLISHED',
        publishedVersionId: { not: null },
        ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
        ...(query.difficulty ? { difficulty: query.difficulty as any } : {}),
        ...(query.freeOnly ? { isFree: true } : {}),
      },
      include: {
        category: true,
        instructor: {
          select: { id: true, fullName: true, headlineAr: true, avatarUrl: true },
        },
        publishedVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  orderBy: { sortOrder: 'asc' },
                  select: { id: true, titleAr: true, durationSeconds: true, type: true, isFreePreview: true },
                },
              },
            },
          },
        },
        reviews: {
          where: { isPublished: true },
          select: { rating: true },
        },
      },
      orderBy: [{ featuredOrder: 'asc' }, { publishedAt: 'desc' }],
    });

    const filtered = query.search
      ? courses.filter((c) => {
          const term = query.search!.trim().toLowerCase();
          return (
            c.publishedVersion?.titleAr.toLowerCase().includes(term) ||
            c.publishedVersion?.descriptionAr.toLowerCase().includes(term) ||
            c.instructor.fullName.toLowerCase().includes(term)
          );
        })
      : courses;

    return filtered;
  }

  async getPublishedCourseBySlug(slug: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        publishedVersionId: { not: null },
      },
      include: {
        category: true,
        instructor: {
          select: { id: true, fullName: true, headlineAr: true, bioAr: true, avatarUrl: true },
        },
        instructorAssignments: {
          include: {
            instructor: {
              select: { id: true, fullName: true, headlineAr: true, avatarUrl: true },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        publishedVersion: {
          include: {
            introVideo: {
              select: { id: true, status: true, durationSeconds: true },
            },
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    stableKey: true,
                    titleAr: true,
                    descriptionAr: true,
                    type: true,
                    isFreePreview: true,
                    durationSeconds: true,
                    sortOrder: true,
                    videoAssetId: true,
                    quizId: true,
                    attachments: {
                      select: { id: true, titleAr: true, mimeType: true, sizeBytes: true },
                    },
                  },
                },
              },
            },
          },
        },
        reviews: {
          where: { isPublished: true },
          include: {
            user: { select: { fullName: true, avatarUrl: true } },
            instructor: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        learningPathLinks: {
          where: { learningPath: { status: 'PUBLISHED' } },
          include: { learningPath: { select: { id: true, slug: true, titleAr: true } } },
        },
        diplomaLinks: {
          where: { diploma: { status: 'PUBLISHED' } },
          include: { diploma: { select: { id: true, slug: true, titleAr: true } } },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('الكورس غير موجود أو غير منشور حاليًا');
    }
    return {
      ...course,
      publishedVersion: course.publishedVersion
        ? {
            ...course.publishedVersion,
            sections: course.publishedVersion.sections.map((section) => ({
              ...section,
              lessons: section.lessons.map((lesson) => ({
                ...lesson,
                attachments: lesson.attachments.map((att) => ({
                  ...att,
                  sizeBytes: Number(att.sizeBytes),
                })),
              })),
            })),
          }
        : null,
    };
  }

  async listPublishedLearningPaths() {
    return this.prisma.learningPath.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        courses: {
          orderBy: { sortOrder: 'asc' },
          include: {
            course: {
              select: {
                id: true,
                slug: true,
                status: true,
                isFree: true,
                difficulty: true,
                publishedVersion: {
                  select: { titleAr: true, subtitleAr: true, thumbnailUrl: true, durationMinutes: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ featuredOrder: 'asc' }, { publishedAt: 'desc' }],
    });
  }

  async getPublishedLearningPathBySlug(slug: string) {
    const path = await this.prisma.learningPath.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        instructorAssignments: {
          include: {
            instructor: { select: { id: true, fullName: true, headlineAr: true, avatarUrl: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
        courses: {
          orderBy: { sortOrder: 'asc' },
          include: {
            course: {
              include: {
                instructor: { select: { id: true, fullName: true, avatarUrl: true } },
                publishedVersion: {
                  select: {
                    titleAr: true,
                    subtitleAr: true,
                    descriptionAr: true,
                    thumbnailUrl: true,
                    durationMinutes: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!path) throw new NotFoundException('المسار التعليمي غير موجود أو غير منشور');
    return path;
  }

  async listPublishedDiplomas() {
    return this.prisma.diploma.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        courses: {
          orderBy: { sortOrder: 'asc' },
          include: {
            course: {
              select: {
                id: true,
                slug: true,
                status: true,
                isFree: true,
                publishedVersion: {
                  select: { titleAr: true, thumbnailUrl: true, durationMinutes: true },
                },
              },
            },
          },
        },
        assessments: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ featuredOrder: 'asc' }, { publishedAt: 'desc' }],
    });
  }

  async getPublishedDiplomaBySlug(slug: string) {
    const diploma = await this.prisma.diploma.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        instructorAssignments: {
          include: {
            instructor: { select: { id: true, fullName: true, headlineAr: true, avatarUrl: true } },
          },
          orderBy: { isPrimary: 'desc' },
        },
        courses: {
          orderBy: { sortOrder: 'asc' },
          include: {
            course: {
              include: {
                instructor: { select: { id: true, fullName: true, avatarUrl: true } },
                publishedVersion: {
                  select: {
                    titleAr: true,
                    subtitleAr: true,
                    descriptionAr: true,
                    thumbnailUrl: true,
                    durationMinutes: true,
                  },
                },
              },
            },
          },
        },
        assessments: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!diploma) throw new NotFoundException('الدبلومة غير موجودة أو غير منشورة');
    return diploma;
  }

  async getCmsPage(slug: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { slug, isPublished: true },
    });
    if (!page) throw new NotFoundException('الصفحة غير موجودة');
    return page;
  }

  async rankSpecializations(body: {
    dimensionScores: Record<string, number>;
    speciesScores: Record<string, number>;
  }) {
    const domains = await this.prisma.specializationDomain.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        subfields: {
          orderBy: { sortOrder: 'asc' },
          include: {
            leaves: {
              orderBy: { sortOrder: 'asc' },
              include: {
                mappedCourse: {
                  select: {
                    slug: true,
                    status: true,
                    publishedVersion: { select: { titleAr: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const ranked = rankSpecializationDomains(
      domains.map((d) => ({
        id: d.id,
        slug: d.slug,
        nameAr: d.nameAr,
        descriptionAr: d.descriptionAr,
        weightsCode: d.weightsCode,
        speciesCode: d.speciesCode,
        leafCount: d.subfields.reduce((acc, sf) => acc + sf.leaves.length, 0),
      })),
      body.dimensionScores ?? {},
      body.speciesScores ?? {},
    );

    return ranked.slice(0, 3).map((r) => ({
      ...r,
      domain: domains.find((d) => d.id === r.id),
    }));
  }

  async submitLead(data: {
    type: 'INDIVIDUAL' | 'CORPORATE_B2B' | 'SPONSOR' | 'WAITLIST';
    fullName: string;
    companyName?: string | null;
    phoneNumber: string;
    countryCode?: string;
    roleLabel?: string | null;
    interest?: string | null;
    sector?: string | null;
    teamSize?: string | null;
    need?: string | null;
    timeline?: string | null;
    notes?: string | null;
  }) {
    const phoneE164 = normalizePhoneToE164(data.phoneNumber, data.countryCode ?? '+20');
    if (!phoneE164) {
      throw new NotFoundException('رقم الهاتف غير صالح');
    }

    let leadScore: number | null = null;
    if (data.type === 'CORPORATE_B2B') {
      const sizeScore = data.teamSize?.includes('200') || data.teamSize?.includes('٢٠٠') ? 4 : 2;
      const timeScore = data.timeline?.includes('شهر') ? 3 : 1;
      leadScore = sizeScore + timeScore;
    }

    return this.prisma.leadSubmission.create({
      data: {
        type: data.type,
        fullName: data.fullName,
        companyName: data.companyName ?? null,
        phoneE164,
        roleLabel: data.roleLabel ?? null,
        interest: data.interest ?? null,
        sector: data.sector ?? null,
        teamSize: data.teamSize ?? null,
        need: data.need ?? null,
        timeline: data.timeline ?? null,
        leadScore,
        notes: data.notes ?? null,
      },
    });
  }

  async submitPartnerApplication(data: {
    fullName: string;
    organizationName: string;
    phoneNumber?: string | null;
    countryCode?: string;
    email?: string | null;
    partnershipInterest: string;
    notes?: string | null;
    website?: string | null;
  }) {
    if (data.website && data.website.trim().length > 0) {
      throw new BadRequestException('تعذر إرسال الطلب يرجى المحاولة بشكل يدوي');
    }

    const cleanPhone = data.phoneNumber?.trim() || '';
    const cleanEmail = data.email?.trim() || '';
    const phoneE164 = cleanPhone
      ? normalizePhoneToE164(cleanPhone, data.countryCode ?? '+20')
      : null;

    if (cleanPhone && !phoneE164) {
      throw new BadRequestException('صيغة رقم الهاتف غير صالحة');
    }
    if (!phoneE164 && !cleanEmail) {
      throw new BadRequestException('يرجى إدخال رقم هاتف أو بريد إلكتروني للتواصل');
    }

    const interestLabel =
      PARTNERSHIP_INTEREST_LABELS[data.partnershipInterest] || data.partnershipInterest;

    const saved = await this.prisma.leadSubmission.create({
      data: {
        type: 'SPONSOR',
        fullName: data.fullName.trim(),
        companyName: data.organizationName.trim(),
        phoneE164: phoneE164 ?? 'EMAIL_ONLY',
        email: cleanEmail || null,
        interest: interestLabel,
        need: interestLabel,
        leadScore: 6,
        priority: 'HIGH',
        notes: data.notes?.trim() || null,
      },
      select: {
        id: true,
        type: true,
        fullName: true,
        companyName: true,
        interest: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      ok: true,
      application: saved,
      messageAr: 'تم استلام طلب الشراكة بنجاح وسيتم مراجعته من إدارة أكاديمية بوصلة.',
    };
  }

  async listPublishedCareers() {
    return this.prisma.careerOpportunity.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getInstructorPublicProfile(id: string) {
    const instructor = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        headlineAr: true,
        bioAr: true,
        avatarUrl: true,
        role: true,
        status: true,
        instructorProfile: {
          select: {
            specializations: true,
            yearsExperience: true,
          },
        },
        instructedCourses: {
          where: { status: 'PUBLISHED', publishedVersionId: { not: null } },
          select: {
            id: true,
            slug: true,
            isFree: true,
            priceCents: true,
            currency: true,
            category: { select: { nameAr: true } },
            publishedVersion: {
              select: {
                titleAr: true,
                subtitleAr: true,
                thumbnailUrl: true,
                coverFocalX: true,
                coverFocalY: true,
                coverFitMode: true,
                durationMinutes: true,
              },
            },
          },
          orderBy: [{ featuredOrder: 'asc' }, { publishedAt: 'desc' }],
        },
      },
    });
    if (!instructor || instructor.status !== 'ACTIVE') {
      throw new NotFoundException('بيانات المدرب غير متاحة');
    }
    return instructor;
  }
}
