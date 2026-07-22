import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface StorageUploadResult {
  storageDriver: string;
  storageKey: string;
  storageUrl: string | null;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageDriver = process.env.STORAGE_DRIVER || 'local';
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private s3Client: S3Client | null = null;
  private s3Bucket: string | null = null;

  constructor() {
    if (this.storageDriver === 'local') {
      if (!existsSync(this.uploadDir)) {
        mkdirSync(this.uploadDir, { recursive: true });
      }
    } else if (this.storageDriver === 's3') {
      const region = process.env.AWS_REGION || 'auto';
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      const endpoint = process.env.AWS_S3_ENDPOINT || undefined;
      this.s3Bucket = process.env.AWS_S3_BUCKET || null;

      if (accessKeyId && secretAccessKey) {
        this.s3Client = new S3Client({
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
          ...(endpoint ? { endpoint } : {}),
        });
        this.logger.log(
          `Initialized S3-compatible storage driver for bucket: ${this.s3Bucket} (Endpoint: ${endpoint || 'AWS Standard'})`,
        );
      }
    }
  }

  /**
   * Save uploaded file buffer to storage driver (local disk or AWS S3).
   */
  async saveFile(
    userUuid: string,
    fileBuffer: Buffer,
    originalName: string,
  ): Promise<StorageUploadResult> {
    const timestamp = Date.now();
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${userUuid}/${timestamp}_${safeName}`;

    if (this.storageDriver === 'local') {
      const userDir = join(this.uploadDir, userUuid);
      if (!existsSync(userDir)) {
        await mkdir(userDir, { recursive: true });
      }

      const filePath = join(this.uploadDir, storageKey);
      await writeFile(filePath, fileBuffer);

      this.logger.log(`File saved locally at: ${filePath}`);

      return {
        storageDriver: 'local',
        storageKey,
        storageUrl: `/files/stream/${encodeURIComponent(storageKey)}`,
      };
    }

    if (this.storageDriver === 's3') {
      if (!this.s3Client || !this.s3Bucket) {
        throw new Error(
          'S3 client or bucket name is missing in environment variables',
        );
      }

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: storageKey,
          Body: fileBuffer,
        }),
      );

      const s3Region = process.env.AWS_REGION || 'us-east-1';
      const s3Url = `https://${this.s3Bucket}.s3.${s3Region}.amazonaws.com/${storageKey}`;

      this.logger.log(`File uploaded to S3: ${s3Url}`);

      return {
        storageDriver: 's3',
        storageKey,
        storageUrl: s3Url,
      };
    }

    throw new Error(`Unsupported storage driver '${this.storageDriver}'`);
  }

  /**
   * Read physical file buffer for download/streaming.
   */
  async getFileBuffer(storageKey: string): Promise<Buffer> {
    if (this.storageDriver === 'local') {
      const filePath = join(this.uploadDir, storageKey);
      if (!existsSync(filePath)) {
        throw new Error('Physical file not found on disk');
      }
      return await readFile(filePath);
    }

    if (this.storageDriver === 's3') {
      if (!this.s3Client || !this.s3Bucket) {
        throw new Error(
          'S3 client or bucket name is missing in environment variables',
        );
      }

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: storageKey,
        }),
      );

      if (!response.Body) {
        throw new Error('Empty body returned from S3');
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    }

    throw new Error(`Unsupported storage driver '${this.storageDriver}'`);
  }

  /**
   * Delete physical file from storage driver (local disk or AWS S3).
   */
  async deleteFile(storageKey: string): Promise<boolean> {
    if (this.storageDriver === 'local') {
      const filePath = join(this.uploadDir, storageKey);
      if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`Deleted physical file: ${filePath}`);
        return true;
      }
      return false;
    }

    if (this.storageDriver === 's3') {
      if (!this.s3Client || !this.s3Bucket) {
        return false;
      }

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: storageKey,
        }),
      );

      this.logger.log(`Deleted file from S3: ${storageKey}`);
      return true;
    }

    return false;
  }
}
