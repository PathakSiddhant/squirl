# Squirl, design system

Register: **product**. Design serves the product. The bar is earned familiarity:
someone fluent in Linear, Raycast or Stripe should trust it on first glance.

Dials: `VARIANCE 5` · `MOTION 4` · `DENSITY 6`.

## The thesis

> **Colour is data. Chrome is ink.**

The interface is achromatic: graphite ink on paper, or ink on near-black. No
gradients, no glass, no decorative tint. Every coloured pixel carries a specific
meaning about money. If something is teal, money came in. If something is rose,
you owe it. Nothing is coloured to look nice.

This is the load-bearing decision. It keeps the ledger scannable (colour is
rare, so colour is signal), and it is why the app does not look like every other
finance dashboard.

Consequences, enforced:

- Primary buttons are solid ink, not a colour.
- Focus rings are ink with a 2px offset, never a colour.
- Active navigation is weight plus a surface fill, never a coloured pill.
- No element is tinted "to look nice".

The one exception is the brand layer: the mark, the streak, and milestones use
the acorn caramel. That layer is chrome about the product rather than data about
money, and it is deliberately confined to those places.

## Scene

Checked on a phone late at night, and on a laptop under office light. Six to ten
visits a day, five seconds each. Both themes are first-class and both are
designed, not flipped. Dark is not a filter over light.

## Colour

Derived from the logo, not chosen beside it. The mark samples at
`oklch(0.36 0.007 235)` for its charcoal and `oklch(0.68 0.087 66)` for the
acorn, so the neutrals carry hue 235 and the brand warm sits at hue 66.

### Brand

| Token | Light | Dark |
|---|---|---|
| `--acorn` | `oklch(0.68 0.087 66)` | `oklch(0.75 0.095 68)` |
| `--acorn-deep` | `oklch(0.52 0.09 62)` | `oklch(0.62 0.095 64)` |

### Neutrals

| Token | Light | Dark |
|---|---|---|
| `--bg` | `oklch(0.986 0.002 235)` | `oklch(0.17 0.008 235)` |
| `--surface` | `oklch(1 0 0)` | `oklch(0.202 0.009 235)` |
| `--surface-2` | `oklch(0.966 0.003 235)` | `oklch(0.238 0.010 235)` |
| `--line` | `oklch(0.913 0.005 235)` | `oklch(0.292 0.011 235)` |
| `--line-strong` | `oklch(0.856 0.006 235)` | `oklch(0.356 0.013 235)` |
| `--ink` | `oklch(0.24 0.008 235)` | `oklch(0.96 0.003 235)` |
| `--ink-2` | `oklch(0.44 0.008 235)` | `oklch(0.76 0.008 235)` |
| `--ink-3` | `oklch(0.545 0.008 235)` | `oklch(0.64 0.010 235)` |

Every ink token clears 4.5:1 as body text against its background in both themes.

### Semantic money palette

Five roles, fixed order, never cycled and never reused for anything else.

| Role | Meaning | Light | Dark |
|---|---|---|---|
| `in` | money arrived | `#07938e` | `#00a59e` |
| `out` | money spent | `#b96a02` | `#ce7600` |
| `owed-to-me` | lent out, receivable | `#8568db` | `#9377ed` |
| `i-owe` | borrowed, loans, overdue | `#d24b58` | `#e45b67` |
| `parked` | held by parents, recallable | `#447be4` | `#538bf5` |

Both sets pass all six checks of the palette validator (lightness band, chroma
floor, CVD separation, normal-vision floor, contrast vs surface). Worst adjacent
pair under protanopia is ΔE 14.6 light / 15.9 dark, comfortably above the floor
of 8. Re-run before changing any value:

```
node scripts/validate_palette.js "#07938e,#b96a02,#8568db,#d24b58,#447be4" --mode light --surface "#fafafb"
```

In and out are a cool/warm pair rather than green/red, so red-green colour
blindness never destroys the most important distinction in the app. Direction is
additionally carried by a sign glyph, so colour is never the only encoding.

## Typography

Geist Sans for the interface, Geist Mono for every number. Sans plus mono is a
real contrast axis, and mono gives the ledger its column alignment.

All money and all dates use `font-variant-numeric: tabular-nums`. Digits must not
shift width when a value changes, or the ledger jitters.

| Role | Size | Face |
|---|---|---|
| hero amount | `clamp(2.25rem, 6vw, 3.25rem)`, tracking `-0.03em` | Mono |
| page title | 1.375rem / 1.2, 600 | Sans |
| section | 1.0625rem, 600 | Sans |
| body | 0.9375rem | Sans |
| small | 0.8125rem | Sans |
| label | 0.75rem, 500 | Sans |
| amount | inherits, 500 | Mono |

Display letter-spacing floor is `-0.03em`, never tighter. Prose is capped at 68ch.

## Shape and elevation

One radius scale, applied everywhere without exception:

`--r-1: 6px` inputs, chips, buttons · `--r-2: 10px` panels · `--r-3: 14px`
dialogs and sheets · `--r-full` avatars and dots.

Elevation is carried by hairlines, not shadows. Light mode allows a single
`0 1px 2px` at 6% ink under floating surfaces only. Dark mode uses no shadows at
all, because they do not read on near-black; it separates with `--line`.

No nested cards. Grouping is done with `divide-y` on hairlines and negative
space. Side-stripe borders are banned.

## Motion

Durations `120ms` (state), `180ms` (enter/exit), `260ms` (layout). Easing
`cubic-bezier(0.22, 1, 0.36, 1)`. No bounce, no elastic.

Motion is only used where it explains something:

- A new ledger row slides in from the day it belongs to, so you see where it landed.
- The safe-to-spend figure counts to its new value, so a change is impossible to miss.
- Sheets translate from the edge they will return to.

Every animation has a `prefers-reduced-motion: reduce` path, which is a crossfade
or an instant swap. Only `transform`, `opacity`, `filter` and `clip-path` are
animated.

## States

Empty, loading and error states are shipped, not deferred. Loading uses skeletons
shaped like the content that replaces them, so nothing reflows. Empty states name
the next action.

## Copy

Plain, lowercase-friendly, never moralising. Numbers over adjectives. No
em-dashes anywhere in the interface. Rupees are written `₹1,240` with Indian
digit grouping.
