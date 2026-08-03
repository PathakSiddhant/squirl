import { Reconcile } from '@/components/accounts/reconcile';
import { PageHeader, Panel, PanelHeader } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icon';
import { today as istToday } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { getOverview } from '@/lib/queries/overview';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accounts' };

const KIND_COPY: Record<string, { icon: string; hint: string }> = {
  bank: { icon: 'Bank', hint: 'Spendable' },
  cash: { icon: 'Coins', hint: 'Spendable' },
  wallet: { icon: 'Wallet', hint: 'Spendable' },
  parked: { icon: 'HandHeart', hint: 'Out of reach, still yours' },
};

export default async function AccountsPage() {
  const asOf = istToday();
  const overview = await getOverview(asOf);
  const { position, balances, accounts } = overview;

  const spendable = accounts.filter((a) => a.kind !== 'parked');
  const parked = accounts.filter((a) => a.kind === 'parked');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounts"
        subtitle={`${formatMoney(position.inHand)} in hand, ${formatMoney(position.parked)} parked`}
      />

      <Panel>
        <PanelHeader
          title="In hand"
          hint="Money you can actually spend right now"
          action={<span className="money text-[1.0625rem] text-ink">{formatMoney(position.inHand)}</span>}
        />
        <div className="divide-y divide-line border-t border-line">
          {spendable.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              balance={balances.get(account.id) ?? 0}
              today={asOf}
            />
          ))}
        </div>
      </Panel>

      {parked.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Parked"
            hint="Deliberately hard to reach. Counts toward net worth, never toward what is safe to spend."
            action={
              <span className="money text-[1.0625rem] text-[var(--parked-text)]">
                {formatMoney(position.parked)}
              </span>
            }
          />
          <div className="divide-y divide-line border-t border-line">
            {parked.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                balance={balances.get(account.id) ?? 0}
                today={asOf}
              />
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="rounded-md border border-line bg-surface px-4 py-3.5">
        <h2 className="text-[0.9375rem] font-semibold text-ink">Why the numbers drift</h2>
        <p className="mt-1 max-w-[68ch] text-[0.875rem] text-ink-2">
          UPI taps are easy to forget, and one missed 40 rupee chai is enough to make every figure
          here slightly wrong. Rather than pretend that never happens, check an account against
          your banking app now and then. The gap gets written into the ledger as a real entry with
          a reason, so the record stays honest instead of quietly going stale.
        </p>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  balance,
  today,
}: {
  account: { id: string; name: string; kind: string; note: string | null };
  balance: number;
  today: string;
}) {
  const copy = KIND_COPY[account.kind] ?? { icon: 'Wallet', hint: '' };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-ink-2">
          <Icon name={copy.icon} size={15} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.875rem] text-ink">{account.name}</p>
          <p className="truncate text-[0.75rem] text-ink-3">{account.note ?? copy.hint}</p>
        </div>

        <span
          className={`money shrink-0 text-[0.9375rem] ${balance < 0 ? 'text-[var(--i-owe-text)]' : 'text-ink'}`}
        >
          {formatMoney(balance)}
        </span>
      </div>

      <Reconcile
        accountId={account.id}
        accountName={account.name}
        expected={balance}
        today={today}
      />
    </div>
  );
}
