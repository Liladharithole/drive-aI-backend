import { Test, TestingModule } from '@nestjs/testing';
import { TextExtractorService } from './text-extractor.service';
import { GeminiService } from './gemini.service';

describe('TextExtractorService', () => {
  let service: TextExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextExtractorService,
        {
          provide: GeminiService,
          useValue: {
            generateContentMultimodal: jest
              .fn()
              .mockResolvedValue('Mock Extracted Text from Image or Video'),
            transcribeAudio: jest
              .fn()
              .mockResolvedValue('Mock Transcribed Audio'),
          },
        },
      ],
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

    it('should extract transcription from audio files', async () => {
      const buffer = Buffer.from('mock-audio-data');
      const text = await service.extractText(buffer, 'audio/mp3', 'mp3');

      expect(text).toBe('Mock Transcribed Audio');
    });

    it('should extract details and transcription from video files', async () => {
      const buffer = Buffer.from('mock-video-data');
      const text = await service.extractText(buffer, 'video/mp4', 'mp4');

      expect(text).toBe('Mock Extracted Text from Image or Video');
    });
  });
});
