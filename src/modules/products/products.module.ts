import { Module } from '@nestjs/common';
import { ProductAccessGuard } from '../auth/guards/product-access.guard';
import { PrismaCentralCoreModule } from '../../prisma-central-core/prisma-central-core.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaCentralCoreModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductAccessGuard],
  exports: [ProductsService, ProductAccessGuard],
})
export class ProductsModule {}
