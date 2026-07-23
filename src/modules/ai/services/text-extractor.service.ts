import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { GeminiService } from './gemini.service';

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

interface PdfParseResult {
  text: string;
}

const parsePdf = async (buffer: Buffer): Promise<PdfParseResult> => {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { text: result.text || '' };
  } finally {
    await parser.destroy();
  }
};

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  constructor(private readonly geminiService: GeminiService) {}

  /**
   * Extract raw text content from PDF, Word (.docx), or plain text files.
   */
  async extractText(
    buffer: Buffer,
    mimeType: string,
    extension: string,
  ): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('File buffer is empty');
    }

    const normalizedExt = extension.toLowerCase().replace('.', '');
    const normalizedMime = mimeType.toLowerCase();

    try {
      // 1. PDF Files
      if (normalizedExt === 'pdf' || normalizedMime.includes('pdf')) {
        this.logger.debug('Extracting text from PDF buffer...');
        const pdfData = await parsePdf(buffer);
        const text = pdfData.text ? pdfData.text.trim() : '';
        if (!text) {
          throw new BadRequestException(
            'PDF file contains no readable text (it may be scanned images)',
          );
        }
        return text;
      }

      // 2. Word Files (.docx)
      if (
        normalizedExt === 'docx' ||
        normalizedExt === 'doc' ||
        normalizedMime.includes('wordprocessingml') ||
        normalizedMime.includes('msword')
      ) {
        this.logger.debug('Extracting text from DOCX buffer via Mammoth...');
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value ? result.value.trim() : '';
        if (!text) {
          throw new BadRequestException(
            'Word document contains no readable text',
          );
        }
        return text;
      }

      // 3. Plain Text, Markdown, JSON, CSV, Code files
      if (
        normalizedMime.startsWith('text/') ||
        normalizedMime.includes('json') ||
        normalizedMime.includes('csv') ||
        ['txt', 'md', 'json', 'csv', 'js', 'ts', 'html', 'css'].includes(
          normalizedExt,
        )
      ) {
        return buffer.toString('utf-8').trim();
      }

      // 4. Image Files (PNG, JPG, JPEG, WEBP, etc.)
      if (
        ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(normalizedExt) ||
        normalizedMime.startsWith('image/')
      ) {
        this.logger.debug(
          'Extracting text/content from image using Gemini Vision...',
        );
        const base64Image = buffer.toString('base64');
        const ocrPrompt = [
          {
            inlineData: {
              mimeType: normalizedMime || 'image/png',
              data: base64Image,
            },
          },
          'Analyze this image. If it is a document or page, perform OCR and transcribe all text. If it is a diagram, chart, or screenshot, describe all visible elements, relationships, labels, and context in detail. Output the text clearly.',
        ];
        return await this.geminiService.generateContentMultimodal(ocrPrompt);
      }

      // 5. Audio Files (MP3, WAV, M4A, WEBM, etc.)
      if (
        ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'mp4a'].includes(normalizedExt) ||
        normalizedMime.startsWith('audio/')
      ) {
        this.logger.debug(
          'Extracting audio transcription using Gemini Audio Transcription...',
        );
        return await this.geminiService.transcribeAudio(buffer, normalizedMime);
      }

      // 6. Video Files (MP4, AVI, MOV, MKV, WEBM, etc.)
      if (
        ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(normalizedExt) ||
        normalizedMime.startsWith('video/')
      ) {
        this.logger.debug(
          'Extracting video description using Gemini Video understanding...',
        );
        const base64Video = buffer.toString('base64');
        const videoPrompt = [
          {
            inlineData: {
              mimeType: normalizedMime || 'video/mp4',
              data: base64Video,
            },
          },
          'Analyze this video. Transcribe any spoken audio, and describe all visual events, text overlays, objects, actions, and settings in detail so that they can be searched semantically. Return the description clearly.',
        ];
        return await this.geminiService.generateContentMultimodal(videoPrompt);
      }

      throw new BadRequestException(
        `Unsupported file type for AI text extraction: ${extension} (${mimeType})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to extract text from document: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        `Failed to process document text: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Split document text into semantic sliding chunks (~500 words per chunk with 50-word overlap).
   */
  chunkText(
    fullText: string,
    maxWordsPerChunk = 400,
    overlapWords = 50,
  ): DocumentChunk[] {
    const cleanText = fullText.replace(/\s+/g, ' ').trim();
    const words = cleanText.split(' ');

    if (words.length === 0 || cleanText.length === 0) {
      return [];
    }

    const chunks: DocumentChunk[] = [];
    let currentIndex = 0;
    let chunkIndex = 0;

    while (currentIndex < words.length) {
      const endWordIndex = Math.min(
        currentIndex + maxWordsPerChunk,
        words.length,
      );
      const chunkWords = words.slice(currentIndex, endWordIndex);
      const content = chunkWords.join(' ');

      chunks.push({
        chunkIndex,
        content,
        tokenCount: chunkWords.length,
      });

      chunkIndex++;
      currentIndex += maxWordsPerChunk - overlapWords;

      // Prevent infinite loop if overlap >= maxWords
      if (maxWordsPerChunk <= overlapWords) {
        break;
      }
    }

    return chunks;
  }
}
