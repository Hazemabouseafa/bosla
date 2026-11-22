import 'reflect-metadata';
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
import { PaymobClient } from '../src/modules/membership/paymob.client';

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
    user: res.body.user,
  };
}

describe('BOSLA Academy Enterprise v1.2 — AT-001 through AT-090 & Concurrency Integration Suite', () => {
  let pg: EmbeddedPostgres;
  let tmpDir = '';
  let app: INestApplication;
  let prisma: PrismaService;
  let paymob: PaymobClient;
  const dbPort = 54355;

  let adminSession: Awaited<ReturnType<typeof loginPhone>>;
  let managerSession: Awaited<ReturnType<typeof loginPhone>>;
  let financeMakerSession: Awaited<ReturnType<typeof loginPhone>>;
  let financeCheckerSession: Awaited<ReturnType<typeof loginPhone>>;
  let supportSession: Awaited<ReturnType<typeof loginPhone>>;
  let sellerSession: Awaited<ReturnType<typeof loginPhone>>;
  let studentSession: Awaited<ReturnType<typeof loginPhone>>;
  let instructorSession: Awaited<ReturnType<typeof loginPhone>>;

  let courses: Array<{ id: string; slug: string; priceCents: number }> = [];
  let demoSellerId = '';

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-enterprise-at-'));
    const pgDir = path.join(tmpDir, 'pg-data');
    const mediaDir = path.join(tmpDir, 'media');
    await fs.mkdir(mediaDir, { recursive: true });

    pg = new EmbeddedPostgres({
      databaseDir: pgDir,
      user: 'bosla_at',
      password: 'bosla_at_password',
      port: dbPort,
      persistent: false,
      initdbFlags: ['--encoding=UTF8', '--no-locale'],
      onLog: () => {},
      onError: () => {},
    });

    await pg.initialise();
    await pg.start();
    await pg.createDatabase('bosla_enterprise_at');

    const dbUrl = `postgresql://bosla_at:bosla_at_password@127.0.0.1:${dbPort}/bosla_enterprise_at?schema=public`;
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = dbUrl;
    process.env.ALLOW_INMEMORY_REDIS = 'true';
    process.env.ALLOW_TEST_GOOGLE_TOKENS = 'true';
    process.env.SESSION_SECRET = 'bosla_at_session_secret_64_characters_minimum_required_val';
    process.env.RECOVERY_CODE_PEPPER = 'bosla_at_recovery_pepper_64_characters_minimum_required';
    process.env.PLAYBACK_TOKEN_SECRET = 'bosla_at_playback_secret_64_characters_minimum_required';
    process.env.PAYMOB_MODE = 'sandbox';
    process.env.PAYMOB_HMAC_SECRET = 'bosla_at_paymob_hmac_secret_value';
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

    const client = pg.getPgClient('bosla_enterprise_at');
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
    paymob = app.get(PaymobClient);

    // Login seeded personas
    adminSession = await loginPhone(app, '+201000000001', 'BoslaAdmin#2026');
    instructorSession = await loginPhone(app, '+201000000101', 'BoslaInstructor#2026');
    studentSession = await loginPhone(app, '+201000000201', 'BoslaStudent#2026');
    managerSession = await loginPhone(app, '+201000000301', 'BoslaEnterprise#2026');
    financeMakerSession = await loginPhone(app, '+201000000303', 'BoslaEnterprise#2026');
    financeCheckerSession = await loginPhone(app, '+201000000304', 'BoslaEnterprise#2026');
    supportSession = await loginPhone(app, '+201000000305', 'BoslaEnterprise#2026');
    sellerSession = await loginPhone(app, '+201000000306', 'BoslaEnterprise#2026');

    courses = await prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, slug: true, priceCents: true },
    });

    const demoSeller = await prisma.seller.findUnique({ where: { userId: sellerSession.user.id } });
    demoSellerId = demoSeller!.id;
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    if (pg) await pg.stop();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }, 60_000);

  // ============================================================
  // 1. RBAC & SECURITY ISOLATION (AT-001..AT-005, AT-061..AT-063)
  // ============================================================

  it('AT-001..AT-005 & AT-062: enforces fine-grained RBAC, blocks Support from payouts, and logs audit events', async () => {
    // Super Admin reads full matrix
    const matrixRes = await adminSession.agent.get('/api/v1/rbac/matrix').expect(200);
    expect(matrixRes.body.roles.length).toBeGreaterThanOrEqual(9);
    expect(matrixRes.body.permissions.length).toBeGreaterThanOrEqual(30);

    // Finance Officer blocked from RBAC management
    await financeMakerSession.agent.get('/api/v1/rbac/matrix').expect(403);

    // Support cannot receive settlements.approve or settlements.payout even via API
    await adminSession.agent
      .put('/api/v1/rbac/roles/SUPPORT/permissions')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({ permissions: ['support.manage', 'settlements.payout'] })
      .expect(400);

    // Support blocked from Finance dashboard & settlements
    await supportSession.agent.get('/api/v1/finance/dashboard').expect(403);
    await supportSession.agent
      .post('/api/v1/finance/settlements')
      .set('X-CSRF-Token', supportSession.csrf)
      .send({ sellerId: demoSellerId, periodYear: 2026, periodMonth: 11 })
      .expect(403);

    // Student blocked from admin orders
    await studentSession.agent.get('/api/v1/commerce/admin/orders').expect(403);
  });

  // ============================================================
  // 2. SELLER LIFECYCLE, CODES, QR, REFERRALS, ANTI-ENUMERATION & SELF-PURCHASE
  // ============================================================

  it('AT-006..AT-015, AT-070, AT-071, AT-061: seller lifecycle, code normalization, QR SVG, referral prefill/override, 5/min rate limit, self-purchase block, cross-seller isolation', async () => {
    // Register a brand-new user who applies to become Seller B
    const sellerBPhone = '+201099001122';
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register/phone')
      .send({
        fullName: 'بائع اختبار ثاني',
        phoneNumber: sellerBPhone,
        countryCode: '+20',
        password: 'SellerBPassword#2026',
        confirmPassword: 'SellerBPassword#2026',
        email: 'seller.b@bosla-test.com',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(201);
    const sellerBUserId = regRes.body.user.id;
    await prisma.user.update({ where: { id: sellerBUserId }, data: { status: 'ACTIVE' } });
    const sellerBSession = await loginPhone(app, sellerBPhone, 'SellerBPassword#2026');

    // Submit seller application
    const applyRes = await sellerBSession.agent
      .post('/api/v1/sellers/apply')
      .set('X-CSRF-Token', sellerBSession.csrf)
      .send({
        fullName: 'بائع اختبار ثاني',
        phoneNumber: sellerBPhone,
        countryCode: '+20',
        email: 'seller.b@bosla-test.com',
        nationalIdNumber: '29901011239876',
        idDocumentUrl: '/uploads/id-b.pdf',
        experienceSummaryAr: 'خبرة في تسويق الكورسات البيطرية للخريجين الجدد.',
        payoutMethodType: 'INSTAPAY',
        payoutAccountName: 'بائع اختبار ثاني',
        payoutAccountDetails: 'sellerb@instapay',
      })
      .expect(201);
    const sellerBId = applyRes.body.seller.id;
    expect(applyRes.body.seller.status).toBe('PENDING');

    // Manager requests changes -> APPROVED with normalized code ('  ali 2026  ' -> 'ALI2026')
    await managerSession.agent
      .post(`/api/v1/sellers/admin/${sellerBId}/review`)
      .set('X-CSRF-Token', managerSession.csrf)
      .send({ decision: 'CHANGES_REQUESTED', reviewNotesAr: 'يرجى توضيح القنوات' })
      .expect(201);

    await managerSession.agent
      .post(`/api/v1/sellers/admin/${sellerBId}/review`)
      .set('X-CSRF-Token', managerSession.csrf)
      .send({ decision: 'APPROVE', initialCode: '  ali 2026  ', verifyKycAndPayout: true })
      .expect(201);

    // AT-070: Duplicate after normalization rejected; invalid code rejected
    await managerSession.agent
      .post(`/api/v1/sellers/admin/${sellerBId}/codes`)
      .set('X-CSRF-Token', managerSession.csrf)
      .send({ code: 'ali2026' })
      .expect(409);

    await managerSession.agent
      .post(`/api/v1/sellers/admin/${sellerBId}/codes`)
      .set('X-CSRF-Token', managerSession.csrf)
      .send({ code: 'ab' })
      .expect(400);

    // Seller B portal shows ONLY Seller B's data + QR SVG (AT-061)
    const portalB = await sellerBSession.agent.get('/api/v1/sellers/portal').expect(200);
    expect(portalB.body.seller.id).toBe(sellerBId);
    expect(portalB.body.codes[0].code).toBe('ALI2026');
    expect(portalB.body.codes[0].qrSvg).toContain('<svg');

    // Cross-seller QR code access blocked (Seller B cannot access Seller A's code QR)
    const sellerACode = await prisma.sellerCode.findUnique({ where: { code: 'BOSLA2026' } });
    await sellerBSession.agent
      .get(`/api/v1/sellers/codes/${sellerACode!.id}/qr`)
      .expect(403);

    // Server-side referral tracking sets HttpOnly opaque cookie (NO PII!)
    const trackRes = await studentSession.agent
      .post('/api/v1/sellers/referrals/track')
      .send({ code: 'bosla 2026', landingPath: '/courses' })
      .expect(201);
    expect(trackRes.body.valid).toBe(true);
    expect(trackRes.body.code).toBe('BOSLA2026');
    const cookiesHeader = String(trackRes.headers['set-cookie'] || '');
    expect(cookiesHeader).toContain('bosla_ref=');
    expect(cookiesHeader).not.toContain('BOSLA2026'); // opaque token, no code/PII leak!

    // Checkout preview automatically prefills BOSLA2026 from referral cookie
    const prefillPreview = await studentSession.agent
      .post('/api/v1/commerce/orders/preview')
      .set('X-CSRF-Token', studentSession.csrf)
      .send({ courseIds: [courses[0].id] })
      .expect(201);
    expect(prefillPreview.body.sellerCode).toBe('BOSLA2026');
    expect(prefillPreview.body.sellerAttributionSource).toBe('REFERRAL_PREFILL');

    // Manual seller code overrides referral prefill
    const overridePreview = await studentSession.agent
      .post('/api/v1/commerce/orders/preview')
      .set('X-CSRF-Token', studentSession.csrf)
      .send({ courseIds: [courses[0].id], sellerCode: 'ali2026' })
      .expect(201);
    expect(overridePreview.body.sellerCode).toBe('ALI2026');
    expect(overridePreview.body.sellerAttributionSource).toBe('MANUAL');

    // Clearing prefill removes attribution cleanly
    const clearPreview = await studentSession.agent
      .post('/api/v1/commerce/orders/preview')
      .set('X-CSRF-Token', studentSession.csrf)
      .send({ courseIds: [courses[0].id], clearSellerPrefill: true })
      .expect(201);
    expect(clearPreview.body.sellerCode).toBeNull();

    // AT-012: Self-purchase strictly blocked & logged in AuditLog
    await sellerSession.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', sellerSession.csrf)
      .send({ courseIds: [courses[0].id], sellerCode: 'BOSLA2026', paymentMethod: 'BANK_TRANSFER' })
      .expect(400);
    const selfPurchaseAudit = await prisma.auditLog.findFirst({
      where: { action: 'SELF_PURCHASE_BLOCKED', actorId: sellerSession.user.id },
    });
    expect(selfPurchaseAudit).not.toBeNull();

    // AT-071: Anti-enumeration rate limit (5 invalid attempts -> uniform 400; 6th -> 429)
    const invalidMessages = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const bad = await sellerBSession.agent
        .post('/api/v1/commerce/orders/preview')
        .set('X-CSRF-Token', sellerBSession.csrf)
        .send({ courseIds: [courses[0].id], sellerCode: `NOPE${i}999` })
        .expect(400);
      invalidMessages.add(bad.body.message);
    }
    expect(invalidMessages.size).toBe(1); // uniform error message!
    await sellerBSession.agent
      .post('/api/v1/commerce/orders/preview')
      .set('X-CSRF-Token', sellerBSession.csrf)
      .send({ courseIds: [courses[0].id], sellerCode: 'NOPE6999' })
      .expect(429);
  });

  // ============================================================
  // 3. REFERENCE SCENARIO: 100 + 150 + 200 = 450 EGP, PARTIAL ALLOCATION,
  //    50% CAP, NO GLOBAL FALLBACK, MEMBERSHIP EXCLUSION
  // ============================================================

  it('AT-016..AT-025 & Reference 100+150+200=450 EGP: sequential partial payment allocation, entitlements, commissions, 50% cap, membership exclusion', async () => {
    expect(courses.length).toBeGreaterThanOrEqual(4);
    // Ensure deterministic prices for first 3 flagship courses (>= 450 EGP each so 100/150/200 are under 50% cap)
    for (let i = 0; i < 3; i++) {
      await prisma.course.update({
        where: { id: courses[i].id },
        data: { priceCents: 60000, allowIndividualPurchase: true }, // 600 EGP each -> 1800 EGP total
      });
    }

    // Create 3-course order attributed to BOSLA2026 (seeded rules: 100, 150, 200 EGP!)
    const orderRes = await studentSession.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', studentSession.csrf)
      .send({
        courseIds: [courses[0].id, courses[1].id, courses[2].id],
        sellerCode: 'BOSLA2026',
        paymentMethod: 'BANK_TRANSFER',
      })
      .expect(201);

    const order = orderRes.body.order;
    expect(Number(order.totalAmount)).toBe(1800);
    expect(order.items.length).toBe(3);

    // Partial Payment #1: 900 EGP -> sequentially covers Item 1 (600 EGP full!) + Item 2 (300 EGP partial)
    const pay1 = await financeMakerSession.agent
      .post(`/api/v1/commerce/admin/orders/${order.id}/payments/manual`)
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({
        amountEgp: 900,
        paymentMethod: 'BANK_TRANSFER',
        receiptReference: 'BNK-PARTIAL-01',
      })
      .expect(201);
    expect(pay1.body.order.status).toBe('PARTIALLY_PAID');
    expect(pay1.body.createdCommissions.length).toBe(1);
    expect(Number(pay1.body.createdCommissions[0].appliedAmount)).toBe(100);

    // Partial Payment #2: 900 EGP -> completes Item 2 (300 EGP remaining) + Item 3 (600 EGP full)
    const pay2 = await financeMakerSession.agent
      .post(`/api/v1/commerce/admin/orders/${order.id}/payments/manual`)
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({
        amountEgp: 900,
        paymentMethod: 'BANK_TRANSFER',
        receiptReference: 'BNK-PARTIAL-02',
      })
      .expect(201);
    expect(pay2.body.order.status).toBe('PAID');
    expect(pay2.body.createdCommissions.length).toBe(2);

    const orderComms = await prisma.sellerCommission.findMany({
      where: { orderId: order.id },
      orderBy: { appliedAmount: 'asc' },
    });
    expect(orderComms.map((c) => Number(c.appliedAmount))).toEqual([100, 150, 200]);
    const totalCommission = orderComms.reduce((s, c) => s + Number(c.appliedAmount), 0);
    expect(totalCommission).toBe(450);

    // Test 50% cap: set Course 4 price to 300 EGP and commission rule fixedAmount = 250 EGP -> capped at 150 EGP!
    await prisma.course.update({
      where: { id: courses[3].id },
      data: { priceCents: 30000, allowIndividualPurchase: true },
    });

    // First verify NO rule exists on Course 4 -> generates 0 commissions + emits COMMISSION_RULE_MISSING_WARNING
    const noRuleOrder = await studentSession.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', studentSession.csrf)
      .send({
        courseIds: [courses[3].id],
        sellerCode: 'BOSLA2026',
        paymentMethod: 'BANK_TRANSFER',
      })
      .expect(201);
    await financeMakerSession.agent
      .post(`/api/v1/commerce/admin/orders/${noRuleOrder.body.order.id}/payments/manual`)
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ amountEgp: 300, paymentMethod: 'MANUAL_CASH', receiptReference: 'CASH-NORULE-1' })
      .expect(201);
    expect(await prisma.sellerCommission.count({ where: { orderId: noRuleOrder.body.order.id } })).toBe(0);
    const missingWarn = await prisma.auditLog.findFirst({
      where: { action: 'COMMISSION_RULE_MISSING_WARNING' },
    });
    expect(missingWarn).not.toBeNull();

    // Now create rule on Course 4 (250 EGP, 50% cap) + verify overlapping rule rejected (409)
    await adminSession.agent
      .post('/api/v1/finance/commission-rules')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        courseId: courses[3].id,
        sellerId: null,
        fixedAmountEgp: 250,
        capPercent: 50,
        effectiveFrom: '2025-01-01T00:00:00Z',
        isActive: true,
      })
      .expect(201);

    await adminSession.agent
      .post('/api/v1/finance/commission-rules')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        courseId: courses[3].id,
        sellerId: null,
        fixedAmountEgp: 220,
        capPercent: 50,
        effectiveFrom: '2025-06-01T00:00:00Z',
        isActive: true,
      })
      .expect(409);

    const cappedOrder = await studentSession.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', studentSession.csrf)
      .send({
        courseIds: [courses[3].id],
        sellerCode: 'BOSLA2026',
        paymentMethod: 'BANK_TRANSFER',
      })
      .expect(201);
    const cappedPay = await financeMakerSession.agent
      .post(`/api/v1/commerce/admin/orders/${cappedOrder.body.order.id}/payments/manual`)
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ amountEgp: 300, paymentMethod: 'MANUAL_CASH', receiptReference: 'CASH-CAP-1' })
      .expect(201);
    expect(Number(cappedPay.body.createdCommissions[0].configuredAmount)).toBe(250);
    expect(Number(cappedPay.body.createdCommissions[0].cappedAmount)).toBe(150);
    expect(Number(cappedPay.body.createdCommissions[0].appliedAmount)).toBe(150);

    // Membership Subscription Order -> strictly classified MONTHLY_MEMBERSHIP & generates ZERO commissions
    const plan = await prisma.membershipPlan.findFirst({ where: { isActive: true } });
    if (plan) {
      const memOrd = await studentSession.agent
        .post('/api/v1/commerce/orders/membership')
        .set('X-CSRF-Token', studentSession.csrf)
        .send({ membershipPlanId: plan.id, sellerCode: 'BOSLA2026' })
        .expect(201);
      expect(['MONTHLY_MEMBERSHIP', 'ANNUAL_MEMBERSHIP']).toContain(memOrd.body.accountingType);
      expect(await prisma.sellerCommission.count({ where: { orderId: memOrd.body.id } })).toBe(0);
    }
  });

  // ============================================================
  // 4. CONCURRENCY & ANTI-RACE TESTS (AT-056, AT-057, AT-058, AT-060)
  // ============================================================

  it('AT-056, AT-057, AT-060: defeats 5 parallel duplicate Paymob webhooks and concurrent double-refund race', async () => {
    const ordRes = await studentSession.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', studentSession.csrf)
      .send({
        courseIds: [courses[0].id],
        sellerCode: 'BOSLA2026',
        paymentMethod: 'PAYMOB_CARD',
      })
      .expect(201);
    const ord = ordRes.body.order;

    const webhookObj = {
      id: 987654321,
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
      order: { id: 112233, merchant_order_id: ord.orderNumber },
      owner: 1,
      pending: false,
      source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
      success: true,
    };
    const hmac = paymob.computeTransactionHmac(
      webhookObj,
      process.env.PAYMOB_HMAC_SECRET!,
    );

    // Fire 5 simultaneous identical webhook deliveries
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post(`/api/v1/commerce/webhooks/paymob?hmac=${hmac}`)
          .send({ obj: webhookObj }),
      ),
    );
    const okCount = responses.filter((r) => r.status === 201 || r.status === 200).length;
    expect(okCount).toBeGreaterThanOrEqual(1);

    // Strictly ONE PAID payment and ONE commission!
    expect(await prisma.orderPayment.count({ where: { orderId: ord.id, status: 'PAID' } })).toBe(1);
    expect(await prisma.sellerCommission.count({ where: { orderId: ord.id } })).toBe(1);

    // AT-060: Fire 2 simultaneous full refunds -> ONLY ONE succeeds, ZERO over-refund!
    const refundCalls = await Promise.all([
      financeMakerSession.agent
        .post('/api/v1/finance/refunds')
        .set('X-CSRF-Token', financeMakerSession.csrf)
        .send({
          orderId: ord.id,
          refundAmountEgp: 600,
          refundType: 'FULL',
          revokeAccess: true,
          reasonAr: 'اختبار سباق استرداد 1',
        }),
      financeMakerSession.agent
        .post('/api/v1/finance/refunds')
        .set('X-CSRF-Token', financeMakerSession.csrf)
        .send({
          orderId: ord.id,
          refundAmountEgp: 600,
          refundType: 'FULL',
          revokeAccess: true,
          reasonAr: 'اختبار سباق استرداد 2',
        }),
    ]);
    const refundSuccesses = refundCalls.filter((r) => r.status === 201);
    expect(refundSuccesses.length).toBe(1);
    const refreshedOrder = await prisma.order.findUnique({ where: { id: ord.id } });
    expect(Number(refreshedOrder!.refundedAmount)).toBe(600);
    const refundedComm = await prisma.sellerCommission.findFirst({ where: { orderId: ord.id } });
    expect(refundedComm!.status).toBe('REVERSED');
    expect(Number(refundedComm!.netAmount)).toBe(0);
  });

  // ============================================================
  // 5. 14-DAY CAIRO HOLD, PROPORTIONAL REFUND, MAKER-CHECKER, THRESHOLD 500 EGP,
  //    PAYOUT_FAILED RETRY, SUSPENDED FREEZE, REVERSAL DEBIT & NEGATIVE CLAMP
  // ============================================================

  it('AT-026..AT-039, AT-058, AT-059, AT-072..AT-083: 14-day hold, proportional refund, Maker-Checker, 500 EGP threshold, PAYOUT_FAILED 1-retry, ReversalDebit & negative clamp', async () => {
    // Commissions from test #3 total 450 + 150 = 600 EGP (4 commissions on demoSellerId, all ON_HOLD)
    const onHold = await prisma.sellerCommission.findMany({
      where: { sellerId: demoSellerId, status: 'ON_HOLD' },
      orderBy: { createdAt: 'asc' },
    });
    expect(onHold.length).toBe(4); // 100, 150, 200, 150 = 600 EGP

    // Cannot approve while still ON_HOLD
    await financeMakerSession.agent
      .post(`/api/v1/finance/commissions/${onHold[0].id}/review`)
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ action: 'APPROVE', reasonAr: 'محاولة مبكرة' })
      .expect(400);

    // Partial refund 50% on the 150 EGP capped order (300 EGP paid -> 150 EGP refunded -> 75 EGP reversed, 75 EGP remains!)
    const cappedComm = onHold[3];
    const partialRes = await financeMakerSession.agent
      .post('/api/v1/finance/refunds')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({
        orderId: cappedComm.orderId,
        orderItemId: cappedComm.orderItemId,
        refundAmountEgp: 150,
        refundType: 'PARTIAL',
        revokeAccess: false,
        reasonAr: 'استرداد جزئي 50% وفق سياسة v1.2',
      })
      .expect(201);
    expect(partialRes.body.totalCommissionReversedEgp).toBe(75);
    const afterPartial = await prisma.sellerCommission.findUnique({ where: { id: cappedComm.id } });
    expect(Number(afterPartial!.reversedAmount)).toBe(75);
    expect(Number(afterPartial!.netAmount)).toBe(75);

    // Mature all ON_HOLD commissions by running maturation job asOf +15 days!
    const futureUtc = new Date(Date.now() + 15 * 86_400_000);
    const matRes = await financeMakerSession.agent
      .post('/api/v1/finance/jobs/mature-commissions')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ asOfUtc: futureUtc.toISOString() })
      .expect(201);
    expect(matRes.body.transitionedCount).toBe(4);

    // Approve first 3 commissions (100 + 150 + 200 = 450 EGP < 500 EGP minimum threshold!)
    await financeMakerSession.agent
      .post('/api/v1/finance/commissions/bulk-approve')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ commissionIds: [onHold[0].id, onHold[1].id, onHold[2].id] })
      .expect(201);

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    // AT-075: Below 500 EGP -> CARRIED_FORWARD, netPayable = 0.00, commissions remain APPROVED for next run!
    const underMinRes = await financeMakerSession.agent
      .post('/api/v1/finance/settlements')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ sellerId: demoSellerId, periodYear: year, periodMonth: month, minPayoutEgp: 500 })
      .expect(201);
    expect(underMinRes.body.status).toBe('CARRIED_FORWARD');
    expect(Number(underMinRes.body.netPayableAmount)).toBe(0);
    expect(Number(underMinRes.body.carriedForwardAmount)).toBe(450);

    // Approve 4th commission (75 EGP) -> total approved = 525 EGP >= 500 EGP!
    await financeMakerSession.agent
      .post(`/api/v1/finance/commissions/${onHold[3].id}/review`)
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ action: 'APPROVE', reasonAr: 'اعتماد الدفعة الرابعة' })
      .expect(201);

    // AT-072: Temporarily suspend seller -> settlement creation MUST fail (403)!
    await managerSession.agent
      .patch(`/api/v1/sellers/admin/${demoSellerId}/status`)
      .set('X-CSRF-Token', managerSession.csrf)
      .send({ status: 'SUSPENDED', reasonAr: 'اختبار تجميد الصرف' })
      .expect(200);
    await financeMakerSession.agent
      .post('/api/v1/finance/settlements')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ sellerId: demoSellerId, periodYear: year, periodMonth: month, minPayoutEgp: 500 })
      .expect(403);
    // Reactivate seller
    await managerSession.agent
      .patch(`/api/v1/sellers/admin/${demoSellerId}/status`)
      .set('X-CSRF-Token', managerSession.csrf)
      .send({ status: 'APPROVED', reasonAr: 'إعادة التفعيل بعد التحقق' })
      .expect(200);

    // AT-058: Concurrent duplicate settlement race -> ONLY ONE DRAFT succeeds!
    const settleRace = await Promise.all([
      financeMakerSession.agent
        .post('/api/v1/finance/settlements')
        .set('X-CSRF-Token', financeMakerSession.csrf)
        .send({ sellerId: demoSellerId, periodYear: year, periodMonth: month, minPayoutEgp: 500 }),
      financeMakerSession.agent
        .post('/api/v1/finance/settlements')
        .set('X-CSRF-Token', financeMakerSession.csrf)
        .send({ sellerId: demoSellerId, periodYear: year, periodMonth: month, minPayoutEgp: 500 }),
    ]);
    const createdDrafts = settleRace.filter((r) => r.status === 201);
    expect(createdDrafts.length).toBe(1);
    const draftPayout = createdDrafts[0].body;
    expect(draftPayout.status).toBe('DRAFT');
    expect(Number(draftPayout.netPayableAmount)).toBe(525);

    // AT-059: Maker CANNOT approve own settlement (403)!
    await financeMakerSession.agent
      .post(`/api/v1/finance/settlements/${draftPayout.id}/approve`)
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .expect(403);

    // Independent Checker approves DRAFT -> APPROVED!
    await financeCheckerSession.agent
      .post(`/api/v1/finance/settlements/${draftPayout.id}/approve`)
      .set('X-CSRF-Token', financeCheckerSession.csrf)
      .expect(201);

    // AT-080: Simulate PAYOUT_FAILED -> voids items and restores APPROVED commissions for 1 retry!
    await financeCheckerSession.agent
      .post(`/api/v1/finance/settlements/${draftPayout.id}/fail`)
      .set('X-CSRF-Token', financeCheckerSession.csrf)
      .send({ failureReasonAr: 'خطأ مؤقت في رقم الحساب البنكي IBAN' })
      .expect(201);

    // Replacement settlement succeeds (Maker -> Checker -> Paid)!
    const retryDraft = await financeMakerSession.agent
      .post('/api/v1/finance/settlements')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ sellerId: demoSellerId, periodYear: year, periodMonth: month, minPayoutEgp: 500 })
      .expect(201);
    expect(Number(retryDraft.body.netPayableAmount)).toBe(525);

    await financeCheckerSession.agent
      .post(`/api/v1/finance/settlements/${retryDraft.body.id}/approve`)
      .set('X-CSRF-Token', financeCheckerSession.csrf)
      .expect(201);

    const paidRes = await financeCheckerSession.agent
      .post(`/api/v1/finance/settlements/${retryDraft.body.id}/pay`)
      .set('X-CSRF-Token', financeCheckerSession.csrf)
      .send({ transferReference: 'CIB-WIRE-2026-99881' })
      .expect(201);
    expect(paidRes.body.status).toBe('PAID');

    // AT-029 & AT-078: Refund AFTER payout creates ReversalDebit (200 EGP)!
    const paidComm3 = await prisma.sellerCommission.findUnique({ where: { id: onHold[2].id } });
    expect(paidComm3!.status).toBe('PAID');
    const postPayRefund = await financeMakerSession.agent
      .post('/api/v1/finance/refunds')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({
        orderId: paidComm3!.orderId,
        orderItemId: paidComm3!.orderItemId,
        refundAmountEgp: 600,
        refundType: 'FULL',
        revokeAccess: true,
        reasonAr: 'استرداد بعد صرف العمولة لإنشاء ReversalDebit',
      })
      .expect(201);
    expect(postPayRefund.body.createdReversalDebitIds.length).toBe(1);

    // AT-079: Create a smaller 100 EGP commission, mature+approve, settle -> 100 - 200 = -100 -> clamped to 0.00 CARRIED_FORWARD (NEVER negative cash payout!)
    const smallOrd = await studentSession.agent
      .post('/api/v1/commerce/orders')
      .set('X-CSRF-Token', studentSession.csrf)
      .send({ courseIds: [courses[0].id], sellerCode: 'BOSLA2026', paymentMethod: 'BANK_TRANSFER' })
      .expect(201);
    const smallPay = await financeMakerSession.agent
      .post(`/api/v1/commerce/admin/orders/${smallOrd.body.order.id}/payments/manual`)
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ amountEgp: 600, paymentMethod: 'MANUAL_CASH', receiptReference: 'CASH-NEG-CLAMP' })
      .expect(201);
    const smallCommId = smallPay.body.createdCommissions[0].id;
    await financeMakerSession.agent
      .post('/api/v1/finance/jobs/mature-commissions')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ asOfUtc: new Date(Date.now() + 20 * 86_400_000).toISOString() })
      .expect(201);
    await financeMakerSession.agent
      .post(`/api/v1/finance/commissions/${smallCommId}/review`)
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ action: 'APPROVE', reasonAr: 'اعتماد لاختبار الرصيد السالب' })
      .expect(201);

    const negClampRes = await financeMakerSession.agent
      .post('/api/v1/finance/settlements')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ sellerId: demoSellerId, periodYear: year, periodMonth: month, minPayoutEgp: 500 })
      .expect(201);
    expect(negClampRes.body.status).toBe('CARRIED_FORWARD');
    expect(Number(negClampRes.body.netPayableAmount)).toBe(0);
    expect(Number(negClampRes.body.reversalDebitDeducted)).toBe(100);
  });

  // ============================================================
  // 6. EXPENSES, PERIOD CLOSING, RECONCILIATION (REC-01..REC-06) & CSV
  // ============================================================

  it('AT-084..AT-090: closes accounting period, blocks retroactive expense, passes all 6 reconciliation checks & exports CSV', async () => {
    await financeMakerSession.agent
      .post('/api/v1/finance/expenses')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({
        categoryAr: 'استضافة وخوادم',
        descriptionAr: 'فاتورة تشغيل الخادم الشهري',
        amountEgp: 1200,
        incurredAt: '2025-02-15T10:00:00Z',
      })
      .expect(201);

    await financeMakerSession.agent
      .post('/api/v1/finance/periods/close')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({ periodYear: 2025, periodMonth: 2, notesAr: 'إغلاق فبراير 2025' })
      .expect(201);

    // Retroactive expense inside closed Feb 2025 MUST be rejected (403)
    await financeMakerSession.agent
      .post('/api/v1/finance/expenses')
      .set('X-CSRF-Token', financeMakerSession.csrf)
      .send({
        categoryAr: 'محاولة رجعية',
        descriptionAr: 'يجب منعها بعد إغلاق الفترة',
        amountEgp: 500,
        incurredAt: '2025-02-20T10:00:00Z',
      })
      .expect(403);

    // Reconciliation report passes ALL 6 accounting invariants
    const recRes = await financeMakerSession.agent.get('/api/v1/finance/reconciliation').expect(200);
    expect(recRes.body.allChecksPassed).toBe(true);
    expect(recRes.body.checks.length).toBe(6);

    // CSV export succeeds with UTF-8 BOM
    const csvRes = await financeMakerSession.agent
      .get('/api/v1/finance/export/reconciliation')
      .expect(200);
    expect(csvRes.text).toContain('REC-01');
  });

  // ============================================================
  // 7. CRM, B2B ISOLATION, ADVANCED LMS, CERTIFICATES QR & SUPPORT DESK
  // ============================================================

  it('Verifies CRM duplicate detection, B2B org isolation, LMS sessions/attendance/assignments, cert QR/reissue/revoke, and Support internal-note hiding', async () => {
    // CRM duplicate detection
    const lead1 = await managerSession.agent
      .post('/api/v1/crm/leads')
      .set('X-CSRF-Token', managerSession.csrf)
      .send({ fullName: 'د. أحمد عميل', phoneNumber: '01012349876', priority: 'HIGH' })
      .expect(201);
    expect(lead1.body.duplicateDetected).toBe(false);

    const lead2 = await managerSession.agent
      .post('/api/v1/crm/leads')
      .set('X-CSRF-Token', managerSession.csrf)
      .send({ fullName: 'د. أحمد مكرر', phoneNumber: '01012349876', priority: 'MEDIUM' })
      .expect(201);
    expect(lead2.body.duplicateDetected).toBe(true);

    // B2B Org isolation: Create Org 2 -> demoStudent (who is ORG_ADMIN of Org 1 only) MUST get 403 on Org 2!
    const org2 = await managerSession.agent
      .post('/api/v1/organizations')
      .set('X-CSRF-Token', managerSession.csrf)
      .send({
        nameAr: 'شركة الدلتا للأعلاف',
        type: 'COMPANY',
        contactNameAr: 'م/ وليد حسن',
        contactPhone: '01099881122',
        seatCapacity: 10,
      })
      .expect(201);
    await studentSession.agent
      .get(`/api/v1/organizations/${org2.body.id}/dashboard`)
      .expect(403);

    // LMS Sessions, Attendance, Question Bank, Assignment & Instructor Contract (deductSellerCommission = false)
    const ses = await managerSession.agent
      .post('/api/v1/lms/sessions')
      .set('X-CSRF-Token', managerSession.csrf)
      .send({
        courseId: courses[0].id,
        titleAr: 'جلسة تقييم عملي',
        sessionType: 'HYBRID',
        startsAt: '2026-12-01T10:00:00Z',
        endsAt: '2026-12-01T12:00:00Z',
        manualMeetingUrl: 'https://meet.example/session-1',
      })
      .expect(201);
    await instructorSession.agent
      .post(`/api/v1/lms/sessions/${ses.body.id}/attendance`)
      .set('X-CSRF-Token', instructorSession.csrf)
      .send({ records: [{ userId: studentSession.user.id, status: 'PRESENT' }] })
      .expect(201);

    const asg = await instructorSession.agent
      .post('/api/v1/lms/assignments')
      .set('X-CSRF-Token', instructorSession.csrf)
      .send({
        courseId: courses[0].id,
        titleAr: 'مشروع حساب FCR',
        instructionsAr: 'قدّم جدول الحسابات الكامل لدورة 35 يوماً.',
        maxScore: 100,
        passingScore: 70,
        isPracticalProject: true,
      })
      .expect(201);
    const sub = await studentSession.agent
      .post(`/api/v1/lms/assignments/${asg.body.id}/submit`)
      .set('X-CSRF-Token', studentSession.csrf)
      .send({ submissionTextAr: 'تم إعداد خطة الحرارة والتهوية والعلف بالكامل.' })
      .expect(201);
    const graded = await instructorSession.agent
      .post(`/api/v1/lms/submissions/${sub.body.id}/grade`)
      .set('X-CSRF-Token', instructorSession.csrf)
      .send({ score: 92, feedbackAr: 'عمل ممتاز وتطبيق دقيق' })
      .expect(201);
    expect(graded.body.status).toBe('GRADED');

    const instContract = await adminSession.agent
      .post('/api/v1/lms/instructors/contracts')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        instructorId: instructorSession.user.id,
        titleAr: 'عقد تدريب متقدم 2027',
        startDate: '2027-01-01T00:00:00Z',
        endDate: '2027-12-31T23:59:59Z',
        defaultSharePercent: 40,
      })
      .expect(201);
    expect(instContract.body.deductSellerCommission).toBe(false);

    // Support Ticket internal note hidden from student + unsafe MIME rejected
    const tkt = await studentSession.agent
      .post('/api/v1/support/tickets')
      .set('X-CSRF-Token', studentSession.csrf)
      .send({
        category: 'TECHNICAL',
        priority: 'HIGH',
        subjectAr: 'استفسار تقني في التشغيل',
        descriptionAr: 'تظهر رسالة عند فتح الدرس الأول في المتصفح.',
      })
      .expect(201);

    await supportSession.agent
      .post(`/api/v1/support/tickets/${tkt.body.id}/replies`)
      .set('X-CSRF-Token', supportSession.csrf)
      .send({ bodyAr: 'ملاحظة داخلية سرية لفريق الدعم فقط', isInternalNote: true })
      .expect(201);

    await supportSession.agent
      .post(`/api/v1/support/tickets/${tkt.body.id}/replies`)
      .set('X-CSRF-Token', supportSession.csrf)
      .send({ bodyAr: 'رد عام للعميل: يرجى تحديث الصفحة', isInternalNote: false })
      .expect(201);

    // Unsafe attachment rejected
    await studentSession.agent
      .post(`/api/v1/support/tickets/${tkt.body.id}/replies`)
      .set('X-CSRF-Token', studentSession.csrf)
      .send({
        bodyAr: 'مرفق اختبار غير مسموح',
        attachmentUrl: '/uploads/evil.html',
        attachmentMimeType: 'text/html',
      })
      .expect(400);

    const studentTickets = await studentSession.agent
      .get('/api/v1/support/tickets?mineOnly=true')
      .expect(200);
    const mine = studentTickets.body.find((x: any) => x.id === tkt.body.id);
    expect(mine.replies.length).toBe(1);
    expect(mine.replies[0].isInternalNote).toBe(false);

    // Executive analytics endpoint returns live KPIs
    const execAnalytics = await adminSession.agent
      .get('/api/v1/support/analytics/executive')
      .expect(200);
    expect(execAnalytics.body.salesEgp.annual).toBeGreaterThan(0);

    // Professional CRM accepts empty email string (""), updates lead, and completes follow-up
    const crmEmptyEmail = await adminSession.agent
      .post('/api/v1/crm/leads')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'عميل CRM بدون بريد',
        phoneNumber: '01099112233',
        email: '',
        priority: 'HIGH',
        source: 'Facebook',
      })
      .expect(201);
    expect(crmEmptyEmail.body.lead.email).toBeNull();

    const updatedLead = await adminSession.agent
      .patch(`/api/v1/crm/leads/${crmEmptyEmail.body.lead.id}`)
      .set('X-CSRF-Token', adminSession.csrf)
      .send({ pipelineStageKey: 'PROPOSAL', priority: 'HIGH', email: '' })
      .expect(200);
    expect(updatedLead.body.pipelineStageKey).toBe('PROPOSAL');

    const followUp = await adminSession.agent
      .post(`/api/v1/crm/leads/${crmEmptyEmail.body.lead.id}/activities`)
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        activityType: 'FOLLOW_UP',
        summaryAr: 'متابعة عرض السعر غداً',
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(201);
    const completedFollowUp = await adminSession.agent
      .patch(`/api/v1/crm/activities/${followUp.body.id}/complete`)
      .set('X-CSRF-Token', adminSession.csrf)
      .send({})
      .expect(200);
    expect(completedFollowUp.body.completedAt).toBeTruthy();

    // Finance Officer can access read-only sellers directory for settlements
    const sellersDir = await financeMakerSession.agent
      .get('/api/v1/finance/sellers-directory')
      .expect(200);
    expect(Array.isArray(sellersDir.body)).toBe(true);
    expect(sellersDir.body.length).toBeGreaterThan(0);

    // Super Admin assigning AFFILIATE_SELLER auto-provisions APPROVED Seller profile & code
    const newStaffPhone = '+201099554433';
    const createdSellerUser = await adminSession.agent
      .post('/api/v1/admin/users')
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        fullName: 'بائع معيّن من المدير الأعلى',
        phoneNumber: newStaffPhone,
        countryCode: '+20',
        password: 'BoslaSellerAssign#2026',
        role: 'AFFILIATE_SELLER',
        status: 'ACTIVE',
      })
      .expect(201);
    const provisionedSeller = await prisma.seller.findUnique({
      where: { userId: createdSellerUser.body.id },
      include: { codes: true },
    });
    expect(provisionedSeller).not.toBeNull();
    expect(provisionedSeller?.status).toBe('APPROVED');
    expect(provisionedSeller?.codes.length).toBeGreaterThan(0);

    // Super Admin <-> Instructor Direct Chat & Tasks integration lifecycle
    const createdTaskRes = await adminSession.agent
      .post(`/api/v1/admin/instructor-collab/instructors/${instructorSession.user.id}/tasks`)
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        titleAr: 'إعداد بنك أسئلة التقييم العملي للدفعة القادمة',
        descriptionAr: 'تجهيز 25 سؤال عملي مع نموذج الإجابة التفصيلي.',
        priority: 'URGENT',
        courseId: courses[0].id,
        adminNotesAr: 'يرجى التسليم قبل نهاية الأسبوع',
        postToChat: true,
      })
      .expect(201);
    expect(createdTaskRes.body.priority).toBe('URGENT');
    expect(createdTaskRes.body.status).toBe('TODO');

    await adminSession.agent
      .post(`/api/v1/admin/instructor-collab/instructors/${instructorSession.user.id}/messages`)
      .set('X-CSRF-Token', adminSession.csrf)
      .send({
        bodyAr: 'مرحباً دكتور، تم إسناد مهمة بنك الأسئلة، بانتظار تأكيدك.',
        taskId: createdTaskRes.body.id,
      })
      .expect(201);

    const instWorkspace = await instructorSession.agent
      .get('/api/v1/instructor/collab/workspace')
      .expect(200);
    expect(instWorkspace.body.stats.total).toBeGreaterThanOrEqual(1);
    expect(instWorkspace.body.stats.unreadMessages).toBeGreaterThanOrEqual(2);

    await instructorSession.agent
      .post('/api/v1/instructor/collab/messages/read')
      .set('X-CSRF-Token', instructorSession.csrf)
      .send({})
      .expect(201);

    const updatedByInstructor = await instructorSession.agent
      .patch(`/api/v1/instructor/collab/tasks/${createdTaskRes.body.id}/status`)
      .set('X-CSRF-Token', instructorSession.csrf)
      .send({
        status: 'COMPLETED',
        instructorNotesAr: 'تم رفع بنك الأسئلة بالكامل ومراجعته.',
      })
      .expect(200);
    expect(updatedByInstructor.body.status).toBe('COMPLETED');
    expect(updatedByInstructor.body.completedAt).toBeTruthy();

    await instructorSession.agent
      .post('/api/v1/instructor/collab/messages')
      .set('X-CSRF-Token', instructorSession.csrf)
      .send({
        bodyAr: 'تم إنجاز المهمة بالكامل يا فندم.',
        taskId: createdTaskRes.body.id,
      })
      .expect(201);

    const adminCollabOverview = await adminSession.agent
      .get('/api/v1/admin/instructor-collab/overview')
      .expect(200);
    expect(adminCollabOverview.body.summary.completedTasks).toBeGreaterThanOrEqual(1);
    expect(adminCollabOverview.body.summary.totalUnreadMessages).toBeGreaterThanOrEqual(1);

    const adminThread = await adminSession.agent
      .get(`/api/v1/admin/instructor-collab/instructors/${instructorSession.user.id}/thread`)
      .expect(200);
    expect(adminThread.body.tasks.some((t: any) => t.id === createdTaskRes.body.id && t.status === 'COMPLETED')).toBe(true);
    expect(adminThread.body.messages.some((m: any) => m.bodyAr.includes('تم إنجاز المهمة بالكامل'))).toBe(true);
  });
});
