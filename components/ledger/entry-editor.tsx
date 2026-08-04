'use client';

import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { X } from '@phosphor-icons/react/dist/csr/X';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createTransaction, deleteTransaction, updateTransaction } from '@/app/actions/transactions';
import { cn } from '@/lib/cn';
import { today as istToday, type DayString } from '@/lib/date';
import { formatMoney, parseAmount, toRupees } from '@/lib/money';
import { PAYMENT_METHODS, type PaymentMethod, type TransactionKind } from '@/lib/db/schema';

import { KIND_META } from '../money/kind';
import { Button } from '../ui/button';
import { Field, Input } from '../ui/primitives';

/**
 * The escape hatch from the one-line syntax.
 *
 * Every field the parser guesses is editable here, and everything can be
 * deleted. Quick capture is meant to be the fast path, never the only path:
 * an app you cannot correct is one you stop trusting the moment it gets
 * something wrong.
 */

export interface EditorOption {
  id: string;
  name: string;
  kind?: string;
  flow?: string;
}

export interface EditorContext {
  accounts: EditorOption[];
  categories: EditorOption[];
  people: EditorOption[];
}

export interface EditableEntry {
  id: string;
  day: DayString;
  kind: TransactionKind;
  amount: number;
  accountId: string | null;
  counterAccountId: string | null;
  categoryId: string | null;
  personId: string | null;
  method: PaymentMethod;
  note: string | null;
  interestPart: number;
  debtId: string | null;
  loanId: string | null;
  installmentId: string | null;
}

/** The kinds a person can pick by hand. Loan and debt movements are created
 *  from their own screens, where the schedule and terms live. */
const PICKABLE_KINDS: TransactionKind[] = ['expense', 'income', 'transfer'];

const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: 'UPI',
  card: 'Card',
  cash: 'Cash',
  bank: 'Bank transfer',
  auto: 'Auto debit',
  other: 'Something else',
};

export function EntryEditor({
  entry,
  context,
  open,
  onOpenChange,
}: {
  /** Null means create a new entry. */
  entry: EditableEntry | null;
  context: EditorContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isNew = entry === null;
  const [kind, setKind] = useState<TransactionKind>(entry?.kind ?? 'expense');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState<DayString>(entry?.day ?? istToday());
  const [accountId, setAccountId] = useState(entry?.accountId ?? '');
  const [counterAccountId, setCounterAccountId] = useState(entry?.counterAccountId ?? '');
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? '');
  const [method, setMethod] = useState<PaymentMethod>(entry?.method ?? 'upi');
  const [note, setNote] = useState(entry?.note ?? '');
  const [pending, startTransition] = useTransition();

  // Re-seed the form whenever a different row is opened.
  useEffect(() => {
    if (!open) return;
    setKind(entry?.kind ?? 'expense');
    setAmount(entry ? String(toRupees(entry.amount)) : '');
    setDay(entry?.day ?? istToday());
    setAccountId(entry?.accountId ?? context.accounts[0]?.id ?? '');
    setCounterAccountId(entry?.counterAccountId ?? '');
    setCategoryId(entry?.categoryId ?? '');
    setMethod(entry?.method ?? 'upi');
    setNote(entry?.note ?? '');
  }, [open, entry, context.accounts]);

  const locked = !isNew && !PICKABLE_KINDS.includes(entry.kind);
  const categories = context.categories.filter((c) =>
    kind === 'income' ? c.flow === 'in' : c.flow === 'out',
  );

  const save = () => {
    const value = parseAmount(amount);
    if (!value || value <= 0) return toast.error('Enter an amount');
    if (!accountId) return toast.error('Pick an account');
    if (kind === 'transfer' && !counterAccountId) return toast.error('Pick where it went');
    if (kind === 'transfer' && counterAccountId === accountId) {
      return toast.error('Pick two different accounts');
    }

    const payload = {
      day,
      kind,
      amount: value,
      accountId,
      counterAccountId: kind === 'transfer' ? counterAccountId : null,
      categoryId: kind === 'transfer' ? null : categoryId || null,
      personId: entry?.personId ?? null,
      debtId: entry?.debtId ?? null,
      loanId: entry?.loanId ?? null,
      installmentId: entry?.installmentId ?? null,
      interestPart: entry?.interestPart ?? 0,
      method,
      note: note.trim() || null,
      rawInput: null,
    };

    startTransition(async () => {
      const result = isNew
        ? await createTransaction(payload)
        : await updateTransaction(entry.id, payload);
      if (result.ok) {
        toast.success(isNew ? 'Added' : 'Saved');
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const remove = () => {
    if (isNew) return;
    startTransition(async () => {
      const result = await deleteTransaction(entry.id);
      if (result.ok) {
        toast.success('Deleted');
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
            'z-modal fixed left-1/2 top-1/2 max-h-[88dvh] w-[calc(100vw-2rem)] max-w-[460px]',
            '-translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface',
            'shadow-[var(--shadow-pop)] focus:outline-none',
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Dialog.Title className="text-[0.9375rem] font-semibold text-ink">
              {isNew ? 'Add an entry' : 'Edit entry'}
            </Dialog.Title>
            <Dialog.Close className="rounded-sm p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
              <X size={15} />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="space-y-3 px-4 py-4">
            {locked ? (
              <p className="rounded-sm border border-line bg-surface-2 px-3 py-2 text-[0.8125rem] text-ink-2">
                This is a {KIND_META[entry.kind].label.toLowerCase()} entry tied to{' '}
                {entry.debtId ? 'a debt' : 'a loan'}. You can change the date, note and how it was
                paid here. To change the amount, delete it and record it again from that screen.
              </p>
            ) : (
              <Field label="What happened">
                <div className="flex items-center gap-1">
                  {PICKABLE_KINDS.map((value) => (
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
                      {value === 'expense' ? 'Spent' : value === 'income' ? 'Received' : 'Moved'}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Amount">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  disabled={locked}
                  placeholder="0"
                  autoFocus={isNew}
                />
              </Field>
              <Field label="Date">
                <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
            </div>

            <Field label={kind === 'transfer' ? 'Out of' : kind === 'income' ? 'Into' : 'Paid from'}>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={locked}
                className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-[0.875rem] text-ink disabled:opacity-50"
              >
                {context.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>

            {kind === 'transfer' ? (
              <Field label="Into" hint="Savings, investments, or any other account of yours">
                <select
                  value={counterAccountId}
                  onChange={(e) => setCounterAccountId(e.target.value)}
                  className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-[0.875rem] text-ink"
                >
                  <option value="">Pick one</option>
                  {context.accounts
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

            <Field label="How it was paid">
              <div className="flex flex-wrap gap-1">
                {PAYMENT_METHODS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={method === value}
                    onClick={() => setMethod(value)}
                    className={cn(
                      'rounded-sm border px-2 py-1 text-[0.8125rem] transition-colors',
                      method === value
                        ? 'border-line-strong bg-surface-2 font-medium text-ink'
                        : 'border-line text-ink-3 hover:text-ink-2',
                    )}
                  >
                    {METHOD_LABEL[value]}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Note" hint="Anything you want to remember about it">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Reliance shares, 3 units"
              />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
            {isNew ? (
              <span />
            ) : (
              <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
                <Trash size={13} />
                Delete
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                {isNew ? 'Add it' : 'Save'}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Shows the amount a row will be saved with, so nothing is a surprise. */
export function formatPreview(amount: string): string {
  const value = parseAmount(amount);
  return value ? formatMoney(value) : '';
}
