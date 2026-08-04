import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/squirl.db',
  },
  strict: true,
  verbose: true,
});
