import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const SCREENSHOT_DIR =
  'C:/Users/w.i/.gemini/antigravity/brain/bdfd6423-e74c-403e-80c6-c124d2759916/homepage-door-hero';

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

test.describe('BOSLA Scroll-Driven Door Video Hero Verification', () => {
  test('Verify closed->open video scrubbing (forward/reverse), seamless transition to real courses, mobile no-crop, fallback, Reduced Motion, and Live Editor', async ({
    browser,
  }) => {
    test.setTimeout(240_000);
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
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('401') && !text.includes('Unauthorized')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-door-video"]');
    await page.waitForFunction(() => {
      const v = document.querySelector('[data-testid="hero-door-video"]') as HTMLVideoElement | null;
      return Boolean(v && v.readyState >= 2 && Number.isFinite(v.duration) && v.duration > 3);
    });
    await page.waitForTimeout(300);

    // 1. RTL + Removed Legacy Elements + No Background Shader Behind Video
    expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
    expect(await page.locator('html').getAttribute('lang')).toBe('ar');
    for (const removedId of ['#storytelling', '#methodology', '#thesis-band', '#elevation']) {
      await expect(page.locator(removedId)).toHaveCount(0);
    }
    await expect(page.getByTestId('hero-mesh-backdrop')).toHaveCount(0);
    await expect(page.locator('[data-testid^="hero-story-card-"]')).toHaveCount(0);
    await expect(page.locator('html.lenis')).toHaveCount(1);

    // 2. Approved Palette Tokens + Header Fit + Closed-Door Start Frame Verification
    const initialAudit = await page.evaluate(() => {
      const video = document.querySelector('[data-testid="hero-door-video"]') as HTMLVideoElement;
      const scopeBg = getComputedStyle(document.querySelector('.bosla-home-scope')!).backgroundColor;
      const heroBg = getComputedStyle(document.querySelector('#hero-stage')!).backgroundColor;
      const showcaseBg = getComputedStyle(document.querySelector('#courses-showcase')!).backgroundColor;
      const pricingBg = getComputedStyle(document.querySelector('#pricing')!).backgroundColor;
      const h1Color = getComputedStyle(document.querySelector('#hero-stage h1')!).color;
      const ctaBg = getComputedStyle(document.querySelector('#hero-primary-cta')!).backgroundColor;
      const headerEls = Array.from(document.querySelectorAll('header a, header button')).filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
      });
      return {
        scopeBg,
        heroBg,
        showcaseBg,
        pricingBg,
        h1Color,
        ctaBg,
        noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
        headerInViewport: headerEls.every((el) => {
          const r = el.getBoundingClientRect();
          return r.left >= -1 && r.right <= window.innerWidth + 1;
        }),
        autoplay: video.autoplay,
        loop: video.loop,
        muted: video.muted,
        playsInline: video.playsInline,
        paused: video.paused,
        readyState: video.readyState,
        duration: video.duration,
        currentTime: video.currentTime,
        src: video.currentSrc,
      };
    });

    expect(initialAudit.scopeBg).toBe('rgb(173, 213, 240)'); // #ADD5F0
    expect(initialAudit.heroBg).toBe('rgb(173, 213, 240)');
    expect(initialAudit.showcaseBg).toBe('rgb(135, 191, 232)'); // #87BFE8
    expect(initialAudit.pricingBg).toBe('rgb(173, 213, 240)');
    expect(initialAudit.h1Color).toBe('rgb(23, 36, 61)'); // #17243D
    expect(initialAudit.ctaBg).toBe('rgb(74, 31, 176)'); // #4A1FB0
    expect(initialAudit.noOverflow).toBe(true);
    expect(initialAudit.headerInViewport).toBe(true);
    expect(initialAudit.autoplay).toBe(false);
    expect(initialAudit.loop).toBe(false);
    expect(initialAudit.muted).toBe(true);
    expect(initialAudit.playsInline).toBe(true);
    expect(initialAudit.paused).toBe(true);
    expect(initialAudit.duration).toBeGreaterThan(3.5);
    expect(initialAudit.duration).toBeLessThan(4.5);
    expect(initialAudit.currentTime).toBeLessThan(0.15);
    expect(initialAudit.src).toContain('/videos/bosla-door-hero-desktop.mp4');

    await expect(page.locator('#hero-primary-cta')).toContainText('استكشف الكورسات');
    await expect(page.locator('#hero-stage h1')).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-hero-door-closed-1280.png'),
      fullPage: false,
    });

    // 3. Forward Scroll Mid-Opening (~48% of 78% pin travel = 300px): copy fades out cleanly & door opens proportionally
    const totalPinTravel = 800 * 0.78; // 624px
    await page.mouse.wheel(0, Math.round(totalPinTravel * 0.48));
    await page.waitForTimeout(550);

    const midStats = await page.evaluate(() => {
      const v = document.querySelector('[data-testid="hero-door-video"]') as HTMLVideoElement;
      const h1 = document.querySelector('#hero-stage h1')!;
      return {
        currentTime: v.currentTime,
        paused: v.paused,
        h1Opacity: parseFloat(getComputedStyle(h1.closest('div[aria-hidden]')!).opacity || '1'),
      };
    });
    expect(midStats.paused).toBe(true);
    expect(midStats.currentTime).toBeGreaterThan(1.0);
    expect(midStats.currentTime).toBeLessThan(3.7);
    expect(midStats.h1Opacity).toBeLessThan(0.15);
    await expect(page.locator('#hero-stage h1')).not.toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-hero-door-mid-1280.png'),
      fullPage: false,
    });

    // 4. Complete Door Opening (~86% of pin travel) -> nearly full open atrium before crossfade
    await page.mouse.wheel(0, Math.round(totalPinTravel * 0.36));
    await page.waitForTimeout(550);
    const openTime = await page.evaluate(
      () => (document.querySelector('[data-testid="hero-door-video"]') as HTMLVideoElement).currentTime,
    );
    expect(openTime).toBeGreaterThan(3.1);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02b-hero-door-open-1280.png'),
      fullPage: false,
    });

    // 5. Scroll right past Unpin -> Real Courses & Programs Showcase (No Black Frame / Hard Cut)
    await page.mouse.wheel(0, Math.round(totalPinTravel * 1.35));
    await page.waitForTimeout(600);
    await expect(page.locator('#courses-showcase')).toBeVisible();
    await expect(page.getByTestId('courses-slow-marquee')).toBeVisible();
    await expect(page.locator('#courses-showcase a[href^="/courses/"]').first()).toBeVisible();
    await expect(page.locator('#courses-showcase a[href^="/learning-paths/"]').first()).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-courses-marquee-1280.png'),
      fullPage: false,
    });

    // 6. Fast & Smooth Reverse Scroll Back Toward Closed Door
    await page.mouse.wheel(0, -Math.round(totalPinTravel * 1.75));
    await page.waitForTimeout(650);
    const reverseMidTime = await page.evaluate(
      () => (document.querySelector('[data-testid="hero-door-video"]') as HTMLVideoElement).currentTime,
    );
    expect(reverseMidTime).toBeLessThan(openTime - 0.5);

    await page.mouse.wheel(0, -Math.round(totalPinTravel * 1.4));
    await page.waitForTimeout(700);
    const reverseTopTime = await page.evaluate(
      () => (document.querySelector('[data-testid="hero-door-video"]') as HTMLVideoElement).currentTime,
    );
    expect(reverseTopTime).toBeLessThan(0.2);
    await expect(page.locator('#hero-stage h1')).toBeVisible();
    await expect(page.locator('#hero-primary-cta')).toBeVisible();

    // 7. Click "استكشف الكورسات" Bypass Button -> lands cleanly on #courses-showcase & stays there
    await page.locator('#hero-primary-cta').click();
    await page.waitForTimeout(400);
    const jumpBox1 = await page.locator('#courses-showcase').boundingBox();
    expect(jumpBox1).not.toBeNull();
    expect(jumpBox1!.y).toBeGreaterThanOrEqual(40);
    expect(jumpBox1!.y).toBeLessThanOrEqual(140);
    await page.waitForTimeout(500);
    const jumpBoxAfter = await page.locator('#courses-showcase').boundingBox();
    expect(Math.abs(jumpBoxAfter!.y - jumpBox1!.y)).toBeLessThanOrEqual(12);

    // 8. Anchor Nav & Downstream Pricing / Trainers / Footer Verification
    await page.locator('header nav a[href="#pricing"]').click();
    await page.waitForTimeout(700);
    const navPricingBox = await page.locator('#pricing').boundingBox();
    expect(navPricingBox).not.toBeNull();
    expect(Math.abs(navPricingBox!.y)).toBeLessThanOrEqual(180);

    await page.locator('#contact').evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(250);
    await expect(page.locator('footer')).toBeVisible();

    const desktopVideoPath = await page.video()?.path();
    await page.close();
    await context.close();
    if (desktopVideoPath) {
      await fs.copyFile(desktopVideoPath, path.join(SCREENSHOT_DIR, 'door-hero-walkthrough.webm'));
    }
    await fs.rm(videoTempDir, { recursive: true, force: true }).catch(() => {});

    // 9. Mobile (390x844 & 375x812) No-Crop Portal, Scroll Scrub, Tablet (768x1024), Fallback & Reduced Motion
    const ctx2 = await browser.newContext({ locale: 'ar-EG' });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (err) => pageErrors.push(err.message));

    await p2.setViewportSize({ width: 768, height: 1024 });
    await p2.goto('/');
    await p2.waitForTimeout(550);
    expect(
      await p2.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
      ),
    ).toBe(true);
    await p2.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-tablet-768.png'),
      fullPage: false,
    });

    await p2.setViewportSize({ width: 390, height: 844 });
    await p2.goto('/');
    await p2.waitForFunction(() => {
      const v = document.querySelector('[data-testid="hero-door-video"]') as HTMLVideoElement | null;
      return Boolean(v && v.readyState >= 2);
    });
    await p2.waitForTimeout(350);

    const mobileAudit = await p2.evaluate(() => {
      const noOverflow =
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2;
      const headerEls = Array.from(document.querySelectorAll('header a, header button')).filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
      });
      const headerInViewport = headerEls.every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= -1 && r.right <= window.innerWidth + 1;
      });
      const ctaRect = document.querySelector('#hero-primary-cta')!.getBoundingClientRect();
      const stageRect = document.querySelector('[data-testid="hero-door-media-stage"]')!.getBoundingClientRect();
      const video = document.querySelector('[data-testid="hero-door-video"]') as HTMLVideoElement;
      return {
        noOverflow,
        headerInViewport,
        ctaRect: { x: ctaRect.x, y: ctaRect.y, width: ctaRect.width, height: ctaRect.height },
        stageRect: { x: stageRect.x, y: stageRect.y, width: stageRect.width, height: stageRect.height },
        aspectRatio: stageRect.width / stageRect.height,
        videoSrc: video.currentSrc,
      };
    });
    expect(mobileAudit.noOverflow).toBe(true);
    expect(mobileAudit.headerInViewport).toBe(true);
    expect(mobileAudit.videoSrc).toContain('/videos/bosla-door-hero-mobile.mp4');
    // Uncropped 16:9 ratio (~1.77) inside mobile viewport + zero copy collision
    expect(mobileAudit.aspectRatio).toBeGreaterThan(1.55);
    expect(mobileAudit.aspectRatio).toBeLessThan(1.95);
    expect(boxesOverlap(mobileAudit.ctaRect, mobileAudit.stageRect, 4)).toBe(false);

    await p2.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-mobile-390.png'),
      fullPage: false,
    });

    // Verify mobile scroll drives video opening & reverse
    await p2.mouse.wheel(0, 320);
    await p2.waitForTimeout(450);
    const mobileMidTime = await p2.evaluate(
      () => (document.querySelector('[data-testid="hero-door-video"]') as HTMLVideoElement).currentTime,
    );
    expect(mobileMidTime).toBeGreaterThan(0.5);
    await p2.screenshot({
      path: path.join(SCREENSHOT_DIR, '05b-mobile-390-door-open.png'),
      fullPage: false,
    });

    // Mobile drawer lock/unlock check
    await p2.getByRole('button', { name: 'فتح قائمة التنقل' }).click();
    await expect(p2.locator('#home-mobile-drawer')).toBeVisible();
    await p2.getByRole('button', { name: 'إغلاق القائمة' }).click();
    await expect(p2.locator('#home-mobile-drawer')).toBeHidden();
    await expect(p2.locator('html.lenis-stopped')).toHaveCount(0);

    await p2.setViewportSize({ width: 375, height: 812 });
    await p2.goto('/');
    await p2.waitForTimeout(400);
    expect(
      await p2.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
      ),
    ).toBe(true);

    // 10. Route cleanup & Back navigation restoration + Poster Fallback on video failure
    await p2.setViewportSize({ width: 1280, height: 800 });
    await p2.goto('/courses');
    await expect(p2.locator('html.lenis')).toHaveCount(0);
    await p2.goBack();
    await p2.waitForTimeout(450);
    await expect(p2.locator('html.lenis')).toHaveCount(1);

    // Simulate broken video load -> crisp Poster + Headline + CTA stay intact
    await p2.route('**/videos/bosla-door-hero-*.mp4', (route) => route.abort());
    await p2.goto('/');
    await p2.waitForTimeout(500);
    expect(pageErrors).toEqual([]);
    await expect(p2.getByTestId('hero-door-poster')).toBeVisible();
    await expect(p2.locator('#hero-stage h1')).toBeVisible();
    await expect(p2.locator('#hero-primary-cta')).toBeVisible();
    await p2.unroute('**/videos/bosla-door-hero-*.mp4');

    // 11. Reduced Motion Static Image + Immediate Bypass to Courses
    await p2.emulateMedia({ reducedMotion: 'reduce' });
    await p2.goto('/');
    await p2.waitForTimeout(400);
    await expect(p2.locator('#hero-stage h1')).toBeVisible();
    await expect(p2.locator('#hero-primary-cta')).toBeVisible();
    await expect(p2.getByTestId('hero-door-video')).toHaveCount(0);
    await expect(p2.locator('html.lenis')).toHaveCount(0);
    await p2.locator('#hero-primary-cta').click();
    await p2.waitForTimeout(250);
    const rmShowcase = await p2.locator('#courses-showcase').boundingBox();
    expect(rmShowcase).not.toBeNull();
    expect(rmShowcase!.y).toBeGreaterThanOrEqual(40);
    expect(rmShowcase!.y).toBeLessThanOrEqual(140);
    await p2.emulateMedia({ reducedMotion: 'no-preference' });

    // 12. Live Editor Hero Video & Poster & Copy Round-Trip
    await p2.goto('/login');
    await p2.fill('#login-phone', '01000000001');
    await p2.fill('#login-pass', 'BoslaAdmin#2026');
    await p2.getByRole('button', { name: 'دخول برقم الموبايل وكلمة المرور' }).click();
    await expect(p2).toHaveURL(/\/admin/, { timeout: 15_000 });
    await p2.goto('/admin/live-editor');
    await expect(p2.getByTestId('admin-live-site-editor')).toBeVisible();
    await expect(p2.getByTestId('live-editor-hero-poster-desktop')).toBeVisible();
    await expect(p2.getByTestId('live-editor-hero-video-desktop')).toBeVisible();

    const origTitle = await p2.getByTestId('live-editor-hero-title').inputValue();
    const tempTitle = 'بوصلة التأهيل التطبيقي المتكامل';
    await p2.getByTestId('live-editor-hero-title').fill(tempTitle);
    await p2.getByTestId('live-editor-summary-input').fill('اختبار حفظ عنوان البوابة بالفيديو');
    await p2.getByTestId('live-editor-publish-btn').click();
    await expect(
      p2.getByText('تم نشر التعديلات للزوار بنجاح!').or(p2.getByText('المسودة مطابقة للمنشور')),
    ).toBeVisible({ timeout: 15_000 });

    await p2.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-admin-live-editor-1280.png'),
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
    expect(consoleErrors).toEqual([]);
  });
});
