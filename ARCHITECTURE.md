# Squirl, architecture

Squirl is a local-first personal software environment. It hosts focused
applications. Money is the first one, and it is called **Ledger**.

This document exists so that adding the second application is a matter of
adding a directory, not of renegotiating what Squirl is.

## The two levels

Every decision belongs to exactly one of these. Confusing them is the main way
a product like this rots.

| | Squirl | An application |
|---|---|---|
| Owns | identity, shell, lock, theme, storage location, backup | its own domain model, workflows, vocabulary, screens |
| Knows about | that applications exist, and how to list them | itself only |
| Must never | contain domain logic for any one application | reach into another application's tables or types |

Squirl knows Ledger exists. Ledger does not know Squirl has other plans.

## Layout

```
app/
  layout.tsx              root: fonts, theme, toasts, the boot sheet
  lock/                   the threshold. the only route outside the gate.
  (squirl)/
    layout.tsx            the session gate
    page.tsx              Squirl's home, the launcher
    ledger/               one application, self-contained
      layout.tsx          Ledger's own shell, and its accent
      page.tsx            Today
      history/ accounts/ repeating/
      people/ loans/
      insights/ progress/ guide/ settings/
    signal/               the second, equally self-contained
      layout.tsx          Signal's own shell, its own type, its own accent
      page.tsx            the inbox
      channels/           the shelf
  actions/                server actions, validated at the boundary
instrumentation.ts        starts Signal's scheduler when the server starts

lib/
  squirl/                 the platform. small on purpose.
    apps.ts               the registry of installed applications
    session.ts            the local lock
  db/                     storage infrastructure, shared
  date.ts  cn.ts          genuinely generic utilities
  money.ts                Ledger's, living here only because nothing else
  domain/  queries/       Ledger's domain. Moves under a ledger/ folder the
                          day it collides with something, and not a day
                          earlier: Signal took its own folder instead of
                          forcing a rename that bought nothing.
  signal/                 Signal's domain, in its own folder from day one
    youtube.ts            the only egress. Zod-validated at the edge.
    sync.ts  scheduler.ts the fetch, and the loop that drives it
    queue.ts  channels.ts what is waiting, and who is watched
    intelligence.ts       optional model call, never on a correctness path
    keys.ts  epoch.ts     key pools, and the baseline

components/
  squirl/                 the launcher, and the screens outside every app
    launcher.tsx          the three columns, and what they are arranged for
    orbit.tsx             the applications, going round, in three dimensions
    app-tile.tsx          one application's door
    dock.tsx              the controls, mounted to a wall of the window
    console-panel.tsx     the clock, and the machine's own figures
    command-palette.tsx   Ctrl-K, over every screen in the product
    storage-sheet.tsx     where the data lives, and which keys do what
    lock-screen.tsx       the threshold
  shell/                  an application's own shell: sidebar, nav, theme
  brand/                  the marks, Squirl's and each application's
  ui/                     primitives any application may use
  today/ ledger/ people/ loans/ …   Ledger's own feature components
  signal/                 Signal's own: inbox, content-row, channel-board
```

Squirl has no settings screen of its own yet. Each application's preferences
live inside it, and everything Squirl-level, the theme, the lock, and where the
database file sits, is reachable from the dock on its home. A Squirl-level
settings page gets built when there is a second thing to put on it, rather than
now, to look symmetrical.

### Background work belongs to the application, not to the platform

Signal is the first application that needs something to happen while nobody is
looking at it. It got a scheduler of its own, started from `instrumentation.ts`
and held on `globalThis` so a dev-server reload does not leave two of them
running. Squirl did not grow a job runner for it.

That is rule 1 applied to time rather than to code: a platform-level scheduler
built for one application's three-hour loop would be an abstraction invented
before the second use exists. If Form later needs its own timer, the two get
compared and the shared thing gets written then, from two real cases instead of
one and a guess.

The loop is deliberately dumb. It has no queue, no retry table and no
persistence: an interval, an exponential backoff on failure, and a checkpoint
per channel in the application's own table. Everything it would otherwise need
to remember is already durable in the data it syncs.

### The launcher has no rail and no corners

Squirl's home used to be a rail of application icons down the left plus a grid
of cards. That is the shape every tool on a laptop already has, and it is also
the shape that fails first: it draws every destination at all times, so the
fourth and fifth application turn the rail into a column with its own scrollbar.
A launcher whose own navigation needs scrolling has stopped being a launcher.

What replaced it is three columns and a dock.

- **The identity, on the left.** The lockup, the hour said out loud, and the
  claim the product rests on. It anchors the composition rather than hovering
  over it: centred above the orbit, the same three lines read as something
  wedged into the gap above the rings, and left both sides of the window empty.
- **The orbit, in the middle, as the subject.** Squirl's own model drawn
  literally: the mark is the environment, each body going round it is an
  installed application in its own colour, and built ones ride the inner ring
  because those are the ones you reach for. It is dimensional rather than a
  flat ring pretending, and it can be pushed. Three rings are drawn whether or
  not they are occupied, so the fifth application arrives into a place that
  already exists rather than forcing the picture to be redrawn.
- **The machine's own figures, on the right.** A running clock, how many
  applications are installed, how many are real, how large the file has got and
  when it was last written. Squirl reporting on Squirl. This is the line that
  keeps the column honest: an application's own numbers belong on its tile, and
  a launcher that grows a panel of Ledger's figures has quietly become Ledger's
  dashboard.
- **One tile per application**, all the same size, built or not. A tile says
  whether its application wants you; it does not try to be the application.
- **A dock**, taken out of the page and given to the window. In the layout it
  cost height whether or not it was being used; fixed, it costs none. It can be
  dragged to any of the four walls and settles centred on the one it was
  dropped nearest, upright on the left and right.

Two things are deliberately absent. There is no search field, because Ctrl-K
opens the palette and a permanent input would spend the best space on the
screen implying a catalogue too big to look at. And nothing on this screen
announces its own shortcuts along the bottom; the keys are written down in the
panel behind the dock's info button, which is the place you go when you want to
be told.

The whole screen fits without scrolling, at laptop heights as well as monitor
ones. The orbit is what gives up room when the window is short, because it is
the one element here that can afford to.

## Rules

**1. Extract to shared only on the second real use.**
Not the first, not the hypothetical. `lib/money.ts` is Ledger's, and it stays
where it is until a second application genuinely needs money formatting. Moving
it to a "core" now would be guessing.

**2. No universal object.**
There is no generic `Item` or `Entity` table that all future applications
inherit. Ledger has `transactions`, `accounts`, `debts`, `loans` because those
are the real nouns of money. The next application gets its own real nouns. A
shared abstraction invented before the second domain exists would be fiction.

**3. One database file, separate tables.**
`data/squirl.db` holds everything, because one file is one thing to back up and
one thing to own. Applications never share tables. A table belongs to exactly
one application, and the application prefix in migrations makes that visible.
Signal's five tables are all `signal_*` and Form's twelve are all `form_*`; Ledger has never heard of either.

**4. An application must be removable.**
Deleting `app/(squirl)/ledger/` and its tables must leave Squirl running. If
removing an application breaks the shell, something leaked upward. Signal is
the test that this held: it was added without touching the launcher, the lock
or the shell, and removing it means deleting its route, its `lib/signal/`
folder, its `signal_*` tables and its registry entry.

**5. The registry is the only coupling.**
`lib/squirl/apps.ts` is how Squirl learns an application exists: a name, an
icon, a route, and optionally one live figure for its card. That is the entire
contract. Squirl does not import an application's domain logic: the registry
entry imports *from* the application, dynamically, inside the snapshot
function, so the launcher never pulls a domain into its own bundle.

**6. Egress goes through one file per service.**
Ledger has no network at all. Signal talks to two external services from
`lib/signal/youtube.ts` and `lib/signal/intelligence.ts`, and Form talks to two
from `lib/form/intelligence.ts` and `lib/form/food-image.ts`, and nowhere
else, with every response validated by Zod at the boundary and every image URL
checked against an allowlist of hosts before it reaches a component. An
application that reaches the network from wherever happens to be convenient has
no boundary left to audit.

## Form, and what the third application proved

Signal was the test that the platform rules held for a second application. Form
was the test that they hold when the domain is genuinely unlike the first two,
and it was added the same way: a `lib/form/` folder, a `form_*` table prefix, a
route group, and one entry in `lib/squirl/apps.ts`. Nothing in Squirl, Ledger or
Signal was touched to make room for it.

### Its own units, for the same reason Ledger has its own

Form stores everything in integer fine units — grams, millimetres, millilitres,
milli-kcal, milligrams, and milli-units for a portion. This is Ledger's paise
argument applied to a different domain: 68.5 g of a per-100 g food is exact
integer arithmetic, and a day's totals are the sum of its rows rather than a
float that has drifted away from them.

`lib/form/units.ts` is both the parser and the formatter, and that pairing is
load-bearing. The interface previews a value using the same function the server
will store it with, so a field that showed `72.5 kg` cannot save something else.

### Nutrition is never typed, only summed

`form_entries` holds one directly-logged metric per day — water, creatine,
movement, sleep. Calories and macros are deliberately absent from it. They are
sums over `form_food_logs`, so a day's total and the things it is made of can
never disagree, and there is no way to type a calorie figure that contradicts
the food underneath it.

Weight is a third table again. It is a measurement of the body rather than a
thing done with a day, and keeping it apart is what stops the completion logic
from ever being tempted to score a missed weigh-in as a missed target.

### Judgement is a pure function

`lib/form/day.ts` takes the rules in force, the readings, and whether the day is
over, and returns a verdict. It touches no database and knows no metric by name:
which metrics count comes from the phase's configuration, passed in. Turning
carbohydrate off does not hide a column, it removes the metric from the
judgement entirely.

The historical part sits in the same file. `targetsOn()` resolves the targets
that applied on a given day from the target-history rows, so completion is never
judged against current configuration. That single function is what makes "the
past keeps meaning what it meant" mechanical rather than aspirational.

### The model is asked for prose, never for a verdict

`lib/form/feasibility.ts` decides whether a goal is sane from a table of rates,
deterministically and offline. `lib/form/intelligence.ts` asks Gemini to phrase
that verdict in one sentence, and the action layer splits the two so the
interface can show the verdict instantly and let the sentence arrive when it
arrives. If the key is missing, the network is down or the response is malformed,
a sentence written in code is used and the verdict is byte-for-byte the same.

This is the same rule Signal follows for filing channels, and it is worth
stating as a rule: **a model may write a sentence about a decision, and may
never make one.**

### Egress, again through one file

Form reaches the network from exactly two places. `lib/form/intelligence.ts` for
the sentence above, and `lib/form/food-image.ts`, which asks Wikipedia for a
photograph of a food. Both fail silently into a working application: no
sentence, or no photograph, and nothing else changes.

Food photographs are downloaded once and stored inline in the row as a `data:`
URL rather than kept as a link or a file path. A link makes the library go blank
on a train; a path puts half of a food in the database and half of it on disk,
so copying `squirl.db` stops copying everything. Inline bytes keep a food a
single row.

## The design contract

**Every application looks like itself.** Squirl is not a design system that
applications are poured into. It owns the threshold, the launcher and the
frame around them, and that is where its own look stops. Inside an
application, the type, the palette, the density, the motion and the shape
language are that application's to choose, and two applications are expected
to look genuinely different from each other rather than like two tabs of the
same product.

The bar that does not move is quality. Different must mean *considered*
different: a face chosen because the domain reads better in it, a palette
chosen because that subject has those meanings. It must never mean the
nearest default that a generator reaches for first. An application that looks
like every other dashboard has failed this contract just as surely as one that
looks like a ransom note.

What is genuinely shared is small, and it is shared because divergence would be
a bug rather than a style:

- **The tokens exist for every application to override.** `--app-accent` and
  its `-deep` / `-wash` companions are the minimum; an application is free to
  restate the ink ramp, the surfaces, the radii and the fonts inside its own
  layout class.
- **Storage, identity, the lock and the launcher registry** are Squirl's. An
  application never draws its own lock screen or invents its own place to put
  data.
- **Meaning-bearing colour stays honest.** The rule from DESIGN.md holds
  inside every application: **colour is data, chrome is ink.** Ledger keeps the
  validated money palette (in / out / owed to me / I owe / stashed) because
  that palette encodes meaning specific to money, not because it is decorative.
  Signal uses colour for two things only, a live broadcast and telling one group
  of channels from another, and derives the second from the group's own name so
  it is never a decision anyone has to store or maintain.

Signal is where this contract stopped being theory. It restates `--font-sans`
to Space Grotesk and `--font-mono` to IBM Plex Mono inside its own
`.app-signal` scope, tightens the radii, and shares nothing with Ledger's look
but the tokens it chose not to override. Put the two side by side and they do
not read as two tabs of one product, which is the point.

Squirl's own surfaces stay graphite and quiet on purpose. The shell should be
the least loud thing on screen, so that stepping into an application feels like
walking into a different room rather than opening a different tab.

## Local-first, and honest about it

No account, no server, no cloud sync, no telemetry. `data/squirl.db` is the
whole product state.

Signal reaches the network, and that is worth stating precisely rather than
hedging. It makes read-only, unauthenticated calls to YouTube's public data API
with an ordinary API key, and optionally sends a channel's **public** title and
description to Gemini to file it into a group. It never signs in as you, so it
can neither read your YouTube history nor write to it; it sends nothing about
what you watched, dismissed or ignored; and every row it fetches lands in the
same local SQLite file as everything else. Pull the network cable and the inbox
still renders in full from disk, because nothing on that screen is a request.

The lock screen is a **lock, not a security boundary.** It stops someone idly
opening the tab. It does not encrypt anything: whoever holds the machine holds
the SQLite file and can read it with any tool. Squirl says so plainly rather
than implying protection it does not provide.
