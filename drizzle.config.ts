import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  // Each application owns its own schema file. Drizzle reads them all;
  // they never import one another.
  schema: ['./lib/db/schema.ts', './lib/signal/schema.ts'],
  out: './lib/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/squirl.db',
  },
  strict: true,
  verbose: true,
});
