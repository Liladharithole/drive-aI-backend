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

  async onModuleInit() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your-gemini-api-key-here') {
      try {
        const { GoogleGenAI } = await (eval(
          'import("@google/genai")',
        ) as Promise<{
          GoogleGenAI: new (opts: { apiKey: string }) => GeminiAiClient;
        }>);
        this.ai = new GoogleGenAI({ apiKey });
        this.logger.log('Gemini API client initialized successfully');
      } catch (error) {
        this.logger.error(
          `Failed to initialize GoogleGenAI module: ${(error as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        'GEMINI_API_KEY is missing or unconfigured in .env. AI capabilities will run in mock mode until configured.',
      );
    }
  }

  /**
   * Check if Gemini API client is active and configured.
   */
  isConfigured(): boolean {
    return this.ai !== null;
  }

  /**
   * Generate 768-dimension vector embedding for a text snippet using text-embedding-004.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.ai) {
      this.logger.warn(
        'Gemini API key not configured. Generating deterministic fallback mock vector.',
      );
      // Return 768-dimension mock vector for development/offline testing
      return new Array(768).fill(0).map((_, i) => Math.sin(i + text.length));
    }

    try {
      const response = await this.ai.models.embedContent({
        model: 'text-embedding-004',
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
   * Generate LLM text completion using gemini-2.5-flash.
   */
  async generateContent(
    prompt: string,
    modelName = 'gemini-2.5-flash',
  ): Promise<string> {
    if (!this.ai) {
      this.logger.warn(
        'Gemini API key not configured. Returning mock response.',
      );
      return 'Mock Response: Please add a valid GEMINI_API_KEY to your .env file to enable live Gemini AI responses.';
    }

    try {
      const response = await this.ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      return response.text || '';
    } catch (error) {
      this.logger.error(
        `Error generating text content via Gemini API: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Transcribe spoken audio buffer (.wav, .mp3, .webm, .m4a) to text using Gemini Multimodal Audio.
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (!this.ai) {
      this.logger.warn(
        'Gemini API key not configured. Returning mock speech transcription.',
      );
      return 'What is the total price and payment terms?';
    }

    try {
      const base64Audio = audioBuffer.toString('base64');
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
      this.logger.error(
        `Error transcribing audio via Gemini API: ${(error as Error).message}`,
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
