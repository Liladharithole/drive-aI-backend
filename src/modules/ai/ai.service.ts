import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SharesService } from '../shares/shares.service';
import { FilesService } from '../files/files.service';
import { TextExtractorService } from './services/text-extractor.service';
import { GeminiService } from './services/gemini.service';
import { DocumentExporterService } from './services/document-exporter.service';
import {
  VectorCandidate,
  VectorSearchService,
} from './services/vector-search.service';
import { formatDateResponse } from '../../common/utils/date.util';
import { ChatSession } from '@prisma/client';

interface ChatVectorMatch extends VectorCandidate {
  fileUuid: string;
  fileName: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sharesService: SharesService,
    @Inject(forwardRef(() => FilesService))
    private readonly filesService: FilesService,
    private readonly textExtractorService: TextExtractorService,
    private readonly geminiService: GeminiService,
    private readonly vectorSearchService: VectorSearchService,
    private readonly documentExporterService: DocumentExporterService,
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

    // Add job to BullMQ queue
    const job = await this.aiQueue.add('process-document', {
      fileUuid: file.uuid,
      userUuid,
    });

    return {
      message: 'AI document processing job queued successfully',
      jobId: job.id,
      fileUuid: file.uuid,
      status: 'processing',
    };
  }

  /**
   * Queue document processing directly without checking user access permissions.
   */
  async queueDocumentProcessingDirect(fileUuid: string, userUuid: string) {
    const file = await this.prisma.file.findFirst({
      where: { uuid: fileUuid, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const job = await this.aiQueue.add('process-document', {
      fileUuid: file.uuid,
      userUuid,
    });

    return {
      message: 'AI document processing job queued successfully',
      jobId: job.id,
      fileUuid: file.uuid,
      status: 'processing',
    };
  }

  /**
   * Get progress and status of an AI processing job.
   */
  async getJobStatus(jobId: string) {
    const job = await this.aiQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`AI Processing Job #${jobId} not found`);
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      jobId: job.id,
      state,
      progress,
      failedReason: job.failedReason || null,
      returnvalue: (job.returnvalue as unknown) || null,
    };
  }

  /**
   * Fetch generated 1-page summary, key takeaways, and document type.
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
        'You do not have permission to view summary for this file',
      );
    }

    const summaryRecord = await this.prisma.fileAiSummary.findUnique({
      where: { fileUuid },
    });

    if (!summaryRecord) {
      throw new NotFoundException(
        'AI Summary has not been generated for this file yet. Please trigger AI processing first.',
      );
    }

    let keyTakeaways: unknown[] = [];
    try {
      keyTakeaways = JSON.parse(summaryRecord.keyTakeaways) as unknown[];
    } catch {
      keyTakeaways = [];
    }

    return {
      fileUuid: summaryRecord.fileUuid,
      summary: summaryRecord.summary,
      keyTakeaways,
      documentType: summaryRecord.documentType,
      language: summaryRecord.language,
      createdAt: formatDateResponse(summaryRecord.createdAt, userTimezone),
    };
  }

  /**
   * Ask a natural language question about document content (RAG Engine).
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
   * Translate document into target language and export as a new PDF/DOCX file in user's drive.
   */
  async translateAndExportDocument(
    userUuid: string,
    userEmail: string,
    fileUuid: string,
    targetLanguage = 'Hindi',
    exportFormat: 'pdf' | 'docx' | 'txt' = 'pdf',
    saveToDrive = true,
    userTimezone = 'Asia/Kolkata',
  ) {
    // 1. Permission check
    const hasAccess = await this.sharesService.hasAccess(
      userUuid,
      userEmail,
      fileUuid,
      undefined,
      'VIEWER',
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to translate this file',
      );
    }

    const file = await this.prisma.file.findFirst({
      where: { uuid: fileUuid, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // 2. Fetch original file buffer and extract text
    const downloadPayload = await this.filesService.getDownloadPayload(
      userUuid,
      fileUuid,
    );
    const originalText = await this.textExtractorService.extractText(
      downloadPayload.buffer,
      downloadPayload.mimeType,
      file.extension,
    );

    // 3. Translate text via Gemini
    this.logger.log(
      `Translating document ${file.name} to ${targetLanguage}...`,
    );
    const translatedText = await this.geminiService.translateText(
      originalText,
      targetLanguage,
    );

    // 4. Generate exported document buffer
    const nameWithoutExt =
      file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const cleanTargetLang = targetLanguage.replace(/[^a-zA-Z0-9]/g, '');
    const exportExt = exportFormat.toLowerCase();
    const translatedFileName = `${nameWithoutExt}_${cleanTargetLang}.${exportExt}`;

    let exportedBuffer: Buffer;
    let mimeType: string;

    if (exportExt === 'docx') {
      exportedBuffer = await this.documentExporterService.generateDocxBuffer(
        `${nameWithoutExt} (${targetLanguage})`,
        translatedText,
      );
      mimeType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (exportExt === 'txt') {
      exportedBuffer = Buffer.from(translatedText, 'utf-8');
      mimeType = 'text/plain';
    } else {
      exportedBuffer = await this.documentExporterService.generatePdfBuffer(
        `${nameWithoutExt} (${targetLanguage})`,
        translatedText,
      );
      mimeType = 'application/pdf';
    }

    // 5. Save translated file to user's drive
    let savedFile: Record<string, any> | null = null;
    if (saveToDrive) {
      savedFile = await this.filesService.uploadFile(
        userUuid,
        exportedBuffer,
        translatedFileName,
        mimeType,
        { folderUuid: file.folderUuid || undefined },
        userTimezone,
      );

      if (savedFile) {
        this.logger.log(
          `Saved translated file "${translatedFileName}" to user drive (${savedFile.uuid as string})`,
        );
      }
    }

    return {
      success: true,
      originalFileUuid: file.uuid,
      translatedFileName,
      targetLanguage,
      exportFormat: exportExt,
      translatedFile: savedFile,
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

  /**
   * Ask a natural language question across all user files (Global Drive RAG).
   */
  async askGlobalQuestion(
    userUuid: string,
    userEmail: string,
    question: string,
    sessionUuid?: string,
  ) {
    if (!question || question.trim().length === 0) {
      throw new BadRequestException('Question cannot be empty');
    }

    // Find or create Chat Session
    let session: ChatSession | null = null;
    if (sessionUuid) {
      session = await this.prisma.chatSession.findFirst({
        where: { uuid: sessionUuid, userUuid },
      });
    }

    if (!session) {
      session = await this.prisma.chatSession.create({
        data: {
          uuid: sessionUuid || randomUUID(),
          userUuid,
          title: 'New Chat',
        },
      });
    }

    if (!session) {
      throw new BadRequestException('Failed to initialize chat session');
    }

    // 1. Fetch user's non-trashed files
    const userFiles = await this.prisma.file.findMany({
      where: { userUuid, isTrashed: false, deletedAt: null },
    });

    // 2. Fetch shared files matching user's email
    const fileShares = await this.prisma.fileShare.findMany({
      where: { sharedWithEmail: userEmail },
    });
    const sharedFileUuids = fileShares
      .map((s) => s.fileUuid)
      .filter(Boolean) as string[];
    const sharedFiles =
      sharedFileUuids.length > 0
        ? await this.prisma.file.findMany({
            where: {
              uuid: { in: sharedFileUuids },
              isTrashed: false,
              deletedAt: null,
            },
          })
        : [];

    // 3. Combine files
    const allFiles = [...userFiles, ...sharedFiles];
    const fileUuids = allFiles.map((f) => f.uuid);

    let contextText = '(No document context available)';
    let topMatches: ChatVectorMatch[] = [];

    if (fileUuids.length > 0) {
      const chunkRecords = await this.prisma.fileDocumentChunk.findMany({
        where: { fileUuid: { in: fileUuids } },
      });

      if (chunkRecords.length > 0) {
        this.logger.debug(
          `Generating embedding for global question: "${question}"`,
        );
        let questionEmbedding: number[] = [];
        try {
          questionEmbedding =
            await this.geminiService.generateEmbedding(question);
        } catch (err) {
          this.logger.warn(
            `Failed to generate question embedding: ${(err as Error).message}`,
          );
        }

        if (questionEmbedding.length > 0) {
          const fileMap = new Map<string, string>();
          for (const f of allFiles) {
            fileMap.set(f.uuid, f.name);
          }

          const candidates: ChatVectorMatch[] = chunkRecords.map((c) => {
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
              fileUuid: c.fileUuid,
              fileName: fileMap.get(c.fileUuid) || 'Unknown File',
            };
          });

          const searchResults = this.vectorSearchService.findTopKMatches(
            questionEmbedding,
            candidates,
            5,
          );

          topMatches = searchResults.map((res) => {
            const candidate = candidates.find((c) => c.uuid === res.uuid);
            return {
              uuid: res.uuid,
              chunkIndex: res.chunkIndex,
              content: res.content,
              embedding: res.embedding,
              fileUuid: candidate?.fileUuid || '',
              fileName: candidate?.fileName || 'Unknown File',
            };
          });

          contextText = topMatches
            .map((m, i) => {
              return `[Source Document ${i + 1}: ${m.fileName} (Chunk #${m.chunkIndex})]:\n${m.content}`;
            })
            .join('\n\n');
        }
      }
    }

    const prompt = `You are a smart AI Copilot helper inside Drive AI. You answer questions about the user's uploaded files and act as a general conversational assistant.

Context passages extracted from the user's files:
"""
${contextText}
"""

User Question:
"${question.trim()}"

Instructions:
1. If the user's question is about their files or requires searching their documents, answer it using the context passages provided above. Synthesize information across multiple source files if needed, and explicitly cite the source filenames (e.g. "According to resume.pdf...").
2. If the context passages do not contain enough information to answer a document-specific query, state that you could not find the answer in their uploaded files.
3. If the user's question is a general query, greeting, or request (e.g., "Write a python script to reverse a string", "Who won the World Cup in 2022?", "Hello! How are you?"), bypass the context passages and answer the question directly using your general knowledge as a helpful LLM agent.
4. Keep the answer clear, helpful, and directly to the point.
5. Respond in English.`;

    // 8. Generate LLM Answer
    const answer = await this.geminiService.generateContent(prompt);

    const citationsList = topMatches.map((m) => ({
      fileUuid: m.fileUuid,
      fileName: m.fileName,
      chunkIndex: m.chunkIndex,
    }));

    // 9. Save User and AI messages to Database
    await this.prisma.chatMessage.create({
      data: {
        uuid: randomUUID(),
        sessionUuid: session.uuid,
        sender: 'user',
        text: question.trim(),
      },
    });

    await this.prisma.chatMessage.create({
      data: {
        uuid: randomUUID(),
        sessionUuid: session.uuid,
        sender: 'ai',
        text: answer,
        citations: JSON.stringify(citationsList),
      },
    });

    // 10. Update Session Title if it's new
    if (session.title === 'New Chat') {
      const title =
        question.trim().length > 25
          ? question.trim().slice(0, 22) + '...'
          : question.trim();

      await this.prisma.chatSession.update({
        where: { uuid: session.uuid },
        data: { title, updatedAt: new Date() },
      });
    } else {
      await this.prisma.chatSession.update({
        where: { uuid: session.uuid },
        data: { updatedAt: new Date() },
      });
    }

    return {
      question: question.trim(),
      answer,
      citations: citationsList,
      sessionUuid: session.uuid,
    };
  }

  /**
   * List all chat sessions for a user.
   */
  async getSessions(userUuid: string) {
    return this.prisma.chatSession.findMany({
      where: { userUuid },
      orderBy: { updatedAt: 'desc' },
      select: {
        uuid: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get all messages for a specific chat session.
   */
  async getSessionMessages(userUuid: string, sessionUuid: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { uuid: sessionUuid, userUuid },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionUuid },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) => {
      let parsedCitations: unknown[] = [];
      try {
        parsedCitations = m.citations
          ? (JSON.parse(m.citations) as unknown[])
          : [];
      } catch {
        parsedCitations = [];
      }

      return {
        id: m.uuid,
        sender: m.sender,
        text: m.text,
        citations: parsedCitations,
      };
    });
  }

  /**
   * Delete a chat session.
   */
  async deleteSession(userUuid: string, sessionUuid: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { uuid: sessionUuid, userUuid },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    await this.prisma.chatSession.delete({
      where: { uuid: sessionUuid },
    });

    return { success: true };
  }

  /**
   * Directly transcribe audio buffer to text.
   */
  async transcribeAudioDirect(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    return this.geminiService.transcribeAudio(audioBuffer, mimeType);
  }
}
