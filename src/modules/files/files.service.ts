import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { File } from '@prisma/client';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  FormattedDateResponse,
  formatDateResponse,
  getUtcDate,
} from '../../common/utils/date.util';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { StorageService } from './storage/storage.service';
import { AuditLogService } from '../audit/audit.service';
import { GeminiService } from '../ai/services/gemini.service';
import { AiService } from '../ai/ai.service';

import { tmpdir } from 'node:os';

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
  private readonly tempUploadDir = join(tmpdir(), 'uploads', 'temp');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    @InjectQueue('file-upload') private readonly fileUploadQueue: Queue,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => GeminiService))
    private readonly geminiService: GeminiService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
  ) {
    try {
      if (!existsSync(this.tempUploadDir)) {
        mkdirSync(this.tempUploadDir, { recursive: true });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to create temp upload directory "${this.tempUploadDir}": ${(err as Error).message}`,
      );
    }
  }

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
   * Write file to temporary folder and queue a background upload job.
   */
  async queueUploadJob(
    userUuid: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    dto: UploadFileDto,
    userTimezone = 'Asia/Kolkata',
  ) {
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

    // Check duplicate file name in same folder early
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

    // Write file to temp folder
    const uuid = randomUUID();
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const tempFileName = `${uuid}_${safeName}`;
    const tempPath = join(this.tempUploadDir, tempFileName);

    await writeFile(tempPath, fileBuffer);

    this.logger.log(`Temporary file buffered at: ${tempPath}`);

    // Add job to BullMQ
    const job = await this.fileUploadQueue.add(
      'process-file',
      {
        tempPath,
        fileBufferBase64: fileBuffer.toString('base64'),
        originalName: originalName.trim(),
        mimeType,
        userUuid,
        folderUuid: targetFolderUuid || undefined,
        userTimezone,
      },
      {
        attempts: 3,
        backoff: 5000, // retry after 5 seconds on fail
      },
    );

    this.logger.log(`Queued file upload job ${job.id} for: ${originalName}`);

    return {
      jobId: job.id,
      status: 'queued',
      name: originalName.trim(),
    };
  }

  /**
   * Fetch status of a background upload job.
   */
  async getJobStatus(jobId: string) {
    const job = await this.fileUploadQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    const state = await job.getState();

    return {
      jobId: job.id,
      status: state,
      progress: job.progress,
      failedReason: job.failedReason || null,
      result: (job.returnvalue as unknown) || null,
    };
  }

  /**
   * Upload a file and save metadata in database (Synchronous).
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

    // Generate filename embedding vector
    let embeddingJson: string | null = null;
    try {
      const vector = await this.geminiService.generateEmbedding(
        originalName.trim(),
      );
      embeddingJson = JSON.stringify(vector);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to generate filename embedding for "${originalName}": ${errMsg}`,
      );
    }

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
        embedding: embeddingJson,
        userUuid,
        folderUuid: targetFolderUuid,
      },
    });

    this.logger.log(
      `Uploaded file: ${createdFile.name} (${createdFile.uuid}) for user ${userUuid}`,
    );

    // Audit Log
    await this.auditLogService.logFileAction(
      userUuid,
      createdFile.uuid,
      'UPLOAD_FILE',
      `Uploaded file "${createdFile.name}"`,
    );

    // Auto-queue document content chunks and text extraction processing for AI RAG Chat
    try {
      await this.aiService.queueDocumentProcessingDirect(
        createdFile.uuid,
        userUuid,
      );
      this.logger.log(
        `Automatically queued AI document processing for: ${createdFile.name}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to automatically queue AI processing for file "${createdFile.name}": ${errMsg}`,
      );
    }

    return this.formatFile(createdFile, userTimezone);
  }

  /**
   * Calculate Cosine Similarity between two numerical vectors.
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
    search?: string,
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

    if (!search || !search.trim()) {
      return files.map((f) => this.formatFile(f, userTimezone));
    }

    const searchQuery = search.trim().toLowerCase();
    let queryVector: number[] = [];

    try {
      queryVector = await this.geminiService.generateEmbedding(searchQuery);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to embed search query "${search}": ${errMsg}`);
    }

    const scoredFiles = files.map((f) => {
      let score = 0;

      // 1. Keyword search (substring match on original name or formatted name)
      if (f.name.toLowerCase().includes(searchQuery)) {
        score += 1.0;
      }

      // 2. Semantic search (vector similarity on filename embedding)
      if (queryVector.length > 0 && f.embedding) {
        try {
          const fileVector = JSON.parse(f.embedding) as number[];
          const similarity = this.cosineSimilarity(queryVector, fileVector);
          if (similarity > 0.3) {
            // similarity threshold
            score += similarity * 0.8;
          }
        } catch {
          // ignore JSON parsing issues
        }
      }

      return { file: f, score };
    });

    const matchedFiles = scoredFiles
      .filter((sf) => sf.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((sf) => this.formatFile(sf.file, userTimezone));

    return matchedFiles;
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
    let isMoved = false;

    if (dto.folderUuid !== undefined) {
      if (dto.folderUuid === null || dto.folderUuid === '') {
        newFolderUuid = null;
        isMoved = file.folderUuid !== null;
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
        isMoved = file.folderUuid !== folder.uuid;
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

    // Audit Log
    let auditAction = 'UPDATE_FILE';
    let auditDetails = `Updated metadata for file "${updatedFile.name}"`;

    if (dto.name !== undefined && dto.name.trim() !== file.name) {
      auditAction = 'RENAME_FILE';
      auditDetails = `Renamed file from "${file.name}" to "${dto.name.trim()}"`;
    } else if (isMoved) {
      auditAction = 'MOVE_FILE';
      auditDetails = `Moved file "${updatedFile.name}" to a new directory`;
    } else if (dto.isStarred !== undefined) {
      auditAction = dto.isStarred ? 'STAR_FILE' : 'UNSTAR_FILE';
      auditDetails = dto.isStarred
        ? `Starred file "${updatedFile.name}"`
        : `Unstarred file "${updatedFile.name}"`;
    }

    await this.auditLogService.logFileAction(
      userUuid,
      updatedFile.uuid,
      auditAction,
      auditDetails,
    );

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

    // Audit Log
    await this.auditLogService.logFileAction(
      userUuid,
      file.uuid,
      'TRASH_FILE',
      `Trashed file "${file.name}"`,
    );

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

    // Audit Log
    await this.auditLogService.logFileAction(
      userUuid,
      file.uuid,
      'RESTORE_FILE',
      `Restored file "${file.name}" from Trash Bin`,
    );

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

    // Audit Log
    await this.auditLogService.logFileAction(
      userUuid,
      file.uuid,
      'DELETE_FILE',
      `Permanently deleted file "${file.name}"`,
    );

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

    // Audit Log
    await this.auditLogService.logFileAction(
      userUuid,
      file.uuid,
      'DOWNLOAD_FILE',
      `Downloaded file "${file.name}"`,
    );

    return {
      filename: file.name,
      mimeType: file.mimeType,
      size: Number(file.size),
      buffer,
    };
  }
}
