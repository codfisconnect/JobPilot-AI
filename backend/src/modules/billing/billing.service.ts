import { BillingRepository } from './billing.repository.js';
import { BILLING_CONSTANTS } from './billing.constants.js';
import { paymentGateway } from './razorpay.gateway.js';
import {
  PlanCode,
  PaymentStatus,
  SubscriptionStatus,
  PaymentProvider,
  PaymentPurpose,
  WebhookStatus,
  type Plan,
  type Subscription,
  type CreditWallet,
  type CreditLedger,
  type Payment
} from '@prisma/client';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError
} from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import crypto from 'node:crypto';

export interface UserBillingState {
  plan: Plan;
  subscription: Subscription | null;
  wallet: CreditWallet;
  entitlements: {
    resumeProfileLimit: number;
    advancedTailoring: boolean;
    interviewPrep: boolean;
    careerIntelligence: boolean;
    unlimitedExport: boolean;
  };
  creditCosts: typeof BILLING_CONSTANTS.CREDIT_COSTS;
}

export class BillingService {
  /**
   * Return all active commercial plans sorted by sortOrder
   */
  public static async getPlans(): Promise<Plan[]> {
    return BillingRepository.getActivePlans();
  }

  /**
   * Return comprehensive authoritative billing status for a user
   * Automatically initializes Free plan and starter wallet if not already present.
   */
  public static async getUserBillingState(userId: string): Promise<UserBillingState> {
    // 1. Get or create wallet
    let wallet = await BillingRepository.getWalletByUserId(userId);
    if (!wallet) {
      wallet = await BillingRepository.getOrCreateWallet(userId, 0);
      // Create initial grant ledger
      const grant = await BillingRepository.grantCreditsAtomic(
        userId,
        BILLING_CONSTANTS.DEFAULT_FREE_STARTER_CREDITS,
        'Welcome Starter Credits',
        `starter-grant-${userId}`,
        'SYSTEM',
        'REGISTRATION'
      );
      wallet = grant.wallet;
    }

    // 2. Get active subscription
    const activeSub = await BillingRepository.getActiveSubscription(userId);

    // 3. Authoritative plan
    let plan: Plan;
    if (activeSub && activeSub.plan && activeSub.plan.isActive) {
      plan = activeSub.plan;
    } else {
      // Default to database FREE plan
      const freePlan = await BillingRepository.getPlanByCode(PlanCode.FREE);
      if (!freePlan) {
        throw new NotFoundError('Default FREE plan configuration missing from database');
      }
      plan = freePlan;
    }

    // 4. Calculate entitlements
    const entitlements = {
      resumeProfileLimit: plan.resumeProfileLimit,
      advancedTailoring: true, // available to all tiers but costs credits
      interviewPrep: true,
      careerIntelligence: true,
      unlimitedExport: plan.code !== PlanCode.FREE
    };

    return {
      plan,
      subscription: activeSub ? activeSub : null,
      wallet,
      entitlements,
      creditCosts: BILLING_CONSTANTS.CREDIT_COSTS
    };
  }

  /**
   * Grant credits to a user
   */
  public static async grantCredits(
    userId: string,
    amount: number,
    reason: string,
    idempotencyKey?: string,
    referenceType?: string,
    referenceId?: string
  ): Promise<{ wallet: CreditWallet; ledger: CreditLedger }> {
    return BillingRepository.grantCreditsAtomic(
      userId,
      amount,
      reason,
      idempotencyKey,
      referenceType,
      referenceId
    );
  }

  /**
   * Check if user has sufficient credits for an action
   */
  public static async hasCredits(userId: string, cost: number): Promise<boolean> {
    const wallet = await BillingRepository.getWalletByUserId(userId);
    return Boolean(wallet && wallet.balance >= cost);
  }

  /**
   * Atomically consume credits with validation
   */
  public static async consumeCredits(
    userId: string,
    amount: number,
    reason: string,
    referenceType?: string,
    referenceId?: string
  ): Promise<{ wallet: CreditWallet; ledger: CreditLedger }> {
    try {
      return await BillingRepository.consumeCreditsAtomic(
        userId,
        amount,
        reason,
        referenceType,
        referenceId
      );
    } catch (err: any) {
      if (err.message === 'INSUFFICIENT_CREDITS') {
        throw new BadRequestError(`Insufficient AI credits. Operation requires ${amount} credits.`);
      }
      throw err;
    }
  }

  /**
   * Refund credits on unexpected operational failure
   */
  public static async refundCredits(
    userId: string,
    amount: number,
    reason: string,
    referenceType?: string,
    referenceId?: string
  ): Promise<{ wallet: CreditWallet; ledger: CreditLedger }> {
    return BillingRepository.refundCreditsAtomic(
      userId,
      amount,
      reason,
      referenceType,
      referenceId
    );
  }

  /**
   * Get user ledger entries
   */
  public static async getLedger(userId: string, limit: number, offset: number) {
    return BillingRepository.getLedgerByUserId(userId, limit, offset);
  }

  /**
   * Create checkout session & Razorpay order
   */
  public static async createCheckout(userId: string, planCode: PlanCode) {
    if (planCode === PlanCode.FREE) {
      throw new BadRequestError('Free plan cannot be checked out via payment gateway.');
    }

    const plan = await BillingRepository.getPlanByCode(planCode);
    if (!plan || !plan.isActive) {
      throw new NotFoundError(`Plan ${planCode} is not available for purchase.`);
    }

    // Receipt ID for gateway order
    const receipt = `rcpt_${userId.substring(0, 8)}_${Date.now()}`;

    // Create Razorpay Order at gateway
    const gatewayOrder = await paymentGateway.createOrder({
      amount: plan.price,
      currency: plan.currency,
      receipt,
      notes: {
        userId,
        planCode: plan.code,
        planId: plan.id
      }
    });

    // Save internal payment record in status CREATED
    const payment = await BillingRepository.createPayment({
      user: { connect: { id: userId } },
      plan: { connect: { id: plan.id } },
      provider: PaymentProvider.RAZORPAY,
      providerOrderId: gatewayOrder.orderId,
      amount: plan.price,
      currency: plan.currency,
      status: PaymentStatus.CREATED,
      purpose: PaymentPurpose.SUBSCRIPTION_UPGRADE,
      metadata: {
        receipt,
        planCode: plan.code,
        creditAllowance: plan.creditAllowance
      }
    });

    return {
      paymentId: payment.id,
      orderId: gatewayOrder.orderId,
      amount: plan.price,
      currency: plan.currency,
      planCode: plan.code,
      planName: plan.name,
      keyId: (paymentGateway as any).keyId || 'rzp_test_mockKeyIdSprint7'
    };
  }

  /**
   * Verify checkout signature and fulfill order
   */
  public static async verifyPayment(
    userId: string,
    providerOrderId: string,
    providerPaymentId: string,
    providerSignature: string
  ) {
    // 1. Authoritative lookup of Payment by providerOrderId
    const payment = await BillingRepository.getPaymentByProviderOrderId(providerOrderId);
    if (!payment) {
      throw new NotFoundError('Payment order not found');
    }

    // 2. Strict IDOR protection
    if (payment.userId !== userId) {
      throw new ForbiddenError('Unauthorized: Payment order belongs to another candidate');
    }

    // 3. Check if already processed
    if (payment.status === PaymentStatus.CAPTURED) {
      logger.info('Payment already captured, returning verified state', { providerOrderId });
      return { success: true, status: PaymentStatus.CAPTURED, alreadyProcessed: true };
    }

    // 4. Verify HMAC signature using server-side order ID and gateway
    const isValid = paymentGateway.verifyCheckoutSignature({
      providerOrderId,
      providerPaymentId,
      signature: providerSignature
    });

    if (!isValid) {
      await BillingRepository.updatePayment(payment.id, {
        status: PaymentStatus.FAILED,
        metadata: {
          failureReason: 'INVALID_SIGNATURE',
          failedAt: new Date().toISOString()
        }
      });
      throw new BadRequestError('Invalid payment signature verification failed');
    }

    // 5. Update payment to CAPTURED
    await BillingRepository.updatePayment(payment.id, {
      status: PaymentStatus.CAPTURED,
      providerPaymentId,
      providerSignature
    });

    // 6. Activate Subscription & Credits
    await this.fulfillPayment(payment);

    return {
      success: true,
      status: PaymentStatus.CAPTURED,
      paymentId: payment.id
    };
  }

  /**
   * Idempotent fulfillment of Payment (activates plan & grants credits)
   */
  public static async fulfillPayment(payment: Payment) {
    if (!payment.planId) {
      return;
    }

    const plan = await BillingRepository.getPlanById(payment.planId);
    if (!plan) {
      return;
    }

    // 1. Create or renew active Subscription
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.billingInterval === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await BillingRepository.createSubscription({
      user: { connect: { id: payment.userId } },
      plan: { connect: { id: plan.id } },
      status: SubscriptionStatus.ACTIVE,
      provider: payment.provider,
      providerSubscriptionId: payment.providerOrderId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      metadata: {
        paymentId: payment.id,
        planCode: plan.code
      }
    });

    // 2. Idempotent Credit Grant
    const idempotencyKey = `credit-grant-${payment.id}`;
    await BillingRepository.grantCreditsAtomic(
      payment.userId,
      plan.creditAllowance,
      `Plan Activation: ${plan.name} (${plan.creditAllowance} credits)`,
      idempotencyKey,
      'PAYMENT',
      payment.id
    );

    logger.info('Payment fulfilled successfully', {
      userId: payment.userId,
      planCode: plan.code,
      creditsGranted: plan.creditAllowance
    });
  }

  /**
   * Process incoming Razorpay webhook event with idempotency & HMAC verification
   */
  public static async handleWebhook(rawBody: string | Buffer, signature: string, eventPayload: any) {
    // 1. Verify Webhook Signature
    const isSignatureValid = paymentGateway.verifyWebhookSignature(rawBody, signature);
    if (!isSignatureValid) {
      logger.warn('Webhook signature verification failed');
      throw new BadRequestError('Invalid webhook signature');
    }

    const eventType = String(eventPayload?.event || 'unknown');
    // Razorpay webhook payload has payload.payment.entity or similar
    const entity = eventPayload?.payload?.payment?.entity || eventPayload?.payload?.order?.entity;
    const providerOrderId = entity?.order_id || entity?.id;
    const providerPaymentId = entity?.id;

    const providerEventId = String(
      eventPayload?.event_id ||
      `${eventType}_${providerOrderId || ''}_${providerPaymentId || ''}_${Date.now()}`
    );

    const payloadHash = crypto
      .createHash('sha256')
      .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
      .digest('hex');

    // 2. Check duplicate webhook delivery
    const existingEvent = await BillingRepository.findWebhookEvent(
      PaymentProvider.RAZORPAY,
      providerEventId
    );

    if (existingEvent) {
      logger.info('Duplicate webhook received, skipping processing', { providerEventId });
      return { status: 'DUPLICATE_IGNORED', eventId: existingEvent.id };
    }

    // 3. Record pending webhook event
    const webhookRecord = await BillingRepository.createWebhookEvent({
      provider: PaymentProvider.RAZORPAY,
      providerEventId,
      eventType,
      payloadHash,
      status: WebhookStatus.PENDING
    });

    try {
      // 4. Process business event
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const orderIdToFind = entity?.order_id || (eventType === 'order.paid' ? entity?.id : null);

        if (orderIdToFind) {
          const payment = await BillingRepository.getPaymentByProviderOrderId(orderIdToFind);
          if (payment && payment.status !== PaymentStatus.CAPTURED) {
            await BillingRepository.updatePayment(payment.id, {
              status: PaymentStatus.CAPTURED,
              providerPaymentId: providerPaymentId || payment.providerPaymentId
            });
            await this.fulfillPayment(payment);
          }
        }
      } else if (eventType === 'payment.failed') {
        if (entity?.order_id) {
          const payment = await BillingRepository.getPaymentByProviderOrderId(entity.order_id);
          if (payment) {
            await BillingRepository.updatePayment(payment.id, {
              status: PaymentStatus.FAILED,
              metadata: {
                error: entity.error_description || 'Payment Failed'
              }
            });
          }
        }
      }

      // 5. Mark webhook processed
      await BillingRepository.updateWebhookEventStatus(
        webhookRecord.id,
        WebhookStatus.PROCESSED,
        'Successfully processed'
      );

      return { status: 'PROCESSED', eventId: webhookRecord.id };
    } catch (processErr: any) {
      logger.error('Failed processing webhook event', processErr, { providerEventId });
      await BillingRepository.updateWebhookEventStatus(
        webhookRecord.id,
        WebhookStatus.FAILED,
        processErr.message
      );
      throw processErr;
    }
  }

  /**
   * Cancel subscription at period end
   */
  public static async cancelSubscription(userId: string) {
    const activeSub = await BillingRepository.getActiveSubscription(userId);
    if (!activeSub) {
      throw new NotFoundError('No active subscription found to cancel.');
    }
    return BillingRepository.cancelSubscription(activeSub.id);
  }

  /**
   * List payments history for a candidate
   */
  public static async getPaymentHistory(userId: string) {
    return BillingRepository.getPaymentsByUserId(userId);
  }
}
