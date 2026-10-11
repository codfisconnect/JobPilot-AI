import { prisma } from '../../database/prisma.js';
import {
  PlanCode,
  PaymentStatus,
  SubscriptionStatus,
  CreditLedgerType,
  PaymentProvider,
  WebhookStatus,
  type Plan,
  type Subscription,
  type CreditWallet,
  type CreditLedger,
  type Payment,
  type WebhookEvent,
  type Prisma
} from '@prisma/client';

export class BillingRepository {
  // Plan Operations
  public static async getActivePlans(): Promise<Plan[]> {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
  }

  public static async getPlanByCode(code: PlanCode): Promise<Plan | null> {
    return prisma.plan.findUnique({
      where: { code }
    });
  }

  public static async getPlanById(id: string): Promise<Plan | null> {
    return prisma.plan.findUnique({
      where: { id }
    });
  }

  // Subscription Operations
  public static async getActiveSubscription(userId: string): Promise<(Subscription & { plan: Plan }) | null> {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async createSubscription(data: Prisma.SubscriptionCreateInput): Promise<Subscription> {
    return prisma.subscription.create({ data });
  }

  public static async cancelSubscription(id: string): Promise<Subscription> {
    return prisma.subscription.update({
      where: { id },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date()
      }
    });
  }

  // Credit Wallet Operations
  public static async getOrCreateWallet(userId: string, initialBalance: number = 0): Promise<CreditWallet> {
    return prisma.creditWallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        balance: initialBalance,
        lifetimeGranted: initialBalance,
        lifetimeConsumed: 0
      }
    });
  }

  public static async getWalletByUserId(userId: string): Promise<CreditWallet | null> {
    return prisma.creditWallet.findUnique({
      where: { userId }
    });
  }

  // Atomic credit consumption
  public static async consumeCreditsAtomic(
    userId: string,
    amount: number,
    reason: string,
    referenceType?: string,
    referenceId?: string
  ): Promise<{ wallet: CreditWallet; ledger: CreditLedger }> {
    return prisma.$transaction(async (tx) => {
      // 1. Ensure wallet exists
      let wallet = await tx.creditWallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.creditWallet.create({
          data: {
            userId,
            balance: 0,
            lifetimeGranted: 0,
            lifetimeConsumed: 0
          }
        });
      }

      // Check balance
      if (wallet.balance < amount) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      // Atomic conditional update
      const updatedRows = await tx.$executeRaw`
        UPDATE credit_wallets
        SET balance = balance - ${amount},
            lifetime_consumed = lifetime_consumed + ${amount},
            updated_at = NOW()
        WHERE user_id = ${userId} AND balance >= ${amount}
      `;

      if (updatedRows === 0) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      const updatedWallet = await tx.creditWallet.findUniqueOrThrow({ where: { userId } });

      const ledger = await tx.creditLedger.create({
        data: {
          walletId: updatedWallet.id,
          userId,
          amount: -amount,
          balanceAfter: updatedWallet.balance,
          type: CreditLedgerType.CONSUME,
          reason,
          referenceType,
          referenceId
        }
      });

      return { wallet: updatedWallet, ledger };
    });
  }

  // Atomic credit grant with idempotency support
  public static async grantCreditsAtomic(
    userId: string,
    amount: number,
    reason: string,
    idempotencyKey?: string,
    referenceType?: string,
    referenceId?: string
  ): Promise<{ wallet: CreditWallet; ledger: CreditLedger }> {
    return prisma.$transaction(async (tx) => {
      // Idempotency check if key provided
      if (idempotencyKey) {
        const existingLedger = await tx.creditLedger.findUnique({
          where: { idempotencyKey }
        });
        if (existingLedger) {
          const currentWallet = await tx.creditWallet.findUniqueOrThrow({ where: { userId } });
          return { wallet: currentWallet, ledger: existingLedger };
        }
      }

      let wallet = await tx.creditWallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.creditWallet.create({
          data: {
            userId,
            balance: 0,
            lifetimeGranted: 0,
            lifetimeConsumed: 0
          }
        });
      }

      const updatedWallet = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amount },
          lifetimeGranted: { increment: amount }
        }
      });

      const ledger = await tx.creditLedger.create({
        data: {
          walletId: updatedWallet.id,
          userId,
          amount,
          balanceAfter: updatedWallet.balance,
          type: CreditLedgerType.GRANT,
          reason,
          referenceType,
          referenceId,
          idempotencyKey
        }
      });

      return { wallet: updatedWallet, ledger };
    });
  }

  // Credit Refund
  public static async refundCreditsAtomic(
    userId: string,
    amount: number,
    reason: string,
    referenceType?: string,
    referenceId?: string
  ): Promise<{ wallet: CreditWallet; ledger: CreditLedger }> {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.creditWallet.findUniqueOrThrow({ where: { userId } });

      const updatedWallet = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amount },
          lifetimeConsumed: { decrement: amount }
        }
      });

      const ledger = await tx.creditLedger.create({
        data: {
          walletId: updatedWallet.id,
          userId,
          amount,
          balanceAfter: updatedWallet.balance,
          type: CreditLedgerType.REFUND,
          reason,
          referenceType,
          referenceId
        }
      });

      return { wallet: updatedWallet, ledger };
    });
  }

  // Ledger Queries
  public static async getLedgerByUserId(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ items: CreditLedger[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.creditLedger.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.creditLedger.count({ where: { userId } })
    ]);
    return { items, total };
  }

  // Payment Operations
  public static async createPayment(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return prisma.payment.create({ data });
  }

  public static async getPaymentByProviderOrderId(providerOrderId: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { providerOrderId }
    });
  }

  public static async getPaymentsByUserId(userId: string): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async updatePayment(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return prisma.payment.update({
      where: { id },
      data
    });
  }

  // Webhook Event Operations
  public static async findWebhookEvent(provider: PaymentProvider, providerEventId: string): Promise<WebhookEvent | null> {
    return prisma.webhookEvent.findUnique({
      where: { providerEventId }
    });
  }

  public static async createWebhookEvent(data: {
    provider: PaymentProvider;
    providerEventId: string;
    eventType: string;
    payloadHash: string;
    status: WebhookStatus;
    processingNotes?: string;
  }): Promise<WebhookEvent> {
    return prisma.webhookEvent.create({ data });
  }

  public static async updateWebhookEventStatus(
    id: string,
    status: WebhookStatus,
    notes?: string
  ): Promise<WebhookEvent> {
    return prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        processingNotes: notes,
        processedAt: status === WebhookStatus.PROCESSED ? new Date() : undefined
      }
    });
  }
}
