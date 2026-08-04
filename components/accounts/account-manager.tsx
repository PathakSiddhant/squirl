'use client';

import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { archiveAccount, createAccount } from '@/app/actions/accounts';
import { cn } from '@/lib/cn';
import { parseAmount } from '@/lib/money';
import type { AccountKind } from '@/lib/db/schema';

import { Button } from '../ui/button';
import { Field, Input } from '../ui/primitives';

/**
 * Creating an account.
 *
 * The kind is chosen in plain language, because "parked" and "invest" are the
 * two that actually change how a balance behaves and nobody guesses that from
 * the word alone.
 */
const KINDS: Array<{ value: AccountKind; label: string; blurb: string }> = [
  { value: 'bank', label: 'Bank', blurb: 'Spendable straight away' },
  { value: 'cash', label: 'Cash', blurb: 'Notes in your pocket' },
  { value: 'wallet', label: 'Wallet', blurb: 'Paytm, PhonePe and the like' },
  {
    value: 'parked',
    label: 'Set aside',
    blurb: 'Savings, or money family holds. Yours, but not spendable.',
  },
  {
    value: 'invest',
    label: 'Invested',
    blurb: 'Stocks, funds, gold. Yours, and its value moves on its own.',
  },
];

export function NewAccountForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('bank');
  const [opening, setOpening] = useState('');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={14} weight="bold" />
        New account
      </Button>
    );
  }

  const submit = () => {
    if (!name.trim()) return toast.error('Give it a name');

    startTransition(async () => {
      const result = await createAccount({
        name: name.trim(),
        kind,
        openingBalance: parseAmount(opening) ?? 0,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success(`${name.trim()} added`);
        setOpen(false);
        setName('');
        setOpening('');
        setNote('');
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <Field label="What is it called">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Zerodha, HDFC, Emergency fund"
          autoFocus
        />
      </Field>

      <div className="mt-3">
        <span className="label mb-1.5 block">What kind</span>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
              className={cn(
                'rounded-sm border px-2.5 py-2 text-left transition-colors',
                kind === option.value
                  ? 'border-line-strong bg-surface-2'
                  : 'border-line hover:bg-surface-2',
              )}
            >
              <span
                className={cn(
                  'block text-[0.875rem]',
                  kind === option.value ? 'font-medium text-ink' : 'text-ink-2',
                )}
              >
                {option.label}
              </span>
              <span className="block text-[0.75rem] leading-snug text-ink-3">{option.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="What is in it now" hint="Leave blank if it is empty">
          <Input
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="primary" onClick={submit} disabled={pending}>
          Add account
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ArchiveAccountButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await archiveAccount(id);
          if (result.ok) toast.success(`${name} hidden`);
          else toast.error(result.error);
        })
      }
    >
      Hide
    </Button>
  );
}
