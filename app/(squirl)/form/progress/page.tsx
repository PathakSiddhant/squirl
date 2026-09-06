import { Progress } from '@/components/form/progress';
import { addDays, today } from '@/lib/date';
import { db } from '@/lib/db/client';
import { getAllWeights, getRange } from '@/lib/form/log';
import { getActivePhase } from '@/lib/form/phases';
import { getProfile } from '@/lib/form/profile';
import { formMeasurements } from '@/lib/form/schema';
import { summarise } from '@/lib/form/trend';
import { desc } from 'drizzle-orm';

export const metadata = { title: 'Progress · Form' };
export const dynamic = 'force-dynamic';

/**
 * Am I actually moving?
 *
 * The one question this page answers. Everything on it is derived from logged
 * data, and nothing on it is an engagement statistic: there is no "days
 * active", no completion percentage held up as a score, and nothing counting
 * how disciplined anybody has been.
 */
export default async function FormProgress() {
  const day = today();
  const phase = await getActivePhase(day);

  const [profile, weights, range, measurements] = await Promise.all([
    getProfile(),
    getAllWeights(),
    getRange(addDays(day, -180), day, phase, day),
    db.select().from(formMeasurements).orderBy(desc(formMeasurements.day)),
  ]);

  return (
    <Progress
      phase={phase}
      profile={profile}
      weights={weights}
      trend={summarise(weights, 14)}
      range={range}
      measurements={measurements}
      today={day}
    />
  );
}
