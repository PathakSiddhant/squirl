import { PhaseHistory } from '@/components/form/phase-history';
import { today } from '@/lib/date';
import { getAllWeights } from '@/lib/form/log';
import { listPhases } from '@/lib/form/phases';
import { getProfile } from '@/lib/form/profile';

export const metadata = { title: 'Phases · Form' };
export const dynamic = 'force-dynamic';

/**
 * The journey, as a list of finished stretches.
 *
 * The reason phase history exists is §102: open Form in two years and it
 * should still say what the goal was, what the plan was, and what actually
 * happened. Nothing on this page is recomputed from current settings.
 */
export default async function FormPhases() {
  const [phases, profile, weights] = await Promise.all([
    listPhases(),
    getProfile(),
    getAllWeights(),
  ]);

  return <PhaseHistory phases={phases} profile={profile} weights={weights} today={today()} />;
}
