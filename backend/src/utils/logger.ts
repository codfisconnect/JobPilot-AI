import { env } from '../config/env.js';

export interface LogContext {
  requestId?: string;
  userId?: string;
  role?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new RegExp(
  '^(password|passwordhash|token|secret|jwt|refreshtoken|authorization|cookie|rawtext|parseddata)$',
  'i'
);

function sanitize(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitize(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

class Logger {
  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('WARN', message, context);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: env.NODE_ENV !== 'production' ? error.stack : undefined }
      : error;

    this.log('ERROR', message, { ...context, error: errorDetails });
  }

  debug(message: string, context?: LogContext): void {
    if (env.NODE_ENV === 'development') {
      this.log('DEBUG', message, context);
    }
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, context?: LogContext): void {
    const sanitizedContext = context ? (sanitize(context) as LogContext) : undefined;
    const timestamp = new Date().toISOString();

    if (env.NODE_ENV === 'production') {
      console.log(JSON.stringify({ timestamp, level, message, ...sanitizedContext }));
    } else {
      const color =
        level === 'ERROR' ? '\x1b[31m' :
        level === 'WARN'  ? '\x1b[33m' :
        level === 'DEBUG' ? '\x1b[36m' : '\x1b[32m';
      const reset = '\x1b[0m';
      const reqInfo = context?.requestId ? `[${context.requestId}] ` : '';
      console.log(`${color}[${level}]${reset} ${timestamp} ${reqInfo}${message}`, sanitizedContext ? sanitizedContext : '');
    }
  }
}

export const logger = new Logger();
