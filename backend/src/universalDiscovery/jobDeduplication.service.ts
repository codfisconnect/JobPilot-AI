import { DiscoveredJobRaw } from './types.js';
import { JobNormalizationService } from '../services/jobNormalization.service.js';

export class JobDeduplicationService {
  /**
   * Deduplicates discovered job items using layered strategy:
   * 1. External Job ID
   * 2. Canonical Application URL
   * 3. Normalized Title + Location + Content Hash
   */
  public static deduplicate(jobs: DiscoveredJobRaw[], companyName: string): DiscoveredJobRaw[] {
    const seenExternalIds = new Set<string>();
    const seenUrls = new Set<string>();
    const seenContentHashes = new Set<string>();

    const unique: DiscoveredJobRaw[] = [];

    for (const job of jobs) {
      if (!job || !job.title || !job.title.trim()) {
        continue;
      }

      let isDuplicate = false;

      // Layered Deduplication Check:
      // Priority 1: External Job ID (if present, must be unique)
      if (job.externalJobId && job.externalJobId.trim()) {
        const idKey = job.externalJobId.trim().toLowerCase();
        if (seenExternalIds.has(idKey)) {
          isDuplicate = true;
        } else {
          seenExternalIds.add(idKey);
        }
      } else if (job.applicationUrl && job.applicationUrl.trim()) {
        // Priority 2: Distinct Application URL (only when no externalJobId exists)
        const urlKey = job.applicationUrl.trim().toLowerCase();
        if (seenUrls.has(urlKey)) {
          isDuplicate = true;
        } else {
          seenUrls.add(urlKey);
        }
      } else {
        // Priority 3: Content Hash fallback if neither ID nor URL is present
        const contentHash = JobNormalizationService.computeContentHash(
          companyName,
          job.title,
          job.location || '',
          job.externalJobId || '',
          (job.description || '').slice(0, 200)
        );

        if (seenContentHashes.has(contentHash)) {
          isDuplicate = true;
        } else {
          seenContentHashes.add(contentHash);
        }
      }

      if (isDuplicate) {
        continue;
      }

      unique.push(job);
    }

    return unique;
  }
}
