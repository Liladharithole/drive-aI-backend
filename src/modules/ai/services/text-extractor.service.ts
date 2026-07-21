import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pdfParse = require('pdf-parse');

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

interface PdfParseResult {
  text: string;
}

const parsePdf = pdfParse as unknown as (
  buffer: Buffer,
) => Promise<PdfParseResult>;

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

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
