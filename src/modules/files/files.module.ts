import { Module } from '@nestjs/common';
import { PrismaCentralCoreModule } from '../../prisma-central-core/prisma-central-core.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [PrismaModule, PrismaCentralCoreModule, ProductsModule],
  controllers: [FilesController],
  providers: [FilesService, StorageService],
  exports: [FilesService, StorageService],
})
export class FilesModule {}
