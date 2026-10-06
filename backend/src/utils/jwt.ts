import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { TokenPayload } from '../types/auth.types.js';

import { randomUUID } from 'crypto';

const JWT_ISSUER = 'pilot-mama-auth';

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    jwtid: randomUUID(),
    issuer: JWT_ISSUER
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    jwtid: randomUUID(),
    issuer: JWT_ISSUER
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER
  }) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER
  }) as TokenPayload;
}
