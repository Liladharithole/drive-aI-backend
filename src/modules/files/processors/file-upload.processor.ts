import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { FilesService } from '../files.service';

export interface FileUploadJobData {
  tempPath?: string;
  fileBufferBase64?: string;
  originalName: string;
  mimeType: string;
  userUuid: string;
  folderUuid?: string;
  userTimezone?: string;
}

@Processor('file-upload')
export class FileUploadProcessor extends WorkerHost {
  private readonly logger = new Logger(FileUploadProcessor.name);

  constructor(private readonly filesService: FilesService) {
    super();
  }

  async process(job: Job<FileUploadJobData>): Promise<any> {
    const {
      tempPath,
      fileBufferBase64,
      originalName,
      mimeType,
      userUuid,
      folderUuid,
      userTimezone,
    } = job.data;

    this.logger.log(
      `Processing file upload job ${job.id} for: ${originalName}`,
    );

    let buffer: Buffer | null = null;

    if (tempPath && existsSync(tempPath)) {
      buffer = await readFile(tempPath);
    } else if (fileBufferBase64) {
      this.logger.log(
        `Reading file buffer from Redis payload for: ${originalName}`,
      );
      buffer = Buffer.from(fileBufferBase64, 'base64');
    }

    if (!buffer) {
      this.logger.error(`Temporary upload file not found: ${originalName}`);
      throw new Error(`Temporary file not found: ${originalName}`);
    }

    try {
      // 1. Upload file through final database & storage driver pipeline
      const uploadedFile = await this.filesService.uploadFile(
        userUuid,
        buffer,
        originalName,
        mimeType,
        { folderUuid },
        userTimezone,
      );

      this.logger.log(
        `Successfully completed upload job ${job.id} for file: ${uploadedFile.name}`,
      );

      return uploadedFile;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to process upload job ${job.id}: ${errMsg}`);
      throw err;
    } finally {
      // 2. Clean up temporary file from disk if present
      if (tempPath && existsSync(tempPath)) {
        await unlink(tempPath);
        this.logger.log(`Cleaned up temporary file: ${tempPath}`);
      }
    }
  }
}
