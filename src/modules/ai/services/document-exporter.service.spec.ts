import { Test, TestingModule } from '@nestjs/testing';
import { DocumentExporterService } from './document-exporter.service';

describe('DocumentExporterService', () => {
  let service: DocumentExporterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentExporterService],
    }).compile();

    service = module.get<DocumentExporterService>(DocumentExporterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePdfBuffer', () => {
    it('should generate a valid PDF buffer from title and content', async () => {
      const buffer = await service.generatePdfBuffer(
        'Invoice Hindi',
        'यह एक अनुवादित दस्तावेज का नमूना है।',
      );

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('generateDocxBuffer', () => {
    it('should generate a valid DOCX buffer from title and content', async () => {
      const buffer = await service.generateDocxBuffer(
        'Invoice Hindi',
        'यह एक अनुवादित दस्तावेज का नमूना है।',
      );

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
