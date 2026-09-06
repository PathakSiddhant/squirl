import { PhaseSetup } from '@/components/form/phase-setup';
import { getProfile } from '@/lib/form/profile';

export const metadata = { title: 'New phase · Form' };
export const dynamic = 'force-dynamic';

/**
 * Setting up a phase.
 *
 * Reachable both from the empty state and from Phases, because starting the
 * next one is the same act whether or not there was a previous one. Whatever
 * is currently running is completed as part of starting this, in one step.
 */
export default async function NewPhase() {
  return <PhaseSetup profile={await getProfile()} />;
}
