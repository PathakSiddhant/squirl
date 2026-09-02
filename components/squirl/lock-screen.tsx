'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';

import { signIn, type SignInState } from '@/app/actions/session';
import { Lockup } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';

const INITIAL: SignInState = { error: null };

/** Which part of the day the desk lamp is set for. Resolved in IST, server side. */
export type DeskPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** How far the sheet may tilt, in degrees. Past about two it stops reading as
 *  paper catching the light and starts reading as a novelty. */
const TILT = 2.4;

/**
 * The threshold.
 *
 * A sheet of ledger paper on a lit desk, with the form set on it.
 *
 * The sheet is a physical object. It leans a little towards the pointer and a
 * highlight travels across it, so moving the mouse feels like tilting paper
 * under a lamp rather than like operating a web page. That is the whole idea,
 * and it is why the motion is worth having: it makes the material believable.
 * Everything is transform-driven and spring-damped, so it stays on the
 * compositor and never chases the cursor exactly.
 *
 * None of it runs when the pointer is coarse or the reader asked for less
 * motion. The page is complete and usable without a single frame of it.
 */
export function LockScreen({ phase }: { phase: DeskPhase }) {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);
  const usernameField = useRef<HTMLInputElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Held in state on purpose. React resets an uncontrolled form once its action
  // resolves, so after one wrong password the username would be wiped too, and
  // you would have to retype your name to fix a typo in a different box. The
  // password is deliberately left to clear itself.
  const [username, setUsername] = useState('');
  const [live, setLive] = useState(false);

  // Pointer position over the sheet, 0 to 1 on each axis. Motion values rather
  // than state: this changes every frame, and React should not re-render for it.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 90, damping: 20, mass: 0.7 });
  const sy = useSpring(py, { stiffness: 90, damping: 20, mass: 0.7 });

  const rotateY = useTransform(sx, [0, 1], [-TILT, TILT]);
  const rotateX = useTransform(sy, [0, 1], [TILT, -TILT]);
  // The highlight travels further than the pointer, the way a reflection does.
  const glareX = useTransform(sx, [0, 1], ['-46%', '46%']);
  const glareY = useTransform(sy, [0, 1], ['-38%', '38%']);

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      usernameField.current?.focus();
      if (!reduceMotion) setLive(true);
    }
  }, [reduceMotion]);

  const track = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!live) return;
      const box = sheet.current?.getBoundingClientRect();
      if (!box) return;
      px.set(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
      py.set(Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)));
    },
    [live, px, py],
  );

  const settle = useCallback(() => {
    px.set(0.5);
    py.set(0.5);
  }, [px, py]);

  return (
    <main
      data-phase={phase}
      className="desk grid min-h-dvh place-items-center px-5 py-12 [perspective:1500px]"
      onPointerMove={track}
      onPointerLeave={settle}
    >
      <motion.div
        ref={sheet}
        style={live ? { rotateX, rotateY, transformStyle: 'preserve-3d' } : undefined}
        animate={{ opacity: pending ? 0.6 : 1, scale: pending ? 1.008 : 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="sheet w-full max-w-[25rem] overflow-hidden px-7 py-11 sm:px-10"
      >
        {live ? (
          <motion.span
            aria-hidden="true"
            style={{ x: glareX, y: glareY }}
            className="pointer-events-none absolute left-1/2 top-1/2 -ml-[26rem] -mt-[26rem] size-[52rem] rounded-full bg-[radial-gradient(circle,oklch(1_0_0/0.9)_0%,oklch(1_0_0/0)_62%)] dark:bg-[radial-gradient(circle,oklch(0.7_0.02_235/0.13)_0%,oklch(0.7_0.02_235/0)_62%)]"
          />
        ) : null}

        <div className="relative z-10 mx-auto w-full max-w-[19rem]">
          {/* Lifted off the page in real 3D. With the sheet tilting under a
              perspective, depth alone makes the mark travel further than the
              form beneath it, which is what sells the sheet as a solid thing. */}
          <div
            className="rise flex flex-col items-center"
            style={{ animationDelay: '900ms', transform: live ? 'translateZ(34px)' : undefined }}
          >
            <Lockup size={104} alt="Squirl" />
            <span className="mt-6 h-px w-14 bg-line-strong" />
            <p className="mt-5 text-center text-[0.8125rem] leading-relaxed text-ink-2">
              Everything you keep here stays on this machine.
            </p>
          </div>

          <form
            action={formAction}
            className="rise mt-7"
            style={{ animationDelay: '990ms', transform: live ? 'translateZ(14px)' : undefined }}
          >
            <div className="flex flex-col gap-4">
              <label className="block">
                <span className="label mb-2 block">Username</span>
                <Input
                  ref={usernameField}
                  name="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  autoCapitalize="none"
                  aria-invalid={state.error ? true : undefined}
                  className="h-11 px-3"
                />
              </label>

              <label className="block">
                <span className="label mb-2 block">Password</span>
                <Input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={state.error ? true : undefined}
                  className="h-11 px-3"
                />
              </label>
            </div>

            {/* Reserved, so the button never jumps down the page on a refusal. */}
            <div className="mt-3 min-h-[1.25rem]">
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={pending}
              className="mt-2 h-11 w-full justify-center transition-transform active:scale-[0.985]"
            >
              {pending ? 'Unlocking' : 'Unlock'}
            </Button>
          </form>

          <p
            className="rise mt-8 text-center text-[0.75rem] leading-relaxed text-ink-3"
            style={{ animationDelay: '1080ms' }}
          >
            A lock, not encryption. It keeps the tab shut, not the file.
          </p>
        </div>
      </motion.div>
    </main>
  );
}
