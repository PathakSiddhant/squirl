'use client';

import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, useTransition } from 'react';

import { cn } from '@/lib/cn';

/**
 * A value that turns into a field when you touch it.
 *
 * ## It has to look like a control even when it is empty
 *
 * The first version rendered a bare `<button>` containing the word "add", with
 * no border, no background and no affordance of any kind. A column of those
 * read as a page that had failed to load rather than as five things you could
 * fill in — which is exactly what it looked like, because a word on a
 * background is not a control.
 *
 * So an empty one is a dashed chip with a pencil in it, and a filled one is a
 * value on a surface that lifts under the pointer. Both are unmistakably
 * pressable while sitting still, which is the whole job.
 *
 * ## What you type is read by the same parser that will store it
 *
 * There is no unit dropdown beside it: `72.5`, `72.5 kg` and `160 lb` all work,
 * and the confirmation line underneath says which one was understood before
 * anything is saved (§87). A parser that guessed silently would be worse than
 * a dropdown; one that shows its working is better than either.
 */
export function InlineInput({
  value,
  placeholder,
  label,
  onSave,
  preview,
  className,
  inputClassName,
  size = 'md',
}: {
  /** What to show when not being edited. Null renders the empty affordance. */
  value: string | null;
  placeholder: string;
  label: string;
  onSave: (raw: string) => Promise<{ error: string | null }>;
  /** Reads the draft the same way the server will, for the confirmation line. */
  preview?: (raw: string) => string | null;
  className?: string;
  inputClassName?: string;
  size?: 'md' | 'lg';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const field = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (editing) field.current?.select();
  }, [editing]);

  const commit = () => {
    const raw = draft.trim();
    if (!raw) {
      setEditing(false);
      setError(null);
      return;
    }
    start(async () => {
      const result = await onSave(raw);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditing(false);
    });
  };

  if (!editing) {
    const open = () => {
      setDraft(value ?? '');
      setEditing(true);
    };

    if (value === null) {
      return (
        <button
          type="button"
          onClick={open}
          aria-label={label}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line-strong',
            'px-3 py-1.5 text-[0.8125rem] text-ink-3',
            'transition-[border-color,color,translate] duration-[var(--t-state)] ease-[var(--ease)]',
            'hover:-translate-y-0.5 hover:border-[var(--app-accent)] hover:text-ink',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]',
          )}
        >
          <PencilSimple size={12} />
          {placeholder}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={open}
        aria-label={label}
        className={cn(
          'group/value inline-flex items-center gap-1.5 rounded-xl border border-transparent',
          'px-2 py-1 text-left',
          'transition-[border-color,background-color] duration-[var(--t-state)]',
          'hover:border-line hover:bg-surface-2',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]',
          className,
        )}
      >
        {value}
        <PencilSimple
          size={11}
          className="shrink-0 text-ink-3 opacity-0 transition-opacity duration-[var(--t-state)] group-hover/value:opacity-100"
        />
      </button>
    );
  }

  const hint = preview && draft.trim() ? preview(draft.trim()) : null;

  return (
    <span className="inline-flex flex-col">
      <input
        ref={field}
        value={draft}
        autoFocus
        inputMode="decimal"
        aria-label={label}
        disabled={pending}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setEditing(false);
            setError(null);
          }
        }}
        placeholder={placeholder}
        className={cn(
          'form-field rounded-xl px-2.5 py-1.5 outline-none',
          size === 'lg' ? 'form-figure text-[2rem]' : 'text-[0.9375rem]',
          error && 'border-[var(--i-owe-text)]',
          inputClassName,
        )}
      />

      {/* What it was understood as, before it is committed to. */}
      {hint || error ? (
        <motion.span
          initial={reduceMotion ? false : { opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('mt-1 text-[0.75rem]', error ? 'text-[var(--i-owe-text)]' : 'text-ink-3')}
        >
          {error ?? hint}
        </motion.span>
      ) : null}
    </span>
  );
}
