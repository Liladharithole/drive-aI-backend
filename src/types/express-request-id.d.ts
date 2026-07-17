declare global {
  namespace Express {
    interface Request {
      /** Set by pino-http via nestjs-pino */
      id?: string | number;
    }
  }
}

export {};
