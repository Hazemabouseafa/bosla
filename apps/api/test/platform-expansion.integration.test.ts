import { createHmac } from 'node:crypto';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import EmbeddedPostgres from 'embedded-postgres';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma.service';
import { IntegrationsMailService } from '../src/modules/integrations-mail/integrations-mail.service';
import { configureApp } from '../src/main';

const execFileAsync = promisify(execFile);

function makeSignedTestGoogleToken(payload: {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}) {
  const secret = process.env.SESSION_SECRET || 'bosla_test_google_secret';
  const bodyB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(bodyB64).digest('base64url');
  return `bosla-test-google.${bodyB64}.${sig}`;
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

/**
 * Starts a local plain-TCP mock SMTP responder that records received messages without any external network call.
 */
async function startMockSmtpServer(): Promise<{
  port: number;
  received: string[];
  close: () => Promise<void>;
}> {
  const received: string[] = [];
  const server = net.createServer((socket) => {
    let readingData = false;
    let buf = '';
    socket.write('220 localhost mock SMTP\r\n');
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      if (readingData) {
        if (buf.includes('\r\n.\r\n')) {
          received.push(buf);
          readingData = false;
          buf = '';
          socket.write('250 2.0.0 Ok queued\r\n');
        }
        return;
      }
      const lines = buf.split('\r\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const upper = line.trim().toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          socket.write('250-localhost\r\n250 AUTH PLAIN LOGIN\r\n');
        } else if (upper.startsWith('AUTH')) {
          socket.write('235 2.7.0 Authentication successful\r\n');
        } else if (upper.startsWith('MAIL FROM') || upper.startsWith('RCPT TO') || upper.startsWith('NOOP') || upper.startsWith('RSET')) {
          socket.write('250 2.1.0 Ok\r\n');
        } else if (upper === 'DATA') {
          readingData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (upper === 'QUIT') {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
        } else {
          socket.write('250 Ok\r\n');
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as net.AddressInfo;
  return {
    port: addr.port,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

describe('BOSLA Platform Expansion — RBAC Support Grant, Google/SMTP Mail, Certificates, Recommendations, Wishlist & Live Editor', () => {
  let pg: EmbeddedPostgres;
  let tmpDir = '';
  let mediaDir = '';
  let app: INestApplication;
  let prisma: PrismaService;
  let mockSmtp: Awaited<ReturnType<typeof startMockSmtpServer>>;
  const dbPort = 54391;

  let admin: Awaited<ReturnType<typeof loginPhone>>;
  let instructor: Awaited<ReturnType<typeof loginPhone>>;
  let instructor2: Awaited<ReturnType<typeof loginPhone>>;
  let student: Awaited<ReturnType<typeof loginPhone>>;
  let supportUser: Awaited<ReturnType<typeof loginPhone>>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-expansion-'));
    const pgDir = path.join(tmpDir, 'pg-data');
    mediaDir = path.join(tmpDir, 'media');
    await fs.mkdir(mediaDir, { recursive: true });

    mockSmtp = await startMockSmtpServer();

    pg = new EmbeddedPostgres({
      databaseDir: pgDir,
      user: 'bosla_exp',
      password: 'bosla_exp_password',
      port: dbPort,
      persistent: false,
      initdbFlags: ['--encoding=UTF8', '--no-locale'],
      onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('bosla_expansion_db');

    const dbUrl = `postgresql://bosla_exp:bosla_exp_password@127.0.0.1:${dbPort}/bosla_expansion_db?schema=public`;
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = dbUrl;
    process.env.ALLOW_INMEMORY_REDIS = 'true';
    process.env.ALLOW_TEST_GOOGLE_TOKENS = 'true';
    process.env.COOKIE_SECRET = 'bosla_exp_cookie_secret_64_characters_minimum_required_here';
    process.env.SESSION_SECRET = 'bosla_exp_session_secret_64_characters_minimum_required_here';
    process.env.RECOVERY_CODE_PEPPER = 'bosla_exp_recovery_pepper_64_characters_minimum_required_here';
    process.env.PLAYBACK_TOKEN_SECRET = 'bosla_exp_playback_secret_64_characters_minimum_required_here';
    process.env.PAYMOB_CONFIG_ENCRYPTION_KEY =
      'bosla_exp_external_paymob_aes_256_gcm_master_key_2026';
    process.env.PAYMOB_MODE = 'sandbox';
    process.env.PAYMOB_HMAC_SECRET = 'bosla_exp_paymob_hmac_secret_value';
    process.env.WEBAUTHN_RP_NAME = 'BOSLA Academy';
    process.env.WEBAUTHN_RP_ID = 'localhost';
    process.env.WEBAUTHN_ORIGIN = 'http://localhost:3000';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.CORS_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000';
    process.env.MEDIA_ROOT = mediaDir;
    process.env.USE_NGINX_ACCEL = 'false';

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(currentDir, '../../..');
    const migrationsDir = path.join(repoRoot, 'packages/db/prisma/migrations');
    const migrationDirs = (await fs.readdir(migrationsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    const client = pg.getPgClient('bosla_expansion_db');
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
    instructor2 = await loginPhone(app, '+201000000102', 'BoslaInstructor#2026');

    await prisma.user.update({
      where: { phoneE164: '+201000000201' },
      data: { status: 'ACTIVE', email: 'student.exp@boslaagri.com', emailVerifiedAt: null },
    });
    student = await loginPhone(app, '+201000000201', 'BoslaStudent#2026');

    const supportPasswordHash = await argon2.hash('BoslaSupport#2026', { type: argon2.argon2id });
    const sup = await prisma.user.upsert({
      where: { phoneE164: '+201000000499' },
      update: { passwordHash: supportPasswordHash, role: 'SUPPORT', status: 'ACTIVE' },
      create: {
        fullName: 'موظف دعم الاختبار',
        phoneE164: '+201000000499',
        email: 'support.exp@boslaagri.com',
        passwordHash: supportPasswordHash,
        role: 'SUPPORT',
        status: 'ACTIVE',
        authProvider: 'PHONE_PASSWORD',
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
    });
    const supRole = await prisma.roleDefinition.findUnique({ where: { code: 'SUPPORT' } });
    if (supRole) {
      await prisma.userRoleAssignment.upsert({
        where: { userId_roleId: { userId: sup.id, roleId: supRole.id } },
        update: {},
        create: { userId: sup.id, roleId: supRole.id },
      });
    }
    supportUser = await loginPhone(app, '+201000000499', 'BoslaSupport#2026');
  }, 150_000);

  afterAll(async () => {
    if (mockSmtp) await mockSmtp.close().catch(() => {});
    if (app) await app.close();
    if (pg) await pg.stop();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('1. Enforces standalone membership.grant permission for Support and isolates manual grant from paid revenue', async () => {
    const plan = await prisma.membershipPlan.findFirstOrThrow({ where: { isActive: true } });

    // Default SUPPORT without membership.grant -> rejected 403
    await supportUser.agent
      .post('/api/v1/support/membership-grants')
      .set('X-CSRF-Token', supportUser.csrf)
      .send({
        userId: student.user.id,
        planId: plan.id,
        durationDays: 30,
        reasonAr: 'تجربة بدون صلاحية',
      })
      .expect(403);

    // Grant membership.grant permission to SUPPORT role via RBAC DB
    const perm = await prisma.permissionDefinition.upsert({
      where: { code: 'membership.grant' },
      update: {},
      create: {
        code: 'membership.grant',
        module: 'support',
        nameAr: 'منح عضوية يدوي مؤقت',
        descriptionAr: 'منح عضوية يدوي مؤقت من خدمة العملاء',
      },
    });
    const supRole = await prisma.roleDefinition.findUniqueOrThrow({ where: { code: 'SUPPORT' } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: supRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: supRole.id, permissionId: perm.id },
    });

    // Re-login support to pick up updated RBAC permissions
    supportUser = await loginPhone(app, '+201000000499', 'BoslaSupport#2026');

    const ordersBefore = await prisma.order.count({ where: { userId: student.user.id } });
    const txsBefore = await prisma.paymentTransaction.count({ where: { userId: student.user.id } });

    const grantRes = await supportUser.agent
      .post('/api/v1/support/membership-grants')
      .set('X-CSRF-Token', supportUser.csrf)
      .send({
        userId: student.user.id,
        planId: plan.id,
        durationDays: 14,
        reasonAr: 'منح تجريبي لحالة دعم موثقة',
      })
      .expect(201);

    expect(grantRes.body.isManualGrant).toBe(true);
    expect(grantRes.body.grantedById).toBe(supportUser.user.id);

    const ordersAfter = await prisma.order.count({ where: { userId: student.user.id } });
    const txsAfter = await prisma.paymentTransaction.count({ where: { userId: student.user.id } });
    expect(ordersAfter).toBe(ordersBefore);
    expect(txsAfter).toBe(txsBefore);

    const dashRes = await student.agent.get('/api/v1/learning/dashboard').expect(200);
    expect(dashRes.body.membership?.activeSubscription?.isManualGrant).toBe(true);
  });

  it('2. Stores encrypted Google OAuth & SMTP config, rejects email_verified=false, and validates single-use Email Verify & Recovery tokens', async () => {
    // A. Save runtime Google config
    const gSave = await admin.agent
      .put('/api/v1/admin/integrations/google')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        isEnabled: true,
        clientId: '1234567890-testclient.apps.googleusercontent.com',
        clientSecret: 'GOCSPX-super-secret-value-12345',
      })
      .expect(200);
    expect(gSave.body.hasClientSecret).toBe(true);
    expect(gSave.body.clientSecretMasked).not.toContain('super-secret');

    // Reject Google sign-in when emailVerified === false (zero unverified account linking)
    const badGoogleToken = makeSignedTestGoogleToken({
      sub: 'google-unverified-sub-1',
      email: 'student.exp@boslaagri.com',
      emailVerified: false,
      name: 'Unverified User',
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: badGoogleToken })
      .expect(401);

    // Accept verified Google user
    const goodGoogleToken = makeSignedTestGoogleToken({
      sub: 'google-verified-sub-999',
      email: 'google.verified.learner@boslaagri.com',
      emailVerified: true,
      name: 'متدرب جوجل الموثق',
    });
    const gOk = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ credential: goodGoogleToken })
      .expect(201);
    expect(gOk.body.user?.email).toBe('google.verified.learner@boslaagri.com');

    // B. Collab task with disabled SMTP -> task saved to DB AND non-fatal Arabic warning returned
    const collabWarnRes = await admin.agent
      .post(`/api/v1/admin/instructor-collab/instructors/${instructor.user.id}/tasks`)
      .set('X-CSRF-Token', admin.csrf)
      .send({
        titleAr: 'مهمة بدون تفعيل البريد',
        descriptionAr: 'التأكد من حفظ المهمة وعدم تعطلها عند غياب إعدادات SMTP.',
        priority: 'HIGH',
      })
      .expect(201);
    expect(collabWarnRes.body.id).toBeTruthy();
    expect(collabWarnRes.body.emailDelivery?.ok).toBe(false);
    expect(collabWarnRes.body.emailDelivery?.warningAr).toBeTruthy();

    // C. Save local mock SMTP & dispatch test email
    const mSave = await admin.agent
      .put('/api/v1/admin/integrations/mail')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        isEnabled: true,
        host: '127.0.0.1',
        port: mockSmtp.port,
        secure: false,
        username: 'smtp-tester',
        password: 'smtp-secret-password-999',
        fromName: 'BOSLA Academy Test',
        fromEmail: 'noreply@boslaagri.com',
      })
      .expect(200);
    expect(mSave.body.hasPassword).toBe(true);
    expect(mSave.body.passwordMasked).toContain('••••');
    expect(mSave.body.passwordMasked).not.toContain('smtp-secret');

    const testMailRes = await admin.agent
      .post('/api/v1/admin/integrations/mail/test')
      .set('X-CSRF-Token', admin.csrf)
      .send({ recipientEmail: 'qa-recipient@boslaagri.com' })
      .expect(201);
    expect(testMailRes.body.ok).toBe(true);
    expect(mockSmtp.received.length).toBeGreaterThanOrEqual(1);

    // D. Unverified email login is rejected (403), then single-use verification token unlocks email login
    await request(app.getHttpServer())
      .post('/api/v1/auth/login/email')
      .send({ email: 'student.exp@boslaagri.com', password: 'BoslaStudent#2026' })
      .expect(403);

    const mailService = app.get(IntegrationsMailService);
    const verifyTok = await mailService.issueEmailActionToken({
      userId: student.user.id,
      email: 'student.exp@boslaagri.com',
      purpose: 'EMAIL_VERIFY',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify/confirm')
      .send({ token: verifyTok.rawToken })
      .expect(201);

    // Single-use check: replay MUST fail
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify/confirm')
      .send({ token: verifyTok.rawToken })
      .expect(400);

    // Verified email login now succeeds
    await request(app.getHttpServer())
      .post('/api/v1/auth/login/email')
      .send({ email: 'student.exp@boslaagri.com', password: 'BoslaStudent#2026' })
      .expect(201);

    // E. Verified-email password reset single-use token
    const resetTok = await mailService.issueEmailActionToken({
      userId: student.user.id,
      email: 'student.exp@boslaagri.com',
      purpose: 'PASSWORD_RESET',
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/recovery/email/confirm')
      .send({ token: resetTok.rawToken, newPassword: 'BoslaStudentNew#2026' })
      .expect(201);

    // Replay reset token fails
    await request(app.getHttpServer())
      .post('/api/v1/auth/recovery/email/confirm')
      .send({ token: resetTok.rawToken, newPassword: 'BoslaStudentNew2#2026' })
      .expect(400);

    // Re-login with new password and restore original password for remaining suite
    student = await loginPhone(app, '+201000000201', 'BoslaStudentNew#2026');
  });

  it('3. Issues idempotent Course & Learning Path attendance certificates with layoutConfig and enforces Recommendation Letter lifecycle & zero-PII verify', async () => {
    // Update default ATTENDANCE_COMPLETION template with custom image & coordinates
    await admin.agent
      .post('/api/v1/lms/certificates/templates')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        key: 'tpl-attendance_completion-default',
        nameAr: 'قالب حضور بوصلة الرسمي للاختبار',
        headlineAr: 'شهادة إتمام وحضور',
        bodyTemplateAr: 'تشهد أكاديمية بوصلة بإتمام المتطلبات التدريبية بنجاح.',
        kind: 'ATTENDANCE_COMPLETION',
        templateImageUrl: '/images/brand/bosla-logo.webp',
        layoutConfig: {
          recipientName: { xPercent: 50, yPercent: 45, fontSizePx: 26, color: '#0A2A8A', visible: true, align: 'center' },
          programTitle: { xPercent: 50, yPercent: 57, fontSizePx: 18, color: '#1E293B', visible: true, align: 'center' },
          issueDate: { xPercent: 25, yPercent: 78, fontSizePx: 14, color: '#334155', visible: true, align: 'center' },
          verificationCode: { xPercent: 75, yPercent: 78, fontSizePx: 13, color: '#334155', visible: true, align: 'center' },
        },
        issuerNameAr: 'أكاديمية بوصلة',
        signatureNameAr: 'الإدارة الأكاديمية',
        isDefault: true,
      })
      .expect(201);

    // Pick a published Learning Path with at least 1 published course + lessons
    const pathRow = await prisma.learningPath.findFirstOrThrow({
      where: { status: 'PUBLISHED' },
      include: {
        courses: {
          orderBy: { sortOrder: 'asc' },
          include: {
            course: {
              include: {
                publishedVersion: {
                  include: {
                    sections: {
                      include: {
                        lessons: { select: { id: true, durationSeconds: true, quizId: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const firstCourse = pathRow.courses[0]!.course;
    for (const pc of pathRow.courses) {
      await admin.agent
        .post('/api/v1/admin/enrollments/grant')
        .set('X-CSRF-Token', admin.csrf)
        .send({ userId: student.user.id, courseId: pc.course.id, source: 'ADMIN_GRANTED' })
        .expect(201);
    }

    const targetLessons = pathRow.courses.flatMap((pc) =>
      pc.course.publishedVersion?.sections.flatMap((s) => s.lessons) ?? [],
    );
    const quizIds = Array.from(
      new Set(targetLessons.map((l) => l.quizId).filter((id): id is string => Boolean(id))),
    );
    for (const quizId of quizIds) {
      const quiz = await prisma.quiz.findUniqueOrThrow({
        where: { id: quizId },
        include: { questions: true },
      });
      const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, q.correctOptionId]));
      await student.agent
        .post(`/api/v1/learning/quizzes/${quizId}/attempts`)
        .set('X-CSRF-Token', student.csrf)
        .send({ answers })
        .expect(201);
    }

    // Complete all lessons (also fire concurrent requests on the last lesson to prove pg_advisory_xact_lock idempotency!)
    for (const lesson of targetLessons.slice(0, -1)) {
      const dur = Math.max(lesson.durationSeconds || 120, 120);
      await student.agent
        .post(`/api/v1/learning/lessons/${lesson.id}/progress`)
        .set('X-CSRF-Token', student.csrf)
        .send({ watchedSeconds: dur, durationSeconds: dur, isCompleted: true })
        .expect(201);
    }
    const lastLesson = targetLessons[targetLessons.length - 1]!;
    const lastDur = Math.max(lastLesson.durationSeconds || 120, 120);
    await Promise.all([
      student.agent
        .post(`/api/v1/learning/lessons/${lastLesson.id}/progress`)
        .set('X-CSRF-Token', student.csrf)
        .send({ watchedSeconds: lastDur, durationSeconds: lastDur, isCompleted: true }),
      student.agent
        .post(`/api/v1/learning/lessons/${lastLesson.id}/progress`)
        .set('X-CSRF-Token', student.csrf)
        .send({ watchedSeconds: lastDur, durationSeconds: lastDur, isCompleted: true }),
    ]);

    const certsAfter = await prisma.certificate.findMany({
      where: { userId: student.user.id },
    });
    const pathCerts = certsAfter.filter((c) => c.learningPathId === pathRow.id);
    const courseCerts = certsAfter.filter((c) => c.courseId === firstCourse.id);
    expect(courseCerts.length).toBe(1);
    expect(pathCerts.length).toBe(1);

    // Printable detail endpoint returns attached template & layoutConfig
    const certDetail = await student.agent
      .get(`/api/v1/learning/certificates/${pathCerts[0]!.id}/detail`)
      .expect(200);
    expect(certDetail.body.template?.templateImageUrl).toBe('/images/brand/bosla-logo.webp');
    expect(certDetail.body.template?.layoutConfig?.recipientName?.xPercent).toBe(50);

    // Recommendation Letter lifecycle on firstCourse
    await prisma.programInstructorAssignment.deleteMany({ where: { courseId: firstCourse.id } });
    await prisma.course.update({
      where: { id: firstCourse.id },
      data: { instructorId: instructor.user.id },
    });

    const recReq = await student.agent
      .post('/api/v1/learning/recommendations/request')
      .set('X-CSRF-Token', student.csrf)
      .send({
        targetType: 'COURSE',
        courseId: firstCourse.id,
        studentGoalAr: 'أحتاج خطاب توصية مهنية للتقديم على وظيفة إشراف إنتاج داجني.',
      })
      .expect(201);
    expect(recReq.body.status).toBe('PENDING');
    const recId = recReq.body.id as string;

    // Different instructor (instructor2) cannot approve or save draft -> 403
    await instructor2.agent
      .post(`/api/v1/instructor/recommendations/${recId}/approve`)
      .set('X-CSRF-Token', instructor2.csrf)
      .send({
        letterBodyAr: 'محاولة اعتماد غير مصرح بها من مدرب آخر ليست له علاقة بالكورس.',
      })
      .expect(403);

    // Assigned instructor cannot approve empty/short body -> 400
    await instructor.agent
      .post(`/api/v1/instructor/recommendations/${recId}/approve`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ letterBodyAr: 'قصير' })
      .expect(400);

    // Save draft then approve full instructor-authored letter
    await instructor.agent
      .patch(`/api/v1/instructor/recommendations/${recId}`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        letterTitleAr: 'توصية مهنية في الإنتاج الداجني',
        letterBodyAr: 'مسودة توصية مبدئية تتضمن تقييم الأداء الميداني والتشغيلي للمتدرب.',
      })
      .expect(200);

    const approvedRec = await instructor.agent
      .post(`/api/v1/instructor/recommendations/${recId}/approve`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        letterTitleAr: 'خطاب توصية مهنية معتمد — أكاديمية بوصلة',
        letterBodyAr:
          'أشهد بأن المتدرب أتم البرنامج التطبيقي بنجاح وتميز في تطبيق معايير الأمان الحيوي وتحليل الأداء اليومي داخل العنابر.',
      })
      .expect(201);
    expect(approvedRec.body.status).toBe('APPROVED');
    expect(approvedRec.body.verificationCode).toMatch(/^BOSLA-REC-/);

    // Immutability guard after approval -> PATCH rejected
    await instructor.agent
      .patch(`/api/v1/instructor/recommendations/${recId}`)
      .set('X-CSRF-Token', instructor.csrf)
      .send({ letterBodyAr: 'محاولة تعديل النص بعد الاعتماد الرسمي والنشر النهائي.' })
      .expect(400);

    // Unified Public Verify returns APPROVED status, zero PII, zero letterBodyAr
    const verifyOk = await request(app.getHttpServer())
      .get(`/api/v1/learning/credentials/verify/${encodeURIComponent(approvedRec.body.verificationCode)}`)
      .expect(200);
    expect(verifyOk.body.credentialType).toBe('RECOMMENDATION');
    expect(verifyOk.body.status).toBe('APPROVED');
    expect(verifyOk.body.isValid).toBe(true);
    expect(verifyOk.body.letterBodyAr).toBeUndefined();
    expect(verifyOk.body.email).toBeUndefined();
    expect(verifyOk.body.phoneE164).toBeUndefined();

    // Admin revokes -> verify returns REVOKED & isValid: false
    await admin.agent
      .post(`/api/v1/admin/recommendations/${recId}/revoke`)
      .set('X-CSRF-Token', admin.csrf)
      .send({ revokeReasonAr: 'إلغاء تجريبي للتحقق من سريان حالة الإبطال' })
      .expect(201);

    const verifyRevoked = await request(app.getHttpServer())
      .get(`/api/v1/learning/credentials/verify/${encodeURIComponent(approvedRec.body.verificationCode)}`)
      .expect(200);
    expect(verifyRevoked.body.status).toBe('REVOKED');
    expect(verifyRevoked.body.isValid).toBe(false);
  });

  it('4. Handles Wishlist, Duplicate Purchase Prevention, Cover Crop Persistence, Careers CRUD, Trainers Order & Live Editor', async () => {
    // Find a paid standalone course without an active subscription for a fresh non-member student
    const paidCourse = await prisma.course.findFirstOrThrow({
      where: {
        status: 'PUBLISHED',
        isFree: false,
        allowIndividualPurchase: true,
        priceCents: { gt: 0 },
      },
    });

    const buyerPhone = '+201000000288';
    const pwHash = await argon2.hash('BoslaBuyer#2026', { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { phoneE164: buyerPhone },
      update: { status: 'ACTIVE', passwordHash: pwHash },
      create: {
        fullName: 'متدرب شراء منفرد',
        phoneE164: buyerPhone,
        passwordHash: pwHash,
        role: 'STUDENT',
        status: 'ACTIVE',
        authProvider: 'PHONE_PASSWORD',
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
    });
    const buyer = await loginPhone(app, buyerPhone, 'BoslaBuyer#2026');

    // Toggle wishlist on -> saved, merge guest cart -> item added
    const wishOn = await buyer.agent
      .post('/api/v1/commerce/wishlist/toggle')
      .set('X-CSRF-Token', buyer.csrf)
      .send({ targetType: 'COURSE', targetId: paidCourse.id })
      .expect(201);
    expect(wishOn.body.saved).toBe(true);

    await buyer.agent
      .post('/api/v1/commerce/cart/merge')
      .set('X-CSRF-Token', buyer.csrf)
      .send({ courseIds: [paidCourse.id] })
      .expect(201);

    // Buy the course via sandbox confirm
    const ordRes = await buyer.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', buyer.csrf)
      .send({ courseIds: [paidCourse.id], paymentMethod: 'PAYMOB_CARD' })
      .expect(201);

    await buyer.agent
      .post(`/api/v1/commerce/orders/${encodeURIComponent(ordRes.body.order.orderNumber)}/sandbox-confirm`)
      .set('X-CSRF-Token', buyer.csrf)
      .send({})
      .expect(201);

    // Duplicate purchase prevention: adding already-owned course to cart MUST be rejected
    await buyer.agent
      .post('/api/v1/commerce/cart/items')
      .set('X-CSRF-Token', buyer.csrf)
      .send({ courseId: paidCourse.id })
      .expect(409);

    // Instructor cover crop metadata persistence
    const cat = await prisma.category.findFirstOrThrow();
    const createdCourse = await instructor.agent
      .post('/api/v1/instructor/courses')
      .set('X-CSRF-Token', instructor.csrf)
      .send({
        slug: `crop-test-${Date.now()}`,
        titleAr: 'كورس اختبار ارتكاز الصورة',
        descriptionAr: 'وصف تفصيلي لكورس يختبر حفظ نقطة الارتكاز ونمط عرض الغلاف.',
        categoryId: cat.id,
        coverFocalX: 28,
        coverFocalY: 72,
        coverFitMode: 'CONTAIN',
      })
      .expect(201);
    expect(createdCourse.body.draftVersion?.coverFocalX).toBe(28);
    expect(createdCourse.body.draftVersion?.coverFocalY).toBe(72);
    expect(createdCourse.body.draftVersion?.coverFitMode).toBe('CONTAIN');

    // Admin Careers CRUD -> public /catalog/careers
    const jobRes = await admin.agent
      .post('/api/v1/admin/careers')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        titleAr: 'طبيب بيطري مشرف مزارع',
        departmentAr: 'الإشراف الميداني',
        locationAr: 'القاهرة / الدلتا',
        employmentTypeAr: 'دوام كامل',
        summaryAr: 'فرصة حقيقية للعمل الميداني مع فريق التدريب والاستشارات.',
        applyEmail: 'careers@boslaagri.com',
        isPublished: true,
        sortOrder: 1,
      })
      .expect(201);
    const pubJobs = await request(app.getHttpServer()).get('/api/v1/catalog/careers').expect(200);
    expect(pubJobs.body.some((j: any) => j.id === jobRes.body.id)).toBe(true);
    await admin.agent
      .delete(`/api/v1/admin/careers/${jobRes.body.id}`)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);

    // Trainers homepage visibility & ordering
    await admin.agent
      .put('/api/v1/admin/trainers/homepage')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        items: [
          {
            userId: instructor.user.id,
            showOnHomepage: true,
            homepageSortOrder: 1,
          },
        ],
      })
      .expect(200);
    const instPub = await request(app.getHttpServer())
      .get(`/api/v1/catalog/instructors/${instructor.user.id}`)
      .expect(200);
    expect(instPub.body.id).toBe(instructor.user.id);

    // Extended Live Editor draft + publish preserves social links, storytelling, partners CTA & verifies output
    const edState = await admin.agent
      .get('/api/v1/admin/live-editor/state?pageKey=home')
      .expect(200);
    const updatedCfg = {
      ...edState.body.draftConfig,
      social: {
        ...edState.body.draftConfig.social,
        facebookUrl: 'https://www.facebook.com/boslaacademy',
      },
      partners: {
        ...edState.body.draftConfig.partners,
        ctaLabelAr: 'انضم كشريك نجاح',
      },
    };
    const draftSaved = await admin.agent
      .put('/api/v1/admin/live-editor/draft')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        pageKey: 'home',
        baseVersion: edState.body.currentDraftVersion,
        summaryAr: 'تحديث السوشيال وزر الشركاء',
        config: updatedCfg,
      })
      .expect(200);
    await admin.agent
      .post('/api/v1/admin/live-editor/publish')
      .set('X-CSRF-Token', admin.csrf)
      .send({
        pageKey: 'home',
        baseVersion: draftSaved.body.currentDraftVersion,
        summaryAr: 'نشر تحديث السوشيال والشركاء',
      })
      .expect(201);

    const livePub = await request(app.getHttpServer()).get('/api/v1/catalog/live-layout').expect(200);
    expect(livePub.body.layout?.social?.facebookUrl).toBe('https://www.facebook.com/boslaacademy');
    expect(livePub.body.layout?.partners?.ctaLabelAr).toBe('انضم كشريك نجاح');
  });
});
