import { logger } from './logger.js';

export interface SafeJsonParseResult<T = any> {
  success: boolean;
  data: T | null;
  isHtml: boolean;
  isEmpty: boolean;
  error?: string;
}

/**
 * Universal safe JSON parser that inspects response content-type,
 * body prefixes, and protects against crashing on unexpected HTML,
 * malformed strings, or empty payloads.
 */
export function safeParseJson<T = any>(
  rawText: string | null | undefined,
  contentType?: string
): SafeJsonParseResult<T> {
  if (rawText === null || rawText === undefined) {
    return { success: false, data: null, isHtml: false, isEmpty: true };
  }

  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return { success: false, data: null, isHtml: false, isEmpty: true };
  }

  const ct = (contentType || '').toLowerCase();
  const startsWithLt = trimmed.startsWith('<');
  const hasHtmlTag = startsWithLt || /<!doctype\s+html/i.test(trimmed) || /<html\b/i.test(trimmed);

  if (hasHtmlTag || (ct.includes('text/html') && !ct.includes('json'))) {
    return {
      success: false,
      data: null,
      isHtml: true,
      isEmpty: false,
      error: 'Response body is HTML, not JSON.'
    };
  }

  // Must begin with valid JSON start characters { or [
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return {
      success: false,
      data: null,
      isHtml: false,
      isEmpty: false,
      error: 'Response body does not begin with JSON object or array notation.'
    };
  }

  try {
    const data = JSON.parse(trimmed) as T;
    return {
      success: true,
      data,
      isHtml: false,
      isEmpty: false
    };
  } catch (err: any) {
    logger.warn(`[safeParseJson] Malformed JSON payload: ${err.message}`);
    return {
      success: false,
      data: null,
      isHtml: false,
      isEmpty: false,
      error: `Malformed JSON: ${err.message}`
    };
  }
}
