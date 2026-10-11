import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../server.js';
import { prisma } from '../database/prisma.js';
import { signAccessToken } from '../utils/jwt.js';
import { UserRole, PlanCode, PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { BillingService } from '../modules/billing/billing.service.js';
import { paymentGateway } from '../modules/billing/razorpay.gateway.js';
import { BILLING_CONSTANTS } from '../modules/billing/billing.constants.js';
import crypto from 'node:crypto';

describe('Sprint 7: Payments, Credits, Entitlements & Razorpay Suite', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  before(async () => {
    // 1. Seed plans
    const { seedMasterData } = await import('../database/seedMaster.js');
    await seedMasterData();

    // 2. Cleanup test users
    await prisma.user.deleteMany({
      where: { email: { in: ['cand.sprint7.a@pilotmama.com', 'cand.sprint7.b@pilotmama.com'] } }
    });

    // 3. Create Candidate A
    userA = await prisma.user.create({
      data: {
        email: 'cand.sprint7.a@pilotmama.com',
        passwordHash: '$argon2id$mockhashsprint7a',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Tara Sharma',
            headline: 'Staff Software Engineer',
            location: 'Mumbai, India'
          }
        }
      },
      include: { candidateProfile: true }
    });

    tokenA = signAccessToken({
      userId: userA.id,
      email: userA.email,
      role: userA.role
    });

    // 4. Create Candidate B for IDOR testing
    userB = await prisma.user.create({
      data: {
        email: 'cand.sprint7.b@pilotmama.com',
        passwordHash: '$argon2id$mockhashsprint7b',
        role: UserRole.CANDIDATE,
        candidateProfile: {
          create: {
            fullName: 'Rohan Mehta',
            headline: 'Senior QA Architect',
            location: 'Bangalore, India'
          }
        }
      },
      include: { candidateProfile: true }
    });

    tokenB = signAccessToken({
      userId: userB.id,
      email: userB.email,
      role: userB.role
    });
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['cand.sprint7.a@pilotmama.com', 'cand.sprint7.b@pilotmama.com'] } }
    });
  });

  describe('1. Plans & Commercial Catalog', () => {
    it('GET /api/v1/billing/plans should return active commercial plans in proper sort order', async () => {
      const res = await request(app)
        .get('/api/v1/billing/plans');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 3, 'Must return at least FREE, BASIC, PRO');

      const codes = res.body.data.map((p: any) => p.code);
      assert.ok(codes.includes('FREE'));
      assert.ok(codes.includes('BASIC'));
      assert.ok(codes.includes('PRO'));

      // Check sorting: FREE (1) -> BASIC (2) -> PRO (3)
      const freePlan = res.body.data.find((p: any) => p.code === 'FREE');
      const basicPlan = res.body.data.find((p: any) => p.code === 'BASIC');
      const proPlan = res.body.data.find((p: any) => p.code === 'PRO');

      assert.ok(freePlan.sortOrder < basicPlan.sortOrder);
      assert.ok(basicPlan.sortOrder < proPlan.sortOrder);
      assert.strictEqual(freePlan.price, 0);
      assert.strictEqual(basicPlan.price, 49900);
      assert.strictEqual(proPlan.price, 129900);
    });
  });

  describe('2. Authoritative User Billing State & Entitlements', () => {
    it('GET /api/v1/billing/me should initialize Free plan and starter credit wallet for new candidate', async () => {
      const res = await request(app)
        .get('/api/v1/billing/me')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.plan.code, 'FREE');
      assert.strictEqual(res.body.data.wallet.balance, BILLING_CONSTANTS.DEFAULT_FREE_STARTER_CREDITS);
      assert.strictEqual(res.body.data.entitlements.resumeProfileLimit, 1);
      assert.strictEqual(res.body.data.entitlements.unlimitedExport, false);
      assert.ok(res.body.data.creditCosts.RESUME_TAILOR === 5);
    });

    it('GET /api/v1/billing/credits should return credit wallet balance', async () => {
      const res = await request(app)
        .get('/api/v1/billing/credits')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.balance, BILLING_CONSTANTS.DEFAULT_FREE_STARTER_CREDITS);
    });
  });

  describe('3. Credit System Atomic Mutations, Concurrency & Insufficient Protection', () => {
    it('should atomically consume credits and create immutable audit ledger', async () => {
      const consumeRes = await BillingService.consumeCredits(
        userA.id,
        5,
        'Resume Tailoring Service',
        'RESUME',
        'test-resume-001'
      );

      assert.strictEqual(consumeRes.wallet.balance, 5);
      assert.strictEqual(consumeRes.ledger.amount, -5);
      assert.strictEqual(consumeRes.ledger.type, 'CONSUME');
      assert.strictEqual(consumeRes.ledger.balanceAfter, 5);
    });

    it('should reject consumption when balance is insufficient (no negative balance)', async () => {
      // Current balance is 5, attempting to consume 10
      await assert.rejects(
        async () => {
          await BillingService.consumeCredits(
            userA.id,
            10,
            'Excessive Operation'
          );
        },
        /Insufficient AI credits/
      );

      // Verify wallet balance remained intact (still 5)
      const wallet = await prisma.creditWallet.findUnique({ where: { userId: userA.id } });
      assert.strictEqual(wallet?.balance, 5);
    });

    it('concurrency test: simultaneous consumption race must not result in negative balance', async () => {
      // User has 5 credits. Two concurrent requests want 3 each (total 6 > 5).
      const results = await Promise.allSettled([
        BillingService.consumeCredits(userA.id, 3, 'Concurrent Request 1'),
        BillingService.consumeCredits(userA.id, 3, 'Concurrent Request 2')
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent request must win');
      assert.strictEqual(rejected.length, 1, 'Exactly one concurrent request must be rejected');

      const wallet = await prisma.creditWallet.findUnique({ where: { userId: userA.id } });
      assert.strictEqual(wallet?.balance, 2, 'Balance is 5 - 3 = 2, strictly non-negative');
    });

    it('should grant credits with idempotency key guarantee', async () => {
      const idemKey = `grant-test-unique-${Date.now()}`;

      // Grant 20 credits
      const grant1 = await BillingService.grantCredits(
        userA.id,
        20,
        'Promotion Grant',
        idemKey
      );
      assert.strictEqual(grant1.wallet.balance, 22);

      // Re-run with SAME idempotency key
      const grant2 = await BillingService.grantCredits(
        userA.id,
        20,
        'Promotion Grant',
        idemKey
      );
      assert.strictEqual(grant2.wallet.balance, 22, 'Balance must not increase again on duplicate grant');
      assert.strictEqual(grant2.ledger.id, grant1.ledger.id, 'Returns existing ledger record');
    });

    it('GET /api/v1/billing/credits/ledger retrieves immutable ledger entries', async () => {
      const res = await request(app)
        .get('/api/v1/billing/credits/ledger')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
      assert.ok(res.body.data.items.length >= 2);
      assert.ok(typeof res.body.data.total === 'number');
    });
  });

  describe('4. Checkout Order Creation & Razorpay Verification Flow', () => {
    let createdOrderId: string;

    it('POST /api/v1/billing/checkout creates payment order with authoritative plan pricing', async () => {
      const res = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ planCode: 'BASIC' });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.amount, 49900);
      assert.strictEqual(res.body.data.currency, 'INR');
      assert.strictEqual(res.body.data.planCode, 'BASIC');
      assert.ok(res.body.data.orderId.startsWith('order_'));
      assert.ok(res.body.data.keyId);

      createdOrderId = res.body.data.orderId;

      // Verify DB Payment record
      const dbPayment = await prisma.payment.findUnique({
        where: { providerOrderId: createdOrderId }
      });
      assert.ok(dbPayment);
      assert.strictEqual(dbPayment?.status, PaymentStatus.CREATED);
      assert.strictEqual(dbPayment?.userId, userA.id);
      assert.strictEqual(dbPayment?.amount, 49900);
    });

    it('POST /api/v1/billing/checkout rejects FREE plan checkout', async () => {
      const res = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ planCode: 'FREE' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/v1/billing/payments/verify rejects invalid HMAC signature', async () => {
      const res = await request(app)
        .post('/api/v1/billing/payments/verify')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          providerOrderId: createdOrderId,
          providerPaymentId: 'pay_mock123456',
          providerSignature: 'forged_fake_signature_hash'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'BAD_REQUEST');

      const dbPayment = await prisma.payment.findUnique({
        where: { providerOrderId: createdOrderId }
      });
      assert.strictEqual(dbPayment?.status, PaymentStatus.FAILED);
    });

    it('POST /api/v1/billing/payments/verify fulfills plan & grants credits on valid HMAC signature', async () => {
      // Compute valid HMAC signature
      const mockPaymentId = `pay_${Date.now()}`;
      const validSignature = crypto
        .createHmac('sha256', (paymentGateway as any).keySecret)
        .update(`${createdOrderId}|${mockPaymentId}`)
        .digest('hex');

      const initialWallet = await prisma.creditWallet.findUnique({ where: { userId: userA.id } });
      const initialBalance = initialWallet?.balance || 0;

      const res = await request(app)
        .post('/api/v1/billing/payments/verify')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          providerOrderId: createdOrderId,
          providerPaymentId: mockPaymentId,
          providerSignature: validSignature
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'CAPTURED');

      // Verify authoritative billing state after verification
      const billingRes = await request(app)
        .get('/api/v1/billing/me')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(billingRes.status, 200);
      assert.strictEqual(billingRes.body.data.plan.code, 'BASIC');
      assert.strictEqual(billingRes.body.data.subscription.status, 'ACTIVE');
      assert.strictEqual(billingRes.body.data.entitlements.resumeProfileLimit, 2);
      assert.strictEqual(billingRes.body.data.entitlements.unlimitedExport, true);
      assert.strictEqual(billingRes.body.data.wallet.balance, initialBalance + 50);
    });
  });

  describe('5. Razorpay Webhook Idempotency & Replay Protection', () => {
    it('POST /api/v1/billing/razorpay/webhook rejects invalid webhook HMAC signature', async () => {
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_test_webhook_1', order_id: 'order_test_webhook_1' }
          }
        }
      };

      const res = await request(app)
        .post('/api/v1/billing/razorpay/webhook')
        .set('x-razorpay-signature', 'invalid_signature_mock')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/v1/billing/razorpay/webhook successfully processes valid webhook event and is idempotent on replay', async () => {
      // 1. Create a payment record waiting for webhook fulfillment
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: PlanCode.PRO } });
      const testOrderId = `order_webhook_${Date.now()}`;
      const testPayment = await prisma.payment.create({
        data: {
          userId: userB.id,
          planId: plan.id,
          provider: 'RAZORPAY',
          providerOrderId: testOrderId,
          amount: plan.price,
          currency: 'INR',
          status: PaymentStatus.CREATED
        }
      });

      const webhookPayload = {
        event: 'payment.captured',
        event_id: `evt_${Date.now()}`,
        payload: {
          payment: {
            entity: {
              id: `pay_webhook_${Date.now()}`,
              order_id: testOrderId,
              amount: plan.price
            }
          }
        }
      };

      const rawBody = JSON.stringify(webhookPayload);
      const validSignature = crypto
        .createHmac('sha256', (paymentGateway as any).webhookSecret)
        .update(rawBody)
        .digest('hex');

      // First webhook delivery
      const res1 = await request(app)
        .post('/api/v1/billing/razorpay/webhook')
        .set('x-razorpay-signature', validSignature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.success, true);
      assert.strictEqual(res1.body.data.status, 'PROCESSED');

      // Verify Candidate B now has PRO plan and 150 credits
      const billingB = await BillingService.getUserBillingState(userB.id);
      assert.strictEqual(billingB.plan.code, 'PRO');
      assert.strictEqual(billingB.wallet.balance, 150);

      // Replay identical webhook (duplicate delivery)
      const res2 = await request(app)
        .post('/api/v1/billing/razorpay/webhook')
        .set('x-razorpay-signature', validSignature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.data.status, 'DUPLICATE_IGNORED');

      // Ensure balance was NOT duplicated (still 150)
      const billingBAfter = await BillingService.getUserBillingState(userB.id);
      assert.strictEqual(billingBAfter.wallet.balance, 150);
    });
  });

  describe('6. Authorization, Cross-Candidate Isolation (IDOR) & Subscription Cancellation', () => {
    it('Candidate B cannot verify payment created by Candidate A', async () => {
      // Candidate A creates checkout
      const checkoutA = await BillingService.createCheckout(userA.id, PlanCode.BASIC);

      // Candidate B attempts to verify Candidate A's order
      const fakeSig = crypto
        .createHmac('sha256', (paymentGateway as any).keySecret)
        .update(`${checkoutA.orderId}|pay_fake`)
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/billing/payments/verify')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          providerOrderId: checkoutA.orderId,
          providerPaymentId: 'pay_fake',
          providerSignature: fakeSig
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    it('GET /api/v1/billing/payments returns only Candidate A payments (zero cross-contamination)', async () => {
      const resA = await request(app)
        .get('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(resA.body.success, true);
      for (const p of resA.body.data) {
        assert.strictEqual(p.userId, userA.id, 'Candidate A must only see their own payments');
      }
    });

    it('POST /api/v1/billing/subscription/cancel cancels subscription at period end', async () => {
      const res = await request(app)
        .post('/api/v1/billing/subscription/cancel')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.cancelAtPeriodEnd, true);
      assert.ok(res.body.data.cancelledAt);
    });
  });
});
