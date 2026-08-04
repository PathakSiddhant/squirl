'use client';

import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { captureTransaction } from '@/app/actions/transactions';
import { cn } from '@/lib/cn';
import { formatRelativeDay } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { CAPTURE_EXAMPLES, parseCapture, type CaptureContext } from '@/lib/domain/capture';

import { KIND_META, TONE_TEXT, TONE_WASH } from '../money/kind';
import { Icon } from '../shell/icon';

/**
 * One field, no form.
 *
 * The parse runs on every keystroke and shows exactly what it understood, so
 * the user is never guessing whether "chai 20" did the right thing. Everything
 * it inferred is visible before Enter is pressed.
 */
export function QuickCapture({
  context,
  autoFocus = false,
  className,
}: {
  context: CaptureContext;
  autoFocus?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState('');
  const [pending, startTransition] = useTransition();
  const [exampleIndex, setExampleIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const parsed = useMemo(() => (value.trim() ? parseCapture(value, context) : null), [value, context]);

  // The placeholder cycles so the syntax teaches itself without a help panel.
  useEffect(() => {
    if (value) return;
    const timer = setInterval(() => setExampleIndex((i) => (i + 1) % CAPTURE_EXAMPLES.length), 3600);
    return () => clearInterval(timer);
  }, [value]);

  /**
   * Focus imperatively rather than with React's autoFocus.
   *
   * Next server-renders `caret-color: transparent` onto an autofocused input
   * and the client never does, which is a hydration mismatch. Doing it here
   * also means the mobile keyboard does not spring open the moment the page
   * loads, which is the last thing you want when glancing at a balance.
   */
  useEffect(() => {
    if (!autoFocus) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || pending) return;

    startTransition(async () => {
      const result = await captureTransaction(text);
      if (result.ok) {
        setValue('');
        toast.success('Logged', { description: text });
        inputRef.current?.focus();
      } else {
        toast.error(result.error);
      }
    });
  }, [value, pending]);

  const category = parsed?.categoryId
    ? context.categories.find((c) => c.id === parsed.categoryId)
    : null;
  const person = parsed?.personId ? context.people.find((p) => p.id === parsed.personId) : null;
  const meta = parsed ? KIND_META[parsed.kind] : null;

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-surface px-3 py-2 transition-colors duration-[var(--t-state)]',
          parsed?.ok ? 'border-line-strong' : 'border-line',
        )}
      >
        <Sparkle size={16} className="shrink-0 text-ink-3" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') setValue('');
          }}
          placeholder={`Try  ${CAPTURE_EXAMPLES[exampleIndex]}`}
          aria-label="Log a transaction in plain words"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!parsed?.ok || pending}
          aria-label="Log it"
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-sm transition-all duration-[var(--t-state)]',
            parsed?.ok
              ? 'bg-ink text-ink-invert hover:opacity-90'
              : 'bg-surface-2 text-ink-3',
            pending && 'opacity-50',
          )}
        >
          <ArrowRight size={14} weight="bold" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {parsed ? (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-1.5 px-1 pt-2"
          >
            {parsed.ok && meta ? (
              <>
                <PreviewChip tone={meta.tone}>
                  <Icon name={meta.icon} size={12} />
                  {meta.label}
                </PreviewChip>
                <PreviewChip tone={meta.tone} strong>
                  {formatMoney(parsed.amount ?? 0)}
                </PreviewChip>
                {category ? <PreviewChip>{category.name}</PreviewChip> : null}
                {person ? <PreviewChip>{person.name}</PreviewChip> : null}
                {parsed.newPersonName ? (
                  <PreviewChip>{parsed.newPersonName}, new</PreviewChip>
                ) : null}
                <PreviewChip>{formatRelativeDay(parsed.day)}</PreviewChip>
                {parsed.note ? <PreviewChip>{parsed.note}</PreviewChip> : null}
              </>
            ) : (
              <span className="text-[0.8125rem] text-ink-3">
                Add an amount and it is ready, like <span className="text-ink-2">chai 20</span>
              </span>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PreviewChip({
  children,
  tone,
  strong = false,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_WASH;
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.75rem] font-medium',
        tone ? TONE_WASH[tone] : 'bg-surface-2',
        tone ? TONE_TEXT[tone] : 'text-ink-2',
        strong && 'money',
      )}
    >
      {children}
    </span>
  );
}
