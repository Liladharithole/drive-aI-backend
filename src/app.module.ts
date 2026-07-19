import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { createPinoHttpOptions } from './logger/pino-http.config';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { FoldersModule } from './modules/folders/folders.module';
import { ProductsModule } from './modules/products/products.module';
import { PrismaCentralCoreModule } from './prisma-central-core/prisma-central-core.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpOptions(),
    }),
    PrismaModule,
    PrismaCentralCoreModule,
    AuthModule,
    ProductsModule,
    FoldersModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
