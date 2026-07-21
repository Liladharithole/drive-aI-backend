import { Test, TestingModule } from '@nestjs/testing';
import { TextExtractorService } from './text-extractor.service';

describe('TextExtractorService', () => {
  let service: TextExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextExtractorService],
    }).compile();

    service = module.get<TextExtractorService>(TextExtractorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chunkText', () => {
    it('should split text into semantic sliding chunks', () => {
      const words = Array.from({ length: 100 }, (_, i) => `word${i + 1}`).join(
        ' ',
      );
      const chunks = service.chunkText(words, 40, 10);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].tokenCount).toBe(40);
    });
  });

  describe('extractText', () => {
    it('should extract text from plain text buffer', async () => {
      const buffer = Buffer.from('Hello world plain text');
      const text = await service.extractText(buffer, 'text/plain', 'txt');

      expect(text).toBe('Hello world plain text');
    });
  });
});
