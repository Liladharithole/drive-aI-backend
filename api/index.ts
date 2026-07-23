import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

const server: Express = express();
let isInitialized = false;

async function bootstrapServerless() {
  if (!isInitialized) {
    process.env.TZ = 'UTC';

    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
      {
        bufferLogs: true,
      },
    );

    app.useLogger(app.get(PinoLogger));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    const rawCors = process.env.CORS_ORIGIN || '*';
    const origins = rawCors
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    app.enableCors({
      origin: origins.length === 1 && origins[0] === '*' ? '*' : origins,
      credentials: true,
    });

    await app.init();
    isInitialized = true;
  }
}

export default async function handler(req: any, res: any) {
  await bootstrapServerless();
  server(req, res);
}
