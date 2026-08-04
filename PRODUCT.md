# Squirl, product brief

**Squirl** is a single-user personal money ledger. It runs on your own machine
against a local SQLite file. Nothing leaves the device.

## Who it is for

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

## Scope

**In scope:** accounts and transfers, a day-grouped ledger, natural-language
capture, people and interpersonal debt with interest, formal loans with
instalment schedules, recurring commitments, reconciliation against real
balances, insights, milestones, export and backup, installable on a phone.

**Out of scope:** multi-user, bank sync, cloud accounts, hard budget limits,
receipt OCR, investment tracking, multi-currency.
