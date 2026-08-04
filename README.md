<div align="center">

<img src="brand-assets/squirl-mark.png" alt="Squirl" width="150">

# SQUIRL

**Know where you stand.**

A personal money ledger that keeps money you *spent*, money you *lent*,
and money you *stashed* as three different things, because they are.

Runs entirely on your own machine against a single file.
No account, no server, no sync, nothing leaves the device.

[The idea](#the-idea) · [What it does](#what-it-does) · [Run it](#run-it) · [Under the hood](#under-the-hood)

</div>

---

## The idea

Almost every money app tracks one number: how much you have.

That number quietly lies to you, because it treats three completely different
events as the same thing:

| You did this | A normal tracker says | What actually happened |
|---|---|---|
| Moved ₹15,000 into savings | You spent ₹15,000 | You still have it. You just made it hard to reach. |
| Lent a friend ₹1,000 | You lost ₹1,000 | You still own it. It is not with you right now. |
| Bought a ₹1,000 phone case | You spent ₹1,000 | Correct. It is gone. |

Only the third one is spending. The other two changed your **access** to money,
not the **amount** of it. Blur those together and your balance starts feeling
random: some weeks end flush, some end at zero, and nothing explains why.

Squirl refuses to blur them. A squirrel does not eat its whole hoard just
because it can reach it.

## What it does

### Five piles, never added together

|  | What it is | Counts as yours | Spendable today |
|---|---|---|---|
| **In hand** | bank, cash, wallet | yes | yes |
| **Stashed** | savings, money held by family | yes | no, by design |
| **Owed to me** | lent out, plus any interest | yes | no |
| **I owe** | borrowed money and loans | it is a debt | no |
| **Promised** | due inside the next 30 days | already counted | set aside |

Lending ₹1,000 leaves your net worth untouched and drops what is in hand by
₹1,000. That single distinction is the reason this exists, and there is a test
that fails if it ever stops being true.

### One number, and it shows its working

**Safe to spend** = in hand − everything due in the next 30 days − your buffer.

It is never asserted without proof. One tap accounts for every rupee between
the two figures and lists each obligation by name and date. An app that tells
you a number and refuses to explain it has not earned the right to be believed.

### Logging something costs less than the thing you bought

There is one text box. Type it the way you would say it out loud.

```
chai 20                    →  ₹20 spent, Chai and snacks, today
250 zomato upi             →  ₹250, Food delivery, paid by UPI
+5000 freelance            →  ₹5,000 in, Side income
lent 1000 to rahul         →  a receivable, and Rahul is created if new
rahul paid back 1000       →  a repayment against that debt, not income
moved 15000 to savings     →  a transfer, not a spend
899 netflix card 2 aug     →  backdated, method and category detected
```

It parses on every keystroke and shows you what it understood *before* you
commit. No model call, no network, no latency, and the same words always
produce the same entry. Dates handle `today`, `yesterday`, `kal`, `aaj`,
`3 days ago`, `last friday`, `2 aug`, `12/7`. Amounts handle `1.2k` and `2L`.

### Debts that behave like real life

Money between friends is messy: partial repayments, no fixed date, sometimes
interest, sometimes settled six months later. Squirl replays each debt as a
timeline rather than storing a balance, so every amount accrues from its own
day and a repayment clears interest before it touches principal, which is how
people actually settle up.

### Loans, entered the way they are actually sold

You are told *"borrow ₹1,500, pay ₹550 a month for 3 months"*, never a rate.
So that is what Squirl asks for. Then it tells you what it really costs:

> **₹1,500 repaid as ₹550 × 3 is an effective 78% a year**, not the 10% the
> headline implies, because what you owe shrinks while the payment does not.

The full instalment schedule is generated, and every upcoming payment is
subtracted from what is safe to spend today.

### It stays honest when you forget

Tap-to-pay is easy to forget, and one missed ₹40 chai makes every figure
slightly wrong. Rather than pretend that never happens, open your banking app,
type what it *actually* says, and Squirl writes the difference into your
history as a real entry with a reason. The record corrects itself instead of
slowly drifting into fiction.

### Progress worth having

A streak, a stash that grows, and milestones earned by genuinely improving your
position: a debt cleared, a loan finished, a balance checked against reality.

No XP, no levels, no daily quests, no confetti. Points would reward you for
opening an app. These only reward you for knowing where you stand. Your
best-ever streak is kept permanently, so a bad week never erases a good month.

### Days, not clocks

The unit is the day, because that is what people actually ask ("what did I
spend on Tuesday"). There are no timestamps anywhere in the model, and "today"
always resolves in IST no matter what the machine thinks.

---

## Run it

You need **Node 20.9 or newer**. Nothing else. No database to install, no
Docker, no API keys, no sign-up.

```bash
git clone https://github.com/PathakSiddhant/not-your-usual-expense-tracker.git
cd not-your-usual-expense-tracker

npm install
npm run setup     # creates the file, applies migrations, seeds accounts and categories
npm run dev
```

Open **http://localhost:3000**.

### Want to look around before committing to it?

```bash
npm run db:demo   # four months of realistic sample data
```

That writes regular income, transfers into savings, a few hundred small
everyday expenses, two people who owe you, one you owe, and a small instalment
loan. Delete `data/squirl.db` whenever you want a clean start.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run setup` | Migrate and seed. The one-time first run. |
| `npm run db:demo` | Add four months of sample data |
| `npx tsx lib/db/reset.ts --yes` | Empty every table, keep the schema |
| `npm run db:studio` | Browse the raw database |
| `npm test` | Run the test suite |
| `npm run typecheck` | Type-check without building |
| `npm run build && npm start` | Production build |

### Where your data lives

One file: **`data/squirl.db`**. Copy it and you have copied your entire
financial history. Delete it and nothing of yours remains anywhere. There is no
account to close and nothing to export from a server, though Settings has a
one-click JSON export anyway.

### On your phone

Run `npm run build && npm start`, open the machine's address from your phone on
the same network, and use "Add to Home Screen". It installs as a standalone
app. Keep it on your own network: there is no login, because there is no notion
of other users.

---

## Under the hood

**Next.js 16** (App Router, Server Components, Server Actions) · **React 19** ·
**TypeScript** strict · **SQLite** via **libSQL** with **Drizzle ORM** and
versioned migrations · **Tailwind CSS v4** on a hand-built token layer ·
**Motion** · **Radix** primitives · **Geist**.

libSQL rather than `better-sqlite3` because its bindings ship prebuilt for
every platform, so `npm install` never needs a C++ toolchain.

```
lib/
  money.ts              integer paise arithmetic, Indian digit grouping
  date.ts               IST day strings, no timestamps anywhere
  domain/
    interest.ts         debt replay, simple and compound accrual
    loans.ts            instalment schedules, four models, an APR solver
    position.ts         the five piles, burn rate, runway
    capture.ts          the natural-language parser
    achievements.ts     milestones, evaluated from real position
  db/                   schema, migrations, seed, demo data
  queries/              read models composed from the pure engines above
app/
  actions/              server actions, validated at the boundary
  (app)/                Today, History, People, Loans, Accounts, Insights,
                        Progress, Guide, Settings
components/             design system and feature components
brand-assets/           logo artwork
```

Two rules hold it together:

**Nothing is stored as a running total.** Balances, debt positions and loan
liabilities are all derived from the ledger. A stored total and a ledger will
eventually disagree, and when they do there is no way to know which one lied.

**Every amount is an integer number of paise.** `0.1 + 0.2 !== 0.3`, and a
ledger that drifts by a paisa a row is a ledger nobody trusts.

### Correctness

```bash
npm test
```

The money maths is the part that has to be right, so it is tested: the float
trap, lakh grouping, leap years, interest landing on exactly one month at the
anniversary whether February had 28 days or March had 31, instalment schedules
summing back to exactly their principal, and the invariant that lending changes
what you can spend without changing what you are worth.

### Design

Charcoal and acorn, taken from the logo rather than chosen beside it. The mark
samples at `oklch(0.36 0.007 235)` and `oklch(0.68 0.087 66)`, and the whole
interface is built on those two hues.

The interface itself is deliberately achromatic. **Colour is data; chrome is
ink.** Every coloured pixel means something specific about money, so nothing is
tinted to look nice, primary buttons are solid ink rather than a brand colour,
and colour stays rare enough to still be a signal.

Money direction uses a cool/warm pair rather than green/red, so red-green
colour blindness never destroys the most important distinction in the app, and
direction is always carried by a sign glyph as well as a hue. Both themes are
validated for contrast and colour-vision separation rather than eyeballed.

Details in [DESIGN.md](DESIGN.md), and the product thinking in
[PRODUCT.md](PRODUCT.md).

---

## What it deliberately will not do

No bank sync, no cloud account, no multiple users, no receipt scanning, no
investment tracking, no hard budget limits, and no notifications telling you
off. It reports. It does not moralise.

---

## License

MIT. See [LICENSE](LICENSE). Your money, your data, your machine.
