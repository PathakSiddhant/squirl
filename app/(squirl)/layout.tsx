import { redirect } from 'next/navigation';

import { isUnlocked } from '@/lib/squirl/session';

/**
 * The gate.
 *
 * Every route inside Squirl is nested under this layout, so the check happens
 * in one place and a new application cannot forget to make it. There is no
 * middleware doing this: middleware runs on a different runtime and would need
 * its own copy of the signing logic, which is one copy too many for a lock
 * this small.
 */
export default async function SquirlLayout({ children }: { children: React.ReactNode }) {
  if (!(await isUnlocked())) redirect('/lock');
  return <>{children}</>;
}
