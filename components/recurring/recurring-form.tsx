'use client';

import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { X } from '@phosphor-icons/react/dist/csr/X';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createRecurring, updateRecurring, type RecurringInput } from '@/app/actions/recurring';
import { cn } from '@/lib/cn';
import { today as istToday, type DayString } from '@/lib/date';
import { INTERVAL_PRESETS, describeInterval, yearlyCost } from '@/lib/domain/recurring';
import { formatMoney, parseAmount, toRupees } from '@/lib/money';
import type { IntervalUnit, PaymentMethod } from '@/lib/db/schema';

import { Button } from '../ui/button';
import { Field, Input } from '../ui/primitives';

export interface RecurringEditable {
  id: string;
  name: string;
  kind: 'expense' | 'income' | 'transfer';
  amount: number;
  accountId: string | null;
  counterAccountId: string | null;
  categoryId: string | null;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  startsOn: DayString;
  endsOn: DayString | null;
  autoPost: boolean;
  method: PaymentMethod;
  note: string | null;
}

export interface RecurringOptions {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; flow?: string }>;
}

/**
 * Adding or editing something that repeats.
 *
 * The interval is offered as presets rather than a number and a unit dropdown,
 * because almost every real plan is one of six shapes and making people
 * assemble "every / 3 / months" for the common case is friction for nothing.
 * A custom row is there for the rest.
 */
export function RecurringForm({
  existing,
  options,
  open,
  onOpenChange,
}: {
  existing: RecurringEditable | null;
  options: RecurringOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isNew = existing === null;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<IntervalUnit>('month');
  const [count, setCount] = useState(1);
  const [startsOn, setStartsOn] = useState<string>(istToday());
  const [endsOn, setEndsOn] = useState('');
  const [accountId, setAccountId] = useState('');
  const [counterAccountId, setCounterAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [autoPost, setAutoPost] = useState(true);
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setKind(existing?.kind ?? 'expense');
    setAmount(existing ? String(toRupees(existing.amount)) : '');
    setUnit(existing?.intervalUnit ?? 'month');
    setCount(existing?.intervalCount ?? 1);
    setStartsOn(existing?.startsOn ?? istToday());
    setEndsOn(existing?.endsOn ?? '');
    setAccountId(existing?.accountId ?? options.accounts[0]?.id ?? '');
    setCounterAccountId(existing?.counterAccountId ?? '');
    setCategoryId(existing?.categoryId ?? '');
    setAutoPost(existing?.autoPost ?? true);
    setNote(existing?.note ?? '');
  }, [open, existing, options.accounts]);

  const parsedAmount = parseAmount(amount);
  const perYear = parsedAmount ? yearlyCost(parsedAmount, unit, count) : null;
  const categories = options.categories.filter((c) =>
    kind === 'income' ? c.flow === 'in' : c.flow === 'out',
  );

  const save = () => {
    if (!name.trim()) return toast.error('Give it a name');
    if (!parsedAmount || parsedAmount <= 0) return toast.error('Enter an amount');
    if (!accountId) return toast.error('Pick an account');
    if (kind === 'transfer' && !counterAccountId) return toast.error('Pick where it goes');

    const payload: RecurringInput = {
      name: name.trim(),
      kind,
      amount: parsedAmount,
      accountId,
      counterAccountId: kind === 'transfer' ? counterAccountId : null,
      categoryId: kind === 'transfer' ? null : categoryId || null,
      intervalUnit: unit,
      intervalCount: count,
      startsOn,
      endsOn: endsOn || null,
      autoPost,
      method: existing?.method ?? (autoPost ? 'auto' : 'upi'),
      note: note.trim() || null,
    };

    startTransition(async () => {
      const result = isNew ? await createRecurring(payload) : await updateRecurring(existing.id, payload);
      if (result.ok) {
        toast.success(isNew ? 'Added' : 'Saved');
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay fixed inset-0 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'z-modal fixed left-1/2 top-1/2 max-h-[88dvh] w-[calc(100vw-2rem)] max-w-[480px]',
            '-translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface',
            'shadow-[var(--shadow-pop)] focus:outline-none',
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Dialog.Title className="text-[0.9375rem] font-semibold text-ink">
              {isNew ? 'Something that repeats' : 'Edit'}
            </Dialog.Title>
            <Dialog.Close className="rounded-sm p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
              <X size={15} />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="space-y-3 px-4 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="What is it">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Netflix, rent, gym"
                  autoFocus={isNew}
                />
              </Field>
              <Field label="How much, each time">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="199"
                />
              </Field>
            </div>

            <Field label="Kind">
              <div className="flex items-center gap-1">
                {(['expense', 'income', 'transfer'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={kind === value}
                    onClick={() => setKind(value)}
                    className={cn(
                      'flex-1 rounded-sm border px-2 py-1.5 text-[0.8125rem] transition-colors',
                      kind === value
                        ? 'border-line-strong bg-surface-2 font-medium text-ink'
                        : 'border-line text-ink-3 hover:text-ink-2',
                    )}
                  >
                    {value === 'expense' ? 'Goes out' : value === 'income' ? 'Comes in' : 'Moves'}
                  </button>
                ))}
              </div>
            </Field>

            <div>
              <span className="label mb-1.5 block">How often</span>
              <div className="flex flex-wrap gap-1.5">
                {INTERVAL_PRESETS.map((preset) => {
                  const active = unit === preset.unit && count === preset.count;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setUnit(preset.unit);
                        setCount(preset.count);
                      }}
                      className={cn(
                        'rounded-sm border px-2.5 py-1 text-[0.8125rem] transition-colors',
                        active
                          ? 'border-line-strong bg-surface-2 font-medium text-ink'
                          : 'border-line text-ink-3 hover:text-ink-2',
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-[0.8125rem] text-ink-3">or every</span>
                <Input
                  value={String(count)}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                  inputMode="numeric"
                  className="h-8 w-16"
                  aria-label="Interval count"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as IntervalUnit)}
                  aria-label="Interval unit"
                  className="h-8 rounded-sm border border-line bg-surface px-2 text-[0.8125rem] text-ink"
                >
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                  <option value="month">months</option>
                  <option value="year">years</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="First charge" hint="The date it bills, now or in the past">
                <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </Field>
              <Field label="Stops after" hint="Leave blank if it just continues">
                <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </Field>
            </div>

            <Field label={kind === 'income' ? 'Lands in' : 'Comes out of'}>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-[0.875rem] text-ink"
              >
                {options.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>

            {kind === 'transfer' ? (
              <Field label="Goes into">
                <select
                  value={counterAccountId}
                  onChange={(e) => setCounterAccountId(e.target.value)}
                  className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-[0.875rem] text-ink"
                >
                  <option value="">Pick one</option>
                  {options.accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
            ) : (
              <Field label="Category">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-[0.875rem] text-ink"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <button
              type="button"
              onClick={() => setAutoPost(!autoPost)}
              aria-pressed={autoPost}
              className="flex w-full items-start gap-2.5 rounded-sm border border-line px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <span
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                  autoPost ? 'border-ink bg-ink text-ink-invert' : 'border-line-strong',
                )}
              >
                {autoPost ? <span className="text-[0.625rem] leading-none">✓</span> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.875rem] text-ink">
                  The money leaves on its own
                </span>
                <span className="block text-[0.8125rem] leading-snug text-ink-3">
                  {autoPost
                    ? 'Squirl will log it on the date without asking, and catch up anything missed while the app was closed.'
                    : 'Squirl will remind you and wait for you to confirm each time.'}
                </span>
              </span>
            </button>

            <Field label="Note">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </Field>

            {perYear !== null ? (
              <p className="rounded-sm border border-line bg-surface-2 px-3 py-2 text-[0.8125rem] text-ink-2">
                {formatMoney(parsedAmount!)} {describeInterval(unit, count)} is{' '}
                <span className="money text-ink">{formatMoney(perYear)}</span> a year.
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={pending}>
              {isNew ? 'Add it' : 'Save'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AddRecurringButton({ options }: { options: RecurringOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={14} weight="bold" />
        Add
      </Button>
      <RecurringForm existing={null} options={options} open={open} onOpenChange={setOpen} />
    </>
  );
}
