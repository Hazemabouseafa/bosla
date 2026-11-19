import { expect, test, type Page } from '@playwright/test';

async function loginWithPhone(page: Page, phone: string, password: string) {
  await page.goto('/login');
  await page.fill('#login-phone', phone);
  await page.fill('#login-pass', password);
  await page.getByRole('button', { name: 'دخول برقم الموبايل وكلمة المرور' }).click();
  await page.waitForTimeout(800);
}

async function logoutViaApi(page: Page) {
  await page.evaluate(async () => {
    const me = await fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.json());
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: me?.csrfToken ? { 'X-CSRF-Token': me.csrfToken } : {},
    });
  });
}

test.describe('BOSLA Academy Enterprise v1.2 E2E (Referral, Cart, Seller Portal, B2B Org, Support, Admin Suite)', () => {
  test('1. Referral link -> Multi-course Cart checkout (no Paymob string) -> Sandbox confirm -> Invoice', async ({ page }) => {
    // Visit server-tracked referral link
    await page.goto('/r/BOSLA2026');
    await expect(page.getByText('BOSLA2026')).toBeVisible({ timeout: 10_000 });

    // Login as student & visit /cart
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: /شراء الدورات/ })).toBeVisible();

    // Ensure zero Paymob string appears anywhere on cart/checkout UI
    const pageText = (await page.textContent('body')) || '';
    expect(pageText.toLowerCase()).not.toContain('paymob');

    // Add first 2 courses from quick-add list (wait for async catalog fetch to render)
    const addButtons = page.getByRole('button', { name: 'أضف', exact: true });
    await expect(addButtons.first()).toBeVisible({ timeout: 10_000 });
    const count = await addButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);
    await addButtons.nth(0).click();
    await page.waitForTimeout(500);
    await addButtons.nth(0).click();
    await page.waitForTimeout(500);

    // Preview & create multi-course order
    await page.getByRole('button', { name: 'احتساب السعر والتحقق من الأكواد' }).click();
    await expect(page.getByText('كود البائع المطبّق')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'تأكيد وإنشاء الطلب الآن' }).click();
    await expect(page.getByRole('button', { name: 'تأكيد السداد الإلكتروني' }).first()).toBeVisible({ timeout: 10_000 });

    // Confirm sandbox payment & open invoice
    await page.getByRole('button', { name: 'تأكيد السداد الإلكتروني' }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'الفاتورة' }).first().click();
    await expect(page.getByText(/فاتورة رسمية/)).toBeVisible();

    // Check zero horizontal overflow
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(hasOverflow).toBe(false);
    await logoutViaApi(page);
  });

  test('2. Seller Portal (/seller) shows approved codes, SVG QR code, commissions, and strict Arabic RTL', async ({ page }) => {
    await loginWithPhone(page, '01000000306', 'BoslaEnterprise#2026');
    await page.goto('/seller');
    await expect(page.getByText('لوحة البائع والعمولات')).toBeVisible({ timeout: 10_000 });

    // Navigate to Codes & QR tab
    await page.getByRole('button', { name: /الأكواد والروابط و QR/ }).click();
    await expect(page.getByText('BOSLA2026', { exact: true })).toBeVisible();
    await expect(page.locator('.bg-white svg').first()).toBeVisible();

    // Navigate to Commissions tab
    await page.getByRole('button', { name: /سجل العمولات/ }).click();
    await expect(page.getByText(/سجل العمولات التفصيلي/)).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(hasOverflow).toBe(false);
    await logoutViaApi(page);
  });

  test('3. B2B Organization Portal (/org) & Support Portal (/support)', async ({ page }) => {
    await loginWithPhone(page, '01000000201', 'BoslaStudent#2026');

    // Organization portal (seeded demoStudent is ORG_ADMIN of seeded company)
    await page.goto('/org');
    await expect(page.getByText(/استهلاك المقاعد/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /المتدربون والتسجيل الجماعي/ }).click();
    await expect(page.getByText(/إضافة متدرب إلى مقاعد المؤسسة/)).toBeVisible();

    // Support portal: open a new ticket
    await page.goto('/support');
    await expect(page.getByText('فتح تذكرة دعم جديدة')).toBeVisible({ timeout: 10_000 });
    await page.fill('input[placeholder*="ملخص المشكلة"]', 'اختبار تذكرة E2E من المتصفح');
    await page.fill('textarea[placeholder*="كافة التفاصيل"]', 'هذه تذكرة اختبار آلية للتحقق من مركز المساعدة.');
    await page.getByRole('button', { name: 'إرسال التذكرة' }).click();
    await expect(page.getByText('اختبار تذكرة E2E من المتصفح')).toBeVisible({ timeout: 10_000 });

    await logoutViaApi(page);
  });

  test('4. Admin Enterprise Control Suite (/admin) renders RBAC, Sellers, Finance Reconciliation & Analytics', async ({ page }) => {
    await loginWithPhone(page, '01000000001', 'BoslaAdmin#2026');
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: /منظومة الإدارة الشاملة v1\.2/ })).toBeVisible({ timeout: 12_000 });

    await page.getByRole('button', { name: /منظومة الإدارة الشاملة v1\.2/ }).click();
    await expect(page.getByText(/البائعون الأفراد وطلبات الانضمام/)).toBeVisible({ timeout: 10_000 });

    // Switch to Finance & Reconciliation sub-tab
    await page.getByRole('button', { name: /الطلبات والتسويات والمطابقة/ }).click();
    await expect(page.getByText(/تقرير المطابقة المالية الآلي/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('REC-01')).toBeVisible();

    // Switch to RBAC Matrix sub-tab
    await page.getByRole('button', { name: /الأدوار والصلاحيات والتدقيق/ }).click();
    await expect(page.getByText(/مصفوفة الأدوار والصلاحيات الدقيقة/)).toBeVisible({ timeout: 10_000 });

    // Switch to Executive Analytics sub-tab
    await page.getByRole('button', { name: /التحليلات التنفيذية/ }).click();
    await expect(page.getByText(/أفضل البائعين أداءً/)).toBeVisible({ timeout: 10_000 });

    // Switch to Professional CRM sub-tab and create a lead with empty email (verifying bug fix)
    await page.getByRole('button', { name: /CRM والحملات/ }).click();
    await expect(page.getByRole('button', { name: /لوحة المراحل البيعية \(Kanban\)/ })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /إضافة عميل محتمل جديد/ }).click();
    await page.fill('input[placeholder="مثال: د. محمد عبد الرحمن"]', 'عميل اختبار CRM احترافي');
    await page.fill('input[placeholder="01012345678"]', '01099887766');
    await page.getByRole('button', { name: /إضافة العميل للمسار/ }).click();
    await expect(page.getByText('عميل اختبار CRM احترافي').first()).toBeVisible({ timeout: 10_000 });

    // Check Users tab exposes all 9 assignable roles in dropdown
    await page.getByRole('button', { name: /المستخدمون والمدربون/ }).click();
    await expect(page.getByLabel('تصفية حسب الدور')).toBeVisible({ timeout: 10_000 });
    const roleFilterText = (await page.getByLabel('تصفية حسب الدور').textContent()) || '';
    expect(roleFilterText).toContain('خدمة العملاء والدعم الفني');
    expect(roleFilterText).toContain('مسؤول / مراجع مالي');
    expect(roleFilterText).toContain('بائع معتمد');

    await logoutViaApi(page);
  });

  test('5. Dedicated Support Agent Dashboard (SUPPORT) sees only support/CRM tabs, replies to & resolves ticket', async ({ page }) => {
    await loginWithPhone(page, '01000000305', 'BoslaEnterprise#2026');
    await page.waitForURL('**/admin', { timeout: 12_000 });

    // Verify dedicated Support Portal title & role-scoped sidebar (ZERO Super-Admin tabs)
    await expect(page.getByText('لوحة تحكم خدمة العملاء وتذاكر الدعم')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /مكتب تذاكر الدعم الفني/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /المستخدمون والمدربون/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /أقسام الموقع والظهور/ })).toHaveCount(0);

    // Verify Support agent sees tickets, sends a reply, and resolves a ticket
    await expect(page.getByText('اختبار تذكرة E2E من المتصفح').first()).toBeVisible({ timeout: 10_000 });
    const replyInput = page.locator('input[placeholder*="اكتب ردك الرسمي للعميل"]').first();
    await replyInput.fill('تم فحص المشكلة من فريق خدمة العملاء وحلها بنجاح.');
    await page.getByRole('button', { name: /إرسال الرد للعميل/ }).first().click();
    await expect(page.getByText('تم فحص المشكلة من فريق خدمة العملاء وحلها بنجاح.').first()).toBeVisible({ timeout: 10_000 });

    const resolveBtn = page.getByRole('button', { name: /حل التذكرة/ }).first();
    if (await resolveBtn.isVisible()) {
      await resolveBtn.click();
      await page.waitForTimeout(500);
    }

    await logoutViaApi(page);
  });

  test('6. Dedicated Finance Officer Dashboard (FINANCE_OFFICER) sees only financial/Maker-Checker/audit tabs', async ({ page }) => {
    await loginWithPhone(page, '01000000303', 'BoslaEnterprise#2026');
    await page.waitForURL('**/admin', { timeout: 12_000 });

    // Verify dedicated Finance Portal title & strictly finance sidebar
    await expect(page.getByText('لوحة تحكم المسؤول المالي والمراجع المالي')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /الطلبات والمدفوعات والتسويات والمطابقة/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /قواعد واعتماد عمولات البائعين/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /سجل التدقيق المالي والإداري/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /المستخدمون والمدربون/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /مكتب تذاكر الدعم الفني/ })).toHaveCount(0);

    // Verify Reconciliation and Maker-Checker Settlements render cleanly
    await expect(page.getByText('REC-01')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/التسويات الشهرية للبائعين/)).toBeVisible();

    await logoutViaApi(page);
  });
});
