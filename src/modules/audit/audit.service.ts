import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  FileActivityLog,
  FolderActivityLog,
  ShareActivityLog,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatDateResponse } from '../../common/utils/date.util';

export interface UnifiedActivityLog {
  id: string;
  uuid: string;
  userUuid: string;
  logType: 'FILE' | 'FOLDER' | 'SHARE';
  action: string;
  itemUuid: string;
  details: string | null;
  createdAt: Date;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a file mutation action.
   */
  async logFileAction(
    userUuid: string,
    fileUuid: string,
    action: string,
    details?: string,
  ): Promise<FileActivityLog> {
    const uuid = randomUUID();
    const log = await this.prisma.fileActivityLog.create({
      data: {
        uuid,
        userUuid,
        fileUuid,
        action: action.toUpperCase(),
        details: details || null,
      },
    });

    this.logger.debug(
      `File Logged: [${log.action}] on File ${fileUuid} by ${userUuid}`,
    );
    return log;
  }

  /**
   * Log a folder mutation action.
   */
  async logFolderAction(
    userUuid: string,
    folderUuid: string,
    action: string,
    details?: string,
  ): Promise<FolderActivityLog> {
    const uuid = randomUUID();
    const log = await this.prisma.folderActivityLog.create({
      data: {
        uuid,
        userUuid,
        folderUuid,
        action: action.toUpperCase(),
        details: details || null,
      },
    });

    this.logger.debug(
      `Folder Logged: [${log.action}] on Folder ${folderUuid} by ${userUuid}`,
    );
    return log;
  }

  /**
   * Log a sharing action.
   */
  async logShareAction(
    userUuid: string,
    itemType: 'FILE' | 'FOLDER',
    itemUuid: string,
    sharedWithEmail: string | null,
    action: string,
    details?: string,
  ): Promise<ShareActivityLog> {
    const uuid = randomUUID();
    const log = await this.prisma.shareActivityLog.create({
      data: {
        uuid,
        userUuid,
        itemType,
        itemUuid,
        sharedWithEmail,
        action: action.toUpperCase(),
        details: details || null,
      },
    });

    this.logger.debug(
      `Share Logged: [${log.action}] on ${itemType} ${itemUuid} by ${userUuid}`,
    );
    return log;
  }

  /**
   * Fetch paginated unified audit logs from all three module-wise tables.
   */
  async getActivityLogs(
    userUuid: string,
    limit = 20,
    page = 1,
    userTimezone = 'Asia/Kolkata',
  ) {
    const skip = (page - 1) * limit;

    // Fetch logs from all three tables concurrently
    const [
      fileLogs,
      folderLogs,
      shareLogs,
      fileCount,
      folderCount,
      shareCount,
    ] = await Promise.all([
      this.prisma.fileActivityLog.findMany({
        where: { userUuid },
        orderBy: { createdAt: 'desc' },
        take: skip + limit, // Fetch enough elements to support in-memory merging & sorting
      }),
      this.prisma.folderActivityLog.findMany({
        where: { userUuid },
        orderBy: { createdAt: 'desc' },
        take: skip + limit,
      }),
      this.prisma.shareActivityLog.findMany({
        where: { userUuid },
        orderBy: { createdAt: 'desc' },
        take: skip + limit,
      }),
      this.prisma.fileActivityLog.count({ where: { userUuid } }),
      this.prisma.folderActivityLog.count({ where: { userUuid } }),
      this.prisma.shareActivityLog.count({ where: { userUuid } }),
    ]);

    const total = fileCount + folderCount + shareCount;

    // Map logs to a unified schema
    const unifiedLogs: UnifiedActivityLog[] = [
      ...fileLogs.map((log) => ({
        id: log.id.toString(),
        uuid: log.uuid,
        userUuid: log.userUuid,
        logType: 'FILE' as const,
        action: log.action,
        itemUuid: log.fileUuid,
        details: log.details,
        createdAt: log.createdAt,
      })),
      ...folderLogs.map((log) => ({
        id: log.id.toString(),
        uuid: log.uuid,
        userUuid: log.userUuid,
        logType: 'FOLDER' as const,
        action: log.action,
        itemUuid: log.folderUuid,
        details: log.details,
        createdAt: log.createdAt,
      })),
      ...shareLogs.map((log) => ({
        id: log.id.toString(),
        uuid: log.uuid,
        userUuid: log.userUuid,
        logType: 'SHARE' as const,
        action: log.action,
        itemUuid: log.itemUuid,
        details: log.details,
        createdAt: log.createdAt,
      })),
    ];

    // Sort unified in-memory logs by date descending
    unifiedLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination slice
    const paginatedLogs = unifiedLogs.slice(skip, skip + limit);

    // Format timestamps
    const formattedLogs = paginatedLogs.map((log) => ({
      ...log,
      createdAt: formatDateResponse(log.createdAt, userTimezone),
    }));

    return {
      logs: formattedLogs,
      total,
      limit,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
