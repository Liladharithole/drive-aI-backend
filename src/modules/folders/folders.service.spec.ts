import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { FoldersService } from './folders.service';
import { AuditLogService } from '../audit/audit.service';

describe('FoldersService', () => {
  let service: FoldersService;

  const mockPrismaService = {
    folder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuditLogService = {
    logFolderAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoldersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<FoldersService>(FoldersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFolder', () => {
    it('should throw ConflictException if duplicate folder name exists in same directory', async () => {
      mockPrismaService.folder.findFirst.mockResolvedValue({
        id: BigInt(1),
        name: 'Projects',
      });

      await expect(
        service.createFolder('user-uuid-1', { name: 'Projects' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a new root folder', async () => {
      mockPrismaService.folder.findFirst.mockResolvedValue(null);
      mockPrismaService.folder.create.mockResolvedValue({
        id: BigInt(10),
        uuid: 'folder-uuid-1',
        name: 'Projects',
        userUuid: 'user-uuid-1',
        parentId: null,
        color: '#4285F4',
        isStarred: false,
        isTrashed: false,
        trashedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createFolder('user-uuid-1', {
        name: 'Projects',
      });

      expect(result.uuid).toBe('folder-uuid-1');
      expect(result.name).toBe('Projects');
      expect(mockAuditLogService.logFolderAction).toHaveBeenCalled();
    });
  });

  describe('trashFolder', () => {
    it('should throw NotFoundException if folder does not exist', async () => {
      mockPrismaService.folder.findFirst.mockResolvedValue(null);

      await expect(
        service.trashFolder('user-uuid-1', 'non-existent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark folder as trashed', async () => {
      mockPrismaService.folder.findFirst.mockResolvedValue({
        id: BigInt(10),
        uuid: 'folder-uuid-1',
        name: 'Projects',
      });

      mockPrismaService.folder.update.mockResolvedValue({
        id: BigInt(10),
        uuid: 'folder-uuid-1',
        name: 'Projects',
        userUuid: 'user-uuid-1',
        parentId: null,
        color: '#4285F4',
        isStarred: false,
        isTrashed: true,
        trashedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.trashFolder('user-uuid-1', 'folder-uuid-1');

      expect(result.isTrashed).toBe(true);
      expect(mockAuditLogService.logFolderAction).toHaveBeenCalled();
    });
  });
});
