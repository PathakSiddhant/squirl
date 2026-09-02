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
  squirl/                 boot sheet, lock screen
  shell/                  the application shell: rail, tab bar, nav config
  brand/                  the marks, Squirl's and each application's
  ui/                     primitives any application may use
  today/ ledger/ people/ loans/ …   Ledger's own feature components
```

Squirl has no settings screen of its own yet. Theme and lock live in the
launcher header, and Ledger's own preferences live inside Ledger. A
Squirl-level settings page gets built when there is a second thing to put on
it, rather than now, to look symmetrical.

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

Squirl provides the neutral chrome: graphite ink, hairlines, the type scale,
the motion curves, the primitives. This is shared and applications should not
fight it.

Each application provides its own **accent**, exposed as `--app-accent`, and
its own semantic colours where its domain demands them. Ledger sets forest
green as its accent and keeps the validated money palette (in / out / owed to
me / I owe / stashed) because that palette encodes meaning specific to money.

The rule from DESIGN.md still holds inside every application: **colour is data,
chrome is ink.** An accent identifies an application; it does not decorate it.

## Local-first, and honest about it

No account, no server, no sync, no telemetry. `data/squirl.db` is the whole
product state.

The lock screen is a **lock, not a security boundary.** It stops someone idly
opening the tab. It does not encrypt anything: whoever holds the machine holds
the SQLite file and can read it with any tool. Squirl says so plainly rather
than implying protection it does not provide.
