import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).default('5000'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/pilotmama?schema=public'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters').default('pilotmama-super-secret-jwt-access-key-production-ready'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters').default('pilotmama-super-secret-jwt-refresh-key-production-ready'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Optional prototype / integration variables
  GEMINI_API_KEY: z.string().optional(),
  // Razorpay Payment Gateway (Sprint 7)
  RAZORPAY_KEY_ID: z.string().default('rzp_test_mockKeyIdSprint7'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_test_mockSecretSprint7KeyMinimum32'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_webhook_secret_pilotmama_sprint7')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ FATAL: Environment variable validation failed:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export const env = parsedEnv.success ? parsedEnv.data : envSchema.parse({});
export type EnvConfig = z.infer<typeof envSchema>;
