import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema';

/**
 * A single local SQLite file. No server, no account, no network.
 *
 * The connection is cached on globalThis so Next's dev server does not open a
 * new handle on every hot reload.
 */

export const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/hisaab.db';

function ensureDirectory(url: string): void {
  if (!url.startsWith('file:')) return;
  const filePath = resolve(process.cwd(), url.slice('file:'.length));
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

declare global {
  // eslint-disable-next-line no-var
  var __hisaabClient: Client | undefined;
}

function getClient(): Client {
  if (!globalThis.__hisaabClient) {
    ensureDirectory(DATABASE_URL);
    globalThis.__hisaabClient = createClient({ url: DATABASE_URL });
    // Foreign keys are off by default in SQLite, which would silently allow
    // orphaned transactions pointing at deleted debts.
    void globalThis.__hisaabClient.execute('PRAGMA foreign_keys = ON');
  }
  return globalThis.__hisaabClient;
}

export const db = drizzle(getClient(), { schema });

export type Database = typeof db;
export { schema };
