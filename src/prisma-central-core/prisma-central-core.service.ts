import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client-central-core';
import { createMariaDbAdapter } from '../prisma/create-mariadb-adapter';

/**
 * Central-core database (separate MySQL instance). Add models in prisma/schema.core-central.prisma.
 */
@Injectable()
export class PrismaCentralCoreService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaCentralCoreService.name);

  constructor() {
    const databaseUrl = process.env.CENTRAL_CORE_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('CENTRAL_CORE_DATABASE_URL is not set');
    }

    const adapter = createMariaDbAdapter(databaseUrl);

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to central-core database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from central-core database');
  }
}
