import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this Turbopack can walk up and pick a
  // stray lockfile in the home directory as the project root.
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  // libsql ships a native binding. Keep it out of the bundler and let Node
  // require it directly at runtime.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  // The brand marks are flat, vector-style artwork and ask for quality 100.
  // Next 16 will not honour a `quality` prop that is not declared here: it
  // falls back to 75 and only warns, which is why the logo looked soft.
  images: {
    qualities: [75, 90, 100],
    /*
      Channel avatars, proxied and cached by Next rather than hotlinked.

      Thirty-nine faces fetched straight from yt3.ggpht.com on every render is
      thirty-nine cross-origin requests competing for the browser's six
      connections per host, which is why most of them arrived blank. Through
      the optimiser each one is fetched once, resized to the size actually
      drawn, and served from disk afterwards, so the shelf is instant on every
      later visit and still draws when the machine is offline.
    */
    remotePatterns: [
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: 'yt3.googleusercontent.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
    // Avatars are small and numerous; these are the only widths ever asked for.
    imageSizes: [48, 64, 96, 128],
  },
  typedRoutes: true,
  // No dev badge floating over the corner of the product. Squirl is something
  // its owner opens six times a day, not a project being demoed, and a
  // framework's logo hovering on top of it is the one thing on screen that
  // says "this is a local build of somebody's side project".
  devIndicators: false,
};

export default nextConfig;

