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
    // Fallback via cookie/CSRF-safe logout through browser fetch
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

test.describe('BOSLA Academy Full-Stack E2E (Chromium + PostgreSQL + WebAuthn + FFmpeg HLS)', () => {
  let tmpDir = '';
  let sampleMp4Path = '';
  let samplePdfPath = '';

  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-pw-assets-'));
    sampleMp4Path = path.join(tmpDir, 'e2e-lesson-sample.mp4');
    samplePdfPath = path.join(tmpDir, 'e2e-checklist.pdf');

    const ffmpeg = await resolveFfmpeg();
    await execFileAsync(ffmpeg, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=3:size=640x360:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=3',
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

    await fs.writeFile(
      samplePdfPath,
      Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n', 'utf8'),
    );
  });

  test.afterAll(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('1. Public Arabic RTL storefront, specialization quiz, B2B lead, and strict 3-type catalog (no /programs)', async ({
    page,
  }) => {
    await page.goto('/');

    const htmlDir = await page.locator('html').getAttribute('dir');
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlDir).toBe('rtl');
    expect(htmlLang).toBe('ar');

    await expect(page.getByText('من الطالب إلى المدير').first()).toBeVisible();

    // Complete DB-driven Specialization Quiz
    const quizSection = page.locator('#specialization-quiz');
    await quizSection.scrollIntoViewIfNeeded();
    for (let step = 0; step < 8; step++) {
      const winner = quizSection.getByText('المركز #1');
      if (await winner.isVisible().catch(() => false)) break;
      const optBtn = quizSection.locator('button.text-start').first();
      await expect(optBtn).toBeVisible();
      await optBtn.click();
      await page.waitForTimeout(150);
    }
    await expect(quizSection.getByText('المركز #1')).toBeVisible();

    // Submit Corporate B2B Lead Form
    await page.getByRole('button', { name: 'تدريب شركات ومزارع B2B' }).click();
    await page.fill('#lead-name', 'م. طارق المنشاوي');
    await page.fill('#lead-phone', '01099887766');
    await page.fill('#lead-company', 'مجموعة الدلتا للدواجن E2E');
    await page.getByRole('button', { name: 'إرسال الطلب الآن' }).click();
    await expect(page.getByText(/تم استلام طلبك/).or(page.getByText(/بنجاح/))).toBeVisible();

    // Verify ONLY Courses, Learning Paths, and Diplomas (NO /programs)
    await page.goto('/courses');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goto('/learning-paths');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goto('/diplomas');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const programsRes = await page.request.get('/programs');
    expect(programsRes.status()).toBe(404);
  });

  test('2. Phone + Password registration -> Mandatory WebAuthn Passkey enrollment (NO OTP) -> Recovery codes -> Passkey login & non-OTP recovery', async ({
    page,
  }) => {
    // Enable Chromium CDP virtual FIDO2 authenticator
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });

    const uniquePhone = `01055${String(Date.now()).slice(-6)}`;
    const initialPass = 'StudentPass#2026';
    const newPass = 'ResetStudentPass#2026';

    try {
      await page.goto('/register');
      await expect(page.getByText('بدون رموز OTP')).toBeVisible();
      await page.fill('#reg-name', 'د. سارة حسام E2E');
      await page.fill('#reg-phone', uniquePhone);
      await page.fill('#reg-pass', initialPass);
      await page.fill('#reg-pass-confirm', initialPass);

      const checkboxes = page.locator('form input[type="checkbox"]');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await page.getByRole('button', { name: /إنشاء الحساب/ }).click();

      // Must land on Mandatory Passkey Enrollment (NO OTP)
      await expect(page).toHaveURL(/\/security\/passkey-setup/);
      await expect(
        page.getByRole('heading', { name: 'تأمين حسابك باستخدام Passkey' }),
      ).toBeVisible();

      await page.fill('#pk-name', 'جهاز الاختبار الافتراضي');
      await page.getByRole('button', { name: 'تفعيل الحساب وتسجيل Passkey الآن' }).click();

      // Capture 10 single-use recovery codes displayed once
      await expect(page.getByText('تم تفعيل حسابك بنجاح!')).toBeVisible();
      const codeElements = page.locator('code');
      const codeCount = await codeElements.count();
      expect(codeCount).toBeGreaterThanOrEqual(10);
      const firstRecoveryCode = (await codeElements.nth(0).innerText()).trim();
      expect(firstRecoveryCode.length).toBeGreaterThanOrEqual(8);

      // Acknowledge recovery codes and proceed to Student dashboard
      await page.locator('input[type="checkbox"]').last().check();
      await page.getByRole('button', { name: 'الدخول إلى لوحة التعلم' }).click();
      await expect(page).toHaveURL(/\/student/);

      // Logout and test Passkey login
      await logoutFromHeader(page);
      await page.goto('/login');
      await page.fill('#login-phone', uniquePhone);
      await page.getByRole('button', { name: 'دخول سريع عبر Passkey' }).click();
      await expect(page).toHaveURL(/\/student/);

      // Logout and test non-OTP Password Recovery via Recovery Code
      await logoutFromHeader(page);
      await page.goto('/recovery');
      await expect(page.getByText(/بدون أي OTP/)).toBeVisible();
      await page.fill('#rec-phone', uniquePhone);
      await page.getByRole('button', { name: 'متابعة خيارات الاسترداد الآمنة' }).click();

      // Confirm Passkey + Recovery Code + Support options appear (zero OTP!)
      await expect(page.getByRole('button', { name: 'عبر Passkey', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'كود استرداد', exact: true }).click();
      await page.fill('#rec-code', firstRecoveryCode);
      await page.getByRole('button', { name: 'التحقق واستهلاك الكود' }).click();

      await expect(page.locator('#rst-pass')).toBeVisible();
      await page.fill('#rst-pass', newPass);
      await page.fill('#rst-confirm', newPass);
      await page.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }).click();
      await expect(page.getByText('تم تحديث كلمة المرور بنجاح')).toBeVisible();

      // Verify login works with the newly reset password
      await loginWithPhone(page, uniquePhone, newPass);
      await expect(page).toHaveURL(/\/student/);
    } finally {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId }).catch(() => {});
    }
  });

  test('3. Full End-to-End Flow: Instructor chunked upload + FFmpeg HLS -> Admin editorial publish -> Student Paymob HMAC sandbox -> hls.js playback -> Quiz -> Public Certificate', async ({
    page,
  }) => {
    // STEP A: Instructor uploads real MP4 via chunked uploader and waits for FFmpeg HLS READY
    await loginWithPhone(page, '01000000101', 'BoslaInstructor#2026');
    await expect(page).toHaveURL(/\/instructor/);

    await page.goto('/instructor/videos');
    const videoTitle = 'فيديو التهوية E2E HLS';
    await page.fill('#vid-title', videoTitle);
    await page.setInputFiles('#vid-file', sampleMp4Path);
    await page.getByRole('button', { name: /بدء الرفع المجزأ/ }).click();
    await expect(page.getByText(/الفيديو مسجل برقم:/)).toBeVisible();

    // Poll UI refresh button until local FFmpeg worker marks asset READY
    await expect(async () => {
      await page.getByRole('button', { name: 'تحديث حالة المعالجة' }).click();
      await expect(page.getByText('جاهز للبث HLS').first()).toBeVisible();
    }).toPass({ timeout: 45_000, intervals: [1500] });

    // STEP B: Instructor creates a new course, attaches video + PDF + quiz, saves draft, submits
    await page.goto('/instructor');
    await page.getByRole('button', { name: /إنشاء كورس جديد|إضافة كورس/ }).first().click();

    const courseSlug = `e2e-hls-course-${Date.now()}`;
    const courseTitle = 'كورس البث الذاتي والشهادات E2E';
    await page.fill('#nc-title', courseTitle);
    await page.fill('#nc-slug', courseSlug);
    await page.fill(
      '#nc-desc',
      'كورس متكامل يختبر البث المتكيف HLS والمرفقات والاختبارات وإصدار الشهادات عبر بوابة بوصلة.',
    );
    await page.getByRole('button', { name: 'إنشاء وفتح محرر الكورس' }).click();
    await expect(page).toHaveURL(/\/instructor\/courses\//);

    // Create interactive quiz in modal
    await page.getByRole('button', { name: 'اختبار جديد' }).click();
    await page.fill('#qz-t', 'اختبار نهاية الكورس E2E');
    await page.fill('#qz-pct', '70');
    await page.fill('#qz-q', 'ما هي صيغة البث المستخدمة في أكاديمية بوصلة؟');
    await page.fill('#qz-a', 'بث HLS متكيف محلي عبر FFmpeg');
    await page.fill('#qz-b', 'رابط عام غير محمي');
    await page.getByRole('button', { name: 'حفظ الاختبار' }).click();
    await expect(page.getByText(/تم إنشاء الاختبار بنجاح/)).toBeVisible();

    // Add 1 section with 2 lessons: VIDEO (our READY HLS video) + QUIZ
    await page.getByRole('button', { name: 'إضافة قسم' }).click();
    await page.getByRole('button', { name: 'إضافة درس' }).first().click();
    await page.getByRole('button', { name: 'إضافة درس' }).first().click();

    // Select uploaded READY video in first video dropdown
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

    // Lesson 2: change type to QUIZ and assign created quiz
    const typeSelects = page.locator('select').filter({ has: page.locator('option[value="QUIZ"]') });
    await typeSelects.nth(1).selectOption('QUIZ');
    const quizOptionValue = await page
      .locator('select option', { hasText: 'اختبار نهاية الكورس E2E' })
      .first()
      .getAttribute('value');
    expect(quizOptionValue).toBeTruthy();
    await page
      .locator('select')
      .filter({ has: page.locator(`option[value="${quizOptionValue}"]`) })
      .first()
      .selectOption(quizOptionValue!);

    // Save draft so lesson IDs exist -> attach PDF to Lesson 1 -> Submit for Admin review
    await page.getByRole('button', { name: /حفظ المسودة/ }).click();
    await expect(page.getByText(/تم حفظ المسودة بنجاح/)).toBeVisible();

    const attachInput = page.locator('input[type="file"]').first();
    await attachInput.setInputFiles(samplePdfPath);
    await expect(page.getByText('e2e-checklist.pdf')).toBeVisible();

    await page.getByRole('button', { name: 'إرسال للمراجعة الإدارية' }).click();
    await expect(page.getByText(/تم إرسال الكورس للإدارة/)).toBeVisible();

    // STEP C: Admin approves & publishes course, then includes it in Monthly Membership Plan
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: /مراجعة الكورسات/ }).click();
    const editorialCard = page
      .locator('div.rounded-2xl', { hasText: courseTitle })
      .filter({ has: page.getByRole('button', { name: 'اعتماد (Approve)' }) })
      .first();
    await expect(editorialCard).toBeVisible();
    await editorialCard.getByRole('button', { name: 'اعتماد (Approve)' }).click();
    await expect(editorialCard.getByRole('button', { name: 'نشر فوري للطلاب' })).toBeVisible();
    await editorialCard.getByRole('button', { name: 'نشر فوري للطلاب' }).click();
    await expect(page.getByText(/تم نشر الكورس للطلاب بنجاح/)).toBeVisible();

    // Include newly published course in Monthly membership plan
    await page.getByRole('button', { name: 'العضويات وPaymob' }).click();
    await page.getByRole('button', { name: 'تعديل السعر والمحتوى المشمول' }).first().click();
    const courseCheckbox = page
      .locator('dialog label', { hasText: courseTitle })
      .locator('input[type="checkbox"]');
    await courseCheckbox.check();
    await page
      .getByRole('button', { name: 'حفظ التغييرات وإصدار نسخة خطة جديدة' })
      .click();
    await expect(page.getByText('تم تحديث سعر ومحتوى العضوية بنسخة جديدة')).toBeVisible();

    // STEP D: New Student enrolls Passkey, subscribes via Paymob Sandbox HMAC, watches HLS, passes quiz, gets verified certificate
    await logoutFromHeader(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });

    const buyerPhone = `01066${String(Date.now()).slice(-6)}`;
    try {
      await page.goto('/register');
      await page.fill('#reg-name', 'م. كريم طارق التميمي');
      await page.fill('#reg-phone', buyerPhone);
      await page.fill('#reg-pass', 'BuyerPass#2026');
      await page.fill('#reg-pass-confirm', 'BuyerPass#2026');
      const checkboxes = page.locator('form input[type="checkbox"]');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await page.getByRole('button', { name: /إنشاء الحساب/ }).click();
      await expect(page).toHaveURL(/\/security\/passkey-setup/);

      await page.getByRole('button', { name: 'تفعيل الحساب وتسجيل Passkey الآن' }).click();
      await expect(page.getByText('تم تفعيل حسابك بنجاح!')).toBeVisible();
      await page.locator('input[type="checkbox"]').last().check();
      await page.getByRole('button', { name: 'الدخول إلى لوحة التعلم' }).click();
      await expect(page).toHaveURL(/\/student/);

      // Confirm gated access BEFORE membership on /learn/[slug]
      await page.goto(`/learn/${courseSlug}`);
      await expect(page.getByText('هذا الدرس متاح للمشتركين فقط')).toBeVisible();

      // Subscribe Monthly via Paymob Sandbox Checkout (real HMAC webhook server-side)
      await page.goto('/pricing');
      await page.getByRole('button', { name: /اشترك/ }).first().click();
      await expect(page).toHaveURL(/\/membership\/sandbox-checkout/);
      await page.getByRole('button', { name: 'محاكاة دفع ناجح (HMAC)' }).click();
      await expect(page).toHaveURL(/\/membership\/checkout-result/);
      await expect(page.getByText('تم تفعيل عضويتك في بوصلة بنجاح!')).toBeVisible();

      // Watch adaptive HLS stream + save lesson progress + complete quiz for automatic certificate
      const masterPlaylistResponse = page.waitForResponse(
        (res) => res.url().includes('/master.m3u8?token=') && res.status() === 200,
      );
      await page.goto(`/learn/${courseSlug}`);
      await expect(page.locator('video')).toBeVisible();
      const playlistRes = await masterPlaylistResponse;
      expect(playlistRes.ok()).toBe(true);

      await expect(page.getByText('بث HLS محمي برمز جلسة')).toBeVisible();
      const progressPromise = page.waitForResponse(
        (res) => res.url().includes('/progress') && res.ok(),
      );
      await page.getByRole('button', { name: 'تحديد هذا الدرس كمكتمل' }).click();
      await progressPromise;

      // Open Quiz lesson (Lesson 2) in sidebar and answer correctly
      await page.getByRole('button', { name: /درس جديد 2/ }).click();
      await expect(page.getByText('اختبار نهاية الكورس E2E')).toBeVisible();
      await page.locator('input[type="radio"][value="a"]').check();
      await page.getByRole('button', { name: 'إرسال إجابات الاختبار' }).click();

      await expect(page.getByText(/نجحت بنسبة 100%/)).toBeVisible();
      await expect(page.getByText(/تم إصدار شهادتك الرسمية برمز:/)).toBeVisible();

      // Open public verifiable certificate page
      await page.getByText('عرض الشهادة').click();
      await expect(page).toHaveURL(/\/certificates\/BOSLA-/);
      await expect(page.getByText('م. كريم طارق التميمي')).toBeVisible();
      await expect(page.getByText(courseTitle)).toBeVisible();
    } finally {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId }).catch(() => {});
    }
  });
});
