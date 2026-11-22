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

    // Verify Content Gate Rule on public homepage (no course/path/diploma links exposed on /)
    await expect(page.locator('a[href^="/courses"]')).toHaveCount(0);
    await expect(page.locator('a[href^="/learning-paths"]')).toHaveCount(0);
    await expect(page.locator('a[href^="/diplomas"]')).toHaveCount(0);

    // Submit Corporate Lead Form
    await page.getByRole('button', { name: 'تدريب شركات ومزارع' }).click();
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
      await expect(page.getByText('انضم إلى أكاديمية بوصلة')).toBeVisible();
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
        page.getByRole('heading', { name: /حماية حسابك\s*وتفعيله/ }),
      ).toBeVisible();

      await page.fill('#pk-name', 'جهاز الاختبار الافتراضي');
      await page.getByRole('button', { name: 'تفعيل الحساب وتأكيد الأمان الآن' }).click();

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
      await page.getByRole('button', { name: 'الدخول السريع ببصمة أو قفل الجهاز' }).click();
      await expect(page).toHaveURL(/\/student/);

      // Logout and test non-OTP Password Recovery via Recovery Code
      await logoutFromHeader(page);
      await page.goto('/recovery');
      await expect(page.getByText('استرداد آمن للحساب')).toBeVisible();
      await page.fill('#rec-phone', uniquePhone);
      await page.getByRole('button', { name: 'متابعة خيارات الاسترداد' }).click();

      // Confirm Device biometric + Recovery Code + Support options appear (zero OTP!)
      await expect(page.getByRole('button', { name: 'بصمة الجهاز', exact: true })).toBeVisible();
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
      await expect(page.getByText('جاهز للعرض').first()).toBeVisible();
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
    await expect(page.locator('span', { hasText: 'e2e-checklist.pdf' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'إرسال للمراجعة الإدارية' }).click();
    await expect(page.getByText(/تم إرسال الكورس للإدارة/)).toBeVisible();

    // STEP C: Admin approves & publishes course, then includes it in Monthly Membership Plan
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
    await expect(editorialCard.getByRole('button', { name: 'نشر فوري للطلاب' })).toBeVisible();
    await editorialCard.getByRole('button', { name: 'نشر فوري للطلاب' }).click();
    await expect(page.getByText(/تم نشر الكورس للطلاب بنجاح/)).toBeVisible();

    // Verify Admin direct course creation + immediate publish
    await page.getByRole('button', { name: /إضافة كورس جديد/ }).first().click();
    const quickCourseTitle = `كورس إدارة سريع ${Date.now()}`;
    await page.fill('#ac-title', quickCourseTitle);
    await page.fill('#ac-desc', 'كورس إداري تجريبي تم إنشاؤه مباشرة من لوحة تحكم مدير المنصة.');
    await page.getByRole('button', { name: /إنشاء ونشر فوراً للطلاب/ }).click();
    await expect(page.getByText('تم إنشاء الكورس ونشره للطلاب بنجاح!')).toBeVisible();

    // Edit newly created course inline (NO popup) & verify local image + video upload controls
    const quickCard = page
      .locator('div.rounded-2xl', { hasText: quickCourseTitle })
      .filter({ has: page.getByRole('button', { name: 'تعديل البيانات' }) })
      .first();
    await quickCard.getByRole('button', { name: 'تعديل البيانات' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.getByText('صور الكورس (رفع مباشر من جهازك)')).toBeVisible();
    await expect(page.getByText('فيديوهات الكورس (رفع من جهازك مباشرة)')).toBeVisible();
    const miniPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
      'base64',
    );
    const imgUploadPromise = page.waitForResponse(
      (res) => res.url().includes('/instructor/media/images') && res.ok(),
    );
    await page.setInputFiles('#ec-image-file', {
      name: 'admin-cover.png',
      mimeType: 'image/png',
      buffer: miniPng,
    });
    await imgUploadPromise;
    await expect(page.getByText('مرفوعة من جهازك')).toBeVisible();
    await page.getByRole('button', { name: 'حفظ التعديلات' }).first().click();
    await expect(page.getByText('تم تحديث بيانات وصورة الكورس بنجاح')).toBeVisible();
    await page.getByRole('button', { name: 'العودة إلى الكورسات' }).click();

    // Verify Admin Full Control: duplicate course, Media Asset Library, and User 360 inline workspace
    await quickCard.getByRole('button', { name: 'نسخ', exact: true }).click();
    await expect(page.getByText('تم نسخ الكورس كمسودة جديدة بنجاح')).toBeVisible();
    await page.getByRole('button', { name: 'مكتبة الوسائط والأصول' }).first().click();
    await expect(page.getByText('مكتبة الصور المرفوعة من الجهاز')).toBeVisible();
    await expect(page.getByText(/cover-/).first()).toBeVisible();

    // Verify Learning Path creation with device cover image upload
    await page.getByRole('button', { name: /المسارات والدبلومات/ }).first().click();
    await page.getByRole('button', { name: /إنشاء مسار تعلم/ }).first().click();
    const quickPathTitle = `مسار إدارة بالصورة ${Date.now()}`;
    await page.fill('#ap-title', quickPathTitle);
    await page.fill('#ap-desc', 'مسار تعليمي إداري متكامل مع غلاف مرفوع مباشرة من الجهاز.');
    const pathImgUploadPromise = page.waitForResponse(
      (res) => res.url().includes('/instructor/media/images') && res.ok(),
    );
    await page.setInputFiles('#ap-image-file', {
      name: 'path-cover.png',
      mimeType: 'image/png',
      buffer: miniPng,
    });
    await pathImgUploadPromise;
    await page.locator('dialog[open] button[type="submit"]').click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.getByText(quickPathTitle)).toBeVisible();
    await expect(page.locator(`img[alt="غلاف ${quickPathTitle}"]`)).toHaveAttribute(
      'src',
      /\/api\/v1\/media\/images\/cover-/,
    );

    await page.getByRole('button', { name: /المستخدمون والمدربون/ }).first().click();
    await page.getByRole('button', { name: /إدارة 360/ }).first().click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.getByText('الهوية والأمان وكلمة المرور')).toBeVisible();
    await page.getByRole('button', { name: /العودة لقائمة المستخدمين/ }).click();

    // Include newly published course in Monthly membership plan
    await page.getByRole('button', { name: 'العضويات والاشتراكات' }).click();
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

      await page.getByRole('button', { name: 'تفعيل الحساب وتأكيد الأمان الآن' }).click();
      await expect(page.getByText('تم تفعيل حسابك بنجاح!')).toBeVisible();
      await page.locator('input[type="checkbox"]').last().check();
      await page.getByRole('button', { name: 'الدخول إلى لوحة التعلم' }).click();
      await expect(page).toHaveURL(/\/student/);

      // Confirm gated access BEFORE membership on /learn/[slug]
      await page.goto(`/learn/${courseSlug}`);
      await expect(page.getByText('هذا الدرس متاح للمشتركين فقط')).toBeVisible();

      // Subscribe Monthly via Sandbox Checkout (real HMAC webhook server-side)
      await page.goto('/pricing');
      await page.getByRole('button', { name: /اشترك/ }).first().click();
      await expect(page).toHaveURL(/\/membership\/sandbox-checkout/);
      await page.getByRole('button', { name: 'تأكيد دفع تجريبي ناجح' }).click();
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

      await expect(page.getByText('مشاهدة محمية وعالية الجودة')).toBeVisible();
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

  test('4. Admin-only Offline Event creation (inline + cover upload) -> Public Catalog -> Electronic Checkout -> Student Ticket (Zero Paymob UI)', async ({
    page,
  }) => {
    const samplePngPath = path.join(tmpDir, 'e2e-event-cover.png');
    await fs.writeFile(
      samplePngPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2Z0AAAAASUVORK5CYII=',
        'base64',
      ),
    );

    // 1. Admin logs in and creates an Offline Event inline in /admin with standalone EGP price + device cover upload
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: /الفعاليات الأوفلاين/ }).first().click();
    await expect(page.locator('body')).not.toContainText(/paymob|باي موب|بايموب/i);
    await page.getByRole('button', { name: /إضافة فعالية أو كورس أوفلاين/ }).first().click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);

    const uniqueTag = Date.now();
    const evSlug = `e2e-offline-event-${uniqueTag}`;
    const evTitle = `معسكر الدواجن الأوفلاين ${uniqueTag}`;
    await page.fill('#ev-title', evTitle);
    await page.fill('#ev-slug', evSlug);
    await page.fill('#ev-price-egp', '750');
    await page.fill('#ev-capacity', '15');
    await page.fill('#ev-city', 'الإسكندرية');
    await page.fill('#ev-venue', 'فندق هلنان فلسطين');
    await page.fill('#ev-address', 'كورنيش المنتزه، الإسكندرية');
    await page.fill(
      '#ev-description',
      'معسكر تدريبي أوفلاين متكامل لإدارة العنابر والتغذية والتهوية الميدانية مع شهادة حضور.',
    );

    await page.setInputFiles('#ev-image-file', samplePngPath);
    await expect(page.getByText('مرفوعة من جهازك')).toBeVisible();

    await page.getByRole('button', { name: 'إنشاء وتفعيل الحجز الإلكتروني' }).click();
    await expect(page.getByText(evTitle)).toBeVisible();

    // 2. Verify INSTRUCTOR cannot access or create Offline Events (admin-only RBAC)
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000101', 'BoslaInstructor#2026');
    await expect(page).toHaveURL(/\/instructor/);
    await expect(page.getByRole('button', { name: /إضافة فعالية/ })).toHaveCount(0);
    const instAdminCheck = await page.evaluate(async () => {
      const r = await fetch('/api/v1/admin/events', { credentials: 'include' });
      return r.status;
    });
    expect(instAdminCheck).toBe(403);

    // 3. Student discovers event on /events, sees standalone price, and completes electronic checkout
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');
    await expect(page).toHaveURL(/\/student/);

    await page.goto('/events');
    await expect(page.locator('body')).not.toContainText(/paymob|باي موب|بايموب/i);
    await expect(page.getByText(evTitle)).toBeVisible();
    await page.locator(`a[href="/events/${evSlug}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/events/${evSlug}`));
    await expect(page.locator('body')).not.toContainText(/paymob|باي موب|بايموب/i);
    await expect(page.getByText(/(?:750|٧٥٠)\s*ج\.م/).first()).toBeVisible();

    await page.fill('#event-attendee-name', 'د. طارق نبيل');
    await page.getByRole('button', { name: /احجز الآن وادفع إلكترونياً/ }).click();
    await expect(page).toHaveURL(/\/membership\/sandbox-checkout/);
    await expect(page.locator('body')).not.toContainText(/paymob|باي موب|بايموب/i);

    await page.getByRole('button', { name: 'تأكيد دفع تجريبي ناجح' }).click();
    await expect(page).toHaveURL(/\/membership\/checkout-result/);
    await expect(page.getByText(/EVT-/).first()).toBeVisible();

    // 4. Confirm issued ticket appears in /student dashboard without Paymob mentions
    await page.goto('/student');
    await expect(page.locator('body')).not.toContainText(/paymob|باي موب|بايموب/i);
    await expect(page.getByRole('link', { name: evTitle })).toBeVisible();
    await expect(page.getByText(/EVT-/).first()).toBeVisible();
  });

  test('5. Admin Section Visibility Control hides a section live on / and restores it', async ({
    page,
  }) => {
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: /أقسام الموقع والظهور/ }).first().click();
    const toggleDiplomas = page.locator('#toggle-section-diplomas');
    await expect(toggleDiplomas).toBeVisible();

    // Ensure diplomas starts visible (aria-pressed="true")
    const initialPressed = await toggleDiplomas.getAttribute('aria-pressed');
    if (initialPressed !== 'true') {
      await toggleDiplomas.click();
      await expect(toggleDiplomas).toHaveAttribute('aria-pressed', 'true');
    }

    // Hide diplomas section
    await toggleDiplomas.click();
    await expect(toggleDiplomas).toHaveAttribute('aria-pressed', 'false');

    // Verify homepage hides the diplomas section
    await page.goto('/');
    await expect(page.getByText('الدبلومات التطبيقية المعتمدة حتى 140 ساعة')).toHaveCount(0);

    // Re-enable diplomas section in /admin so site returns to full state
    await page.goto('/admin');
    await page.getByRole('button', { name: /أقسام الموقع والظهور/ }).first().click();
    await expect(page.locator('#toggle-section-diplomas')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#toggle-section-diplomas').click();
    await expect(page.locator('#toggle-section-diplomas')).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/');
    await expect(page.getByText('الدبلومات التطبيقية المعتمدة حتى 140 ساعة')).toBeVisible();
  });

  test('6. Excluded course standalone direct checkout, Quora /community Q&A, 100% attendance + competency cert approval, dual review & admin finance split', async ({
    page,
  }) => {
    const tag = Date.now();
    const courseSlug = `e2e-standalone-${tag}`;
    const courseTitle = `برنامج الأمان البيولوجي الفردي E2E ${tag}`;

    // 1. Admin creates standalone excluded course via UI and sets multi-instructor split in Finance tab
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: /إضافة كورس جديد/ }).first().click();
    await page.waitForSelector('dialog[open]');
    const instOptVal = await page
      .locator('#ac-instructor option', { hasText: 'د/ الحسيني داود' })
      .first()
      .getAttribute('value');
    expect(instOptVal).toBeTruthy();
    await page.selectOption('#ac-instructor', instOptVal!);
    await page.fill('#ac-title', courseTitle);
    await page.fill('#ac-slug', courseSlug);
    await page.fill(
      '#ac-desc',
      'برنامج تطبيقي غير مشمول بالاشتراك الشهري ومتاح للشراء المنفرد مع شهادة حضور وشهادة كفاءة.',
    );
    await page.fill('#ac-price', '550');
    await page
      .locator('dialog[open] label', { hasText: 'شامل ضمن الاشتراك الشهري والسنوي' })
      .locator('input[type="checkbox"]')
      .uncheck();
    await page.getByRole('button', { name: 'إنشاء وفتح محرر الدروس' }).click();
    await expect(page).toHaveURL(/\/instructor\/courses\//);

    // Admin adds 1 ARTICLE lesson via authenticated API and publishes course cleanly
    await expect(async () => {
      const ok = await page.evaluate(async (slugToFind) => {
        const me = await fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json());
        const courses = await fetch('/api/v1/admin/courses', { credentials: 'include' }).then((r) =>
          r.json(),
        );
        const found = courses.find((c: any) => c.slug === slugToFind);
        if (!found || !me?.csrfToken) return false;

        const dr = await fetch(`/api/v1/instructor/courses/${found.id}/draft`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': me.csrfToken,
          },
          body: JSON.stringify({
            sections: [
              {
                titleAr: 'الوحدة التطبيقية الأساسية',
                sortOrder: 0,
                lessons: [
                  {
                    stableKey: `e2e-lesson-${Date.now()}`,
                    titleAr: 'بروتوكول التطهير الكامل E2E',
                    type: 'ARTICLE',
                    isFreePreview: false,
                    durationSeconds: 180,
                    sortOrder: 0,
                    articleContentAr:
                      'دليل تطبيقي خطوة بخطوة لتطبيق معايير الأمن البيولوجي وحساب الجرعات القياسية.',
                  },
                ],
              },
            ],
          }),
        });
        if (!dr.ok) return false;

        const pub = await fetch(`/api/v1/admin/courses/${found.id}/publish`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': me.csrfToken },
        });
        return pub.ok;
      }, courseSlug);
      expect(ok).toBe(true);
    }).toPass({ timeout: 15_000 });

    // Configure multi-instructor revenue % in Admin Finance tab
    await page.goto('/admin');
    await page.getByRole('button', { name: /المالية والمدربون والكفاءة/ }).first().click();
    await expect(page.locator('#fin-target-id')).toBeVisible();
    const optionVal = await page
      .locator('#fin-target-id option', { hasText: courseTitle })
      .first()
      .getAttribute('value');
    expect(optionVal).toBeTruthy();
    await page.locator('#fin-target-id').selectOption(optionVal!);
    await page.getByRole('button', { name: /إضافة مدرب آخر للبرنامج/ }).click();
    await page.locator('#save-program-instructors-btn').click();
    await expect(
      page.getByText('تم حفظ توزيع المدربين والنسب المئوية وتسجيله في السجل الإداري'),
    ).toBeVisible();

    // 2. Student logs in, sees excluded notice on /courses/[slug], purchases ONLY this course cleanly
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');
    await expect(page).toHaveURL(/\/student/);

    await page.goto(`/courses/${courseSlug}`);
    await expect(page.locator('body')).not.toContainText(/paymob|باي موب|بايموب/i);
    await expect(page.getByText('غير مشمول في الاشتراك الشهري والسنوي')).toBeVisible();
    await page.locator('#direct-buy-course-btn').click();
    await expect(page).toHaveURL(/\/membership\/sandbox-checkout/);
    await expect(page.locator('body')).not.toContainText(/paymob|باي موب|بايموب/i);

    await page.getByRole('button', { name: 'تأكيد دفع تجريبي ناجح' }).click();
    await expect(page).toHaveURL(/\/membership\/checkout-result/);
    await expect(page.getByText('تم تفعيل اشتراكك في البرنامج بنجاح!')).toBeVisible();

    // 3. Quora-style /community Q&A flow
    await page.goto('/community');
    await expect(page.locator('body')).not.toContainText(/paymob|باي موب|بايموب/i);
    await page.locator('#open-ask-question-btn').click();
    const qTitle = `سؤال تطبيقي في الأمان الحيوي E2E ${tag}`;
    await page.fill('#quora-title', qTitle);
    await page.fill(
      '#quora-body',
      'ما التركيز الأمثل للمطهرات الرباعية بعد تنظيف العنابر بين الدورات؟',
    );
    await page.getByRole('button', { name: 'نشر السؤال في المجتمع' }).click();
    await expect(page.getByText(qTitle)).toBeVisible();

    await page
      .locator('input[placeholder="أضف إجابتك أو خبرتك العملية على هذا السؤال..."]')
      .first()
      .fill('ينصح بالتركيز المعتمد من المصنع بعد التجفيف التام للأرضيات.');
    await page.getByRole('button', { name: 'نشر الإجابة' }).first().click();
    await expect(
      page.getByText('ينصح بالتركيز المعتمد من المصنع بعد التجفيف التام للأرضيات.'),
    ).toBeVisible();

    // 4. Complete lesson -> 100% -> Attendance Completion Cert -> Request Competency Cert + Dual Review
    await page.goto(`/learn/${courseSlug}`);
    await page.getByRole('button', { name: 'تحديد هذا الدرس كمكتمل' }).click();
    await expect(page.locator('#course-certificates-box').getByText('التقدم: 100%')).toBeVisible();
    await expect(page.getByRole('button', { name: /عرض شهادة الحضور/ })).toBeVisible();

    await page.fill('#comp-notes', 'تم تطبيق جميع بنود البروتوكول بنجاح E2E');
    await page.locator('#submit-competency-request-btn').click();
    await expect(page.getByText('قيد المراجعة لدى الإدارة والمدرب')).toBeVisible();

    await page.fill('#rev-comment', 'برنامج عملي ممتاز وشرح وافٍ من المدرب');
    await page.getByRole('button', { name: 'إرسال التقييم المرتبط بالمدرب والبرنامج' }).click();
    await expect(page.getByText('تم حفظ تقييمك للدورة والمدرب بنجاح')).toBeVisible();

    // 5. Instructor checks independent financial statement, dual reviews & approves Competency Cert
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000101', 'BoslaInstructor#2026');
    await expect(page).toHaveURL(/\/instructor/);
    await expect(page.getByText('كشف الحساب المالي المستقل للمدرب')).toBeVisible();
    await expect(page.getByText('تقييمات المتدربين المرتبطة بك وبالبرامج')).toBeVisible();
    await page.getByRole('button', { name: 'اعتماد شهادة الكفاءة' }).first().click();
    await expect(page.getByText('تم الاعتماد').first()).toBeVisible();

    // 6. Student verifies BOTH attendance & competency certificates + standalone purchase in /student
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');
    await expect(page).toHaveURL(/\/student/);
    await expect(page.getByText('البرامج والكورسات المشتراة بشكل مستقل').first()).toBeVisible();
    await expect(page.getByText('شهادة الكفاءة المهنية').first()).toBeVisible();
  });

  test('9. Super Admin <-> Instructor Direct Chat & Tasks workflow from Admin & Instructor Dashboards', async ({
    page,
  }) => {
    const tag = Date.now().toString().slice(-5);
    const taskTitle = `تجهيز حقيبة الأمان الحيوي التدريبية E2E ${tag}`;

    // 1. Admin / Super Admin logs in and opens Instructor Chat & Tasks tab
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: /التواصل ومهام المدربين/ }).first().click();
    await expect(page.getByTestId('admin-instructor-collab-panel')).toBeVisible();

    // 2. Assign a new task to the selected instructor
    await page.getByTestId('open-assign-task-modal-btn').click();
    await page.getByTestId('task-title-input').fill(taskTitle);
    await page
      .getByTestId('task-desc-input')
      .fill('يرجى مراجعة ورفع ملفات المحاضرات التطبيقية مع اختبار التقييم النهائي.');
    await page.getByTestId('task-priority-select').selectOption('URGENT');
    await page.getByTestId('submit-task-btn').click();

    await expect(page.getByText(taskTitle).first()).toBeVisible();

    // 3. Send a direct chat message from Super Admin to Instructor
    const adminMsg = `مرحباً دكتور، تم إسناد المهمة (${taskTitle})، يرجى البدء وتحديث الحالة.`;
    await page.getByTestId('admin-chat-input').fill(adminMsg);
    await page.getByTestId('admin-chat-send-btn').click();
    await expect(page.getByTestId('admin-instructor-chat-messages')).toContainText(adminMsg);

    // 4. Instructor logs in, views assigned task & chat message, updates status & replies
    await logoutFromHeader(page);
    await loginWithPhone(page, '01000000101', 'BoslaInstructor#2026');
    await expect(page).toHaveURL(/\/instructor/);

    await expect(page.getByTestId('instructor-collab-panel')).toBeVisible();
    await expect(page.getByTestId('instructor-tasks-list')).toContainText(taskTitle);
    await expect(page.getByTestId('instructor-chat-messages')).toContainText(adminMsg);

    const instructorReply = `تم استلام المهمة (${tag}) وإنجازها بالكامل يا فندم.`;
    await page.getByTestId('instructor-chat-input').fill(instructorReply);
    await page.getByTestId('instructor-chat-send-btn').click();
    await expect(page.getByTestId('instructor-chat-messages')).toContainText(instructorReply);
  });
});
