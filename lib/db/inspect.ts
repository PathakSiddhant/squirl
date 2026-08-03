import { formatMoney } from '../money';
import { getOverview } from '../queries/overview';
import { standingsByPerson } from '../queries/debts';

/**
 * Prints the whole position to the terminal.
 *
 * Useful on its own, and it is how the query layer gets verified against a
 * real database rather than against assumptions.
 */
async function main() {
  const o = await getOverview();
  const p = o.position;

  const line = (label: string, value: string) => console.log(`  ${label.padEnd(24)} ${value.padStart(14)}`);

  console.log(`\nHISAAB, as of ${o.asOf}\n${'-'.repeat(42)}`);
  line('in hand', formatMoney(p.inHand));
  line('parked with parents', formatMoney(p.parked));
  line('owed to me', formatMoney(p.owedToMe));
  line('i owe', formatMoney(p.iOwe));
  line('net worth', formatMoney(p.netWorth));
  console.log(`${'-'.repeat(42)}`);
  line('committed', formatMoney(p.committed));
  line('buffer', formatMoney(p.buffer));
  line('SAFE TO SPEND', formatMoney(p.safeToSpend));
  console.log(`${'-'.repeat(42)}`);
  line('daily burn', formatMoney(o.runway.dailyBurn));
  line('runway', o.runway.days === null ? 'no spending yet' : `${o.runway.days} days`);
  line('a day until next money', formatMoney(o.allowance.perDay));
  line('logging streak', `${o.streak} days`);

  console.log('\naccounts');
  for (const account of o.accounts) {
    line(`  ${account.name} (${account.kind})`, formatMoney(o.balances.get(account.id) ?? 0));
  }

  console.log('\npeople');
  for (const standing of standingsByPerson(o.debts, o.asOf)) {
    const verdict =
      standing.net > 0 ? `owes you ${formatMoney(standing.net)}` :
      standing.net < 0 ? `you owe ${formatMoney(-standing.net)}` : 'settled';
    line(`  ${standing.person.name}`, verdict);
  }

  console.log('\nloans');
  for (const entry of o.loans) {
    line(
      `  ${entry.loan.lender} ${entry.paidCount}/${entry.schedule.length}`,
      `${formatMoney(entry.remainingTotal)} left`,
    );
    console.log(
      `      principal ${formatMoney(entry.loan.principal)}, interest ${formatMoney(entry.totalInterest)}, effective APR ${entry.effectiveApr?.toFixed(1)}%`,
    );
  }

  console.log('\ndue inside the horizon');
  if (o.dueSoon.length === 0) console.log('  nothing');
  for (const c of o.dueSoon) {
    line(`  ${c.dueOn} ${c.label}${c.isOverdue ? ' (overdue)' : ''}`, formatMoney(c.amount));
  }

  console.log(`\ntoday: in ${formatMoney(o.todayIn)}, out ${formatMoney(o.todayOut)}, ${o.todayEntries.length} entries`);

  // The identity the whole model rests on. If this ever fails, something is wrong.
  const identity = p.inHand + p.parked + p.owedToMe - p.iOwe;
  console.log(`\nnet worth identity: ${identity === p.netWorth ? 'holds' : 'BROKEN'}`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
