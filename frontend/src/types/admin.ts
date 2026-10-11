export interface AdminCandidateItem {
  id: string;
  email: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  candidateProfileId: string | null;
  fullName: string;
  headline: string | null;
  location: string | null;
  resumeCount: number;
  applicationCount: number;
  experienceCount: number;
  skillsCount: number;
  subscriptionPlan: string;
  subscriptionStatus: string;
  creditBalance: number;
}

export interface AdminResumeItem {
  id: string;
  title: string;
  originalFileName: string;
  status: string;
  source: string;
  fileSize: number | null;
  mimeType: string | null;
  isMaster: boolean;
  uploadedAt: string;
  parsedAt: string | null;
  updatedAt: string;
  versionCount: number;
  candidateName: string;
  candidateEmail: string;
  candidateUserId: string;
}

export interface AdminJobItem {
  id: string;
  title: string;
  location: string | null;
  remoteType: string;
  employmentType: string;
  status: string;
  sourceType: string;
  sourceName: string;
  sourceUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  companyName: string;
  companyId: string;
  applicationCount: number;
}

export interface AdminApplicationItem {
  id: string;
  status: string;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  candidateName: string;
  candidateEmail: string;
  candidateId: string;
  jobTitle: string;
  jobId: string;
  companyName: string;
  resumeVersionTitle: string;
}

export interface AdminEmployerItem {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  verificationStatus: string;
  createdAt: string;
  memberCount: number;
  jobCount: number;
  primaryContact: string;
}

export interface AdminPaymentItem {
  id: string;
  paymentId: string | null;
  orderId: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  userEmail: string;
  userName: string;
  planName: string;
}

export interface AdminSubscriptionItem {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  userId: string;
  planName: string;
  planCode: string;
  price: number;
  interval: string;
  creditBalance: number;
}

export interface AdminCreditWalletItem {
  id: string;
  balance: number;
  lifetimeGranted: number;
  lifetimeConsumed: number;
  updatedAt: string;
  userEmail: string;
  userName: string;
}

export interface AdminCreditLedgerItem {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  reason: string;
  createdAt: string;
  userEmail: string;
}

export interface AdminCreditsData {
  wallets: AdminCreditWalletItem[];
  recentActivity: AdminCreditLedgerItem[];
}
