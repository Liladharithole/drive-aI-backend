import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options as PinoHttpOptions } from 'pino-http';

type ReqWithId = IncomingMessage & { id?: string };

export function createPinoHttpOptions(): PinoHttpOptions {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
    transport: isProd
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            singleLine: false,
            ignore: 'pid,hostname',
          },
        },
    genReqId: (req) => {
      const raw = req.headers['x-request-id'];
      if (typeof raw === 'string' && raw.length > 0) {
        return raw;
      }
      if (Array.isArray(raw) && raw[0]) {
        return raw[0];
      }
      return randomUUID();
    },
    serializers: {
      req: (req: ReqWithId) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: ServerResponse) => ({
        statusCode: res.statusCode,
      }),
    },
  };
}
