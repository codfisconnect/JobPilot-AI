import { IJobSourceConnector } from './jobSourceConnector.interface.js';
import { CodewallaConnector } from './codewalla.connector.js';
import { GreenhouseConnector } from './greenhouse.connector.js';
import { LeverConnector } from './lever.connector.js';
import { AshbyConnector } from './ashby.connector.js';

export class ConnectorRegistry {
  private static connectors: Map<string, IJobSourceConnector> = new Map();

  static {
    this.register(new CodewallaConnector());
    this.register(new GreenhouseConnector());
    this.register(new LeverConnector());
    this.register(new AshbyConnector());
  }

  public static register(connector: IJobSourceConnector): void {
    this.connectors.set(connector.sourceType.toUpperCase(), connector);
  }

  public static get(sourceType: string): IJobSourceConnector | undefined {
    return this.connectors.get(sourceType.toUpperCase());
  }

  public static getAll(): IJobSourceConnector[] {
    return Array.from(this.connectors.values());
  }

  public static getSupportedSourceTypes(): string[] {
    return Array.from(this.connectors.keys());
  }
}
