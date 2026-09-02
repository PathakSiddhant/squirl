import { redirect } from 'next/navigation';

import { LockScreen, type DeskPhase } from '@/components/squirl/lock-screen';
import { IST_TIME_ZONE } from '@/lib/date';
import { isUnlocked } from '@/lib/squirl/session';

export const metadata = { title: 'Locked' };

/**
 * Which part of the day it is where the owner actually is.
 *
 * Read in Asia/Kolkata rather than from the browser, so the desk lamp matches
 * the room the machine is sitting in and not whatever timezone a client
 * happens to report.
 */
function deskPhase(): DeskPhase {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIME_ZONE,
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );

  if (hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17) return 'day';
  if (hour < 20) return 'dusk';
  return 'night';
}

export default async function LockPage() {
  // Already unlocked: never show a sign-in form to someone who is signed in.
  if (await isUnlocked()) redirect('/');
  return <LockScreen phase={deskPhase()} />;
}
