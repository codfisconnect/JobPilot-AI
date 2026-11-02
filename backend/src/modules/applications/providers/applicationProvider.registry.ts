import { IApplicationProvider } from './applicationProvider.interface.js';
import { RippleHireApplicationProvider } from './ripplehire.provider.js';
import { WorkdayApplicationProvider } from './workday.provider.js';
import { GreenhouseApplicationProvider } from './greenhouse.provider.js';
import { LeverApplicationProvider } from './lever.provider.js';
import { SmartRecruitersApplicationProvider } from './smartrecruiters.provider.js';
import { IcimsApplicationProvider } from './icims.provider.js';
import { SuccessFactorsApplicationProvider } from './successfactors.provider.js';
import { GenericBrowserApplicationProvider } from './genericBrowser.provider.js';
import { UnsupportedApplicationProvider } from './unsupported.provider.js';
import { resolveApplicationTarget } from '../../../utils/targetUrlResolver.js';

export class ApplicationProviderRegistry {
  private static providers: IApplicationProvider[] = [
    new RippleHireApplicationProvider(),
    new WorkdayApplicationProvider(),
    new GreenhouseApplicationProvider(),
    new LeverApplicationProvider(),
    new SmartRecruitersApplicationProvider(),
    new IcimsApplicationProvider(),
    new SuccessFactorsApplicationProvider(),
    new GenericBrowserApplicationProvider(),
    new UnsupportedApplicationProvider()
  ];

  /**
   * Resolves the authoritative exact target and selects the specialized provider
   */
  public static resolveProvider(targetUrl: string, job?: any): {
    provider: IApplicationProvider;
    resolvedTargetUrl: string;
    isExact: boolean;
  } {
    // 1. Resolve exact application target using targetUrlResolver
    const targetResolution = resolveApplicationTarget({
      applicationUrl: targetUrl || job?.applicationUrl,
      sourceUrl: job?.sourceUrl
    });

    const finalTargetUrl = targetResolution.url || targetUrl || job?.applicationUrl || job?.sourceUrl || '';

    // 2. Find matching provider in priority order
    for (const provider of this.providers) {
      if (provider.canHandle(finalTargetUrl, job)) {
        return {
          provider,
          resolvedTargetUrl: finalTargetUrl,
          isExact: targetResolution.isExact
        };
      }
    }

    // 3. Fallback to unsupported provider
    return {
      provider: new UnsupportedApplicationProvider(),
      resolvedTargetUrl: finalTargetUrl,
      isExact: targetResolution.isExact
    };
  }

  /**
   * Get all registered providers
   */
  public static getAllProviders(): IApplicationProvider[] {
    return [...this.providers];
  }
}
