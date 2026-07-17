import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client-central-core';
import { createMariaDbAdapter } from '../prisma/create-mariadb-adapter';

/**
 * Central-core read replica. Use for queries only (`findMany`, `findUnique`, raw SELECTs).
 * Set `CENTRAL_CORE_DATABASE_READ_URL`; if omitted, falls back to `CENTRAL_CORE_DATABASE_URL`.
 */
@Injectable()
export class PrismaCentralCoreReadService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaCentralCoreReadService.name);

  constructor() {
    const readUrl =
      process.env.CENTRAL_CORE_DATABASE_READ_URL ??
      process.env.CENTRAL_CORE_DATABASE_URL;
    if (!readUrl) {
      throw new Error(
        'CENTRAL_CORE_DATABASE_READ_URL or CENTRAL_CORE_DATABASE_URL must be set for PrismaCentralCoreReadService',
      );
    }

    const adapter = createMariaDbAdapter(readUrl);

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to central-core read database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from central-core read database');
  }
}
