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
  actions/                server actions, validated at the boundary

lib/
  squirl/                 the platform. small on purpose.
    apps.ts               the registry of installed applications
    session.ts            the local lock
  db/                     storage infrastructure, shared
  date.ts  cn.ts          genuinely generic utilities
  money.ts                Ledger's, living here only because nothing else
  domain/  queries/       Ledger's domain. Moves under a ledger/ folder the
                          day a second application needs the space, and not
                          a day earlier.

components/
  squirl/                 boot sheet, lock screen, launcher rail and cards
  shell/                  the application shell: rail, tab bar, nav config
  brand/                  the marks, Squirl's and each application's
  ui/                     primitives any application may use
  today/ ledger/ people/ loans/ …   Ledger's own feature components
```

Squirl has no settings screen of its own yet. Ledger's own preferences live
inside Ledger, and everything Squirl-level, the theme, the lock, and where the
database file sits, is reachable from the command bar on its home. A
Squirl-level settings page gets built when there is a second thing to put on
it, rather than now, to look symmetrical.

### The launcher has no rail and no corners

Squirl's home used to be a rail of application icons down the left plus a grid
of cards. That is the shape every tool on a laptop already has, and it is also
the shape that fails first: it draws every destination at all times, so the
fourth and fifth application turn the rail into a column with its own scrollbar.
A launcher whose own navigation needs scrolling has stopped being a launcher.

What replaced it is three things and a dock:

- **The hour and the orbit**, side by side. The orbit is Squirl's own model
  drawn literally: the mark still in the middle, one dot per application in its
  own accent, the rings turning slowly. Built applications ride the inner ring
  because they are the ones you reach for. Hovering a dot names its application
  and draws a line back to the centre; clicking one opens it. They are side by
  side rather than stacked because stacked they cost the sum of their heights
  and the applications fell below the fold.
- **One tile per application**, all the same size, built or not. A tile says
  whether its application wants you; it does not try to be the application.
- **A dock along the foot**, spread rather than clustered: the file on the
  left, how to draw the shelf in the middle, the theme and the lock together on
  the right. Nothing sits in a corner, and the five controls are not one lump.

Two things are deliberately absent. There is no search field, because Ctrl-K
opens the palette and a permanent input would spend the best space on the
screen implying a catalogue too big to look at. And the layout switch is a
preference, not a fixture, so it is small and at the foot rather than parked
above the thing it governs.

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

**4. An application must be removable.**
Deleting `app/(squirl)/ledger/` and its tables must leave Squirl running. If
removing an application breaks the shell, something leaked upward.

**5. The registry is the only coupling.**
`lib/squirl/apps.ts` is how Squirl learns an application exists: a name, an
icon, a route, and optionally one live figure for its card. That is the entire
contract. Squirl does not import an application's domain logic.

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

Squirl's own surfaces stay graphite and quiet on purpose. The shell should be
the least loud thing on screen, so that stepping into an application feels like
walking into a different room rather than opening a different tab.

## Local-first, and honest about it

No account, no server, no sync, no telemetry. `data/squirl.db` is the whole
product state.

The lock screen is a **lock, not a security boundary.** It stops someone idly
opening the tab. It does not encrypt anything: whoever holds the machine holds
the SQLite file and can read it with any tool. Squirl says so plainly rather
than implying protection it does not provide.
