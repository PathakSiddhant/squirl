import { StartPhase } from '@/components/form/start-phase';
import { Today } from '@/components/form/today';
import { addDays, isDayString, today as realToday } from '@/lib/date';
import { getDayView, getRange, getWeights, latestWeight } from '@/lib/form/log';
import { getActivePhase } from '@/lib/form/phases';
import { getProfile } from '@/lib/form/profile';
import { listFoods } from '@/lib/form/foods';
import { summarise } from '@/lib/form/trend';

export const metadata = { title: 'Form' };
export const dynamic = 'force-dynamic';

/**
 * Today — or whichever day was clicked on the graph below it.
 *
 * The screen Form is opened for, several times a day, usually to write one
 * number down and close it again. Everything here is read from the local
 * database, so it draws identically with the network unplugged.
 *
 * ## Why a day other than today can land here at all
 *
 * A calendar day is not the same thing as a person's day. Something drunk at
 * half past midnight belongs, by any ordinary account of "today", to the day
 * that had not gone to sleep yet — not to the one the clock says has just
 * started. `?day=` is how the completion graph hands a click over to this
 * page: the phase, the weight trend and the graph itself stay anchored to the
 * real calendar day (`real` below), and only the one day actually being
 * logged moves.
 */
export default async function FormToday({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day: requested } = await searchParams;
  const real = realToday();
  // A future day, or garbage in the URL, is not a day anyone can log against.
  const day = requested && isDayString(requested) && requested <= real ? requested : real;

  const phase = await getActivePhase(real);
  if (!phase) return <StartPhase />;

  const [profile, view, weights, recent, foods, latest] = await Promise.all([
    getProfile(),
    getDayView(day, phase, real),
    getWeights(addDays(real, -120), real),
    // Half a year of days. The graph is the width of the sheet, and eight weeks
    // of squares left two thirds of it empty.
    getRange(addDays(real, -181), real, phase, real),
    listFoods(),
    latestWeight(real),
  ]);

  return (
    <Today
      day={day}
      today={real}
      phase={phase}
      profile={profile}
      view={view}
      trend={summarise(weights, 14)}
      series={weights}
      recent={recent}
      foods={foods}
      latestWeightG={latest}
    />
  );
}
