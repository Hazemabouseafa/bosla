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
import { transcodeVideoToHls } from '../../worker/src/transcoder';
import { processAutoCaptionJob } from '../../worker/src/captions';

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

describe('BOSLA Feature Audit Suite — Video, Captions, Quizzes, Certificates & Commerce (TDD)', () => {
  let pg: EmbeddedPostgres;
  let tmpDir = '';
  let mediaDir = '';
  let ffmpegPath = 'ffmpeg';
  let ffprobePath = 'ffprobe';
  let app: INestApplication;
  let prisma: PrismaService;
  const dbPort = 54371;

  let admin: Awaited<ReturnType<typeof loginPhone>>;
  let instructor: Awaited<ReturnType<typeof loginPhone>>;
  let student: Awaited<ReturnType<typeof loginPhone>>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-feat-audit-'));
    const pgDir = path.join(tmpDir, 'pg-data');
    mediaDir = path.join(tmpDir, 'media');
    await fs.mkdir(mediaDir, { recursive: true });
    ffmpegPath = await resolveBin(WINGET_FFMPEG, 'ffmpeg');
    ffprobePath = await resolveBin(WINGET_FFPROBE, 'ffprobe');

    pg = new EmbeddedPostgres({
      databaseDir: pgDir,
      user: 'bosla_audit',
      password: 'bosla_audit_password',
      port: dbPort,
      persistent: false,
      initdbFlags: ['--encoding=UTF8', '--no-locale'],
      onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('bosla_feat_audit_db');

    const dbUrl = `postgresql://bosla_audit:bosla_audit_password@127.0.0.1:${dbPort}/bosla_feat_audit_db?schema=public`;
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = dbUrl;
    process.env.ALLOW_INMEMORY_REDIS = 'true';
    process.env.COOKIE_SECRET = 'bosla_audit_cookie_secret_64_characters_minimum_required';
    process.env.SESSION_SECRET = 'bosla_audit_session_secret_64_characters_minimum_required';
    process.env.RECOVERY_CODE_PEPPER = 'bosla_audit_recovery_pepper_64_characters_minimum_required';
    process.env.PLAYBACK_TOKEN_SECRET = 'bosla_audit_playback_secret_64_characters_minimum_required';
    process.env.PAYMOB_MODE = 'sandbox';
    process.env.PAYMOB_HMAC_SECRET = 'bosla_audit_paymob_hmac_secret_value';
    process.env.WEBAUTHN_RP_NAME = 'BOSLA Academy';
    process.env.WEBAUTHN_RP_ID = 'localhost';
    process.env.WEBAUTHN_ORIGIN = 'http://localhost:3000';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.CORS_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000';
    process.env.MEDIA_ROOT = mediaDir;
    process.env.FFMPEG_PATH = ffmpegPath;
    process.env.FFPROBE_PATH = ffprobePath;
    process.env.USE_NGINX_ACCEL = 'false';
    delete process.env.ASR_WHISPER_CLI_PATH;

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(currentDir, '../../..');
    const migrationsDir = path.join(repoRoot, 'packages/db/prisma/migrations');
    const migrationDirs = (await fs.readdir(migrationsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    const client = pg.getPgClient('bosla_feat_audit_db');
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

    // Ensure student (+201000000201) is ACTIVE for API tests
    await prisma.user.update({
      where: { phoneE164: '+201000000201' },
      data: { status: 'ACTIVE' },
    });
    student = await loginPhone(app, '+201000000201', 'BoslaStudent#2026');
  }, 140_000);

  afterAll(async () => {
    if (app) await app.close();
    if (pg) await pg.stop();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }, 60_000);

  it('Slice A (3.A–3.I): enforces adaptive HLS, signed session-bound playback + refresh, origin blocking, watermark policy, monotonic resume + restart, speed persistence, WebVTT subtitles (no transcript API), download policy, and meaningful watch analytics', async () => {
    const http = request(app.getHttpServer());

    // 1. Create & transcode real 720p MP4 video for instructor
    const sourcesDir = path.join(mediaDir, 'sources');
    await fs.mkdir(sourcesDir, { recursive: true });
    const mp4Path = path.join(sourcesDir, 'audit-lecture-720p.mp4');
    await execFileAsync(ffmpegPath, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=1280x720:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      mp4Path,
    ]);
    const mp4Stat = await fs.stat(mp4Path);

    const videoAsset = await prisma.videoAsset.create({
      data: {
        instructorId: instructor.user.id,
        titleAr: 'محاضرة اختبار التدقيق الشامل',
        originalFilename: 'audit-lecture-720p.mp4',
        sourcePath: 'audit-lecture-720p.mp4',
        sourceSizeBytes: BigInt(mp4Stat.size),
        status: 'QUEUED',
      },
    });

    await transcodeVideoToHls({
      prisma: prisma as any,
      videoAssetId: videoAsset.id,
      config: { mediaRoot: mediaDir, ffmpegPath, ffprobePath },
    });

    // Attach videoAsset + attachment to a published course and grant student enrollment
    const course = await prisma.course.create({
      data: {
        slug: 'audit-video-security-course',
        instructorId: instructor.user.id,
        status: 'PUBLISHED',
        isFree: false,
        priceCents: 45000,
        publishedAt: new Date(),
      },
    });
    const version = await prisma.courseVersion.create({
      data: {
        courseId: course.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        titleAr: 'كورس فحص الفيديو المتقدم',
        descriptionAr: 'وصف تفصيلي للكورس الخاص باختبارات الفيديو والحماية',
        durationMinutes: 15,
        sections: {
          create: [
            {
              titleAr: 'الوحدة الأولى',
              sortOrder: 0,
              lessons: {
                create: [
                  {
                    stableKey: 'lesson-vid-audit-1',
                    titleAr: 'الدرس الأول التطبيقي',
                    type: 'VIDEO',
                    durationSeconds: 300,
                    sortOrder: 0,
                    videoAssetId: videoAsset.id,
                  },
                ],
              },
            },
          ],
        },
      },
      include: { sections: { include: { lessons: true } } },
    });
    await prisma.course.update({
      where: { id: course.id },
      data: { publishedVersionId: version.id, draftVersionId: version.id },
    });
    const lesson = version.sections[0].lessons[0];

    await fs.mkdir(path.join(mediaDir, 'attachments', lesson.id), { recursive: true });
    const attRel = `${lesson.id}/guide.pdf`;
    await fs.writeFile(path.join(mediaDir, 'attachments', attRel), '%PDF-1.4 TEST', 'utf8');
    const attachment = await prisma.lessonAttachment.create({
      data: {
        lessonId: lesson.id,
        titleAr: 'دليل الأمان الحيوي PDF',
        storageKey: attRel,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(14),
        isDownloadable: true,
      },
    });

    await admin.agent
      .post('/api/v1/admin/enrollments/grant')
      .set('X-CSRF-Token', admin.csrf)
      .send({ userId: student.user.id, courseId: course.id })
      .expect(201);

    // 2. (3.C) Configure watermark policy via Admin API
    await admin.agent
      .put('/api/v1/admin/settings/video_watermark')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        enabled: true,
        opacity: 0.25,
        moveIntervalSeconds: 8,
        showMaskedPhone: true,
        showUserCode: true,
      })
      .expect(200);

    // 3. (3.I) Persist preferred playback speed across reloads/devices
    await student.agent
      .patch('/api/v1/learning/preferences/playback')
      .set('X-CSRF-Token', student.csrf)
      .send({ preferredPlaybackRate: 4 })
      .expect(400);

    await student.agent
      .patch('/api/v1/learning/preferences/playback')
      .set('X-CSRF-Token', student.csrf)
      .send({ preferredPlaybackRate: 1.5 })
      .expect(200);

    // 4. (3.G) Upload Arabic WebVTT subtitles + reject invalid non-VTT + trigger auto-caption BLOCKED state + verify NO transcript routes
    await instructor.agent
      .post(`/api/v1/instructor/videos/${videoAsset.id}/captions`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        language: 'ar',
        labelAr: 'العربية',
        vttContent: 'NOT A WEBVTT FILE',
      })
      .expect(400);

    const vttUpload = await instructor.agent
      .post(`/api/v1/instructor/videos/${videoAsset.id}/captions`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        language: 'ar',
        labelAr: 'العربية',
        vttContent: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nمرحباً في درس الأمان الحيوي\n',
        isDefault: true,
      })
      .expect(201);
    expect(vttUpload.body.status).toBe('READY');
    expect(vttUpload.body.cueCount).toBe(1);

    const autoEn = await instructor.agent
      .post(`/api/v1/instructor/videos/${videoAsset.id}/captions/auto-generate`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ language: 'en', labelAr: 'English (Auto)' })
      .expect(201);
    await processAutoCaptionJob({
      prisma: prisma as any,
      captionTrackId: autoEn.body.id,
      config: { mediaRoot: mediaDir, ffmpegPath, whisperCliPath: '' },
    });
    const captionsList = await instructor.agent
      .get(`/api/v1/instructor/videos/${videoAsset.id}/captions`)
      .expect(200);
    expect(captionsList.body.find((c: any) => c.language === 'en')?.status).toBe('BLOCKED');

    // Explicitly verify searchable AI transcription APIs do NOT exist
    await student.agent.get(`/api/v1/videos/${videoAsset.id}/transcript`).expect(404);
    await student.agent.get('/api/v1/transcripts/search?q=الأمان').expect(404);

    // 5. (3.D & 3.E) Create signed playback session, stream HLS + captions, block foreign Origin, refresh token
    const pbSession = await student.agent
      .post(`/api/v1/lessons/${lesson.id}/playback-session`)
      .set('X-CSRF-Token', student.csrf)
      .expect(201);

    expect(pbSession.body.preferredPlaybackRate).toBe(1.5);
    expect(pbSession.body.watermark?.enabled).toBe(true);
    expect(pbSession.body.watermark?.text).toContain('0201');
    expect(pbSession.body.watermark?.text).not.toContain('+201000000201');
    expect(pbSession.body.isDownloadable).toBe(false);
    expect(pbSession.body.captions.some((c: any) => c.language === 'ar')).toBe(true);
    expect(pbSession.body.captions.some((c: any) => c.language === 'en')).toBe(false);

    const manifestPath = pbSession.body.manifestUrl.replace(/^https?:\/\/[^/]+/, '');
    const masterRes = await http
      .get(manifestPath)
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(masterRes.text).toContain('480p/index.m3u8?token=');
    expect(masterRes.text).toContain('720p/index.m3u8?token=');

    // Foreign Origin hotlink attempt MUST fail with 403
    await http
      .get(manifestPath)
      .set('Origin', 'https://pirate-embed.example')
      .expect(403);

    // Authorized WebVTT fetch works; unauthenticated without token fails
    const arTrackUrl = pbSession.body.captions.find((c: any) => c.language === 'ar').url.replace(
      /^https?:\/\/[^/]+/,
      '',
    );
    const vttRes = await http.get(arTrackUrl).expect(200);
    expect(vttRes.text).toContain('WEBVTT');
    await http.get(`/api/v1/videos/captions/${videoAsset.id}/ar.vtt`).expect(401);

    // Silent token refresh works while session is active
    const refreshed = await student.agent
      .post(`/api/v1/lessons/${lesson.id}/playback-session/refresh`)
      .set('X-CSRF-Token', student.csrf)
      .send({ playbackSessionId: pbSession.body.playbackSessionId })
      .expect(201);
    expect(refreshed.body.token).toBeTruthy();

    // 6. (3.H) Download control enforcement for VideoAsset and LessonAttachment
    await student.agent.get(`/api/v1/videos/${videoAsset.id}/download`).expect(403);

    await instructor.agent
      .patch(`/api/v1/instructor/videos/${videoAsset.id}/download-policy`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ isDownloadable: true })
      .expect(200);

    const dlVideoOk = await student.agent
      .get(`/api/v1/videos/${videoAsset.id}/download`)
      .expect(200);
    expect(Number(dlVideoOk.headers['content-length'] || dlVideoOk.body.length)).toBeGreaterThan(100);

    // Attachment toggle: disable -> 403, re-enable -> 200
    await instructor.agent
      .patch(`/api/v1/instructor/attachments/${attachment.id}/download-policy`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ isDownloadable: false })
      .expect(200);
    await student.agent
      .get(`/api/v1/learning/attachments/${attachment.id}/download`)
      .expect(403);

    await instructor.agent
      .patch(`/api/v1/instructor/attachments/${attachment.id}/download-policy`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ isDownloadable: true })
      .expect(200);
    await student.agent
      .get(`/api/v1/learning/attachments/${attachment.id}/download`)
      .expect(200);

    // 7. (3.B) Monotonic Resume Watching + Multi-device login + Restart Lesson
    await student.agent
      .post(`/api/v1/learning/lessons/${lesson.id}/progress`)
      .set('X-CSRF-Token', student.csrf)
      .send({ watchedSeconds: 190, durationSeconds: 300, clientSequence: 10 })
      .expect(201);

    // Delayed out-of-order network packet (seq 7, watchedSeconds 40) MUST NOT overwrite 190s!
    const staleSave = await student.agent
      .post(`/api/v1/learning/lessons/${lesson.id}/progress`)
      .set('X-CSRF-Token', student.csrf)
      .send({ watchedSeconds: 40, durationSeconds: 300, clientSequence: 7 })
      .expect(201);
    expect(staleSave.body.progress.watchedSeconds).toBe(190);

    // Second device login sees exact 190s resume + 1.5x preferred speed
    const device2 = await loginPhone(app, '+201000000201', 'BoslaStudent#2026');
    const playerOnDevice2 = await device2.agent
      .get(`/api/v1/learning/courses/${course.slug}/player`)
      .expect(200);
    const lProg = playerOnDevice2.body.progress.find(
      (p: any) => p.lessonStableKey === lesson.stableKey,
    );
    expect(lProg?.watchedSeconds).toBe(190);
    expect(playerOnDevice2.body.preferredPlaybackRate).toBe(1.5);

    // Complete lesson >= 90%, then restart lesson from 0s preserving completion!
    await device2.agent
      .post(`/api/v1/learning/lessons/${lesson.id}/progress`)
      .set('X-CSRF-Token', device2.csrf)
      .send({ watchedSeconds: 280, durationSeconds: 300, clientSequence: 11 })
      .expect(201);

    const restarted = await device2.agent
      .post(`/api/v1/learning/lessons/${lesson.id}/progress`)
      .set('X-CSRF-Token', device2.csrf)
      .send({ watchedSeconds: 0, durationSeconds: 300, clientSequence: 12, resetPosition: true })
      .expect(201);
    expect(restarted.body.progress.watchedSeconds).toBe(0);
    expect(restarted.body.progress.isCompleted).toBe(true);

    // 8. (3.F) Meaningful Watch-Time Analytics (excludes pause & burst inflation)
    await student.agent
      .post(`/api/v1/lessons/${lesson.id}/playback-heartbeat`)
      .set('X-CSRF-Token', student.csrf)
      .send({
        playbackSessionId: pbSession.body.playbackSessionId,
        activeDeltaSeconds: 10,
        positionSeconds: 20,
        isPaused: false,
      })
      .expect(201);

    // Paused heartbeat adds 0s
    await student.agent
      .post(`/api/v1/lessons/${lesson.id}/playback-heartbeat`)
      .set('X-CSRF-Token', student.csrf)
      .send({
        playbackSessionId: pbSession.body.playbackSessionId,
        activeDeltaSeconds: 10,
        positionSeconds: 20,
        isPaused: true,
      })
      .expect(201);

    // Immediate burst 50ms later claiming +30s is clamped (<= 3s)
    await student.agent
      .post(`/api/v1/lessons/${lesson.id}/playback-heartbeat`)
      .set('X-CSRF-Token', student.csrf)
      .send({
        playbackSessionId: pbSession.body.playbackSessionId,
        activeDeltaSeconds: 30,
        positionSeconds: 180,
        isPaused: false,
      })
      .expect(201);

    const instAnalytics = await instructor.agent
      .get(`/api/v1/instructor/courses/${course.id}/analytics`)
      .expect(200);
    expect(instAnalytics.body.uniqueViewers).toBe(1);
    expect(instAnalytics.body.meaningfulWatchSeconds).toBeGreaterThanOrEqual(10);
    expect(instAnalytics.body.meaningfulWatchSeconds).toBeLessThanOrEqual(15);
    expect(Array.isArray(instAnalytics.body.lessonAnalytics)).toBe(true);
    expect(instAnalytics.body.lessonAnalytics[0].completionCount).toBe(1);

    // 9. (3.D) Revoking student sessions immediately invalidates previously minted signed HLS URL!
    await admin.agent
      .post(`/api/v1/admin/users/${student.user.id}/revoke-sessions`)
      .set('X-CSRF-Token', admin.csrf)
      .expect(201);

    await http
      .get(manifestPath)
      .set('Origin', 'http://localhost:3000')
      .expect(401);

    // Re-login student for subsequent slices
    student = await loginPhone(app, '+201000000201', 'BoslaStudent#2026');
  }, 90_000);

  it('Slice B (3.J, 3.K, 5): enforces quiz answer disclosure & concurrent attempt locking, quiz-gated deduplicated certificates, downloadable SVG, unified revocation verify, and all 3 certificate types including strict Accredited Program guard', async () => {
    const http = request(app.getHttpServer());

    // 1. Instructor creates a 2-attempt quiz with AFTER_PASS_OR_MAX_ATTEMPTS disclosure
    const quizRes = await instructor.agent
      .post('/api/v1/instructor/quizzes')
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        titleAr: 'اختبار الكفاءة الحقلية',
        passingScorePercent: 100,
        maxAttempts: 2,
        answerDisclosurePolicy: 'AFTER_PASS_OR_MAX_ATTEMPTS',
        questions: [
          {
            questionTextAr: 'ما درجة حرارة التحضين المثلى في اليوم الأول؟',
            options: [
              { id: 'opt1', textAr: '33 درجة مئوية' },
              { id: 'opt2', textAr: '20 درجة مئوية' },
            ],
            correctOptionId: 'opt1',
            explanationAr: 'الكتكوت يحتاج 33 مئوية في عمر يوم لضبط حرارة الجسم.',
            points: 10,
            sortOrder: 0,
          },
        ],
      })
      .expect(201);
    const quizId = quizRes.body.id;
    const questionId = quizRes.body.questions[0].id;

    // Create published course requiring quiz pass for completion certificate
    const certCourse = await prisma.course.create({
      data: {
        slug: 'audit-quiz-cert-course',
        instructorId: instructor.user.id,
        status: 'PUBLISHED',
        isFree: true,
        requireQuizPassForCertificate: true,
        publishedAt: new Date(),
      },
    });
    const certVer = await prisma.courseVersion.create({
      data: {
        courseId: certCourse.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        titleAr: 'دورة التحضين والاختبارات',
        descriptionAr: 'دورة متكاملة لاختبار بوابة الاختبارات وأنواع الشهادات الثلاثة',
        durationMinutes: 20,
        sections: {
          create: [
            {
              titleAr: 'القسم التطبيقي',
              sortOrder: 0,
              lessons: {
                create: [
                  {
                    stableKey: 'les-cert-quiz-1',
                    titleAr: 'الدرس التطبيقي مع الاختبار',
                    type: 'QUIZ',
                    durationSeconds: 120,
                    sortOrder: 0,
                    quizId,
                  },
                ],
              },
            },
          ],
        },
      },
      include: { sections: { include: { lessons: true } } },
    });
    await prisma.course.update({
      where: { id: certCourse.id },
      data: { publishedVersionId: certVer.id, draftVersionId: certVer.id },
    });
    const quizLessonId = certVer.sections[0].lessons[0].id;

    // Complete 100% of lesson progress BEFORE passing quiz -> NO certificate issued yet!
    const progBeforeQuiz = await student.agent
      .post(`/api/v1/learning/lessons/${quizLessonId}/progress`)
      .set('X-CSRF-Token', student.csrf)
      .send({ watchedSeconds: 120, durationSeconds: 120, isCompleted: true })
      .expect(201);
    expect(progBeforeQuiz.body.issuedCertificate).toBeNull();

    // 2. Attempt 1 (Failed) -> answers MUST NOT be disclosed yet!
    const fail1 = await student.agent
      .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
      .set('X-CSRF-Token', student.csrf)
      .send({
        answers: { [questionId]: 'opt2' },
        idempotencyKey: 'idem-fail-1',
      })
      .expect(201);
    expect(fail1.body.passed).toBe(false);
    expect(fail1.body.answersDisclosed).toBe(false);
    expect(fail1.body.feedback[0].correctOptionId).toBeNull();
    expect(fail1.body.feedback[0].explanationAr).toBeNull();

    // Duplicate retry with identical idempotencyKey returns existing attempt without burning Attempt 2!
    const fail1Dup = await student.agent
      .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
      .set('X-CSRF-Token', student.csrf)
      .send({
        answers: { [questionId]: 'opt2' },
        idempotencyKey: 'idem-fail-1',
      })
      .expect(201);
    expect(fail1Dup.body.attempt.id).toBe(fail1.body.attempt.id);

    // 3. Fire TWO concurrent distinct attempts when only 1 attempt (2 - 1 = 1) remains -> ONLY ONE succeeds!
    const [raceA, raceB] = await Promise.all([
      student.agent
        .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
        .set('X-CSRF-Token', student.csrf)
        .send({ answers: { [questionId]: 'opt2' }, idempotencyKey: 'idem-race-a' }),
      student.agent
        .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
        .set('X-CSRF-Token', student.csrf)
        .send({ answers: { [questionId]: 'opt2' }, idempotencyKey: 'idem-race-b' }),
    ]);
    const statuses = [raceA.status, raceB.status].sort();
    expect(statuses).toEqual([201, 400]);

    // Exhausted maxAttempts (2/2) -> winning Attempt 2 discloses correctOptionId & explanationAr!
    const winner = raceA.status === 201 ? raceA : raceB;
    expect(winner.body.answersDisclosed).toBe(true);
    expect(winner.body.feedback[0].correctOptionId).toBe('opt1');
    expect(winner.body.feedback[0].explanationAr).toContain('33');

    // 4. Instructor bumps maxAttempts to 3 -> Student passes -> Concurrent progress calls still yield ONLY 1 certificate!
    await instructor.agent
      .patch(`/api/v1/instructor/quizzes/${quizId}`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        titleAr: 'اختبار الكفاءة الحقلية',
        passingScorePercent: 100,
        maxAttempts: 3,
        answerDisclosurePolicy: 'AFTER_PASS_OR_MAX_ATTEMPTS',
        questions: [
          {
            questionTextAr: 'ما درجة حرارة التحضين المثلى في اليوم الأول؟',
            options: [
              { id: 'opt1', textAr: '33 درجة مئوية' },
              { id: 'opt2', textAr: '20 درجة مئوية' },
            ],
            correctOptionId: 'opt1',
            explanationAr: 'الكتكوت يحتاج 33 مئوية في عمر يوم لضبط حرارة الجسم.',
            points: 10,
            sortOrder: 0,
          },
        ],
      })
      .expect(200);

    const refreshedPlayer = await student.agent
      .get(`/api/v1/learning/courses/${certCourse.slug}/player`)
      .expect(200);
    const updatedQId = refreshedPlayer.body.sections[0].lessons[0].quiz.questions[0].id;

    const passRes = await student.agent
      .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
      .set('X-CSRF-Token', student.csrf)
      .send({ answers: { [updatedQId]: 'opt1' }, idempotencyKey: 'idem-pass-3' })
      .expect(201);
    expect(passRes.body.passed).toBe(true);
    expect(passRes.body.issuedCertificate).toBeTruthy();
    expect(passRes.body.issuedCertificate.kind).toBe('ATTENDANCE_COMPLETION');
    const completionCode = passRes.body.issuedCertificate.certificateCode;
    const completionId = passRes.body.issuedCertificate.id;

    // Fire 4 parallel progress completions to test duplicate race protection
    await Promise.all(
      [1, 2, 3, 4].map((i) =>
        student.agent
          .post(`/api/v1/learning/lessons/${quizLessonId}/progress`)
          .set('X-CSRF-Token', student.csrf)
          .send({ watchedSeconds: 120, durationSeconds: 120, isCompleted: true, clientSequence: 20 + i }),
      ),
    );
    const activeCompletionCerts = await prisma.certificate.count({
      where: {
        userId: student.user.id,
        courseId: certCourse.id,
        kind: 'ATTENDANCE_COMPLETION',
        revokedAt: null,
      },
    });
    expect(activeCompletionCerts).toBe(1);

    // 5. Downloadable SVG document works while valid; public verify endpoints match
    const svgRes = await http
      .get(`/api/v1/lms/certificates/${encodeURIComponent(completionCode)}/download.svg`)
      .expect(200);
    const svgBody = Buffer.isBuffer(svgRes.body) ? svgRes.body.toString('utf8') : svgRes.text;
    expect(svgBody).toContain('<svg');
    expect(svgBody).toContain(completionCode);

    // 6. Type 2: Professional Training Certificate (COMPETENCY)
    const compReq = await student.agent
      .post('/api/v1/learning/competency-requests')
      .set('X-CSRF-Token', student.csrf)
      .send({
        targetType: 'COURSE',
        courseId: certCourse.id,
        studentNotesAr: 'أتممت التطبيق الحقلي والاختبار بنسبة 100%',
      })
      .expect(201);

    const compRev = await instructor.agent
      .post(`/api/v1/instructor/competency-requests/${compReq.body.id}/review`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ decision: 'APPROVE', reviewNotesAr: 'معتمد للتدريب المهني' })
      .expect(201);
    expect(compRev.body.certificate.kind).toBe('COMPETENCY');

    // 7. Type 3: Accredited Program Certificate (ACCREDITED_PROGRAM) — disabled until real body configured!
    await admin.agent
      .post('/api/v1/admin/certificates/issue')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        userId: student.user.id,
        targetType: 'COURSE',
        courseId: certCourse.id,
        kind: 'ACCREDITED_PROGRAM',
      })
      .expect(400);

    // Reject enabling ACCREDITED_PROGRAM template without accrediting organization name & authorizationRef
    await admin.agent
      .post('/api/v1/lms/certificates/templates')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        key: 'accredited-incomplete',
        nameAr: 'قالب اعتماد ناقص',
        kind: 'ACCREDITED_PROGRAM',
        headlineAr: 'شهادة برنامج معتمد',
        bodyTemplateAr: 'يشهد بأن المتدرب أتم البرنامج المعتمد.',
        accreditationEnabled: true,
      })
      .expect(400);

    // Configure authentic test accrediting body on template -> issuance succeeds and snapshots body!
    const accTpl = await admin.agent
      .post('/api/v1/lms/certificates/templates')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        key: 'accredited-agri-council',
        nameAr: 'قالب الاعتماد المهني المشترك',
        kind: 'ACCREDITED_PROGRAM',
        headlineAr: 'شهادة برنامج تدريبي معتمد',
        bodyTemplateAr: 'تم إتمام البرنامج وفق معايير الاعتماد المشترك.',
        accreditationEnabled: true,
        accreditingBodyNameAr: 'المجلس المهني للتدريب الزراعي (بيئة اختبار)',
        accreditingBodyCode: 'ATC-EG-TEST',
        authorizationRef: 'AUTH-2026-778',
        issuerNameAr: 'أكاديمية بوصلة للتدريب البيطري والزراعي',
        isDefault: true,
      })
      .expect(201);

    const accCertRes = await admin.agent
      .post('/api/v1/admin/certificates/issue')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        userId: student.user.id,
        targetType: 'COURSE',
        courseId: certCourse.id,
        kind: 'ACCREDITED_PROGRAM',
        templateId: accTpl.body.id,
      })
      .expect(201);
    expect(accCertRes.body.kind).toBe('ACCREDITED_PROGRAM');
    expect(accCertRes.body.accreditingBodyNameAr).toContain('المجلس المهني');
    expect(accCertRes.body.authorizationRef).toBe('AUTH-2026-778');

    const accVerify = await http
      .get(`/api/v1/learning/certificates/verify/${encodeURIComponent(accCertRes.body.certificateCode)}`)
      .expect(200);
    expect(accVerify.body.isValid).toBe(true);
    expect(accVerify.body.kind).toBe('ACCREDITED_PROGRAM');
    expect(accVerify.body.accreditingBodyNameAr).toContain('المجلس المهني');

    // 8. Revoking completion certificate reflects REVOKED status consistently on BOTH verify endpoints & blocks SVG download
    await admin.agent
      .post(`/api/v1/lms/certificates/${completionId}/revoke`)
      .set('X-CSRF-Token', admin.csrf)
      .send({ reasonAr: 'اختبار سحب الشهادة والتحقق العلني' })
      .expect(201);

    const verifyLmsRevoked = await http
      .get(`/api/v1/lms/certificates/${encodeURIComponent(completionCode)}/verify`)
      .expect(200);
    const verifyLearnRevoked = await http
      .get(`/api/v1/learning/certificates/verify/${encodeURIComponent(completionCode)}`)
      .expect(200);
    expect(verifyLmsRevoked.body.isValid).toBe(false);
    expect(verifyLmsRevoked.body.status).toBe('REVOKED');
    expect(verifyLearnRevoked.body.isValid).toBe(false);
    expect(verifyLearnRevoked.body.status).toBe('REVOKED');

    await http
      .get(`/api/v1/lms/certificates/${encodeURIComponent(completionCode)}/download.svg`)
      .expect(410);
  }, 90_000);

  it('Slice C (4.A–4.E): enforces coupons across diplomas/plans/courses with per-user & stacking limits, duplicate standalone purchase block, Paymob currency & out-of-order webhook guards, and atomic B2B seat lock + revocation preserving personal purchases', async () => {
    const http = request(app.getHttpServer());

    // Create two fresh active learners for clean commercial & B2B concurrency tests
    const createActiveLearner = async (suffix: string, phone: string) => {
      const created = await admin.agent
        .post('/api/v1/admin/users')
        .set('X-CSRF-Token', admin.csrf)
        .send({
          fullName: `متدرب تجاري ${suffix}`,
          phoneNumber: phone,
          countryCode: '+20',
          email: `audit.${suffix}@bosla-test.local`,
          password: 'BoslaLearner#2026',
          role: 'STUDENT',
          status: 'ACTIVE',
        })
        .expect(201);
      const session = await loginPhone(app, phone, 'BoslaLearner#2026');
      return { ...session, email: created.body.email as string };
    };

    const buyer1 = await createActiveLearner('one', '+201099887701');
    const buyer2 = await createActiveLearner('two', '+201099887702');
    const buyer3 = await createActiveLearner('three', '+201099887703');

    // 1. (4.E) Verify public payment gateway config exposes provider, currency, and configured methods
    const payCfg = await http.get('/api/v1/payments/config').expect(200);
    expect(payCfg.body.currency).toBe('EGP');
    expect(Array.isArray(payCfg.body.enabledMethods)).toBe(true);
    expect(typeof payCfg.body.autoRenewSupported).toBe('boolean');

    // 2. (4.B & 4.C) Create a Diploma-scoped coupon with perUserLimit=1, apply on standalone Diploma checkout, block wrong target & second use!
    const diploma = await prisma.diploma.findFirstOrThrow({
      where: { status: 'PUBLISHED' },
    });
    const plan = await prisma.membershipPlan.findFirstOrThrow({
      where: { isActive: true, interval: 'MONTHLY' },
    });

    const dipCoupon = await admin.agent
      .post('/api/v1/commerce/admin/coupons')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        code: 'DIP25AUDIT',
        discountType: 'PERCENT',
        discountValue: 25,
        maxDiscountAmount: 400,
        applicableTargetType: 'DIPLOMA',
        applicableDiplomaId: diploma.id,
        perUserLimit: 1,
        usageLimit: 5,
        isActive: true,
      })
      .expect(201);
    expect(dipCoupon.body.applicableTargetType).toBe('DIPLOMA');

    // Diploma coupon MUST be rejected when applied to a Membership Plan!
    await buyer1.agent
      .post('/api/v1/memberships/checkout')
      .set('X-CSRF-Token', buyer1.csrf)
      .send({ planId: plan.id, couponCode: 'DIP25AUDIT' })
      .expect(400);

    // Preview & initiate standalone Diploma checkout with DIP25AUDIT
    const dipPreview = await buyer1.agent
      .post('/api/v1/memberships/checkout-item/preview')
      .set('X-CSRF-Token', buyer1.csrf)
      .send({ targetType: 'DIPLOMA', targetId: diploma.id, couponCode: 'DIP25AUDIT' })
      .expect(201);
    expect(dipPreview.body.discountCents).toBeGreaterThan(0);
    expect(dipPreview.body.finalAmountCents).toBe(
      diploma.priceCents - dipPreview.body.discountCents,
    );

    const dipInit = await buyer1.agent
      .post('/api/v1/memberships/checkout-item')
      .set('X-CSRF-Token', buyer1.csrf)
      .send({ targetType: 'DIPLOMA', targetId: diploma.id, couponCode: 'DIP25AUDIT' })
      .expect(201);
    expect(dipInit.body.amountCents).toBe(dipPreview.body.finalAmountCents);

    // 3. (4.E) Paymob Webhook Currency Mismatch MUST be rejected and NOT grant entitlement!
    const { PaymobClient } = await import('../src/modules/membership/paymob.client');
    const paymobClient = new PaymobClient();
    const txRow = await prisma.paymentTransaction.findUniqueOrThrow({
      where: { merchantOrderId: dipInit.body.merchantOrderId },
    });

    const badCurrencyObj = {
      id: 777001,
      amount_cents: txRow.amountCents,
      currency: 'USD',
      success: true,
      pending: false,
      is_refunded: false,
      is_voided: false,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_standalone_payment: true,
      has_parent_transaction: false,
      error_occured: false,
      created_at: new Date().toISOString(),
      integration_id: 100,
      owner: 1,
      order: { id: 888001, merchant_order_id: txRow.merchantOrderId },
      source_data: { pan: '1111', sub_type: 'Visa', type: 'card' },
    };
    const badCurrHmac = paymobClient.computeTransactionHmac(
      badCurrencyObj,
      process.env.PAYMOB_HMAC_SECRET!,
    );
    await http
      .post(`/api/v1/payments/paymob/webhook?hmac=${badCurrHmac}`)
      .send({ type: 'TRANSACTION', obj: badCurrencyObj })
      .expect(400);

    // Confirm legitimate sandbox EGP payment -> grants Diploma DirectPurchase!
    await buyer1.agent
      .post('/api/v1/payments/paymob/sandbox-simulate')
      .set('X-CSRF-Token', buyer1.csrf)
      .send({ merchantOrderId: dipInit.body.merchantOrderId, outcome: 'PAID' })
      .expect(201);

    // Out-of-order delayed FAILED webhook arriving AFTER PAID must NOT downgrade PAID status!
    const staleFailedObj = {
      ...badCurrencyObj,
      id: 777002,
      currency: 'EGP',
      success: false,
      error_occured: true,
    };
    const staleHmac = paymobClient.computeTransactionHmac(
      staleFailedObj,
      process.env.PAYMOB_HMAC_SECRET!,
    );
    await http
      .post(`/api/v1/payments/paymob/webhook?hmac=${staleHmac}`)
      .send({ type: 'TRANSACTION', obj: staleFailedObj })
      .expect(201);

    const txAfterStale = await prisma.paymentTransaction.findUniqueOrThrow({
      where: { id: txRow.id },
    });
    expect(txAfterStale.status).toBe('PAID');

    // Duplicate standalone purchase of ALREADY-OWNED Diploma MUST be rejected (400)!
    await buyer1.agent
      .post('/api/v1/memberships/checkout-item')
      .set('X-CSRF-Token', buyer1.csrf)
      .send({ targetType: 'DIPLOMA', targetId: diploma.id })
      .expect(400);

    // Per-user limit = 1 exhausted on DIP25AUDIT (even if another diploma existed, test with plan coupon perUserLimit=1)
    await admin.agent
      .post('/api/v1/commerce/admin/coupons')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        code: 'PLAN20ONCE',
        discountType: 'PERCENT',
        discountValue: 20,
        applicableTargetType: 'MEMBERSHIP_PLAN',
        applicablePlanId: plan.id,
        perUserLimit: 1,
        isActive: true,
      })
      .expect(201);

    const subInit = await buyer1.agent
      .post('/api/v1/memberships/checkout')
      .set('X-CSRF-Token', buyer1.csrf)
      .send({ planId: plan.id, couponCode: 'PLAN20ONCE' })
      .expect(201);
    expect(subInit.body.amountCents).toBe(Math.round(plan.priceCents * 0.8));

    await buyer1.agent
      .post('/api/v1/payments/paymob/sandbox-simulate')
      .set('X-CSRF-Token', buyer1.csrf)
      .send({ merchantOrderId: subInit.body.merchantOrderId, outcome: 'PAID' })
      .expect(201);

    // Second attempt by buyer1 using PLAN20ONCE MUST fail perUserLimit=1!
    await buyer1.agent
      .post('/api/v1/memberships/checkout')
      .set('X-CSRF-Token', buyer1.csrf)
      .send({ planId: plan.id, couponCode: 'PLAN20ONCE' })
      .expect(400);

    // 4. (4.A) Expiring buyer1's subscription revokes membership-only courses while KEEPING paid Diploma courses!
    await prisma.subscription.updateMany({
      where: { userId: buyer1.user.id },
      data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
    });
    const summaryAfterExpiry = await buyer1.agent.get('/api/v1/memberships/me').expect(200);
    expect(summaryAfterExpiry.body.activeSubscription).toBeNull();
    expect(summaryAfterExpiry.body.entitledDiplomaIds).toContain(diploma.id);

    // 5. (4.C) Stacking rule: coupon with allowSellerStacking=false rejects combining with sellerCode in Cart Order!
    const paidCourse = await prisma.course.findFirstOrThrow({
      where: { status: 'PUBLISHED', isFree: false, allowIndividualPurchase: true, priceCents: { gt: 0 } },
    });
    const sellerCodeRow = await prisma.sellerCode.findFirst({ where: { isActive: true } });
    if (sellerCodeRow) {
      await admin.agent
        .post('/api/v1/commerce/admin/coupons')
        .set('X-CSRF-Token', admin.csrf)
        .send({
          code: 'NOSTACK15',
          discountType: 'PERCENT',
          discountValue: 15,
          applicableTargetType: 'COURSE',
          applicableCourseId: paidCourse.id,
          allowSellerStacking: false,
          isActive: true,
        })
        .expect(201);

      await buyer2.agent
        .post('/api/v1/commerce/orders/preview')
        .set('X-CSRF-Token', buyer2.csrf)
        .send({
          courseIds: [paidCourse.id],
          couponCode: 'NOSTACK15',
          sellerCode: sellerCodeRow.code,
        })
        .expect(400);
    }

    // 6. (4.D) Institution Packages: atomic seatCapacity lock under concurrency + auto contract courses + seat revocation preserving personal purchase!
    // First, buyer2 personally buys paidCourse standalone
    const personalBuy = await buyer2.agent
      .post('/api/v1/memberships/checkout-item')
      .set('X-CSRF-Token', buyer2.csrf)
      .send({ targetType: 'COURSE', targetId: paidCourse.id })
      .expect(201);
    await buyer2.agent
      .post('/api/v1/payments/paymob/sandbox-simulate')
      .set('X-CSRF-Token', buyer2.csrf)
      .send({ merchantOrderId: personalBuy.body.merchantOrderId, outcome: 'PAID' })
      .expect(201);

    const orgCourseOnly = await prisma.course.create({
      data: {
        slug: 'audit-b2b-contract-only-course',
        instructorId: instructor.user.id,
        status: 'PUBLISHED',
        isFree: false,
        includedInMembership: false,
        priceCents: 60000,
        publishedAt: new Date(),
      },
    });
    const orgCourseVer = await prisma.courseVersion.create({
      data: {
        courseId: orgCourseOnly.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        titleAr: 'دورة التعاقد المؤسسي المغلقة',
        descriptionAr: 'دورة مخصصة لمتدربي المؤسسة المتعاقدة فقط',
        durationMinutes: 30,
      },
    });
    await prisma.course.update({
      where: { id: orgCourseOnly.id },
      data: { publishedVersionId: orgCourseVer.id, draftVersionId: orgCourseVer.id },
    });

    const orgRes = await admin.agent
      .post('/api/v1/organizations')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        nameAr: 'شركة الدلتا الزراعية للاختبار',
        type: 'COMPANY',
        contactNameAr: 'م. طارق',
        contactPhone: '+201055551111',
        seatCapacity: 1,
      })
      .expect(201);
    const orgId = orgRes.body.id;

    await admin.agent
      .post('/api/v1/organizations/contracts')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        organizationId: orgId,
        titleAr: 'عقد تدريب مهندسي الدلتا',
        quotationAmountEgp: 15000,
        discountPercent: 20,
        validFrom: new Date(Date.now() - 86400_000).toISOString(),
        assignedCourseIds: [orgCourseOnly.id, paidCourse.id],
      })
      .expect(201);

    // Fire 2 concurrent seat assignments into seatCapacity=1 (using email identifier & userId) -> ONLY 1 succeeds!
    const [seatA, seatB] = await Promise.all([
      admin.agent
        .post(`/api/v1/organizations/${orgId}/members`)
        .set('X-CSRF-Token', admin.csrf)
        .send({ identifier: buyer2.email, orgRole: 'LEARNER', departmentAr: 'الإنتاج' }),
      admin.agent
        .post(`/api/v1/organizations/${orgId}/members`)
        .set('X-CSRF-Token', admin.csrf)
        .send({ userId: buyer3.user.id, orgRole: 'LEARNER', departmentAr: 'الجودة' }),
    ]);
    expect([seatA.status, seatB.status].sort()).toEqual([201, 400]);

    const seatedBuyer = seatA.status === 201 ? buyer2 : buyer3;
    const unseatedBuyer = seatA.status === 201 ? buyer3 : buyer2;

    // Seated member automatically received entitlement to contracted orgCourseOnly!
    const seatedSummary = await seatedBuyer.agent.get('/api/v1/memberships/me').expect(200);
    expect(seatedSummary.body.entitledCourseIds).toContain(orgCourseOnly.id);

    // Revoke seated member's seat -> frees seat for unseatedBuyer, revokes orgCourseOnly, AND preserves buyer2's personal paidCourse!
    await admin.agent
      .delete(`/api/v1/organizations/${orgId}/members/${seatedBuyer.user.id}`)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);

    const revokedSummary = await seatedBuyer.agent.get('/api/v1/memberships/me').expect(200);
    expect(revokedSummary.body.entitledCourseIds).not.toContain(orgCourseOnly.id);
    if (seatedBuyer.user.id === buyer2.user.id) {
      expect(revokedSummary.body.entitledCourseIds).toContain(paidCourse.id);
    }

    // Freed seat can now be assigned to unseatedBuyer!
    await admin.agent
      .post(`/api/v1/organizations/${orgId}/members`)
      .set('X-CSRF-Token', admin.csrf)
      .send({ userId: unseatedBuyer.user.id, orgRole: 'LEARNER' })
      .expect(201);
  }, 110_000);
});
