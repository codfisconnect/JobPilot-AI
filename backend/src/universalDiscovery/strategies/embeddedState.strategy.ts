import { IJobSourceStrategy, StrategyContext, StrategyExecutionResult } from '../strategy.interface.js';
import { safeFetchUrl } from '../../utils/safeFetch.js';
import { EmbeddedDataDiscoveryService } from '../../services/embeddedDataDiscovery.service.js';
import { FieldMapperService } from '../../services/fieldMapper.service.js';
import { CompletenessEstimatorService } from '../completenessEstimator.service.js';
import { DiscoveredJobRaw } from '../types.js';
import { JobSourceDiscoveryService } from '../../services/jobSourceDiscovery.service.js';

export class EmbeddedStateStrategy implements IJobSourceStrategy {
  public readonly name = 'EMBEDDED_STATE_STRATEGY';
  public readonly priority = 24;

  public canHandle(context: StrategyContext): boolean {
    return context.fingerprint.hasEmbeddedState;
  }

  public async execute(context: StrategyContext): Promise<StrategyExecutionResult> {
    const { normalizedUrl, initialHtml } = context;
    if (!initialHtml) return { matched: false } as any;

    let embeddedResult = EmbeddedDataDiscoveryService.extractEmbeddedJobsFromHtml(initialHtml);
    let targetUrl = normalizedUrl.normalizedUrl;
    let targetHtml = initialHtml;

    if (!embeddedResult || embeddedResult.jobs.length === 0) {
      // Check for associated career subdomain (e.g. hiring.fynd.com from fynd.com/careers)
      const careerLinkMatches = initialHtml.match(/https?:\/\/[a-zA-Z0-9\.\-_]+(?:\/careers|\/jobs|\/openings|\/positions)[^\s"'<>]*/gi) || [];
      for (const link of careerLinkMatches) {
        try {
          const linkUrl = new URL(link);
          if (linkUrl.hostname !== new URL(normalizedUrl.normalizedUrl).hostname && linkUrl.hostname.includes(normalizedUrl.domain)) {
            const portalRes = await safeFetchUrl(linkUrl.toString(), { timeoutMs: 8000 });
            if (portalRes.status === 200) {
              const subResult = EmbeddedDataDiscoveryService.extractEmbeddedJobsFromHtml(portalRes.text);
              if (subResult && subResult.jobs.length > 0) {
                embeddedResult = subResult;
                targetUrl = linkUrl.toString();
                targetHtml = portalRes.text;
                break;
              }
            }
          }
        } catch {}
      }
    }

    if (!embeddedResult || embeddedResult.jobs.length === 0) {
      return { matched: false } as any;
    }

    const { companyName, domain } = JobSourceDiscoveryService.extractCompanyMetadata(targetUrl, targetHtml);
    const mapping = FieldMapperService.inferDeterministicMapping(embeddedResult.jobs);
    if (embeddedResult.rootPath) {
      mapping.rootJobsPath = embeddedResult.rootPath;
    }

    const jobs: DiscoveredJobRaw[] = [];
    for (const item of embeddedResult.jobs) {
      const mapped = FieldMapperService.mapRecord(item, mapping, {
        companyName,
        companyDomain: domain,
        careersUrl: normalizedUrl.normalizedUrl,
        sourceType: 'EMBEDDED_DATA',
        sourceName: companyName
      });
      if (mapped && mapped.title) {
        jobs.push({
          externalJobId: mapped.externalJobId,
          title: mapped.title,
          department: mapped.department,
          location: mapped.location,
          country: mapped.country,
          city: mapped.city,
          stateProvince: mapped.stateProvince,
          workMode: mapped.remoteType,
          employmentType: mapped.employmentType,
          experience: typeof item.experience === 'string' ? item.experience : (mapped.experienceMin ? `${mapped.experienceMin}${mapped.experienceMax ? `-${mapped.experienceMax}` : '+'} Years` : undefined),
          salary: mapped.salaryMin ? `${mapped.salaryCurrency || ''} ${mapped.salaryMin}${mapped.salaryMax ? ` - ${mapped.salaryMax}` : ''}` : undefined,
          description: mapped.descriptionText || mapped.description || item.descriptionTeaser || mapped.title,
          responsibilities: mapped.responsibilities && mapped.responsibilities.length > 0 ? mapped.responsibilities : undefined,
          requirements: mapped.requirements && mapped.requirements.length > 0 ? mapped.requirements : undefined,
          skills: mapped.skills && mapped.skills.length > 0 ? mapped.skills : (typeof item.skills === 'string' ? item.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined),
          preferredSkills: mapped.preferredQualifications && mapped.preferredQualifications.length > 0 ? mapped.preferredQualifications : undefined,
          openingCount: mapped.openingsCount,
          applicationUrl: mapped.applicationUrl,
          postedAt: mapped.postedAt,
          rawPayload: item
        });
      }
    }

    const completeness = CompletenessEstimatorService.evaluate(jobs.length, jobs.length);

    return {
      matched: jobs.length > 0,
      strategyName: this.name,
      sourceType: 'EMBEDDED_DATA',
      jobsEndpoint: normalizedUrl.normalizedUrl,
      httpMethod: 'GET',
      companyName,
      officialDomain: domain,
      jobs,
      expectedJobCount: jobs.length,
      completeness: completeness.completeness,
      paginationSupported: false,
      mappingConfig: mapping
    };
  }
}
