<div align="center">

<img src="brand-assets/squirl-mark.png" alt="Squirl" width="150">

# SQUIRL

**A place for software you actually own.**

Squirl is a personal workspace that runs on your own machine.
No account, no server, no sync, no telemetry. One file holds everything.

Its first application is **Ledger**, which keeps money you *spent*,
money you *lent*, and money you *put away* as three different things.

[What Squirl is](#what-squirl-is) · [The launcher](#the-launcher) · [Ledger](#ledger-the-first-application) · [Run it](#run-it) · [Under the hood](#under-the-hood)

<br>

<img src="docs/screenshots/launcher-light.webp" alt="The Squirl launcher: the mark and the hour on the left, the orbit of installed applications in the middle, the machine's own figures on the right, and a tile for each application below" width="820">

</div>

---

## What Squirl is

Most software you use is a tenant on someone else's computer. It can change
under you, start charging, start watching, or disappear. Squirl is the
opposite arrangement: it runs on your machine, against a file you can copy,
open with any SQLite tool, and delete.

That is the whole premise. Everything below follows from it.

**Squirl is not one app.** It is the environment those apps live in. It owns
the identity, the lock, the theme, where the data sits, and how it gets backed
up. Applications own their own subject: their nouns, their screens, their
vocabulary, their workflows.

That split is deliberate, and it is the thing being protected here:

|  | Squirl | An application |
|---|---|---|
| Owns | identity, shell, lock, theme, storage, backup | its domain model, screens, language |
| Knows about | that applications exist, and how to list them | itself, and nothing else |
| Never does | hold domain logic for any one app | reach into another app's data |

Squirl knows Ledger exists. Ledger does not know Squirl has other plans.

### What is inside, right now

| | Application | State | What it is for |
|---|---|---|---|
| <img src="public/brand/ledger-mark.png" width="26"> | **Ledger** | Built | Money. What you spent, what you lent, what you owe, what is safe to spend. |
| <img src="public/brand/form-mark.png" width="26"> | **Form** | Planned | Training, and what it is actually doing to you. |
| <img src="public/brand/signal-mark.png" width="26"> | **Signal** | Planned | Not decided yet. |

One of those three is real. The other two hold a place and say so, on the
screen as well as here: they show no figures, they have no route to open, and
their cards say "not built yet" rather than filling the space with a plausible
number. Signal goes further and admits its subject has not been chosen.

That is deliberate. A launcher that quietly invents data for the applications
it has not written yet teaches you not to trust the ones it has, and the first
real number to appear would not be believed.

### The rules it holds itself to

- **Local by default.** Nothing leaves the device. There is no account to make.
- **Your data is inspectable.** One SQLite file, ordinary tables, plain columns.
- **Deterministic.** The same input produces the same result. No model calls in
  anything that has to be trustworthy.
- **No dark patterns.** Nothing nags, streak-shames, or invents urgency.
- **Focused apps, not one bloated one.** A shared home, not a shared blob.
- **No premature abstraction.** There is no universal "item" every future app
  must inherit. Real domains get real nouns.
- **An app must be removable.** Delete its directory and its tables, and the
  rest keeps running.

---

## Getting in

Squirl opens on a lock screen. The default credentials are:

```
username   Siddhant_Squirl
password   LocalSquirl_123
```

Change them with `SQUIRL_USERNAME` and `SQUIRL_PASSWORD` in a `.env.local`
file, and set `SQUIRL_SESSION_SECRET` if you would rather pin the signing key
than let it be generated into `data/`.

**Be clear about what this lock is.** It stops someone idly opening the tab on
a shared desk. It is not encryption. `data/squirl.db` sits on disk in the
clear, and anyone holding the machine can read it with any SQLite browser. The
lock screen says so out loud rather than implying protection it does not
provide.

Past the lock is Squirl's home.

<img src="docs/screenshots/lock.webp" alt="The Squirl lock screen: an illustrated valley on the left, the sign-in panel leaning into it across a curve on the right" width="820">

The picture behind the sign-in is a matched pair, day and night. Which one you
get is decided by two things and nothing else: the hour, resolved in IST on the
machine, and the theme. A theme you chose by hand wins over the clock, so
picking Light at eleven at night gets you a light screen; left on System, the
hour decides. Nothing announces it and there is no control for it.

---

## The launcher

<table>
<tr>
<td width="50%"><img src="docs/screenshots/launcher-light.webp" alt="The launcher in the light theme"></td>
<td width="50%"><img src="docs/screenshots/launcher-dark.webp" alt="The launcher in the dark theme"></td>
</tr>
</table>

Squirl's home is three columns and a dock, and it is sized to be read without
scrolling at laptop heights as well as monitor ones. It answers one question,
"what do I have and does any of it need me", and then gets out of the way.

**The orbit is the product's own model of itself, drawn literally.** The mark
in the middle is the environment; each body going round it is an installed
application in its own colour; built ones ride the inner ring because those are
the ones you reach for. It is genuinely three-dimensional rather than a flat
ring pretending: bodies are placed in an orbital plane, tilted, spun about the
vertical axis and projected, so they pass behind the mark and come round the
front larger and brighter. Drag it and it spins, keeps the momentum you gave it,
and settles back to a slow drift rather than to a stop. Three rings are drawn
whether or not they are all occupied, so a fourth application arrives into a
place that was already there.

**The tiles are doors, not reports.** Each one carries a mark, a line about what
the application is for, and at most one live figure read from that application's
own data at render time. Drag a tile by its grip and the row rearranges around
it, and the order you leave it in is the order you get back. Right-click one for
the things that are not "open it".

**The dock belongs to the window, not the page.** It costs the layout no height,
it can be dragged to any of the four edges, and it settles centred on the wall
you drop it nearest, upright on the left and right. Where you left it is where
it starts. `Ctrl` `\` takes it away and brings it back.

### Keys

| Key | What it does |
|---|---|
| <kbd>Ctrl</kbd> <kbd>K</kbd> | The command palette: every application, every screen inside them, the theme, the lock |
| <kbd>Ctrl</kbd> <kbd>\\</kbd> | Hide the dock, and bring it back |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Open an application by its place in the row |
| <kbd>Esc</kbd> | Close whatever is open |

There is no search field on the screen. Three applications do not need one, and
a permanent input would spend the best space on the page implying a catalogue
too large to look at.

---

## Ledger, the first application

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

Ledger refuses to blur them. A squirrel does not eat its whole hoard just
because it can reach it.

<img src="docs/screenshots/ledger.webp" alt="Ledger's Today screen: how much is short, where the money is across five piles, what is due, and what was written down today" width="820">

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

**Safe to spend** = in hand, minus everything due in the next 30 days, minus
your buffer.

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
interest, sometimes settled six months later. Ledger replays each debt as a
timeline rather than storing a balance, so every amount accrues from its own
day and a repayment clears interest before it touches principal, which is how
people actually settle up.

### Loans, entered the way they are actually sold

You are told *"borrow ₹1,500, pay ₹550 a month for 3 months"*, never a rate.
So that is what Ledger asks for. Then it tells you what it really costs:

> **₹1,500 repaid as ₹550 × 3 is an effective 78% a year**, not the 10% the
> headline implies, because what you owe shrinks while the payment does not.

The full instalment schedule is generated, and every upcoming payment is
subtracted from what is safe to spend today.

### Subscriptions that log themselves

The ₹179 you find on a statement four days later and cannot place: that is what
this solves.

Add a subscription or auto-debit once with its amount, how often it bills, and
the date it first charged. Anything you mark as leaving on its own gets written
into your history on its due date without asking, because the bank takes it
whether you are watching or not. If your machine was off, it catches up every
missed charge the next time you open the app.

Any interval works: monthly, quarterly, every six months, yearly, weekly, or a
custom number of days, weeks, months or years, with an optional end date.
Month-end billing is handled properly, so something charged on the 31st goes
31 Jan, 28 Feb, 31 Mar, rather than slipping to the 28th forever.

Things that only *usually* go through can be left as reminders instead: they
wait on the Repeating page and ask before recording anything. Either way, every
posted charge is a normal entry you can open, edit or delete, and upcoming ones
are already subtracted from what is safe to spend.

### It stays honest when you forget

Tap-to-pay is easy to forget, and one missed ₹40 chai makes every figure
slightly wrong. Rather than pretend that never happens, open your banking app,
type what it *actually* says, and Ledger writes the difference into your
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
git clone https://github.com/PathakSiddhant/squirl.git
cd squirl

npm install
npm run setup     # creates the file, applies migrations, seeds accounts and categories
npm run dev
```

Open **http://localhost:3000** and sign in with the credentials above.

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
| `npm run brand:build` | Regenerate marks and icons from the artwork |
| `npm run build && npm start` | Production build |

### Where your data lives

One file: **`data/squirl.db`**. Copy it and you have copied everything Squirl
holds, across every application. Delete it and nothing of yours remains
anywhere. There is no account to close and nothing to export from a server,
though Ledger's settings has a one-click JSON export anyway.

### Having it always running (Windows)

Rather than starting it by hand each time, you can have it launch silently
whenever you sign in:

```powershell
npm run build
powershell -ExecutionPolicy Bypass -File scripts\windows\install-autostart.ps1
```

That drops a shortcut in your Startup folder pointing at a small VBScript
wrapper, which runs `npm start` with no console window. It uses the Startup
folder rather than Task Scheduler because creating a scheduled task needs
privileges a normal account often does not have.

- Logs go to `logs/squirl.log`
- Stop it any time: `powershell -File scripts\windows\stop-squirl.ps1`
- Undo it: `powershell -File scripts\windows\uninstall-autostart.ps1`
- Moving the project folder breaks that shortcut, since it stores an absolute
  path. Re-run the installer afterwards, or use
  `scripts\windows\rename-project-folder.ps1`, which does both.

It only runs while you are signed in, and rebuilding (`npm run build`) is still
needed after any code change.

### On your phone

Squirl is a PWA, so it installs to the home screen and opens without browser
chrome. It still runs from your computer; the phone is only the screen.

1. Start it on the computer: `npm run build && npm start`
2. Find that machine's address on your network. `npm run dev` prints it, or run
   `ipconfig` on Windows and take the Wi-Fi IPv4 address.
3. With the phone on the **same Wi-Fi**, open `http://THAT-IP:3000`
4. Android Chrome: menu, "Add to Home screen".
   iPhone Safari: share, "Add to Home Screen".

The computer has to be awake and running the app for the phone to reach it. If
the page will not load, Windows Firewall is usually the cause: allow Node.js on
private networks when it asks, or add an inbound rule for port 3000.

Away from home, put both devices on [Tailscale](https://tailscale.com) and use
the machine's Tailscale address instead. That keeps everything private without
exposing anything to the internet. Do not port forward this to the public
internet: the lock is a lock, not a security boundary.

---

## Under the hood

**Next.js 16** (App Router, Server Components, Server Actions) · **React 19** ·
**TypeScript** strict · **SQLite** via **libSQL** with **Drizzle ORM** and
versioned migrations · **Tailwind CSS v4** on a hand-built token layer ·
**Motion** · **Radix** primitives · **Geist**.

libSQL rather than `better-sqlite3` because its bindings ship prebuilt for
every platform, so `npm install` never needs a C++ toolchain.

```
app/
  layout.tsx            fonts, theme, the boot sequence
  lock/                 the threshold. the only route outside the gate.
  (squirl)/
    layout.tsx          the session gate every app route nests under
    page.tsx            Squirl's home: the applications it holds
    ledger/             one application, self-contained
      page.tsx            Today
      history/ accounts/ repeating/ people/ loans/
      insights/ progress/ guide/ settings/
  actions/              server actions, validated at the boundary

lib/
  squirl/               the platform. small on purpose.
    apps.ts               the registry of installed applications
    session.ts            the local lock
  money.ts              integer paise arithmetic, Indian digit grouping
  date.ts               IST day strings, no timestamps anywhere
  domain/
    interest.ts         debt replay, simple and compound accrual
    loans.ts            instalment schedules, four models, an APR solver
    position.ts         the five piles, burn rate, runway
    capture.ts          the natural-language parser
    recurring.ts        billing schedules, drift-free at month end
    achievements.ts     milestones, evaluated from real position
  db/                   schema, migrations, seed, demo data
  queries/              read models composed from the pure engines above

components/
  squirl/               the launcher, and the screens outside every app
    launcher.tsx          the three columns, and what they are arranged for
    orbit.tsx             the applications, going round, in three dimensions
    app-tile.tsx          one application's door
    dock.tsx              the controls, mounted to a wall of the window
    console-panel.tsx     the clock, and the machine's own figures
    command-palette.tsx   Ctrl-K, over every screen in the product
    storage-sheet.tsx     where the data lives, and which keys do what
    lock-screen.tsx       the threshold
  brand/                the marks, Squirl's and each application's
  ui/                   primitives any application may use
```

`lib/squirl/apps.ts` is the entire coupling between the shell and the things it
hosts. An application declares a name, a mark, a route, an accent, and
optionally one live figure for its card. Squirl renders that and nothing else:
it does not know what a transaction is. Adding the second application means
adding an entry there and a directory under `app/(squirl)`.

More on that split in [ARCHITECTURE.md](ARCHITECTURE.md).

Two rules hold the money side together:

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

Each application fills one slot in that system, `--app-accent`. Ledger's is the
desaturated forest green sampled from its own ledger book, and Form's is the
flame off its match. Signal's is the exception that proves the rule: every
colour in its mark landed within about ten degrees of a hue already taken, so
it was given a blue with nothing else near it rather than a sampled one that
would have made its card say "Form". An accent identifies an application, on
its tile and on the selected row of its own navigation. It never colours data,
which has already earned its palette.

Motion is held to things that explain something. A figure counts up to itself
once on arrival, so you can see it was read rather than printed. A tile tips
three degrees towards the pointer and carries a light in its own accent. A
built application's node breathes and an unbuilt one does not. Every one of
them has a `prefers-reduced-motion` path, and the launcher runs on its own
slower durations than the rest of the product, because nothing here is urgent.

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

And no app store. Squirl holds the applications built for it, not a marketplace
of other people's.

---

## License

MIT. See [LICENSE](LICENSE). Your machine, your data, your software.
