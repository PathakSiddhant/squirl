import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { Source_Serif_4 } from 'next/font/google';


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
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${displaySerif.variable}`}>
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
