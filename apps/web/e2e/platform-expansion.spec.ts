import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT_DIR = path.resolve(
  'C:/Users/w.i/.gemini/antigravity/brain/bdfd6423-e74c-403e-80c6-c124d2759916/expansion-screenshots',
);

async function loginWithPhone(page: Page, phone: string, password: string) {
  await page.goto('/login');
  await page.fill('#login-phone', phone);
  await page.fill('#login-pass', password);
  await page.getByRole('button', { name: 'دخول برقم الموبايل وكلمة المرور' }).click();
}

async function logoutSession(page: Page) {
  await page.evaluate(async () => {
    const me = await fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json());
    const csrf = me?.data?.csrfToken ?? me?.csrfToken;
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    });
  });
  await page.goto('/');
}

test.describe('BOSLA Platform Expansion — Storefront, Split Admin, Themes, Recommendations, Wishlist & Settings E2E', () => {
  test.beforeAll(async () => {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  });

  test('Full Platform Expansion Journey across Storefront, Guest Cart/Wishlist, Student, Admin, Instructor & Public Verification', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // =========================================================================
    // 1. PUBLIC STOREFRONT: HERO, STORYTELLING, TRAINERS MARQUEE, ZERO CONTACT FORM, CAREERS
    // =========================================================================
    await page.goto('/');

    // Redesigned storefront: removed storytelling band, immediate courses showcase + Partners CTA
    await expect(page.locator('#storytelling')).toHaveCount(0);
    await expect(page.locator('#courses-showcase')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'انضم كشريك نجاح', exact: true }),
    ).toBeVisible();

    // Testimonials section renders seeded published CMS testimonials cleanly (and hides automatically if none published)
    const testimonialsSection = page.locator('#testimonials');
    await expect(testimonialsSection).toBeVisible();
    expect(await testimonialsSection.locator('article').count()).toBeGreaterThanOrEqual(1);

    // General Contact inquiry form strictly removed from homepage
    await expect(page.locator('#home-contact-name')).toHaveCount(0);
    await expect(page.locator('#contact form')).toHaveCount(0);

    // Trainers marquee interactive pause toggle + modal with published courses
    const trainersSection = page.locator('#trainers');
    await trainersSection.scrollIntoViewIfNeeded();
    await expect(trainersSection).toBeVisible();

    const pauseBtn = trainersSection.getByRole('button', {
      name: /إيقاف العرض التلقائي|تشغيل العرض التلقائي/,
    });
    if (await pauseBtn.isVisible().catch(() => false)) {
      const beforePressed = await pauseBtn.getAttribute('aria-pressed');
      await pauseBtn.click();
      await expect(pauseBtn).toHaveAttribute(
        'aria-pressed',
        beforePressed === 'true' ? 'false' : 'true',
      );
      if ((await pauseBtn.getAttribute('aria-pressed')) !== 'true') {
        await pauseBtn.click();
      }
    }

    // Zero horizontal overflow on desktop
    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
    );
    expect(desktopOverflow).toBe(true);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-homepage-desktop-storytelling.png`,
      fullPage: false,
    });

    // Click any visible trainer card while marquee is paused -> interactive modal displays courses
    const tButtons = trainersSection.locator('.bosla-marquee-track button[type="button"]');
    const tCount = await tButtons.count();
    let openedTrainer = false;
    for (let i = 0; i < tCount; i++) {
      const card = tButtons.nth(i);
      const box = await card.boundingBox();
      if (box && box.x >= 20 && box.x + box.width <= 1260) {
        await card.click();
        openedTrainer = true;
        break;
      }
    }
    expect(openedTrainer).toBe(true);
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-homepage-trainers-modal.png`,
    });
    await modal.getByRole('button', { name: /إغلاق/ }).first().click();
    await expect(modal).toBeHidden();

    // Mobile RTL check (390px) -> zero horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
    );
    expect(mobileOverflow).toBe(true);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-homepage-mobile-rtl.png`,
    });
    await page.setViewportSize({ width: 1280, height: 840 });

    // /contact has NO inquiry form (direct channels hub only)
    await page.goto('/contact');
    await expect(page.locator('form')).toHaveCount(0);

    // /careers shows honest empty state initially
    await page.goto('/careers');
    await expect(page.getByText('لا توجد شواغر وظيفية معلنة في الوقت الحالي')).toBeVisible();

    // =========================================================================
    // 2. GUEST CART & WISHLIST -> LOGIN MERGE -> STUDENT OVERVIEW, THEME SWITCHER & RECOMMENDATION REQUEST
    // =========================================================================
    const targetCourse = await page.evaluate(async () => {
      const res = await fetch('/api/v1/catalog/home').then((r) => r.json());
      const body = res?.data ?? res;
      const list = Array.isArray(body?.courses) ? body.courses : [];
      return (
        list.find((c: any) => !c.isFree && c.allowIndividualPurchase !== false && c.priceCents > 0) ||
        list[0]
      );
    });
    expect(targetCourse?.slug).toBeTruthy();

    await page.goto(`/courses/${targetCourse.slug}`);
    const wishlistBtn = page.getByRole('button', { name: /حفظ للمفضلة|محفوظ في الرغبات/ }).first();
    await wishlistBtn.click();
    const addToCartBtn = page.getByRole('button', { name: /أضف للسلة/ }).first();
    if (await addToCartBtn.isVisible().catch(() => false)) {
      await addToCartBtn.click();
    }

    // Verify guest localStorage captured the selection before login
    const guestWishlistBeforeLogin = await page.evaluate(() =>
      localStorage.getItem('bosla_guest_wishlist_v1'),
    );
    expect(guestWishlistBeforeLogin || '').toContain(targetCourse.id);

    // Before Admin enables Google OAuth, capabilities show googleEnabled=false
    await page.goto('/login');
    const providersBefore = await page.evaluate(async () =>
      fetch('/api/v1/auth/providers').then((r) => r.json()),
    );
    expect(Boolean((providersBefore?.data ?? providersBefore)?.googleEnabled)).toBe(false);

    // Login as Student -> redirects to /student & merges guest cart/wishlist automatically
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');
    await expect(page).toHaveURL(/\/student/);

    await page.waitForTimeout(800);
    const wishlistAfterLogin = await page.evaluate(async () => {
      const r = await fetch('/api/v1/commerce/wishlist', { credentials: 'include' }).then((x) =>
        x.json(),
      );
      return r?.data ?? r;
    });
    expect(
      Array.isArray(wishlistAfterLogin) &&
        wishlistAfterLogin.some((w: any) => w.courseId === targetCourse.id || w.targetId === targetCourse.id),
    ).toBe(true);

    // Test Dashboard Theme Toggle (Dark -> Light -> persisted reload -> Dark)
    const themeToggle = page.getByRole('button', {
      name: /التبديل إلى الوضع النهاري|التبديل إلى الوضع الليلي/,
    });
    await expect(themeToggle).toBeVisible();
    await themeToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-bosla-dash-theme', 'light');
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-student-overview-light-theme.png`,
    });

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-bosla-dash-theme', 'light');

    const backToDarkBtn = page.getByRole('button', {
      name: /التبديل إلى الوضع الليلي|التبديل إلى الوضع النهاري/,
    });
    await backToDarkBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-bosla-dash-theme', 'dark');
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-student-overview-dark-theme.png`,
    });

    // Expand Credentials Accordion group + open Student Credentials tab and request Recommendation Letter
    const certGroupBtn = page.getByRole('button', { name: /الشهادات والتوصيات/ });
    if ((await certGroupBtn.getAttribute('aria-expanded')) !== 'true') {
      await certGroupBtn.click();
    }
    await page.getByRole('tab', { name: /الفعاليات والشهادات/ }).click();
    await expect(
      page.getByRole('heading', { name: /خطابات التوصية المعتمدة من المدربين/ }),
    ).toBeVisible();
    await page
      .getByPlaceholder('مثال: أرغب بالتقديم لوظيفة إشراف مزارع دواجن...')
      .fill('أرغب في التوصية المهنية للتقديم كمشرف إنتاج حيوي بالمزارع الكبرى.');
    await page.getByRole('button', { name: /طلب خطاب توصية/ }).click();
    await expect(page.getByText('بانتظار كتابة واعتماد المدرب').first()).toBeVisible({
      timeout: 10_000,
    });

    // Capture which course & instructor received the recommendation request so we log in cleanly as the owner
    const recInfo = await page.evaluate(async () => {
      const r = await fetch('/api/v1/learning/recommendations/my', { credentials: 'include' }).then((x) =>
        x.json(),
      );
      const list = Array.isArray(r?.data ?? r) ? r?.data ?? r : [];
      return list[0] ?? null;
    });
    expect(recInfo?.id).toBeTruthy();

    // =========================================================================
    // 3. ADMIN SPLIT ROUTES, SIDEBAR PERSISTENCE, LEGACY REDIRECT, GOOGLE SETTINGS, TEMPLATES & CAREERS
    // =========================================================================
    await logoutSession(page);
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await expect(page).toHaveURL(/\/admin/);

    // Legacy ?tab=live_editor MUST redirect automatically to dedicated /admin/live-editor route
    await page.goto('/admin?tab=live_editor');
    await expect(page).toHaveURL(/\/admin\/live-editor/);
    await expect(page.getByTestId('admin-live-site-editor')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-admin-sidebar-live-editor.png`,
    });

    // Accordion group persistence across sub-route navigation & reload
    const groupButtons = page.locator('aside nav button[aria-expanded]');
    const groupCount = await groupButtons.count();
    expect(groupCount).toBeGreaterThanOrEqual(4);
    const nonActiveGroup = groupButtons.nth(2);
    const initialExpanded = await nonActiveGroup.getAttribute('aria-expanded');
    await nonActiveGroup.click();
    const expectedAfterToggle = initialExpanded === 'true' ? 'false' : 'true';
    await expect(nonActiveGroup).toHaveAttribute('aria-expanded', expectedAfterToggle);

    await page.goto('/admin/analytics');
    await expect(page).toHaveURL(/\/admin\/analytics/);
    await expect(page.locator('aside nav button[aria-expanded]').nth(2)).toHaveAttribute(
      'aria-expanded',
      expectedAfterToggle,
    );

    // /admin/settings -> configure runtime Google OAuth
    await page.goto('/admin/settings');
    await page
      .getByLabel('تفعيل زر تسجيل الدخول بحساب Google في صفحة الدخول والتسجيل')
      .check();
    await page
      .getByPlaceholder('xxxxx.apps.googleusercontent.com')
      .fill('e2e-runtime-client-12345.apps.googleusercontent.com');
    await page.getByPlaceholder('GOCSPX-...').fill('GOCSPX-e2e-encrypted-secret-999');
    await page.getByRole('button', { name: /حفظ إعدادات Google OAuth/ }).click();
    await expect(
      page.getByText('تم حفظ إعدادات تسجيل الدخول بحساب Google مع التشفير بنجاح'),
    ).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07-admin-google-smtp-settings.png`,
    });

    // /admin/support -> Manual Membership Grant panel renders
    await page.goto('/admin/support');
    await expect(page.getByText(/منح عضوية يدوي مؤقت من فريق الدعم/)).toBeVisible({ timeout: 10_000 });

    // /admin/certificates -> Certificate template coordinate & preview UI renders
    await page.goto('/admin/certificates');
    await expect(page.getByTestId('admin-coupons-templates-panel')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/08-admin-certificates-template.png`,
    });

    // /admin/cms -> publish a Career opportunity -> check /careers publicly
    await page.goto('/admin/cms');
    await page
      .getByPlaceholder('أخصائي إنتاج داجني / مصمم تعليمي')
      .fill('استشاري أمان حيوي ومزارع دواجن');
    await page
      .getByPlaceholder('ملخص واضح للمهام والخبرة المطلوبة...')
      .fill('إدارة برامج الأمان الحيوي وتدريب المهندسين والأطباء البيطريين ميدانياً.');
    await page.getByPlaceholder('careers@boslaagri.com').fill('hr@boslaagri.com');
    await page.getByRole('button', { name: /نشر الفرصة/ }).click();
    await expect(page.getByText('استشاري أمان حيوي ومزارع دواجن').first()).toBeVisible({
      timeout: 10_000,
    });

    // Lookup the assigned instructor's phone from admin users list
    const targetInstructorId = recInfo.instructorId || recInfo.instructor?.id;
    expect(targetInstructorId).toBeTruthy();
    const instrPhoneSuffix = await page.evaluate(async (instId) => {
      const res = await fetch('/api/v1/admin/users?role=INSTRUCTOR', { credentials: 'include' }).then((r) =>
        r.json(),
      );
      const users = Array.isArray(res) ? res : res?.data?.users ?? res?.users ?? res?.data ?? [];
      const found = Array.isArray(users) ? users.find((u: any) => u.id === instId) : null;
      return found?.phoneE164 ? found.phoneE164.replace(/^\+2/, '') : '';
    }, targetInstructorId);
    expect(instrPhoneSuffix).toMatch(/^01\d{9}$/);

    // =========================================================================
    // 4. INSTRUCTOR RBAC GUARD + RECOMMENDATION APPROVAL + ZERO-PII VERIFICATION
    // =========================================================================
    await logoutSession(page);

    // Verify /careers renders newly published job
    await page.goto('/careers');
    await expect(page.getByText('استشاري أمان حيوي ومزارع دواجن')).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-public-careers-published.png`,
    });

    // Verify /login now exposes Google Sign-In capability after Admin runtime activation
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(450);
    const providersAfter = await page.evaluate(async () =>
      fetch('/api/v1/auth/providers').then((r) => r.json()),
    );
    const caps = providersAfter?.data ?? providersAfter;
    expect(caps?.googleEnabled).toBe(true);
    expect(caps?.googleClientId).toBe('e2e-runtime-client-12345.apps.googleusercontent.com');
    await page.locator('#login-phone').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10-login-google-enabled.png`,
    });

    // Login as the assigned Instructor
    await loginWithPhone(page, instrPhoneSuffix, 'BoslaInstructor#2026');
    await expect(page).toHaveURL(/\/instructor/);

    // RBAC route guard: Instructor MUST NOT access Admin settings controls
    await page.goto('/admin/settings');
    await expect(page.getByPlaceholder('GOCSPX-...')).toHaveCount(0);

    // Open Instructor Recommendations section directly, author letter body & approve
    await page.goto('/instructor?section=recommendations');
    const approveBtn = page.getByRole('button', { name: 'اعتماد وإصدار الخطاب' }).first();
    await expect(approveBtn).toBeVisible({ timeout: 10_000 });

    const letterTitleInput = page
      .getByPlaceholder('مثال: خطاب توصية مهنية في إدارة وتطوير عنابر التسمين')
      .first();
    await letterTitleInput.fill('خطاب توصية مهنية معتمد — اختبار E2E');

    const secretPrivateLetterBody =
      'أشهد بأن المتدرب أظهر كفاءة ميدانية عالية والتزاماً عملياً بتطبيق معايير الأمان الحيوي طوال فترة البرنامج.';
    await page.locator('textarea').first().fill(secretPrivateLetterBody);
    await approveBtn.click();

    await expect(page.getByText('معتمد وصادر للمتدرب').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/11-instructor-recommendation-approved.png`,
    });

    const verificationCode = await page
      .locator('code', { hasText: /^BOSLA-REC-/ })
      .first()
      .innerText();
    expect(verificationCode).toMatch(/^BOSLA-REC-/);

    // =========================================================================
    // 5. UNIFIED PUBLIC CREDENTIALS VERIFICATION (ZERO PII / ZERO LETTER BODY)
    // =========================================================================
    await logoutSession(page);
    await page.goto(`/certificates/verify?code=${encodeURIComponent(verificationCode.trim())}`);
    await expect(page.getByText(/خطاب توصية موثّق وساري/).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(verificationCode.trim()).first()).toBeVisible();

    const verifyPageText = await page.locator('main').innerText();
    expect(verifyPageText).not.toContain('01000000201');
    expect(verifyPageText).not.toContain('@boslaagri.com');
    expect(verifyPageText).not.toContain(secretPrivateLetterBody);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/12-public-credentials-verify.png`,
    });
  });
});
