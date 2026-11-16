import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).default('5000'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/pilotmama?schema=public'),
  DIRECT_URL: z.string().optional().default(''),
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
  RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_webhook_secret_pilotmama_sprint7'),
  // Dedicated Administrator Provisioning (Part 28)
  ADMIN_EMAIL: z.string().email().default('admin@pilotmama.io'),
  ADMIN_PASSWORD: z.string().min(8).default('Admin@PilotMama2026!'),
  // Production-grade Job Source Scheduler Secret
  JOB_SYNC_CRON_SECRET: z.string().optional().default(''),
  // Social OAuth Authentication (Google & LinkedIn)
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  LINKEDIN_CLIENT_ID: z.string().optional().default(''),
  LINKEDIN_CLIENT_SECRET: z.string().optional().default(''),
  APP_BASE_URL: z.string().default('http://localhost:5173'),
  // Production SMTP / Transactional Email (Brevo)
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.string().optional().default('587').transform(val => parseInt(val, 10) || 587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM_EMAIL: z.string().optional().default(''),
  SMTP_FROM_NAME: z.string().optional().default('Pilot Mama'),
  BREVO_API_KEY: z.string().optional().default(''),
  // Persistent Object Storage Configuration (GCS / S3 / R2 / Local)
  STORAGE_PROVIDER: z.enum(['local', 's3', 'r2', 'gcs']).default('local'),
  STORAGE_ENDPOINT: z.string().optional().default(''),
  STORAGE_BUCKET: z.string().optional().default(''),
  STORAGE_REGION: z.string().optional().default('auto'),
  STORAGE_ACCESS_KEY: z.string().optional().default(''),
  STORAGE_SECRET_KEY: z.string().optional().default('')
});


const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ FATAL: Environment variable validation failed:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// In production, validate critical security prerequisites
if (process.env.NODE_ENV === 'production' && parsedEnv.success) {
  const prodEnv = parsedEnv.data;
  const issues: string[] = [];

  if (prodEnv.JWT_ACCESS_SECRET === 'pilotmama-super-secret-jwt-access-key-production-ready') {
    issues.push('JWT_ACCESS_SECRET is set to an insecure default value. Provide a unique cryptographically secure secret.');
  }
  if (prodEnv.JWT_REFRESH_SECRET === 'pilotmama-super-secret-jwt-refresh-key-production-ready') {
    issues.push('JWT_REFRESH_SECRET is set to an insecure default value. Provide a unique cryptographically secure secret.');
  }
  if (prodEnv.JWT_ACCESS_SECRET === prodEnv.JWT_REFRESH_SECRET) {
    issues.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct secrets.');
  }
  if (prodEnv.DATABASE_URL.includes('localhost') || prodEnv.DATABASE_URL.includes('127.0.0.1')) {
    issues.push('DATABASE_URL points to localhost in production. Configure a production PostgreSQL connection string.');
  }

  if (issues.length > 0) {
    console.error('❌ FATAL: Production security configuration check failed:');
    issues.forEach(issue => console.error(`  - ${issue}`));
    process.exit(1);
  }
}

export const env = parsedEnv.success ? parsedEnv.data : envSchema.parse({});
export type EnvConfig = z.infer<typeof envSchema>;
