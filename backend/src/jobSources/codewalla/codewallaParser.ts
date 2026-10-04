import * as cheerio from 'cheerio';
import { ExternalJobRaw } from '../base/JobSource.js';

export class CodewallaParser {
  /**
   * Parse HTML content from https://www.codewalla.com/jobs
   */
  public static parseJobsHtml(html: string, pageUrl: string = 'https://www.codewalla.com/jobs'): ExternalJobRaw[] {
    const $ = cheerio.load(html);
    const jobs: ExternalJobRaw[] = [];

    // Codewalla layout uses .faq10_accordion containers for each role
    $('.faq10_accordion').each((_, elem) => {
      const accordion = $(elem);

      // Extract job title
      const titleElem = accordion.find('.faq10_question p, .faq10_question').first();
      let title = titleElem.text().trim();
      // Clean up whitespace or line breaks
      title = title.replace(/\s+/g, ' ').trim();
      if (!title) return;

      // Extract answer / details container
      const answer = accordion.find('.faq10_answer, .layout3_content-left').first();
      if (!answer.length) return;

      // Overview text / description
      const summaryElem = answer.find('p.text-size-large.text-color-secondary').first();
      const summaryText = summaryElem.text().replace(/\s+/g, ' ').trim();

      // Experience, Location, Employment Type
      let experience = 'Not specified';
      let location = 'Chennai / Pune';
      let employmentType = 'Full-time';

      answer.find('.job_listing_info-new p, p').each((_, p) => {
        const text = $(p).text();
        if (/Experience:/i.test(text)) {
          experience = text.replace(/.*Experience:\s*/i, '').trim();
        } else if (/Location:/i.test(text)) {
          location = text.replace(/.*Location:\s*/i, '').trim();
        } else if (/Employment Type:/i.test(text)) {
          employmentType = text.replace(/.*Employment Type:\s*/i, '').trim();
        }
      });

      // Extract Responsibilities ("What You'll Do")
      const responsibilities: string[] = [];
      // Extract Qualifications ("What Makes You a Great Fit")
      const qualifications: string[] = [];

      let currentSection: 'resp' | 'qual' | null = null;
      answer.find('ul.list_container-new, .heading-style-h6').each((_, el) => {
        const text = $(el).text().trim();
        if (/What You'?ll Do/i.test(text)) {
          currentSection = 'resp';
        } else if (/What Makes You a Great Fit/i.test(text)) {
          currentSection = 'qual';
        }
      });

      // Bullet items
      answer.find('ul').each((_, ul) => {
        const prevHeading = $(ul).prevAll('.heading-style-h6').first().text();
        const parentSection = $(ul).closest('.list_container-new').find('.heading-style-h6').text();
        const headerText = prevHeading || parentSection;

        const isResp = /What You'?ll Do/i.test(headerText);
        const isQual = /What Makes You a Great Fit/i.test(headerText);

        $(ul).find('li.list-item-bullet-new, li').each((_, li) => {
          const itemText = $(li).text().replace(/\s+/g, ' ').trim();
          if (itemText && itemText.length > 10 && !/What You|What Makes/i.test(itemText)) {
            if (isResp && !responsibilities.includes(itemText)) {
              responsibilities.push(itemText);
            } else if (isQual && !qualifications.includes(itemText)) {
              qualifications.push(itemText);
            }
          }
        });
      });

      // Application link
      const applyLink = answer.find('a[href^="http"], a[href^="mailto"]').first();
      let applicationUrl = pageUrl;
      let applicationMethod: 'External Website' | 'Email' | 'LinkedIn' | 'Other' = 'External Website';

      if (applyLink.length) {
        const href = applyLink.attr('href') || '';
        if (href.startsWith('mailto:')) {
          applicationUrl = href;
          applicationMethod = 'Email';
        } else if (href.includes('linkedin.com')) {
          applicationUrl = href;
          applicationMethod = 'LinkedIn';
        } else if (href.startsWith('http')) {
          applicationUrl = href;
          applicationMethod = 'External Website';
        }
      }

      // Stable external job identifier: source-slug
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const externalId = `codewalla-${slug}`;

      // Build full raw description text
      const rawText = [
        `Company: Codewalla`,
        `Role: ${title}`,
        `Location: ${location}`,
        `Experience: ${experience}`,
        `Employment Type: ${employmentType}`,
        `Source URL: ${pageUrl}`,
        `Application URL: ${applicationUrl}`,
        `\nOverview:\n${summaryText}`,
        responsibilities.length ? `\nWhat You'll Do:\n${responsibilities.map(r => `• ${r}`).join('\n')}` : '',
        qualifications.length ? `\nWhat Makes You a Great Fit:\n${qualifications.map(q => `• ${q}`).join('\n')}` : ''
      ].filter(Boolean).join('\n\n');

      jobs.push({
        externalId,
        source: 'Codewalla',
        sourceUrl: pageUrl,
        applicationUrl,
        applicationMethod,
        title,
        company: 'Codewalla',
        location,
        experience,
        employmentType,
        workMode: location.includes('Chennai') || location.includes('Pune') ? 'Hybrid / Onsite' : 'Onsite',
        publishedDate: 'Recently Posted',
        descriptionText: summaryText || rawText.slice(0, 400),
        responsibilities,
        qualifications,
        rawText
      });
    });

    return jobs;
  }
}
