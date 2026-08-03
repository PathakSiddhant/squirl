import { ArrowRight } from '@phosphor-icons/react/dist/ssr/ArrowRight';
import { Flame } from '@phosphor-icons/react/dist/ssr/Flame';
import Link from 'next/link';

import { QuickCapture } from '@/components/capture/quick-capture';
import { EntryRow } from '@/components/ledger/entry-row';
import { PositionStrip } from '@/components/today/position-strip';
import { SafeToSpend } from '@/components/today/safe-to-spend';
import { Panel, PanelHeader } from '@/components/ui/primitives';
import { SpendSparkline } from '@/components/charts/spend-sparkline';
import { formatDayLong, formatRelativeDay } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { getOverview } from '@/lib/queries/overview';
import { getCaptureContext } from '@/lib/queries/reference';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const [overview, captureContext] = await Promise.all([getOverview(), getCaptureContext()]);
  const { position, runway, allowance } = overview;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] font-semibold leading-tight text-ink">
            {formatDayLong(overview.asOf)}
          </h1>
          <p className="mt-1 text-[0.875rem] text-ink-2">
            {overview.todayEntries.length === 0
              ? 'Nothing logged yet today.'
              : `${overview.todayEntries.length} logged today, ${formatMoney(overview.todayOut)} out.`}
          </p>
        </div>
        {overview.streak > 1 ? (
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-2 py-1 text-[0.8125rem] text-ink-2">
            <Flame size={13} className="text-[var(--out)]" weight="fill" />
            <span className="money">{overview.streak}</span> day streak
          </span>
        ) : null}
      </header>

      <QuickCapture context={{ today: overview.asOf, ...captureContext }} autoFocus />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
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

        <Panel className="flex flex-col">
          <PanelHeader
            title="Last 30 days"
            hint={
              runway.days === null
                ? 'No spending recorded yet'
                : `${formatMoney(runway.dailyBurn)} a day lately, about ${runway.days} days left at this pace`
            }
          />
          <div className="flex-1 px-4 pb-4">
            <SpendSparkline days={overview.recentDays} />
          </div>
        </Panel>
      </div>

      <PositionStrip position={position} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Today"
            hint={overview.todayIn > 0 ? `${formatMoney(overview.todayIn)} came in` : undefined}
            action={
              <Link
                href="/ledger"
                className="inline-flex items-center gap-1 text-[0.8125rem] text-ink-2 hover:text-ink"
              >
                Full ledger <ArrowRight size={12} />
              </Link>
            }
          />
          {overview.todayEntries.length === 0 ? (
            <p className="px-4 pb-5 text-[0.875rem] text-ink-3">
              Log the first thing above. Even a 10 rupee chai counts, and that is the point.
            </p>
          ) : (
            <div className="divide-y divide-line border-t border-line">
              {overview.todayEntries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Coming up"
            hint={
              overview.dueSoon.length === 0
                ? 'Nothing due in the next 30 days'
                : `${overview.dueSoon.length} promise${overview.dueSoon.length === 1 ? '' : 's'} inside 30 days`
            }
          />
          {overview.dueSoon.length === 0 ? (
            <p className="px-4 pb-5 text-[0.875rem] text-ink-3">
              No installments or repayments are due. Everything in hand is genuinely yours.
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
      </div>
    </div>
  );
}
