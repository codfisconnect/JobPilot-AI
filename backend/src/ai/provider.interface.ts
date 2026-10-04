export interface AIProvider {
  name: string;
  isAvailable(): boolean;
  generateText(prompt: string, systemInstruction?: string): Promise<string>;
  generateJSON<T>(prompt: string, schemaDescription?: string): Promise<T>;
}
