import { Lockup } from '@/components/brand/logo';
import { Icon } from '@/components/shell/icon';
import { PageHeader, Panel } from '@/components/ui/primitives';
import { CAPTURE_EXAMPLES } from '@/lib/domain/capture';

export const metadata = { title: 'Guide' };

/**
 * The whole app, in plain words.
 *
 * Every idea here is one someone could reasonably not know: what "parked"
 * means, why lending is not spending, what the big number is actually
 * subtracting. If a concept needs explaining, it gets explained here rather
 * than in a tooltip nobody opens.
 */

const IDEAS = [
  {
    icon: 'Wallet',
    title: 'In hand',
    plain: 'Money you could spend this second.',
    detail:
      'Your bank balance, the notes in your pocket, whatever is sitting in a payment wallet. This is the only pile that answers "can I buy this right now".',
  },
  {
    icon: 'HandHeart',
    title: 'Stashed',
    plain: 'Your money, deliberately put somewhere annoying to reach.',
    detail:
      'Money moved to savings, or handed to family to hold. It is still completely yours and still counts towards what you are worth. It just does not count as spendable, which is the entire point of putting it there. Most apps call this an expense. It is not one.',
  },
  {
    icon: 'ChartBar',
    title: 'Invested',
    plain: 'Money in stocks, funds or gold. Still yours, and the value moves.',
    detail:
      'Buying shares is not spending, it is moving money from one pocket of yours to another, so your net worth does not drop when you do it. Record it as a move from your bank into an invested account. When the value changes, use "Update value" on that account and type what it is worth now. The difference is stored as a gain or a loss, never as income or spending.',
  },
  {
    icon: 'HandCoins',
    title: 'Owed to me',
    plain: 'Money you lent that has not come back yet.',
    detail:
      'Lending a friend ₹1,000 does not make you ₹1,000 poorer. You still own it. What changed is that you cannot spend it today. Squirl keeps those two facts apart, so lending never looks like a loss.',
  },
  {
    icon: 'Bank',
    title: 'I owe',
    plain: 'Money that is going to leave, whether you like it or not.',
    detail:
      'Anything you borrowed from a person, plus whatever is left on any loan. This is subtracted from what you are worth, because it genuinely is not yours.',
  },
  {
    icon: 'Receipt',
    title: 'Promised',
    plain: 'Bills and repayments falling due soon.',
    detail:
      'An instalment due in three weeks is money that is already spoken for. Squirl sets it aside before telling you what is safe to spend, so a due date never ambushes you.',
  },
];

const TABS = [
  { icon: 'House', name: 'Today', plain: 'The one screen that answers "how am I doing".' },
  { icon: 'ListDashes', name: 'History', plain: 'Everything that happened, grouped by day.' },
  { icon: 'Users', name: 'People', plain: 'Who owes you, who you owe, and by how much.' },
  { icon: 'Bank', name: 'Loans', plain: 'Formal borrowing with a repayment schedule.' },
  { icon: 'Wallet', name: 'Accounts', plain: 'Your piles of money, and a way to check them against reality.' },
  { icon: 'ChartBar', name: 'Insights', plain: 'Where it actually went, over time.' },
  { icon: 'Coffee', name: 'Progress', plain: 'Streaks and milestones you have earned.' },
];

const QUESTIONS = [
  {
    q: 'What exactly is "safe to spend"?',
    a: 'What you have in hand, minus everything due in the next thirty days, minus a small buffer you set. It is the amount you can spend today without breaking a promise you already made. Tap "How this number is built" on the home screen and it shows you every rupee of the calculation.',
  },
  {
    q: 'Why is the money I saved not counted as spendable?',
    a: 'Because you deliberately made it hard to reach. If it counted as spendable, the number would tempt you into the exact behaviour you were trying to prevent. It still counts fully towards your net worth.',
  },
  {
    q: 'I lent someone money. Why did my net worth not drop?',
    a: 'Because you did not lose anything. You swapped cash for a promise. Your "in hand" fell and your "owed to me" rose by the same amount. When they pay you back, it swaps the other way.',
  },
  {
    q: 'The app says I have less than my bank does. What now?',
    a: 'Go to Accounts and use "Check against reality". Type what your bank actually says. Squirl writes the difference into your history as a real entry, so the record corrects itself instead of slowly drifting into fiction. Missing a few small payments is normal and expected.',
  },
  {
    q: 'Do I have to type it in that exact way?',
    a: 'Not at all. The typing bar is the fast path, never the only one. Next to it there is "Add by form", which gives you every field as a normal dropdown: amount, date, account, category, how it was paid, and a note. Use whichever you prefer, and mix them freely.',
  },
  {
    q: 'How do I change or delete something I got wrong?',
    a: 'Click any entry, anywhere it appears. It opens with every field editable and a Delete button. Nothing you log is permanent, and correcting a mistake takes two clicks.',
  },
  {
    q: 'What is the difference between writing off an agreement and deleting it?',
    a: 'Writing off says "this happened and I am never getting it back". The money genuinely left, so it stays in your history and still counts against what you are worth. Deleting says "this never happened", which is what you want after a mistake or a test entry. Deleting an agreement also removes every movement recorded against it, so the money comes back into your balances. Both options sit on each agreement under People.',
  },
  {
    q: 'How do I remove a person entirely?',
    a: 'Open them on the People page and use Delete person. That erases their agreements and the movements on those agreements. If you would rather keep the history but stop seeing them, use Hide instead, which is reversible. Every destructive button asks once before it does anything.',
  },
  {
    q: 'It assumed UPI but I paid by card. How do I fix it?',
    a: 'Two ways. Say it in the line, like "899 netflix card" or "moved 1500 to investments netbanking", and it will pick that up. Or log it, click the entry, and change how it was paid. The guess is only a default, never a decision.',
  },
  {
    q: 'I typed "moved 1500 to investment" and it complained. Why?',
    a: 'Because you have no account with that name. Squirl will not invent one, since it cannot know whether you meant a new investment account, your savings, or a typo. Create the account once on the Accounts page and the same sentence will work forever after. The error now tells you exactly which accounts you do have.',
  },
  {
    q: 'What about profit on something I invested in?',
    a: 'Go to Accounts, find the invested account, and press "Update value". Type what the holding is worth today. Squirl records the difference as a gain or a loss against that account. It raises or lowers your net worth without ever pretending it was income you could spend.',
  },
  {
    q: 'What is the streak for?',
    a: 'Nothing is unlocked by it and nothing is lost by breaking it. It exists because these numbers are only as good as what you put in, and a visible streak is a decent nudge. Your best-ever streak is kept permanently, so a bad week does not erase a good month.',
  },
  {
    q: 'Where is my data?',
    a: 'In a single file on this machine, and nowhere else. There is no account, no server, no sync. Copy the file and you have copied everything. Delete it and nothing of yours remains.',
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="How this works"
        subtitle="Everything Squirl does, explained without jargon. Five minutes, once."
      />

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
          <Lockup size={92} />
          <div className="max-w-[62ch]">
            <h2 className="text-[1.0625rem] font-semibold text-ink">The one idea</h2>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-2">
              Most money apps track one number: how much you have. That number keeps lying to you,
              because it treats money you saved, money you lent, and money you spent as the same
              event. Squirl keeps them apart. A squirrel does not eat its whole hoard just because
              it can reach it.
            </p>
          </div>
        </div>
      </Panel>

      <section>
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink">The five piles</h2>
        <div className="overflow-hidden rounded-md border border-line bg-surface">
          <ul className="divide-y divide-line">
            {IDEAS.map((idea) => (
              <li key={idea.title} className="flex gap-3.5 px-4 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-ink-2">
                  <Icon name={idea.icon} size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-medium text-ink">{idea.title}</p>
                  <p className="mt-0.5 text-[0.875rem] text-ink">{idea.plain}</p>
                  <p className="mt-1 max-w-[68ch] text-[0.875rem] leading-relaxed text-ink-3">
                    {idea.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink">Writing things down</h2>
        <Panel>
          <div className="px-4 py-4">
            <p className="max-w-[68ch] text-[0.875rem] leading-relaxed text-ink-2">
              There is one input at the top of the home screen. Type the way you would say it. It
              works out the amount, the category, the date and the person on its own, and shows you
              what it decided before you commit. Nothing is sent anywhere to make that work.
            </p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {CAPTURE_EXAMPLES.map((example) => (
                <li
                  key={example}
                  className="rounded-sm border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[0.8125rem] text-ink-2"
                >
                  {example}
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-[68ch] text-[0.8125rem] text-ink-3">
              Dates understand today, yesterday, kal, aaj, 3 days ago, last friday, 2 aug and 12/7.
              Amounts understand 1.2k and 2L. Naming someone new adds them automatically. Say upi,
              card, cash or netbanking anywhere in the line to set how it was paid.
            </p>
            <p className="mt-3 max-w-[68ch] rounded-sm border border-line bg-surface-2 px-3 py-2 text-[0.8125rem] leading-relaxed text-ink-2">
              None of this is compulsory. Next to the bar there is{' '}
              <strong className="font-medium text-ink">Add by form</strong> with every field as a
              plain dropdown, and every entry can be clicked open and edited or deleted afterwards.
              The typing is a shortcut, not a rule you have to learn.
            </p>
          </div>
        </Panel>
      </section>

      <section>
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink">What each tab is for</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TABS.map((tab) => (
            <div key={tab.name} className="flex items-center gap-3 rounded-md border border-line bg-surface px-3.5 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-ink-2">
                <Icon name={tab.icon} size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.875rem] font-medium text-ink">{tab.name}</p>
                <p className="truncate text-[0.8125rem] text-ink-3">{tab.plain}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[1.0625rem] font-semibold text-ink">Questions people actually ask</h2>
        <div className="overflow-hidden rounded-md border border-line bg-surface">
          <ul className="divide-y divide-line">
            {QUESTIONS.map((item) => (
              <li key={item.q} className="px-4 py-4">
                <p className="text-[0.9375rem] font-medium text-ink">{item.q}</p>
                <p className="mt-1.5 max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-2">{item.a}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="pb-2 text-[0.8125rem] text-ink-3">
        Still stuck on something? It is one file of your own data on your own machine, so nothing
        here can be broken permanently. Experiment freely.
      </p>
    </div>
  );
}
