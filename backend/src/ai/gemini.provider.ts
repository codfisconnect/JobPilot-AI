import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from './provider.interface.js';

export class GeminiProvider implements AIProvider {
  name = 'Gemini';
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    if (this.apiKey) {
      try {
        this.client = new GoogleGenerativeAI(this.apiKey);
      } catch (err) {
        console.warn('Failed to initialize Gemini Client with provided key:', err);
      }
    }
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.client);
  }

  async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    if (!this.client) {
      throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY in .env');
    }
    const model = this.client.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction || 'You are an expert technical recruitment and career assistant.',
    });

    const response = await model.generateContent(prompt);
    return response.response.text();
  }

  async generateJSON<T>(prompt: string, schemaDescription?: string): Promise<T> {
    const fullPrompt = `${prompt}\n\nIMPORTANT: You must return ONLY raw valid JSON matching this schema/structure:\n${schemaDescription || ''}\nDo not include Markdown backticks (\`\`\`json) or extra conversational commentary.`;
    const text = await this.generateText(fullPrompt);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  }
}
