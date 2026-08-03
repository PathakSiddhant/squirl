import { migrate } from 'drizzle-orm/libsql/migrator';

import { db, DATABASE_URL } from './client';
import { ensureDataDirectory } from './ensure-dir';

async function main() {
  ensureDataDirectory();
  console.log(`applying migrations to ${DATABASE_URL}`);
  await migrate(db, { migrationsFolder: './lib/db/migrations' });
  console.log('migrations applied');
}

main().catch((error) => {
  console.error('migration failed');
  console.error(error);
  process.exit(1);
});
