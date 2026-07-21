import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { SharesService } from '../shares/shares.service';
import { FilesService } from '../files/files.service';
import { AiService } from './ai.service';
import { GeminiService } from './services/gemini.service';
import { TextExtractorService } from './services/text-extractor.service';
import { VectorSearchService } from './services/vector-search.service';
import { DocumentExporterService } from './services/document-exporter.service';

describe('AiService', () => {
  let service: AiService;

  const mockPrismaService = {
    file: {
      findFirst: jest.fn(),
    },
    fileAiSummary: {
      findUnique: jest.fn(),
    },
    fileDocumentChunk: {
      findMany: jest.fn(),
    },
    aiChatHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockSharesService = {
    hasAccess: jest.fn(),
  };

  const mockFilesService = {
    getDownloadPayload: jest.fn(),
    uploadFile: jest.fn(),
  };

  const mockTextExtractorService = {
    extractText: jest.fn(),
  };

  const mockGeminiService = {
    generateEmbedding: jest.fn(),
    generateContent: jest.fn(),
    transcribeAudio: jest.fn(),
    translateText: jest.fn(),
  };

  const mockVectorSearchService = {
    findTopKMatches: jest.fn(),
  };

  const mockDocumentExporterService = {
    generatePdfBuffer: jest.fn(),
    generateDocxBuffer: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SharesService,
          useValue: mockSharesService,
        },
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
        {
          provide: TextExtractorService,
          useValue: mockTextExtractorService,
        },
        {
          provide: GeminiService,
          useValue: mockGeminiService,
        },
        {
          provide: VectorSearchService,
          useValue: mockVectorSearchService,
        },
        {
          provide: DocumentExporterService,
          useValue: mockDocumentExporterService,
        },
        {
          provide: getQueueToken('ai-document-processing'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queueDocumentProcessing', () => {
    it('should queue BullMQ job if user has access to file', async () => {
      mockSharesService.hasAccess.mockResolvedValue(true);
      mockPrismaService.file.findFirst.mockResolvedValue({
        uuid: 'file-1',
        name: 'Invoice.pdf',
      });
      mockQueue.add.mockResolvedValue({ id: 'job-100' });

      const result = await service.queueDocumentProcessing(
        'user-1',
        'user1@example.com',
        'file-1',
      );

      expect(result.jobId).toBe('job-100');
      expect(result.status).toBe('processing');
    });
  });

  describe('askQuestion', () => {
    it('should perform RAG search and return context-grounded answer', async () => {
      mockSharesService.hasAccess.mockResolvedValue(true);
      mockPrismaService.fileDocumentChunk.findMany.mockResolvedValue([
        {
          uuid: 'chunk-1',
          chunkIndex: 0,
          content: 'The total contract price is $50,000 USD.',
          embedding: JSON.stringify(new Array(768).fill(0.1)),
        },
      ]);

      mockGeminiService.generateEmbedding.mockResolvedValue(
        new Array(768).fill(0.1),
      );
      mockVectorSearchService.findTopKMatches.mockReturnValue([
        {
          uuid: 'chunk-1',
          chunkIndex: 0,
          content: 'The total contract price is $50,000 USD.',
          embedding: new Array(768).fill(0.1),
          similarityScore: 0.99,
        },
      ]);
      mockGeminiService.generateContent.mockResolvedValue(
        'The total contract price is $50,000 USD.',
      );

      const result = await service.askQuestion(
        'user-1',
        'user1@example.com',
        'file-1',
        'What is the price?',
      );

      expect(result.answer).toBe('The total contract price is $50,000 USD.');
      expect(result.sources.length).toBe(1);
    });
  });

  describe('askQuestionFromVoice', () => {
    it('should transcribe audio and execute RAG search', async () => {
      mockGeminiService.transcribeAudio.mockResolvedValue(
        'What is the contract price?',
      );
      mockSharesService.hasAccess.mockResolvedValue(true);
      mockPrismaService.fileDocumentChunk.findMany.mockResolvedValue([
        {
          uuid: 'chunk-1',
          chunkIndex: 0,
          content: 'The total contract price is $50,000 USD.',
          embedding: JSON.stringify(new Array(768).fill(0.1)),
        },
      ]);
      mockGeminiService.generateEmbedding.mockResolvedValue(
        new Array(768).fill(0.1),
      );
      mockVectorSearchService.findTopKMatches.mockReturnValue([
        {
          uuid: 'chunk-1',
          chunkIndex: 0,
          content: 'The total contract price is $50,000 USD.',
          embedding: new Array(768).fill(0.1),
          similarityScore: 0.99,
        },
      ]);
      mockGeminiService.generateContent.mockResolvedValue(
        'The price is $50,000 USD.',
      );

      const result = await service.askQuestionFromVoice(
        'user-1',
        'user1@example.com',
        'file-1',
        Buffer.from('fake audio'),
        'audio/webm',
      );

      expect(result.transcribedQuestion).toBe('What is the contract price?');
      expect(result.answer).toBe('The price is $50,000 USD.');
    });
  });

  describe('translateAndExportDocument', () => {
    it('should translate text and export as PDF file to drive', async () => {
      mockSharesService.hasAccess.mockResolvedValue(true);
      mockPrismaService.file.findFirst.mockResolvedValue({
        uuid: 'file-1',
        name: 'Contract.pdf',
        extension: 'pdf',
        folderUuid: null,
      });
      mockFilesService.getDownloadPayload.mockResolvedValue({
        buffer: Buffer.from('Original text'),
        mimeType: 'application/pdf',
      });
      mockTextExtractorService.extractText.mockResolvedValue(
        'Original text content',
      );
      mockGeminiService.translateText.mockResolvedValue('अनुवादित पाठ सामग्री');
      mockDocumentExporterService.generatePdfBuffer.mockResolvedValue(
        Buffer.from('PDF Buffer'),
      );
      mockFilesService.uploadFile.mockResolvedValue({
        uuid: 'translated-file-1',
        name: 'Contract_Hindi.pdf',
      });

      const result = await service.translateAndExportDocument(
        'user-1',
        'user1@example.com',
        'file-1',
        'Hindi',
        'pdf',
        true,
      );

      expect(result.success).toBe(true);
      expect(result.translatedFileName).toBe('Contract_Hindi.pdf');
      expect(result.translatedFile.uuid).toBe('translated-file-1');
    });
  });
});
