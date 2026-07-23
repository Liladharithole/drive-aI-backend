import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

const server: Express = express();
let appInitPromise: Promise<void> | null = null;

async function bootstrapServerless() {
  if (!appInitPromise) {
    appInitPromise = (async () => {
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
    })();
  }
  await appInitPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    await bootstrapServerless();
    server(req, res);
  } catch (error) {
    console.error('Serverless Bootstrap Error:', error);
    res.status(500).json({
      statusCode: 500,
      message: 'Internal Serverless Invocation Error',
      error: String((error as Error)?.message || error),
    });
  }
}
