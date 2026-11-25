import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_PERMISSIONS,
  careerOpportunityUpsertSchema,
  certificateTemplateLayoutConfigSchema,
  cmsTestimonialUpsertSchema,
  coverCropMetadataSchema,
  googleOAuthConfigUpdateSchema,
  recommendationApproveSchema,
  recommendationRejectSchema,
  recommendationRequestCreateSchema,
  resolvePermissionsFromRoles,
  smtpMailConfigUpdateSchema,
  supportManualMembershipGrantSchema,
} from './index';

describe('Platform Expansion RBAC & Schemas', () => {
  it('keeps SUPPORT without membership.grant by default while allowing SUPER_ADMIN/ADMIN', () => {
    const supportPerms = resolvePermissionsFromRoles(['SUPPORT']);
    expect(supportPerms.has('support.manage')).toBe(true);
    expect(supportPerms.has('membership.grant')).toBe(false);
    expect(supportPerms.has('settlements.payout')).toBe(false);

    const adminPerms = resolvePermissionsFromRoles(['ADMIN']);
    expect(adminPerms.has('membership.grant')).toBe(true);
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toContain('membership.grant');
  });

  it('validates manual membership grant boundaries and mandatory Arabic reason', () => {
    expect(() =>
      supportManualMembershipGrantSchema.parse({
        userId: 'u1',
        planId: 'p1',
        durationDays: 0,
        reasonAr: 'تجربة مدة غير صالحة',
      }),
    ).toThrow();

    expect(() =>
      supportManualMembershipGrantSchema.parse({
        userId: 'u1',
        planId: 'p1',
        durationDays: 30,
        reasonAr: 'قصير',
      }),
    ).toThrow();

    const ok = supportManualMembershipGrantSchema.parse({
      userId: 'u1',
      planId: 'p1',
      durationDays: 30,
      reasonAr: 'تعويض مؤقت لمشكلة دفع موثقة',
    });
    expect(ok.durationDays).toBe(30);
  });

  it('enforces instructor-written recommendation body >= 20 chars and non-empty reject reasons', () => {
    expect(() =>
      recommendationRequestCreateSchema.parse({
        targetType: 'COURSE',
        courseId: 'c1',
        studentGoalAr: 'قصير',
      }),
    ).toThrow();

    expect(() =>
      recommendationApproveSchema.parse({
        letterBodyAr: 'نص قصير جداً',
      }),
    ).toThrow();

    expect(() =>
      recommendationRejectSchema.parse({
        rejectionReasonAr: 'لا',
      }),
    ).toThrow();

    const approved = recommendationApproveSchema.parse({
      letterTitleAr: 'خطاب توصية مهني',
      letterBodyAr:
        'أوصي بالمتدرب لالتزامه العملي وتطبيقه الكامل لمحاور الأمان الحيوي بالمزارع.',
    });
    expect(approved.letterTitleAr).toBe('خطاب توصية مهني');
  });

  it('validates certificate layout coordinates, cover crop bounds, and CMS configs', () => {
    const layout = certificateTemplateLayoutConfigSchema.parse({});
    expect(layout.recipientName.xPercent).toBe(50);
    expect(layout.recipientName.fontSizePx).toBe(30);
    expect(layout.issueDate.fontSizePx).toBe(14);
    expect(layout.verificationCode.fontSizePx).toBe(13);

    expect(() =>
      certificateTemplateLayoutConfigSchema.parse({
        recipientName: { xPercent: 120, yPercent: 45, fontSizePx: 24 },
      }),
    ).toThrow();

    expect(() =>
      coverCropMetadataSchema.parse({ coverFocalX: -5, coverFocalY: 50, coverFitMode: 'COVER' }),
    ).toThrow();
    const crop = coverCropMetadataSchema.parse({
      coverFocalX: 35,
      coverFocalY: 65,
      coverFitMode: 'CONTAIN',
    });
    expect(crop.coverFitMode).toBe('CONTAIN');

    const job = careerOpportunityUpsertSchema.parse({
      titleAr: 'أخصائي تدريب ميداني',
      summaryAr: 'الإشراف على التطبيقات العملية وتدريب الفرق في المزارع.',
      applyEmail: '',
      isPublished: true,
    });
    expect(job.sortOrder).toBe(0);

    const testimonial = cmsTestimonialUpsertSchema.parse({
      studentNameAr: 'د. محمد علي',
      quoteAr: 'تجربة عملية ممتازة في إدارة عنابر التسمين والأمان الحيوي.',
    });
    expect(testimonial.rating).toBe(5);

    const gCfg = googleOAuthConfigUpdateSchema.parse({ isEnabled: true, clientId: 'cid-123' });
    expect(gCfg.isEnabled).toBe(true);
    const mailCfg = smtpMailConfigUpdateSchema.parse({ isEnabled: false, port: 465, secure: true });
    expect(mailCfg.port).toBe(465);
  });
});
