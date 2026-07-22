import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { SharesService } from './shares.service';
import { StorageService } from '../files/storage/storage.service';
import { ShareAccessLevel } from './dto/share-item.dto';
import { AuditLogService } from '../audit/audit.service';

describe('SharesService', () => {
  let service: SharesService;

  const mockPrismaService = {
    fileShare: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    publicLink: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    file: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    folder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockStorageService = {
    getFileBuffer: jest.fn(),
  };

  const mockAuditLogService = {
    logShareAction: jest.fn(),
    logFileAction: jest.fn(),
    logFolderAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<SharesService>(SharesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('shareItem', () => {
    it('should throw NotFoundException if file is not found', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      await expect(
        service.shareItem('owner-1', {
          sharedWithEmail: 'john@example.com',
          fileUuid: 'file-uuid-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a new FileShare if file is owned and not already shared', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue({
        uuid: 'file-uuid-1',
        name: 'Report.pdf',
        userUuid: 'owner-1',
      });
      mockPrismaService.fileShare.findFirst.mockResolvedValue(null);
      mockPrismaService.fileShare.create.mockResolvedValue({
        uuid: 'share-uuid-1',
        fileUuid: 'file-uuid-1',
        sharedWithEmail: 'john@example.com',
        accessLevel: ShareAccessLevel.VIEWER,
      });

      const result = await service.shareItem('owner-1', {
        sharedWithEmail: 'john@example.com',
        fileUuid: 'file-uuid-1',
      });

      expect(result.action).toBe('created');
      expect(result.sharedWithEmail).toBe('john@example.com');
      expect(mockAuditLogService.logShareAction).toHaveBeenCalled();
    });
  });

  describe('hasAccess', () => {
    it('should return true if user is owner of the file', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue({
        uuid: 'file-uuid-1',
        userUuid: 'user-1',
      });

      const result = await service.hasAccess(
        'user-1',
        'user1@example.com',
        'file-uuid-1',
      );
      expect(result).toBe(true);
    });

    it('should return true if file has direct viewer share grant', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue({
        uuid: 'file-uuid-1',
        userUuid: 'owner-1',
      });
      mockPrismaService.fileShare.findFirst.mockResolvedValue({
        fileUuid: 'file-uuid-1',
        sharedWithEmail: 'user-2@example.com',
        accessLevel: ShareAccessLevel.VIEWER,
      });

      const result = await service.hasAccess(
        'user-2',
        'user-2@example.com',
        'file-uuid-1',
      );
      expect(result).toBe(true);
    });

    it('should return false if EDITOR level is required but user only has VIEWER access', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue({
        uuid: 'file-uuid-1',
        userUuid: 'owner-1',
      });
      mockPrismaService.fileShare.findFirst.mockResolvedValue({
        fileUuid: 'file-uuid-1',
        sharedWithEmail: 'user-2@example.com',
        accessLevel: ShareAccessLevel.VIEWER,
      });

      const result = await service.hasAccess(
        'user-2',
        'user-2@example.com',
        'file-uuid-1',
        undefined,
        'EDITOR',
      );
      expect(result).toBe(false);
    });

    it('should recursively check parent folders for share permissions (Inheritance)', async () => {
      // Setup file inside folder-2, which is inside folder-1
      mockPrismaService.file.findFirst.mockResolvedValue({
        uuid: 'file-uuid-1',
        userUuid: 'owner-1',
        folderUuid: 'folder-uuid-2',
      });

      mockPrismaService.folder.findFirst.mockImplementation(
        (args: { where: { uuid?: string; id?: bigint } }) => {
          const { where } = args;
          if (where.uuid === 'folder-uuid-2') {
            return Promise.resolve({
              id: BigInt(200),
              uuid: 'folder-uuid-2',
              userUuid: 'owner-1',
              parentId: BigInt(100),
            });
          }
          if (where.id === BigInt(100) || where.uuid === 'folder-uuid-1') {
            return Promise.resolve({
              id: BigInt(100),
              uuid: 'folder-uuid-1',
              userUuid: 'owner-1',
              parentId: null,
            });
          }
          return Promise.resolve(null);
        },
      );

      // Direct file share not found
      mockPrismaService.fileShare.findFirst
        .mockResolvedValueOnce(null) // no share for file
        .mockResolvedValueOnce(null) // no share for folder-2
        .mockResolvedValueOnce({
          folderUuid: 'folder-uuid-1',
          sharedWithEmail: 'user-2@example.com',
          accessLevel: ShareAccessLevel.VIEWER,
        }); // share exists on parent folder-1

      const result = await service.hasAccess(
        'user-2',
        'user-2@example.com',
        'file-uuid-1',
      );
      expect(result).toBe(true);
    });
  });

  describe('getPublicItem', () => {
    it('should throw ForbiddenException if public link is expired', async () => {
      mockPrismaService.publicLink.findUnique.mockResolvedValue({
        accessKey: 'key-1',
        expiresAt: new Date(Date.now() - 1000), // past
      });

      await expect(service.getPublicItem('key-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw UnauthorizedException if password protected and no password provided', async () => {
      mockPrismaService.publicLink.findUnique.mockResolvedValue({
        accessKey: 'key-1',
        passwordHash: 'hashed-pwd',
      });

      await expect(service.getPublicItem('key-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getSharedWithMe', () => {
    it('should return shared folders and files mapped to the unified structure', async () => {
      const mockShares = [
        {
          uuid: 'share-1',
          sharedWithEmail: 'john@example.com',
          accessLevel: ShareAccessLevel.VIEWER,
          sharedByUuid: 'owner-1',
          fileUuid: 'file-1',
          folderUuid: null,
          createdAt: new Date(),
        },
        {
          uuid: 'share-2',
          sharedWithEmail: 'john@example.com',
          accessLevel: ShareAccessLevel.EDITOR,
          sharedByUuid: 'owner-2',
          fileUuid: null,
          folderUuid: 'folder-1',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.fileShare.findMany.mockResolvedValue(mockShares);
      mockPrismaService.file.findFirst.mockResolvedValue({
        uuid: 'file-1',
        name: 'Invoice.pdf',
        mimeType: 'application/pdf',
        size: BigInt(2048),
        extension: 'pdf',
        createdAt: new Date(),
      });
      mockPrismaService.folder.findFirst.mockResolvedValue({
        uuid: 'folder-1',
        name: 'Marketing',
        color: '#ff0000',
        createdAt: new Date(),
      });

      const result = await service.getSharedWithMe('john@example.com');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        shareUuid: 'share-1',
        accessLevel: ShareAccessLevel.VIEWER,
        type: 'FILE',
        item: { name: 'Invoice.pdf' },
      });
      expect(result[1]).toMatchObject({
        shareUuid: 'share-2',
        accessLevel: ShareAccessLevel.EDITOR,
        type: 'FOLDER',
        item: { name: 'Marketing' },
      });
    });
  });
});
