import crypto from 'node:crypto';
import type {
  IPaymentGateway,
  CreateGatewayOrderParams,
  GatewayOrderResult,
  VerifyCheckoutSignatureParams
} from './gateway.interface.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class RazorpayPaymentGateway implements IPaymentGateway {
  public readonly providerName = 'RAZORPAY';
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(
    keyId: string = env.RAZORPAY_KEY_ID,
    keySecret: string = env.RAZORPAY_KEY_SECRET,
    webhookSecret: string = env.RAZORPAY_WEBHOOK_SECRET
  ) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }

  public async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    // If running in development/test without real live network call or if live keys are test keys,
    // produce deterministic gateway order IDs.
    // If real razorpay SDK or REST endpoint is wired with live credentials, it executes here.
    const isMockOrTest = !this.keyId || this.keyId.startsWith('rzp_test_');

    if (isMockOrTest) {
      // Deterministic provider order generation
      const orderId = `order_${crypto.randomBytes(10).toString('hex')}`;
      logger.info('Razorpay test mode order created', {
        orderId,
        amount: params.amount,
        receipt: params.receipt
      });

      return {
        orderId,
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt
      };
    }

    // Direct HTTP call to Razorpay API: POST https://api.razorpay.com/v1/orders
    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('Razorpay order creation failed at gateway', { status: res.status, errorText });
      throw new Error(`Razorpay gateway error: ${res.statusText}`);
    }

    const json = await res.json() as any;
    return {
      orderId: json.id,
      amount: json.amount,
      currency: json.currency,
      receipt: json.receipt
    };
  }

  public verifyCheckoutSignature(params: VerifyCheckoutSignatureParams): boolean {
    const { providerOrderId, providerPaymentId, signature } = params;
    if (!providerOrderId || !providerPaymentId || !signature) {
      return false;
    }

    try {
      const payload = `${providerOrderId}|${providerPaymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(payload)
        .digest('hex');

      return this.timingSafeEqual(expectedSignature, signature);
    } catch (err) {
      logger.warn('Error during Razorpay checkout signature verification', { error: (err as any).message });
      return false;
    }
  }

  public verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!rawBody || !signature || !this.webhookSecret) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      return this.timingSafeEqual(expectedSignature, signature);
    } catch (err) {
      logger.warn('Error during Razorpay webhook signature verification', { error: (err as any).message });
      return false;
    }
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }
}

export const paymentGateway: IPaymentGateway = new RazorpayPaymentGateway();
