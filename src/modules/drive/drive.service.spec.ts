import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DriveService } from './drive.service';

describe('DriveService', () => {
  let service: DriveService;

  const mockPrismaService = {
    folder: {
      findMany: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriveService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DriveService>(DriveService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStarredItems', () => {
    it('should return unified list of starred folders and files', async () => {
      mockPrismaService.folder.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          uuid: 'folder-1',
          name: 'Important Folder',
          color: '#4285F4',
          userUuid: 'user-1',
          isStarred: true,
          isTrashed: false,
          trashedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockPrismaService.file.findMany.mockResolvedValue([
        {
          id: BigInt(2),
          uuid: 'file-2',
          name: 'Important Document.pdf',
          mimeType: 'application/pdf',
          size: BigInt(2048),
          extension: 'pdf',
          storageUrl: null,
          userUuid: 'user-1',
          folderUuid: null,
          isStarred: true,
          isTrashed: false,
          trashedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getStarredItems('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Important Document.pdf'); // sorted alphabetically
      expect(result[1].name).toBe('Important Folder');
    });
  });

  describe('getStorageSummary', () => {
    it('should calculate correct storage summary metrics', async () => {
      mockPrismaService.file.aggregate.mockResolvedValue({
        _sum: {
          size: BigInt(104857600), // 100 MB
        },
      });

      const result = await service.getStorageSummary('user-1');

      expect(result.usedBytes).toBe('104857600');
      expect(result.usedFormatted).toBe('100 MB');
      expect(result.limitFormatted).toBe('5 GB');
    });
  });
});
