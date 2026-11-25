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

async function loginPhone(app: INestApplication, phoneNumber: string, password: string) {
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post('/api/v1/auth/login/phone')
    .send({ phoneNumber, countryCode: '+20', password })
    .expect(201);
  return {
    agent,
    csrf: res.body.csrfToken as string,
    user: res.body.user as { id: string; role: string },
  };
}

describe('BOSLA Audit Regressions (TDD Integration Suite)', () => {
  let pg: EmbeddedPostgres;
  let tmpDir = '';
  let app: INestApplication;
  let prisma: PrismaService;
  const dbPort = 54361;

  let adminSession: Awaited<ReturnType<typeof loginPhone>>;
  let financeMakerSession: Awaited<ReturnType<typeof loginPhone>>;
  let paidCourse: { id: string; slug: string; priceCents: number };

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-audit-reg-'));
    const pgDir = path.join(tmpDir, 'pg-data');
    const mediaDir = path.join(tmpDir, 'media');
    await fs.mkdir(mediaDir, { recursive: true });

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
    await pg.createDatabase('bosla_audit_db');

    const dbUrl = `postgresql://bosla_audit:bosla_audit_password@127.0.0.1:${dbPort}/bosla_audit_db?schema=public`;
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
    process.env.MEDIA_ROOT = mediaDir;
    process.env.USE_NGINX_ACCEL = 'false';

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(currentDir, '../../..');
    const migrationsDir = path.join(repoRoot, 'packages/db/prisma/migrations');
    const migrationDirs = (await fs.readdir(migrationsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    const client = pg.getPgClient('bosla_audit_db');
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
    adminSession = await loginPhone(app, '+201000000001', 'BoslaAdmin#2026');
    financeMakerSession = await loginPhone(app, '+201000000303', 'BoslaEnterprise#2026');

    const candidateCourse = await prisma.course.findFirstOrThrow({
      where: {
        status: 'PUBLISHED',
        isFree: false,
        allowIndividualPurchase: true,
        priceCents: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, slug: true, priceCents: true },
    });
    paidCourse = candidateCourse;
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    if (pg) await pg.stop();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }, 60_000);

  it('F-05: admin grantCourseEnrollment grants player access entitlement and revoke cleans up unlinked grant', async () => {
    const createRes = await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'طالب منحة يدوية',
        phoneNumber: '01055000001',
        countryCode: '+20',
        password: 'StudentGrant#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);

    const grantedStudent = await loginPhone(app, '+201055000001', 'StudentGrant#2026');

    const beforePlayer = await grantedStudent.agent
      .get(`/api/v1/learning/courses/${paidCourse.slug}/player`)
      .expect(200);
    expect(beforePlayer.body.access.allowed).toBe(false);

    await adminSession.agent
      .post('/api/v1/admin/enrollments/grant')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        userId: createRes.body.id,
        courseId: paidCourse.id,
        source: 'ADMIN_GRANTED',
      })
      .expect(201);

    const afterGrantPlayer = await grantedStudent.agent
      .get(`/api/v1/learning/courses/${paidCourse.slug}/player`)
      .expect(200);
    expect(afterGrantPlayer.body.access.allowed).toBe(true);

    await adminSession.agent
      .delete(`/api/v1/admin/enrollments/${createRes.body.id}/${paidCourse.id}`)
      .set('X-CSRF-Token', adminSession.csrf)
      .expect(200);

    const afterRevokePlayer = await grantedStudent.agent
      .get(`/api/v1/learning/courses/${paidCourse.slug}/player`)
      .expect(200);
    expect(afterRevokePlayer.body.access.allowed).toBe(false);
  });

  it('F-04: refunding duplicate Order B preserves access backed by valid paid Order A / admin grant', async () => {
    const createRes = await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'طالب وصول متداخل',
        phoneNumber: '01055000002',
        countryCode: '+20',
        password: 'StudentOverlap#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);

    const learner = await loginPhone(app, '+201055000002', 'StudentOverlap#2026');

    // Two concurrent PENDING_PAYMENT orders before either settles (two checkout tabs) -> Order A and Order B both paid
    const ordARes = await learner.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', learner.csrf)
      .send({ courseIds: [paidCourse.id], paymentMethod: 'PAYMOB_CARD' })
      .expect(201);
    const ordBRes = await learner.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', learner.csrf)
      .send({ courseIds: [paidCourse.id], paymentMethod: 'PAYMOB_CARD' })
      .expect(201);
    await learner.agent
      .post(`/api/v1/commerce/orders/${ordARes.body.order.orderNumber}/sandbox-confirm`)
      .set('X-CSRF-Token', learner.csrf)
      .send({})
      .expect(201);
    await learner.agent
      .post(`/api/v1/commerce/orders/${ordBRes.body.order.orderNumber}/sandbox-confirm`)
      .set('X-CSRF-Token', learner.csrf)
      .send({})
      .expect(201);

    // Refund duplicate Order B with revokeAccess=true
    const orderBTotalEgp = Math.round(ordBRes.body.order.totalCents) / 100 || 100;
    await financeMakerSession.agent
      .post('/api/v1/finance/refunds')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({
        orderId: ordBRes.body.order.id,
        refundAmountEgp: orderBTotalEgp,
        refundType: 'FULL',
        revokeAccess: true,
        reasonAr: 'استرداد طلب مكرر مع بقاء الطلب الأول ساريًا',
      })
      .expect(201);

    // Learner must STILL have access backed by un-refunded Order A
    const playerAfterRefundB = await learner.agent
      .get(`/api/v1/learning/courses/${paidCourse.slug}/player`)
      .expect(200);
    expect(playerAfterRefundB.body.access.allowed).toBe(true);
  });

  it('F-01: rejects sandbox-confirm when authenticated caller does not own the order', async () => {
    await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'طالب أول للطلب',
        phoneNumber: '01055000003',
        countryCode: '+20',
        password: 'StudentOne#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);
    await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'طالب ثاني متطفل',
        phoneNumber: '01055000004',
        countryCode: '+20',
        password: 'StudentTwo#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);

    const owner = await loginPhone(app, '+201055000003', 'StudentOne#2026');
    const intruder = await loginPhone(app, '+201055000004', 'StudentTwo#2026');

    const ordRes = await owner.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', owner.csrf)
      .send({ courseIds: [paidCourse.id], paymentMethod: 'PAYMOB_CARD' })
      .expect(201);

    await intruder.agent
      .post(`/api/v1/commerce/orders/${ordRes.body.order.orderNumber}/sandbox-confirm`)
      .set('X-CSRF-Token', intruder.csrf)
      .send({})
      .expect(403);
  });

  it('F-02: enforces course maxCapacity on direct order creation and locks coupon usageLimit atomically', async () => {
    await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'طالب اختبار السعة والكوبون',
        phoneNumber: '01055000005',
        countryCode: '+20',
        password: 'StudentCap#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);
    const learner = await loginPhone(app, '+201055000005', 'StudentCap#2026');

    // Create dedicated published course with maxCapacity=1 and 1 existing enrollment
    const capCourse = await prisma.course.create({
      data: {
        slug: 'capacity-full-test-course',
        instructorId: adminSession.user.id,
        status: 'PUBLISHED',
        isFree: false,
        priceCents: 20_000,
        allowIndividualPurchase: true,
        maxCapacity: 1,
        waitlistEnabled: false,
        publishedAt: new Date(),
      },
    });
    await prisma.courseEnrollment.create({
      data: { userId: adminSession.user.id, courseId: capCourse.id, source: 'ADMIN_GRANTED' },
    });

    const overCapRes = await learner.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', learner.csrf)
      .send({ courseIds: [capCourse.id], paymentMethod: 'PAYMOB_CARD' });
    expect(overCapRes.status).toBe(400);

    // Concurrent single-use coupon race
    const coupon = await prisma.coupon.create({
      data: {
        code: 'ONCEONLY2026',
        discountType: 'FIXED',
        discountValue: '10.00',
        usageLimit: 1,
        usageCount: 0,
        isActive: true,
      },
    });

    const raceResponses = await Promise.all([
      learner.agent
        .post('/api/v1/commerce/orders')
        .set('X-CSRF-Token', learner.csrf)
        .send({ courseIds: [paidCourse.id], couponCode: coupon.code, paymentMethod: 'PAYMOB_CARD' }),
      learner.agent
        .post('/api/v1/commerce/orders')
        .set('X-CSRF-Token', learner.csrf)
        .send({ courseIds: [paidCourse.id], couponCode: coupon.code, paymentMethod: 'PAYMOB_CARD' }),
      learner.agent
        .post('/api/v1/commerce/orders')
        .set('X-CSRF-Token', learner.csrf)
        .send({ courseIds: [paidCourse.id], couponCode: coupon.code, paymentMethod: 'PAYMOB_CARD' }),
    ]);

    const okCount = raceResponses.filter((r) => r.status === 201).length;
    expect(okCount).toBe(1);

    const updatedCoupon = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(updatedCoupon.usageCount).toBe(1);
  });

  it('F-03: sellerCode.allowedCourseIds restricts commissions strictly to allowed courses in mixed carts', async () => {
    const twoCourses = await prisma.course.findMany({
      where: {
        status: 'PUBLISHED',
        isFree: false,
        allowIndividualPurchase: true,
        priceCents: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
      take: 2,
      select: { id: true },
    });
    expect(twoCourses.length).toBe(2);
    const [allowedCourse, disallowedCourse] = twoCourses;

    const seller = await prisma.seller.findFirstOrThrow({
      where: { status: 'APPROVED' },
      select: { id: true, userId: true },
    });
    const restrictedCode = await prisma.sellerCode.create({
      data: {
        sellerId: seller.id,
        code: 'ONLYFIRST2026',
        allowedCourseIds: [allowedCourse.id],
        isActive: true,
      },
    });

    await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'طالب سلة مختلطة',
        phoneNumber: '01055000006',
        countryCode: '+20',
        password: 'StudentMix#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);
    const mixBuyer = await loginPhone(app, '+201055000006', 'StudentMix#2026');

    const ordRes = await mixBuyer.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', mixBuyer.csrf)
      .send({
        courseIds: [allowedCourse.id, disallowedCourse.id],
        sellerCode: restrictedCode.code,
        paymentMethod: 'PAYMOB_CARD',
      })
      .expect(201);

    await mixBuyer.agent
      .post(`/api/v1/commerce/orders/${ordRes.body.order.orderNumber}/sandbox-confirm`)
      .set('X-CSRF-Token', mixBuyer.csrf)
      .send({})
      .expect(201);

    const commissions = await prisma.sellerCommission.findMany({
      where: { orderId: ordRes.body.order.id },
      include: { orderItem: { select: { courseId: true } } },
    });
    expect(commissions).toHaveLength(1);
    expect(commissions[0].orderItem.courseId).toBe(allowedCourse.id);
  });

  it('F-09: SellersController.trackReferral honors COOKIE_SECURE=auto with x-forwarded-proto=https', async () => {
    const prevCookieSecure = process.env.COOKIE_SECURE;
    process.env.COOKIE_SECURE = 'auto';
    try {
      const code = await prisma.sellerCode.findFirstOrThrow({
        where: { isActive: true },
        select: { code: true },
      });
      const res = await request(app.getHttpServer())
        .post('/api/v1/sellers/referrals/track')
        .set('X-Forwarded-Proto', 'https')
        .send({ code: code.code })
        .expect(201);

      const cookies = res.headers['set-cookie'];
      const cookieHeader = Array.isArray(cookies) ? cookies.join(';') : String(cookies || '');
      expect(cookieHeader.toLowerCase()).toContain('secure');
    } finally {
      if (prevCookieSecure === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = prevCookieSecure;
    }
  });

  it('F-07: hides un-enrolled LMS sessions/assignments from outsiders and blocks un-enrolled assignment submit', async () => {
    await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'طالب غير مسجل LMS',
        phoneNumber: '01055000007',
        countryCode: '+20',
        password: 'StudentLms#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);
    const outsider = await loginPhone(app, '+201055000007', 'StudentLms#2026');

    const startsAt = new Date(Date.now() + 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 3_600_000);
    const secretSession = await prisma.trainingSession.create({
      data: {
        courseId: paidCourse.id,
        titleAr: 'جلسة بث مدفوعة خاصة',
        sessionType: 'ONLINE_LIVE',
        startsAt,
        endsAt,
        manualMeetingUrl: 'https://zoom.us/j/secret-bosla-paid-meeting',
      },
    });
    const assignment = await prisma.assignment.create({
      data: {
        courseId: paidCourse.id,
        titleAr: 'واجب عملي خاص بالكورس المدفوع',
        instructionsAr: 'يرجى رفع تقرير التحصين الميداني لهذا الكورس المدفوع.',
        createdById: adminSession.user.id,
      },
    });

    // Un-enrolled outsider must NOT see paid course session meeting URL or assignment
    const sessionsRes = await outsider.agent.get('/api/v1/lms/sessions').expect(200);
    const leakedSession = (sessionsRes.body as Array<{ id: string }>).find(
      (s) => s.id === secretSession.id,
    );
    expect(leakedSession).toBeUndefined();

    const assignmentsRes = await outsider.agent.get('/api/v1/lms/assignments').expect(200);
    const leakedAssignment = (assignmentsRes.body as Array<{ id: string }>).find(
      (a) => a.id === assignment.id,
    );
    expect(leakedAssignment).toBeUndefined();

    // Un-enrolled outsider must be rejected with 403 on submit
    await outsider.agent
      .post(`/api/v1/lms/assignments/${assignment.id}/submit`)
      .set('X-CSRF-Token', outsider.csrf)
      .send({ submissionTextAr: 'محاولة تسليم واجب بدون شراء الكورس' })
      .expect(403);

    // Admin staff keeps full visibility (AdminEnterpriseSuitePanel)
    const adminSessionsRes = await adminSession.agent.get('/api/v1/lms/sessions').expect(200);
    expect((adminSessionsRes.body as Array<{ id: string }>).some((s) => s.id === secretSession.id)).toBe(true);

    // Grant enrollment -> outsider can now view session/assignment and submit
    await adminSession.agent
      .post('/api/v1/admin/enrollments/grant')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        userId: outsider.user.id,
        courseId: paidCourse.id,
        source: 'ADMIN_GRANTED',
      })
      .expect(201);

    const grantedSessionsRes = await outsider.agent.get('/api/v1/lms/sessions').expect(200);
    expect((grantedSessionsRes.body as Array<{ id: string }>).some((s) => s.id === secretSession.id)).toBe(true);

    await outsider.agent
      .post(`/api/v1/lms/assignments/${assignment.id}/submit`)
      .set('X-CSRF-Token', outsider.csrf)
      .send({ submissionTextAr: 'تسليم واجب مكتمل بعد تفعيل الاشتراك بنجاح' })
      .expect(201);
  });

  it('F-08: prevents concurrent overbooking on capacity-limited offline event checkouts', async () => {
    const evt = await prisma.offlineEvent.create({
      data: {
        slug: 'single-seat-race-event',
        titleAr: 'ورشة تطبيقية بمقعد واحد',
        descriptionAr: 'ورشة ميدانية متخصصة في صحة القطيع بمقعد واحد فقط للاختبار المتزامن.',
        cityAr: 'القاهرة',
        venueNameAr: 'قاعة بوصلة',
        venueAddressAr: 'مدينة نصر',
        startsAt: new Date(Date.now() + 7 * 86_400_000),
        priceCents: 0,
        capacity: 1,
        status: 'PUBLISHED',
        createdById: adminSession.user.id,
      },
    });

    const phones = ['01055000008', '01055000009', '01055000010', '01055000011'];
    const racers: Array<Awaited<ReturnType<typeof loginPhone>>> = [];
    for (let i = 0; i < phones.length; i += 1) {
      await adminSession.agent
        .post('/api/v1/admin/users')
        .set('X-CSRF-Token', adminSession.csrf)
        .send({
          fullName: `متنافس فعالية ${i + 1}`,
          phoneNumber: phones[i],
          countryCode: '+20',
          password: 'EventRace#2026',
          role: 'STUDENT',
          status: 'ACTIVE',
        })
        .expect(201);
      racers.push(await loginPhone(app, `+20${phones[i].slice(1)}`, 'EventRace#2026'));
    }

    const checkoutResults = await Promise.all(
      racers.map((r) =>
        r.agent
          .post(`/api/v1/events/${evt.id}/checkout`)
          .set('X-CSRF-Token', r.csrf)
          .send({ seatsCount: 1 }),
      ),
    );

    const confirmedHttp = checkoutResults.filter((r) => r.status === 201).length;
    expect(confirmedHttp).toBe(1);

    const confirmedDb = await prisma.offlineEventRegistration.count({
      where: { eventId: evt.id, status: { in: ['CONFIRMED', 'ATTENDED'] } },
    });
    expect(confirmedDb).toBe(1);
  });

  it('F-07 (Instructor isolation): restricts INSTRUCTOR visibility in /lms/sessions and /lms/assignments to assigned/owned courses', async () => {
    const instructorSession = await loginPhone(app, '+201000000101', 'BoslaInstructor#2026');

    const unownedCourse = await prisma.course.create({
      data: {
        slug: 'other-instructor-lms-course',
        instructorId: adminSession.user.id,
        status: 'PUBLISHED',
        isFree: false,
        priceCents: 30_000,
        allowIndividualPurchase: true,
        publishedAt: new Date(),
      },
    });
    const privateSession = await prisma.trainingSession.create({
      data: {
        courseId: unownedCourse.id,
        titleAr: 'جلسة خاصة بمدرب آخر',
        sessionType: 'ONLINE_LIVE',
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 90_000_000),
        manualMeetingUrl: 'https://zoom.us/j/private-other-instructor',
      },
    });
    const privateAssignment = await prisma.assignment.create({
      data: {
        courseId: unownedCourse.id,
        titleAr: 'واجب خاص بكورس غير مسند للمدرب',
        instructionsAr: 'لا ينبغي أن يظهر لمدرب آخر.',
        createdById: adminSession.user.id,
      },
    });

    const sesRes = await instructorSession.agent.get('/api/v1/lms/sessions').expect(200);
    expect((sesRes.body as Array<{ id: string }>).some((s) => s.id === privateSession.id)).toBe(false);

    const asgRes = await instructorSession.agent.get('/api/v1/lms/assignments').expect(200);
    expect((asgRes.body as Array<{ id: string }>).some((a) => a.id === privateAssignment.id)).toBe(false);
  });

  it('F-02 (Settlement capacity race): prevents two concurrent PENDING_PAYMENT orders from overbooking maxCapacity at settlement', async () => {
    const raceCourse = await prisma.course.create({
      data: {
        slug: 'settlement-race-cap-1',
        instructorId: adminSession.user.id,
        status: 'PUBLISHED',
        isFree: false,
        priceCents: 25_000,
        allowIndividualPurchase: true,
        maxCapacity: 1,
        waitlistEnabled: false,
        publishedAt: new Date(),
      },
    });

    await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'متنافس دفع 1',
        phoneNumber: '01055000012',
        countryCode: '+20',
        password: 'PayRace#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);
    await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'متنافس دفع 2',
        phoneNumber: '01055000013',
        countryCode: '+20',
        password: 'PayRace#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      })
      .expect(201);

    const b1 = await loginPhone(app, '+201055000012', 'PayRace#2026');
    const b2 = await loginPhone(app, '+201055000013', 'PayRace#2026');

    const [ord1, ord2] = await Promise.all([
      b1.agent
        .post('/api/v1/commerce/orders')
        .set('X-CSRF-Token', b1.csrf)
        .send({ courseIds: [raceCourse.id], paymentMethod: 'PAYMOB_CARD' }),
      b2.agent
        .post('/api/v1/commerce/orders')
        .set('X-CSRF-Token', b2.csrf)
        .send({ courseIds: [raceCourse.id], paymentMethod: 'PAYMOB_CARD' }),
    ]);

    const pendingOrders = [
      ord1.status === 201 ? { buyer: b1, orderNumber: ord1.body.order.orderNumber } : null,
      ord2.status === 201 ? { buyer: b2, orderNumber: ord2.body.order.orderNumber } : null,
    ].filter((x): x is { buyer: typeof b1; orderNumber: string } => Boolean(x));

    expect(pendingOrders).toHaveLength(2);

    const confirmStatuses: number[] = [];
    for (const p of pendingOrders) {
      const res = await p.buyer.agent
        .post(`/api/v1/commerce/orders/${p.orderNumber}/sandbox-confirm`)
        .set('X-CSRF-Token', p.buyer.csrf)
        .send({});
      confirmStatuses.push(res.status);
    }

    expect(confirmStatuses.filter((s) => s === 201)).toHaveLength(1);
    const enrolledCount = await prisma.courseEnrollment.count({ where: { courseId: raceCourse.id } });
    expect(enrolledCount).toBe(1);
  });

  it('Homepage course discovery: enforces publication rules and explicit safe allowlist on /catalog/homepage-courses', async () => {
    const draftCourse = await prisma.course.create({
      data: {
        slug: 'secret-homepage-draft-course',
        instructorId: adminSession.user.id,
        status: 'DRAFT',
        isFree: false,
        priceCents: 49_000,
      },
    });
    const draftVersion = await prisma.courseVersion.create({
      data: {
        courseId: draftCourse.id,
        versionNumber: 1,
        status: 'DRAFT',
        titleAr: 'مسودة كورس سرية لا يجب أن تظهر',
        descriptionAr: 'وصف مسودة داخلية',
        durationMinutes: 90,
      },
    });
    await prisma.course.update({
      where: { id: draftCourse.id },
      data: { draftVersionId: draftVersion.id },
    });

    const unpublishedCourse = await prisma.course.create({
      data: {
        slug: 'hidden-unpublished-course',
        instructorId: adminSession.user.id,
        status: 'UNPUBLISHED',
        isFree: false,
        priceCents: 35_000,
      },
    });
    const unpubVersion = await prisma.courseVersion.create({
      data: {
        courseId: unpublishedCourse.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        titleAr: 'كورس موقوف لا يجب عرضه',
        descriptionAr: 'موقوف عن العرض العام',
        durationMinutes: 60,
      },
    });
    await prisma.course.update({
      where: { id: unpublishedCourse.id },
      data: { publishedVersionId: unpubVersion.id },
    });

    const publicRes = await request(app.getHttpServer()).get('/api/v1/catalog/homepage-courses').expect(200);
    const body = publicRes.body as {
      courses: Array<Record<string, any>>;
      categories: Array<{ id: string; slug: string; nameAr: string }>;
      stats: { publishedCoursesCount: number; activeInstructorsCount: number };
    };

    expect(Array.isArray(body.courses)).toBe(true);
    expect(body.courses.length).toBeGreaterThanOrEqual(4);
    expect(body.courses.some((c) => c.slug === 'secret-homepage-draft-course')).toBe(false);
    expect(body.courses.some((c) => c.slug === 'hidden-unpublished-course')).toBe(false);

    // Explicit featuredOrder ascending comes first
    const featuredCourses = body.courses.filter((c) => c.featuredOrder !== null);
    for (let i = 1; i < featuredCourses.length; i += 1) {
      expect(featuredCourses[i].featuredOrder).toBeGreaterThanOrEqual(featuredCourses[i - 1].featuredOrder);
    }

    // Explicit allowlist check: no sections, lessons, articleContentAr, videoAssetId, or instructor PII
    for (const c of body.courses) {
      expect(typeof c.slug).toBe('string');
      expect(typeof c.titleAr).toBe('string');
      expect(typeof c.lessonCount).toBe('number');
      expect(c).not.toHaveProperty('publishedVersion');
      expect(c).not.toHaveProperty('sections');
      expect(c).not.toHaveProperty('lessons');
      expect(c).not.toHaveProperty('reviews');
      expect(c).not.toHaveProperty('scheduledPublishAt');
      expect(c.instructor).not.toHaveProperty('email');
      expect(c.instructor).not.toHaveProperty('phoneE164');
      expect(c.instructor).not.toHaveProperty('passwordHash');
    }

    expect(body.stats.publishedCoursesCount).toBe(body.courses.length);
    expect(Array.isArray(body.partners)).toBe(true);
    for (const p of body.partners) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.nameAr).toBe('string');
    }
  });

  it('Partner applications: validates email/phone, blocks honeypot spam, and persists SPONSOR lead', async () => {
    // Reject honeypot bot submission
    await request(app.getHttpServer())
      .post('/api/v1/catalog/partner-applications')
      .send({
        fullName: 'Bot Account',
        organizationName: 'Spam Org',
        email: 'bot@example.com',
        partnershipInterest: 'CORPORATE_TRAINING',
        website: 'https://spam.example.com',
      })
      .expect(400);

    // Reject missing phone AND email
    await request(app.getHttpServer())
      .post('/api/v1/catalog/partner-applications')
      .send({
        fullName: 'طارق الدسوقي',
        organizationName: 'مزارع الدلتا',
        partnershipInterest: 'FIELD_INTERNSHIP',
      })
      .expect(400);

    // Persist email-only valid partnership request
    const okRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/partner-applications')
      .send({
        fullName: 'م. عمر الشاذلي',
        organizationName: 'الشركة المتحدة للأعلاف',
        email: 'omar.partner@unitedfeed.example',
        partnershipInterest: 'CORPORATE_TRAINING',
        notes: 'تأهيل 30 مهندس تغذية ومبيعات',
      })
      .expect(201);

    expect(okRes.body.ok).toBe(true);
    expect(okRes.body.application.type).toBe('SPONSOR');
    expect(okRes.body.application.companyName).toBe('الشركة المتحدة للأعلاف');

    const stored = await prisma.leadSubmission.findUnique({
      where: { id: okRes.body.application.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.email).toBe('omar.partner@unitedfeed.example');
    expect(stored?.type).toBe('SPONSOR');
  });
});
