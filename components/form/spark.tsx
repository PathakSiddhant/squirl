import { smooth, type Point } from '@/lib/form/trend';

/**
 * The weight series, small, beside the figure it belongs to.
 *
 * Two lines on purpose. The raw readings are drawn faintly and the smoothed
 * trend is drawn on top, so the noise is visible without being the subject —
 * which is the whole argument of §16 rendered rather than explained. A single
 * clean line would be a claim the data does not support; only the readings
 * would be unreadable.
 *
 * Deliberately unlabelled and un-hoverable. This is a glance, not a chart; the
 * real one lives on Progress where there is room to interrogate it.
 */
export function Spark({
  points,
  width = 132,
  height = 40,
}: {
  points: Point[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const trend = smooth(points, 7);

  const values = points.map((point) => point.grams);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero and, worse, would draw a line pinned to
  // one edge. A minimum span keeps it centred and honest about being flat.
  const span = Math.max(max - min, 400);
  const pad = 3;

  const x = (index: number) => (index / (points.length - 1)) * (width - pad * 2) + pad;
  const y = (grams: number) =>
    height - pad - ((grams - min) / span) * (height - pad * 2);

  const path = (series: Point[]) =>
    series.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.grams).toFixed(1)}`).join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <path
        d={path(points)}
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={path(trend)}
        fill="none"
        stroke="var(--app-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={x(points.length - 1)}
        cy={y(trend[trend.length - 1].grams)}
        r={2.5}
        fill="var(--app-accent)"
      />
    </svg>
  );
}
