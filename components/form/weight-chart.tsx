'use client';

import { useState } from 'react';

import { daysBetween, formatDayLong } from '@/lib/date';
import { smooth, type Point } from '@/lib/form/trend';
import { weightFigure, type WeightUnit } from '@/lib/form/units';

/**
 * The weight series, at a size you can interrogate.
 *
 * Two lines, for the reason set out in `trend.ts`: the readings are drawn
 * faintly and the trend is drawn over them, so the noise stays visible without
 * being the subject. A single smooth line would be a claim the data does not
 * support, and the raw points alone would be unreadable.
 *
 * The target, where there is one, is a dotted rule rather than a filled region
 * or a coloured zone. It is a line somebody drew on purpose, not a pass mark.
 */
export function WeightChart({
  points,
  unit,
  targetG,
  height = 200,
}: {
  points: Point[];
  unit: WeightUnit;
  targetG: number | null;
  height?: number;
}) {
  const [hovered, setHovered] = useState<Point | null>(null);

  const trend = smooth(points, 7);
  const values = points.map((point) => point.grams);

  // The target belongs inside the frame when there is one, so the line does not
  // sit off the top of a chart that is otherwise correctly scaled.
  const candidates = targetG !== null ? [...values, targetG] : values;
  const min = Math.min(...candidates);
  const max = Math.max(...candidates);
  const span = Math.max(max - min, 1000);
  const padY = span * 0.12;

  const width = 640;
  const padX = 4;

  const first = points[0].day;
  const last = points[points.length - 1].day;
  const totalDays = Math.max(daysBetween(first, last), 1);

  const x = (day: string) => padX + (daysBetween(first, day) / totalDays) * (width - padX * 2);
  const y = (grams: number) =>
    height - 10 - ((grams - (min - padY)) / (span + padY * 2)) * (height - 20);

  const line = (series: Point[]) =>
    series
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.day).toFixed(1)},${y(point.grams).toFixed(1)}`)
      .join(' ');

  return (
    <figure className="w-full">
      <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-surface p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[200px] w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Weight from ${formatDayLong(first)} to ${formatDayLong(last)}`}
          onMouseLeave={() => setHovered(null)}
        >
          {targetG !== null ? (
            <line
              x1={0}
              x2={width}
              y1={y(targetG)}
              y2={y(targetG)}
              stroke="var(--app-accent)"
              strokeWidth={1}
              strokeDasharray="3 5"
              opacity={0.7}
            />
          ) : null}

          <path
            d={line(points)}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth={1.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={line(trend)}
            fill="none"
            stroke="var(--app-accent)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* One target per reading, wide enough to actually hit with a finger. */}
          {points.map((point) => (
            <g key={point.day}>
              <circle
                cx={x(point.day)}
                cy={y(point.grams)}
                r={hovered?.day === point.day ? 4 : 0}
                fill="var(--app-accent)"
              />
              <rect
                x={x(point.day) - 8}
                y={0}
                width={16}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHovered(point)}
              />
            </g>
          ))}
        </svg>

        <div className="mt-1 flex items-baseline justify-between text-[0.75rem] text-ink-3">
          <span>{formatDayLong(first)}</span>
          <span className="min-h-[1rem] text-ink-2">
            {hovered
              ? `${formatDayLong(hovered.day)} · ${weightFigure(hovered.grams, unit)} ${unit}`
              : ''}
          </span>
          <span>{formatDayLong(last)}</span>
        </div>
      </div>

      {targetG !== null ? (
        <figcaption className="mt-2 text-[0.75rem] text-ink-3">
          Dotted line is the target for this phase: {weightFigure(targetG, unit)} {unit}.
        </figcaption>
      ) : null}
    </figure>
  );
}
