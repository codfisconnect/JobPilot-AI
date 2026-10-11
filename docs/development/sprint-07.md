# Sprint 07 — Payments, Credits, Plans, Entitlements & Razorpay Integration

## 1. Executive Summary & Objective
Sprint 7 delivers the complete monetization, entitlement, and transactional billing layer for Pilot Mama V1. It integrates server-authoritative Plans, Entitlements, Credit Wallets, Immutable Credit Ledgers, Payments, and Razorpay payment processing (Order creation, Checkout verification, and HMAC-SHA256 Webhook processing with strict idempotency and replay protection).

The backend/database is **authoritative** for all billing decisions. The frontend never determines plan validity, balances, or payment states.

---

## 2. Architecture Audit & Existing Systems
Prior to implementation, an exhaustive audit was performed:
- **Database**: PostgreSQL with Prisma 6.4.1. Core models include `User`, `CandidateProfile`, `Resume`, `ResumeVersion`, `Job`, `JobMatch`, `Application`, `InterviewPreparationSession`, `LearningPlan`. No billing, credit, or payment models existed in Prisma prior to Sprint 7.
- **Identity & Auth**: JWT-based access tokens with HttpOnly refresh tokens. Authentication is extracted from `req.user.userId`.
- **Prototype Remnants**: An embedded SQLite WASM database (`jobpilot.sqlite`) was used in early prototypes. Production V1 runs strictly against PostgreSQL (`pilot_mama_dev`) via Prisma.
- **AI Entry Points**:
  - `POST /api/v1/jobs/:id/tailor-resume` (Resume tailoring: mode `FULL`, `FOCUSED`, `TARGETED`).
  - `POST /api/v1/interview/sessions/:id/questions` (Interview questions generation).
  - `POST /api/v1/interview/questions/:id/evaluate` (Interview answer evaluation).
  - `POST /api/v1/career/learning-plan` (Career intelligence learning plan generation).

---

## 3. Data Model Architecture (Prisma)

### 3.1 Plan (`plans`)
- `id`: UUID (Primary Key)
- `code`: `PlanCode` enum (`FREE`, `BASIC`, `PRO`) - Unique
- `name`: String (Display Name)
- `description`: String
- `price`: Int (in smallest currency unit, e.g. paise / cents)
- `currency`: String (Default: 'INR')
- `billingInterval`: `BillingInterval` enum (`MONTHLY`, `YEARLY`, `ONEOFF`)
- `creditAllowance`: Int (Monthly / granted credit budget)
- `resumeProfileLimit`: Int (e.g. 1 for Free, 2 for Basic, 5 for Pro)
- `features`: String[] (List of feature bullets for marketing/display)
- `isActive`: Boolean (Default: true)
- `sortOrder`: Int (Default: 0)
- `createdAt`, `updatedAt`: DateTime

### 3.2 Subscription (`subscriptions`)
- `id`: UUID (Primary Key)
- `userId`: String (Foreign Key -> `User.id`)
- `planId`: String (Foreign Key -> `Plan.id`)
- `status`: `SubscriptionStatus` enum (`ACTIVE`, `PAST_DUE`, `CANCELLED`, `EXPIRED`, `TRIALING`)
- `provider`: `PaymentProvider` enum (`RAZORPAY`, `STRIPE`, `MANUAL`)
- `providerSubscriptionId`: String? (for recurring mandates)
- `currentPeriodStart`: DateTime
- `currentPeriodEnd`: DateTime?
- `cancelAtPeriodEnd`: Boolean (Default: false)
- `cancelledAt`: DateTime?
- `metadata`: Json?
- `createdAt`, `updatedAt`: DateTime

### 3.3 Credit Wallet (`credit_wallets`)
- `id`: UUID (Primary Key)
- `userId`: String (Unique, Foreign Key -> `User.id`)
- `balance`: Int (Default: 0, checked constraint: `balance >= 0`)
- `lifetimeGranted`: Int (Default: 0)
- `lifetimeConsumed`: Int (Default: 0)
- `updatedAt`: DateTime

### 3.4 Credit Ledger (`credit_ledgers`)
- `id`: UUID (Primary Key)
- `walletId`: String (Foreign Key -> `CreditWallet.id`)
- `userId`: String (Foreign Key -> `User.id`)
- `amount`: Int (positive for grants/refunds, negative for consumption)
- `balanceAfter`: Int (authoritative balance after mutation)
- `type`: `CreditLedgerType` enum (`GRANT`, `CONSUME`, `REFUND`, `ADJUSTMENT`, `EXPIRATION`)
- `reason`: String
- `referenceType`: String? (e.g., 'PAYMENT', 'TAILOR_RESUME', 'INTERVIEW_GEN', 'EVALUATE_ANSWER', 'LEARNING_PLAN')
- `referenceId`: String?
- `idempotencyKey`: String? (Unique)
- `metadata`: Json?
- `createdAt`: DateTime (Immutable)

### 3.5 Payment (`payments`)
- `id`: UUID (Primary Key)
- `userId`: String (Foreign Key -> `User.id`)
- `planId`: String? (Foreign Key -> `Plan.id`)
- `provider`: `PaymentProvider` enum (`RAZORPAY`, `STRIPE`, `MANUAL`)
- `providerOrderId`: String? (Unique, Razorpay order_id)
- `providerPaymentId`: String? (Unique, Razorpay payment_id)
- `providerSignature`: String?
- `amount`: Int (authoritative amount in smallest unit)
- `currency`: String (Default: 'INR')
- `status`: `PaymentStatus` enum (`CREATED`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `REFUNDED`, `CANCELLED`)
- `purpose`: `PaymentPurpose` enum (`SUBSCRIPTION_UPGRADE`, `CREDIT_PURCHASE`, `MEMBERSHIP`)
- `metadata`: Json?
- `createdAt`, `updatedAt`: DateTime

### 3.6 Webhook Event (`webhook_events`)
- `id`: UUID (Primary Key)
- `provider`: `PaymentProvider` enum (`RAZORPAY`, `STRIPE`)
- `providerEventId`: String (Unique per provider event id or deterministic fingerprint)
- `eventType`: String (e.g., 'payment.captured', 'order.paid')
- `payloadHash`: String (SHA-256 hash of raw payload)
- `status`: `WebhookStatus` enum (`PENDING`, `PROCESSED`, `FAILED`, `IGNORED`)
- `processingNotes`: String?
- `processedAt`: DateTime?
- `createdAt`: DateTime

---

## 4. Entitlement & Credit Cost Model

### 4.1 Feature Entitlements
Entitlements are calculated dynamically from the active plan and current profile counts:
- `resumeProfiles`: Free (1), Basic (2), Pro (5)
- `advancedTailoring`: Free (true, costs credits), Basic (true), Pro (true)
- `interviewGeneration`: Free (true, costs credits), Basic (true), Pro (true)
- `careerIntelligence`: Free (true, costs credits), Basic (true), Pro (true)
- `unlimitedExport`: Free (false), Basic (true), Pro (true)

### 4.2 Configurable Credit Costs
Defined in `backend/src/modules/billing/billing.constants.ts`:
- `RESUME_TAILOR`: 5 credits
- `INTERVIEW_SESSION_GEN`: 3 credits
- `INTERVIEW_EVALUATION`: 2 credits
- `CAREER_LEARNING_PLAN`: 4 credits

### 4.3 Atomic Credit Consumption Guarantee
Credit deductions use PostgreSQL transaction isolation and atomic update conditions:
```sql
UPDATE credit_wallets
SET balance = balance - :cost,
    lifetime_consumed = lifetime_consumed + :cost,
    updated_at = NOW()
WHERE user_id = :userId AND balance >= :cost
RETURNING *;
```
If 0 rows are updated, an `InsufficientCreditsError` is thrown, eliminating race conditions or negative balances without dirty reads.

---

## 5. Razorpay Integration & Webhook Architecture

### 5.1 Gateway Abstraction (`IPaymentGateway`)
Decouples payment provider logic so alternative gateways (Stripe, LemonSqueezy) can be swapped seamlessly without modifying core business services.
- `createOrder(params)`: Generates provider order.
- `verifyCheckoutSignature(params)`: Verifies HMAC-SHA256 signature using `order_id + '|' + payment_id`.
- `verifyWebhookSignature(rawBody, signature)`: Validates HMAC-SHA256 signature against webhook secret using constant-time comparison (`crypto.timingSafeEqual`).

### 5.2 Server-Side Signature Verification
Formula:
```ts
const expected = crypto
  .createHmac('sha256', keySecret)
  .update(`${providerOrderId}|${providerPaymentId}`)
  .digest('hex');
const isValid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```
Crucially, `providerOrderId` is loaded from the authoritative database `Payment` record, never blindly trusted from client input.

### 5.3 Webhook Idempotency & Raw Body Capture
To ensure accurate HMAC verification, Express captures `req.rawBody` using `express.json({ verify: (req, _res, buf) => req.rawBody = buf })`.
Webhook processing algorithm:
1. Validate HMAC signature.
2. Check `webhook_events` by `providerEventId`.
3. If already processed, return `200 OK` (`idempotent duplicate`).
4. If not, record webhook event in status `PENDING`.
5. Execute transactional payment capture and credit/plan activation.
6. Mark event as `PROCESSED`.

---

## 6. Billing API Specifications

- `GET /api/v1/billing/plans`: Returns active commercial plans (sorted by `sortOrder`).
- `GET /api/v1/billing/me`: Returns comprehensive billing state for current user (active plan, subscription, credit balance, entitlements, usage statistics).
- `GET /api/v1/billing/credits`: Returns current user wallet balance.
- `GET /api/v1/billing/credits/ledger`: Paginated immutable ledger history for current user.
- `POST /api/v1/billing/checkout`: Creates Razorpay order for chosen plan.
- `POST /api/v1/billing/payments/verify`: Verifies client checkout signature and activates plan/credits.
- `POST /api/v1/billing/razorpay/webhook`: Webhook handler for asynchronous provider events.
- `GET /api/v1/billing/payments`: Lists payment transaction history for current user.
- `POST /api/v1/billing/subscription/cancel`: Cancels current active subscription at period end.

---

## 7. Frontend Billing Experience

1. **Pricing / Plans Page (`/pricing` / `currentTab === 'pricing'`):**
   - Clean tier comparisons (FREE, BASIC, PRO).
   - Monthly / Annual toggle or clear billing interval display.
   - Included resume allowance, credit limits, and feature badges.
   - Dynamic button state: "Current Plan", "Upgrade", "Select Plan".
   - Razorpay Checkout modal integration with automatic token refreshment.

2. **Billing & Credits Section in Settings / Dedicated Dashboard widget:**
   - Real-time Credit Balance display with Top-up / Upgrade prompt.
   - Transaction & Payment History table with downloadable receipts / status badges.
   - Ledger audit trail showing exact grants and AI feature deductions.

---

## 8. Migration & Seeding Strategy
- Generate Prisma migration: `20261006143000_sprint7_payments_credits_premium`.
- Seed plans idempotently in `backend/src/database/seedMaster.ts` (using `upsert` on `Plan.code`).
- Assign default `FREE` plan and initial starter credits (10 credits) to new and existing candidates server-side.
