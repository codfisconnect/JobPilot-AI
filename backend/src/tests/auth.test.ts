import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { UserRole } from '@prisma/client';
import { RegisterSchema, LoginSchema } from '../middleware/validate.middleware.js';
import { AuthService } from '../services/auth.service.js';
import type { UserRepository } from '../repositories/user.repository.js';

describe('Sprint 1 Production Authentication Suite', () => {

  describe('Password Hashing with Argon2', () => {
    it('should hash a password with Argon2id and verify successfully', async () => {
      const password = 'StrongPassword123!';
      const hash = await hashPassword(password);

      assert.ok(hash.startsWith('$argon2id$'), 'Hash should be an Argon2id format');
      assert.notStrictEqual(hash, password, 'Hash must not equal plaintext');

      const isValid = await verifyPassword(hash, password);
      assert.strictEqual(isValid, true, 'Valid password verification must succeed');

      const isInvalid = await verifyPassword(hash, 'WrongPassword');
      assert.strictEqual(isInvalid, false, 'Invalid password verification must fail');
    });
  });

  describe('JWT Token Lifecycle', () => {
    const payload = {
      userId: 'usr_123456',
      email: 'pilot@example.com',
      role: UserRole.CANDIDATE
    };

    it('should sign and verify access token', () => {
      const token = signAccessToken(payload);
      assert.ok(token.length > 20);

      const decoded = verifyAccessToken(token);
      assert.strictEqual(decoded.userId, payload.userId);
      assert.strictEqual(decoded.email, payload.email);
      assert.strictEqual(decoded.role, UserRole.CANDIDATE);
    });

    it('should sign and verify refresh token', () => {
      const token = signRefreshToken(payload);
      assert.ok(token.length > 20);

      const decoded = verifyRefreshToken(token);
      assert.strictEqual(decoded.userId, payload.userId);
    });
  });

  describe('Validation Schemas (Zod)', () => {
    it('should validate well-formed registration inputs', () => {
      const valid = RegisterSchema.safeParse({
        email: '  test.user@pilotmama.com  ',
        password: 'SecurePassword2026',
        fullName: 'Jane Doe'
      });

      assert.strictEqual(valid.success, true);
      if (valid.success) {
        assert.strictEqual(valid.data.email, 'test.user@pilotmama.com'); // normalized
      }
    });

    it('should reject invalid email or short password', () => {
      const invalidEmail = RegisterSchema.safeParse({
        email: 'invalid-email',
        password: 'SecurePassword2026'
      });
      assert.strictEqual(invalidEmail.success, false);

      const shortPassword = RegisterSchema.safeParse({
        email: 'test@pilotmama.com',
        password: 'short'
      });
      assert.strictEqual(shortPassword.success, false);
    });
  });

  describe('AuthService Workflow with Repository Mock', () => {
    const mockUsers: any[] = [];
    const mockTokens: any[] = [];

    const mockRepo: UserRepository = {
      async findByEmail(email: string) {
        const found = mockUsers.find(u => u.email === email);
        return found ? { ...found } : null;
      },
      async findById(id: string) {
        const found = mockUsers.find(u => u.id === id);
        return found ? { ...found } : null;
      },
      async createUser(data: any) {
        const newUser = {
          id: 'user_' + (mockUsers.length + 1),
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role || UserRole.CANDIDATE,
          isActive: true,
          emailVerified: false,
          createdAt: new Date(),
          candidateProfile: {
            id: 'prof_' + (mockUsers.length + 1),
            fullName: data.fullName || 'Test User'
          }
        };
        mockUsers.push(newUser);
        return newUser as any;
      },
      async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
        mockTokens.push({ userId, tokenHash, expiresAt });
      },
      async findRefreshToken(userId: string, tokenHash: string) {
        return mockTokens.find(t => t.userId === userId && t.tokenHash === tokenHash) || null;
      },
      async deleteRefreshTokensForUser(userId: string) {
        for (let i = mockTokens.length - 1; i >= 0; i--) {
          if (mockTokens[i].userId === userId) {
            mockTokens.splice(i, 1);
          }
        }
      }
    } as any;

    const auth = new AuthService(mockRepo);

    it('should register a candidate and default to CANDIDATE role', async () => {
      const result = await auth.register({
        email: 'candidate@pilotmama.com',
        password: 'Password123!',
        fullName: 'Alex Candidate'
      });

      assert.strictEqual(result.user.email, 'candidate@pilotmama.com');
      assert.strictEqual(result.user.role, UserRole.CANDIDATE);
      assert.ok(result.accessToken);
      assert.ok(result.refreshToken);
      assert.strictEqual(result.user.candidateProfile?.fullName, 'Alex Candidate');
    });

    it('should reject duplicate email registration with ConflictError', async () => {
      await assert.rejects(
        async () => {
          await auth.register({
            email: 'candidate@pilotmama.com',
            password: 'AnotherPassword!'
          });
        },
        { name: 'ConflictError' }
      );
    });

    it('should login with valid credentials', async () => {
      const result = await auth.login({
        email: 'candidate@pilotmama.com',
        password: 'Password123!'
      });

      assert.strictEqual(result.user.email, 'candidate@pilotmama.com');
      assert.ok(result.accessToken);
      assert.ok(result.refreshToken);
    });

    it('should reject login with wrong password', async () => {
      await assert.rejects(
        async () => {
          await auth.login({
            email: 'candidate@pilotmama.com',
            password: 'WrongPassword!'
          });
        },
        { name: 'UnauthorizedError' }
      );
    });

    it('should rotate refresh token', async () => {
      const loginRes = await auth.login({
        email: 'candidate@pilotmama.com',
        password: 'Password123!'
      });

      const refreshRes = await auth.refreshToken(loginRes.refreshToken);
      assert.ok(refreshRes.accessToken);
      assert.ok(refreshRes.refreshToken);
      assert.notStrictEqual(refreshRes.refreshToken, loginRes.refreshToken);

      // Replay attack: using the old refresh token must be rejected
      await assert.rejects(
        async () => {
          await auth.refreshToken(loginRes.refreshToken);
        },
        { name: 'UnauthorizedError' }
      );
    });

    it('should return safe user info via getMe()', async () => {
      const user = await auth.getMe('user_1');
      assert.strictEqual(user.email, 'candidate@pilotmama.com');
      assert.strictEqual((user as any).passwordHash, undefined, 'Password hash must never leak in getMe()');
    });

    it('should logout and invalidate tokens', async () => {
      await auth.logout('user_1');
      assert.strictEqual(mockTokens.length, 0);
    });
  });
});
