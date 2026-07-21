import { Module } from '@nestjs/common';
import { PrismaCentralCoreModule } from '../../prisma-central-core/prisma-central-core.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { AuditModule } from '../audit/audit.module';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';

@Module({
  imports: [PrismaModule, PrismaCentralCoreModule, ProductsModule, AuditModule],
  controllers: [FoldersController],
  providers: [FoldersService],
  exports: [FoldersService],
})
export class FoldersModule {}
