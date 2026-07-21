import { Test, TestingModule } from '@nestjs/testing';
import {
  FileActivityLog,
  FolderActivityLog,
  ShareActivityLog,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, UnifiedActivityLog } from './audit.service';

describe('AuditLogService', () => {
  let service: AuditLogService;

  const mockPrismaService = {
    fileActivityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    folderActivityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    shareActivityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logFileAction', () => {
    it('should log a file action to file_activity_logs', async () => {
      mockPrismaService.fileActivityLog.create.mockResolvedValue({
        id: BigInt(1),
        uuid: 'log-uuid-1',
        userUuid: 'user-uuid-1',
        fileUuid: 'file-uuid-1',
        action: 'UPLOAD_FILE',
        details: 'Uploaded file invoice.pdf',
        createdAt: new Date(),
      });

      const result: FileActivityLog = await service.logFileAction(
        'user-uuid-1',
        'file-uuid-1',
        'UPLOAD_FILE',
        'Uploaded file invoice.pdf',
      );

      expect(result.id.toString()).toBe('1');
      expect(result.uuid).toBe('log-uuid-1');
      expect(result.action).toBe('UPLOAD_FILE');
    });
  });

  describe('logFolderAction', () => {
    it('should log a folder action to folder_activity_logs', async () => {
      mockPrismaService.folderActivityLog.create.mockResolvedValue({
        id: BigInt(2),
        uuid: 'log-uuid-2',
        userUuid: 'user-uuid-1',
        folderUuid: 'folder-uuid-1',
        action: 'CREATE_FOLDER',
        details: 'Created folder Documents',
        createdAt: new Date(),
      });

      const result: FolderActivityLog = await service.logFolderAction(
        'user-uuid-1',
        'folder-uuid-1',
        'CREATE_FOLDER',
        'Created folder Documents',
      );

      expect(result.id.toString()).toBe('2');
      expect(result.action).toBe('CREATE_FOLDER');
    });
  });

  describe('logShareAction', () => {
    it('should log a share action to share_activity_logs', async () => {
      mockPrismaService.shareActivityLog.create.mockResolvedValue({
        id: BigInt(3),
        uuid: 'log-uuid-3',
        userUuid: 'user-uuid-1',
        itemType: 'FILE',
        itemUuid: 'file-uuid-1',
        sharedWithEmail: 'test@example.com',
        action: 'SHARE_FILE',
        details: 'Shared file',
        createdAt: new Date(),
      });

      const result: ShareActivityLog = await service.logShareAction(
        'user-uuid-1',
        'FILE',
        'file-uuid-1',
        'test@example.com',
        'SHARE_FILE',
        'Shared file',
      );

      expect(result.id.toString()).toBe('3');
      expect(result.action).toBe('SHARE_FILE');
    });
  });

  describe('getActivityLogs', () => {
    it('should return combined paginated activity logs', async () => {
      const now = new Date();
      mockPrismaService.fileActivityLog.findMany.mockResolvedValue([
        {
          id: BigInt(10),
          uuid: 'log-uuid-file',
          userUuid: 'user-uuid-1',
          fileUuid: 'file-uuid-1',
          action: 'UPLOAD_FILE',
          details: 'Uploaded file',
          createdAt: new Date(now.getTime() - 1000),
        },
      ]);
      mockPrismaService.folderActivityLog.findMany.mockResolvedValue([
        {
          id: BigInt(20),
          uuid: 'log-uuid-folder',
          userUuid: 'user-uuid-1',
          folderUuid: 'folder-uuid-1',
          action: 'CREATE_FOLDER',
          details: 'Created folder',
          createdAt: now, // newer
        },
      ]);
      mockPrismaService.shareActivityLog.findMany.mockResolvedValue([]);

      mockPrismaService.fileActivityLog.count.mockResolvedValue(1);
      mockPrismaService.folderActivityLog.count.mockResolvedValue(1);
      mockPrismaService.shareActivityLog.count.mockResolvedValue(0);

      const result: { logs: UnifiedActivityLog[]; total: number } =
        await service.getActivityLogs('user-uuid-1', 10, 1);

      expect(result.total).toBe(2);
      expect(result.logs.length).toBe(2);
      // The first log in chronological order should be the folder log because it's newer (createdAt: now)
      expect(result.logs[0].logType).toBe('FOLDER');
      expect(result.logs[1].logType).toBe('FILE');
    });
  });
});
