# Hisaab, design system

Register: **product**. Design serves the product. The bar is earned familiarity:
someone fluent in Linear, Raycast or Stripe should trust it on first glance.

Dials: `VARIANCE 5` · `MOTION 4` · `DENSITY 6`.
Density is high on purpose. The user asked to see everything at once.

## The thesis

> **Color is data. Chrome is ink.**

The interface itself is achromatic: graphite ink on paper, or ink on near-black.
There is no brand accent, no purple button, no gradient. Every coloured pixel in
the app carries a specific meaning about money. If something is teal, money came
in. If something is rose, you owe it. Nothing is coloured for decoration.

This is the load-bearing decision. It makes the ledger scannable at a glance
(color is signal, so color is rare), and it is the reason the app does not look
like every other finance dashboard.

Consequences, enforced:

- Primary buttons are solid ink, not a colour.
- Focus rings are ink with a 2px offset, never a colour.
- Active navigation is weight and an ink rule, never a coloured pill.
- No element is tinted "to look nice".

## Scene

Checked on a phone at 11pm in a dim room, and on a laptop under office light at
3pm. Six to ten visits a day, five seconds each. Both themes are first-class and
both are designed, not flipped. Dark is not a filter over light.

## Color

Authored in OKLCH. Neutrals are cooled toward hue 265 at very low chroma, so the
greys read as graphite rather than warm paper. The warm cream/sand band is
deliberately avoided.

### Neutrals

| Token | Light | Dark |
|---|---|---|
| `--bg` | `oklch(0.985 0.001 265)` | `oklch(0.165 0.008 265)` |
| `--surface` | `oklch(1 0 0)` | `oklch(0.196 0.009 265)` |
| `--surface-2` | `oklch(0.965 0.002 265)` | `oklch(0.232 0.010 265)` |
| `--line` | `oklch(0.912 0.004 265)` | `oklch(0.285 0.010 265)` |
| `--line-strong` | `oklch(0.855 0.005 265)` | `oklch(0.350 0.012 265)` |
| `--ink` | `oklch(0.22 0.012 265)` | `oklch(0.96 0.003 265)` |
| `--ink-2` | `oklch(0.44 0.010 265)` | `oklch(0.76 0.008 265)` |
| `--ink-3` | `oklch(0.545 0.009 265)` | `oklch(0.64 0.010 265)` |

Measured contrast against `--bg`: ink 16.6:1 / 17.2:1, ink-2 7.4:1 / 9.0:1,
ink-3 4.76:1 / 5.72:1. Every ink token clears 4.5:1 as body text in both themes.

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
