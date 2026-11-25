import 'reflect-metadata';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma.service';
import { configureApp } from '../src/main';

const execFileAsync = promisify(execFile);

function makeTestGoogleToken(payload: { sub: string; email?: string; name?: string; emailVerified?: boolean }) {
  const secret =
    process.env.SESSION_SECRET ||
    'bosla_test_session_secret_64_characters_minimum_required';
  const body = Buffer.from(JSON.stringify({ emailVerified: true, ...payload }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `bosla-test-google.${body}.${sig}`;
}

async function loginSeededPhone(
  app: INestApplication,
  phoneNumber: string,
  password: string,
) {
  const agent = request.agent(app.getHttpServer());
  const loginRes = await agent
    .post('/api/v1/auth/login/phone')
    .send({ phoneNumber, countryCode: '+20', password })
    .expect(201);
  return {
    agent,
    csrf: loginRes.body.csrfToken as string,
    user: loginRes.body.user,
  };
}

describe('BOSLA Academy Course Community, Lesson Q&A & Security Integration', () => {
  let pg: EmbeddedPostgres;
  let tmpDir = '';
  let app: INestApplication;
  let prisma: PrismaService;
  const dbPort = 54349;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-community-int-'));
    const pgDir = path.join(tmpDir, 'pg-data');
    const mediaDir = path.join(tmpDir, 'media');
    await fs.mkdir(mediaDir, { recursive: true });

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
    await pg.createDatabase('bosla_community_test');

    const dbUrl = `postgresql://bosla_test:bosla_test_password@127.0.0.1:${dbPort}/bosla_community_test?schema=public`;
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
    process.env.USE_NGINX_ACCEL = 'false';

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(currentDir, '../../..');
    const migrationsDir = path.join(repoRoot, 'packages/db/prisma/migrations');
    const migrationDirs = (await fs.readdir(migrationsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const client = pg.getPgClient('bosla_community_test');
    await client.connect();
    for (const dirName of migrationDirs) {
      const sql = await fs.readFile(path.join(migrationsDir, dirName, 'migration.sql'), 'utf8');
      await client.query(sql);
    }
    await client.end();

    const seedPath = path.join(repoRoot, 'packages/db/prisma/seed.ts');
    const tsxBin = path.join(
      repoRoot,
      'node_modules/.bin/' + (process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
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

  it('enforces all 6 community access rules, course sharing across plans, role boundaries, and expired membership blocking', async () => {
    const http = request(app.getHttpServer());

    const poultryCourse = await prisma.course.findUniqueOrThrow({
      where: { slug: 'poultry-farm-management' },
      include: {
        publishedVersion: {
          include: {
            sections: { include: { lessons: true } },
          },
        },
      },
    });
    const draftCourse = await prisma.course.upsert({
      where: { slug: 'community-unpublished-test-course' },
      update: {},
      create: {
        slug: 'community-unpublished-test-course',
        instructorId: poultryCourse.instructorId,
        categoryId: poultryCourse.categoryId,
        status: 'DRAFT',
      },
    });

    // 1. Unauthenticated caller cannot view private posts; access info reports NOT_AUTHENTICATED
    const anonAccess = await http
      .get(`/api/v1/community/courses/${poultryCourse.slug}/access`)
      .expect(200);
    expect(anonAccess.body.access.allowed).toBe(false);
    expect(anonAccess.body.access.reason).toBe('NOT_AUTHENTICATED');

    await http.get(`/api/v1/community/courses/${poultryCourse.slug}/posts`).expect(401);

    // 2. Fresh student without active membership -> NO_ACTIVE_MEMBERSHIP
    const freshAgent = request.agent(app.getHttpServer());
    const reg = await freshAgent
      .post('/api/v1/auth/google')
      .send({
        credential: makeTestGoogleToken({
          sub: 'community-sub-student-new',
          email: 'community.student@boslaagri.com',
          name: 'د. كريم محمود',
        }),
      })
      .expect(201);
    const freshCsrf = reg.body.csrfToken as string;
    const freshUserId = reg.body.user.id as string;

    const noSubAccess = await freshAgent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/access`)
      .expect(200);
    expect(noSubAccess.body.access.allowed).toBe(false);
    expect(noSubAccess.body.access.reason).toBe('NO_ACTIVE_MEMBERSHIP');
    await freshAgent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .expect(403);

    // 3. Grant monthly subscription (entitled, NOT yet enrolled/started) -> NOT_ENROLLED
    const monthlyPlan = await prisma.membershipPlan.findFirstOrThrow({
      where: { interval: 'MONTHLY' },
    });
    const freshSub = await prisma.subscription.create({
      data: {
        userId: freshUserId,
        planId: monthlyPlan.id,
        planRevisionId: monthlyPlan.currentRevisionId!,
        status: 'ACTIVE',
        currentPeriodStart: new Date(Date.now() - 3600_000),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
      },
    });

    const notStartedAccess = await freshAgent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/access`)
      .expect(200);
    expect(notStartedAccess.body.access.allowed).toBe(false);
    expect(notStartedAccess.body.access.reason).toBe('NOT_ENROLLED');

    await freshAgent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .expect(403);

    // 4. Enroll via POST /learning/courses/:courseId/enroll -> allowed & shares same community with annual demoStudent!
    await freshAgent
      .post(`/api/v1/learning/courses/${poultryCourse.id}/enroll`)
      .set('X-CSRF-Token', freshCsrf)
      .expect(201);

    const enrolledFeed = await freshAgent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .expect(200);
    expect(enrolledFeed.body.items.length).toBeGreaterThan(0);

    // Also verify annual demoStudent sees posts created by monthly freshStudent inside ONE shared community
    const monthlyPost = await freshAgent
      .post(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .set('X-CSRF-Token', freshCsrf)
      .send({
        type: 'DISCUSSION',
        title: 'نقاش مشترك بين المشترك الشهري والسنوي',
        body: 'هل يوجد فرق في مجتمع الكورس حسب نوع الباقة؟ لا، مجتمع واحد.',
      })
      .expect(201);

    const annualStudent = await loginSeededPhone(app, '01000000201', 'BoslaStudent#2026');
    const annualDetail = await annualStudent.agent
      .get(`/api/v1/community/posts/${monthlyPost.body.id}`)
      .expect(200);
    expect(annualDetail.body.post.id).toBe(monthlyPost.body.id);

    // Zero PII exposed on community author payloads
    const serializedAuthor = JSON.stringify(annualDetail.body.post.author);
    expect(serializedAuthor).not.toContain('phoneE164');
    expect(serializedAuthor).not.toContain('email');
    expect(serializedAuthor).not.toContain('passwordHash');
    expect(serializedAuthor).not.toContain('community.student@boslaagri.com');

    // 5. Unpublished course is denied to students even with subscription
    await freshAgent
      .get(`/api/v1/community/courses/${draftCourse.id}/posts`)
      .expect(403);

    // 6. Instructor role boundaries: owner allowed, OTHER instructor denied (403)
    const ownerInstructor = await loginSeededPhone(app, '01000000101', 'BoslaInstructor#2026');
    const otherInstructor = await loginSeededPhone(app, '01000000102', 'BoslaInstructor#2026');

    await ownerInstructor.agent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .expect(200);
    await otherInstructor.agent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .expect(403);

    // 7. Expired membership immediately blocks private access WHILE preserving historical post data!
    await prisma.subscription.update({
      where: { id: freshSub.id },
      data: {
        status: 'EXPIRED',
        currentPeriodEnd: new Date(Date.now() - 60_000),
      },
    });

    const expiredAccess = await freshAgent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/access`)
      .expect(200);
    expect(expiredAccess.body.access.allowed).toBe(false);
    expect(expiredAccess.body.access.reason).toBe('MEMBERSHIP_EXPIRED');

    await freshAgent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .expect(403);
    await freshAgent
      .get(`/api/v1/community/posts/${monthlyPost.body.id}`)
      .expect(403);

    // Verify historical post is still preserved in database and readable by owner instructor
    const instructorReadAfterExpiry = await ownerInstructor.agent
      .get(`/api/v1/community/posts/${monthlyPost.body.id}`)
      .expect(200);
    expect(instructorReadAfterExpiry.body.post.id).toBe(monthlyPost.body.id);
  });

  it('runs complete Lesson Q&A lifecycle, video timestamp navigation, instructor badge, accept answer, reactions, reports, notifications, and admin moderation', async () => {
    const admin = await loginSeededPhone(app, '01000000001', 'BoslaAdmin#2026');
    const instructor = await loginSeededPhone(app, '01000000101', 'BoslaInstructor#2026');
    const student = await loginSeededPhone(app, '01000000201', 'BoslaStudent#2026');

    const poultryCourse = await prisma.course.findUniqueOrThrow({
      where: { slug: 'poultry-farm-management' },
      include: {
        publishedVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: 'asc' },
              include: { lessons: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    const otherCourse = await prisma.course.findUniqueOrThrow({
      where: { slug: 'biosecurity-fundamentals' },
      include: {
        publishedVersion: {
          include: {
            sections: { include: { lessons: true } },
          },
        },
      },
    });

    const targetLessonRaw = poultryCourse.publishedVersion!.sections[0].lessons[1];
    const testVideoAsset = await prisma.videoAsset.upsert({
      where: { id: 'seed-community-test-video-asset' },
      update: { status: 'READY', durationSeconds: 780 },
      create: {
        id: 'seed-community-test-video-asset',
        instructorId: poultryCourse.instructorId,
        titleAr: 'فيديو اختباري لدرس استقبال الكتكوت',
        originalFilename: 'poultry-reception.mp4',
        sourcePath: 'uploads/test/poultry-reception.mp4',
        sourceSizeBytes: BigInt(1024000),
        status: 'READY',
        durationSeconds: 780,
      },
    });
    const targetLesson = await prisma.lesson.update({
      where: { id: targetLessonRaw.id },
      data: {
        type: 'VIDEO',
        durationSeconds: 780,
        videoAssetId: testVideoAsset.id,
      },
    });
    const otherCourseLesson = otherCourse.publishedVersion!.sections[0].lessons[0];

    // 1. Validate cross-course lessonId & invalid/excessive timestamp rejections
    await student.agent
      .post(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .set('X-CSRF-Token', student.csrf)
      .send({
        lessonId: otherCourseLesson.id,
        type: 'QUESTION',
        title: 'محاولة ربط درس من كورس آخر',
        body: 'يجب رفض ربط درس من كورس مختلف نهائيًا',
      })
      .expect(400);

    await student.agent
      .post(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .set('X-CSRF-Token', student.csrf)
      .send({
        lessonId: targetLesson.id,
        type: 'QUESTION',
        title: 'وقت فيديو يتجاوز مدة الدرس الفعلية',
        body: 'هذا التوقيت غير منطقي ويجب رفضه',
        videoTimestampSeconds: (targetLesson.durationSeconds || 100) + 500,
      })
      .expect(400);

    // 2. Student asks Lesson Q&A with valid video timestamp and XSS payload sanitized cleanly
    const createdQuestion = await student.agent
      .post(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .set('X-CSRF-Token', student.csrf)
      .send({
        lessonId: targetLesson.id,
        type: 'QUESTION',
        title: 'استفسار التهوية <script>alert(1)</script> عند الدقيقة',
        body: 'لماذا نرفع سرعة الشفاطات تدريجيًا؟ <b>تفاصيل</b>',
        videoTimestampSeconds: 45,
      })
      .expect(201);

    expect(createdQuestion.body.lessonId).toBe(targetLesson.id);
    expect(createdQuestion.body.videoTimestampSeconds).toBe(45);
    expect(createdQuestion.body.videoTimestampLabel).toBe('00:45');
    expect(createdQuestion.body.title).not.toContain('<script>');
    expect(createdQuestion.body.body).not.toContain('<b>');

    // Question appears inside BOTH lesson Q&A filter AND unified course community "lesson_questions"
    const lessonFeed = await student.agent
      .get(
        `/api/v1/community/courses/${poultryCourse.slug}/posts?lessonId=${targetLesson.id}`,
      )
      .expect(200);
    expect(
      lessonFeed.body.items.some((p: any) => p.id === createdQuestion.body.id),
    ).toBe(true);

    const unifiedLessonQFilter = await student.agent
      .get(
        `/api/v1/community/courses/${poultryCourse.slug}/posts?filter=lesson_questions`,
      )
      .expect(200);
    expect(
      unifiedLessonQFilter.body.items.some((p: any) => p.id === createdQuestion.body.id),
    ).toBe(true);

    // Safe timestamp resolution returns route metadata WITHOUT leaking raw video file paths or signing secrets
    const tsNav = await student.agent
      .get(`/api/v1/community/posts/${createdQuestion.body.id}/timestamp-target`)
      .expect(200);
    expect(tsNav.body.seekSeconds).toBe(45);
    expect(tsNav.body.lessonId).toBe(targetLesson.id);
    expect(tsNav.body.playerPath).toContain(`t=45`);
    expect(JSON.stringify(tsNav.body)).not.toContain('.m3u8');

    // Instructor received notification for new lesson question
    const instNotifs = await instructor.agent.get('/api/v1/notifications').expect(200);
    expect(
      instNotifs.body.items.some(
        (n: any) =>
          n.type === 'COMMUNITY_NEW_LESSON_QUESTION' && n.postId === createdQuestion.body.id,
      ),
    ).toBe(true);

    // 3. Instructor replies (`isCourseInstructor: true`) + accepts answer; Student CANNOT accept answer
    const instReply = await instructor.agent
      .post(`/api/v1/community/posts/${createdQuestion.body.id}/comments`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        body: 'نرفع سرعة الشفاطات تدريجيًا لمنع تيارات الهواء الباردة المباشرة على الكتاكيت.',
      })
      .expect(201);
    expect(instReply.body.author.isCourseInstructor).toBe(true);

    // Student cannot mark accepted answer (403)
    await student.agent
      .post(`/api/v1/community/posts/${createdQuestion.body.id}/accept-answer`)
      .set('X-CSRF-Token', student.csrf)
      .send({ commentId: instReply.body.id })
      .expect(403);

    // Instructor accepts answer -> marks post isAnswered = true
    const acceptRes = await instructor.agent
      .post(`/api/v1/community/posts/${createdQuestion.body.id}/accept-answer`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ commentId: instReply.body.id })
      .expect(201);
    expect(acceptRes.body.isAnswered).toBe(true);
    expect(acceptRes.body.acceptedCommentId).toBe(instReply.body.id);

    // Duplicate-safe likes + nested comment + notification received by student
    const like1 = await student.agent
      .post(`/api/v1/community/comments/${instReply.body.id}/like`)
      .set('X-CSRF-Token', student.csrf)
      .expect(201);
    expect(like1.body.liked).toBe(true);
    expect(like1.body.likeCount).toBe(1);

    const unlike1 = await student.agent
      .post(`/api/v1/community/comments/${instReply.body.id}/like`)
      .set('X-CSRF-Token', student.csrf)
      .expect(201);
    expect(unlike1.body.liked).toBe(false);
    expect(unlike1.body.likeCount).toBe(0);

    const studNotifs = await student.agent.get('/api/v1/notifications').expect(200);
    expect(
      studNotifs.body.items.some(
        (n: any) => n.type === 'COMMUNITY_INSTRUCTOR_REPLY' && n.postId === createdQuestion.body.id,
      ),
    ).toBe(true);
    expect(
      studNotifs.body.items.some(
        (n: any) => n.type === 'COMMUNITY_ACCEPTED_ANSWER' && n.postId === createdQuestion.body.id,
      ),
    ).toBe(true);

    // 4. Student reports a comment; duplicate report rejected with 409; admin resolves report
    const studComment = await student.agent
      .post(`/api/v1/community/posts/${createdQuestion.body.id}/comments`)
      .set('X-CSRF-Token', student.csrf)
      .send({
        parentCommentId: instReply.body.id,
        body: 'شكرًا يا دكتور، وضحت الفكرة تمامًا.',
      })
      .expect(201);

    const repRes = await instructor.agent
      .post('/api/v1/community/reports')
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        targetType: 'COMMENT',
        targetId: studComment.body.id,
        reason: 'محتوى مكرر للاختبار',
      })
      .expect(201);

    await instructor.agent
      .post('/api/v1/community/reports')
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        targetType: 'COMMENT',
        targetId: studComment.body.id,
        reason: 'محاولة تكرار البلاغ',
      })
      .expect(409);

    const reportsList = await admin.agent
      .get('/api/v1/admin/communities/reports?status=PENDING')
      .expect(200);
    expect(reportsList.body.some((r: any) => r.id === repRes.body.id)).toBe(true);

    await admin.agent
      .post(`/api/v1/admin/communities/reports/${repRes.body.id}/resolve`)
      .set('X-CSRF-Token', admin.csrf)
      .send({ status: 'DISMISSED', removeTarget: false, resolutionNotes: 'مراجعة منتهية' })
      .expect(201);

    // 5. Admin disables community -> student blocked & instructor CANNOT re-enable, admin CAN re-enable
    await admin.agent
      .patch(`/api/v1/admin/communities/courses/${poultryCourse.id}/settings`)
      .set('X-CSRF-Token', admin.csrf)
      .send({ isEnabled: false, adminDisabled: true })
      .expect(200);

    await student.agent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .expect(403);

    await instructor.agent
      .patch(`/api/v1/instructor/communities/courses/${poultryCourse.id}/settings`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ isEnabled: true })
      .expect(403);

    await admin.agent
      .patch(`/api/v1/admin/communities/courses/${poultryCourse.id}/settings`)
      .set('X-CSRF-Token', admin.csrf)
      .send({ isEnabled: true, adminDisabled: false })
      .expect(200);

    await student.agent
      .get(`/api/v1/community/courses/${poultryCourse.slug}/posts`)
      .expect(200);

    // 6. Instructor dashboard metrics & moderation log recorded
    const instDash = await instructor.agent.get('/api/v1/instructor/communities').expect(200);
    expect(instDash.body.courses.some((c: any) => c.id === poultryCourse.id)).toBe(true);

    const adminOverview = await admin.agent.get('/api/v1/admin/communities/overview').expect(200);
    expect(adminOverview.body.stats.totalPosts).toBeGreaterThan(0);
    expect(adminOverview.body.moderationLogs.length).toBeGreaterThan(0);

    // 7. Notification preferences opt-out prevents duplicate alert for new accepted answer
    await student.agent
      .patch('/api/v1/notifications/preferences')
      .set('X-CSRF-Token', student.csrf)
      .send({ notifyOnDiscussionReply: false })
      .expect(200);

    const prefsRes = await student.agent.get('/api/v1/notifications/preferences').expect(200);
    expect(prefsRes.body.notifyOnDiscussionReply).toBe(false);
  }, 60000);
});
