import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { IConnectorJobRaw } from '../jobSources/v1/jobSourceConnector.interface.js';
import { RemoteType, EmploymentType } from '@prisma/client';

export interface NormalizedJobData {
  title: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  preferredQualifications: string[];
  location?: string;
  country?: string;
  city?: string;
  stateProvince?: string;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  experienceMin?: number;
  experienceMax?: number;
  education?: string;
  postedAt?: Date;
  contentHash: string;
  skills: { name: string; type: 'REQUIRED' | 'PREFERRED' }[];
  sourceUrl: string;
  applicationUrl?: string;
  externalJobId?: string;
  sourceType: string;
  sourceName: string;
  companyName: string;
  companyDomain?: string;
}

export class JobNormalizationService {
  /**
   * Safely sanitize HTML text and strip malicious tags (scripts, iframes, inline event handlers).
   * Converts HTML to clean, readable text structure while retaining safe formatting.
   */
  public static sanitizeHtml(rawHtml?: string): string {
    if (!rawHtml) return '';
    try {
      const $ = cheerio.load(rawHtml);
      // Remove dangerous and non-content elements
      $('script, style, iframe, object, embed, applet, noscript, link, form, input, button, svg, meta').remove();
      // Remove malicious attributes like onload, onclick, javascript: urls
      $('*').each((_, el) => {
        const attribs = (el as any).attribs;
        if (attribs) {
          Object.keys(attribs).forEach(attr => {
            if (attr.startsWith('on') || attribs[attr].toLowerCase().includes('javascript:')) {
              $(el).removeAttr(attr);
            }
          });
        }
      });
      return $.text().trim();
    } catch {
      return rawHtml.replace(/<[^>]*>?/gm, '').trim();
    }
  }

  /**
   * Normalize remote type to canonical enum RemoteType
   */
  public static normalizeRemoteType(rawRemote?: string, locationStr?: string, titleStr?: string): RemoteType {
    const combined = `${rawRemote || ''} ${locationStr || ''} ${titleStr || ''}`.toLowerCase();
    if (combined.includes('remote') || combined.includes('anywhere') || combined.includes('work from home')) {
      if (combined.includes('hybrid')) return RemoteType.HYBRID;
      return RemoteType.REMOTE;
    }
    if (combined.includes('hybrid')) {
      return RemoteType.HYBRID;
    }
    if (combined.includes('on-site') || combined.includes('onsite') || combined.includes('in-office') || combined.includes('office')) {
      return RemoteType.ON_SITE;
    }
    if (locationStr && locationStr.trim().length > 0) {
      return RemoteType.ON_SITE;
    }
    return RemoteType.UNKNOWN;
  }

  /**
   * Normalize employment type to canonical enum EmploymentType
   */
  public static normalizeEmploymentType(rawType?: string): EmploymentType {
    if (!rawType) return EmploymentType.FULL_TIME;
    const str = rawType.toLowerCase();
    if (str.includes('part') || str.includes('part-time')) return EmploymentType.PART_TIME;
    if (str.includes('contract') || str.includes('contractor') || str.includes('freelance')) return EmploymentType.CONTRACT;
    if (str.includes('intern') || str.includes('internship')) return EmploymentType.INTERNSHIP;
    if (str.includes('temp') || str.includes('temporary')) return EmploymentType.TEMPORARY;
    return EmploymentType.FULL_TIME;
  }

  /**
   * Parse location details into country, city, state
   */
  public static parseLocation(location?: string): { country?: string; city?: string; stateProvince?: string } {
    if (!location) return {};
    const parts = location.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 1) {
      return { city: parts[0] };
    }
    if (parts.length === 2) {
      return { city: parts[0], country: parts[1] };
    }
    if (parts.length >= 3) {
      return { city: parts[0], stateProvince: parts[1], country: parts[parts.length - 1] };
    }
    return { city: location };
  }

  /**
   * Generate deterministic content hash from stable canonical attributes
   */
  public static computeContentHash(companyName: string, title: string, location: string = '', externalJobId: string = '', descriptionPrefix: string = ''): string {
    const canonicalKey = `${companyName.trim().toLowerCase()}|${title.trim().toLowerCase()}|${location.trim().toLowerCase()}|${externalJobId.trim()}|${descriptionPrefix.trim().slice(0, 300).toLowerCase()}`;
    return crypto.createHash('sha256').update(canonicalKey).digest('hex');
  }

  /**
   * Normalize skills into required and preferred buckets
   */
  public static extractSkills(rawSkills?: string[], requirements?: string[], preferred?: string[]): { name: string; type: 'REQUIRED' | 'PREFERRED' }[] {
    const seen = new Set<string>();
    const result: { name: string; type: 'REQUIRED' | 'PREFERRED' }[] = [];

    // Add explicit required
    const addSkill = (raw: string, type: 'REQUIRED' | 'PREFERRED') => {
      const clean = raw.trim();
      if (!clean || clean.length < 2 || clean.length > 50) return;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ name: clean, type });
      }
    };

    if (rawSkills) {
      for (const s of rawSkills) {
        addSkill(s, 'REQUIRED');
      }
    }

    if (requirements) {
      for (const req of requirements.slice(0, 10)) {
        // If short enough to be a skill name
        if (req.length <= 40 && !req.includes('.')) {
          addSkill(req, 'REQUIRED');
        }
      }
    }

    if (preferred) {
      for (const pref of preferred.slice(0, 10)) {
        if (pref.length <= 40 && !pref.includes('.')) {
          addSkill(pref, 'PREFERRED');
        }
      }
    }

    return result;
  }

  /**
   * Comprehensive normalization pipeline for raw incoming connector job
   */
  public static normalize(raw: IConnectorJobRaw): NormalizedJobData {
    const cleanTitle = raw.title.trim();
    const sanitizedDescription = this.sanitizeHtml(raw.descriptionHtml) || raw.descriptionText.trim();
    const cleanLocation = raw.location?.trim();
    const locParts = this.parseLocation(cleanLocation);

    const remoteType = this.normalizeRemoteType(raw.remoteType, cleanLocation, cleanTitle);
    const employmentType = this.normalizeEmploymentType(raw.employmentType);

    const contentHash = this.computeContentHash(
      raw.companyName,
      cleanTitle,
      cleanLocation || '',
      raw.externalJobId || '',
      sanitizedDescription
    );

    const skills = this.extractSkills(raw.skills, raw.requirements, raw.preferredQualifications);

    let postedAt: Date | undefined;
    if (raw.postedAt) {
      postedAt = typeof raw.postedAt === 'string' ? new Date(raw.postedAt) : raw.postedAt;
      if (isNaN(postedAt.getTime())) postedAt = undefined;
    }

    return {
      title: cleanTitle,
      description: sanitizedDescription,
      responsibilities: raw.responsibilities || [],
      requirements: raw.requirements || [],
      preferredQualifications: raw.preferredQualifications || [],
      location: cleanLocation,
      country: raw.country || locParts.country,
      city: raw.city || locParts.city,
      stateProvince: raw.stateProvince || locParts.stateProvince,
      remoteType,
      employmentType,
      salaryMin: raw.salaryMin,
      salaryMax: raw.salaryMax,
      salaryCurrency: raw.salaryCurrency,
      experienceMin: raw.experienceMin,
      experienceMax: raw.experienceMax,
      education: raw.education,
      postedAt,
      contentHash,
      skills,
      sourceUrl: raw.sourceUrl,
      applicationUrl: raw.applicationUrl || raw.sourceUrl,
      externalJobId: raw.externalJobId,
      sourceType: raw.sourceType.toUpperCase(),
      sourceName: raw.sourceName,
      companyName: raw.companyName.trim(),
      companyDomain: raw.companyDomain?.trim().toLowerCase()
    };
  }
}
