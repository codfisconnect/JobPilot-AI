import React, { useEffect, useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import type { Plan, UserBillingState, CreditLedgerEntry, PaymentRecord } from '../types/billing';
import {
  Check,
  Zap,
  Shield,
  CreditCard,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  History,
  Coins
} from 'lucide-react';
import './PricingPage.css';

interface PricingPageProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'plans' | 'ledger' | 'payments'>('plans');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingState, setBillingState] = useState<UserBillingState | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [verificationInProgress, setVerificationInProgress] = useState<boolean>(false);

  useEffect(() => {
    fetchBillingData();
  }, [user]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [plansData, myBilling] = await Promise.all([
        apiClient.getPlans(),
        user ? apiClient.getMyBilling() : Promise.resolve(null)
      ]);
      setPlans(plansData);
      if (myBilling) {
        setBillingState(myBilling);
      }
    } catch (err: any) {
      showToast?.(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async () => {
    if (!user) return;
    try {
      const res = await apiClient.getLedger(30, 0);
      setLedger(res.items || []);
    } catch (err: any) {
      showToast?.(err.message || 'Failed to load ledger');
    }
  };

  const loadPayments = async () => {
    if (!user) return;
    try {
      const res = await apiClient.getPaymentHistory();
      setPayments(res || []);
    } catch (err: any) {
      showToast?.(err.message || 'Failed to load payments');
    }
  };

  const handleTabChange = (tab: 'plans' | 'ledger' | 'payments') => {
    setActiveTab(tab);
    if (tab === 'ledger') loadLedger();
    if (tab === 'payments') loadPayments();
  };

  const handleCheckout = async (plan: Plan) => {
    if (!user) {
      onNavigate?.('auth');
      return;
    }

    if (plan.code === 'FREE') {
      showToast?.('You already have access to the Free Starter plan.');
      return;
    }

    try {
      setActionLoading(plan.code);
      const session = await apiClient.createCheckout(plan.code);

      // Check if Razorpay script is present on window
      const hasRazorpay = typeof (window as any).Razorpay !== 'undefined';

      if (!hasRazorpay) {
        // Dynamically load Razorpay checkout script if not present
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve) => { script.onload = resolve; });
      }

      const options = {
        key: session.keyId,
        amount: session.amount,
        currency: session.currency,
        name: 'Pilot Mama',
        description: `${session.planName} Upgrade`,
        order_id: session.orderId,
        handler: async (response: any) => {
          try {
            setVerificationInProgress(true);
            showToast?.('Payment received. Verifying transaction with server...');

            await apiClient.verifyPayment({
              providerOrderId: session.orderId,
              providerPaymentId: response.razorpay_payment_id,
              providerSignature: response.razorpay_signature
            });

            showToast?.('Payment verified! Your plan and credits have been activated.');
            await fetchBillingData();
          } catch (verifyErr: any) {
            showToast?.(verifyErr.message || 'Payment verification failed');
          } finally {
            setVerificationInProgress(false);
          }
        },
        prefill: {
          email: user.email,
          name: user.candidateProfile?.fullName || ''
        },
        theme: {
          color: '#6366f1'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (failRes: any) => {
        showToast?.(failRes.error?.description || 'Checkout cancelled or payment failed');
      });
      rzp.open();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to initiate checkout');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your recurring subscription? You will retain benefits until the end of the billing period.')) {
      return;
    }
    try {
      setActionLoading('cancel');
      await apiClient.cancelSubscription();
      showToast?.('Subscription set to cancel at period end.');
      await fetchBillingData();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const isCurrentPlan = (code: string) => {
    return billingState?.plan.code === code;
  };

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <div className="pricing-badge">
          <Sparkles size={14} /> Authoritative Commercial Plans
        </div>
        <h1 className="pricing-title">Simple, Transparent Career Investment</h1>
        <p className="pricing-subtitle">
          Supercharge your interview prep, resume tailoring, and job search with guaranteed AI credits and enterprise models.
        </p>
      </div>

      {verificationInProgress && (
        <div className="pricing-banner-active" style={{ borderColor: '#6366f1', background: 'rgba(99, 102, 241, 0.1)' }}>
          <div className="pricing-banner-title">
            <RefreshCw size={18} className="spin-icon" style={{ animation: 'spin 1s linear infinite' }} />
            Payment verification in progress. Contacting server authority...
          </div>
        </div>
      )}

      {billingState && (
        <div className="pricing-banner-active">
          <div className="pricing-banner-title">
            <Shield size={18} className="text-emerald" />
            <span>Active Plan: <strong>{billingState.plan.name}</strong></span>
            <Badge variant={billingState.plan.code === 'PRO' ? 'indigo' : 'emerald'} size="sm">
              {billingState.plan.code}
            </Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem' }}>
              <Coins size={16} color="#fbbf24" />
              <span>Available AI Credits: <strong>{billingState.wallet.balance}</strong></span>
            </div>
            {billingState.subscription && !billingState.subscription.cancelAtPeriodEnd && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelSubscription}
                disabled={actionLoading === 'cancel'}
              >
                Cancel Subscription
              </Button>
            )}
            {billingState.subscription?.cancelAtPeriodEnd && (
              <Badge variant="amber" size="sm">Cancels at period end</Badge>
            )}
          </div>
        </div>
      )}

      <div className="billing-tabs-nav">
        <button
          className={`billing-tab-btn ${activeTab === 'plans' ? 'billing-tab-btn-active' : ''}`}
          onClick={() => handleTabChange('plans')}
        >
          Plans & Pricing
        </button>
        <button
          className={`billing-tab-btn ${activeTab === 'ledger' ? 'billing-tab-btn-active' : ''}`}
          onClick={() => handleTabChange('ledger')}
        >
          Credit Ledger Audit
        </button>
        <button
          className={`billing-tab-btn ${activeTab === 'payments' ? 'billing-tab-btn-active' : ''}`}
          onClick={() => handleTabChange('payments')}
        >
          Payment History
        </button>
      </div>

      {activeTab === 'plans' && (
        <div className="pricing-grid">
          {plans.map((p) => {
            const isPopular = p.code === 'BASIC';
            const current = isCurrentPlan(p.code);

            return (
              <div key={p.id} className={`plan-card ${isPopular ? 'plan-card-popular' : ''}`}>
                {isPopular && <div className="popular-ribbon">Most Popular</div>}
                <h3 className="plan-name">{p.name}</h3>
                <p className="plan-desc">{p.description}</p>

                <div className="plan-price-box">
                  <span className="plan-price-currency">₹</span>
                  <span className="plan-price-amount">{p.price / 100}</span>
                  <span className="plan-price-period">/ month</span>
                </div>

                <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--bg-surface-hover)', borderRadius: '8px', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Resume Profiles:</span>
                    <strong>Up to {p.resumeProfileLimit}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>AI Credit Budget:</span>
                    <strong>{p.creditAllowance} credits/mo</strong>
                  </div>
                </div>

                <ul className="plan-features-list">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="plan-feature-item">
                      <Check size={16} className="plan-feature-icon" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className="plan-action-btn"
                  style={{
                    background: current ? 'var(--bg-surface-hover)' : isPopular ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'var(--accent-primary)',
                    color: current ? 'var(--text-primary)' : '#ffffff',
                    border: current ? '1px solid var(--border-primary)' : 'none'
                  }}
                  disabled={current || actionLoading === p.code || verificationInProgress}
                  onClick={() => handleCheckout(p)}
                >
                  {current ? (
                    'Current Plan'
                  ) : actionLoading === p.code ? (
                    'Preparing Checkout...'
                  ) : p.code === 'FREE' ? (
                    'Free Starter'
                  ) : (
                    <>
                      <span>Upgrade to {p.name}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'ledger' && (
        <div>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Immutable Credit Ledger</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Complete audit trail of AI feature grants & deductions
            </span>
          </div>

          <div className="ledger-table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Transaction Type</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Reason & Reference</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No credit transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <Badge
                          variant={entry.type === 'GRANT' || entry.type === 'REFUND' ? 'emerald' : 'amber'}
                          size="sm"
                        >
                          {entry.type}
                        </Badge>
                      </td>
                      <td style={{ fontWeight: 600, color: entry.amount > 0 ? '#10b981' : '#f87171' }}>
                        {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                      </td>
                      <td>{entry.balanceAfter}</td>
                      <td>
                        <div>{entry.reason}</div>
                        {entry.referenceType && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Ref: {entry.referenceType} ({entry.referenceId || 'N/A'})
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Payment Transactions</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              All server-verified gateway transactions
            </span>
          </div>

          <div className="ledger-table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Order Reference</th>
                  <th>Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No payment history recorded.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{p.amount / 100}</td>
                      <td>
                        <Badge
                          variant={p.status === 'CAPTURED' ? 'emerald' : p.status === 'FAILED' ? 'rose' : 'amber'}
                          size="sm"
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{p.providerOrderId || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{p.providerPaymentId || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
