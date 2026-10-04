import { AIProvider } from './provider.interface.js';
import { GeminiProvider } from './gemini.provider.js';

class AIServiceFactory {
  private static instance: AIProvider | null = null;

  public static getProvider(): AIProvider {
    if (!this.instance) {
      const apiKey = process.env.GEMINI_API_KEY;
      this.instance = new GeminiProvider(apiKey);
    }
    return this.instance;
  }

  public static setProvider(provider: AIProvider): void {
    this.instance = provider;
  }
}

export const aiProvider = AIServiceFactory.getProvider();
export { AIServiceFactory };
