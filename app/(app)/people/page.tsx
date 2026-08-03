import { Users } from '@phosphor-icons/react/dist/ssr/Users';

import { NewDebtForm } from '@/components/people/new-debt-form';
import { PersonCard, type PersonView } from '@/components/people/person-card';
import { Empty, PageHeader } from '@/components/ui/primitives';
import { today as istToday } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { debtTotals, getDebtsWithPositions, standingsByPerson } from '@/lib/queries/debts';
import { getAccounts, getPeople } from '@/lib/queries/reference';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'People' };

export default async function PeoplePage() {
  const asOf = istToday();
  const [entries, accounts, people] = await Promise.all([
    getDebtsWithPositions(asOf),
    getAccounts(),
    getPeople(),
  ]);

  const standings = standingsByPerson(entries, asOf);
  const totals = debtTotals(entries);
  const net = totals.owedToMe - totals.owedByMe;

  const views: PersonView[] = standings.map((standing) => ({
    id: standing.person.id,
    name: standing.person.name,
    net: standing.net,
    owedToYou: standing.owedToYou,
    youOwe: standing.youOwe,
    hasOverdue: standing.hasOverdue,
    debts: standing.openDebts.map((entry) => ({
      id: entry.debt.id,
      direction: entry.debt.direction,
      openedOn: entry.debt.openedOn,
      dueOn: entry.debt.dueOn,
      interestKind: entry.debt.interestKind,
      rateBpsPerMonth: entry.debt.rateBpsPerMonth,
      note: entry.debt.note,
      outstandingPrincipal: entry.position.outstandingPrincipal,
      accruedInterest: entry.position.accruedInterest,
      payoffTotal: entry.position.payoffTotal,
      principalAdvanced: entry.position.principalAdvanced,
      totalRepaid: entry.position.totalRepaid,
    })),
  }));

  const spendable = accounts
    .filter((a) => a.kind !== 'parked')
    .map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="People"
        subtitle={
          entries.length === 0
            ? 'Money between you and everyone else'
            : net === 0
              ? 'You are square with everyone'
              : net > 0
                ? `${formatMoney(net)} is owed to you overall`
                : `You owe ${formatMoney(-net)} overall`
        }
        action={<NewDebtForm people={people.map((p) => ({ id: p.id, name: p.name }))} accounts={spendable} today={asOf} />}
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        <Stat label="Owed to you" value={formatMoney(totals.owedToMe)} tone="text-[var(--owed-me-text)]" />
        <Stat label="You owe" value={formatMoney(totals.owedByMe)} tone="text-[var(--i-owe-text)]" />
        <Stat label="Interest earned" value={formatMoney(totals.interestEarned)} tone="text-ink-2" />
        <Stat label="Interest paid" value={formatMoney(totals.interestPaid)} tone="text-ink-2" />
      </div>

      {views.length === 0 ? (
        <div className="rounded-md border border-line bg-surface">
          <Empty
            icon={<Users size={22} />}
            title="Nobody owes anybody yet"
            body='When you lend or borrow, record it here so it stops living in your head. You can also just type "lent 500 to rahul" into the capture bar.'
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {views.map((person) => (
            <PersonCard key={person.id} person={person} accounts={spendable} today={asOf} />
          ))}
        </div>
      )}
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
