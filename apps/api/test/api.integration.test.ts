import 'reflect-metadata';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { transcodeVideoToHls } from '../../worker/src/transcoder';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma.service';
import { configureApp } from '../src/main';
import { PaymobClient } from '../src/modules/membership/paymob.client';
import { TestPasskeyAuthenticator } from './webauthn-test-helper';

const execFileAsync = promisify(execFile);

const WINGET_FFMPEG =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe';
const WINGET_FFPROBE =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffprobe.exe';

async function resolveBinary(winPath: string, fallback: string) {
  try {
    await fs.access(winPath);
    return winPath;
  } catch {
    return fallback;
  }
}

function makeTestGoogleToken(payload: { sub: string; email?: string; name?: string; emailVerified?: boolean }) {
  const secret = process.env.SESSION_SECRET || 'bosla_test_session_secret_64_characters_minimum_required';
  const body = Buffer.from(JSON.stringify({ emailVerified: true, ...payload }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `bosla-test-google.${body}.${sig}`;
}

describe('BOSLA Academy End-to-End Backend Integration (Real PostgreSQL + WebAuthn + FFmpeg HLS)', () => {
  let pg: EmbeddedPostgres;
  let tmpDir = '';
  let mediaDir = '';
  let app: INestApplication;
  let prisma: PrismaService;
  let ffmpegPath = 'ffmpeg';
  let ffprobePath = 'ffprobe';
  const dbPort = 54329;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-api-int-'));
    const pgDir = path.join(tmpDir, 'pg-data');
    mediaDir = path.join(tmpDir, 'media');
    await fs.mkdir(mediaDir, { recursive: true });

    ffmpegPath = await resolveBinary(WINGET_FFMPEG, 'ffmpeg');
    ffprobePath = await resolveBinary(WINGET_FFPROBE, 'ffprobe');

    pg = new EmbeddedPostgres({
      databaseDir: pgDir,
      user: 'bosla_test',
      password: 'bosla_test_password',
      port: dbPort,
      persistent: false,
      initdbFlags: ['--encoding=UTF8', '--no-locale'],
      onLog: () => {},
      onError: () => {},
    });

    await pg.initialise();
    await pg.start();
    await pg.createDatabase('bosla_academy_test');

    const dbUrl = `postgresql://bosla_test:bosla_test_password@127.0.0.1:${dbPort}/bosla_academy_test?schema=public`;
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = dbUrl;
    process.env.ALLOW_INMEMORY_REDIS = 'true';
    process.env.ALLOW_TEST_GOOGLE_TOKENS = 'true';
    process.env.SESSION_SECRET = 'bosla_test_session_secret_64_characters_minimum_required';
    process.env.RECOVERY_CODE_PEPPER = 'bosla_test_recovery_pepper_64_characters_minimum';
    process.env.PLAYBACK_TOKEN_SECRET = 'bosla_test_playback_secret_64_characters_minimum';
    process.env.PAYMOB_MODE = 'sandbox';
    process.env.PAYMOB_HMAC_SECRET = 'bosla_test_paymob_hmac_secret_value';
    process.env.WEBAUTHN_RP_NAME = 'BOSLA Academy';
    process.env.WEBAUTHN_RP_ID = 'localhost';
    process.env.WEBAUTHN_ORIGIN = 'http://localhost:3000';
    process.env.MEDIA_ROOT = mediaDir;
    process.env.FFMPEG_PATH = ffmpegPath;
    process.env.FFPROBE_PATH = ffprobePath;
    process.env.USE_NGINX_ACCEL = 'false';

    // Apply generated Prisma migration SQL cleanly on PostgreSQL
    const migrationsDir = path.resolve(process.cwd(), '../../packages/db/prisma/migrations');
    const migrationDirs = (await fs.readdir(migrationsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const client = pg.getPgClient('bosla_academy_test');
    await client.connect();
    for (const dirName of migrationDirs) {
      const migrationSql = await fs.readFile(path.join(migrationsDir, dirName, 'migration.sql'), 'utf8');
      await client.query(migrationSql);
    }
    await client.end();

    // Run database seed script against test database
    const seedPath = path.resolve(process.cwd(), '../../packages/db/prisma/seed.ts');
    const tsxBin = path.resolve(
      process.cwd(),
      '../../node_modules/.bin/' + (process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
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
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (pg) await pg.stop();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }, 30000);

  it('serves seeded catalog, enforces ONLY 3 content types (no programs), and computes specialization recommendations', async () => {
    const http = request(app.getHttpServer());

    const health = await http.get('/api/v1/health').expect(200);
    expect(health.body.services.postgres).toBe('up');
    expect(health.body.services.redis).toBe('up');

    const home = await http.get('/api/v1/catalog/home').expect(200);
    expect(home.body.courses.length).toBeGreaterThanOrEqual(4);
    expect(home.body.learningPaths.length).toBeGreaterThanOrEqual(2);
    expect(home.body.diplomas.length).toBeGreaterThanOrEqual(2);
    expect(home.body.instructors.length).toBeGreaterThanOrEqual(8);

    // Strictly no "Program" content type endpoint
    await http.get('/api/v1/catalog/programs').expect(404);

    // Interactive specialization recommender (loaded in home & ranked on server)
    expect(home.body.specialization.domains.length).toBeGreaterThanOrEqual(10);
    expect(home.body.specialization.questions.length).toBeGreaterThan(0);

    const rankRes = await http
      .post('/api/v1/catalog/specialization/rank')
      .send({
        dimensionScores: { D1: 4, D2: 3 },
        speciesScores: { poultry: 5 },
      })
      .expect(201);
    expect(Array.isArray(rankRes.body)).toBe(true);
    expect(rankRes.body.length).toBe(3);

    const leadRes = await http
      .post('/api/v1/catalog/leads')
      .send({
        type: 'CORPORATE_B2B',
        fullName: 'شركة النيل للدواجن',
        companyName: 'مجموعة النيل',
        phoneNumber: '01012345678',
        countryCode: '+20',
        sector: 'دواجن',
        teamSize: '25+',
        need: 'تدريب الفريق',
        timeline: 'فوري',
      })
      .expect(201);
    expect(leadRes.body.leadScore).toBeGreaterThan(0);
  });

  it('supports Option A Google OIDC registration/login without forcing password or passkey', async () => {
    const http = request(app.getHttpServer());
    const agent = request.agent(app.getHttpServer());

    const token = makeTestGoogleToken({
      sub: 'google-sub-student-999',
      email: 'google.vet@boslaagri.com',
      name: 'د. سارة محمد',
    });

    const first = await agent
      .post('/api/v1/auth/google')
      .send({ credential: token })
      .expect(201);
    expect(first.body.isNewAccount).toBe(true);
    expect(first.body.requiresPasskeyEnrollment).toBe(false);
    expect(first.body.user.status).toBe('ACTIVE');
    expect(first.body.user.role).toBe('STUDENT');

    // Google student can immediately access authenticated dashboard without passkey or password
    await agent.get('/api/v1/learning/dashboard').expect(200);

    // Returning user accesses the same account
    const second = await http
      .post('/api/v1/auth/google')
      .send({ credential: token })
      .expect(201);
    expect(second.body.isNewAccount).toBe(false);
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it('enforces Option B Phone + Argon2id -> Mandatory WebAuthn Passkey Enrollment -> Active + Non-OTP Recovery + Multi-Passkey Reauth', async () => {
    const agent = request.agent(app.getHttpServer());
    const auth = new TestPasskeyAuthenticator();

    // Reject duplicate seeded phone or weak password
    await agent
      .post('/api/v1/auth/register/phone')
      .send({
        fullName: 'مستخدم مكرر',
        countryCode: '+20',
        phoneNumber: '01000000201',
        password: 'BoslaUser#2026',
        confirmPassword: 'BoslaUser#2026',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(409);

    // Successful Option B registration -> ENROLLMENT_PENDING
    const reg = await agent
      .post('/api/v1/auth/register/phone')
      .send({
        fullName: 'د. كريم محمود',
        countryCode: '+20',
        phoneNumber: '01099887766',
        password: 'BoslaStrong#2026',
        confirmPassword: 'BoslaStrong#2026',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(201);

    expect(reg.body.requiresPasskeyEnrollment).toBe(true);
    expect(reg.body.user.status).toBe('ENROLLMENT_PENDING');
    expect(reg.body.user.phoneE164).toBe('+201099887766');
    const csrf1 = reg.body.csrfToken;

    // ENROLLMENT_PENDING blocked from normal student APIs
    const blockedRes = await agent.get('/api/v1/learning/dashboard').expect(403);
    expect(blockedRes.body.code).toBe('PASSKEY_ENROLLMENT_REQUIRED');

    // Missing CSRF header rejected
    await agent.post('/api/v1/auth/passkeys/register/options').expect(403);

    // Complete real WebAuthn Passkey enrollment
    const regOpts = await agent
      .post('/api/v1/auth/passkeys/register/options')
      .set('X-CSRF-Token', csrf1)
      .expect(201);

    const attResponse = auth.createRegistrationResponse(regOpts.body, 'http://localhost:3000');

    const verifyReg = await agent
      .post('/api/v1/auth/passkeys/register/verify')
      .set('X-CSRF-Token', csrf1)
      .set('Origin', 'http://localhost:3000')
      .send({ response: attResponse, friendlyName: 'بصمة اللابتوب' })
      .expect(201);

    expect(verifyReg.body.verified).toBe(true);
    expect(verifyReg.body.accountActivated).toBe(true);
    expect(Array.isArray(verifyReg.body.recoveryCodes)).toBe(true);
    expect(verifyReg.body.recoveryCodes).toHaveLength(10);

    // Replay same attestation fails (single-use challenge consumed)
    await agent
      .post('/api/v1/auth/passkeys/register/verify')
      .set('X-CSRF-Token', csrf1)
      .set('Origin', 'http://localhost:3000')
      .send({ response: attResponse, friendlyName: 'Replay' })
      .expect(400);

    // Now ACTIVE student accesses dashboard
    await agent.get('/api/v1/learning/dashboard').expect(200);

    // Register a second Passkey and test reauth check on Passkey removal
    const auth2 = new TestPasskeyAuthenticator();
    const opts2 = await agent
      .post('/api/v1/auth/passkeys/register/options')
      .set('X-CSRF-Token', csrf1)
      .expect(201);
    await agent
      .post('/api/v1/auth/passkeys/register/verify')
      .set('X-CSRF-Token', csrf1)
      .set('Origin', 'http://localhost:3000')
      .send({
        response: auth2.createRegistrationResponse(opts2.body, 'http://localhost:3000'),
        friendlyName: 'مفتاح YubiKey احتياطي',
      })
      .expect(201);

    const listKeys = await agent.get('/api/v1/auth/passkeys').expect(200);
    expect(listKeys.body).toHaveLength(2);

    // Simulate aged session > 10 minutes without recent reauth -> delete Passkey blocked
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { phoneE164: '+201099887766' },
    });
    await prisma.session.updateMany({
      where: { userId: dbUser.id },
      data: { lastRecentAuthAt: new Date(Date.now() - 20 * 60 * 1000) },
    });
    await agent
      .delete(`/api/v1/auth/passkeys/${listKeys.body[0].id}`)
      .set('X-CSRF-Token', csrf1)
      .expect(403);

    // Reauthenticate with password -> deleting second passkey now succeeds
    await agent
      .post('/api/v1/auth/reauth/password')
      .set('X-CSRF-Token', csrf1)
      .send({ password: 'BoslaStrong#2026' })
      .expect(201);
    await agent
      .delete(`/api/v1/auth/passkeys/${listKeys.body[0].id}`)
      .set('X-CSRF-Token', csrf1)
      .expect(200);

    // Cannot delete the final sole Passkey on a phone/password account
    const remaining = await agent.get('/api/v1/auth/passkeys').expect(200);
    expect(remaining.body).toHaveLength(1);
    await agent
      .delete(`/api/v1/auth/passkeys/${remaining.body[0].id}`)
      .set('X-CSRF-Token', csrf1)
      .expect(400);

    // Test Passkey Login
    const passkeyAgent = request.agent(app.getHttpServer());
    const loginOpts = await passkeyAgent
      .post('/api/v1/auth/passkeys/login/options')
      .send({ countryCode: '+20', phoneNumber: '01099887766' })
      .expect(201);
    const loginRes = await passkeyAgent
      .post('/api/v1/auth/passkeys/login/verify')
      .set('Origin', 'http://localhost:3000')
      .send({
        response: auth.createAuthenticationResponse(loginOpts.body, 'http://localhost:3000'),
      })
      .expect(201);
    expect(loginRes.body.user.id).toBe(dbUser.id);

    // Test NON-OTP PASSWORD RECOVERY: Method A (Passkey) & Method B (Single-Use Recovery Code)
    const http = request(app.getHttpServer());
    const idRes = await http
      .post('/api/v1/auth/recovery/identify')
      .send({ countryCode: '+20', phoneNumber: '01099887766' })
      .expect(201);
    expect(idRes.body.methods.passkey).toBe(true);
    expect(idRes.body.methods.recoveryCode).toBe(true);

    // Method A: Passkey challenge + verify
    const recOpts = await http
      .post('/api/v1/auth/recovery/passkey/options')
      .send({ countryCode: '+20', phoneNumber: '01099887766' })
      .expect(201);
    const recPasskeyRes = await http
      .post('/api/v1/auth/recovery/passkey/verify')
      .set('Origin', 'http://localhost:3000')
      .send({
        countryCode: '+20',
        phoneNumber: '01099887766',
        response: auth.createAuthenticationResponse(recOpts.body, 'http://localhost:3000'),
      })
      .expect(201);
    expect(typeof recPasskeyRes.body.resetToken).toBe('string');

    // Method B: Single-Use Recovery Code -> issues resetToken -> replay fails
    const code1 = verifyReg.body.recoveryCodes[0] as string;
    const recCodeRes = await http
      .post('/api/v1/auth/recovery/code/verify')
      .send({
        countryCode: '+20',
        phoneNumber: '01099887766',
        recoveryCode: code1,
      })
      .expect(201);
    expect(typeof recCodeRes.body.resetToken).toBe('string');

    // Atomic single-use replay rejected
    await http
      .post('/api/v1/auth/recovery/code/verify')
      .send({
        countryCode: '+20',
        phoneNumber: '01099887766',
        recoveryCode: code1,
      })
      .expect(401);

    // Reset password using resetToken -> revokes ALL existing sessions
    await http
      .post('/api/v1/auth/recovery/reset-password')
      .send({
        resetToken: recCodeRes.body.resetToken,
        newPassword: 'BoslaNewPass#2027',
        confirmPassword: 'BoslaNewPass#2027',
      })
      .expect(201);

    // Previously active session cookies are now revoked!
    await agent.get('/api/v1/learning/dashboard').expect(401);
    await passkeyAgent.get('/api/v1/learning/dashboard').expect(401);

    // New password works, old password rejected
    await http
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01099887766', password: 'BoslaStrong#2026' })
      .expect(401);
    await http
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01099887766', password: 'BoslaNewPass#2027' })
      .expect(201);

    // Method C: Support-assisted recovery request + Admin resolution
    const supRes = await http
      .post('/api/v1/auth/recovery/support-request')
      .send({
        countryCode: '+20',
        phoneNumber: '01099887766',
        fullName: 'د. كريم محمود',
        notes: 'فقدت الهاتف وأكواد الاسترداد وأرغب بتأكيد هويتي عبر الإدارة.',
      })
      .expect(201);
    expect(supRes.body.status).toBe('PENDING');
  });

  it('enforces RBAC, Editorial Workflow, Course Revision Versioning, Resumable FFmpeg HLS Upload, Paymob HMAC Webhook, Entitlements, Quizzes & Certificates', async () => {
    const adminAgent = request.agent(app.getHttpServer());
    const instAgent = request.agent(app.getHttpServer());
    const otherInstAgent = request.agent(app.getHttpServer());
    const studentAgent = request.agent(app.getHttpServer());

    const adminLogin = await adminAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000001', password: 'BoslaAdmin#2026' })
      .expect(201);
    const adminCsrf = adminLogin.body.csrfToken;

    const instLogin = await instAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000101', password: 'BoslaInstructor#2026' })
      .expect(201);
    const instCsrf = instLogin.body.csrfToken;

    const otherInstLogin = await otherInstAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000102', password: 'BoslaInstructor#2026' })
      .expect(201);

    const studLogin = await studentAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000201', password: 'BoslaStudent#2026' })
      .expect(201);
    const studCsrf = studLogin.body.csrfToken;

    // RBAC checks
    await studentAgent.get('/api/v1/instructor/courses').expect(403);
    await studentAgent.get('/api/v1/admin/overview').expect(403);
    await instAgent.get('/api/v1/admin/overview').expect(403);
    await instAgent.get('/api/v1/admin/editorial/queue').expect(403);

    // 1. Synthesize real MP4 video with FFmpeg & upload via chunked resumable endpoints
    const sampleMp4Path = path.join(tmpDir, 'instructor-lesson.mp4');
    await execFileAsync(ffmpegPath, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=3:size=1280x720:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=520:duration=3',
      '-vf',
      'noise=alls=25:allf=t',
      '-c:v',
      'libx264',
      '-b:v',
      '500k',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      sampleMp4Path,
    ]);
    const mp4Buf = await fs.readFile(sampleMp4Path);
    expect(mp4Buf.byteLength).toBeGreaterThanOrEqual(131072);
    const mid = Math.floor(mp4Buf.byteLength / 2);

    const initUpload = await instAgent
      .post('/api/v1/instructor/videos/uploads/initiate')
      .set('X-CSRF-Token', instCsrf)
      .send({
        titleAr: 'شرح تشريح وتهوية العنابر',
        filename: 'ventilation.mp4',
        mimeType: 'video/mp4',
        totalBytes: mp4Buf.byteLength,
        chunkSizeBytes: mid,
      })
      .expect(201);
    const uploadId = initUpload.body.sessionId;

    await instAgent
      .post(`/api/v1/instructor/videos/uploads/${uploadId}/chunk?chunkIndex=0`)
      .set('X-CSRF-Token', instCsrf)
      .set('Content-Type', 'application/octet-stream')
      .send(mp4Buf.subarray(0, mid))
      .expect(201);

    await instAgent
      .post(`/api/v1/instructor/videos/uploads/${uploadId}/chunk?chunkIndex=1`)
      .set('X-CSRF-Token', instCsrf)
      .set('Content-Type', 'application/octet-stream')
      .send(mp4Buf.subarray(mid))
      .expect(201);

    const completedUpload = await instAgent
      .post(`/api/v1/instructor/videos/uploads/${uploadId}/complete`)
      .set('X-CSRF-Token', instCsrf)
      .send({ titleAr: 'شرح تشريح وتهوية العنابر' })
      .expect(201);

    const videoAssetId = completedUpload.body.id;

    // Run real Worker HLS FFmpeg transcoder
    const transcodeRes = await transcodeVideoToHls({
      prisma,
      videoAssetId,
      config: { mediaRoot: mediaDir, ffmpegPath, ffprobePath },
    });
    expect(transcodeRes.status).toBe('READY');

    // 2. Instructor creates Quiz + Paid Course + Attachment -> submits -> cannot publish directly
    const quizRes = await instAgent
      .post('/api/v1/instructor/quizzes')
      .set('X-CSRF-Token', instCsrf)
      .send({
        titleAr: 'اختبار التحكم البيئي',
        passingScorePercent: 70,
        questions: [
          {
            questionTextAr: 'ما هو الهدف الأساسي للتهوية النفقية في الأعمار الكبيرة؟',
            options: [
              { id: 'a', textAr: 'تبريد الطيور وتجديد الأكسجين' },
              { id: 'b', textAr: 'إغلاق المراوح تماماً' },
            ],
            correctOptionId: 'a',
            points: 1,
            sortOrder: 1,
          },
        ],
      })
      .expect(201);
    const quizId = quizRes.body.id;

    const courseCreate = await instAgent
      .post('/api/v1/instructor/courses')
      .set('X-CSRF-Token', instCsrf)
      .send({
        slug: 'tunnel-ventilation-mastery',
        titleAr: 'إتقان التهوية النفقية للعنابر المغلقة',
        descriptionAr: 'برنامج عملي متكامل لحسابات المراوح والضغط السالب في عنابر التسمين.',
        isFree: false,
        difficulty: 'INTERMEDIATE',
      })
      .expect(201);
    const courseId = courseCreate.body.id;

    // Another instructor cannot inspect or modify this course
    await otherInstAgent.get(`/api/v1/instructor/courses/${courseId}`).expect(403);

    const updatedDraft = await instAgent
      .patch(`/api/v1/instructor/courses/${courseId}/draft`)
      .set('X-CSRF-Token', instCsrf)
      .send({
        sections: [
          {
            titleAr: 'أساسيات الضغط السالب',
            sortOrder: 1,
            lessons: [
              {
                stableKey: 'lesson-preview-intro',
                titleAr: 'مقدمة مجانية عن التهوية',
                type: 'VIDEO',
                isFreePreview: true,
                durationSeconds: 2,
                sortOrder: 1,
                videoAssetId,
              },
              {
                stableKey: 'lesson-paid-core',
                titleAr: 'حساب سرعة الهواء والمراوح',
                type: 'VIDEO',
                isFreePreview: false,
                durationSeconds: 2,
                sortOrder: 2,
                videoAssetId,
              },
              {
                stableKey: 'lesson-quiz-final',
                titleAr: 'اختبار نهاية الكورس',
                type: 'QUIZ',
                isFreePreview: false,
                durationSeconds: 60,
                sortOrder: 3,
                quizId,
              },
            ],
          },
        ],
      })
      .expect(200);

    const paidLessonId = updatedDraft.body.draftVersion.sections[0].lessons[1].id;
    const freePreviewLessonId = updatedDraft.body.draftVersion.sections[0].lessons[0].id;

    // Attach PDF to paid lesson
    const attUpload = await instAgent
      .post(`/api/v1/instructor/lessons/${paidLessonId}/attachments`)
      .set('X-CSRF-Token', instCsrf)
      .send({
        titleAr: 'جدول حسابات المراوح.pdf',
        filename: 'fan-calc.pdf',
        mimeType: 'application/pdf',
        base64Data: Buffer.from('%PDF-1.4 BOSLA ATTACHMENT TEST').toString('base64'),
      })
      .expect(201);
    const attachmentId = attUpload.body.id;

    // Submit for review
    await instAgent
      .post(`/api/v1/instructor/courses/${courseId}/submit`)
      .set('X-CSRF-Token', instCsrf)
      .expect(201);

    // Instructor cannot approve/publish via editorial
    const draftVersionId = updatedDraft.body.draftVersion.id;
    await instAgent
      .post(`/api/v1/admin/editorial/versions/${draftVersionId}/review`)
      .set('X-CSRF-Token', instCsrf)
      .send({ decision: 'APPROVE', comment: 'Attempt self approve' })
      .expect(403);

    // Admin requests changes -> instructor re-submits -> admin approves & publishes
    await adminAgent
      .post(`/api/v1/admin/editorial/versions/${draftVersionId}/review`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ decision: 'REQUEST_CHANGES', comment: 'أضف تفاصيل جدول التحويلات.' })
      .expect(201);
    await instAgent
      .post(`/api/v1/instructor/courses/${courseId}/submit`)
      .set('X-CSRF-Token', instCsrf)
      .expect(201);
    await adminAgent
      .post(`/api/v1/admin/editorial/versions/${draftVersionId}/review`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ decision: 'APPROVE', comment: 'ممتاز ومطابق للمعايير.' })
      .expect(201);
    await adminAgent
      .post(`/api/v1/admin/editorial/versions/${draftVersionId}/publish`)
      .set('X-CSRF-Token', adminCsrf)
      .expect(201);

    // Reuse published course inside a Learning Path without duplication
    await adminAgent
      .post('/api/v1/admin/learning-paths')
      .set('X-CSRF-Token', adminCsrf)
      .send({
        slug: 'ventilation-career-path',
        titleAr: 'مسار هندسة البيئة والعنابر',
        descriptionAr: 'مسار عملي لإتقان العنابر المغلقة باستخدام الكورسات المنشورة.',
        courseLinks: [{ courseId, sortOrder: 1, isRequired: true }],
      })
      .expect(201);

    // Editing a PUBLISHED course clones version 2 DRAFT while version 1 stays live!
    const v2Edit = await instAgent
      .patch(`/api/v1/instructor/courses/${courseId}/draft`)
      .set('X-CSRF-Token', instCsrf)
      .send({ subtitleAr: 'تحديث النسخة الثانية — قيد المراجعة' })
      .expect(200);
    expect(v2Edit.body.draftVersion.versionNumber).toBe(2);
    expect(v2Edit.body.publishedVersion.versionNumber).toBe(1);

    // 3. Student WITHOUT subscription: allowed free preview, BLOCKED on paid lesson & attachment
    await studentAgent
      .post(`/api/v1/lessons/${freePreviewLessonId}/playback-session`)
      .set('X-CSRF-Token', studCsrf)
      .expect(201);
    await studentAgent
      .post(`/api/v1/lessons/${paidLessonId}/playback-session`)
      .set('X-CSRF-Token', studCsrf)
      .expect(403);
    await studentAgent
      .get(`/api/v1/learning/attachments/${attachmentId}/download`)
      .expect(403);

    // Assign new published course to Monthly Membership Plan & verify Paymob webhook + HMAC
    const plansRes = await studentAgent.get('/api/v1/memberships/plans').expect(200);
    const monthlyPlan = plansRes.body.find((p: any) => p.interval === 'MONTHLY');
    expect(monthlyPlan).toBeTruthy();

    await adminAgent
      .patch(`/api/v1/admin/membership-plans/${monthlyPlan.id}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({
        slug: monthlyPlan.slug,
        interval: monthlyPlan.interval,
        nameAr: monthlyPlan.nameAr,
        descriptionAr: monthlyPlan.descriptionAr,
        priceCents: monthlyPlan.priceCents,
        entitlementMode: 'FOLLOW_LATEST_PLAN',
        courseIds: [courseId],
        learningPathIds: [],
        diplomaIds: [],
      })
      .expect(200);

    const checkout = await studentAgent
      .post('/api/v1/memberships/checkout')
      .set('X-CSRF-Token', studCsrf)
      .send({ planId: monthlyPlan.id })
      .expect(201);
    const merchantOrderId = checkout.body.merchantOrderId as string;

    // Invalid Paymob HMAC must be rejected
    const fakePayloadObj = {
      id: 987654321,
      amount_cents: monthlyPlan.priceCents,
      created_at: new Date().toISOString(),
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      integration_id: 1,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 555444, merchant_order_id: merchantOrderId },
      owner: 1,
      pending: false,
      source_data: { pan: '1234', sub_type: 'MasterCard', type: 'card' },
      success: true,
    };
    const http = request(app.getHttpServer());
    await http
      .post('/api/v1/payments/paymob/webhook?hmac=invalid_hmac_value')
      .send({ type: 'TRANSACTION', obj: fakePayloadObj })
      .expect(401);

    // Valid Paymob HMAC webhook activates subscription & is idempotent on replay
    const validHmac = new PaymobClient().computeTransactionHmac(
      fakePayloadObj,
      process.env.PAYMOB_HMAC_SECRET!,
    );
    const hook1 = await http
      .post(`/api/v1/payments/paymob/webhook?hmac=${validHmac}`)
      .send({ type: 'TRANSACTION', obj: fakePayloadObj })
      .expect(201);
    expect(hook1.body.status).toBe('PAID');

    const hook2 = await http
      .post(`/api/v1/payments/paymob/webhook?hmac=${validHmac}`)
      .send({ type: 'TRANSACTION', obj: fakePayloadObj })
      .expect(201);
    expect(hook2.body.deduplicated).toBe(true);

    // 4. Now subscribed student can play HLS video & download attachment!
    const playback = await studentAgent
      .post(`/api/v1/lessons/${paidLessonId}/playback-session`)
      .set('X-CSRF-Token', studCsrf)
      .expect(201);
    expect(playback.body.manifestUrl).toContain('master.m3u8?token=');

    const masterRes = await http.get(playback.body.manifestUrl).expect(200);
    expect(masterRes.text).toContain('720p/index.m3u8?token=');

    const tokenParam = new URL(`http://localhost${playback.body.manifestUrl}`).searchParams.get('token')!;
    const variantRes = await http
      .get(`/api/v1/videos/stream/${videoAssetId}/720p/index.m3u8?token=${encodeURIComponent(tokenParam)}`)
      .expect(200);
    expect(variantRes.text).toContain('seg_00000.ts?token=');

    const segRes = await http
      .get(`/api/v1/videos/stream/${videoAssetId}/720p/seg_00000.ts?token=${encodeURIComponent(tokenParam)}`)
      .expect(200);
    expect(segRes.body.length).toBeGreaterThan(100);

    // Tampered token and path traversal are rejected
    await http
      .get(`/api/v1/videos/stream/${videoAssetId}/master.m3u8?token=bad.token`)
      .expect(401);
    await http
      .get(`/api/v1/videos/stream/${videoAssetId}/..%2F..%2Fsecret.ts?token=${encodeURIComponent(tokenParam)}`)
      .expect(403);

    const dlRes = await studentAgent
      .get(`/api/v1/learning/attachments/${attachmentId}/download`)
      .expect(200);
    expect(Buffer.from(dlRes.body).toString('utf8')).toContain(
      '%PDF-1.4 BOSLA ATTACHMENT TEST',
    );

    // 5. Save progress on lessons, pass quiz, auto-issue verifiable certificate!
    for (const key of ['lesson-preview-intro', 'lesson-paid-core', 'lesson-quiz-final']) {
      await studentAgent
        .post(`/api/v1/learning/lessons/${paidLessonId}/progress`)
        .set('X-CSRF-Token', studCsrf)
        .send({ watchedSeconds: 2, durationSeconds: 2, isCompleted: true })
        .expect(201);
      // Note: also complete preview & quiz lessons properly:
      void key;
    }
    const playerData = await studentAgent
      .get(`/api/v1/learning/courses/tunnel-ventilation-mastery/player`)
      .expect(200);
    const v1Lessons = playerData.body.sections[0].lessons;
    for (const l of v1Lessons) {
      await studentAgent
        .post(`/api/v1/learning/lessons/${l.id}/progress`)
        .set('X-CSRF-Token', studCsrf)
        .send({ watchedSeconds: 60, durationSeconds: 60, isCompleted: true })
        .expect(201);
    }

    const attempt = await studentAgent
      .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
      .set('X-CSRF-Token', studCsrf)
      .send({ answers: { [quizRes.body.questions[0].id]: 'a' } })
      .expect(201);
    expect(attempt.body.passed).toBe(true);
    expect(attempt.body.issuedCertificate).toBeTruthy();

    const verifyCert = await http
      .get(`/api/v1/learning/certificates/verify/${attempt.body.issuedCertificate.certificateCode}`)
      .expect(200);
    expect(verifyCert.body.courseId).toBe(courseId);

    // 6. Expiring subscription immediately revokes access on backend
    const studUser = await prisma.user.findUniqueOrThrow({ where: { phoneE164: '+201000000201' } });
    await prisma.subscription.updateMany({
      where: { userId: studUser.id },
      data: { currentPeriodEnd: new Date(Date.now() - 60_000), status: 'EXPIRED' },
    });
    await studentAgent
      .post(`/api/v1/lessons/${paidLessonId}/playback-session`)
      .set('X-CSRF-Token', studCsrf)
      .expect(403);
  }, 60000);

  it('allows Admin to create courses, assign instructors, edit instructor drafts cross-role, publish, unpublish, and delete unlinked drafts', async () => {
    const adminAgent = request.agent(app.getHttpServer());
    const adminLogin = await adminAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000001', password: 'BoslaAdmin#2026' })
      .expect(201);
    const adminCsrf = adminLogin.body.csrfToken;

    const instUser = await prisma.user.findUniqueOrThrow({
      where: { phoneE164: '+201000000101' },
    });

    const slug = `admin-managed-${Date.now()}`;
    const createdRes = await adminAgent
      .post('/api/v1/admin/courses')
      .set('X-CSRF-Token', adminCsrf)
      .send({
        slug,
        titleAr: 'كورس إدارة الجودة البيطرية',
        descriptionAr: 'برنامج إداري متكامل لتطبيق معايير الجودة والرقابة الصحية داخل المزارع.',
        instructorId: instUser.id,
        difficulty: 'INTERMEDIATE',
        isFree: false,
        publishImmediately: false,
      })
      .expect(201);

    const adminCourseId = createdRes.body.id;
    expect(createdRes.body.status).toBe('DRAFT');
    expect(createdRes.body.instructor.id).toBe(instUser.id);

    // Admin updates metadata directly
    const patched = await adminAgent
      .patch(`/api/v1/admin/courses/${adminCourseId}`)
      .set('X-CSRF-Token', adminCsrf)
      .send({
        titleAr: 'كورس إدارة الجودة والأمن الحيوي',
        isFree: true,
      })
      .expect(200);
    expect(patched.body.isFree).toBe(true);
    expect(patched.body.draftVersion.titleAr).toBe('كورس إدارة الجودة والأمن الحيوي');

    // Admin can also edit the instructor-assigned course curriculum via Instructor Studio endpoint
    await adminAgent
      .patch(`/api/v1/instructor/courses/${adminCourseId}/draft`)
      .set('X-CSRF-Token', adminCsrf)
      .send({
        sections: [
          {
            titleAr: 'القسم الإداري التطبيقي',
            sortOrder: 0,
            lessons: [
              {
                stableKey: 'admin-intro-lesson',
                titleAr: 'مقدمة في معايير الجودة',
                type: 'ARTICLE',
                isFreePreview: true,
                durationSeconds: 300,
                sortOrder: 0,
                articleContentAr: 'محتوى إرشادي متاح لجميع المتدربين حول خطط الجودة والسلامة.',
              },
            ],
          },
        ],
      })
      .expect(200);

    // Admin publishes immediately -> unpublishes -> deletes unlinked course
    const published = await adminAgent
      .post(`/api/v1/admin/courses/${adminCourseId}/publish`)
      .set('X-CSRF-Token', adminCsrf)
      .expect(201);
    expect(published.body.status).toBe('PUBLISHED');

    const unpublished = await adminAgent
      .post(`/api/v1/admin/courses/${adminCourseId}/unpublish`)
      .set('X-CSRF-Token', adminCsrf)
      .expect(201);
    expect(unpublished.body.status).toBe('UNPUBLISHED');

    const deleted = await adminAgent
      .delete(`/api/v1/admin/courses/${adminCourseId}`)
      .set('X-CSRF-Token', adminCsrf)
      .expect(200);
    expect(deleted.body.deleted).toBe(true);
  });

  it('enforces ADMIN-only Offline Event creation, standalone EGP pricing, and Paymob HMAC ticket checkout', async () => {
    const http = request(app.getHttpServer());
    const adminAgent = request.agent(app.getHttpServer());
    const instAgent = request.agent(app.getHttpServer());
    const studentAgent = request.agent(app.getHttpServer());

    const adminLogin = await adminAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000001', password: 'BoslaAdmin#2026' })
      .expect(201);
    const adminCsrf = adminLogin.body.csrfToken;

    const instLogin = await instAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000101', password: 'BoslaInstructor#2026' })
      .expect(201);
    const instCsrf = instLogin.body.csrfToken;

    const studLogin = await studentAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000201', password: 'BoslaStudent#2026' })
      .expect(201);
    const studCsrf = studLogin.body.csrfToken;

    // 1. Strict ADMIN-only access control: INSTRUCTOR and STUDENT receive 403
    const evSlug = `cairo-field-workshop-${Date.now()}`;
    const eventPayload = {
      slug: evSlug,
      titleAr: 'ورشة التهوية المغلقة والأمن الحيوي الميدانية',
      subtitleAr: 'يوم تدريبي تطبيقي داخل المزرعة النموذجية',
      descriptionAr:
        'ورشة تدريبية عملية وجهاً لوجه لحسابات التهوية وضغط الهواء وتشخيص أعطال المزارع عملياً.',
      categoryLabelAr: 'ورشة تطبيقية',
      cityAr: 'القاهرة',
      venueNameAr: 'مركز تدريب التجمع الخامس',
      venueAddressAr: 'شارع التسعين الجنوبي، التجمع الخامس، القاهرة الجديدة',
      startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      priceCents: 95000,
      capacity: 20,
      status: 'PUBLISHED',
      highlights: ['حسابات التهوية عملياً', 'تشخيص المشكلات التنفسية'],
    };

    await instAgent
      .post('/api/v1/admin/events')
      .set('X-CSRF-Token', instCsrf)
      .send(eventPayload)
      .expect(403);
    await instAgent.get('/api/v1/admin/events').expect(403);
    await studentAgent
      .post('/api/v1/admin/events')
      .set('X-CSRF-Token', studCsrf)
      .send(eventPayload)
      .expect(403);

    // 2. ADMIN creates & publishes event with standalone 950 EGP ticket price
    const createdEv = await adminAgent
      .post('/api/v1/admin/events')
      .set('X-CSRF-Token', adminCsrf)
      .send(eventPayload)
      .expect(201);
    const eventId = createdEv.body.id as string;
    expect(createdEv.body.priceCents).toBe(95000);
    expect(createdEv.body.status).toBe('PUBLISHED');

    // 3. Public catalog lists event with standalone price and student initiates Paymob checkout (2 seats)
    const publicList = await http.get('/api/v1/events').expect(200);
    expect(publicList.body.some((e: any) => e.id === eventId && e.priceCents === 95000)).toBe(true);

    const checkoutRes = await studentAgent
      .post(`/api/v1/events/${eventId}/checkout`)
      .set('X-CSRF-Token', studCsrf)
      .send({
        seatsCount: 2,
        attendeeNameAr: 'د. سلمى إبراهيم',
        attendeePhone: '01000000201',
      })
      .expect(201);
    expect(checkoutRes.body.amountCents).toBe(190000);
    expect(checkoutRes.body.ticketCode).toMatch(/^EVT-/);
    const merchantOrderId = checkoutRes.body.merchantOrderId as string;

    // 4. Signed Paymob HMAC webhook confirms ticket & settles payment idempotently
    const eventHookObj = {
      id: 987654999,
      amount_cents: 190000,
      created_at: new Date().toISOString(),
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      integration_id: 1,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 666777, merchant_order_id: merchantOrderId },
      owner: 1,
      pending: false,
      source_data: { pan: '4321', sub_type: 'Visa', type: 'card' },
      success: true,
    };
    const hmac = new PaymobClient().computeTransactionHmac(
      eventHookObj,
      process.env.PAYMOB_HMAC_SECRET!,
    );

    const hookFirst = await http
      .post(`/api/v1/payments/paymob/webhook?hmac=${hmac}`)
      .send({ type: 'TRANSACTION', obj: eventHookObj })
      .expect(201);
    expect(hookFirst.body.status).toBe('PAID');

    const hookReplay = await http
      .post(`/api/v1/payments/paymob/webhook?hmac=${hmac}`)
      .send({ type: 'TRANSACTION', obj: eventHookObj })
      .expect(201);
    expect(hookReplay.body.deduplicated).toBe(true);

    // 5. Verify confirmed ticket, reduced capacity, and student dashboard visibility
    const myRegs = await studentAgent.get('/api/v1/events/my/registrations').expect(200);
    const ticket = myRegs.body.find((r: any) => r.ticketCode === checkoutRes.body.ticketCode);
    expect(ticket).toBeTruthy();
    expect(ticket.status).toBe('CONFIRMED');
    expect(ticket.seatsCount).toBe(2);

    const evAfter = await http.get(`/api/v1/events/${evSlug}`).expect(200);
    expect(evAfter.body.remainingSeats).toBe(18);
  });

  it('enforces excluded-from-membership courses, standalone checkout-item settlement across multi-instructor %, independent accounts, attendance & competency certs, dual reviews, Quora Q&A, and audit logs', async () => {
    const http = request(app.getHttpServer());
    const adminAgent = request.agent(app.getHttpServer());
    const instAgent = request.agent(app.getHttpServer());
    const studentAgent = request.agent(app.getHttpServer());

    const adminLogin = await adminAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000001', password: 'BoslaAdmin#2026' })
      .expect(201);
    const adminCsrf = adminLogin.body.csrfToken as string;

    const instLogin = await instAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000101', password: 'BoslaInstructor#2026' })
      .expect(201);
    const instCsrf = instLogin.body.csrfToken as string;

    const studLogin = await studentAgent
      .post('/api/v1/auth/login/phone')
      .send({ countryCode: '+20', phoneNumber: '01000000201', password: 'BoslaStudent#2026' })
      .expect(201);
    const studCsrf = studLogin.body.csrfToken as string;

    const instructors = await prisma.user.findMany({
      where: { role: 'INSTRUCTOR' },
      orderBy: { createdAt: 'asc' },
      take: 2,
    });
    expect(instructors.length).toBeGreaterThanOrEqual(2);
    const [inst1, inst2] = instructors;

    // 1. Admin creates a standalone course EXCLUDED from monthly/annual membership
    const slug = `standalone-pro-${Date.now()}`;
    const createdCourse = await adminAgent
      .post('/api/v1/admin/courses')
      .set('X-CSRF-Token', adminCsrf)
      .send({
        slug,
        titleAr: 'برنامج التحليل المالي للعيادات البيطرية',
        descriptionAr: 'دورة متخصصة غير مشمولة بالاشتراك الشهري ومتاحة للشراء الفردي المباشر.',
        instructorId: inst1.id,
        difficulty: 'ADVANCED',
        isFree: false,
        priceCents: 60000,
        includedInMembership: false,
        allowIndividualPurchase: true,
        publishImmediately: false,
      })
      .expect(201);
    const courseId = createdCourse.body.id as string;
    expect(createdCourse.body.includedInMembership).toBe(false);
    expect(createdCourse.body.priceCents).toBe(60000);

    // 2. Assign two instructors to the course with custom revenue share percentages (30% + 20% = 50%)
    const splitRes = await adminAgent
      .put(`/api/v1/admin/programs/COURSE/${courseId}/instructors`)
      .set('X-CSRF-Token', adminCsrf)
      .send({
        assignments: [
          { instructorId: inst1.id, roleTitleAr: 'مدرب رئيسي', revenueSharePercent: 30, isPrimary: true },
          { instructorId: inst2.id, roleTitleAr: 'مدرب مشارك', revenueSharePercent: 20, isPrimary: false },
        ],
      })
      .expect(200);
    expect(splitRes.body).toHaveLength(2);

    // Add 1 ARTICLE lesson & publish
    await adminAgent
      .patch(`/api/v1/instructor/courses/${courseId}/draft`)
      .set('X-CSRF-Token', adminCsrf)
      .send({
        sections: [
          {
            titleAr: 'الوحدة التطبيقية الكاملة',
            sortOrder: 0,
            lessons: [
              {
                stableKey: `standalone-art-${Date.now()}`,
                titleAr: 'دراسة الجدوى والتشغيل العملي',
                type: 'ARTICLE',
                isFreePreview: false,
                durationSeconds: 180,
                sortOrder: 0,
                articleContentAr: 'محتوى تطبيقي متكامل لحساب الهوامش والعائد الشهري.',
              },
            ],
          },
        ],
      })
      .expect(200);
    await adminAgent
      .post(`/api/v1/admin/courses/${courseId}/publish`)
      .set('X-CSRF-Token', adminCsrf)
      .expect(201);

    // 3. Even with an ACTIVE annual membership, excluded course remains LOCKED without individual purchase
    const studUser = await prisma.user.findUniqueOrThrow({ where: { phoneE164: '+201000000201' } });
    const planRev = await prisma.membershipPlanRevision.findFirstOrThrow();
    await prisma.subscription.create({
      data: {
        userId: studUser.id,
        planId: planRev.planId,
        planRevisionId: planRev.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 86_400_000),
      },
    });

    const lockedPlayer = await studentAgent
      .get(`/api/v1/learning/courses/${slug}/player`)
      .expect(200);
    expect(lockedPlayer.body.access.allowed).toBe(false);
    await studentAgent
      .post(`/api/v1/learning/courses/${courseId}/enroll`)
      .set('X-CSRF-Token', studCsrf)
      .expect(403);

    // 4. Student purchases ONLY this standalone course via Paymob checkout-item & HMAC webhook
    const itemCheckout = await studentAgent
      .post('/api/v1/memberships/checkout-item')
      .set('X-CSRF-Token', studCsrf)
      .send({ targetType: 'COURSE', targetId: courseId })
      .expect(201);
    expect(itemCheckout.body.amountCents).toBe(60000);
    const merchantOrderId = itemCheckout.body.merchantOrderId as string;

    const hookObj = {
      id: 888999111,
      amount_cents: 60000,
      created_at: new Date().toISOString(),
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      integration_id: 1,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 777666, merchant_order_id: merchantOrderId },
      owner: 1,
      pending: false,
      source_data: { pan: '9876', sub_type: 'Visa', type: 'card' },
      success: true,
    };
    const hmac = new PaymobClient().computeTransactionHmac(hookObj, process.env.PAYMOB_HMAC_SECRET!);
    const hookRes = await http
      .post(`/api/v1/payments/paymob/webhook?hmac=${hmac}`)
      .send({ type: 'TRANSACTION', obj: hookObj })
      .expect(201);
    expect(hookRes.body.status).toBe('PAID');

    // 5. Verify unlocked access + ProgramFinancialAccount + multi-instructor splits + Instructor statements + Payout
    const unlockedPlayer = await studentAgent
      .get(`/api/v1/learning/courses/${slug}/player`)
      .expect(200);
    expect(unlockedPlayer.body.access.allowed).toBe(true);
    const lessonId = unlockedPlayer.body.sections[0].lessons[0].id as string;

    const progAccount = await prisma.programFinancialAccount.findUniqueOrThrow({
      where: { courseId },
    });
    expect(progAccount.totalGrossRevenueCents).toBe(60000);
    expect(progAccount.totalInstructorShareCents).toBe(30000); // 30% + 20% = 50% of 60000
    expect(progAccount.totalPlatformShareCents).toBe(30000);

    const inst1Before = await prisma.instructorFinancialAccount.findUniqueOrThrow({
      where: { instructorId: inst1.id },
    });
    const inst2Account = await prisma.instructorFinancialAccount.findUniqueOrThrow({
      where: { instructorId: inst2.id },
    });
    expect(inst1Before.totalEarnedCents).toBeGreaterThanOrEqual(18000);
    expect(inst2Account.totalEarnedCents).toBeGreaterThanOrEqual(12000);

    const paymentRec = await prisma.financialPaymentRecord.findFirst({
      where: { courseId, direction: 'INBOUND' },
    });
    expect(paymentRec?.grossAmountCents).toBe(60000);

    // Admin records payout to inst1 & audit log records financial action
    const payoutRes = await adminAgent
      .post(`/api/v1/admin/finance/instructors/${inst1.id}/payout`)
      .set('X-CSRF-Token', adminCsrf)
      .send({ amountCents: 5000, paymentMethodAr: 'تحويل بنكي', notesAr: 'دفعة اختبار تكاملي' })
      .expect(201);
    expect(payoutRes.body.account.totalPaidOutCents).toBeGreaterThanOrEqual(5000);

    const instStmt = await instAgent.get('/api/v1/instructor/finance/statement').expect(200);
    expect(instStmt.body.account.totalEarnedCents).toBeGreaterThanOrEqual(18000);

    // 6. 100% Completion -> ATTENDANCE_COMPLETION auto-issued -> Competency Request notifies Admin & Assigned Instructors -> Instructor approves -> COMPETENCY issued
    await studentAgent
      .post(`/api/v1/learning/lessons/${lessonId}/progress`)
      .set('X-CSRF-Token', studCsrf)
      .send({ watchedSeconds: 180, durationSeconds: 180, isCompleted: true })
      .expect(201);

    const certsAfter100 = await studentAgent.get('/api/v1/learning/certificates').expect(200);
    const attendanceCert = certsAfter100.body.find(
      (c: any) => c.courseId === courseId && c.kind === 'ATTENDANCE_COMPLETION',
    );
    expect(attendanceCert).toBeTruthy();

    const compReqRes = await studentAgent
      .post('/api/v1/learning/competency-requests')
      .set('X-CSRF-Token', studCsrf)
      .send({
        targetType: 'COURSE',
        courseId,
        studentNotesAr: 'أتممت التحليل المالي التطبيقي بالكامل',
      })
      .expect(201);
    const compReqId = compReqRes.body.id as string;

    const instNotifications = await prisma.notification.findMany({
      where: { userId: inst1.id, courseId },
    });
    expect(instNotifications.length).toBeGreaterThan(0);

    const instCompList = await instAgent.get('/api/v1/instructor/competency-requests').expect(200);
    expect(instCompList.body.some((r: any) => r.id === compReqId && r.status === 'PENDING')).toBe(
      true,
    );

    const compApproveRes = await instAgent
      .post(`/api/v1/instructor/competency-requests/${compReqId}/review`)
      .set('X-CSRF-Token', instCsrf)
      .send({ decision: 'APPROVE', reviewNotesAr: 'مستوفٍ لمعايير الكفاءة المهنية' })
      .expect(201);
    expect(compApproveRes.body.status).toBe('APPROVED');
    expect(compApproveRes.body.certificate.kind).toBe('COMPETENCY');

    // 7. Dual-linked Review (Course + Instructor) & Simplified Quora Subscribers Q&A + AuditLog check
    const revRes = await studentAgent
      .post('/api/v1/learning/reviews')
      .set('X-CSRF-Token', studCsrf)
      .send({
        courseId,
        instructorId: inst1.id,
        rating: 5,
        instructorRating: 5,
        commentAr: 'أسلوب عملي واضح وتطبيق مباشر في العيادة',
      })
      .expect(201);
    expect(revRes.body.instructorId).toBe(inst1.id);
    expect(revRes.body.instructorRating).toBe(5);

    const quoraQ = await studentAgent
      .post('/api/v1/community/subscribers/questions')
      .set('X-CSRF-Token', studCsrf)
      .send({
        topicAr: 'عام',
        titleAr: 'ما هو هامش الأمان في تسعير الخدمات البيطرية؟',
        bodyAr: 'أرغب في معرفة النسبة العملية لتوزيع التكاليف الثابتة والمتغيرة شهرياً.',
        courseId,
      })
      .expect(201);
    const quoraAns = await instAgent
      .post(`/api/v1/community/subscribers/questions/${quoraQ.body.id}/answers`)
      .set('X-CSRF-Token', instCsrf)
      .send({ bodyAr: 'يوصى بأن لا تقل نسبة هامش التشغيل الإجمالي عن 28% لتغطية الإهلاك والطوارئ.' })
      .expect(201);
    await studentAgent
      .post(`/api/v1/community/subscribers/questions/${quoraQ.body.id}/upvote`)
      .set('X-CSRF-Token', studCsrf)
      .expect(201);
    await studentAgent
      .post(`/api/v1/community/subscribers/questions/${quoraQ.body.id}/accept-answer`)
      .set('X-CSRF-Token', studCsrf)
      .send({ answerId: quoraAns.body.id })
      .expect(201);

    const quoraFeed = await http.get('/api/v1/community/subscribers/questions?filter=resolved').expect(200);
    expect(quoraFeed.body.items.some((q: any) => q.id === quoraQ.body.id && q.isResolved)).toBe(true);

    const finAuditCount = await prisma.auditLog.count({
      where: {
        action: {
          in: [
            'ADMIN_PROGRAM_INSTRUCTORS_UPDATED',
            'ADMIN_INSTRUCTOR_PAYOUT_RECORDED',
            'COMPETENCY_CERTIFICATE_APPROVED',
            'PROGRAM_INSTRUCTOR_REVIEW_SUBMITTED',
          ],
        },
      },
    });
    expect(finAuditCount).toBeGreaterThanOrEqual(4);
  });
});
