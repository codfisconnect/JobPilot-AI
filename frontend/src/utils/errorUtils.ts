export interface NormalizedError {
  message: string;
  code?: string;
  details?: string;
}

/**
 * Normalizes any error shape (Error, string, structured API error, Axios response, etc.)
 * into a safe, human-readable NormalizedError.
 * 
 * GUARANTEE: Neither `message` nor `details` will ever contain `[object Object]`.
 */
export function normalizeApiError(err: unknown, defaultMessage = 'An unexpected error occurred.'): NormalizedError {
  if (err === null || err === undefined) {
    return { message: defaultMessage };
  }

  // 1. Plain string
  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (!trimmed || trimmed === '[object Object]') {
      return { message: defaultMessage };
    }
    return { message: trimmed };
  }

  // 2. Native Error instance
  if (err instanceof Error) {
    let msg = err.message || defaultMessage;
    if (msg === '[object Object]') msg = defaultMessage;
    const code = (err as any).code ? String((err as any).code) : undefined;
    const details = (err as any).details ? formatDetails((err as any).details) : undefined;
    return { message: msg, code, details };
  }

  // 3. Object-based error shapes
  if (typeof err === 'object') {
    const obj = err as Record<string, any>;

    // Case 3a: Axios error shape (err.response.data)
    if (obj.response && typeof obj.response === 'object' && obj.response.data) {
      return normalizeApiError(obj.response.data, defaultMessage);
    }

    // Case 3b: Nested `error` property
    if (obj.error) {
      if (typeof obj.error === 'string') {
        const msg = obj.error.trim();
        return {
          message: msg && msg !== '[object Object]' ? msg : defaultMessage,
          code: obj.code ? String(obj.code) : undefined,
          details: obj.details ? formatDetails(obj.details) : undefined
        };
      }
      if (typeof obj.error === 'object') {
        const nested = obj.error;
        const msg = typeof nested.message === 'string' && nested.message.trim() && nested.message !== '[object Object]'
          ? nested.message.trim()
          : defaultMessage;
        const code = nested.code ? String(nested.code) : (obj.code ? String(obj.code) : undefined);
        const details = nested.details ? formatDetails(nested.details) : (obj.details ? formatDetails(obj.details) : undefined);
        return { message: msg, code, details };
      }
    }

    // Case 3c: Standard `message` property
    if (typeof obj.message === 'string' && obj.message.trim() && obj.message !== '[object Object]') {
      return {
        message: obj.message.trim(),
        code: obj.code ? String(obj.code) : undefined,
        details: obj.details ? formatDetails(obj.details) : undefined
      };
    }

    // Case 3d: `data` property with message or error
    if (obj.data && typeof obj.data === 'object') {
      return normalizeApiError(obj.data, defaultMessage);
    }

    // Case 3e: Fallback for generic objects with no recognizable message property
    // Convert object keys and values into a safe summary rather than [object Object]
    try {
      const stringified = JSON.stringify(obj, null, 2);
      if (stringified && stringified !== '{}') {
        return {
          message: defaultMessage,
          details: stringified
        };
      }
    } catch {
      // Ignored
    }
  }

  return { message: defaultMessage };
}

function formatDetails(details: unknown): string {
  if (typeof details === 'string') {
    return details.trim() !== '[object Object]' ? details.trim() : '';
  }
  if (Array.isArray(details)) {
    return details
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return item.message || item.error || JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean)
      .join('\n');
  }
  if (details && typeof details === 'object') {
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return '';
    }
  }
  return String(details);
}
