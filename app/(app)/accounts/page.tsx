import { NewAccountForm } from '@/components/accounts/account-manager';
import { Reconcile } from '@/components/accounts/reconcile';
import { Icon } from '@/components/shell/icon';
import { PageHeader, Panel, PanelHeader } from '@/components/ui/primitives';
import { today as istToday } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { getOverview } from '@/lib/queries/overview';
import type { AccountKind } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accounts' };

const KIND_ICON: Record<AccountKind, string> = {
  bank: 'Bank',
  cash: 'Coins',
  wallet: 'Wallet',
  parked: 'HandHeart',
  invest: 'ChartBar',
};

export default async function AccountsPage() {
  const asOf = istToday();
  const overview = await getOverview(asOf);
  const { position, balances, accounts } = overview;

  const spendable = accounts.filter((a) => !['parked', 'invest'].includes(a.kind));
  const parked = accounts.filter((a) => a.kind === 'parked');
  const invested = accounts.filter((a) => a.kind === 'invest');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounts"
        subtitle="Every pile of money you have, and what each one is for"
        action={<NewAccountForm />}
      />

      <Panel>
        <PanelHeader
          title="In hand"
          hint="Spendable right now"
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
            title="Set aside"
            hint="Yours, deliberately hard to reach. Counts towards net worth, never towards what is safe to spend."
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

      {invested.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Invested"
            hint="Still yours. The value moves on its own, so update it whenever you check."
            action={
              <span className="money text-[1.0625rem] text-[var(--owed-me-text)]">
                {formatMoney(position.invested)}
              </span>
            }
          />
          <div className="divide-y divide-line border-t border-line">
            {invested.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                balance={balances.get(account.id) ?? 0}
                today={asOf}
                isInvestment
              />
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-md border border-line bg-surface px-4 py-3.5">
          <h2 className="text-[0.9375rem] font-semibold text-ink">Why the numbers drift</h2>
          <p className="mt-1 max-w-[68ch] text-[0.875rem] leading-relaxed text-ink-2">
            Tap-to-pay is easy to forget, and one missed ₹40 chai makes every figure here slightly
            wrong. Rather than pretend that never happens, check an account against your banking app
            now and then. The gap gets written into your history as a real entry with a reason, so
            the record stays honest instead of quietly going stale.
          </p>
        </div>

        <div className="rounded-md border border-line bg-surface px-4 py-3.5">
          <h2 className="text-[0.9375rem] font-semibold text-ink">How investments work here</h2>
          <p className="mt-1 max-w-[68ch] text-[0.875rem] leading-relaxed text-ink-2">
            Putting money into stocks is a <strong className="font-medium text-ink">move</strong>,
            not a spend, so your net worth does not drop. Record it as moving money from your bank
            into an invested account. Later, when the value has changed, use{' '}
            <strong className="font-medium text-ink">Update value</strong> and type what it is worth
            now. The difference is recorded as a gain or a loss, and never as income or spending.
          </p>
        </div>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  balance,
  today,
  isInvestment = false,
}: {
  account: { id: string; name: string; kind: AccountKind; note: string | null };
  balance: number;
  today: string;
  isInvestment?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-ink-2">
          <Icon name={KIND_ICON[account.kind]} size={15} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.875rem] text-ink">{account.name}</p>
          {account.note ? (
            <p className="truncate text-[0.75rem] text-ink-3">{account.note}</p>
          ) : null}
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
        isInvestment={isInvestment}
      />
    </div>
  );
}
