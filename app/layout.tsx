import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { ThemeScript } from '@/components/shell/theme-script';
import { Toasts } from '@/components/ui/toasts';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Hisaab',
    template: '%s · Hisaab',
  },
  description:
    'A personal money ledger that knows the difference between money you spent, money you lent, and money you parked.',
  applicationName: 'Hisaab',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Hisaab', statusBarStyle: 'default' },
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
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toasts />
      </body>
    </html>
  );
}
