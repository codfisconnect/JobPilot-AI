import * as cheerio from 'cheerio';
import { NormalizedUrlResult } from './urlNormalization.service.js';

export interface SourceFingerprint {
  atsVendor?: string;
  confidence: number;
  signals: string[];
  isSinglePageApp: boolean;
  hasJsonLd: boolean;
  hasEmbeddedState: boolean;
  hasIframe: boolean;
  iframeSources: string[];
}

export class SourceFingerprintService {
  /**
   * Fingerprints the given URL and initial HTML to detect known ATS platforms,
   * SPA architectures, embedded state, and iframes.
   */
  public static fingerprint(normalized: NormalizedUrlResult, html?: string): SourceFingerprint {
    const signals: string[] = [];
    let atsVendor = normalized.detectedVendorHint;
    let confidence = atsVendor ? 70 : 0;

    if (normalized.isAtsSubdomain && atsVendor) {
      signals.push(`Domain matches ATS vendor: ${atsVendor}`);
    }

    let isSinglePageApp = false;
    let hasJsonLd = false;
    let hasEmbeddedState = false;
    let hasIframe = false;
    const iframeSources: string[] = [];

    if (html && typeof html === 'string') {
      const lowerHtml = html.toLowerCase();

      // Check RippleHire patterns
      if (
        lowerHtml.includes('ripplehire') ||
        lowerHtml.includes('candresource') ||
        lowerHtml.includes('candidatejobsearch') ||
        lowerHtml.includes('candidatejobdetail')
      ) {
        atsVendor = 'RIPPLEHIRE';
        confidence = 95;
        signals.push('HTML contains RippleHire assets / scripts');
      }

      // Check Workday patterns
      if (
        normalized.domain.includes('myworkdayjobs.com') ||
        normalized.domain.includes('workday.com') ||
        lowerHtml.includes('wday/cxs') ||
        lowerHtml.includes('workday-recruiting')
      ) {
        atsVendor = 'WORKDAY';
        confidence = 95;
        signals.push('HTML references Workday recruiting client');
      }

      // Check iCIMS patterns
      if (
        lowerHtml.includes('icims.com') ||
        lowerHtml.includes('icims_iframe') ||
        lowerHtml.includes('jobs.icims.com')
      ) {
        atsVendor = 'ICIMS';
        confidence = 90;
        signals.push('HTML references iCIMS portal / iframe');
      }

      // Check Greenhouse patterns
      if (
        lowerHtml.includes('boards.greenhouse.io') ||
        lowerHtml.includes('gh_src') ||
        lowerHtml.includes('grnh.se')
      ) {
        atsVendor = 'GREENHOUSE';
        confidence = 90;
        signals.push('HTML references Greenhouse job board');
      }

      // Check Lever patterns
      if (
        lowerHtml.includes('jobs.lever.co') ||
        lowerHtml.includes('lever-jobs-container')
      ) {
        atsVendor = 'LEVER';
        confidence = 90;
        signals.push('HTML references Lever jobs container');
      }

      // Check Ashby patterns
      if (
        lowerHtml.includes('jobs.ashbyhq.com') ||
        lowerHtml.includes('ashby-job-board')
      ) {
        atsVendor = 'ASHBY';
        confidence = 90;
        signals.push('HTML references Ashby job board');
      }

      // Check SmartRecruiters patterns
      if (
        lowerHtml.includes('smartrecruiters.com') ||
        lowerHtml.includes('jobs.smartrecruiters.com')
      ) {
        atsVendor = 'SMARTRECRUITERS';
        confidence = 90;
        signals.push('HTML references SmartRecruiters');
      }

      // Check Phenom patterns
      if (
        lowerHtml.includes('phenompeople.com') ||
        lowerHtml.includes('phapp') ||
        lowerHtml.includes('eagerloadrefinesearch')
      ) {
        atsVendor = 'PHENOM';
        confidence = 95;
        signals.push('HTML references Phenom careers platform');
      }

      // Check SPA frameworks
      if (
        lowerHtml.includes('__next_data__') ||
        lowerHtml.includes('self.__next_f') ||
        lowerHtml.includes('data-reactroot') ||
        lowerHtml.includes('ng-version') ||
        lowerHtml.includes('v-app') ||
        lowerHtml.includes('requirejs') ||
        lowerHtml.includes('backbone')
      ) {
        isSinglePageApp = true;
        signals.push('SPA framework detected');
      }

      if (lowerHtml.includes('application/ld+json')) {
        hasJsonLd = true;
        signals.push('JSON-LD script tags present');
      }

      if (
        lowerHtml.includes('__next_f') ||
        lowerHtml.includes('__next_data__') ||
        lowerHtml.includes('__initial_state__') ||
        lowerHtml.includes('application/json') ||
        lowerHtml.includes('phapp') ||
        lowerHtml.includes('window.') ||
        lowerHtml.includes('refinesearch')
      ) {
        hasEmbeddedState = true;
        signals.push('Embedded hydration/application state present');
      }

      // Check for iframes
      try {
        const $ = cheerio.load(html);
        $('iframe').each((_, el) => {
          const src = $(el).attr('src');
          if (src) {
            hasIframe = true;
            iframeSources.push(src);
          }
        });
      } catch {}
    }

    return {
      atsVendor,
      confidence,
      signals,
      isSinglePageApp,
      hasJsonLd,
      hasEmbeddedState,
      hasIframe,
      iframeSources
    };
  }
}
