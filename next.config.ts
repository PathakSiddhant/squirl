import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // libsql ships a native binding. Keep it out of the bundler and let Node
  // require it directly at runtime.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  typedRoutes: true,
  experimental: {
    // Ledger pages import a lot of individual icons. Rewriting these to deep
    // imports keeps the client bundle small.
    optimizePackageImports: ['@phosphor-icons/react', 'motion'],
  },
};

export default nextConfig;
