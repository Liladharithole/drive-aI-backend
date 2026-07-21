import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { SharesService } from '../shares/shares.service';
import { AiService } from './ai.service';
import { GeminiService } from './services/gemini.service';
import { VectorSearchService } from './services/vector-search.service';

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

  const mockGeminiService = {
    generateEmbedding: jest.fn(),
    generateContent: jest.fn(),
    transcribeAudio: jest.fn(),
  };

  const mockVectorSearchService = {
    findTopKMatches: jest.fn(),
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
          provide: GeminiService,
          useValue: mockGeminiService,
        },
        {
          provide: VectorSearchService,
          useValue: mockVectorSearchService,
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
});
