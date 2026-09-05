# Squirl, product brief

**Squirl** is a single-user personal environment that runs on your own machine
against a local SQLite file. It holds small, focused applications rather than
being one large one.

Two are built. **Ledger** is money: what you spent, what you lent, what you owe,
and what is actually safe to spend. **Signal** is attention: what the channels
you chose have published, held as a queue that ends.

They share a file, a lock and a launcher, and nothing else. Most of this brief
is about Ledger, because it is the older and the more intricate of the two;
Signal's own brief is the section at the end.

## Ledger: who it is for

Someone whose money does not fit the shape a budgeting app expects:

- Income that arrives irregularly, or in amounts that change month to month.
- A deliberate habit of moving a large chunk somewhere hard to reach, so it does
  not get spent.
- Almost every payment made by tapping a phone, so nothing is written down.
- Constant small lending and borrowing with friends, sometimes with interest,
  often settled months later.
- The occasional small instalment loan, quoted as a monthly figure rather than
  a rate.

They are not overspending on anything dramatic. They simply have no idea where
they stand, because the one number their bank shows them cannot answer the
question.

## The problem, precisely

Three failures compound:

1. **Capture failure.** Logging a small payment has to cost less effort than the
   payment did, or it will not happen. A six-field form guarantees an empty app.
2. **Model failure.** Ordinary trackers call money moved into savings an
   *expense* and money lent a *loss*. Both are wrong. Net worth did not change;
   *access* did. No mainstream tracker separates those.
3. **Horizon failure.** A debt opens in one month and closes five months later.
   An instalment commits money that is already gone but still shows in the
   balance. Today's number has to know about tomorrow's obligations.

## The question the product exists to answer

> **How much can I spend right now, without breaking a promise I already made?**

Everything else is in service of that one number.

## Principles

1. **Day precision, never a clock.** A transaction belongs to a date. No
   timestamps appear anywhere in the interface or the model.
2. **Capture must be nearly free.** One text field, natural language, no form
   unless the user wants one. `chai 20` is a complete transaction.
3. **Lending is not spending.** Money lent leaves your pocket but stays in your
   net worth. The two must never be conflated.
4. **The future is part of the present.** A committed instalment is money
   already spent that has not left yet. It reduces what is safe to spend today.
5. **Never lecture.** No budget shaming, no nagging about categories. It
   reports; it does not moralise.
6. **Truth beats tidiness.** When the app's number and the bank's number
   disagree, it must be trivial to say so and reconcile, not hide it.
7. **Progress is earned, never granted.** Milestones mark real change in
   position. Nothing is awarded for opening the app.

## Money model

Five positions, always visible, never merged:

| Position | Meaning | Affects net worth | Spendable today |
|---|---|---|---|
| **In hand** | bank, cash, wallet | yes | yes |
| **Stashed** | moved somewhere deliberately hard to reach | yes | no |
| **Owed to me** | lent out, plus accrued interest | yes | no |
| **I owe** | borrowed money plus loan principal outstanding | negative | no |
| **Promised** | obligations due inside the horizon | already counted | subtracted |

Derived:

- `Net worth = In hand + Stashed + Owed to me - I owe`
- `Safe to spend = In hand - Promised (next 30 days) - buffer`
- `Daily allowance = Safe to spend / days until money next arrives`
- `Runway = days until In hand hits zero at the trailing burn rate`

Burn rate counts spending only. Lending, stashing and repaying a loan are not
burn, and counting them would make the runway lie.

## Naming

The squirrel is not decoration. It is the model: a squirrel gathers, stashes,
and lives off what it can reach without touching the hoard. The app's central
distinction, between money you hold and money you have deliberately put beyond
easy reach, is the same behaviour.

## Ledger's scope

**In scope:** accounts and transfers, a day-grouped ledger, natural-language
capture, people and interpersonal debt with interest, formal loans with
instalment schedules, recurring commitments, reconciliation against real
balances, insights, milestones, export and backup, installable on a phone.

**Out of scope:** multi-user, bank sync, cloud accounts, hard budget limits,
receipt OCR, investment tracking, multi-currency.

---

## Signal: the second application

### The problem, precisely

YouTube is two products wearing one interface. One of them answers "has this
person posted anything", and the other decides what you should watch next. The
second is much better funded than the first, and it wins: the subscriptions feed
is infinite, mixes Shorts and community posts in with the videos, and never
reaches a state where you are finished with it.

So the cost of checking on six creators you actually care about is an hour of
watching things you were not looking for, and the only defence anyone has is not
opening the tab.

### The question the product exists to answer

> **What have the people I chose published, and am I done with it?**

The second half is the whole design. A list that cannot be finished is a feed,
whatever it is labelled.

### Principles

1. **The queue gets shorter.** Nothing here replaces a resolved item with a
   suggestion. Every action on a row removes it.
2. **Only what you asked for.** Signal watches the channels you named. There is
   no discovery surface, no related videos, no "you might also like".
3. **Videos, live streams and premieres. Not Shorts, not posts.** Short-form is
   the part of YouTube engineered to be un-finishable, and importing it would
   import the problem.
4. **A baseline, not a backlog.** Nothing published before the moment tracking
   began is ever imported. An inbox that opens with four hundred unread items
   has already failed.
5. **No account, ever.** Signal never signs in as you. It cannot read your watch
   history and cannot write to it.
6. **No statistics about your attention.** No streaks, no "videos cleared this
   week", no completion percentage. Keeping that number is how a tool becomes a
   scoreboard, and a scoreboard is a thing you perform for.
7. **Decisions are one-way.** Done and dismissed differ only in what you meant,
   which is worth recording and worth never counting. A sync can never bring
   either back.
8. **Offline is a normal state.** The inbox renders in full from disk. Sync is
   checkpoint-based, so time spent disconnected cannot open a gap.

### Why there is no "watch later"

There was, briefly: a button that put an item back in the queue at a chosen
hour. It was removed at the point it became clear what it was for. Every other
control on a row ends the item; that one let you avoid deciding, which is
exactly the behaviour that produces a two-hundred-item backlog and exactly what
YouTube's own Watch Later already does very well. A product whose single promise
is that the list gets shorter should not ship the one control that lets it grow.

### Scope

**In scope:** explicit channels by handle or link, groups you arrange yourself,
an inbox grouped by day, live and upcoming broadcasts, background sync inside
the local process, a quota-aware fetch path, optional model-assisted filing of
new channels.

**Out of scope:** any YouTube sign-in, recommendations, watch history, comments,
playback inside Signal, Shorts, community posts, cloud sync, notifications,
gamification, and any figure describing how much you watched.
