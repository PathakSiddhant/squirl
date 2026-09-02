import { LedgerMark } from '@/components/brand/logo';
import { MilestoneGrid } from '@/components/game/progress-panel';
import { PageHeader, Panel } from '@/components/ui/primitives';
import { today as istToday } from '@/lib/date';
import { earnedCount, mascotMood } from '@/lib/domain/achievements';
import { formatMoney } from '@/lib/money';
import { debtTotals, getDebtsWithPositions } from '@/lib/queries/debts';
import { getOverview } from '@/lib/queries/overview';
import { getAchievements } from '@/lib/queries/progress';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Progress' };

export default async function ProgressPage() {
  const asOf = istToday();
  const overview = await getOverview(asOf);
  const totals = debtTotals(await getDebtsWithPositions(asOf));

  const { stats, achievements } = await getAchievements(asOf, {
    parked: overview.position.parked,
    netWorth: overview.position.netWorth,
    owedByMe: overview.position.iOwe,
    interestEarned: totals.interestEarned,
  });

  const mood = mascotMood({
    entryCount: stats.entryCount,
    safeToSpend: overview.position.safeToSpend,
    isUnderwater: overview.position.isUnderwater,
    runwayDays: overview.runway.days,
    streak: stats.streak,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Progress"
        subtitle="Milestones are earned by actually improving your position, never by opening the app."
      />

      <Panel>
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[var(--acorn-wash)]">
            <LedgerMark size={42} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[1.0625rem] font-semibold text-ink">{mood.title}</p>
            <p className="mt-0.5 max-w-[60ch] text-[0.875rem] text-ink-2">{mood.body}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          <Stat label="Current streak" value={`${stats.streak}`} suffix={stats.streak === 1 ? 'day' : 'days'} />
          <Stat label="Best ever" value={`${stats.bestStreak}`} suffix="days" />
          <Stat label="Stashed away" value={formatMoney(stats.parked)} />
          <Stat
            label="Milestones"
            value={`${earnedCount(achievements)}`}
            suffix={`of ${achievements.length}`}
          />
        </div>
      </Panel>

      <section>
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink">Milestones</h2>
        <MilestoneGrid achievements={achievements} />
      </section>

      <Panel>
        <div className="px-4 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-ink">Why there are no points</h2>
          <p className="mt-1.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-2">
            No XP, no levels, no daily quests. Points would reward you for opening an app, and this
            one only wants to reward you for knowing where you stand. Every milestone above marks
            something that genuinely changed: a debt cleared, a loan finished, a balance checked
            against reality, a stash that grew.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-surface px-3.5 py-3">
      <p className="label">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="money text-[1.0625rem] text-ink">{value}</span>
        {suffix ? <span className="text-[0.75rem] text-ink-3">{suffix}</span> : null}
      </p>
    </div>
  );
}
