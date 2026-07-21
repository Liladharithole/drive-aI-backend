import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SharesModule } from '../shares/shares.module';
import { FilesModule } from '../files/files.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiDocumentProcessor } from './processors/ai-document.processor';
import { GeminiService } from './services/gemini.service';
import { TextExtractorService } from './services/text-extractor.service';
import { VectorSearchService } from './services/vector-search.service';

@Module({
  imports: [
    PrismaModule,
    SharesModule,
    FilesModule,
    BullModule.registerQueue({
      name: 'ai-document-processing',
    }),
  ],
  controllers: [AiController],
  providers: [
    AiService,
    GeminiService,
    TextExtractorService,
    VectorSearchService,
    AiDocumentProcessor,
  ],
  exports: [AiService],
})
export class AiModule {}
