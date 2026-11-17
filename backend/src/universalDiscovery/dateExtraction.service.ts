import { logger } from '../utils/logger.js';

export interface DateExtractionResult {
  sourcePublishedAt: Date | null;
  firstDiscoveredAt: Date;
  sourceDateField: string | null;
  sourceDatePrecision: 'EXACT_TIMESTAMP' | 'DATE_ONLY' | 'CREATION_FALLBACK' | 'UNAVAILABLE';
  sourceTimezone: string | null;
  dateSourceType: 'ATS_API' | 'STRUCTURED_DATA' | 'HTML_PAGE' | 'EXCEL_IMPORT' | 'BACKFILLED_DISCOVERY';
  rawPostingDate: string | null;
}

export class DateExtractionService {
  /**
   * Fields that explicitly represent original publication or public posting.
   * Order reflects preference when multiple fields are present.
   */
  private static readonly PUBLICATION_FIELD_CANDIDATES = [
    'jobPostingDate',
    'postingDate',
    'postedDate',
    'publishedDate',
    'publicationDate',
    'publishedAt',
    'datePosted',
    'releasedDate',
    'postedOn',
    'first_published_at',
    'firstPublishedAt',
    'publishDate',
    'job_posting_date'
  ];

  /**
   * Fields that represent initial entity creation when publication timestamp is absent.
   */
  private static readonly CREATION_FIELD_CANDIDATES = [
    'createDttm',
    'createdDttm',
    'createdAt',
    'created_at',
    'createDate',
    'createdDate',
    'createdOn',
    'creationDate',
    'dateCreated'
  ];

  /**
   * Explicit blacklist: Fields that MUST NEVER be treated as original publication or creation dates.
   */
  private static readonly BLACKLIST_FIELDS = new Set([
    'lastmodified',
    'last_modified',
    'lastmodifieddate',
    'last_modified_date',
    'updatedat',
    'updated_at',
    'updateddate',
    'updated_date',
    'modifieddate',
    'modified_date',
    'modifiedon',
    'lastseenat',
    'last_seen_at',
    'lastcheckedat',
    'last_checked_at',
    'fetchedat',
    'fetched_at',
    'importdate',
    'import_date',
    'sys_updated_on'
  ]);

  /**
   * Checks if a field key is in the blacklist.
   */
  public static isBlacklistedField(fieldName: string): boolean {
    const norm = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return this.BLACKLIST_FIELDS.has(norm);
  }

  /**
   * Extract and normalize publication date from raw payload or candidate fields.
   */
  public static extractPublicationDate(
    rawPayload: any,
    explicitField?: string,
    defaultSourceType: 'ATS_API' | 'STRUCTURED_DATA' | 'HTML_PAGE' | 'EXCEL_IMPORT' | 'BACKFILLED_DISCOVERY' = 'ATS_API',
    knownFirstDiscoveredAt?: Date
  ): DateExtractionResult {
    const now = knownFirstDiscoveredAt || new Date();

    if (!rawPayload || typeof rawPayload !== 'object') {
      return {
        sourcePublishedAt: null,
        firstDiscoveredAt: now,
        sourceDateField: null,
        sourceDatePrecision: 'UNAVAILABLE',
        sourceTimezone: null,
        dateSourceType: defaultSourceType,
        rawPostingDate: null
      };
    }

    // 1. If an explicit candidate field was indicated and valid
    if (explicitField && !this.isBlacklistedField(explicitField)) {
      const val = rawPayload[explicitField];
      if (val !== undefined && val !== null && val !== '') {
        const parsed = this.parseDateValue(val);
        if (parsed) {
          const isCreation = this.CREATION_FIELD_CANDIDATES.includes(explicitField);
          return {
            sourcePublishedAt: parsed.date,
            firstDiscoveredAt: now,
            sourceDateField: explicitField,
            sourceDatePrecision: isCreation ? 'CREATION_FALLBACK' : parsed.precision,
            sourceTimezone: parsed.timezone,
            dateSourceType: defaultSourceType,
            rawPostingDate: String(val)
          };
        }
      }
    }

    // 2. Scan publication candidates in preference order
    for (const field of this.PUBLICATION_FIELD_CANDIDATES) {
      if (this.isBlacklistedField(field)) continue;
      const val = this.getNestedValue(rawPayload, field);
      if (val !== undefined && val !== null && val !== '') {
        const parsed = this.parseDateValue(val);
        if (parsed) {
          return {
            sourcePublishedAt: parsed.date,
            firstDiscoveredAt: now,
            sourceDateField: field,
            sourceDatePrecision: parsed.precision,
            sourceTimezone: parsed.timezone,
            dateSourceType: defaultSourceType,
            rawPostingDate: String(val)
          };
        }
      }
    }

    // 3. Scan creation candidates as verified fallback
    for (const field of this.CREATION_FIELD_CANDIDATES) {
      if (this.isBlacklistedField(field)) continue;
      const val = this.getNestedValue(rawPayload, field);
      if (val !== undefined && val !== null && val !== '') {
        const parsed = this.parseDateValue(val);
        if (parsed) {
          return {
            sourcePublishedAt: parsed.date,
            firstDiscoveredAt: now,
            sourceDateField: field,
            sourceDatePrecision: 'CREATION_FALLBACK',
            sourceTimezone: parsed.timezone,
            dateSourceType: defaultSourceType,
            rawPostingDate: String(val)
          };
        }
      }
    }

    // 4. No valid publication or creation date found
    return {
      sourcePublishedAt: null,
      firstDiscoveredAt: now,
      sourceDateField: null,
      sourceDatePrecision: 'UNAVAILABLE',
      sourceTimezone: null,
      dateSourceType: defaultSourceType,
      rawPostingDate: null
    };
  }

  /**
   * Robust parser for multi-format dates:
   * - Epoch millisecond numbers / numeric strings (e.g. 1700000000000)
   * - Epoch seconds (e.g. 1700000000)
   * - ISO 8601 strings (2026-11-16T10:30:00Z, 2026-11-16T15:00:00+05:30)
   * - Date-only strings (2026-11-16, 16-11-2026, 11/16/2026)
   */
  public static parseDateValue(value: any): { date: Date; precision: 'EXACT_TIMESTAMP' | 'DATE_ONLY'; timezone: string | null } | null {
    if (value === null || value === undefined) return null;

    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return { date: value, precision: 'EXACT_TIMESTAMP', timezone: 'UTC' };
    }

    // Handle epoch timestamp
    if (typeof value === 'number') {
      if (value <= 0 || isNaN(value)) return null;
      // If seconds (e.g. 10 digits), convert to ms
      const ms = value < 1e11 ? value * 1000 : value;
      const d = new Date(ms);
      if (isNaN(d.getTime())) return null;
      return { date: d, precision: 'EXACT_TIMESTAMP', timezone: 'UTC' };
    }

    const str = String(value).trim();
    if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'n/a') {
      return null;
    }

    // Numeric epoch string (e.g. "1710582000000")
    if (/^\d{10,13}$/.test(str)) {
      const num = parseInt(str, 10);
      const ms = str.length === 10 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return { date: d, precision: 'EXACT_TIMESTAMP', timezone: 'UTC' };
      }
    }

    // Check timezone offset if present in ISO string (e.g. +05:30, -04:00, Z)
    let timezone: string | null = null;
    const tzMatch = str.match(/(Z|[+-]\d{2}:?\d{2})$/i);
    if (tzMatch) {
      timezone = tzMatch[1].toUpperCase() === 'Z' ? 'UTC' : tzMatch[1];
    }

    // Date-only detection (YYYY-MM-DD)
    const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str);
    if (isIsoDateOnly) {
      // Parse YYYY-MM-DD explicitly in UTC so date is deterministic without local timezone shifting
      const [year, month, day] = str.split('-').map(Number);
      const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      if (!isNaN(utcDate.getTime())) {
        return { date: utcDate, precision: 'DATE_ONLY', timezone: 'UTC' };
      }
    }

    // General string parse
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      // Sanity check: discard nonsensical years (< 2000 or > 2100)
      const yr = parsed.getUTCFullYear();
      if (yr < 2000 || yr > 2100) return null;

      const hasTime = /[T\s]\d{1,2}:\d{2}/.test(str);
      return {
        date: parsed,
        precision: hasTime ? 'EXACT_TIMESTAMP' : 'DATE_ONLY',
        timezone
      };
    }

    // Formats like DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      const year = parseInt(dmyMatch[3], 10);
      const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

      // Month is 1-indexed in input
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(Date.UTC(year, month - 1, day, hour, min, sec));
        if (!isNaN(d.getTime())) {
          return {
            date: d,
            precision: dmyMatch[4] ? 'EXACT_TIMESTAMP' : 'DATE_ONLY',
            timezone: 'UTC'
          };
        }
      }
    }

    return null;
  }

  /**
   * Safely traverse shallow or nested properties (e.g. "jobVO.jobPostingDate" or "attributes.datePosted")
   */
  private static getNestedValue(obj: any, key: string): any {
    if (!obj || typeof obj !== 'object') return undefined;
    if (obj[key] !== undefined) return obj[key];

    // Case-insensitive lookup on root keys
    const lowerKey = key.toLowerCase();
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === lowerKey) {
        return obj[k];
      }
    }

    // Sub-objects e.g. jobVO, job, data, attributes
    const containers = ['jobVO', 'job', 'data', 'attributes', 'jobDetail', 'jobPosting'];
    for (const c of containers) {
      if (obj[c] && typeof obj[c] === 'object') {
        const val = this.getNestedValue(obj[c], key);
        if (val !== undefined) return val;
      }
    }

    return undefined;
  }
}

