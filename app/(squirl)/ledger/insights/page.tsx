import { CalendarHeat } from '@/components/charts/calendar-heat';
import { CategoryBars } from '@/components/charts/category-bars';
import { Icon } from '@/components/shell/icon';
import { PageHeader, Panel, PanelHeader } from '@/components/ui/primitives';
import { addDays, formatDay, today as istToday } from '@/lib/date';
import { summariseDays } from '@/lib/domain/position';
import { formatMoney } from '@/lib/money';
import {
  getBiggestExpenses,
  getCategoryTotals,
  getMethodTotals,
  getMovements,
} from '@/lib/queries/ledger';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Insights' };

const METHOD_LABEL: Record<string, string> = {
  upi: 'UPI',
  card: 'Card',
  cash: 'Cash',
  bank: 'Bank transfer',
  auto: 'Auto debit',
  other: 'Other',
};

export default async function InsightsPage(props: PageProps<'/ledger/insights'>) {
  const params = await props.searchParams;
  const asOf = istToday();
  const windowDays = typeof params.range === 'string' ? Number(params.range) || 30 : 30;
  const from = addDays(asOf, -(windowDays - 1));

  const [categoryTotals, methodTotals, biggest, movements] = await Promise.all([
    getCategoryTotals(from, asOf),
    getMethodTotals(from, asOf),
    getBiggestExpenses(from, asOf, 5),
    getMovements(addDays(asOf, -83), asOf),
  ]);

  const outgoing = categoryTotals.filter((c) => c.flow === 'out');
  const incoming = categoryTotals.filter((c) => c.flow === 'in');
  const spent = outgoing.reduce((n, c) => n + c.total, 0);
  const earned = incoming.reduce((n, c) => n + c.total, 0);
  const methodTotal = methodTotals.reduce((n, m) => n + m.total, 0);

  const daySummaries = summariseDays(movements);
  const heatDays = new Map(
    [...daySummaries.entries()].map(([day, s]) => [day, { out: s.out, count: s.count }]),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Insights"
        subtitle={`${formatDay(from, asOf)} to ${formatDay(asOf, asOf)}, ${formatMoney(spent)} spent`}
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        <Stat label="Spent" value={formatMoney(spent)} tone="text-[var(--out-text)]" />
        <Stat label="Came in" value={formatMoney(earned)} tone="text-[var(--in-text)]" />
        <Stat
          label="A day, average"
          value={formatMoney(Math.round(spent / windowDays))}
          tone="text-ink"
        />
        <Stat
          label="Kept"
          value={formatMoney(earned - spent)}
          tone={earned - spent >= 0 ? 'text-ink' : 'text-[var(--i-owe-text)]'}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Twelve weeks, day by day"
          hint="Darker means a heavier day. An outline means nothing was logged at all."
        />
        <CalendarHeat days={heatDays} today={asOf} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Where it went" hint={`${outgoing.length} categories`} />
          <CategoryBars rows={outgoing} total={spent} />
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="How you paid"
              hint="UPI is where money usually disappears without a trace"
            />
            {methodTotals.length === 0 ? (
              <p className="px-4 pb-5 text-[0.875rem] text-ink-3">Nothing spent in this window.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {methodTotals.map((row) => (
                  <li key={row.method} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink">
                      {METHOD_LABEL[row.method] ?? row.method}
                    </span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-[var(--out)]"
                        style={{ width: `${methodTotal ? (row.total / methodTotal) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="money w-20 shrink-0 text-right text-[0.875rem] text-ink">
                      {formatMoney(row.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Biggest single spends" hint="The ones worth remembering" />
            {biggest.length === 0 ? (
              <p className="px-4 pb-5 text-[0.875rem] text-ink-3">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {biggest.map((row) => (
                  <li key={row.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-ink-2">
                      <Icon name={row.categoryIcon} size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.875rem] text-ink">
                        {row.note || row.categoryName || 'Spent'}
                      </p>
                      <p className="text-[0.75rem] text-ink-3">{formatDay(row.day, asOf)}</p>
                    </div>
                    <span className="money shrink-0 text-[0.875rem] text-ink">
                      {formatMoney(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {incoming.length > 0 ? (
        <Panel>
          <PanelHeader title="Where it came from" hint={`${formatMoney(earned)} in this window`} />
          <CategoryBars rows={incoming} total={earned} tone="in" />
        </Panel>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-surface px-3.5 py-3">
      <p className="label">{label}</p>
      <p className={`money mt-1 text-[1.0625rem] ${tone}`}>{value}</p>
    </div>
  );
}
