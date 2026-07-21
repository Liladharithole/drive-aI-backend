import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from './files.service';
import { StorageService } from './storage/storage.service';
import { AuditLogService } from '../audit/audit.service';

describe('FilesService', () => {
  let service: FilesService;

  const mockPrismaService = {
    file: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    folder: {
      findFirst: jest.fn(),
    },
  };

  const mockStorageService = {
    saveFile: jest.fn(),
    getFileBuffer: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  const mockAuditLogService = {
    logFileAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: getQueueToken('file-upload'),
          useValue: mockQueue,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should throw ConflictException if file with same name exists in location', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue({
        id: BigInt(1),
        name: 'Report.pdf',
      });

      await expect(
        service.uploadFile(
          'user-uuid-1',
          Buffer.from('test content'),
          'Report.pdf',
          'application/pdf',
          {},
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should upload a file and save metadata in database', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue(null);
      mockStorageService.saveFile.mockResolvedValue({
        storageDriver: 'local',
        storageKey: 'user-uuid-1/123_Report.pdf',
        storageUrl: '/files/stream/user-uuid-1/123_Report.pdf',
      });

      mockPrismaService.file.create.mockResolvedValue({
        id: BigInt(10),
        uuid: 'file-uuid-10',
        name: 'Report.pdf',
        originalName: 'Report.pdf',
        mimeType: 'application/pdf',
        size: BigInt(100),
        extension: 'pdf',
        storageDriver: 'local',
        storageKey: 'user-uuid-1/123_Report.pdf',
        storageUrl: '/files/stream/user-uuid-1/123_Report.pdf',
        userUuid: 'user-uuid-1',
        folderUuid: null,
        isStarred: false,
        isTrashed: false,
        trashedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.uploadFile(
        'user-uuid-1',
        Buffer.from('test content'),
        'Report.pdf',
        'application/pdf',
        {},
      );

      expect(result.uuid).toBe('file-uuid-10');
      expect(result.name).toBe('Report.pdf');
      expect(result.extension).toBe('pdf');
      expect(mockAuditLogService.logFileAction).toHaveBeenCalled();
    });
  });

  describe('trashFile', () => {
    it('should throw NotFoundException if file does not exist', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      await expect(
        service.trashFile('user-uuid-1', 'non-existent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark file as trashed', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue({
        id: BigInt(10),
        uuid: 'file-uuid-10',
        name: 'Report.pdf',
      });

      mockPrismaService.file.update.mockResolvedValue({
        id: BigInt(10),
        uuid: 'file-uuid-10',
        name: 'Report.pdf',
        originalName: 'Report.pdf',
        mimeType: 'application/pdf',
        size: BigInt(100),
        extension: 'pdf',
        storageDriver: 'local',
        storageKey: 'user-uuid-1/123_Report.pdf',
        storageUrl: null,
        userUuid: 'user-uuid-1',
        folderUuid: null,
        isStarred: false,
        isTrashed: true,
        trashedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.trashFile('user-uuid-1', 'file-uuid-10');

      expect(result.isTrashed).toBe(true);
      expect(mockAuditLogService.logFileAction).toHaveBeenCalled();
    });
  });
});
