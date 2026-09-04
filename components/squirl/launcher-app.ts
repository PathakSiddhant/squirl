import type { Route } from 'next';

import type { AppMarkName } from '@/components/brand/logo';
import type { AppSnapshot } from '@/lib/squirl/apps';

/**
 * An application as the launcher's client components see it.
 *
 * Deliberately not `SquirlApp`. That carries a `snapshot()` function, and a
 * function cannot cross into a client component, so the page calls it on the
 * server and hands the result over already read.
 *
 * It lives in its own module rather than beside the launcher because every
 * view imports it and the launcher imports every view, which would otherwise
 * be a cycle.
 */
export interface LauncherApp {
  id: string;
  name: string;
  tagline: string;
  note?: string;
  mark: AppMarkName;
  accentClass: string;
  status: 'ready' | 'planned';
  href?: Route;
  snapshot: AppSnapshot | null;
}
