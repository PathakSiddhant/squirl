import { ListDashes } from '@phosphor-icons/react/dist/ssr/ListDashes';

import { QuickCapture } from '@/components/capture/quick-capture';
import { DayGroup, groupByDay } from '@/components/ledger/day-group';
import { AddEntryButton } from '@/components/ledger/entry-list';
import { LedgerFilters } from '@/components/ledger/filters';
import { Empty, PageHeader } from '@/components/ui/primitives';
import { addDays, today as istToday } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { getLedgerEntries } from '@/lib/queries/ledger';
import { getCaptureContext, getCategories } from '@/lib/queries/reference';
import type { TransactionKind } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'History' };

export default async function HistoryPage(props: PageProps<'/ledger/history'>) {
  const params = await props.searchParams;
  const asOf = istToday();

  const range = typeof params.range === 'string' ? params.range : '30';
  const from = range === 'all' ? undefined : addDays(asOf, -Number(range || 30));
  const kindParam = typeof params.kind === 'string' ? params.kind : undefined;
  const kinds = kindParam ? (kindParam.split(',') as TransactionKind[]) : undefined;

  const [entries, categories, captureContext] = await Promise.all([
    getLedgerEntries({
      from,
      search: typeof params.q === 'string' ? params.q : undefined,
      kinds,
      categoryId: typeof params.category === 'string' ? params.category : undefined,
      limit: 400,
    }),
    getCategories(),
    getCaptureContext(),
  ]);

  const editorContext = {
    accounts: captureContext.accounts,
    categories: categories.map((c) => ({ id: c.id, name: c.name, flow: c.flow })),
    people: captureContext.people,
  };

  const groups = groupByDay(entries);
  const spent = entries
    .filter((e) => e.kind === 'expense')
    .reduce((n, e) => n + e.amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="History"
        subtitle={
          entries.length === 0
            ? 'Every movement, day by day'
            : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}, ${formatMoney(spent)} spent`
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <QuickCapture context={{ today: asOf, ...captureContext }} className="flex-1" />
        <AddEntryButton context={editorContext} />
      </div>

      <LedgerFilters categories={categories.map((c) => ({ id: c.id, name: c.name }))} />

      {groups.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <Empty
            icon={<ListDashes size={22} />}
            title="Nothing here"
            body="No entries match this view. Try widening the range, or log something with the bar above."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <DayGroup
              key={group.day}
              day={group.day}
              entries={group.entries}
              today={asOf}
              context={editorContext}
            />
          ))}
        </div>
      )}

      {entries.length >= 400 ? (
        <p className="text-center text-[0.8125rem] text-ink-3">
          Showing the most recent 400. Narrow the range to see further back.
        </p>
      ) : null}
    </div>
  );
}
