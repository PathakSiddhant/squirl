import { Repeat } from '@phosphor-icons/react/dist/ssr/Repeat';

import { AddRecurringButton } from '@/components/recurring/recurring-form';
import { RecurringList, type RecurringRow } from '@/components/recurring/recurring-list';
import { Empty, PageHeader } from '@/components/ui/primitives';
import { today as istToday } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { getRecurring } from '@/lib/queries/recurring';
import { getAccounts, getCategories } from '@/lib/queries/reference';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Repeating' };

export default async function RepeatingPage() {
  const asOf = istToday();
  const [views, accounts, categories] = await Promise.all([
    getRecurring(asOf),
    getAccounts(),
    getCategories(),
  ]);

  const options = {
    accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, flow: c.flow })),
  };

  const rows: RecurringRow[] = views.map((v) => ({
    id: v.rule.id,
    name: v.rule.name,
    kind: v.rule.kind as 'expense' | 'income' | 'transfer',
    amount: v.rule.amount,
    accountId: v.rule.accountId,
    counterAccountId: v.rule.counterAccountId,
    categoryId: v.rule.categoryId,
    intervalUnit: v.rule.intervalUnit,
    intervalCount: v.rule.intervalCount,
    startsOn: v.rule.startsOn,
    endsOn: v.rule.endsOn,
    autoPost: v.rule.autoPost,
    method: v.rule.method,
    note: v.rule.note,
    accountName: v.accountName,
    counterAccountName: v.counterAccountName,
    categoryName: v.categoryName,
    categoryIcon: v.categoryIcon,
    nextDueOn: v.rule.nextDueOn,
    lastPostedOn: v.rule.lastPostedOn,
    postedCount: v.rule.postedCount,
    active: v.rule.active,
    overdue: v.overdue,
    perYear: v.perYear,
    finished: v.finished,
  }));

  const live = rows.filter((r) => r.active && !r.finished);
  const outPerYear = live
    .filter((r) => r.kind !== 'income')
    .reduce((n, r) => n + r.perYear, 0);
  const outPerMonth = Math.round(outPerYear / 12);
  const autoCount = live.filter((r) => r.autoPost).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Repeating"
        subtitle="Subscriptions, auto-debits and anything else that comes back every month"
        action={<AddRecurringButton options={options} />}
      />

      {live.length > 0 ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
          <Stat label="Going out" value={formatMoney(outPerMonth)} hint="a month, averaged" />
          <Stat label="Over a year" value={formatMoney(outPerYear)} hint="if nothing changes" />
          <Stat label="Being tracked" value={String(live.length)} hint="active" mono={false} />
          <Stat label="On autopay" value={String(autoCount)} hint="log themselves" mono={false} />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <Empty
            icon={<Repeat size={22} />}
            title="Nothing repeating yet"
            body="Add your subscriptions and auto-debits here. The ones that leave your account on their own get logged automatically on the day, so a ₹179 you never noticed is never a mystery on your statement again."
          />
        </div>
      ) : (
        <RecurringList rows={rows} options={options} today={asOf} />
      )}

      {rows.length > 0 ? (
        <div className="rounded-md border border-line bg-surface px-4 py-3.5">
          <h2 className="text-[0.9375rem] font-semibold text-ink">How this works</h2>
          <p className="mt-1 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-2">
            Anything marked <strong className="font-medium text-ink">auto</strong> is written into
            your history on its due date without asking, because the bank takes it whether you are
            watching or not. If the app was closed when a charge fell due, it catches up the next
            time you open it. Everything else waits for you to confirm, and shows a prompt here
            when its date arrives. Either way, every posted charge is a normal entry you can open,
            edit or delete.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  mono = true,
}: {
  label: string;
  value: string;
  hint: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-surface px-3.5 py-3">
      <p className="label">{label}</p>
      <p className={`mt-1 text-[1.0625rem] text-ink ${mono ? 'money' : ''}`}>{value}</p>
      <p className="text-[0.75rem] text-ink-3">{hint}</p>
    </div>
  );
}
