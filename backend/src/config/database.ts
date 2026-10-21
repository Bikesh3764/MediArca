import { PrismaClient } from '@prisma/client';

/**
 * Ensures database connection URL includes optimal connection pooling and timeout settings
 * for multi-clinic traffic resilience. Appends connection_limit=25 and pool_timeout=30
 * if not already explicitly configured.
 */
export const tuneDatabaseUrl = (url?: string): string | undefined => {
  if (!url || !url.trim()) return undefined;
  const trimmed = url.trim();

  // Handle URL fragments (#) properly: query parameters must precede any fragment
  const hashIndex = trimmed.indexOf('#');
  const baseAndQuery = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const hash = hashIndex >= 0 ? trimmed.slice(hashIndex) : '';

  const hasConnectionLimit = /[\?&]connection_limit=\d+/i.test(baseAndQuery);
  const hasPoolTimeout = /[\?&]pool_timeout=\d+/i.test(baseAndQuery);

  if (hasConnectionLimit && hasPoolTimeout) {
    return trimmed;
  }

  const additions: string[] = [];
  if (!hasConnectionLimit) {
    additions.push('connection_limit=25');
  }
  if (!hasPoolTimeout) {
    additions.push('pool_timeout=30');
  }

  // Clean trailing ? or & if present to prevent malformed ?& or && query strings
  const cleanBase = baseAndQuery.replace(/[?&]+$/, '');
  const separator = cleanBase.includes('?') ? '&' : '?';
  return `${cleanBase}${separator}${additions.join('&')}${hash}`;
};

const tunedDatabaseUrl = tuneDatabaseUrl(process.env.DATABASE_URL);
if (tunedDatabaseUrl && process.env.DATABASE_URL) {
  process.env.DATABASE_URL = tunedDatabaseUrl;
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  ...(tunedDatabaseUrl ? { datasources: { db: { url: tunedDatabaseUrl } } } : {}),
});

export default prisma;

