import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { FoldersService, FormattedFolder } from './folders.service';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoldersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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
        color: '#4285F4',
        userUuid: 'user-uuid-1',
        parentId: null,
        isStarred: false,
        isTrashed: false,
        trashedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        parent: null,
      });

      const result: FormattedFolder = await service.createFolder(
        'user-uuid-1',
        {
          name: 'Projects',
        },
      );

      expect(result.uuid).toBe('folder-uuid-1');
      expect(result.name).toBe('Projects');
      expect(result.parentId).toBeNull();
    });
  });

  describe('getFolders', () => {
    it('should return list of root folders for user', async () => {
      mockPrismaService.folder.findMany.mockResolvedValue([
        {
          id: BigInt(10),
          uuid: 'folder-uuid-1',
          name: 'Projects',
          color: '#4285F4',
          userUuid: 'user-uuid-1',
          parentId: null,
          isStarred: false,
          isTrashed: false,
          trashedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          parent: null,
          _count: { children: 3 },
        },
      ]);

      const result: FormattedFolder[] = await service.getFolders('user-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Projects');
      expect(result[0].subFoldersCount).toBe(3);
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
        color: '#4285F4',
        userUuid: 'user-uuid-1',
        parentId: null,
        isStarred: false,
        isTrashed: true,
        trashedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        parent: null,
      });

      const result: FormattedFolder = await service.trashFolder(
        'user-uuid-1',
        'folder-uuid-1',
      );

      expect(result.isTrashed).toBe(true);
    });
  });
});
