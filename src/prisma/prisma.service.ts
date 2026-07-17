import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createMariaDbAdapter } from './create-mariadb-adapter';

/**
 * Primary (write) database. Use for mutations and transactions.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    const adapter = createMariaDbAdapter(databaseUrl);

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to primary database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from primary database');
  }
}
