import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export interface DocumentSummaryResult {
  summary: string;
  keyTakeaways: string[];
  documentType: string;
  language: string;
}

interface EmbedResponse {
  embeddings?: { values?: number[] }[];
}

interface GenerateResponse {
  text?: string;
}

interface GeminiAiClient {
  models: {
    embedContent(params: {
      model: string;
      contents: string;
    }): Promise<EmbedResponse>;
    generateContent(params: {
      model: string;
      contents: any;
    }): Promise<GenerateResponse>;
  };
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private ai: GeminiAiClient | null = null;

  /* eslint-disable @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call */
  private async getAiClient(): Promise<GeminiAiClient | null> {
    if (this.ai) {
      return this.ai;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (
      apiKey &&
      apiKey.trim().length > 0 &&
      apiKey !== 'your-gemini-api-key-here'
    ) {
      try {
        const genAiModule = (await Function(
          'return import("@google/genai")',
        )()) as {
          GoogleGenAI: new (opts: { apiKey: string }) => GeminiAiClient;
        };
        const GoogleGenAI = genAiModule.GoogleGenAI;
        this.ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        this.logger.log('Gemini API client initialized successfully');
        return this.ai;
      } catch (error) {
        this.logger.error(
          `Failed to initialize GoogleGenAI module: ${(error as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        `GEMINI_API_KEY is missing or unconfigured (key presence: ${Boolean(apiKey)}). AI capabilities will run in mock mode.`,
      );
    }
    return null;
  }
  /* eslint-enable @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call */

  async onModuleInit() {
    await this.getAiClient();
  }

  /**
   * Check if Gemini API client is active and configured.
   */
  isConfigured(): boolean {
    return this.ai !== null;
  }

  /**
   * Generate 768-dimension vector embedding for a text snippet using gemini-embedding-001.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const ai = await this.getAiClient();
    if (!ai) {
      this.logger.warn(
        'Gemini API key not configured. Generating deterministic fallback mock vector.',
      );
      // Return 768-dimension mock vector for development/offline testing
      return new Array(768).fill(0).map((_, i) => Math.sin(i + text.length));
    }

    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
      });

      if (
        !response.embeddings ||
        !response.embeddings[0] ||
        !response.embeddings[0].values
      ) {
        throw new Error(
          'Failed to retrieve embedding values from Gemini response',
        );
      }

      return response.embeddings[0].values;
    } catch (error) {
      this.logger.error(
        `Error generating embedding via Gemini API: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Generate LLM text completion with model fallbacks to survive API 503/429 spikes.
   */
  async generateContent(
    prompt: string,
    modelName = 'gemini-2.5-flash',
  ): Promise<string> {
    const ai = await this.getAiClient();
    if (!ai) {
      const rawKey = process.env.GEMINI_API_KEY;
      const keyStatus = !rawKey
        ? 'GEMINI_API_KEY is UNDEFINED on Vercel Serverless environment.'
        : `GEMINI_API_KEY present (length: ${rawKey.length}, startsWith: ${rawKey.trim().slice(0, 6)}...).`;
      this.logger.warn(`Gemini API key unconfigured: ${keyStatus}`);
      return `Mock Response: Please add a valid GEMINI_API_KEY to your Vercel Environment Variables. (${keyStatus})`;
    }

    const modelsToTry = [
      modelName,
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];
    const uniqueModels = Array.from(new Set(modelsToTry));
    let lastError: Error | null = null;

    for (const model of uniqueModels) {
      try {
        this.logger.debug(`Attempting text generation with model: ${model}`);
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
        });

        return response.text || '';
      } catch (error) {
        this.logger.warn(
          `Failed generating content with model ${model}: ${(error as Error).message}. Trying fallback...`,
        );
        lastError = error as Error;
      }
    }

    this.logger.error(
      `All Gemini model generation attempts failed. Last error: ${lastError?.message}`,
    );
    throw (
      lastError || new Error('All Gemini models failed to generate content')
    );
  }

  /**
   * Transcribe spoken audio buffer to text with model fallbacks.
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const ai = await this.getAiClient();
    if (!ai) {
      this.logger.warn(
        'Gemini API key not configured. Returning mock speech transcription.',
      );
      return 'What is the total price and payment terms?';
    }

    const base64Audio = audioBuffer.toString('base64');
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        this.logger.debug(
          `Attempting audio transcription with model: ${model}`,
        );
        const response = await ai.models.generateContent({
          model: model,
          contents: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: base64Audio,
              },
            },
            'Transcribe what is spoken in this audio recording accurately into text. Return ONLY the exact transcribed spoken words with no extra conversational commentary or markdown formatting.',
          ],
        });

        return (response.text || '').trim();
      } catch (error) {
        this.logger.warn(
          `Failed audio transcription with model ${model}: ${(error as Error).message}. Trying fallback...`,
        );
        lastError = error as Error;
      }
    }

    this.logger.error(
      `All Gemini model transcription attempts failed. Last error: ${lastError?.message}`,
    );
    throw (
      lastError || new Error('All Gemini models failed to transcribe audio')
    );
  }

  /**
   * Generate content using multimodal parts (images, audio, text) with model fallbacks.
   */
  async generateContentMultimodal(
    contents: any[],
    modelName = 'gemini-2.5-flash',
  ): Promise<string> {
    const ai = await this.getAiClient();
    if (!ai) {
      this.logger.warn(
        'Gemini API key not configured. Returning mock response.',
      );
      return 'Mock Image/Multimodal Response';
    }

    const modelsToTry = [modelName, 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        this.logger.debug(
          `Attempting multimodal generation with model: ${model}`,
        );
        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
        });

        return response.text || '';
      } catch (error) {
        this.logger.warn(
          `Failed multimodal generation with model ${model}: ${(error as Error).message}. Trying fallback...`,
        );
        lastError = error as Error;
      }
    }

    this.logger.error(
      `All Gemini models failed multimodal generation. Last error: ${lastError?.message}`,
    );
    throw (
      lastError ||
      new Error('All Gemini models failed to generate content from parts')
    );
  }

  /**
   * Translate document text into requested target language while strictly preserving formatting and structure.
   */
  async translateText(text: string, targetLanguage: string): Promise<string> {
    if (!this.ai) {
      this.logger.warn(
        'Gemini API key not configured. Returning mock translated text.',
      );
      return `[Mock Translation to ${targetLanguage}]:\n${text}`;
    }

    const prompt = `You are a professional document translator. Translate the following text into ${targetLanguage} (e.g., Hindi, Marathi, Telugu, Tamil, Kannada, English, Spanish, French, German, etc.).

Instructions:
1. Preserve all paragraph breaks, headings, bullet lists, and structural layout.
2. Provide a high-quality, fluent, and contextually accurate translation.
3. Return ONLY the translated text without conversational preamble or markdown code blocks.

Text to translate:
"""
${text}
"""`;

    try {
      const response = await this.generateContent(prompt);
      return response.trim();
    } catch (error) {
      this.logger.error(
        `Error translating text via Gemini API: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Generate 1-page summary, 5 bullet points, auto-classification, and language detection for a document in requested target language.
   */
  async generateSummary(
    fullText: string,
    targetLanguage = 'English',
  ): Promise<DocumentSummaryResult> {
    const prompt = `You are an expert multilingual document analyst. Analyze the following document text and provide a structured JSON response.

Target Language for Response: ${targetLanguage} (e.g. English, Hindi, Marathi, Telugu, Tamil, Kannada, etc.)

Document Content:
"""
${fullText.slice(0, 15000)}
"""

Respond STRICTLY in valid JSON format with NO markdown code block wrap and matching this exact structure:
{
  "summary": "A concise 1-page executive summary (2-3 paragraphs) of the document written in ${targetLanguage}.",
  "keyTakeaways": ["Bullet point 1 in ${targetLanguage}", "Bullet point 2 in ${targetLanguage}", "Bullet point 3 in ${targetLanguage}", "Bullet point 4 in ${targetLanguage}", "Bullet point 5 in ${targetLanguage}"],
  "documentType": "Invoice / Contract / Resume / Report / Technical Spec / Letter / General",
  "language": "Primary language of original document (e.g., English, Hindi, Marathi, Telugu, Tamil, Kannada)"
}`;

    if (!this.ai) {
      return {
        summary: `Executive summary for document (${fullText.length} characters). Mock output in ${targetLanguage}.`,
        keyTakeaways: [
          'Key takeaway 1: Document parsed successfully',
          'Key takeaway 2: Contains structured text content',
          'Key takeaway 3: Ready for RAG search',
        ],
        documentType: 'General',
        language: targetLanguage,
      };
    }

    try {
      const textOutput = await this.generateContent(prompt);
      // Clean JSON string from markdown blocks if returned
      const cleanJson = textOutput
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanJson) as DocumentSummaryResult;

      return {
        summary: parsed.summary || 'Summary unavailable',
        keyTakeaways: Array.isArray(parsed.keyTakeaways)
          ? parsed.keyTakeaways
          : [],
        documentType: parsed.documentType || 'General',
        language: parsed.language || 'English',
      };
    } catch (error) {
      this.logger.error(
        `Failed to parse summary JSON from Gemini response: ${(error as Error).message}`,
      );
      return {
        summary: fullText.slice(0, 300) + '...',
        keyTakeaways: ['Automatic fallback summary'],
        documentType: 'General',
        language: 'English',
      };
    }
  }
}
