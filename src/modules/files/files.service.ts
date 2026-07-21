import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { File } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  FormattedDateResponse,
  formatDateResponse,
  getUtcDate,
} from '../../common/utils/date.util';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { StorageService } from './storage/storage.service';

export interface FormattedFile {
  id: string;
  uuid: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: string; // Formatted size string e.g. "2.4 MB"
  sizeBytes: string;
  extension: string;
  storageDriver: string;
  storageUrl: string | null;
  userUuid: string;
  folderUuid: string | null;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt: FormattedDateResponse | null;
  createdAt: FormattedDateResponse | null;
  updatedAt: FormattedDateResponse | null;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Helper to format raw bytes into human-readable size string (e.g., 2.4 MB).
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
   * Helper to format raw Prisma File model into clean API response.
   */
  private formatFile(file: File, userTimezone = 'Asia/Kolkata'): FormattedFile {
    return {
      id: file.id.toString(),
      uuid: file.uuid,
      name: file.name,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: this.formatBytes(file.size),
      sizeBytes: file.size.toString(),
      extension: file.extension,
      storageDriver: file.storageDriver,
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
   * Upload a file and save metadata in database.
   */
  async uploadFile(
    userUuid: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    dto: UploadFileDto,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFile> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('File content cannot be empty');
    }

    let targetFolderUuid: string | null = null;

    if (dto.folderUuid) {
      const folder = await this.prisma.folder.findFirst({
        where: {
          uuid: dto.folderUuid,
          userUuid,
          isTrashed: false,
          deletedAt: null,
        },
      });

      if (!folder) {
        throw new NotFoundException('Target folder not found');
      }
      targetFolderUuid = folder.uuid;
    }

    const fileExt =
      extname(originalName).replace('.', '').toLowerCase() || 'file';
    const uuid = randomUUID();

    // Check duplicate file name in same folder
    const duplicate = await this.prisma.file.findFirst({
      where: {
        name: originalName.trim(),
        userUuid,
        folderUuid: targetFolderUuid,
        isTrashed: false,
        deletedAt: null,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'A file with this name already exists in this folder',
      );
    }

    // Save physical file via StorageService
    const uploadResult = await this.storageService.saveFile(
      userUuid,
      fileBuffer,
      originalName,
    );

    const createdFile = await this.prisma.file.create({
      data: {
        uuid,
        name: originalName.trim(),
        originalName: originalName.trim(),
        mimeType,
        size: BigInt(fileBuffer.length),
        extension: fileExt,
        storageDriver: uploadResult.storageDriver,
        storageKey: uploadResult.storageKey,
        storageUrl: uploadResult.storageUrl,
        userUuid,
        folderUuid: targetFolderUuid,
      },
    });

    this.logger.log(
      `Uploaded file: ${createdFile.name} (${createdFile.uuid}) for user ${userUuid}`,
    );
    return this.formatFile(createdFile, userTimezone);
  }

  /**
   * List files in a directory (or root if folderUuid is omitted).
   */
  async getFiles(
    userUuid: string,
    folderUuid?: string,
    isStarred?: boolean,
    isTrashed?: boolean,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFile[]> {
    const files = await this.prisma.file.findMany({
      where: {
        userUuid,
        deletedAt: null,
        ...(isTrashed !== undefined ? { isTrashed } : { isTrashed: false }),
        ...(isStarred !== undefined ? { isStarred } : {}),
        ...(folderUuid
          ? { folderUuid }
          : isStarred || isTrashed
            ? {}
            : { folderUuid: null }),
      },
      orderBy: { name: 'asc' },
    });

    return files.map((f) => this.formatFile(f, userTimezone));
  }

  /**
   * Get single file details by UUID.
   */
  async getFileByUuid(
    userUuid: string,
    uuid: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFile> {
    const file = await this.prisma.file.findFirst({
      where: { uuid, userUuid, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return this.formatFile(file, userTimezone);
  }

  /**
   * Rename, star, or move a file to a new target folder.
   */
  async updateFile(
    userUuid: string,
    uuid: string,
    dto: UpdateFileDto,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFile> {
    const file = await this.prisma.file.findFirst({
      where: { uuid, userUuid, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    let newFolderUuid = file.folderUuid;

    if (dto.folderUuid !== undefined) {
      if (dto.folderUuid === null || dto.folderUuid === '') {
        newFolderUuid = null;
      } else {
        const folder = await this.prisma.folder.findFirst({
          where: {
            uuid: dto.folderUuid,
            userUuid,
            isTrashed: false,
            deletedAt: null,
          },
        });

        if (!folder) {
          throw new NotFoundException('Target folder not found');
        }
        newFolderUuid = folder.uuid;
      }
    }

    const updatedFile = await this.prisma.file.update({
      where: { id: file.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.isStarred !== undefined && { isStarred: dto.isStarred }),
        folderUuid: newFolderUuid,
      },
    });

    return this.formatFile(updatedFile, userTimezone);
  }

  /**
   * Move file to Trash Bin (soft delete).
   */
  async trashFile(
    userUuid: string,
    uuid: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFile> {
    const file = await this.prisma.file.findFirst({
      where: { uuid, userUuid, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const nowUtc = getUtcDate();
    const trashedFile = await this.prisma.file.update({
      where: { id: file.id },
      data: {
        isTrashed: true,
        trashedAt: nowUtc,
      },
    });

    this.logger.log(`File trashed: ${file.name} (${file.uuid})`);
    return this.formatFile(trashedFile, userTimezone);
  }

  /**
   * Restore file from Trash Bin.
   */
  async restoreFile(
    userUuid: string,
    uuid: string,
    userTimezone = 'Asia/Kolkata',
  ): Promise<FormattedFile> {
    const file = await this.prisma.file.findFirst({
      where: { uuid, userUuid, deletedAt: null, isTrashed: true },
    });

    if (!file) {
      throw new NotFoundException('Trashed file not found');
    }

    const restoredFile = await this.prisma.file.update({
      where: { id: file.id },
      data: {
        isTrashed: false,
        trashedAt: null,
      },
    });

    return this.formatFile(restoredFile, userTimezone);
  }

  /**
   * Permanently delete file from disk/S3 and database.
   */
  async deletePermanently(userUuid: string, uuid: string) {
    const file = await this.prisma.file.findFirst({
      where: { uuid, userUuid },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Delete physical file
    await this.storageService.deleteFile(file.storageKey);

    // Delete record from DB
    await this.prisma.file.delete({
      where: { id: file.id },
    });

    this.logger.log(`File permanently deleted: ${file.uuid}`);
    return {
      success: true,
      message: 'File permanently deleted',
    };
  }

  /**
   * Get physical file buffer and metadata for download/streaming.
   */
  async getDownloadPayload(userUuid: string, uuid: string) {
    const file = await this.prisma.file.findFirst({
      where: { uuid, userUuid, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const buffer = await this.storageService.getFileBuffer(file.storageKey);

    return {
      filename: file.name,
      mimeType: file.mimeType,
      size: Number(file.size),
      buffer,
    };
  }
}
