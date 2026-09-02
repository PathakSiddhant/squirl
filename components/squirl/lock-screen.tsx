'use client';

import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlash } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { Leaf } from '@phosphor-icons/react/dist/csr/Leaf';
import { LockSimple } from '@phosphor-icons/react/dist/csr/LockSimple';
import { User } from '@phosphor-icons/react/dist/csr/User';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';

import { signIn, type SignInState } from '@/app/actions/session';
import { Lockup, Mark } from '@/components/brand/logo';
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
 */
function PanelEdge() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute inset-y-0 right-full hidden h-full w-[7.5rem] lg:block"
    >
      <path d="M100,0 C58,16 76,42 62,60 C50,76 66,88 54,100 L100,100 Z" fill="var(--surface)" />
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
  const scene = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Held in state on purpose. React resets an uncontrolled form once its action
  // resolves, so after one wrong password the username would be wiped too, and
  // you would have to retype your name to fix a typo in a different box. The
  // password is deliberately left to clear itself.
  const [username, setUsername] = useState('');
  const [reveal, setReveal] = useState(false);
  const [live, setLive] = useState(false);

  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const pointerX = useSpring(rawX, { stiffness: 70, damping: 20, mass: 0.8 });
  const pointerY = useSpring(rawY, { stiffness: 70, damping: 20, mass: 0.8 });

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      usernameField.current?.focus();
      if (!reduceMotion) setLive(true);
    }
  }, [reduceMotion]);

  const track = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!live) return;
      const box = scene.current?.getBoundingClientRect();
      if (!box) return;
      rawX.set(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
      rawY.set(Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)));
    },
    [live, rawX, rawY],
  );

  const settle = useCallback(() => {
    rawX.set(0.5);
    rawY.set(0.5);
  }, [rawX, rawY]);

  return (
    <main
      data-phase={phase}
      onPointerMove={track}
      onPointerLeave={settle}
      className="threshold relative flex min-h-dvh flex-col bg-surface lg:flex-row"
    >
      <div
        ref={scene}
        className="relative h-[34vh] w-full shrink-0 overflow-hidden lg:h-auto lg:min-h-dvh lg:w-[54%]"
      >
        <ThresholdScene pointerX={pointerX} pointerY={pointerY} live={live} />

        <div className="relative z-10 flex h-full flex-col p-6 lg:p-14">
          <div className="rise" style={{ animationDelay: '880ms' }}>
            <Lockup size={54} alt="Squirl" className="lg:hidden" />
            <Lockup size={74} alt="Squirl" className="hidden lg:block" />
          </div>

          <div className="mt-14 hidden max-w-[26rem] lg:block">
            <h1
              className="rise font-serif text-[3.5rem] font-normal leading-[1.04] tracking-[-0.02em] text-ink"
              style={{ animationDelay: '960ms' }}
            >
              Your space.
              <br />
              Your data.
              <br />
              <span className="text-[var(--cta)]">All yours.</span>
            </h1>
            <span
              className="rise mt-6 block h-px w-10 bg-[var(--cta)]"
              style={{ animationDelay: '1030ms' }}
            />
            <p
              className="rise mt-6 text-[0.9375rem] leading-relaxed text-ink-2"
              style={{ animationDelay: '1080ms' }}
            >
              No cloud. No sync.
              <br />
              Just your device.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col bg-surface">
        <PanelEdge />

        <div className="flex items-center justify-end gap-2.5 px-6 pt-6 text-[0.6875rem] font-medium uppercase tracking-[0.09em] text-ink-3 lg:px-12">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--in)]" aria-hidden="true" />
            Local
          </span>
          <span className="h-3 w-px bg-line" aria-hidden="true" />
          <span>This device</span>
        </div>

        <div className="mx-auto flex w-full max-w-[23rem] flex-1 flex-col justify-center px-6 pb-12 pt-6 lg:px-0">
          <div className="rise flex flex-col items-center" style={{ animationDelay: '900ms' }}>
            <span className="flex size-[4.5rem] items-center justify-center rounded-full border border-line bg-bg">
              <Mark size={34} />
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
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
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
                  className="field h-12 w-full rounded-lg border border-line bg-surface pl-10 pr-3.5 text-[0.9375rem] text-ink transition-[border-color,box-shadow] duration-[var(--t-state)] placeholder:text-ink-3"
                />
              </label>

              <label className="relative block">
                <span className="sr-only">Password</span>
                <LockSimple
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
                />
                <input
                  name="password"
                  type={reveal ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="current-password"
                  aria-invalid={state.error ? true : undefined}
                  className="field h-12 w-full rounded-lg border border-line bg-surface pl-10 pr-11 text-[0.9375rem] text-ink transition-[border-color,box-shadow] duration-[var(--t-state)] placeholder:text-ink-3"
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
                'mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg',
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
