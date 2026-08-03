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

type Drizzle = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __hisaabClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __hisaabDb: Drizzle | undefined;
}

function getClient(): Client {
  if (!globalThis.__hisaabClient) {
    globalThis.__hisaabClient = createClient({ url: DATABASE_URL });
    // Foreign keys are off by default in SQLite, which would silently allow
    // orphaned transactions pointing at deleted debts.
    void globalThis.__hisaabClient.execute('PRAGMA foreign_keys = ON');
  }
  return globalThis.__hisaabClient;
}

function getDb(): Drizzle {
  if (!globalThis.__hisaabDb) globalThis.__hisaabDb = drizzle(getClient(), { schema });
  return globalThis.__hisaabDb;
}

/**
 * Lazily connected.
 *
 * Opening the database at module scope means Next's build workers load the
 * native libsql binding just to collect page metadata, which crashes the
 * worker outright. The proxy defers the connection until a query is actually
 * run, so importing a page stays free.
 */
export const db = new Proxy({} as Drizzle, {
  get(_target, property, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, property, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export type Database = Drizzle;
export { schema };
