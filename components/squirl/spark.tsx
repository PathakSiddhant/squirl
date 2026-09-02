import { cn } from '@/lib/cn';

/**
 * A small series, drawn as a line over its own area.
 *
 * `preserveAspectRatio="none"` plus a non-scaling stroke is what lets this
 * stretch to whatever width the card gives it while keeping a hairline of an
 * even weight. The line draws itself in once on mount, which is the only
 * animation here: it says "this is live data" without anything moving
 * afterwards.
 *
 * A flat series is still drawn, along the bottom, rather than collapsing to
 * nothing. An application with no activity yet should look quiet, not broken.
 */
export function Spark({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;

  const peak = Math.max(...values, 1);
  const step = 100 / (values.length - 1);
  const points = values.map((value, index) => [index * step, 100 - (value / peak) * 92]);

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L100,100 L0,100 Z`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('h-full w-full overflow-visible', className)}
    >
      <path d={area} className="spark-area fill-[var(--app-accent)]" />
      <path
        d={line}
        pathLength={1}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="spark-line stroke-[var(--app-accent)]"
      />
    </svg>
  );
}
