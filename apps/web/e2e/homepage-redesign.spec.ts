import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const SCREENSHOT_DIR =
  'C:/Users/w.i/.gemini/antigravity/brain/bdfd6423-e74c-403e-80c6-c124d2759916/homepage-redesign';

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  pad = 4,
): boolean {
  return !(
    a.x + a.width + pad <= b.x ||
    b.x + b.width + pad <= a.x ||
    a.y + a.height + pad <= b.y ||
    b.y + b.height + pad <= a.y
  );
}

test.describe('BOSLA Homepage Fan -> Scatter -> Slow Marquee Showcase Verification', () => {
  test('Verify Dominant Navy (#070D2B/#0B1440) palette, removed hero top labels, Fan -> Scatter transition straight into slow uncategorized courses marquee, responsive RTL, and Live Editor', async ({
    browser,
  }) => {
    test.setTimeout(210_000);
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    const videoTempDir = path.join(SCREENSHOT_DIR, '_video_tmp');
    await fs.rm(videoTempDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(videoTempDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'ar-EG',
      recordVideo: {
        dir: videoTempDir,
        size: { width: 1280, height: 800 },
      },
    });
    const page = await context.newPage();

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await page.waitForTimeout(950); // Allow initial bottom-up fan card rise to settle

    // 1. RTL + Language + Legacy Removed Sections Verification
    expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
    expect(await page.locator('html').getAttribute('lang')).toBe('ar');

    for (const removedId of ['#storytelling', '#methodology', '#thesis-band', '#elevation']) {
      await expect(page.locator(removedId)).toHaveCount(0);
    }

    const bodyText = await page.locator('body').innerText();
    for (const phrase of [
      'المعيار الميداني',
      'العشوائية مكلفة... والتشخيص يبدأ من العينة',
      'رحلة التأهيل التطبيقي في بوصلة',
      'أربعة أركان تشغيلية بلغة قرار واحدة',
      'الفارق الحقيقي يبدأ عند قرار اللحظة الميدانية',
      'من الطالب إلى المدير',
      'تجاوز الحفظ المنفصل قبل التخرج',
      'تحويل الملاحظة إلى بروتوكول',
      'أكاديمية بوصلة للتأهيل الميداني',
      'المروحة',
      'الانتشار',
    ]) {
      expect(bodyText).not.toContain(phrase);
    }
    await expect(page.getByTestId('hero-story-phase')).toHaveCount(0);
    await expect(page.getByTestId('hero-live-badge')).toHaveCount(0);

    // 2. Dominant Deep-Navy Color Tokens Verification
    const colorCheck = await page.evaluate(() => {
      const scopeBg = getComputedStyle(document.querySelector('.bosla-home-scope')!).backgroundColor;
      const heroBg = getComputedStyle(document.querySelector('#hero-stage')!).backgroundColor;
      const showcaseBg = getComputedStyle(document.querySelector('#courses-showcase')!).backgroundColor;
      const pricingBg = getComputedStyle(document.querySelector('#pricing')!).backgroundColor;
      const h1Color = getComputedStyle(document.querySelector('#hero-stage h1')!).color;
      return { scopeBg, heroBg, showcaseBg, pricingBg, h1Color };
    });
    expect(colorCheck.scopeBg).toBe('rgb(7, 13, 43)'); // #070D2B
    expect(colorCheck.heroBg).toBe('rgb(7, 13, 43)'); // #070D2B
    expect(colorCheck.showcaseBg).toBe('rgb(11, 20, 64)'); // #0B1440
    expect(colorCheck.pricingBg).toBe('rgb(7, 13, 43)'); // #070D2B
    expect(colorCheck.h1Color).toBe('rgb(238, 240, 255)'); // #EEF0FF

    // 3. Header fit + Zero Overflow + Phase 1 Hero Fan
    const startCheck = await page.evaluate(() => {
      const noOverflow =
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2;
      const els = Array.from(document.querySelectorAll('header a, header button')).filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
      });
      const headerInViewport = els.every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= -1 && r.right <= window.innerWidth + 1;
      });
      const ctaRect = document.querySelector('#hero-primary-cta')!.getBoundingClientRect();
      const visibleFanRects = Array.from(document.querySelectorAll('[data-testid^="hero-story-card-"]'))
        .filter((el) => parseFloat(getComputedStyle(el).opacity) > 0.5)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      return {
        noOverflow,
        headerInViewport,
        ctaRect: { x: ctaRect.x, y: ctaRect.y, width: ctaRect.width, height: ctaRect.height },
        visibleFanRects,
      };
    });
    expect(startCheck.noOverflow).toBe(true);
    expect(startCheck.headerInViewport).toBe(true);
    expect(startCheck.visibleFanRects.length).toBeGreaterThanOrEqual(4);
    for (const r of startCheck.visibleFanRects) {
      expect(boxesOverlap(startCheck.ctaRect, r, 6)).toBe(false);
    }

    await expect(page.locator('#hero-stage h1')).toBeVisible();
    await expect(page.locator('#hero-primary-cta')).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-hero-fan-start-1280.png'),
      fullPage: false,
    });

    // 4. Phase 2: Scatter Around Center Text (~78% of 115% pin = 718px) -> No Pile/Arc/Settle
    const totalPinTravel = 800 * 1.15; // 920px on 1280x800
    await page.mouse.wheel(0, Math.round(totalPinTravel * 0.78));
    await page.waitForTimeout(750);
    await expect(page.locator('#hero-stage').getByText('اختار خطوتك الجاية')).toBeVisible();
    await expect(page.locator('#hero-stage h1')).not.toBeVisible();

    const scatterAudit = await page.evaluate(() => {
      const headerRect = document.querySelector('header')!.getBoundingClientRect();
      const midTextRect = Array.from(document.querySelectorAll('#hero-stage p')).find((el) =>
        el.textContent?.includes('اختار خطوتك الجاية'),
      )!.getBoundingClientRect();
      const visibleCards = Array.from(document.querySelectorAll('[data-testid^="hero-story-card-"]'))
        .filter((el) => parseFloat(getComputedStyle(el).opacity) > 0.5)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      return {
        headerRect: { x: headerRect.x, y: headerRect.y, width: headerRect.width, height: headerRect.height },
        midTextRect: { x: midTextRect.x, y: midTextRect.y, width: midTextRect.width, height: midTextRect.height },
        midTextVisible: midTextRect.width > 10 && midTextRect.height > 10,
        visibleCards,
      };
    });
    expect(scatterAudit.midTextVisible).toBe(true);
    for (const cardRect of scatterAudit.visibleCards) {
      expect(boxesOverlap(scatterAudit.headerRect, cardRect, 2)).toBe(false);
      expect(boxesOverlap(scatterAudit.midTextRect, cardRect, 2)).toBe(false);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-hero-scatter-1280.png'),
      fullPage: false,
    });

    // 5. Scroll right past Scatter -> Immediately lands on Programs & Courses Slow Marquee Showcase (No Pile/Arc!)
    await page.mouse.wheel(0, Math.round(totalPinTravel * 0.45));
    await page.waitForTimeout(500);
    await page.locator('#courses-showcase').evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(300);

    await expect(page.getByTestId('courses-slow-marquee')).toBeVisible();
    // Assert NO category/classification tabs or search filter pills inside #courses-showcase
    await expect(page.locator('#courses-showcase [role="tablist"]')).toHaveCount(0);
    await expect(page.locator('#home-course-search')).toHaveCount(0);

    // Assert slow linear CSS marquee running cleanly (~34px/s >= 36s duration)
    const marqueeStats = await page.evaluate(() => {
      const track = document.querySelector('#courses-showcase .bosla-courses-marquee-track') as HTMLElement | null;
      if (!track) return null;
      const cs = getComputedStyle(track);
      const dur = parseFloat(cs.animationDuration || '0');
      return {
        animationName: cs.animationName,
        timing: cs.animationTimingFunction,
        durationSeconds: dur,
      };
    });
    expect(marqueeStats).not.toBeNull();
    expect(marqueeStats!.animationName).toContain('bosla-marquee-rtl');
    expect(marqueeStats!.durationSeconds).toBeGreaterThanOrEqual(36);

    await expect(page.locator('#courses-showcase a[href^="/courses/"]').first()).toBeVisible();
    await expect(page.locator('#courses-showcase a[href^="/learning-paths/"]').first()).toBeVisible();
    await expect(page.locator('#courses-showcase a[href^="/diplomas/"]').first()).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-courses-marquee-1280.png'),
      fullPage: false,
    });

    // Toggle Marquee Pause -> Paused cleanly, then Resume
    const coursesToggle = page.getByTestId('courses-marquee-toggle');
    await coursesToggle.click();
    await expect(coursesToggle).toHaveAttribute('aria-pressed', 'true');
    await coursesToggle.click();
    await expect(coursesToggle).toHaveAttribute('aria-pressed', 'false');

    // 6. Reverse Scroll Back to Top -> verify smooth bidirectional reversal back to Fan
    await page.mouse.wheel(0, -Math.round(totalPinTravel * 2.6));
    await page.waitForTimeout(900);
    await expect(page.locator('#hero-stage h1')).toBeVisible();
    await expect(page.locator('#hero-primary-cta')).toBeVisible();

    // 7. Click "استكشف المحتوى" CTA -> Instant bypass straight onto #courses-showcase
    await page.locator('#hero-primary-cta').click();
    await page.waitForTimeout(350);
    const showcaseBox = await page.locator('#courses-showcase').boundingBox();
    expect(showcaseBox).not.toBeNull();
    expect(showcaseBox!.y).toBeGreaterThanOrEqual(40);
    expect(showcaseBox!.y).toBeLessThanOrEqual(140);

    // 8. Downstream Sections (Pricing, Trainers Modal, Partners, Contact & Footer)
    await page.locator('#pricing').evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-pricing-band-1280.png'),
      fullPage: false,
    });

    const trainersSection = page.locator('#trainers');
    await trainersSection.evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(350);
    const pauseBtn = trainersSection.getByRole('button', {
      name: /إيقاف العرض التلقائي|تشغيل العرض التلقائي/,
    });
    if (await pauseBtn.isVisible().catch(() => false)) {
      if ((await pauseBtn.getAttribute('aria-pressed')) !== 'true') {
        await pauseBtn.click();
      }
    }
    const trainerCards = trainersSection.locator('.bosla-marquee-track button[type="button"]');
    const trainerCount = await trainerCards.count();
    let clickedTrainer = false;
    for (let i = 0; i < trainerCount; i++) {
      const card = trainerCards.nth(i);
      const box = await card.boundingBox();
      if (box && box.x >= 24 && box.x + box.width <= 1256) {
        await card.click();
        clickedTrainer = true;
        break;
      }
    }
    expect(clickedTrainer).toBe(true);
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04b-trainer-modal-open.png'),
      fullPage: false,
    });
    await modal.getByRole('button', { name: /إغلاق/ }).first().click();
    await expect(modal).toBeHidden();

    await page.locator('#partners').scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.locator('#contact').evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(350);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04c-contact-footer-1280.png'),
      fullPage: false,
    });

    const desktopVideoPath = await page.video()?.path();
    await page.close();
    await context.close();

    if (desktopVideoPath) {
      await fs.copyFile(desktopVideoPath, path.join(SCREENSHOT_DIR, 'scroll-walkthrough.webm'));
    }
    await fs.rm(videoTempDir, { recursive: true, force: true }).catch(() => {});

    // 9. Responsive Checks (768x1024, 390x844, 375x812) + Reduced Motion + Live Editor
    const ctx2 = await browser.newContext({ locale: 'ar-EG' });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (err) => pageErrors.push(err.message));

    await p2.setViewportSize({ width: 768, height: 1024 });
    await p2.goto('/');
    await p2.waitForTimeout(850);
    expect(
      await p2.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
      ),
    ).toBe(true);
    await p2.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-tablet-768.png'),
      fullPage: false,
    });

    await p2.setViewportSize({ width: 390, height: 844 });
    await p2.goto('/');
    await p2.waitForTimeout(850);
    const mobileAudit = await p2.evaluate(() => {
      const noOverflow =
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2;
      const ctaRect = document.querySelector('#hero-primary-cta')!.getBoundingClientRect();
      const fanRects = Array.from(document.querySelectorAll('[data-testid^="hero-story-card-"]'))
        .filter((el) => parseFloat(getComputedStyle(el).opacity) > 0.5)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      return {
        noOverflow,
        ctaRect: { x: ctaRect.x, y: ctaRect.y, width: ctaRect.width, height: ctaRect.height },
        fanRects,
      };
    });
    expect(mobileAudit.noOverflow).toBe(true);
    expect(mobileAudit.fanRects.length).toBeGreaterThanOrEqual(4);
    for (const r of mobileAudit.fanRects) {
      expect(boxesOverlap(mobileAudit.ctaRect, r, 4)).toBe(false);
    }
    await p2.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-mobile-390.png'),
      fullPage: false,
    });

    await p2.setViewportSize({ width: 375, height: 812 });
    await p2.goto('/');
    await p2.waitForTimeout(600);
    expect(
      await p2.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
      ),
    ).toBe(true);

    // Reduced Motion Static Fallback Check
    await p2.emulateMedia({ reducedMotion: 'reduce' });
    await p2.setViewportSize({ width: 1280, height: 800 });
    await p2.goto('/');
    await p2.waitForTimeout(400);
    await expect(p2.locator('#hero-stage h1')).toBeVisible();
    await expect(p2.locator('#hero-primary-cta')).toBeVisible();
    await p2.emulateMedia({ reducedMotion: 'no-preference' });

    // Live Editor round-trip verification
    await p2.goto('/login');
    await p2.fill('#login-phone', '01000000001');
    await p2.fill('#login-pass', 'BoslaAdmin#2026');
    await p2.getByRole('button', { name: 'دخول برقم الموبايل وكلمة المرور' }).click();
    await expect(p2).toHaveURL(/\/admin/, { timeout: 15_000 });
    await p2.goto('/admin/live-editor');
    await expect(p2.getByTestId('admin-live-site-editor')).toBeVisible();
    await expect(p2.getByTestId('live-editor-tab-storytelling')).toHaveCount(0);

    const origTitle = await p2.getByTestId('live-editor-hero-title').inputValue();
    const tempTitle = 'معرفة تتحوّل إلى خبرة ميدانية';
    await p2.getByTestId('live-editor-hero-title').fill(tempTitle);
    await p2.getByTestId('live-editor-summary-input').fill('اختبار تحديث Live Editor');
    await p2.getByTestId('live-editor-publish-btn').click();
    await expect(
      p2.getByText('تم نشر التعديلات للزوار بنجاح!').or(p2.getByText('المسودة مطابقة للمنشور')),
    ).toBeVisible({ timeout: 15_000 });

    await p2.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-admin-live-editor-1280.png'),
      fullPage: false,
    });

    await p2.goto('/');
    await expect(p2.locator('#hero-stage h1')).toContainText(tempTitle);

    await p2.goto('/admin/live-editor');
    await p2.getByTestId('live-editor-hero-title').fill(origTitle || 'معرفة تتحوّل إلى خبرة');
    await p2.getByTestId('live-editor-summary-input').fill('استعادة العنوان الافتراضي');
    await p2.getByTestId('live-editor-publish-btn').click();
    await expect(p2.getByText('المسودة مطابقة للمنشور')).toBeVisible({ timeout: 15_000 });

    await ctx2.close();
    expect(pageErrors).toEqual([]);
  });
});
