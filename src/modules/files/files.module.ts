import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaCentralCoreModule } from '../../prisma-central-core/prisma-central-core.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileUploadProcessor } from './processors/file-upload.processor';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [
    PrismaModule,
    PrismaCentralCoreModule,
    ProductsModule,
    BullModule.registerQueue({
      name: 'file-upload',
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, StorageService, FileUploadProcessor],
  exports: [FilesService, StorageService, BullModule],
})
export class FilesModule {}
