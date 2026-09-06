'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * Fuel, drawn as a dial with a travel.
 *
 * ## Why an arc and not a circle
 *
 * A calorie target on a cut is a ceiling, and a full circle is the wrong shape
 * for a ceiling: it closes, and closing reads as completion when what actually
 * happened is that the allowance ran out. An arc has two ends. You can see the
 * distance still to go, and you can see the needle pass the end of the scale
 * without the drawing folding back on itself and lying about it.
 *
 * ## The needle is the reading
 *
 * The sweep is filled *and* a needle sits at the value, because those answer
 * different questions — how much has gone, and where exactly you are. Past the
 * end of the scale the sweep changes to the warm tone and the needle keeps
 * travelling a little further, which is information rather than a verdict.
 * Nothing here is ever red for being over.
 */
export function Arc({
  fraction,
  reading,
  unit,
  goal,
  over = false,
  unknown = false,
  size = 232,
}: {
  fraction: number;
  reading: string;
  unit?: string;
  goal?: string;
  over?: boolean;
  unknown?: boolean;
  size?: number;
}) {
  const reduceMotion = useReducedMotion();

  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // A 240-degree sweep: open at the bottom, which is where a dial's scale ends.
  const SWEEP = 240;
  const START = 150;

  const filled = Math.min(Math.max(fraction, 0), 1);
  // Overshoot is allowed to run a little past the end of the scale, but not far
  // enough to wrap around and meet the start.
  const drawn = over ? Math.min(fraction, 1.18) : filled;

  const point = (ratio: number, radius = r) => {
    const angle = ((START + SWEEP * ratio) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  };

  const track = describe(0, 1);
  const value = describe(0, drawn);

  function describe(from: number, to: number) {
    const a = point(from);
    const b = point(to);
    const large = SWEEP * (to - from) > 180 ? 1 : 0;
    return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
  }

  const tone = unknown ? 'var(--line-strong)' : over ? 'var(--form-partial)' : 'var(--app-accent)';

  /*
    The length of the drawn sweep, in user units.

    Written as a real dash length rather than left to `pathLength`, because
    `pathLength` is applied on hydration: the server sends a fully drawn arc,
    the browser paints it, and only then does the animation reset it to zero
    and sweep it back in. That flash is why the dial appeared to come from
    somewhere else. With the dash offset set as an ordinary attribute the arc
    is already empty in the markup, so it starts at the foot of the scale and
    travels to the reading, once.
  */
  const sweepLength = (r * SWEEP * drawn * Math.PI) / 180;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size * 0.88 }}>
      {/*
        `overflow-visible` is load-bearing. The tick marks and the needle are
        drawn outside the circle's radius, and an SVG clips to its own box by
        default — so the right-hand side of every dial was being cut off.
      */}
      <svg
        width={size}
        height={size}
        className="absolute inset-x-0 top-0 overflow-visible"
        aria-hidden="true"
      >
        <path
          d={track}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Ticks around the scale, so an empty dial still reads as an instrument. */}
        {Array.from({ length: 13 }, (_, i) => {
          const at = i / 12;
          const outer = point(at, r + stroke / 2 + 5);
          const inner = point(at, r + stroke / 2 + (i % 3 === 0 ? 12 : 9));
          return (
            <line
              key={i}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="var(--line)"
              strokeWidth={i % 3 === 0 ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}
        {/*
          Not drawn at all when there is nothing to draw.

          A zero-length path with a round cap is not invisible — it renders as a
          filled dot of one stroke width, which put a stray red bead at the foot
          of every empty dial.
        */}
        {drawn > 0.005 ? (
          <motion.path
            d={value}
            fill="none"
            stroke={tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={sweepLength}
            strokeDashoffset={reduceMotion ? 0 : sweepLength}
            initial={reduceMotion ? false : { strokeDashoffset: sweepLength }}
            animate={{ strokeDashoffset: 0 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
            }
          />
        ) : null}

        {/*
          The needle: a bead riding the scale, drawn on top of both.

          Absent at zero. A bead sitting alone at the start of an empty arc
          read as a stray dot that had come off something, and there is nothing
          for it to mark until the day has some fuel in it.
        */}
        {!unknown && drawn > 0.005 ? (
          /*
            The needle rides the scale rather than appearing at the end of it.

            Drawn once at angle zero and carried round by a rotation of the
            group, so its path is the arc itself — it leaves the foot of the
            scale with the sweep and arrives with it.
          */
          <motion.g
            initial={reduceMotion ? false : { rotate: START }}
            animate={{ rotate: START + SWEEP * drawn }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
            }
            style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }}
          >
            <circle
              cx={cx + r}
              cy={cy}
              r={stroke / 2 + 3}
              fill="var(--surface)"
              stroke={tone}
              strokeWidth={3.5}
            />
          </motion.g>
        ) : null}
      </svg>

      <div className="absolute inset-x-0 top-[38%] flex flex-col items-center">
        <span className="form-figure text-[clamp(2.25rem,6vw,3rem)] leading-none text-ink">
          {reading}
          {unit ? <span className="ml-1.5 text-[1rem] text-ink-3">{unit}</span> : null}
        </span>
        {goal ? <span className="mt-2.5 text-[0.8125rem] text-ink-3">of {goal}</span> : null}
      </div>
    </div>
  );
}
