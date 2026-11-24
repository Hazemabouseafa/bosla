import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import EmbeddedPostgres from 'embedded-postgres';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma.service';
import { configureApp } from '../src/main';

const execFileAsync = promisify(execFile);

const WINGET_FFMPEG =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe';
const WINGET_FFPROBE =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffprobe.exe';

async function resolveBin(winPath: string, fallback: string) {
  try {
    await fs.access(winPath);
    return winPath;
  } catch {
    return fallback;
  }
}

async function loginPhone(app: INestApplication, phoneNumber: string, password: string) {
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post('/api/v1/auth/login/phone')
    .send({ phoneNumber, countryCode: '+20', password })
    .expect(201);
  return {
    agent,
    csrf: res.body.csrfToken as string,
    user: res.body.user as { id: string; role: string; fullName: string },
  };
}

describe('BOSLA UX Overhaul — Video Recovery, 4-Step Course APIs, Live Editor & Encrypted Paymob Settings (TDD)', () => {
  let pg: EmbeddedPostgres;
  let tmpDir = '';
  let mediaDir = '';
  let sampleMp4Path = '';
  let ffmpegPath = 'ffmpeg';
  let ffprobePath = 'ffprobe';
  let app: INestApplication;
  let prisma: PrismaService;
  const dbPort = 54379;

  let admin: Awaited<ReturnType<typeof loginPhone>>;
  let instructor: Awaited<ReturnType<typeof loginPhone>>;
  let student: Awaited<ReturnType<typeof loginPhone>>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-ux-audit-'));
    const pgDir = path.join(tmpDir, 'pg-data');
    mediaDir = path.join(tmpDir, 'media');
    await fs.mkdir(mediaDir, { recursive: true });
    ffmpegPath = await resolveBin(WINGET_FFMPEG, 'ffmpeg');
    ffprobePath = await resolveBin(WINGET_FFPROBE, 'ffprobe');

    sampleMp4Path = path.join(tmpDir, 'sample-lesson.mp4');
    await execFileAsync(ffmpegPath, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=4:size=640x360:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=4',
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

    pg = new EmbeddedPostgres({
      databaseDir: pgDir,
      user: 'bosla_ux',
      password: 'bosla_ux_password',
      port: dbPort,
      persistent: false,
      initdbFlags: ['--encoding=UTF8', '--no-locale'],
      onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('bosla_ux_audit_db');

    const dbUrl = `postgresql://bosla_ux:bosla_ux_password@127.0.0.1:${dbPort}/bosla_ux_audit_db?schema=public`;
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = dbUrl;
    process.env.ALLOW_INMEMORY_REDIS = 'true';
    process.env.COOKIE_SECRET = 'bosla_ux_cookie_secret_64_characters_minimum_required_here';
    process.env.SESSION_SECRET = 'bosla_ux_session_secret_64_characters_minimum_required_here';
    process.env.RECOVERY_CODE_PEPPER = 'bosla_ux_recovery_pepper_64_characters_minimum_required_here';
    process.env.PLAYBACK_TOKEN_SECRET = 'bosla_ux_playback_secret_64_characters_minimum_required_here';
    process.env.PAYMOB_CONFIG_ENCRYPTION_KEY =
      'bosla_ux_external_paymob_aes_256_gcm_master_key_2026';
    process.env.PAYMOB_MODE = 'sandbox';
    process.env.PAYMOB_HMAC_SECRET = 'bosla_ux_paymob_hmac_secret_value';
    process.env.WEBAUTHN_RP_NAME = 'BOSLA Academy';
    process.env.WEBAUTHN_RP_ID = 'localhost';
    process.env.WEBAUTHN_ORIGIN = 'http://localhost:3000';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.CORS_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000';
    process.env.MEDIA_ROOT = mediaDir;
    process.env.FFMPEG_PATH = ffmpegPath;
    process.env.FFPROBE_PATH = ffprobePath;
    process.env.USE_NGINX_ACCEL = 'false';

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(currentDir, '../../..');
    const migrationsDir = path.join(repoRoot, 'packages/db/prisma/migrations');
    const migrationDirs = (await fs.readdir(migrationsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    const client = pg.getPgClient('bosla_ux_audit_db');
    await client.connect();
    for (const dirName of migrationDirs) {
      const sql = await fs.readFile(path.join(migrationsDir, dirName, 'migration.sql'), 'utf8');
      await client.query(sql);
    }
    await client.end();

    const seedPath = path.join(repoRoot, 'packages/db/prisma/seed.ts');
    const tsxBin = path.join(
      repoRoot,
      'node_modules/.bin',
      process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );
    await execFileAsync(tsxBin, [seedPath], {
      env: { ...process.env, DATABASE_URL: dbUrl },
      shell: process.platform === 'win32',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    admin = await loginPhone(app, '+201000000001', 'BoslaAdmin#2026');
    instructor = await loginPhone(app, '+201000000101', 'BoslaInstructor#2026');

    await prisma.user.update({
      where: { phoneE164: '+201000000201' },
      data: { status: 'ACTIVE' },
    });
    student = await loginPhone(app, '+201000000201', 'BoslaStudent#2026');
  }, 150_000);

  afterAll(async () => {
    if (app) await app.close();
    if (pg) await pg.stop();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }, 60_000);

  it('Slice 1 (Sections 2, 3, 4): enforces default locked lessons, bulk free-preview updates, server-side draft course protection on free previews, in-process HLS transcode & duration extraction, re-transcode, and secret-free diagnostics', async () => {
    const videoBuf = await fs.readFile(sampleMp4Path);

    const initRes = await instructor.agent
      .post('/api/v1/instructor/videos/uploads/initiate')
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        titleAr: 'فيديو اختبار الجاهزية والتشخيص',
        filename: 'sample-lesson.mp4',
        mimeType: 'video/mp4',
        totalBytes: videoBuf.byteLength,
        chunkSizeBytes: 1024 * 1024,
      })
      .expect(201);
    const { sessionId } = initRes.body;

    await instructor.agent
      .post(`/api/v1/instructor/videos/uploads/${sessionId}/chunk?chunkIndex=0`)
      .set('X-CSRF-Token', instructor.csrf)
      .set('X-Chunk-Index', '0')
      .set('Content-Type', 'application/octet-stream')
      .send(videoBuf)
      .expect(201);

    const completeRes = await instructor.agent
      .post(`/api/v1/instructor/videos/uploads/${sessionId}/complete`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ titleAr: 'فيديو اختبار الجاهزية والتشخيص' })
      .expect(201);
    const uploadedAsset = completeRes.body;

    // Instructor creates a DRAFT course with 2 lessons linked to this video
    const courseSlug = `ux-draft-course-${Date.now()}`;
    const createCourseRes = await instructor.agent
      .post('/api/v1/instructor/courses')
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        titleAr: 'كورس اختبار الحماية والتجهيز',
        slug: courseSlug,
        descriptionAr: 'كورس مسودة للتحقق من عدم كشف الدروس المجانية قبل اعتماد ونشر الكورس.',
        difficulty: 'BEGINNER',
        isFree: false,
      })
      .expect(201);
    const course = createCourseRes.body;

    const patchDraftRes = await instructor.agent
      .patch(`/api/v1/instructor/courses/${course.id}/draft`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        titleAr: 'كورس اختبار الحماية والتجهيز',
        descriptionAr: 'كورس مسودة للتحقق من عدم كشف الدروس المجانية قبل اعتماد ونشر الكورس.',
        posterUrl: '/images/brand/course-farm-management.webp',
        sections: [
          {
            titleAr: 'الوحدة الأولى',
            sortOrder: 0,
            lessons: [
              {
                stableKey: 'les-1',
                titleAr: 'الدرس الأول',
                type: 'VIDEO',
                sortOrder: 0,
                videoAssetId: uploadedAsset.id,
              },
              {
                stableKey: 'les-2',
                titleAr: 'الدرس الثاني',
                type: 'VIDEO',
                sortOrder: 1,
                videoAssetId: uploadedAsset.id,
              },
            ],
          },
        ],
      })
      .expect(200);

    const draftLessons = patchDraftRes.body.sections[0].lessons;
    expect(draftLessons[0].isFreePreview).toBe(false);
    expect(draftLessons[1].isFreePreview).toBe(false);

    // Bulk lesson availability update: UNLOCK_FIRST_LESSON marks only lesson 1 as free preview
    const bulkRes = await instructor.agent
      .patch(`/api/v1/instructor/courses/${course.id}/lessons/bulk-preview`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ mode: 'UNLOCK_FIRST_LESSON' })
      .expect(200);
    expect(bulkRes.body.freePreviewCount).toBe(1);
    expect(bulkRes.body.lockedCount).toBe(1);

    // Trigger re-transcode so video reaches READY and propagates extracted duration to lessons
    const retranscodeRes = await instructor.agent
      .post(`/api/v1/instructor/videos/${uploadedAsset.id}/retranscode`)
      .set('X-CSRF-Token', instructor.csrf)
      .expect(201);
    expect(retranscodeRes.body.status).toBe('READY');
    expect(retranscodeRes.body.durationSeconds).toBeGreaterThanOrEqual(3);

    const lessonAfterTranscode = await prisma.lesson.findUnique({
      where: { id: draftLessons[0].id },
    });
    expect(lessonAfterTranscode?.durationSeconds).toBeGreaterThanOrEqual(3);

    // Verify diagnostics endpoint returns stage, qualities, and zero signing secrets
    const diagRes = await instructor.agent
      .get(`/api/v1/instructor/videos/${uploadedAsset.id}/diagnostics`)
      .expect(200);
    const diagBody = JSON.stringify(diagRes.body);
    expect(diagRes.body.playbackReady).toBe(true);
    expect(diagRes.body.masterManifestExists).toBe(true);
    expect(diagBody).not.toContain(process.env.PLAYBACK_TOKEN_SECRET || 'NEVER_LEAK');

    // Server-side draft protection: even though Lesson 1 is isFreePreview=true, the course is still DRAFT!
    // Student and anonymous visitor MUST be blocked from creating a playback session on an unpublished course
    await student.agent
      .post(`/api/v1/lessons/${draftLessons[0].id}/playback-session`)
      .set('X-CSRF-Token', student.csrf)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/lessons/${draftLessons[0].id}/playback-session`)
      .expect(403);

    // Owning instructor CAN preview their own draft lesson via authenticated session
    await instructor.agent
      .post(`/api/v1/lessons/${draftLessons[0].id}/playback-session`)
      .set('X-CSRF-Token', instructor.csrf)
      .expect(201);

    // Readiness check endpoint separates upload status from playback readiness
    const readinessRes = await instructor.agent
      .get(`/api/v1/learning/lessons/${draftLessons[0].id}/playback-readiness`)
      .expect(200);
    expect(readinessRes.body.uploadCompleted).toBe(true);
    expect(readinessRes.body.readyForPlayback).toBe(true);

    // Once Admin publishes the course, BOTH anonymous visitor and student CAN access Lesson 1 (free preview),
    // while Lesson 2 (locked) still requires entitlement!
    await admin.agent
      .post(`/api/v1/admin/courses/${course.id}/publish`)
      .set('X-CSRF-Token', admin.csrf)
      .expect(201);

    const publishedDetail = await prisma.course.findUnique({
      where: { id: course.id },
      include: {
        publishedVersion: {
          include: {
            sections: { include: { lessons: { orderBy: { sortOrder: 'asc' } } } },
          },
        },
      },
    });
    const pubLessons = publishedDetail!.publishedVersion!.sections[0]!.lessons;
    expect(pubLessons[0]!.isFreePreview).toBe(true);
    expect(pubLessons[1]!.isFreePreview).toBe(false);

    // Anonymous visitor plays free preview lesson in published course
    const visitorFreeSession = await request(app.getHttpServer())
      .post(`/api/v1/lessons/${pubLessons[0]!.id}/playback-session`)
      .expect(201);
    expect(visitorFreeSession.body.manifestUrl).toContain('master.m3u8?token=');

    await request(app.getHttpServer())
      .get(visitorFreeSession.body.manifestUrl)
      .expect(200);

    // Anonymous visitor and un-enrolled student are blocked from locked Lesson 2
    await request(app.getHttpServer())
      .post(`/api/v1/lessons/${pubLessons[1]!.id}/playback-session`)
      .expect(403);

    await student.agent
      .post(`/api/v1/lessons/${pubLessons[1]!.id}/playback-session`)
      .set('X-CSRF-Token', student.csrf)
      .expect(403);
  }, 60_000);

  it('Slice 2 (Sections 6, 7): enforces Live Editor RBAC, separate draft vs published state, XSS sanitization, optimistic concurrency 409 conflict, version rollback, media deletion guard, and server-backed Homepage Pricing', async () => {
    // 1. Unauthorized role (Instructor) is blocked from Live Editor endpoints
    await instructor.agent
      .get('/api/v1/admin/live-editor/state?pageKey=home')
      .expect(403);

    // 2. Admin fetches initial Live Editor state
    const initialStateRes = await admin.agent
      .get('/api/v1/admin/live-editor/state?pageKey=home')
      .expect(200);
    const initialState = initialStateRes.body;
    expect(initialState.availablePlans.length).toBeGreaterThan(0);
    expect(initialState.availableCourses.length).toBeGreaterThan(0);

    const publicBeforeDraft = await request(app.getHttpServer())
      .get('/api/v1/catalog/live-layout?pageKey=home')
      .expect(200);
    const origHeroTitle = publicBeforeDraft.body.layout.hero.titleAr;

    // 3. Admin saves a DRAFT with updated hero title, XSS attempt, custom media, and featured pricing plan
    const targetPlanId = initialState.availablePlans[0].id;
    const saveDraft1 = await admin.agent
      .put('/api/v1/admin/live-editor/draft')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        pageKey: 'home',
        baseVersion: initialState.currentDraftVersion ?? 0,
        summaryAr: 'تحديث عنوان البطل وقسم الباقات والأسعار',
        config: {
          ...initialState.draftConfig,
          hero: {
            ...initialState.draftConfig.hero,
            titleAr: 'بوصلة القيادة الميدانية <script>alert(1)</script>',
            primaryCtaHref: 'javascript:alert(9)',
            backgroundDesktopUrl: '/api/v1/media/images/cover-protected-live.png',
          },
          pricing: {
            visible: true,
            titleAr: 'باقات العضوية والتأهيل المستمر',
            subtitleAr: 'اختر خطتك الشهرية أو السنوية بأسعار شفافة من الخادم',
            featuredPlanId: targetPlanId,
            orderedPlanIds: initialState.availablePlans.map((p: any) => p.id),
          },
        },
      })
      .expect(200);
    const draft1 = saveDraft1.body;
    expect(draft1.draft.config.hero.titleAr).toBe('بوصلة القيادة الميدانية');
    expect(draft1.draft.config.hero.primaryCtaHref).toBe('/');

    // Public site MUST NOT reflect the unpublished draft yet
    const publicDuringDraft = await request(app.getHttpServer())
      .get('/api/v1/catalog/live-layout?pageKey=home')
      .expect(200);
    expect(publicDuringDraft.body.layout.hero.titleAr).toBe(origHeroTitle);

    // 4. Concurrent edit with stale baseVersion is rejected with 409 Conflict
    await admin.agent
      .put('/api/v1/admin/live-editor/draft')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        pageKey: 'home',
        baseVersion: 0, // stale version!
        summaryAr: 'تعديل متعارض',
        config: draft1.draft.config,
      })
      .expect(409);

    // 5. Admin publishes the draft -> public layout updates immediately
    const publishRes = await admin.agent
      .post('/api/v1/admin/live-editor/publish')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        pageKey: 'home',
        baseVersion: draft1.draft.versionNumber,
        summaryAr: 'الإصدار المنشور الأول من المحرر الحي',
      })
      .expect(201);
    const publishedRev1 = publishRes.body.published;
    expect(publishedRev1.publishedById).toBeTruthy();

    const publicAfterPublish1 = await request(app.getHttpServer())
      .get('/api/v1/catalog/live-layout?pageKey=home')
      .expect(200);
    expect(publicAfterPublish1.body.layout.hero.titleAr).toBe('بوصلة القيادة الميدانية');
    expect(publicAfterPublish1.body.pricingPlans.length).toBeGreaterThan(0);
    expect(publicAfterPublish1.body.layout.pricing.featuredPlanId).toBe(targetPlanId);

    // 6. Media linked to a published Live Editor revision is protected from deletion
    const delProtectedImg = await admin.agent
      .delete('/api/v1/admin/media/images/cover-protected-live.png')
      .set('X-CSRF-Token', admin.csrf)
      .expect(400);
    expect(delProtectedImg.body.message).toContain('مرتبطة');

    // 7. Admin publishes a second revision, then rolls back to Revision 1
    const saveDraft2 = await admin.agent
      .put('/api/v1/admin/live-editor/draft')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        pageKey: 'home',
        baseVersion: publishRes.body.nextDraftVersion,
        config: {
          ...draft1.draft.config,
          hero: {
            ...draft1.draft.config.hero,
            titleAr: 'عنوان الإصدار الثاني المؤقت',
          },
        },
      })
      .expect(200);

    await admin.agent
      .post('/api/v1/admin/live-editor/publish')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        pageKey: 'home',
        baseVersion: saveDraft2.body.draft.versionNumber,
      })
      .expect(201);

    await admin.agent
      .post(`/api/v1/admin/live-editor/rollback/${publishedRev1.id}`)
      .set('X-CSRF-Token', admin.csrf)
      .expect(201);

    const publicAfterRollback = await request(app.getHttpServer())
      .get('/api/v1/catalog/live-layout?pageKey=home')
      .expect(200);
    expect(publicAfterRollback.body.layout.hero.titleAr).toBe('بوصلة القيادة الميدانية');
  });

  it('Slice 3 (Section 8): enforces encrypted Paymob settings at rest, masked browser responses, preservation of masked secrets on update, RBAC protection, and server-side payment integrity', async () => {
    // 1. Student cannot access Paymob configuration
    await student.agent
      .get('/api/v1/admin/payments/paymob/config')
      .expect(403);

    // 2. Admin saves Paymob Test credentials
    const rawApiKey = 'paymob_test_api_key_secret_9911';
    const rawHmac = 'paymob_test_hmac_secret_7722';
    const rawSecretKey = 'egy_sk_test_8833';

    const saveRes = await admin.agent
      .put('/api/v1/admin/payments/paymob/config')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        isEnabled: true,
        mode: 'TEST',
        currency: 'EGP',
        testApiKey: rawApiKey,
        testIntegrationId: '445566',
        testWalletIntegrationId: '445577',
        testIframeId: '889900',
        testHmacSecret: rawHmac,
        testPublicKey: 'egy_pk_test_1122',
        testSecretKey: rawSecretKey,
      })
      .expect(200);
    const savedConfig = saveRes.body;

    // Browser response NEVER contains the raw secrets
    const serializedResponse = JSON.stringify(savedConfig);
    expect(serializedResponse).not.toContain(rawApiKey);
    expect(serializedResponse).not.toContain(rawHmac);
    expect(serializedResponse).not.toContain(rawSecretKey);
    expect(savedConfig.testApiKeyMasked).toBe('••••••••9911');
    expect(savedConfig.testHmacSecretMasked).toBe('••••••••7722');
    expect(savedConfig.testSecretKeyMasked).toBe('••••••••8833');
    expect(savedConfig.readiness.testReady).toBe(true);
    expect(savedConfig.webhooks.transactionWebhookUrl).toContain('/api/v1/payments/paymob/webhook');

    // Database row stores AES-256-GCM encrypted ciphertext (`enc:v1:...`), never plaintext
    const dbRow = await prisma.paymentGatewayConfig.findUnique({
      where: { providerKey: 'PAYMOB' },
    });
    expect(dbRow).toBeTruthy();
    expect(dbRow!.testApiKeyEnc?.startsWith('enc:v1:')).toBe(true);
    expect(dbRow!.testApiKeyEnc).not.toContain(rawApiKey);
    expect(dbRow!.testHmacSecretEnc?.startsWith('enc:v1:')).toBe(true);
    expect(dbRow!.testHmacSecretEnc).not.toContain(rawHmac);

    // 3. Updating mode/fields while passing masked placeholders preserves existing encrypted secrets
    await admin.agent
      .put('/api/v1/admin/payments/paymob/config')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        isEnabled: true,
        mode: 'TEST',
        currency: 'EGP',
        testApiKey: '••••••••9911',
        testIntegrationId: '445566',
        testIframeId: '889900',
        testHmacSecret: '••••••••7722',
        testSecretKey: '••••••••8833',
      })
      .expect(200);

    const dbRowAfter = await prisma.paymentGatewayConfig.findUnique({
      where: { providerKey: 'PAYMOB' },
    });
    expect(dbRowAfter!.testApiKeyEnc).toBe(dbRow!.testApiKeyEnc);
    expect(dbRowAfter!.testHmacSecretEnc).toBe(dbRow!.testHmacSecretEnc);

    // 4. Verify connection / readiness endpoint
    const verifyRes = await admin.agent
      .post('/api/v1/admin/payments/paymob/verify')
      .set('X-CSRF-Token', admin.csrf)
      .expect(201);
    expect(verifyRes.body.readyForActiveMode).toBe(true);

    // 5. Audit log contains zero secret strings
    const recentAudits = await prisma.auditLog.findMany({
      where: { action: 'ADMIN_PAYMOB_CONFIG_UPDATED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    expect(recentAudits.length).toBeGreaterThan(0);
    const auditDump = JSON.stringify(recentAudits);
    expect(auditDump).not.toContain(rawApiKey);
    expect(auditDump).not.toContain(rawHmac);
  });
});
