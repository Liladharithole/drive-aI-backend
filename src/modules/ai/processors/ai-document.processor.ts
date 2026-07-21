import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../files/storage/storage.service';
import { GeminiService } from '../services/gemini.service';
import { TextExtractorService } from '../services/text-extractor.service';

export interface AiDocumentJobData {
  fileUuid: string;
  userUuid: string;
}

@Processor('ai-document-processing')
export class AiDocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(AiDocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly textExtractorService: TextExtractorService,
    private readonly geminiService: GeminiService,
  ) {
    super();
  }

  async process(job: Job<AiDocumentJobData>): Promise<any> {
    const { fileUuid } = job.data;
    this.logger.log(
      `Starting AI processing job ${job.id} for file: ${fileUuid}`,
    );

    try {
      // 1. Fetch file record
      const file = await this.prisma.file.findFirst({
        where: { uuid: fileUuid, deletedAt: null },
      });

      if (!file) {
        throw new Error(`File with UUID ${fileUuid} not found`);
      }

      await job.updateProgress(10);

      // 2. Fetch file buffer from storage driver
      const fileBuffer = await this.storageService.getFileBuffer(
        file.storageKey,
      );
      await job.updateProgress(25);

      // 3. Extract text content from PDF/DOCX/TXT
      const fullText = await this.textExtractorService.extractText(
        fileBuffer,
        file.mimeType,
        file.extension,
      );
      this.logger.log(
        `Extracted ${fullText.length} characters from file ${file.name}`,
      );
      await job.updateProgress(40);

      // 4. Chunk text into 500-token sliding passages
      const chunks = this.textExtractorService.chunkText(fullText);
      this.logger.log(`Generated ${chunks.length} semantic text chunks`);
      await job.updateProgress(55);

      // 5. Delete existing chunks if re-indexing
      await this.prisma.fileDocumentChunk.deleteMany({
        where: { fileUuid },
      });

      // 6. Generate embeddings and save chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.geminiService.generateEmbedding(
          chunk.content,
        );

        await this.prisma.fileDocumentChunk.create({
          data: {
            uuid: randomUUID(),
            fileUuid,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: JSON.stringify(embedding),
            tokenCount: chunk.tokenCount,
          },
        });

        const progressPercent = 55 + Math.floor(((i + 1) / chunks.length) * 30);
        await job.updateProgress(progressPercent);
      }

      // 7. Generate 1-Page summary & key takeaways
      this.logger.log(`Generating AI Summary for file ${file.name}...`);
      const summaryResult = await this.geminiService.generateSummary(fullText);

      await this.prisma.fileAiSummary.upsert({
        where: { fileUuid },
        create: {
          uuid: randomUUID(),
          fileUuid,
          summary: summaryResult.summary,
          keyTakeaways: JSON.stringify(summaryResult.keyTakeaways),
          documentType: summaryResult.documentType,
          language: summaryResult.language,
        },
        update: {
          summary: summaryResult.summary,
          keyTakeaways: JSON.stringify(summaryResult.keyTakeaways),
          documentType: summaryResult.documentType,
          language: summaryResult.language,
        },
      });

      await job.updateProgress(100);
      this.logger.log(
        `Successfully completed AI processing for file ${fileUuid}`,
      );

      return {
        success: true,
        fileUuid,
        chunksProcessed: chunks.length,
        documentType: summaryResult.documentType,
      };
    } catch (error) {
      this.logger.error(
        `Failed to complete AI processing job ${job.id} for file ${fileUuid}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
