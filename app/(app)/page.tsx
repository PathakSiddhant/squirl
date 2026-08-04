import { ArrowRight } from '@phosphor-icons/react/dist/ssr/ArrowRight';
import Link from 'next/link';

import { Lockup } from '@/components/brand/logo';
import { QuickCapture } from '@/components/capture/quick-capture';
import { ProgressPanel } from '@/components/game/progress-panel';
import { AddEntryButton, EntryList } from '@/components/ledger/entry-list';
import { PositionStrip } from '@/components/today/position-strip';
import { SafeToSpend } from '@/components/today/safe-to-spend';
import { Panel, PanelHeader } from '@/components/ui/primitives';
import { SpendSparkline } from '@/components/charts/spend-sparkline';
import { formatDayLong, formatRelativeDay } from '@/lib/date';
import { earnedCount, mascotMood, nextMilestone } from '@/lib/domain/achievements';
import { formatMoney } from '@/lib/money';
import { debtTotals, getDebtsWithPositions } from '@/lib/queries/debts';
import { getOverview } from '@/lib/queries/overview';
import { getAchievements } from '@/lib/queries/progress';
import { getCaptureContext } from '@/lib/queries/reference';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const [overview, captureContext] = await Promise.all([getOverview(), getCaptureContext()]);
  const { position, runway, allowance } = overview;

  const totals = debtTotals(await getDebtsWithPositions(overview.asOf));
  const { stats, achievements } = await getAchievements(overview.asOf, {
    parked: position.parked,
    netWorth: position.netWorth,
    owedByMe: position.iOwe,
    interestEarned: totals.interestEarned,
  });

  const mood = mascotMood({
    entryCount: stats.entryCount,
    safeToSpend: position.safeToSpend,
    isUnderwater: position.isUnderwater,
    runwayDays: runway.days,
    streak: stats.streak,
  });

  const editorContext = {
    accounts: captureContext.accounts,
    categories: captureContext.categories.map((c) => ({ id: c.id, name: c.name, flow: c.flow })),
    people: captureContext.people,
  };

  if (stats.entryCount === 0) {
    return <FirstRun context={{ today: overview.asOf, ...captureContext }} />;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] font-semibold leading-tight text-ink">
            {formatDayLong(overview.asOf)}
          </h1>
          <p className="mt-1 text-[0.875rem] text-ink-2">
            {overview.todayEntries.length === 0
              ? 'Nothing written down yet today.'
              : `${overview.todayEntries.length} logged today, ${formatMoney(overview.todayOut)} out.`}
          </p>
        </div>
        <Link
          href="/guide"
          className="text-[0.8125rem] text-ink-3 underline underline-offset-4 transition-colors hover:text-ink"
        >
          New here? Read the guide
        </Link>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <QuickCapture
          context={{ today: overview.asOf, ...captureContext }}
          autoFocus
          className="flex-1"
        />
        <AddEntryButton context={editorContext} />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
        <SafeToSpend
          safeToSpend={position.safeToSpend}
          inHand={position.inHand}
          committed={position.committed}
          buffer={position.buffer}
          shortfall={position.shortfall}
          isUnderwater={position.isUnderwater}
          commitments={position.commitments}
          perDay={allowance.perDay}
          untilDay={allowance.untilDay}
          days={allowance.days}
        />

        <ProgressPanel
          mood={mood}
          streak={stats.streak}
          bestStreak={stats.bestStreak}
          parked={position.parked}
          earned={earnedCount(achievements)}
          total={achievements.length}
          next={nextMilestone(achievements)}
        />
      </div>

      <PositionStrip position={position} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Today"
            hint={overview.todayIn > 0 ? `${formatMoney(overview.todayIn)} came in` : undefined}
            action={
              <Link
                href="/ledger"
                className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-2 hover:text-ink"
              >
                All history <ArrowRight size={12} />
              </Link>
            }
          />
          {overview.todayEntries.length === 0 ? (
            <p className="px-4 pb-5 text-[0.875rem] text-ink-3">
              Nothing yet. Type it in the bar above the moment you spend it, and this fills up on
              its own.
            </p>
          ) : (
            <EntryList
              entries={overview.todayEntries}
              context={editorContext}
              className="border-t border-line"
            />
          )}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="Coming up"
              hint={
                overview.dueSoon.length === 0
                  ? 'Nothing due in the next 30 days'
                  : 'Already set aside from the number above'
              }
            />
            {overview.dueSoon.length === 0 ? (
              <p className="px-4 pb-5 text-[0.875rem] text-ink-3">
                No instalments or repayments are due, so everything in hand is genuinely yours.
              </p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {overview.dueSoon.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[0.875rem] text-ink">{item.label}</p>
                      <p
                        className={
                          item.isOverdue
                            ? 'text-[0.75rem] text-[var(--i-owe-text)]'
                            : 'text-[0.75rem] text-ink-3'
                        }
                      >
                        {item.isOverdue ? 'Overdue' : formatRelativeDay(item.dueOn, overview.asOf)}
                      </p>
                    </div>
                    <span className="money shrink-0 text-[0.875rem] text-ink-2">
                      {formatMoney(item.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Last 30 days"
              hint={
                runway.days === null
                  ? 'No spending recorded yet'
                  : `About ${formatMoney(runway.dailyBurn)} a day lately, roughly ${runway.days} days left at that pace`
              }
            />
            <div className="px-4 pb-4">
              <SpendSparkline days={overview.recentDays} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/**
 * First run.
 *
 * An empty dashboard of zeroes teaches nothing and looks broken. This explains
 * the one idea, gives three things to type, and gets out of the way the moment
 * anything is logged.
 */
function FirstRun({ context }: { context: React.ComponentProps<typeof QuickCapture>['context'] }) {
  const examples = [
    ['chai 20', 'Something you bought'],
    ['+20000 stipend', 'Money that came in'],
    ['lent 500 to a friend', 'Money you lent out'],
  ] as const;

  return (
    <div className="mx-auto max-w-[640px] py-6">
      <div className="flex flex-col items-center text-center">
        <Lockup size={132} />
        <h1 className="mt-5 text-[1.5rem] font-semibold tracking-tight text-ink">
          Let us find out where you stand
        </h1>
        <p className="mt-2 max-w-[48ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Squirl keeps money you spent, money you lent and money you stashed as separate things, so
          your balance stops feeling random. It starts working from the very first entry.
        </p>
      </div>

      <div className="mt-6">
        <QuickCapture context={context} autoFocus />
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-line bg-surface">
        <p className="border-b border-line px-4 py-2.5 text-[0.8125rem] font-medium text-ink">
          Try typing one of these
        </p>
        <ul className="divide-y divide-line">
          {examples.map(([example, meaning]) => (
            <li key={example} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <code className="font-mono text-[0.875rem] text-ink">{example}</code>
              <span className="text-[0.8125rem] text-ink-3">{meaning}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-center text-[0.8125rem] text-ink-3">
        Want the whole thing explained first?{' '}
        <Link href="/guide" className="font-medium text-ink underline underline-offset-4">
          Read the guide
        </Link>
        , it takes five minutes.
      </p>
    </div>
  );
}
