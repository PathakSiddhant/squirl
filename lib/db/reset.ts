import { db } from './client';
import {
  accounts,
  categories,
  debts,
  installments,
  loans,
  people,
  reconciliations,
  recurring,
  settings,
  transactions,
} from './schema';

/**
 * Empties every table but leaves the schema in place.
 * Order matters: children before parents, so foreign keys stay satisfied.
 */
async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('this deletes every row in your ledger.');
    console.error('re-run as: npm run db:reset -- --yes');
    process.exit(1);
  }

  await db.delete(reconciliations);
  await db.delete(transactions);
  await db.delete(installments);
  await db.delete(loans);
  await db.delete(debts);
  await db.delete(recurring);
  await db.delete(people);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(settings);

  console.log('ledger emptied. run `npm run db:seed` to start again.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
