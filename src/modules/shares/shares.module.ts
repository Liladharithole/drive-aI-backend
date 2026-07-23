import { Module, forwardRef } from '@nestjs/common';
import { PrismaCentralCoreModule } from '../../prisma-central-core/prisma-central-core.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { FilesModule } from '../files/files.module';
import { AuditModule } from '../audit/audit.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [
    PrismaModule,
    PrismaCentralCoreModule,
    ProductsModule,
    forwardRef(() => FilesModule),
    AuditModule,
  ],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}
