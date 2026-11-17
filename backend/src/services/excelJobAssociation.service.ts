import { prisma } from '../database/prisma.js';
import { DateExtractionResult } from '../universalDiscovery/dateExtraction.service.js';

export interface ExcelJobRecord {
  // Stable source identifiers
  externalJobId?: string;
  sourceType?: string;
  sourceUrl?: string;
  applicationUrl?: string;
  title?: string;
  companyName?: string;
  // Excel payload
  [key: string]: any;
}

export interface AssociatedExcelJob {
  excelRecord: ExcelJobRecord;
  jobId: string | null;
  matchedBy: 'EXTERNAL_JOB_ID' | 'APPLICATION_URL' | 'SOURCE_URL' | 'TITLE_AND_COMPANY' | 'UNMATCHED';
  sourcePublishedAt: Date | null;
  firstDiscoveredAt: Date | null;
  effectiveDate: Date | null;
  hasReliableSourceDate: boolean;
  dateSourceType: string | null;
}

export class ExcelJobAssociationService {
  /**
   * Associating Excel rows/records with database date references without requiring
   * a physical posting date column in the Excel file.
   * Uses stable identity keys:
   * 1. (sourceType + externalJobId)
   * 2. applicationUrl / canonicalUrl
   * 3. sourceUrl
   * 4. title + companyName fallback
   */
  public static async associateAndSort(
    records: ExcelJobRecord[],
    defaultSourceType = 'EXCEL_IMPORT'
  ): Promise<AssociatedExcelJob[]> {
    if (!records || records.length === 0) return [];

    // Preload candidate job records matching provided external IDs and URLs to avoid N+1 queries
    const externalIds = records
      .map(r => r.externalJobId || r.jobSeq || r.jobCode || r.reqId || r.id)
      .filter(Boolean)
      .map(String);

    const urls = records
      .flatMap(r => [r.applicationUrl, r.url, r.sourceUrl, r.link])
      .filter(Boolean)
      .map(String);

    const dbJobs = await prisma.job.findMany({
      where: {
        OR: [
          externalIds.length > 0 ? { externalJobId: { in: externalIds } } : undefined,
          urls.length > 0 ? { applicationUrl: { in: urls } } : undefined,
          urls.length > 0 ? { sourceUrl: { in: urls } } : undefined
        ].filter(Boolean) as any
      },
      select: {
        id: true,
        externalJobId: true,
        sourceType: true,
        applicationUrl: true,
        sourceUrl: true,
        title: true,
        sourcePublishedAt: true,
        firstDiscoveredAt: true,
        postedAt: true,
        dateSourceType: true,
        company: {
          select: { name: true }
        }
      }
    });

    // Build lookup maps
    const byExtId = new Map<string, any>();
    const byAppUrl = new Map<string, any>();
    const bySourceUrl = new Map<string, any>();
    const byTitleCompany = new Map<string, any>();

    for (const job of dbJobs) {
      if (job.externalJobId) {
        byExtId.set(`${(job.sourceType || '').toUpperCase()}_${job.externalJobId.toLowerCase()}`, job);
        byExtId.set(job.externalJobId.toLowerCase(), job);
      }
      if (job.applicationUrl) {
        byAppUrl.set(job.applicationUrl.toLowerCase().trim(), job);
      }
      if (job.sourceUrl) {
        bySourceUrl.set(job.sourceUrl.toLowerCase().trim(), job);
      }
      if (job.title && job.company?.name) {
        const key = `${job.company.name.toLowerCase().trim()}:::${job.title.toLowerCase().trim()}`;
        byTitleCompany.set(key, job);
      }
    }

    const associated: AssociatedExcelJob[] = [];

    for (const record of records) {
      const extId = String(record.externalJobId || record.jobSeq || record.jobCode || record.reqId || record.id || '').trim();
      const st = String(record.sourceType || defaultSourceType).toUpperCase();
      const appUrl = String(record.applicationUrl || record.url || record.link || '').toLowerCase().trim();
      const srcUrl = String(record.sourceUrl || '').toLowerCase().trim();
      const title = String(record.title || record.role || '').toLowerCase().trim();
      const comp = String(record.companyName || record.company || '').toLowerCase().trim();

      let matchedJob: any = null;
      let matchedBy: AssociatedExcelJob['matchedBy'] = 'UNMATCHED';

      if (extId && byExtId.has(`${st}_${extId.toLowerCase()}`)) {
        matchedJob = byExtId.get(`${st}_${extId.toLowerCase()}`);
        matchedBy = 'EXTERNAL_JOB_ID';
      } else if (extId && byExtId.has(extId.toLowerCase())) {
        matchedJob = byExtId.get(extId.toLowerCase());
        matchedBy = 'EXTERNAL_JOB_ID';
      } else if (appUrl && byAppUrl.has(appUrl)) {
        matchedJob = byAppUrl.get(appUrl);
        matchedBy = 'APPLICATION_URL';
      } else if (srcUrl && bySourceUrl.has(srcUrl)) {
        matchedJob = bySourceUrl.get(srcUrl);
        matchedBy = 'SOURCE_URL';
      } else if (title && comp && byTitleCompany.has(`${comp}:::${title}`)) {
        matchedJob = byTitleCompany.get(`${comp}:::${title}`);
        matchedBy = 'TITLE_AND_COMPANY';
      }

      const sourcePublishedAt = matchedJob ? (matchedJob.sourcePublishedAt || matchedJob.postedAt || null) : null;
      const firstDiscoveredAt = matchedJob ? (matchedJob.firstDiscoveredAt || null) : null;
      const effectiveDate = sourcePublishedAt || firstDiscoveredAt || null;

      associated.push({
        excelRecord: record,
        jobId: matchedJob ? matchedJob.id : null,
        matchedBy,
        sourcePublishedAt,
        firstDiscoveredAt,
        effectiveDate,
        hasReliableSourceDate: Boolean(sourcePublishedAt),
        dateSourceType: matchedJob ? (matchedJob.dateSourceType || 'ATS_API') : null
      });
    }

    // Sort Newest First (Descending):
    // 1. Records with verified sourcePublishedAt or effectiveDate first, in descending order
    // 2. Records without date references placed gracefully at the bottom in predictable order
    return associated.sort((a, b) => {
      const timeA = a.effectiveDate ? a.effectiveDate.getTime() : -1;
      const timeB = b.effectiveDate ? b.effectiveDate.getTime() : -1;

      if (timeA !== timeB) {
        return timeB - timeA; // Descending
      }
      // Secondary deterministic sort
      const idA = a.jobId || '';
      const idB = b.jobId || '';
      return idA.localeCompare(idB);
    });
  }
}

