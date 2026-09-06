'use client';

import { PaperPlaneRight } from '@phosphor-icons/react/dist/csr/PaperPlaneRight';
import { PushPin } from '@phosphor-icons/react/dist/csr/PushPin';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { editNote, pinNote, removeNote, saveNote } from '@/app/actions/form';
import { cn } from '@/lib/cn';
import { formatDayLong, toDay } from '@/lib/date';
import type { FormNote } from '@/lib/form/schema';

/**
 * The things worth remembering between phases.
 *
 * ## Why this is not a notes app
 *
 * §55 draws the line and it is worth holding: no folders, no tags, no rich
 * text, no titles, no backlinks. A note here is one thought, written in the
 * moment it occurred, and the whole feature is that it will still be readable
 * at the start of the next cut. Anything more would be a second product living
 * inside this one, and a worse version of one that already exists.
 *
 * ## Why it is a wall and not a column
 *
 * The first version was a single column of paragraphs, on the reasoning that
 * notes are read rather than browsed. That was wrong about how they are
 * actually used: you do not read this page top to bottom, you come back
 * looking for the one thing you wrote in March. Twenty paragraphs stacked in a
 * narrow column is the worst possible shape for finding one of them.
 *
 * So they are cards on a wall, laid out in real columns, with the pinned ones
 * at the front. Each is a separate object you can pick out at a distance,
 * which is the only thing that makes a wall of notes searchable by eye.
 */
export function NotesBoard({
  notes,
  phases,
}: {
  notes: FormNote[];
  phases: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [draft, setDraft] = useState('');
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const reduceMotion = useReducedMotion();

  const phaseName = (id: string | null) => phases.find((phase) => phase.id === id)?.name ?? null;

  const run = (action: () => Promise<unknown>) =>
    start(async () => {
      await action();
      router.refresh();
    });

  const add = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    run(() => saveNote(body, phaseId));
  };

  // Pinned first, then newest. Sorted here rather than in SQL so that pinning
  // something animates it to the front instead of reloading the page under it.
  const ordered = [...notes].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] xl:items-start">
      {/* ------------------------------------------------------- the writer */}
      <section className="form-panel rounded-[1.75rem] p-5 xl:sticky xl:top-24">
        <h1 className="font-serif text-[1.625rem] leading-none tracking-[-0.03em] text-ink">
          Write it down now
        </h1>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">
          Whatever you would want to know at the start of the next phase. You will not remember it
          otherwise, and this is the only place in Form that is allowed to be a sentence.
        </p>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              add();
            }
          }}
          rows={5}
          placeholder="Dropping below 1,900 makes the evenings unbearable…"
          aria-label="A new note"
          className="form-field mt-4 w-full resize-none rounded-[1rem] p-3.5 text-[0.9375rem] leading-relaxed"
        />

        {phases.length > 0 ? (
          <div className="mt-3">
            <span className="form-label">About</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip active={phaseId === null} onClick={() => setPhaseId(null)}>
                Nothing in particular
              </Chip>
              {phases.map((phase) => (
                <Chip
                  key={phase.id}
                  active={phaseId === phase.id}
                  onClick={() => setPhaseId(phase.id)}
                >
                  {phase.name}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className={cn(
            'mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3',
            'text-[0.9375rem] font-medium transition-[translate,box-shadow,opacity] duration-[var(--t-state)]',
            draft.trim()
              ? 'bg-[var(--app-accent)] text-white hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]'
              : 'cursor-not-allowed bg-surface-2 text-ink-3',
          )}
        >
          <PaperPlaneRight size={14} weight="fill" />
          Pin it to the wall
        </button>
      </section>

      {/* -------------------------------------------------------- the wall */}
      {ordered.length === 0 ? (
        <section className="form-panel flex flex-col items-center justify-center rounded-[1.75rem] px-6 py-20 text-center">
          <PushPin size={30} className="text-ink-3" />
          <p className="mt-4 font-serif text-[1.25rem] tracking-[-0.02em] text-ink">
            The wall is empty.
          </p>
          <p className="mt-2 max-w-[24rem] text-[0.875rem] leading-relaxed text-ink-3">
            The first note is usually written on a bad day, and it is usually the most useful one
            you will ever write.
          </p>
        </section>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 2xl:columns-3">
          <AnimatePresence initial={false}>
            {ordered.map((note, index) => (
              <motion.article
                key={note.id}
                layout
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 34,
                  delay: reduceMotion ? 0 : Math.min(index * 0.03, 0.25),
                }}
                className={cn(
                  'group/note mb-4 block break-inside-avoid rounded-[1.25rem] border p-4',
                  'transition-[translate,box-shadow,rotate] duration-[var(--t-hover)] ease-[var(--ease-spring)]',
                  'hover:-translate-y-1 hover:shadow-[var(--shadow-pop)]',
                  note.pinned
                    ? 'border-[var(--app-accent)] bg-[var(--app-accent-wash)] shadow-[var(--shadow-press)]'
                    : 'border-[var(--form-edge)] bg-surface shadow-[var(--shadow-press)]',
                )}
              >
                {editingId === note.id ? (
                  <textarea
                    value={editDraft}
                    autoFocus
                    rows={5}
                    onChange={(event) => setEditDraft(event.target.value)}
                    onBlur={() => {
                      const body = editDraft.trim();
                      setEditingId(null);
                      if (body && body !== note.body) run(() => editNote(note.id, body));
                    }}
                    className="form-field w-full resize-none rounded-xl p-3 text-[0.9375rem] leading-relaxed"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(note.id);
                      setEditDraft(note.body);
                    }}
                    className="block w-full text-left text-[0.9375rem] leading-relaxed text-ink"
                  >
                    {note.body}
                  </button>
                )}

                <div className="mt-3.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[0.75rem] text-ink-3">
                    {formatDayLong(toDay(new Date(note.createdAt)))}
                    {phaseName(note.phaseId) ? ` · ${phaseName(note.phaseId)}` : ''}
                  </span>

                  <button
                    type="button"
                    onClick={() => run(() => pinNote(note.id, !note.pinned))}
                    aria-label={note.pinned ? 'Unpin' : 'Pin'}
                    aria-pressed={Boolean(note.pinned)}
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--t-state)]',
                      note.pinned
                        ? 'text-[var(--app-accent)]'
                        : 'text-ink-3 opacity-0 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover/note:opacity-100',
                    )}
                  >
                    <PushPin size={13} weight={note.pinned ? 'fill' : 'regular'} />
                  </button>

                  <button
                    type="button"
                    onClick={() => run(() => removeNote(note.id))}
                    aria-label="Delete"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3 opacity-0 transition-colors duration-[var(--t-state)] hover:bg-[var(--i-owe-wash)] hover:text-[var(--i-owe-text)] focus-visible:opacity-100 group-hover/note:opacity-100"
                  >
                    <Trash size={13} />
                  </button>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1.5 text-[0.75rem] transition-colors duration-[var(--t-state)]',
        active
          ? 'border-transparent bg-ink text-ink-invert'
          : 'border-[var(--form-edge)] text-ink-3 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
