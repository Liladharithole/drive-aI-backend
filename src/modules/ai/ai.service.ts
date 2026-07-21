import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SharesService } from '../shares/shares.service';
import { GeminiService } from './services/gemini.service';
import {
  VectorCandidate,
  VectorSearchService,
} from './services/vector-search.service';
import { formatDateResponse } from '../../common/utils/date.util';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sharesService: SharesService,
    private readonly geminiService: GeminiService,
    private readonly vectorSearchService: VectorSearchService,
    @InjectQueue('ai-document-processing') private readonly aiQueue: Queue,
  ) {}

  /**
   * Queue a document for AI text extraction, chunking, vector embedding, and summary generation.
   */
  async queueDocumentProcessing(
    userUuid: string,
    userEmail: string,
    fileUuid: string,
  ) {
    // 1. Check permission
    const hasAccess = await this.sharesService.hasAccess(
      userUuid,
      userEmail,
      fileUuid,
      undefined,
      'VIEWER',
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to process this file',
      );
    }

    const file = await this.prisma.file.findFirst({
      where: { uuid: fileUuid, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // 2. Queue BullMQ job
    const job = await this.aiQueue.add(
      'process-document',
      { fileUuid, userUuid },
      {
        attempts: 3,
        backoff: 5000,
      },
    );

    this.logger.log(
      `Queued AI processing job ${job.id} for file ${file.name} (${fileUuid})`,
    );

    return {
      jobId: job.id,
      status: 'processing',
      fileUuid,
      message: 'AI document processing queued in background',
    };
  }

  /**
   * Fetch job processing status.
   */
  async getJobStatus(jobId: string) {
    const job = await this.aiQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(
        `AI processing job with ID ${jobId} not found`,
      );
    }

    const state = await job.getState();

    return {
      jobId: job.id,
      status: state,
      progress: job.progress,
      failedReason: job.failedReason || null,
      result: (job.returnvalue as unknown) || null,
    };
  }

  /**
   * Fetch 1-page summary, key takeaways, and document classification.
   */
  async getSummary(
    userUuid: string,
    userEmail: string,
    fileUuid: string,
    userTimezone = 'Asia/Kolkata',
  ) {
    const hasAccess = await this.sharesService.hasAccess(
      userUuid,
      userEmail,
      fileUuid,
      undefined,
      'VIEWER',
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to view AI summaries for this file',
      );
    }

    const summaryRecord = await this.prisma.fileAiSummary.findUnique({
      where: { fileUuid },
    });

    if (!summaryRecord) {
      throw new NotFoundException(
        'AI summary not found for this file. Please process the document with AI first.',
      );
    }

    let keyTakeaways: string[] = [];
    try {
      keyTakeaways = JSON.parse(summaryRecord.keyTakeaways) as string[];
    } catch {
      keyTakeaways = [summaryRecord.keyTakeaways];
    }

    return {
      uuid: summaryRecord.uuid,
      fileUuid: summaryRecord.fileUuid,
      summary: summaryRecord.summary,
      keyTakeaways,
      documentType: summaryRecord.documentType,
      language: summaryRecord.language,
      createdAt: formatDateResponse(summaryRecord.createdAt, userTimezone),
    };
  }

  /**
   * Context-Grounded RAG Question & Answering Engine.
   */
  async askQuestion(
    userUuid: string,
    userEmail: string,
    fileUuid: string,
    question: string,
    targetLanguage = 'English',
  ) {
    if (!question || question.trim().length === 0) {
      throw new BadRequestException('Question cannot be empty');
    }

    // 1. Permission Check
    const hasAccess = await this.sharesService.hasAccess(
      userUuid,
      userEmail,
      fileUuid,
      undefined,
      'VIEWER',
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to query this file',
      );
    }

    // 2. Fetch document chunks & embeddings from DB
    const chunkRecords = await this.prisma.fileDocumentChunk.findMany({
      where: { fileUuid },
      orderBy: { chunkIndex: 'asc' },
    });

    if (chunkRecords.length === 0) {
      throw new BadRequestException(
        'Document has not been processed for AI search yet. Please trigger AI processing first.',
      );
    }

    // 3. Generate embedding for user question
    this.logger.debug(`Generating embedding for user question: "${question}"`);
    const questionEmbedding =
      await this.geminiService.generateEmbedding(question);

    // 4. Parse stored candidate embeddings
    const candidates: VectorCandidate[] = chunkRecords.map((c) => {
      let embedding: number[] = [];
      try {
        embedding = JSON.parse(c.embedding) as number[];
      } catch {
        embedding = [];
      }

      return {
        uuid: c.uuid,
        chunkIndex: c.chunkIndex,
        content: c.content,
        embedding,
      };
    });

    // 5. Rank top 3 relevant passages using Cosine Similarity
    const topMatches = this.vectorSearchService.findTopKMatches(
      questionEmbedding,
      candidates,
      3,
    );

    // 6. Build Multilingual Context-Grounded LLM Prompt
    const contextText = topMatches
      .map(
        (m, i) =>
          `[Source Passage ${i + 1} (Chunk #${m.chunkIndex})]:\n${m.content}`,
      )
      .join('\n\n');

    const prompt = `You are an intelligent multilingual document AI assistant answering questions about an uploaded file.

Context passages extracted from the file:
"""
${contextText}
"""

User Question:
"${question.trim()}"

Target Language for Output Answer: ${targetLanguage} (Supported: English, Hindi, Marathi, Telugu, Tamil, Kannada, etc.)

Instructions:
1. Answer the question accurately using ONLY the information provided in the context passages above.
2. If the context does not contain enough information to answer the question, state in ${targetLanguage}: "I could not find the answer to this question in the document content."
3. Write your answer in ${targetLanguage}.
4. Keep the answer clear, professional, and directly to the point.`;

    // 7. Generate LLM Answer via Gemini 2.5 Flash
    const answer = await this.geminiService.generateContent(prompt);

    // 8. Save Q&A to history
    const sourcesSummary = topMatches.map((m) => ({
      chunkIndex: m.chunkIndex,
      similarityScore: parseFloat(m.similarityScore.toFixed(4)),
      snippet: m.content.slice(0, 150) + '...',
    }));

    await this.prisma.aiChatHistory.create({
      data: {
        uuid: randomUUID(),
        fileUuid,
        userUuid,
        question: question.trim(),
        answer,
        sources: JSON.stringify(sourcesSummary),
      },
    });

    return {
      fileUuid,
      question: question.trim(),
      answer,
      sources: sourcesSummary,
    };
  }

  /**
   * Transcribe user's audio input and run RAG Question & Answering pipeline.
   */
  async askQuestionFromVoice(
    userUuid: string,
    userEmail: string,
    fileUuid: string,
    audioBuffer: Buffer,
    mimeType: string,
    targetLanguage = 'English',
  ) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new BadRequestException('Audio clip cannot be empty');
    }

    // 1. Transcribe audio to text
    const transcribedQuestion = await this.geminiService.transcribeAudio(
      audioBuffer,
      mimeType,
    );

    this.logger.log(`Transcribed voice Q&A question: "${transcribedQuestion}"`);

    // 2. Execute RAG pipeline with transcribed question
    const ragResult = await this.askQuestion(
      userUuid,
      userEmail,
      fileUuid,
      transcribedQuestion,
      targetLanguage,
    );

    return {
      transcribedQuestion,
      ...ragResult,
    };
  }

  /**
   * Fetch Q&A conversation history for a document.
   */
  async getChatHistory(
    userUuid: string,
    userEmail: string,
    fileUuid: string,
    userTimezone = 'Asia/Kolkata',
  ) {
    const hasAccess = await this.sharesService.hasAccess(
      userUuid,
      userEmail,
      fileUuid,
      undefined,
      'VIEWER',
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to view chat history for this file',
      );
    }

    const history = await this.prisma.aiChatHistory.findMany({
      where: { fileUuid, userUuid },
      orderBy: { createdAt: 'asc' },
    });

    return history.map((item) => {
      let sources: unknown[] = [];
      try {
        sources = JSON.parse(item.sources || '[]') as unknown[];
      } catch {
        sources = [];
      }

      return {
        uuid: item.uuid,
        question: item.question,
        answer: item.answer,
        sources,
        createdAt: formatDateResponse(item.createdAt, userTimezone),
      };
    });
  }
}
