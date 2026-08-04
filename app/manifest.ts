import type { MetadataRoute } from 'next';

/**
 * Installable on a phone, which matters more here than it sounds: the whole
 * point is logging a 20 rupee chai the moment you pay for it, and that only
 * happens if the app is one tap from the home screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Squirl',
    short_name: 'Squirl',
    description:
      'A personal money ledger that knows the difference between money you spent, money you lent, and money you parked.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafafb',
    theme_color: '#fafafb',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops to a circle, so the maskable variant keeps more padding.
      { src: '/brand/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
