import { StartPhase } from '@/components/form/start-phase';
import { Today } from '@/components/form/today';
import { addDays, today } from '@/lib/date';
import { getDayView, getRange, getWeights } from '@/lib/form/log';
import { getActivePhase } from '@/lib/form/phases';
import { getProfile } from '@/lib/form/profile';
import { listFoods } from '@/lib/form/foods';
import { summarise } from '@/lib/form/trend';

export const metadata = { title: 'Form' };
export const dynamic = 'force-dynamic';

/**
 * Today.
 *
 * The screen Form is opened for, several times a day, usually to write one
 * number down and close it again. Everything here is read from the local
 * database, so it draws identically with the network unplugged.
 */
export default async function FormToday() {
  const day = today();
  const phase = await getActivePhase(day);

  if (!phase) return <StartPhase />;

  const [profile, view, weights, recent, foods] = await Promise.all([
    getProfile(),
    getDayView(day, phase, day),
    getWeights(addDays(day, -120), day),
    // Half a year of days. The graph is the width of the sheet, and eight weeks
    // of squares left two thirds of it empty.
    getRange(addDays(day, -181), day, phase, day),
    listFoods(),
  ]);

  return (
    <Today
      day={day}
      phase={phase}
      profile={profile}
      view={view}
      trend={summarise(weights, 14)}
      series={weights}
      recent={recent}
      foods={foods}
    />
  );
}
