'use client';

import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlash } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { Leaf } from '@phosphor-icons/react/dist/csr/Leaf';
import { LockSimple } from '@phosphor-icons/react/dist/csr/LockSimple';
import { User } from '@phosphor-icons/react/dist/csr/User';
import { motion, useReducedMotion } from 'motion/react';
import { useActionState, useRef, useState } from 'react';

import { signIn, type SignInState } from '@/app/actions/session';
import { LockupRow, Mark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';
import type { DeskPhase } from '@/lib/squirl/phase';

import { ThresholdScene } from './threshold-scene';

const INITIAL: SignInState = { error: null };

/**
 * The joint between the landscape and the panel.
 *
 * A straight seam down the middle would cut the screen in half. This curve
 * lets the panel lean into the picture instead, so the two halves read as one
 * composition. It is filled with the panel's own colour and sits to the left
 * of it, which is why the panel needs no border of its own.
 *
 * Overlapped by a pixel. Sat exactly flush, the fill and the panel each stop
 * on the same subpixel boundary and antialiasing leaves a hairline of the
 * layer behind showing between them: a dead straight line down the page,
 * because this element's right edge is straight even though its left edge is
 * the curve.
 */
function PanelEdge() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute inset-y-0 right-[calc(100%-1px)] hidden h-full w-[18rem] lg:block"
    >
      {/* One sweep with a single inflection, not a wave. An earlier path
          oscillated across five control points and read as a ripple down the
          side of the screen rather than as an edge. */}
      <path d="M100,0 L84,0 C56,16 76,40 54,58 C34,74 32,88 8,100 L100,100 Z" fill="var(--panel)" />
    </svg>
  );
}

/**
 * The threshold.
 *
 * A landscape on the left, and the panel you sign in on leaning into it. The
 * scene keeps the hour in IST, and its layers travel at different rates under
 * the pointer, which is what makes flat shapes read as distance. None of that
 * runs on a coarse pointer or for a reader who asked for less motion, and the
 * screen is complete without a frame of it.
 *
 * There is no biometric option. Nothing here is wired to a platform
 * authenticator, and a button that looked like a second way in without being
 * one would be the least honest thing on a screen whose whole subject is where
 * your data actually lives.
 */
export function LockScreen({ phase }: { phase: DeskPhase }) {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);
  const usernameField = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  // Held in state on purpose. React resets an uncontrolled form once its action
  // resolves, so after one wrong password the username would be wiped too, and
  // you would have to retype your name to fix a typo in a different box. The
  // password is deliberately left to clear itself.
  const [username, setUsername] = useState('');
  const [reveal, setReveal] = useState(false);

  return (
    <main
      data-phase={phase}
      className="threshold relative flex min-h-dvh flex-col bg-[var(--panel)] lg:flex-row"
    >
      {/* Capped near the illustration's own proportions so the picture stays
          large and nearly whole, rather than a fixed share of the width that
          turns landscape on a short window and throws a third of it away. */}
      <div className="relative h-[34vh] w-full shrink-0 overflow-hidden lg:h-auto lg:min-h-dvh lg:w-[min(63%,98vh)]">
        <ThresholdScene phase={phase} />

        {/* The ink ramp and the wordmark both invert when the night picture is
            the one showing. Which that is depends on the hour and on the theme
            together, so it is settled in CSS rather than guessed here. */}
        <div className="over-art relative z-10 flex h-full flex-col p-6 lg:p-10 xl:p-14">
          <div className="rise" style={{ animationDelay: '880ms' }}>
            <LockupRow size={40} alt="Squirl" className="mark-over-art lg:hidden" />
            <LockupRow size={54} alt="Squirl" className="mark-over-art hidden lg:inline-flex" />
          </div>

          {/* Sized against the viewport height rather than a fixed scale. The
              sky the headline sits in is a fraction of the picture, so on a
              short window the type has to come down with it. */}
          <div className="mt-[min(3.5rem,5vh)] hidden max-w-[26rem] lg:block">
            <h1
              className="rise font-serif text-[min(3.5rem,4.85vh)] font-normal leading-[1.04] tracking-[-0.02em] text-ink"
              style={{ animationDelay: '960ms' }}
            >
              Your space.
              <br />
              Your data.
              <br />
              <span className="text-[var(--cta)]">All yours.</span>
            </h1>
            <span
              className="rise mt-[min(1.5rem,2.4vh)] block h-px w-10 bg-[var(--cta)]"
              style={{ animationDelay: '1030ms' }}
            />
            <p
              className="rise mt-[min(1.5rem,2.4vh)] text-[0.9375rem] leading-relaxed text-ink-2"
              style={{ animationDelay: '1080ms' }}
            >
              No cloud. No sync.
              <br />
              Just your device.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col bg-[var(--panel)]">
        <PanelEdge />

        <div className="flex items-center justify-end gap-2.5 px-6 pt-6 text-[0.6875rem] font-medium uppercase tracking-[0.09em] text-ink-3 lg:px-12">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--in)]" aria-hidden="true" />
            Local
          </span>
          <span className="h-3 w-px bg-line" aria-hidden="true" />
          <span>This device</span>
        </div>

        <div className="mx-auto flex w-full max-w-[25.5rem] flex-1 flex-col justify-center px-6 pb-12 pt-6 lg:px-0">
          <div className="rise flex flex-col items-center" style={{ animationDelay: '900ms' }}>
            {/* The panel keeps the app's own surface, so in the dark theme a
                charcoal mark sits on a charcoal disc and disappears. Punched
                out white there instead, which is legible and reads as a
                deliberate monochrome rather than a mark that failed to load. */}
            <span className="flex size-[4.5rem] items-center justify-center rounded-full border border-line bg-bg">
              <Mark size={34} className="dark:brightness-0 dark:invert" />
            </span>
            <h2 className="mt-5 font-serif text-[2rem] font-normal leading-tight tracking-[-0.015em] text-ink">
              Welcome back.
            </h2>
            <p className="mt-1.5 text-[0.9375rem] text-ink-2">
              Unlock <span className="text-[var(--cta)]">your space.</span>
            </p>
          </div>

          <form action={formAction} className="rise mt-8" style={{ animationDelay: '980ms' }}>
            <div className="flex flex-col gap-3">
              <label className="relative block">
                <span className="sr-only">Username</span>
                <User
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3"
                />
                <input
                  ref={usernameField}
                  name="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Username"
                  autoComplete="username"
                  spellCheck={false}
                  autoCapitalize="none"
                  aria-invalid={state.error ? true : undefined}
                  className="field h-[3.25rem] w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-[0.9375rem] text-ink transition-[border-color,box-shadow] duration-[var(--t-state)] placeholder:text-ink-3"
                />
              </label>

              <label className="relative block">
                <span className="sr-only">Password</span>
                <LockSimple
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3"
                />
                <input
                  name="password"
                  type={reveal ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="current-password"
                  aria-invalid={state.error ? true : undefined}
                  className="field h-[3.25rem] w-full rounded-xl border border-line bg-surface pl-11 pr-12 text-[0.9375rem] text-ink transition-[border-color,box-shadow] duration-[var(--t-state)] placeholder:text-ink-3"
                />
                <button
                  type="button"
                  onClick={() => setReveal((shown) => !shown)}
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 transition-colors duration-[var(--t-state)] hover:text-ink-2"
                >
                  {reveal ? <EyeSlash size={17} /> : <Eye size={17} />}
                </button>
              </label>
            </div>

            {/* Reserved, so the button never jumps down the page on a refusal. */}
            <div className="mt-2.5 min-h-[1.25rem]">
              {state.error ? (
                <motion.p
                  role="alert"
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="text-[0.8125rem] leading-tight text-[var(--i-owe-text)]"
                >
                  {state.error}
                </motion.p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={pending}
              className={cn(
                'mt-2 flex h-[3.25rem] w-full items-center justify-center gap-2.5 rounded-xl',
                'bg-[var(--cta)] text-[0.9375rem] font-semibold text-white',
                'transition-[background-color,transform] duration-[var(--t-state)]',
                'hover:bg-[var(--cta-hover)] active:scale-[0.99]',
                'disabled:pointer-events-none disabled:opacity-60',
              )}
            >
              {pending ? 'Unlocking' : 'Unlock'}
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </button>
          </form>

          <p
            className="rise mt-8 flex items-start justify-center gap-2 text-center text-[0.75rem] leading-relaxed text-ink-3"
            style={{ animationDelay: '1060ms' }}
          >
            <Leaf size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>A lock, not encryption. It keeps the tab shut, not the file.</span>
          </p>
        </div>
      </div>
    </main>
  );
}
