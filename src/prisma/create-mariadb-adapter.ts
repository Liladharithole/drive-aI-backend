import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export function createMariaDbAdapter(
  databaseUrl: string,
  connectionLimit = 5,
): PrismaMariaDb {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, '');

  return new PrismaMariaDb({
    host: url.hostname,
    ...(url.port ? { port: Number(url.port) } : {}),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit,
  });
}
