import { IJobSourceStrategy } from './strategy.interface.js';
import { RippleHireAdapter } from './adapters/ripplehire.adapter.js';
import { WorkdayAdapter } from './adapters/workday.adapter.js';
import { IcimsAdapter } from './adapters/icims.adapter.js';
import { GreenhouseAdapter } from './adapters/greenhouse.adapter.js';
import { LeverAdapter } from './adapters/lever.adapter.js';
import { AshbyAdapter } from './adapters/ashby.adapter.js';
import { SmartRecruitersAdapter } from './adapters/smartrecruiters.adapter.js';
import { DirectJsonStrategy } from './strategies/directJson.strategy.js';
import { JsonLdStrategy } from './strategies/jsonLd.strategy.js';
import { EmbeddedStateStrategy } from './strategies/embeddedState.strategy.js';
import { DiscoveredApiStrategy } from './strategies/discoveredApi.strategy.js';
import { CommonRestEndpointsStrategy } from './strategies/commonRestEndpoints.strategy.js';
import { XmlFeedStrategy } from './strategies/xmlFeed.strategy.js';
import { HtmlRepeatedStructureStrategy } from './strategies/htmlRepeatedStructure.strategy.js';

export class AdapterRegistry {
  private static strategies: IJobSourceStrategy[] = [
    // Specialized ATS Accelerators (priorities 10 - 19)
    new RippleHireAdapter(),
    new WorkdayAdapter(),
    new IcimsAdapter(),
    new GreenhouseAdapter(),
    new LeverAdapter(),
    new AshbyAdapter(),
    new SmartRecruitersAdapter(),

    // Generic Structured Data Strategies (priorities 20 - 39)
    new DirectJsonStrategy(),
    new JsonLdStrategy(),
    new EmbeddedStateStrategy(),
    new DiscoveredApiStrategy(),
    new CommonRestEndpointsStrategy(),
    new XmlFeedStrategy(),

    // Generic HTML Strategies (priorities 40+)
    new HtmlRepeatedStructureStrategy()
  ];

  /**
   * Retrieves all registered strategies sorted by priority order.
   */
  public static getAllStrategies(): IJobSourceStrategy[] {
    return [...this.strategies].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Allows registering future custom or vendor adapters dynamically.
   */
  public static registerStrategy(strategy: IJobSourceStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.priority - b.priority);
  }
}
