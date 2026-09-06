import { cn } from '@/lib/cn';

/**
 * Form's basic surface, and the reason its screens do not read as forms.
 *
 * Every control in the application lives inside one of these. That single rule
 * is what turns a page from a column of labels and blanks into a set of
 * objects laid out on a workbench: a panel has an edge, it sits on a ground
 * that is a shade darker than it is, and it holds exactly one idea.
 *
 * The flame is bled in from the top edge at a few per cent. It is barely
 * visible on its own and it is doing real work — a plain white rectangle on a
 * warm ground reads as a hole punched in the page, and the tint is what makes
 * it read as a surface lying on top of one.
 */
export function Panel({
  children,
  className,
  as: Tag = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'li';
}) {
  return (
    <Tag className={cn('form-panel rounded-[1.5rem] p-5 sm:p-6', className)}>{children}</Tag>
  );
}

/**
 * The name of a reading.
 *
 * Deliberately not Signal's tracked uppercase mono, which is an instrument
 * panel's voice and already spoken for. Form annotates the way a measurement
 * is annotated in a notebook: lower case, close to the figure it belongs to,
 * quiet enough that the figure stays the thing you see.
 */
export function PanelLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('form-label block', className)}>{children}</span>;
}

/** A section title, set in the display face at a size that carries a screen. */
export function PanelTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        'font-serif text-[1.375rem] leading-tight tracking-[-0.025em] text-ink',
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** The page's own heading. One per screen. */
export function PageTitle({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[clamp(2rem,5vw,2.75rem)] leading-[1.02] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        {lead ? (
          <p className="mt-2.5 max-w-[38rem] text-[0.9375rem] leading-relaxed text-ink-2">{lead}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
