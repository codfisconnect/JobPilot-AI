export interface CreateGatewayOrderParams {
  amount: number; // in smallest currency unit (e.g. paise)
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface GatewayOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface VerifyCheckoutSignatureParams {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface IPaymentGateway {
  readonly providerName: string;

  /**
   * Generates a new order on the payment gateway
   */
  createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult>;

  /**
   * Verifies the client-side checkout signature using HMAC-SHA256
   */
  verifyCheckoutSignature(params: VerifyCheckoutSignatureParams): boolean;

  /**
   * Verifies webhook signature against configured webhook secret
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;
}
