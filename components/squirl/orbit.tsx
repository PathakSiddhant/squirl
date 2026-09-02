import { Mark } from '@/components/brand/logo';
import { APPS } from '@/lib/squirl/apps';

/**
 * Squirl, with its applications around it.
 *
 * This is the platform model drawn small: the mark in the middle is the
 * environment, and each dot on a ring is one installed application in its own
 * accent. It is the only picture on the home screen, and it earns its place by
 * saying the one thing the page is about, rather than by filling a corner.
 *
 * Purely presentational, so it is hidden from assistive technology: the same
 * information is in the cards below, as text.
 */
export function Orbit() {
  return (
    <div aria-hidden="true" className="relative size-[17rem] shrink-0 select-none">
      <svg viewBox="0 0 280 280" className="absolute inset-0 size-full">
        <circle cx="140" cy="140" r="132" fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle cx="140" cy="140" r="96" fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle cx="140" cy="140" r="58" fill="var(--surface-2)" />

        {APPS.map((app, index) => {
          // Alternating rings, offset so two apps never sit on the same spoke.
          const radius = index % 2 === 0 ? 96 : 132;
          const angle = (-58 + index * 128) * (Math.PI / 180);
          return (
            <circle
              key={app.id}
              className={app.accentClass}
              cx={140 + radius * Math.cos(angle)}
              cy={140 + radius * Math.sin(angle)}
              r={app.status === 'ready' ? 6 : 5}
              fill="var(--app-accent)"
              opacity={app.status === 'ready' ? 1 : 0.55}
            />
          );
        })}
      </svg>

      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Mark size={42} />
      </span>
    </div>
  );
}
