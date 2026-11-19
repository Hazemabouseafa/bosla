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

test.describe('BOSLA Academy Course Community & Lesson Q&A E2E', () => {
  let tmpDir = '';
  let sampleMp4Path = '';

  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-pw-comm-'));
    sampleMp4Path = path.join(tmpDir, 'community-lesson-sample.mp4');

    const ffmpeg = await resolveFfmpeg();
    await execFileAsync(ffmpeg, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=5:size=640x360:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=5',
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

  test('Full Community + Lesson Q&A + Video Timestamp + Instructor Reply + Notifications + Admin Governance flow', async ({
    page,
  }) => {
    // 0. Unauthenticated user sees restricted notice on course community page
    await page.goto('/courses/poultry-farm-management/community');
    await expect(page.getByText('يلزم تسجيل الدخول للوصول إلى مجتمع الكورس وأسئلة الدروس')).toBeVisible();

    // 1. Instructor uploads 5s test video (READY via FFmpeg worker) and publishes a video course via Admin
    await loginWithPhone(page, '01000000101', 'BoslaInstructor#2026');
    await expect(page).toHaveURL(/\/instructor/);

    await page.goto('/instructor/videos');
    const videoTitle = `فيديو سؤال الدرس ${Date.now()}`;
    await page.fill('#vid-title', videoTitle);
    await page.setInputFiles('#vid-file', sampleMp4Path);
    await page.getByRole('button', { name: /بدء الرفع المجزأ/ }).click();
    await expect(page.getByText(/الفيديو مسجل برقم:/)).toBeVisible();

    await expect(async () => {
      await page.getByRole('button', { name: 'تحديث حالة المعالجة' }).click();
      await expect(page.getByText('جاهز للعرض').first()).toBeVisible();
    }).toPass({ timeout: 45_000, intervals: [1500] });

    await page.goto('/instructor');
    await page.getByRole('button', { name: /إنشاء كورس جديد|إضافة كورس/ }).first().click();

    const courseSlug = `e2e-comm-hls-${Date.now()}`;
    const courseTitle = `كورس مجتمع وأسئلة الدروس ${Date.now()}`;
    await page.fill('#nc-title', courseTitle);
    await page.fill('#nc-slug', courseSlug);
    await page.fill(
      '#nc-desc',
      'كورس يختبر أسئلة الدروس المرتبطة بوقت الفيديو ومجتمع الكورس الموحد ولوحة المدرب والإدارة.',
    );
    await page.getByRole('button', { name: 'إنشاء وفتح محرر الكورس' }).click();
    await expect(page).toHaveURL(/\/instructor\/courses\//);

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

    await page.getByRole('button', { name: /حفظ المسودة/ }).click();
    await expect(page.getByText(/تم حفظ المسودة بنجاح/)).toBeVisible();

    await page.getByRole('button', { name: 'إرسال للمراجعة الإدارية' }).click();
    await expect(page.getByText(/تم إرسال الكورس للإدارة/)).toBeVisible();

    // Admin approves, publishes, and adds course to Annual plan (used by demo student)
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: /مراجعة الكورسات/ }).click();
    const editorialCard = page
      .locator('div.rounded-2xl', { hasText: courseTitle })
      .filter({ has: page.getByRole('button', { name: 'اعتماد الكورس' }) })
      .first();
    await expect(editorialCard).toBeVisible();
    await editorialCard.getByRole('button', { name: 'اعتماد الكورس' }).click();
    await editorialCard.getByRole('button', { name: 'نشر فوري للطلاب' }).click();
    await expect(page.getByText(/تم نشر الكورس للطلاب بنجاح/)).toBeVisible();

    await page.getByRole('button', { name: 'العضويات والاشتراكات' }).click();
    const editPlanButtons = page.getByRole('button', { name: 'تعديل السعر والمحتوى المشمول' });
    await editPlanButtons.last().click();
    const annualCheckbox = page
      .locator('dialog label', { hasText: courseTitle })
      .locator('input[type="checkbox"]');
    await annualCheckbox.check();
    await page
      .getByRole('button', { name: 'حفظ التغييرات وإصدار نسخة خطة جديدة' })
      .click();
    await expect(page.getByText('تم تحديث سعر ومحتوى العضوية بنسخة جديدة')).toBeVisible();

    // 2. Demo Student opens /learn/[slug], watches video, asks Lesson Q&A with video timestamp
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');
    await expect(page).toHaveURL(/\/student/);

    const masterResPromise = page.waitForResponse(
      (res) => res.url().includes('/master.m3u8?token=') && res.status() === 200,
    );
    await page.goto(`/learn/${courseSlug}`);
    await expect(page.locator('video')).toBeVisible();
    await masterResPromise;

    await expect(page.getByRole('heading', { name: 'أسئلة هذا الدرس' })).toBeVisible();

    // Advance playback time smoothly to 2 seconds and dispatch timeupdate
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 2;
        video.dispatchEvent(new Event('timeupdate'));
      }
    });

    await page.getByRole('button', { name: 'اسأل عن هذا الدرس' }).first().click();
    const questionTitle = `استفسار عن الدقيقة الثانية ${Date.now()}`;
    await page.fill('#lesson-q-title', questionTitle);
    await page.fill('#lesson-q-body', 'هل هذا الضبط مناسب عند الثانية الثانية من الفيديو؟');
    await page.getByRole('button', { name: 'نشر السؤال' }).click();

    await expect(page.getByText(questionTitle)).toBeVisible();
    const tsBtn = page.getByRole('button', { name: /شاهد الجزء المرتبط بالسؤال — 00:0[1-3]/ }).first();
    await expect(tsBtn).toBeVisible();

    // Reset video time to 0 and click timestamp button -> verifies video seeks to ~2s
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) video.currentTime = 0;
    });
    await tsBtn.click();
    await expect
      .poll(
        () => page.evaluate(() => document.querySelector('video')?.currentTime ?? 0),
        { timeout: 5000 },
      )
      .toBeGreaterThanOrEqual(1);

    // 3. Switch to Course Community tab & verify Lesson Q&A appears in unified community
    await page.getByRole('button', { name: 'مجتمع الكورس والمناقشات' }).click();
    await page.getByRole('button', { name: 'أسئلة الدروس' }).click();
    await expect(page.getByText(questionTitle)).toBeVisible();

    // Click deep-link button from Course Community back to Lesson Player at timestamp
    await page
      .getByRole('button', { name: /مشاهدة الدقيقة المرتبطة بالسؤال — 00:0[1-3]/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'أسئلة هذا الدرس' })).toBeVisible();

    // 4. Instructor opens "مجتمعات كورساتي", filters unanswered, replies (`إجابة المدرب`) & accepts answer (`تمت الإجابة`)
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000101', 'BoslaInstructor#2026');
    await expect(page).toHaveURL(/\/instructor/);

    await expect(page.getByRole('heading', { name: 'مجتمعات كورساتي' })).toBeVisible();
    await page.getByRole('button', { name: 'أسئلة بدون إجابة' }).click();

    const instCard = page
      .locator('div.space-y-3 > div.rounded-2xl', { hasText: questionTitle })
      .first();
    await expect(instCard).toBeVisible();
    await instCard.getByRole('button', { name: 'فتح والرد / اعتماد الإجابة' }).click();

    await page.fill('#thread-reply-body', 'إجابة المدرب الرسمية: نعم التوقيت والضبط صحيحان تمامًا.');
    await page.getByRole('button', { name: 'نشر الرد' }).click();
    await expect(page.locator('dialog').getByText('إجابة المدرب', { exact: true }).first()).toBeVisible();

    await page.locator('dialog').getByRole('button', { name: 'اعتماد الإجابة' }).first().click();
    await expect(page.locator('dialog').getByText('الإجابة المعتمدة', { exact: true })).toBeVisible();
    await page.locator('dialog button[aria-label="إغلاق النافذة"]').click();

    // 5. Demo student sees Notification in Bell dropdown & jumps directly via deep-link
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');
    await expect(page).toHaveURL(/\/student/);

    const bellBtn = page.getByRole('button', { name: /الإشعارات/ }).first();
    await expect(bellBtn).toBeVisible();
    await bellBtn.click();
    await expect(page.getByText(/أجاب المدرب|تم اعتماد إجابة/).first()).toBeVisible();
    await page.getByText(/أجاب المدرب|تم اعتماد إجابة/).first().click();
    await expect(page).toHaveURL(new RegExp(`/learn/${courseSlug}`));
    await expect(page.locator('dialog').getByText('الإجابة المعتمدة', { exact: true })).toBeVisible();
    await page.locator('dialog button[aria-label="إغلاق النافذة"]').click();

    // 6. Admin opens "إدارة المجتمعات", disables course community -> verified blocked -> re-enables
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: 'إدارة المجتمعات' }).click();
    const adminCourseRow = page
      .locator('div.rounded-xl', { hasText: courseTitle })
      .filter({ has: page.getByRole('button', { name: 'تعطيل المجتمع' }) })
      .first();
    await expect(adminCourseRow).toBeVisible();
    await adminCourseRow.getByRole('button', { name: 'تعطيل المجتمع' }).click();
    await expect(page.getByText('تم تعطيل مجتمع الكورس إداريًا')).toBeVisible();

    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');
    await expect(page).toHaveURL(/\/student/);
    await page.goto(`/courses/${courseSlug}/community`);
    await expect(page.getByText('مجتمع هذا الكورس معطّل حاليًا')).toBeVisible();
  });
});
