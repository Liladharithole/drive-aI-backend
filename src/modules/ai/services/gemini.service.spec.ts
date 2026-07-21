import { Test, TestingModule } from '@nestjs/testing';
import { GeminiService } from './gemini.service';

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeminiService],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateEmbedding', () => {
    it('should return a 768-dimension vector embedding', async () => {
      const embedding = await service.generateEmbedding('Sample document text');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
    });
  });

  describe('generateSummary', () => {
    it('should return a structured summary result', async () => {
      const summary = await service.generateSummary(
        'Sample invoice document content',
      );

      expect(summary).toBeDefined();
      expect(summary.summary).toBeDefined();
      expect(Array.isArray(summary.keyTakeaways)).toBe(true);
    });
  });

  describe('transcribeAudio', () => {
    it('should return transcribed text from audio buffer', async () => {
      const text = await service.transcribeAudio(
        Buffer.from('fake audio content'),
        'audio/webm',
      );

      expect(text).toBeDefined();
      expect(typeof text).toBe('string');
    });
  });
});
