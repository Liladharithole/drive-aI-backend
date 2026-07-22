import { Injectable, Logger } from '@nestjs/common';
import { Folder, File } from '@prisma/client';
import {
  FormattedDateResponse,
  formatDateResponse,
} from '../../common/utils/date.util';
import { PrismaService } from '../../prisma/prisma.service';

export interface UnifiedDriveItem {
  type: 'folder' | 'file';
  id: string;
  uuid: string;
  name: string;
  color?: string | null;
  mimeType?: string;
  size?: string;
  sizeBytes?: string;
  extension?: string;
  storageUrl?: string | null;
  userUuid: string;
  folderUuid?: string | null;
  parentUuid?: string | null;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt: FormattedDateResponse | null;
  createdAt: FormattedDateResponse | null;
  updatedAt: FormattedDateResponse | null;
}

export interface StorageSummary {
  usedBytes: string;
  usedFormatted: string;
  limitBytes: string;
  limitFormatted: string;
  percentUsed: string;
}

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);
  private readonly defaultLimitBytes = 5368709120n; // 5 GB

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to format raw bytes into human-readable size string.
   */
  private formatBytes(bytes: number | bigint): string {
    const numBytes = Number(bytes);
    if (numBytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Maps Folder to UnifiedDriveItem.
   */
  private mapFolder(
    folder: Folder & { parent?: Folder | null },
    userTimezone: string,
  ): UnifiedDriveItem {
    return {
      type: 'folder',
      id: folder.id.toString(),
      uuid: folder.uuid,
      name: folder.name,
      color: folder.color,
      userUuid: folder.userUuid,
      parentUuid: folder.parent ? folder.parent.uuid : null,
      isStarred: folder.isStarred,
      isTrashed: folder.isTrashed,
      trashedAt: formatDateResponse(folder.trashedAt, userTimezone),
      createdAt: formatDateResponse(folder.createdAt, userTimezone),
      updatedAt: formatDateResponse(folder.updatedAt, userTimezone),
    };
  }

  /**
   * Maps File to UnifiedDriveItem.
   */
  private mapFile(file: File, userTimezone: string): UnifiedDriveItem {
    return {
      type: 'file',
      id: file.id.toString(),
      uuid: file.uuid,
      name: file.name,
      mimeType: file.mimeType,
      size: this.formatBytes(file.size),
      sizeBytes: file.size.toString(),
      extension: file.extension,
      storageUrl: file.storageUrl,
      userUuid: file.userUuid,
      folderUuid: file.folderUuid,
      isStarred: file.isStarred,
      isTrashed: file.isTrashed,
      trashedAt: formatDateResponse(file.trashedAt, userTimezone),
      createdAt: formatDateResponse(file.createdAt, userTimezone),
      updatedAt: formatDateResponse(file.updatedAt, userTimezone),
    };
  }

  /**
   * Fetch all starred folders and files unified.
   */
  async getStarredItems(
    userUuid: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<UnifiedDriveItem[]> {
    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: { userUuid, isStarred: true, isTrashed: false, deletedAt: null },
        include: { parent: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.file.findMany({
        where: { userUuid, isStarred: true, isTrashed: false, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    ]);

    const mappedFolders = folders.map((f) => this.mapFolder(f, userTimezone));
    const mappedFiles = files.map((f) => this.mapFile(f, userTimezone));

    return [...mappedFolders, ...mappedFiles].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  /**
   * Fetch all trashed folders and files unified.
   */
  async getTrashedItems(
    userUuid: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<UnifiedDriveItem[]> {
    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: { userUuid, isTrashed: true, deletedAt: null },
        include: { parent: true },
        orderBy: { trashedAt: 'desc' },
      }),
      this.prisma.file.findMany({
        where: { userUuid, isTrashed: true, deletedAt: null },
        orderBy: { trashedAt: 'desc' },
      }),
    ]);

    const mappedFolders = folders.map((f) => this.mapFolder(f, userTimezone));
    const mappedFiles = files.map((f) => this.mapFile(f, userTimezone));

    return [...mappedFolders, ...mappedFiles].sort((a, b) => {
      const aTime = a.trashedAt ? new Date(a.trashedAt.utc).getTime() : 0;
      const bTime = b.trashedAt ? new Date(b.trashedAt.utc).getTime() : 0;
      return bTime - aTime;
    });
  }

  /**
   * Fetch recently updated files (last 30 files, untrashed).
   */
  async getRecentFiles(
    userUuid: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<UnifiedDriveItem[]> {
    const files = await this.prisma.file.findMany({
      where: { userUuid, isTrashed: false, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });

    return files.map((f) => this.mapFile(f, userTimezone));
  }

  /**
   * Fetch storage summary dashboard statistics.
   */
  async getStorageSummary(userUuid: string): Promise<StorageSummary> {
    const result = await this.prisma.file.aggregate({
      where: { userUuid, deletedAt: null },
      _sum: {
        size: true,
      },
    });

    const usedBytes = result._sum.size || 0n;
    const limitBytes = this.defaultLimitBytes;

    const usedNumber = Number(usedBytes);
    const limitNumber = Number(limitBytes);
    const percentUsed = ((usedNumber / limitNumber) * 100).toFixed(4);

    return {
      usedBytes: usedBytes.toString(),
      usedFormatted: this.formatBytes(usedBytes),
      limitBytes: limitBytes.toString(),
      limitFormatted: this.formatBytes(limitBytes),
      percentUsed: `${percentUsed}%`,
    };
  }
}
