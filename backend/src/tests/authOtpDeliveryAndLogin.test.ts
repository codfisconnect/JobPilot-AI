import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { AuthService, AuthSessionResult } from '../services/auth.service.js';
import { OtpService } from '../services/otp.service.js';
import { EmailService, InMemoryEmailProvider, UnconfiguredProductionEmailProvider } from '../services/email/email.service.js';
import { IEmailProvider, EmailOptions, EmailSendResult } from '../services/email/emailProvider.interface.js';
import { OtpPurpose, UserRole } from '@prisma/client';
import { hashPassword } from '../utils/password.js';

// Custom mock provider to simulate email delivery failure in tests
class MockFailingEmailProvider implements IEmailProvider {
  public name = 'MOCK_FAILING_PROVIDER';
  isConfigured(): boolean {
    return true;
  }
  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    return {
      success: false,
      error: 'SMTP relay connection refused (simulated provider failure)',
      provider: this.name,
      timestamp: new Date().toISOString()
    };
  }
}

// Custom mock provider to record outgoing emails deterministically
class MockSuccessEmailProvider implements IEmailProvider {
  public name = 'MOCK_SUCCESS_PROVIDER';
  public sentMails: EmailOptions[] = [];
  isConfigured(): boolean {
    return true;
  }
  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    this.sentMails.push(options);
    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      provider: this.name,
      timestamp: new Date().toISOString()
    };
  }
  clear(): void {
    this.sentMails = [];
  }
}

describe('JobPilot AI - OTP Email Delivery and Password Login Scenarios', () => {
  const verifiedUserEmail = 'verified.candidate@testpilotmama.com';
  const unverifiedUserEmail = 'unverified.candidate@testpilotmama.com';
  const plainPassword = 'CorrectSecurePass123!';
  const wrongPassword = 'WrongPassword999!';

  let mockUsers: any[] = [];
  let mockRepo: any;
  let auth: AuthService;
  const originalEnvNodeEnv = process.env.NODE_ENV;

  before(async () => {
    const passwordHash = await hashPassword(plainPassword);

    mockUsers = [
      {
        id: 'usr_verified_1',
        email: verifiedUserEmail,
        passwordHash,
        role: UserRole.CANDIDATE,
        isActive: true,
        emailVerified: true,
        candidateProfile: {
          fullName: 'Verified Candidate'
        }
      },
      {
        id: 'usr_unverified_2',
        email: unverifiedUserEmail,
        passwordHash,
        role: UserRole.CANDIDATE,
        isActive: true,
        emailVerified: false,
        candidateProfile: {
          fullName: 'Unverified Candidate'
        }
      }
    ];

    mockRepo = {
      async findByEmail(email: string) {
        return mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
      },
      async findById(id: string) {
        return mockUsers.find(u => u.id === id) || null;
      },
      async markEmailVerified(userId: string) {
        const u = mockUsers.find(user => user.id === userId);
        if (u) {
          u.emailVerified = true;
          u.isActive = true;
        }
        return u;
      },
      async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
        // mock storage
      },
      async findRefreshToken(userId: string, tokenHash: string) {
        return null;
      },
      async deleteRefreshTokensForUser(userId: string) {
        // mock delete
      },
      async getProviderAccounts(userId: string) {
        return [];
      }
    };

    auth = new AuthService(mockRepo);
  });

  after(() => {
    process.env.NODE_ENV = originalEnvNodeEnv;
    EmailService.setProvider(new InMemoryEmailProvider());
  });

  beforeEach(() => {
    EmailService.setProvider(new InMemoryEmailProvider());
  });

  it('Scenario 1: Verified account + correct password -> creates session immediately without OTP challenge', async () => {
    const mockSuccess = new MockSuccessEmailProvider();
    EmailService.setProvider(mockSuccess);

    const result: any = await auth.login({
      email: verifiedUserEmail,
      password: plainPassword
    });

    assert.ok(result.user, 'Session must return user object');
    assert.strictEqual(result.user.email, verifiedUserEmail);
    assert.ok(result.accessToken, 'Session must return access token');
    assert.ok(result.refreshToken, 'Session must return refresh token');
    assert.strictEqual(result.requiresOtp, undefined, 'Must not challenge with requiresOtp');
    assert.strictEqual(mockSuccess.sentMails.length, 0, 'No email should be sent for verified password login');
  });

  it('Scenario 2: Incorrect password -> rejects with UnauthorizedError and generates no OTP', async () => {
    const mockSuccess = new MockSuccessEmailProvider();
    EmailService.setProvider(mockSuccess);

    await assert.rejects(
      async () => {
        await auth.login({
          email: verifiedUserEmail,
          password: wrongPassword
        });
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      }
    );

    assert.strictEqual(mockSuccess.sentMails.length, 0, 'No email should be dispatched on failed password');
  });

  it('Scenario 3: Unverified account + correct password -> creates session directly without OTP challenge', async () => {
    const mockSuccess = new MockSuccessEmailProvider();
    EmailService.setProvider(mockSuccess);

    const result: any = await auth.login({
      email: unverifiedUserEmail,
      password: plainPassword
    });

    assert.ok(result.user, 'Session must return user object');
    assert.strictEqual(result.user.email, unverifiedUserEmail);
    assert.strictEqual(result.user.emailVerified, false, 'Email verification flag remains false as separate property');
    assert.ok(result.accessToken, 'Session must return access token');
    assert.ok(result.refreshToken, 'Session must return refresh token');
    assert.strictEqual(result.requiresOtp, undefined, 'Must not challenge with requiresOtp');
    assert.strictEqual(mockSuccess.sentMails.length, 0, 'No email OTP should be sent for unverified password login');
  });

  it('Scenario 4: Unconfigured production email provider explicitly returns success: false', async () => {
    const unconfigured = new UnconfiguredProductionEmailProvider();
    assert.strictEqual(unconfigured.isConfigured(), false);

    const sendResult = await unconfigured.sendEmail({
      to: 'candidate@example.com',
      subject: 'Test',
      text: 'Test',
      html: '<p>Test</p>'
    });

    assert.strictEqual(sendResult.success, false);
    assert.ok(sendResult.error?.includes('Production transactional email service is not configured'));
    assert.strictEqual(sendResult.provider, 'UNCONFIGURED_PRODUCTION_PROVIDER');
  });

  it('Scenario 5: When email delivery fails, OtpService throws EMAIL_SEND_FAILED instead of falsely claiming success', async () => {
    EmailService.setProvider(new MockFailingEmailProvider());

    await assert.rejects(
      async () => {
        await OtpService.generateAndSendOtp('failing.otp@testpilotmama.com', OtpPurpose.LOGIN);
      },
      (err: any) => {
        assert.strictEqual(err.code, 'EMAIL_SEND_FAILED');
        assert.strictEqual(err.statusCode, 500);
        return true;
      }
    );
  });

  it('Scenario 6: Password login never attempts to send email even if email provider is broken', async () => {
    EmailService.setProvider(new MockFailingEmailProvider());

    const result: any = await auth.login({
      email: unverifiedUserEmail,
      password: plainPassword
    });

    assert.ok(result.user, 'Password login succeeds directly');
    assert.strictEqual(result.user.email, unverifiedUserEmail);
  });

  it('Scenario 7: Passwordless login uses LOGIN OTP purpose while Signup uses SIGNUP purpose', async () => {
    const mockSuccess = new MockSuccessEmailProvider();
    EmailService.setProvider(mockSuccess);

    const loginEmail = 'pwdless@testpilotmama.com';
    const signupEmail = 'signup@testpilotmama.com';

    // 1. Passwordless requestOtp -> LOGIN purpose
    await auth.requestOtp(loginEmail, OtpPurpose.LOGIN);
    assert.strictEqual(mockSuccess.sentMails.length, 1);
    assert.strictEqual(mockSuccess.sentMails[0].to, loginEmail);
    assert.strictEqual(mockSuccess.sentMails[0].metadata?.type, 'LOGIN_OTP');

    // 2. Registration OTP -> SIGNUP purpose
    await OtpService.generateAndSendOtp(signupEmail, OtpPurpose.SIGNUP);
    assert.strictEqual(mockSuccess.sentMails.length, 2);
    assert.strictEqual(mockSuccess.sentMails[1].to, signupEmail);
    assert.strictEqual(mockSuccess.sentMails[1].metadata?.type, 'SIGNUP_OTP');
  });

  it('Scenario 8: Development / Test in-memory provider works and captures sent mail without external calls', async () => {
    const inMemory = new InMemoryEmailProvider();
    EmailService.setProvider(inMemory);
    assert.strictEqual(inMemory.isConfigured(), true);

    const testEmail = 'dev.inmemory@testpilotmama.com';
    const res = await EmailService.sendVerificationEmail(testEmail, '654321');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.provider, 'IN_MEMORY_DEV_PROVIDER');
    assert.strictEqual(inMemory.getSentMails().length, 1);
    assert.strictEqual(inMemory.getLastMail(testEmail)?.to, testEmail);
  });
});
