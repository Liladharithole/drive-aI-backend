import { Global, Module } from '@nestjs/common';
import { PrismaCentralCoreReadService } from './prisma-central-core-read.service';
import { PrismaCentralCoreService } from './prisma-central-core.service';

@Global()
@Module({
  providers: [PrismaCentralCoreService, PrismaCentralCoreReadService],
  exports: [PrismaCentralCoreService, PrismaCentralCoreReadService],
})
export class PrismaCentralCoreModule {}
