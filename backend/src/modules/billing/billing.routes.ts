import { Router } from 'express';
import { BillingController } from './billing.controller.js';
import { authenticateJwt } from '../../middleware/auth.middleware.js';

export const billingRouter = Router();

// Public: List plans
billingRouter.get('/plans', BillingController.getPlans);

// Webhook: Razorpay asynchronous events (verifies HMAC signature internally)
billingRouter.post('/razorpay/webhook', BillingController.handleRazorpayWebhook);

// Authenticated Routes
billingRouter.get('/me', authenticateJwt, BillingController.getMyBilling);
billingRouter.get('/credits', authenticateJwt, BillingController.getCredits);
billingRouter.get('/credits/ledger', authenticateJwt, BillingController.getLedger);
billingRouter.post('/checkout', authenticateJwt, BillingController.createCheckout);
billingRouter.post('/payments/verify', authenticateJwt, BillingController.verifyPayment);
billingRouter.get('/payments', authenticateJwt, BillingController.getPayments);
billingRouter.post('/subscription/cancel', authenticateJwt, BillingController.cancelSubscription);
