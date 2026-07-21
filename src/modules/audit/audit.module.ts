import { Module } from '@nestjs/common';
import { PrismaCentralCoreModule } from '../../prisma-central-core/prisma-central-core.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { AuditController } from './audit.controller';
import { AuditLogService } from './audit.service';

@Module({
  imports: [PrismaModule, PrismaCentralCoreModule, ProductsModule],
  controllers: [AuditController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
