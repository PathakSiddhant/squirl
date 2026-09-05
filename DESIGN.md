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

**No scrollbars, anywhere.** Every surface still scrolls by wheel, trackpad,
touch and keyboard; only the bar is hidden, on the page and on every inner
scroller. The chrome here is hairlines and negative space, and a grey rail down
the side of a panel belongs to neither. Nothing reserves a scrollbar gutter
either: a bar with no width cannot shift the layout when content grows, which is
the only thing the gutter was for.

The corollary is that scrollable regions must be legible as scrollable without
one. A cut-off row or a fading edge has to do that work, so content is never
allowed to end exactly on the fold.

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

### The launcher runs slower than the product

The launcher keeps its own pair of durations, `--t-hover: 420ms` and
`--t-settle: 640ms`, with a spring that overshoots by about four percent. The
product's 120 and 180ms are right for a control acknowledging a click and wrong
for a surface answering a pointer: at 180ms a tile has finished lifting before
the eye has finished arriving, so it reads as a flicker rather than a response.
Nothing on this screen is urgent. It is the pause before the work.

Two things deliberately opt out of those durations, and both for the same
reason: they track the pointer continuously rather than responding to it once.
A tile's tilt follows the cursor at `90ms linear`, and the dock's magnification
at `70ms linear`, because a value being chased on a 420ms curve arrives a third
of a second late and the whole surface feels like syrup. The slow spring is
kept for the way out, where there is nothing to chase.

### Beware which property Tailwind v4 animates

`translate-x-*`, `scale-*` and `rotate-*` compile to the standalone `translate`,
`scale` and `rotate` properties, not to `transform`. Those compose with
`transform` rather than replacing it, which has bitten this codebase twice: a
keyframe that also wrote `transform: translate(-50%, -50%)` on a centred dialog
applied the offset a second time and flew the panel in from the corner. If an
element is positioned by a Tailwind translate utility, an animation on it owns
`transform` only, and must use it for scale and rotation alone.

## States

Empty, loading and error states are shipped, not deferred. Loading uses skeletons
shaped like the content that replaces them, so nothing reflows. Empty states name
the next action.

## Copy

Plain, lowercase-friendly, never moralising. Numbers over adjectives. No
em-dashes anywhere in the interface. Rupees are written `₹1,240` with Indian
digit grouping.

## Application accents

Squirl hosts applications, and the design system has to let you tell which one
you are standing in without breaking the thesis above.

One slot does that work: `--app-accent`, with `--app-accent-deep` and
`--app-accent-wash` beside it. Squirl leaves it as the acorn. Each application
overrides it in a single class, applied on that application's layout, so
everything nested inside inherits it.

| Application | Accent | Light | Dark |
|---|---|---|---|
| Squirl itself | acorn | `oklch(0.68 0.087 66)` | `oklch(0.75 0.095 68)` |
| Ledger | forest | `oklch(0.42 0.045 165)` | `oklch(0.74 0.045 158)` |
| Form | flame | `oklch(0.55 0.2 30)` | `oklch(0.69 0.19 33)` |
| Signal | signal blue | `oklch(0.5 0.14 262)` | `oklch(0.72 0.13 264)` |

Ledger's green is sampled from its own mark, whose body reads
`oklch(0.374 0.028 175)` and whose pages read `oklch(0.82 0.025 147)`. That is
a genuinely desaturated green and it is kept that way. Raising the chroma to
make it "pop" would put a second loud colour next to money data that has
already earned its palette. Form's flame is sampled the same way, off the
match it draws.

Signal's is the exception: nothing in its own mark sat more than about ten
degrees from a hue already claimed, the chair and cherry crowding Form's 30
and the crown nearly sitting on Squirl's own acorn at 66. Taking any of them
would make the accent say "Form" or "nothing in particular" instead of
"Signal", which is the one job the token has, so this hue is held rather than
found: a blue with nothing else on the wheel near it.

An accent is allowed in exactly four places:

- the application's mark tile, on its launcher row and in its own header
- the selected row of that application's navigation, as a wash plus the icon
- the hairline under an application on the launcher, when you reach for it
- a focus ring inside that application, where ink would be ambiguous

It is never allowed on data, on a chart series, on a button fill, or on
anything chosen to look nice. **Colour is data; chrome is ink** still holds.
The accent is the one piece of chrome that is allowed to say *where*, because
"which application am I in" is genuine information rather than decoration.

## The threshold

The lock screen is the one surface in Squirl that is a picture rather than a
tool, and it is designed as a place instead of a form.

A landscape fills the left, and the panel you sign in on leans into it across a
curve rather than a straight seam, so the two halves read as one composition
instead of a screen cut in half.

The illustration is a matched pair, day and night: same composition, same rock,
same squirrel, so moving between them never shifts anything on screen. Which
one shows is decided by two honest signals and nothing else, the hour resolved
in Asia/Kolkata on the server, and the theme.

Those two can disagree, so they are ranked. **A theme chosen by hand wins; the
hour only decides when the theme is left on System.** Someone who picked Light
at eleven at night asked for a light screen and gets one. The rule is worth
stating because the obvious implementation gets it wrong: pinning the night
picture on by the clock alone leaves the theme control unable to reach the one
screen it is most visible on, which is a setting that visibly does nothing.

Nothing announces the hour and there is no control for it. It is meant to be
felt, not read.

The only motion is a wide, soft light crossing the valley on a slow loop. It
replaced a parallax that drifted the whole frame under the pointer: that needed
the picture scaled up past its own edges to have somewhere to drift to, so the
illustration was permanently cropped to pay for an effect you only saw while
moving the mouse. The light costs no crop and runs whether or not anyone
touches anything.

Two things this screen is allowed that the rest of the product is not:

- **A saturated fill.** `--cta` carries the Unlock button and one word inside
  each headline. It is a deeper orange than it wants to be, because the bright
  version of that hue reaches about 3.2:1 against white and a button label has
  to clear 4.5:1.
- **A serif.** One transitional face, on the two headlines only. It pairs with
  Geist on a real contrast axis, where a second sans would be two typefaces
  doing one job.

When the night picture is the one showing, it is near-black where the headline
sits, so `.over-art` inverts the ink ramp for that subtree rather than
hard-coding white into the markup, and `.mark-over-art` punches the mark out
white. Both are keyed to the picture that actually won rather than to the hour,
because inverting on the hour alone puts white type on the day picture every
time a reader chooses Light after dark. The fields drop the base focus
outline for the accent: border and a soft ring. That outline is right inside
Ledger, where focus must be unmistakable against dense content, and wrong on a
quiet panel where it reads as the browser's own default.
