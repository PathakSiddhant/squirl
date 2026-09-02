import { redirect } from 'next/navigation';

import { LockScreen } from '@/components/squirl/lock-screen';
import { deskPhase } from '@/lib/squirl/phase';
import { isUnlocked } from '@/lib/squirl/session';

export const metadata = { title: 'Locked' };

export default async function LockPage() {
  // Already unlocked: never show a sign-in form to someone who is signed in.
  if (await isUnlocked()) redirect('/');
  return <LockScreen phase={deskPhase()} />;
}
