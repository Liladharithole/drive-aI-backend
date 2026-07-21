import { Module } from '@nestjs/common';
import { PrismaCentralCoreModule } from '../../prisma-central-core/prisma-central-core.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';

@Module({
  imports: [PrismaModule, PrismaCentralCoreModule, ProductsModule],
  controllers: [DriveController],
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule {}
