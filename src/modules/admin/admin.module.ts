import { Module } from '@nestjs/common';
import { PrismaCentralCoreModule } from '../../prisma-central-core/prisma-central-core.module';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaCentralCoreModule],
  controllers: [AdminController],
  providers: [AdminService, PermissionsGuard],
  exports: [AdminService, PermissionsGuard],
})
export class AdminModule {}
