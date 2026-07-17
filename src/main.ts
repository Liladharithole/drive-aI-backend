import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
// Function to parse the CORS origins
function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
// Logger for the app
  app.useLogger(app.get(PinoLogger));
  // Global filters for the app
  app.useGlobalFilters(new AllExceptionsFilter());
  // Enable shutdown hooks for the app
  app.enableShutdownHooks();

  // CORS configuration
  const corsOrigins = parseCorsOrigins();
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id','x-api-key','x-user-id','x-tenant-id','x-user-role'],
      exposedHeaders: ['x-request-id','x-user-id','x-tenant-id','x-user-role'],
      maxAge: Number(process.env.CORS_MAX_AGE ?? 600),
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
  }
  // Logger for the CORS configuration
  const corsLogger = new Logger('CORS-CONFIGURATION');
  corsLogger.log(`CORS configuration: ${corsOrigins.length > 0 ? corsOrigins.join(', ') : 'none'}`);
  corsLogger.log(`CORS max age: ${process.env.CORS_MAX_AGE ?? 600}`);
  corsLogger.log(`CORS options success status: ${204}`);
  corsLogger.log(`CORS credentials: ${true}`);
  corsLogger.log(`CORS preflight continue: ${false}`);
  corsLogger.log(`CORS methods: ${['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS']}`);
  corsLogger.log(`CORS allowed headers: ${['Content-Type', 'Authorization', 'x-request-id','x-api-key','x-user-id','x-tenant-id','x-user-role']}`);
  corsLogger.log(`CORS exposed headers: ${['x-request-id','x-user-id','x-tenant-id','x-user-role']}`);

  const port = Number(process.env.PORT ?? 7001);
  await app.listen(port);
// Logger for the bootstrap
  const bootstrapLogger = new Logger('Bootstrap');
  if (corsOrigins.length === 0) {
    bootstrapLogger.warn(
      'CORS_ORIGIN is not set; cross-origin browser requests may be blocked.',
    );
  }
  bootstrapLogger.log(`Server listening on http://localhost:${port}`);
}

void bootstrap();
