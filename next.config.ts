import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this Turbopack can walk up and pick a
  // stray lockfile in the home directory as the project root.
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  // libsql ships a native binding. Keep it out of the bundler and let Node
  // require it directly at runtime.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  typedRoutes: true,
};

export default nextConfig;

