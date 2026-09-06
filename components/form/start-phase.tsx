import { ArrowRight } from '@phosphor-icons/react/dist/ssr/ArrowRight';
import Link from 'next/link';

/**
 * The first screen, before there is anything to show.
 *
 * Form is not usable without a phase — every target, every judgement and every
 * graph is measured against one — so the empty state is not a placeholder, it
 * is the front door. It says what a phase is, in the words somebody would use
 * out loud, and then offers exactly one thing to do (§108).
 *
 * No illustration, no motivational line, no three-step explainer. Somebody who
 * opened a body-tracking app already knows why they are here.
 */
export function StartPhase() {
  return (
    <section className="mx-auto flex min-h-[24rem] max-w-[34rem] flex-col justify-center py-10">
      <p className="form-label">Nothing running</p>

      <h1 className="mt-3 font-serif text-[2.25rem] leading-[1.05] tracking-[-0.03em] text-ink">
        Start with what you are actually trying to do.
      </h1>

      <p className="mt-4 max-w-[30rem] text-[0.9375rem] leading-relaxed text-ink-2">
        Form works in phases — a cut, a stretch of maintenance, a lean bulk — each with its own
        targets and its own record. One runs at a time, and when it ends it stays readable years
        later.
      </p>

      <div className="mt-7">
        <Link
          href="/form/new"
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-[0.9375rem] font-medium text-ink-invert transition-[translate,opacity] duration-[var(--t-state)] hover:-translate-y-0.5 hover:opacity-90"
        >
          Set up a phase
          <ArrowRight size={15} weight="bold" />
        </Link>
      </div>

      <p className="mt-4 text-[0.8125rem] text-ink-3">
        Takes a minute. Current weight, where you want to get to, and roughly when.
      </p>
    </section>
  );
}
