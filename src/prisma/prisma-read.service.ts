import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createMariaDbAdapter } from './create-mariadb-adapter';

/**
 * Read replica connection. Use for queries only (`findMany`, `findUnique`, raw SELECTs).
 * Set `DATABASE_READ_URL` to your replica; if omitted, falls back to `DATABASE_URL` (single-DB dev).
 */
@Injectable()
export class PrismaReadService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaReadService.name);

  constructor() {
    const readUrl = process.env.DATABASE_READ_URL ?? process.env.DATABASE_URL;
    if (!readUrl) {
      throw new Error(
        'DATABASE_READ_URL or DATABASE_URL must be set for PrismaReadService',
      );
    }

    const adapter = createMariaDbAdapter(readUrl);

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to read database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from read database');
  }
}
