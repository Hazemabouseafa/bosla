import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';

const execFileAsync = promisify(execFile);

const WINGET_FFMPEG =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe';

const SCREENSHOT_DIR =
  'C:/Users/w.i/.gemini/antigravity/brain/bdfd6423-e74c-403e-80c6-c124d2759916/ux-overhaul-screenshots';

async function resolveFfmpeg(): Promise<string> {
  try {
    await fs.access(WINGET_FFMPEG);
    return WINGET_FFMPEG;
  } catch {
    return 'ffmpeg';
  }
}

async function loginWithPhone(page: Page, phone: string, password: string) {
  await page.goto('/login');
  await page.fill('#login-phone', phone);
  await page.fill('#login-pass', password);
  await page.getByRole('button', { name: 'دخول برقم الموبايل وكلمة المرور' }).click();
}

async function logoutSession(page: Page) {
  await page.evaluate(async () => {
    const me = await fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .catch(() => null);
    const csrf = me?.data?.csrfToken ?? me?.csrfToken;
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    }).catch(() => {});
  });
  await page.context().clearCookies();
}

test.describe('BOSLA UX Overhaul E2E — 4-Step Course Wizard, Video Recovery, Live Editor, Pricing & Paymob', () => {
  let tmpDir = '';
  let sampleMp4Path = '';

  test.beforeAll(async () => {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-ux-e2e-'));
    sampleMp4Path = path.join(tmpDir, 'wizard-batch-lesson.mp4');

    const ffmpeg = await resolveFfmpeg();
    await execFileAsync(ffmpeg, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=640x360:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'ultrafast',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-shortest',
      sampleMp4Path,
    ]);
  });

  test.afterAll(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('Full User Journeys: Instructor 4-Step Wizard + Batch Video HLS -> Admin Live Editor + Encrypted Paymob -> Visitor Free Preview & Homepage Pricing Preservation', async ({
    page,
  }) => {
    // =========================================================================
    // 1. INSTRUCTOR 4-STEP COURSE WIZARD + AUTO-SAVE + BATCH VIDEO UPLOAD + FREE PREVIEW
    // =========================================================================
    await loginWithPhone(page, '01000000101', 'BoslaInstructor#2026');
    await expect(page).toHaveURL(/\/instructor/);

    await page.getByTestId('instructor-new-course-wizard-btn').click();
    await expect(page.getByTestId('course-wizard-editor')).toBeVisible();

    const uniqueTitle = `كورس التشخيص الحيوي الميداني ${Date.now().toString().slice(-4)}`;
    await page.getByTestId('wizard-input-title').fill(uniqueTitle);
    await page
      .getByTestId('wizard-input-description')
      .fill(
        'برنامج تطبيقي متكامل يشرح بروتوكولات سحب العينات والتشخيص المعملي وإدارة الأمن الحيوي في مزارع الدواجن الحديثة.',
      );

    // Step 1 -> Step 2 (creates draft on server and updates URL to /instructor/courses/:id)
    await page.getByTestId('wizard-next-to-step-2').click();
    await expect(page).toHaveURL(/\/instructor\/courses\/.+/);
    await expect(page.getByTestId('wizard-step-2-panel')).toBeVisible();

    // Fill cover image URL and verify auto-save status confirms "تم الحفظ"
    await page
      .getByTestId('wizard-input-thumbnail-url')
      .fill('/images/brand/course-biosecurity.webp');
    await expect(page.getByTestId('wizard-autosave-status')).toContainText('تم الحفظ', {
      timeout: 15_000,
    });

    // Step 2 -> Step 3 (Curriculum, Batch Video Upload & Free Preview Controls)
    await page.getByTestId('wizard-next-to-step-3').click();
    await expect(page.getByTestId('wizard-step-3-panel')).toBeVisible();

    // Open Batch Video Uploader and upload real MP4 -> auto-transcodes to HLS READY & auto-creates Lesson 1
    await page.getByTestId('toggle-batch-video-uploader-btn').click();
    await page.getByTestId('video-chunk-file-input').setInputFiles(sampleMp4Path);
    await page.getByTestId('start-video-upload-btn').click();

    await expect(page.getByTestId('status-ready-for-playback')).toBeVisible({
      timeout: 35_000,
    });

    // Wait for Lesson 1 row to appear automatically in Step 3
    await expect(page.locator('[data-testid^="wizard-lesson-row-"]').first()).toBeVisible({
      timeout: 15_000,
    });

    // Add a second video lesson linked to the ready HLS video
    await page
      .getByTestId('wizard-new-lesson-title')
      .fill('الدرس الثاني: تفسير نتائج المعايرة المناعية (للمشتركين فقط)');
    await page.getByTestId('wizard-new-lesson-video').selectOption({ index: 1 });
    await page.getByTestId('wizard-add-lesson-btn').click();
    await expect(page.locator('[data-testid^="wizard-lesson-row-"]')).toHaveCount(2);

    // Default state: both lessons are locked ("مقفل — للمشتركين فقط")
    await expect(page.getByTestId('bulk-lesson-availability-bar')).toContainText(
      '0 معاينة مجانية',
    );

    // Click Bulk "فتح أول درس فقط كمعاينة مجانية"
    await page.getByTestId('bulk-unlock-first-btn').click();
    await expect(page.getByTestId('bulk-lesson-availability-bar')).toContainText(
      '1 معاينة مجانية',
    );
    await expect(page.getByTestId('bulk-lesson-availability-bar')).toContainText(
      '1 مقفل للمشتركين',
    );

    // Step 3 -> Step 4 (Pricing, Visitor vs Student Preview, Missing Checklist & Submit)
    await page.getByTestId('wizard-next-to-step-4').click();
    await expect(page.getByTestId('wizard-step-4-panel')).toBeVisible();

    // Verify Visitor vs Student Preview switcher
    await expect(page.getByTestId('course-visitor-student-preview')).toContainText(
      'معاينة مجانية متاحة',
    );
    await expect(page.getByTestId('course-visitor-student-preview')).toContainText(
      'مقفل — يتطلب اشتراك',
    );
    await page.getByTestId('preview-as-student-btn').click();
    await expect(page.getByTestId('course-visitor-student-preview')).not.toContainText(
      'مقفل — يتطلب اشتراك',
    );
    await page.getByTestId('preview-as-visitor-btn').click();

    // Verify completeness checklist shows 100% ready
    await expect(page.getByTestId('wizard-missing-checklist')).toContainText(
      'جاهز للنشر 100%',
    );

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-instructor-4step-course-wizard.png`,
      fullPage: true,
    });

    // Submit course for admin review
    const courseUrlMatch = page.url().match(/\/instructor\/courses\/([^/?#]+)/);
    const createdCourseId = courseUrlMatch?.[1] ?? '';
    expect(createdCourseId.length).toBeGreaterThan(5);

    await page.getByTestId('wizard-primary-publish-or-submit-btn').click();
    await expect(page.getByText('قيد المراجعة الإدارية')).toBeVisible({ timeout: 10_000 });

    // =========================================================================
    // 2. ADMIN: PUBLISH COURSE + LIVE SITE EDITOR (DRAFT vs PUBLISH vs ROLLBACK) + PAYMOB SETTINGS
    // =========================================================================
    await logoutSession(page);
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    // Admin directly publishes the submitted course via API so we can test visitor free-preview playback
    const publishedCourseSlug = await page.evaluate(async (cId) => {
      const me = await fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) =>
        r.json(),
      );
      const csrf = me?.data?.csrfToken ?? me?.csrfToken;
      const pubRes = await fetch(`/api/v1/admin/courses/${cId}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
      }).then((r) => r.json());
      return pubRes?.data?.slug ?? pubRes?.slug;
    }, createdCourseId);
    expect(publishedCourseSlug).toBeTruthy();

    // Open Live Site Editor tab ("تخصيص الموقع (Live Editor)")
    await page.getByRole('button', { name: /تخصيص الموقع \(Live Editor\)/ }).click();
    await expect(page.getByTestId('admin-live-site-editor')).toBeVisible();

    // Test responsive preview switcher (Desktop -> Tablet -> Mobile -> Desktop)
    await page.getByTestId('live-editor-viewport-tablet').click();
    await page.getByTestId('live-editor-viewport-mobile').click();
    await page.getByTestId('live-editor-viewport-desktop').click();

    // Edit Hero Badge in Draft and Save Draft ONLY
    const draftOnlyBadge = `مسودة اختبار ${Date.now().toString().slice(-4)}`;
    await page.getByTestId('live-editor-hero-badge').fill(draftOnlyBadge);
    await page.getByTestId('live-editor-save-draft-btn').click();
    await expect(page.getByText('يوجد تعديلات مسودة غير منشورة')).toBeVisible();

    // Verify public /api/v1/catalog/live-layout does NOT expose the unpublished draft
    const publicBadgeBeforePublish = await page.evaluate(async () => {
      const res = await fetch('/api/v1/catalog/live-layout').then((r) => r.json());
      const body = res?.data ?? res;
      return (body?.layout ?? body?.config)?.hero?.badgeAr;
    });
    expect(publicBadgeBeforePublish).not.toBe(draftOnlyBadge);

    // Edit Pricing Title and Publish to visitors
    await page.getByTestId('live-editor-tab-pricing').click();
    const publishedPricingTitle = 'باقات العضوية الاحترافية المعتمدة';
    await page.getByTestId('live-editor-pricing-title').fill(publishedPricingTitle);
    await page
      .getByTestId('live-editor-summary-input')
      .fill('تحديث عنوان قسم الباقات والأسعار من المحرر المباشر');
    await page.getByTestId('live-editor-publish-btn').click();
    await expect(page.getByText('المسودة مطابقة للمنشور')).toBeVisible({ timeout: 10_000 });

    const publicAfterPublish = await page.evaluate(async () => {
      const res = await fetch('/api/v1/catalog/live-layout').then((r) => r.json());
      return res?.data ?? res;
    });
    expect(
      (publicAfterPublish?.layout ?? publicAfterPublish?.config)?.pricing?.titleAr,
    ).toBe(publishedPricingTitle);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-admin-live-site-editor.png`,
      fullPage: true,
    });

    // Open Paymob Settings tab ("الإعدادات ← المدفوعات ← Paymob")
    await page.getByRole('button', { name: /الإعدادات ← المدفوعات ← Paymob/ }).click();
    await expect(page.getByTestId('admin-paymob-settings-panel')).toBeVisible();

    await page.getByTestId('paymob-enable-toggle').check();
    await page.getByTestId('paymob-input-test_integrationIdCard').fill('445566');
    await page.getByTestId('paymob-input-test_iframeId').fill('889900');

    // Fill or replace API Key and HMAC Secret
    const replaceApiKeyBtn = page.getByTestId('replace-secret-test_apiKey');
    if (await replaceApiKeyBtn.isVisible().catch(() => false)) {
      await replaceApiKeyBtn.click();
    }
    await page
      .getByTestId('paymob-input-test_apiKey')
      .fill('egy_api_key_secret_test_9876');

    const replaceHmacBtn = page.getByTestId('replace-secret-test_hmacSecret');
    if (await replaceHmacBtn.isVisible().catch(() => false)) {
      await replaceHmacBtn.click();
    }
    await page
      .getByTestId('paymob-input-test_hmacSecret')
      .fill('bosla_sandbox_hmac_secret');

    await page.getByTestId('paymob-save-btn').click();

    // After save, secrets MUST be masked and locked behind "استبدال القيمة السرية"
    await expect(page.getByTestId('replace-secret-test_apiKey')).toBeVisible();
    await expect(page.getByTestId('replace-secret-test_hmacSecret')).toBeVisible();
    const maskedApiKeyVal = await page
      .getByTestId('paymob-input-test_apiKey')
      .inputValue();
    expect(maskedApiKeyVal).toContain('••••');
    expect(maskedApiKeyVal).not.toContain('egy_api_key_secret_test');

    await page.getByTestId('paymob-verify-readiness-btn').click();
    await expect(page.getByTestId('paymob-readiness-status')).toContainText('مكتملة');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-admin-paymob-encrypted-settings.png`,
      fullPage: true,
    });

    // =========================================================================
    // 3. VISITOR: HOMEPAGE PRICING SECTION + PLAN PRESERVATION ACROSS LOGIN + FREE PREVIEW PLAYBACK
    // =========================================================================
    await logoutSession(page);
    await page.goto('/');

    const pricingSection = page.getByTestId('homepage-pricing-section');
    await expect(pricingSection).toBeVisible();
    await expect(pricingSection).toContainText(publishedPricingTitle);

    // Scroll to pricing section and capture desktop + mobile RTL screenshots
    await pricingSection.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-homepage-pricing-section.png`,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await pricingSection.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-mobile-rtl-homepage-pricing.png`,
    });
    await page.setViewportSize({ width: 1280, height: 840 });

    // Click the first plan CTA as a logged-out visitor -> must redirect to /login?next=/pricing?plan=...
    const firstPlanCta = page.locator('[data-testid^="homepage-pricing-cta-"]').first();
    await firstPlanCta.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fpricing%3Fplan%3D/);

    // Visitor watches the Free Preview lesson on the newly published course WITHOUT logging in!
    await page.goto(`/learn/${publishedCourseSlug}`);
    await expect(page.locator('video')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('player-error-overlay')).toHaveCount(0);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-visitor-free-preview-hls-player.png`,
    });

    // Visitor clicks the second (locked) lesson -> must see "هذا الدرس متاح للمشتركين فقط"
    await page
      .getByRole('button', { name: /الدرس الثاني: تفسير نتائج المعايرة المناعية/ })
      .click();
    await expect(page.getByText('هذا الدرس متاح للمشتركين فقط')).toBeVisible();
  });
});
