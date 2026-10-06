export interface Plan {
  id: string;
  code: 'FREE' | 'BASIC' | 'PRO';
  name: string;
  description: string;
  price: number;
  currency: string;
  billingInterval: 'MONTHLY' | 'YEARLY' | 'ONEOFF';
  creditAllowance: number;
  resumeProfileLimit: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'TRIALING' | 'PAUSED';
  provider: 'RAZORPAY' | 'STRIPE' | 'MANUAL';
  providerSubscriptionId?: string | null;
  currentPeriodStart: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string | null;
  metadata?: any;
}

export interface CreditWallet {
  id: string;
  userId: string;
  balance: number;
  lifetimeGranted: number;
  lifetimeConsumed: number;
  updatedAt: string;
}

export interface CreditLedgerEntry {
  id: string;
  walletId: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  type: 'GRANT' | 'CONSUME' | 'REFUND' | 'ADJUSTMENT' | 'EXPIRATION';
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
}

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
  creditCosts: {
    RESUME_TAILOR: number;
    INTERVIEW_SESSION_GEN: number;
    INTERVIEW_EVALUATION: number;
    CAREER_LEARNING_PLAN: number;
  };
}

export interface CheckoutSessionResult {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  planCode: string;
  planName: string;
  keyId: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  planId?: string | null;
  provider: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  amount: number;
  currency: string;
  status: 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  purpose: string;
  createdAt: string;
}
