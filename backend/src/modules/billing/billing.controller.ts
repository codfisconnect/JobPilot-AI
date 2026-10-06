import type { Request, Response, NextFunction } from 'express';
import { BillingService } from './billing.service.js';
import {
  CheckoutRequestSchema,
  VerifyPaymentSchema,
  LedgerQuerySchema
} from './billing.schemas.js';
import { BadRequestError } from '../../utils/errors.js';

export class BillingController {
  /**
   * GET /api/v1/billing/plans
   * List all available commercial plans
   */
  public static async getPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await BillingService.getPlans();
      res.json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/billing/me
   * Get authoritative billing state, plan, credits, and entitlements for current user
   */
  public static async getMyBilling(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const billingState = await BillingService.getUserBillingState(userId);
      res.json({ success: true, data: billingState });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/billing/credits
   * Get credit wallet balance for current user
   */
  public static async getCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const billingState = await BillingService.getUserBillingState(userId);
      res.json({
        success: true,
        data: {
          balance: billingState.wallet.balance,
          lifetimeGranted: billingState.wallet.lifetimeGranted,
          lifetimeConsumed: billingState.wallet.lifetimeConsumed,
          updatedAt: billingState.wallet.updatedAt
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/billing/credits/ledger
   * Paginated audit ledger for current user
   */
  public static async getLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { limit, offset } = LedgerQuerySchema.parse(req.query);
      const ledger = await BillingService.getLedger(userId, limit, offset);
      res.json({ success: true, data: ledger });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/billing/checkout
   * Initiate Razorpay checkout order for a plan
   */
  public static async createCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { planCode } = CheckoutRequestSchema.parse(req.body);
      const checkoutSession = await BillingService.createCheckout(userId, planCode);
      res.status(201).json({ success: true, data: checkoutSession });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/billing/payments/verify
   * Verify Razorpay checkout signature and activate plan/credits
   */
  public static async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { providerOrderId, providerPaymentId, providerSignature } = VerifyPaymentSchema.parse(req.body);

      const result = await BillingService.verifyPayment(
        userId,
        providerOrderId,
        providerPaymentId,
        providerSignature
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/billing/razorpay/webhook
   * Webhook callback with raw body HMAC verification
   */
  public static async handleRazorpayWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = (req.headers['x-razorpay-signature'] as string) || '';
      if (!signature) {
        throw new BadRequestError('Missing x-razorpay-signature header');
      }

      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const result = await BillingService.handleWebhook(rawBody, signature, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/billing/payments
   * List payments history for current user
   */
  public static async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const payments = await BillingService.getPaymentHistory(userId);
      res.json({ success: true, data: payments });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/billing/subscription/cancel
   * Cancel user subscription at period end
   */
  public static async cancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const subscription = await BillingService.cancelSubscription(userId);
      res.json({ success: true, data: subscription });
    } catch (err) {
      next(err);
    }
  }
}
