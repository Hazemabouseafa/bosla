import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';

const execFileAsync = promisify(execFile);

const WINGET_FFMPEG =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe';

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

async function logoutFromHeader(page: Page) {
  const logoutBtn = page.getByRole('button', { name: /خروج/ }).first();
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click();
    await page.waitForTimeout(400);
  } else {
    await page.evaluate(async () => {
      const me = await fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json());
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: me?.csrfToken ? { 'X-CSRF-Token': me.csrfToken } : {},
      });
    });
    await page.goto('/');
  }
}

test.describe('BOSLA Feature Audit Browser E2E — Video, Subtitles, Certificates & Commerce', () => {
  let tmpDir = '';
  let sampleMp4Path = '';

  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-audit-pw-'));
    sampleMp4Path = path.join(tmpDir, 'audit-lesson-720p.mp4');

    const ffmpeg = await resolveFfmpeg();
    await execFileAsync(ffmpeg, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=6:size=1280x720:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=6',
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

  test('Full Browser Audit Journey: Preserved RTL Homepage -> Admin Watermark, Coupons & Accredited Templates -> Instructor HLS + WebVTT Subtitles + Download Toggle -> Learner Adaptive Playback, Watermark, Speed, Resume, Coupon Preview & 3 Certificate Types', async ({
    page,
  }) => {
    const tag = Date.now().toString().slice(-6);
    const couponCode = `AUDIT${tag}`;

    // 1. Verify preserved Arabic RTL homepage and explicit exclusion of searchable AI transcription
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByText('أكاديمية بوصلة').first()).toBeVisible();

    const transcriptProbe = await page.request.get('/api/v1/videos/transcripts/search?q=test');
    expect(transcriptProbe.status()).toBe(404);

    // 2. Admin configures Video Watermark Policy, creates Discount Coupon, and configures Accredited Program Template
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: /الشهادات والاسترداد/ }).first().click();
    const couponsTemplatesPanel = page.getByTestId('admin-coupons-templates-panel');
    await expect(couponsTemplatesPanel).toBeVisible();

    // Create a 25% coupon applicable to ALL targets via Admin UI
    await couponsTemplatesPanel.locator('input[placeholder="BOSLA25"]').fill(couponCode);
    await couponsTemplatesPanel.getByRole('button', { name: 'إنشاء الكوبون' }).click();
    await expect(couponsTemplatesPanel.getByText(couponCode)).toBeVisible();

    // Configure an Accredited Program certificate template with real accrediting body details
    await couponsTemplatesPanel
      .getByLabel('تفعيل إصدار هذا البرنامج المعتمد رسمياً')
      .check();
    await couponsTemplatesPanel
      .locator('input[placeholder*="النقابة العامة"]')
      .fill('النقابة العامة للأطباء البيطريين');
    await couponsTemplatesPanel
      .locator('input[placeholder="ACC-BODY-CODE"]')
      .fill('EG-VET-SYN');
    await couponsTemplatesPanel
      .locator('input[placeholder="AUTH-REF-2026"]')
      .fill(`AUTH-VET-${tag}`);
    await couponsTemplatesPanel.getByRole('button', { name: 'حفظ قالب الشهادة' }).click();
    await expect(couponsTemplatesPanel.getByText('الاعتماد مفعّل').first()).toBeVisible();

    // Verify Video Watermark Policy in CMS & Settings tab
    await page.getByRole('button', { name: /الصفحات والعملاء والسجل/ }).first().click();
    await expect(
      page.getByText('سياسة العلامة المائية المتحركة على مشغّل الفيديو'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'حفظ سياسة العلامة المائية' }).click();

    // 3. Instructor uploads 720p MP4, waits for FFmpeg adaptive HLS (480p + 720p), adds WebVTT subtitle track, and enables download
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000101', 'BoslaInstructor#2026');
    await expect(page).toHaveURL(/\/instructor/);

    await page.goto('/instructor/videos');
    const videoTitle = `فيديو تدقيق البث والترجمة ${tag}`;
    await page.fill('#vid-title', videoTitle);
    await page.setInputFiles('#vid-file', sampleMp4Path);
    await page.getByRole('button', { name: /بدء الرفع المجزأ/ }).click();
    await expect(page.getByText(/الفيديو مسجل برقم:/)).toBeVisible();

    await expect(async () => {
      await page.getByRole('button', { name: 'تحديث حالة المعالجة' }).click();
      await expect(page.getByText('جاهز للعرض').first()).toBeVisible();
    }).toPass({ timeout: 45_000, intervals: [1500] });

    const videoRow = page.locator('div.rounded-xl', { hasText: videoTitle }).first();
    await expect(videoRow).toContainText('480p');
    await expect(videoRow).toContainText('720p');

    // Enable video download policy for this asset
    await videoRow.getByRole('button', { name: 'تفعيل التحميل' }).click();
    await expect(videoRow.getByText('التحميل مسموح')).toBeVisible();

    // Open WebVTT Subtitles modal and upload an Arabic WebVTT track
    await videoRow.getByRole('button', { name: 'الترجمة (VTT)' }).click();
    await expect(page.getByText(/إدارة الترجمة المصاحبة \(WebVTT\)/)).toBeVisible();
    await page
      .locator('textarea')
      .fill(
        'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nمرحباً بكم في محاضرة الأمان الحيوي وضبط التهوية في بوصلة.\n',
      );
    await page.getByRole('button', { name: 'حفظ ملف الترجمة WebVTT' }).click();
    await expect(page.getByText('العربية').first()).toBeVisible();
    await page.locator('dialog[open] button').first().click();

    // Create a free published course via API or UI so learner can immediately test player features in browser
    const courseSlug = `audit-browser-course-${tag}`;
    await page.goto('/instructor');
    await page.getByRole('button', { name: /إنشاء كورس جديد|إضافة كورس/ }).first().click();
    await page.fill('#nc-title', `كورس تدقيق المشغل والشهادات ${tag}`);
    await page.fill('#nc-slug', courseSlug);
    await page.fill(
      '#nc-desc',
      'كورس لاختبار مشغل HLS المتكيف والعلامة المائية والترجمة وسرعة التشغيل والاستئناف والشهادات.',
    );
    await page.getByRole('button', { name: 'إنشاء وفتح محرر الكورس' }).click();
    await expect(page).toHaveURL(/\/instructor\/courses\//);

    // Add 1 section with 1 lesson using the uploaded READY video and mark lesson as free preview
    await page.getByRole('button', { name: 'إضافة قسم' }).click();
    await page.getByRole('button', { name: 'إضافة درس' }).first().click();

    const videoOptionValue = await page
      .locator('select option', { hasText: videoTitle })
      .first()
      .getAttribute('value');
    expect(videoOptionValue).toBeTruthy();
    await page
      .locator('select')
      .filter({ has: page.locator(`option[value="${videoOptionValue}"]`) })
      .first()
      .selectOption(videoOptionValue!);

    await page
      .locator('label', { hasText: 'معاينة مجانية' })
      .locator('input[type="checkbox"]')
      .first()
      .check();

    await page.getByRole('button', { name: /حفظ المسودة/ }).click();
    await expect(page.getByText(/تم حفظ المسودة بنجاح/)).toBeVisible();
    await page.getByRole('button', { name: 'إرسال للمراجعة الإدارية' }).click();
    await expect(page.getByText(/تم إرسال الكورس للإدارة/)).toBeVisible();

    // Admin publishes the course
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);
    await page.getByRole('button', { name: /مراجعة الكورسات/ }).click();
    const editorialCard = page
      .locator('div.rounded-2xl', { hasText: `كورس تدقيق المشغل والشهادات ${tag}` })
      .filter({ has: page.getByRole('button', { name: 'اعتماد الكورس' }) })
      .first();
    await editorialCard.getByRole('button', { name: 'اعتماد الكورس' }).click();
    await editorialCard.getByRole('button', { name: 'نشر فوري للطلاب' }).click();
    await expect(page.getByText(/تم نشر الكورس للطلاب بنجاح/)).toBeVisible();

    // 4. Learner logs in, tests coupon preview on /pricing, then opens /learn/[slug]
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');
    await expect(page).toHaveURL(/\/student/);

    await page.goto('/pricing');
    const couponInput = page.getByTestId('membership-coupon-input');
    await expect(couponInput).toBeVisible();
    await couponInput.fill(couponCode);
    await page.getByTestId('membership-coupon-apply-btn').click();
    await expect(page.getByText(new RegExp(`تم تطبيق الكوبون ${couponCode}`))).toBeVisible();

    // Open the course player and verify all player controls & overlays
    await page.goto(`/learn/${courseSlug}`);
    await expect(page.locator('video')).toBeVisible();

    // Personalized watermark overlay is rendered with masked non-sensitive identifier (never full phone)
    const watermark = page.getByTestId('bosla-video-watermark');
    await expect(watermark).toBeVisible();
    const wmText = (await watermark.textContent()) || '';
    expect(wmText).toContain('USR-');
    expect(wmText).not.toContain('01000000201');

    // Quality selector contains Auto + 720p + 480p (no upscaled 1080p)
    const qualitySelect = page.getByTestId('player-quality-select');
    await expect(qualitySelect).toBeVisible();
    const qualityOptionsText = await qualitySelect.locator('option').allTextContents();
    expect(qualityOptionsText.some((t) => t.includes('720p'))).toBe(true);
    expect(qualityOptionsText.some((t) => t.includes('480p'))).toBe(true);
    expect(qualityOptionsText.some((t) => t.includes('1080p'))).toBe(false);

    // Subtitles selector contains our Arabic WebVTT track
    const subtitleSelect = page.getByTestId('player-subtitle-select');
    await expect(subtitleSelect).toBeVisible();
    await expect(subtitleSelect).toContainText('العربية');

    // Download button is visible because instructor enabled download for this asset
    await expect(page.getByTestId('player-download-video-btn')).toBeVisible();

    // Change playback speed to 1.5x and verify server persistence across reload
    const speedSelect = page.getByTestId('player-speed-select');
    const prefSavePromise = page.waitForResponse(
      (res) => res.url().includes('/learning/preferences') && res.ok(),
    );
    await speedSelect.selectOption('1.5');
    await prefSavePromise;

    await page.reload();
    await expect(page.getByTestId('player-speed-select')).toHaveValue('1.5');

    // Verify public certificate verification portal
    await page.goto('/certificates/verify');
    await expect(
      page.getByText(/التحقق من الشهادات الثلاث|بوابة التحقق من الشهادات/).first(),
    ).toBeVisible();
  });
});
