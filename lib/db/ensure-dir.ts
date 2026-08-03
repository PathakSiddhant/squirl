import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { DATABASE_URL } from './client';

/**
 * Creates the folder the SQLite file lives in.
 *
 * Deliberately kept out of `client.ts`: filesystem calls there drag the whole
 * project into Turbopack's server trace. Only the setup scripts need it, and
 * they are never bundled.
 */
export function ensureDataDirectory(url: string = DATABASE_URL): void {
  if (!url.startsWith('file:')) return;
  const filePath = resolve(process.cwd(), url.slice('file:'.length));
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
