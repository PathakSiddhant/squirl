'use client';

import { useEffect, useState } from 'react';

/**
 * A figure that counts up to itself once, on arrival.
 *
 * Only ever a presentation of a number that is already correct: the final
 * value is what renders on the server and what a reader with reduced motion
 * or no scripting sees, so nothing here can make a figure wrong. The count is
 * there because it draws the eye to the one number on the tile that decides
 * whether you open the application.
 *
 * The string is re-formatted rather than sliced, so the separators land where
 * `formatMoney` put them at every frame instead of the digits jittering.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const target = Number(value.replace(/[^\d.-]/g, ''));
  const prefix = value.match(/^[^\d-]*/)?.[0] ?? '';
  const decimals = value.includes('.') ? 2 : 0;

  const [shown, setShown] = useState(target);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const started = performance.now();
    const run = (now: number) => {
      const progress = Math.min(1, (now - started) / 850);
      // Quartic ease-out: quick off the mark, and it lands rather than stops.
      setShown(target * (1 - (1 - progress) ** 4));
      if (progress < 1) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  if (!Number.isFinite(target)) return <span className={className}>{value}</span>;

  return (
    <span className={className}>
      {prefix}
      {shown.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}
