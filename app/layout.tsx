import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { IBM_Plex_Mono, Source_Serif_4, Space_Grotesk } from 'next/font/google';


import { BootScreen } from '@/components/squirl/boot-screen';
import { ThemeScript } from '@/components/shell/theme-script';
import { Toasts } from '@/components/ui/toasts';

import './globals.css';

/**
 * The display face, used on the threshold and nowhere else.
 *
 * Geist carries the whole interface, and pairing it with a second sans would
 * be two typefaces doing one job. A transitional serif pairs on a real
 * contrast axis instead, and it is confined to the two headlines on the lock
 * screen: the moment the product introduces itself, rather than any screen you
 * work in. next/font self-hosts it at build time, so nothing is fetched at
 * runtime and the page stays local-first.
 */
const displaySerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-display-serif',
  display: 'swap',
});

/**
 * Signal's own faces.
 *
 * Squirl provides the frame; an application chooses how it reads inside it.
 * Ledger is Geist and a transitional serif, which suits a ledger: quiet,
 * bookish, built around figures you check twice. Signal is a different job. It
 * is an instrument you scan, so it gets a geometric grotesque with real
 * personality in its letterforms and a mono for every piece of metadata, which
 * makes durations and timestamps line up into columns the eye can run down
 * without reading.
 *
 * Loaded here rather than in Signal's layout because next/font must be called
 * at module scope in a file the compiler can see statically. Scoped by class,
 * so nothing outside Signal changes.
 */
const signalSans = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-signal-sans',
  display: 'swap',
});

const signalMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-signal-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Squirl',
    template: '%s · Squirl',
  },
  description:
    'A local-first personal software environment. Its first application is Ledger, which knows the difference between money you spent, money you lent, and money you put away.',
  applicationName: 'Squirl',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Squirl', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafb' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0e12' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${displaySerif.variable} ${signalSans.variable} ${signalMono.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <BootScreen />
        {children}
        <Toasts />
      </body>
    </html>
  );
}
