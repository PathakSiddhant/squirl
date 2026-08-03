# Hisaab, product brief

**Hisaab** (हिसाब: the reckoning) is a single-user personal money ledger. It runs
on your own machine, against a local SQLite file. Nothing leaves the device.

## The person it is built for

One person: a 22-year-old intern in India.

- Stipend of about 20,000 a month, on a date that moves around.
- Roughly 15,000 of it goes straight to their parents, deliberately, so it is out
  of reach and does not get burned. That money is **not spent**. It is parked.
- About 5,000 stays in hand for the month.
- Extra money arrives unpredictably: freelance work, a gift, a friend paying back.
- Almost every payment is UPI or card, so nothing is written down anywhere.
- Money moves between friends constantly. Lending, borrowing, sometimes with
  interest, sometimes settled three months later.
- Sometimes a small app loan: borrow 1,500, repay 550 a month for 3 months.

## The actual problem

They do not know where they stand. Not roughly, not at all. Some weeks end with
1,000 left, some end with 0, and the difference is invisible because the spending
happened in fifty untracked UPI taps.

Three failures compound:

1. **Capture failure.** Logging a 10 rupee chai has to cost less effort than the
   chai did, or it will not happen.
2. **Model failure.** A normal expense tracker calls money sent to parents an
   "expense" and money lent to a friend a "loss". Both are wrong. Net worth did
   not change; *access* to the money did. No ordinary tracker separates those.
3. **Horizon failure.** A debt opens in month 1 and closes in month 5. An EMI
   commits future money that is already gone but still shows in the balance.

## What the product must answer

The whole product exists to answer one question, correctly, at any moment:

> **How much can I actually spend right now, without breaking a promise I already made?**

Everything else is in service of that number.

## Principles

1. **Day precision, never time.** The user asked for the day, not the clock. A
   transaction belongs to a date. No timestamps in the UI.
2. **Capture must be nearly free.** One text field, natural language, no forms
   unless the user wants one. `chai 20` is a complete transaction.
3. **Lending is not spending.** Money lent leaves your pocket but stays in your
   net worth. The two numbers must never be conflated.
4. **The future is part of the present.** A committed EMI is spent money that has
   not left yet. It reduces what is safe to spend today.
5. **Never lecture.** No budget shaming, no "you overspent on food" nags. It
   reports, it does not moralise.
6. **Truth beats tidiness.** If the app's number and the bank's number disagree,
   the app must make it trivial to say so and reconcile, not hide it.

## Money model

Five positions, always visible, never merged:

| Position | Meaning | Affects net worth | Spendable today |
|---|---|---|---|
| **In hand** | bank + cash + wallet | yes | yes |
| **Parked** | sent to parents, recallable | yes | no, but reachable |
| **Owed to me** | money lent out, plus accrued interest | yes | no |
| **I owe** | borrowed from people, plus loan principal outstanding | negative | no |
| **Committed** | installments and repayments due inside the horizon | already counted | subtracted |

Derived:

- `Net worth = In hand + Parked + Owed to me - I owe`
- `Safe to spend = In hand - Committed (next 30 days) - buffer`
- `Daily allowance = Safe to spend / days remaining in horizon`
- `Runway = days until In hand hits zero at the trailing 7-day burn rate`

## Scope

**In scope:** accounts and transfers, day ledger, natural-language capture,
people and interpersonal debt with interest, app loans with installment
schedules, recurring commitments, reconciliation against real balances,
forecasting, insights, export and backup, installable on a phone.

**Out of scope:** multi-user, bank sync, cloud accounts, budgets as hard limits,
receipt OCR, investment tracking, multi-currency.
