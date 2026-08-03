'use client';

import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { cn } from '@/lib/cn';

const RANGES = [
  { value: '30', label: '30 days' },
  { value: '90', label: '3 months' },
  { value: '365', label: 'A year' },
  { value: 'all', label: 'Everything' },
] as const;

const KINDS = [
  { value: 'all', label: 'Everything' },
  { value: 'expense', label: 'Spending' },
  { value: 'income', label: 'Income' },
  { value: 'lend,borrow,collect,settle', label: 'People' },
  { value: 'transfer', label: 'Moves' },
  { value: 'loan_taken,loan_payment', label: 'Loans' },
] as const;

/** Filters write to the URL, so any view of the ledger is a shareable link. */
export function LedgerFilters({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get('q') ?? '');

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    // typedRoutes cannot verify a URL built at runtime, so the cast is the
    // honest way to say "this is a real route with a query string on it".
    startTransition(() =>
      router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false }),
    );
  };

  // Debounced so a query does not fire on every keystroke.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (search === current) return;
    const timer = setTimeout(() => update('q', search || null), 280);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const range = params.get('range') ?? '30';
  const kind = params.get('kind') ?? 'all';
  const category = params.get('category') ?? 'all';
  const hasFilters = params.toString().length > 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-sm border border-line bg-surface px-2.5">
          <MagnifyingGlass size={14} className="shrink-0 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, categories, people"
            aria-label="Search the ledger"
            className="min-w-0 flex-1 bg-transparent text-[0.875rem] text-ink outline-none placeholder:text-ink-3"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="text-ink-3 hover:text-ink"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>

        <select
          value={category}
          onChange={(e) => update('category', e.target.value)}
          aria-label="Category"
          className="h-9 shrink-0 rounded-sm border border-line bg-surface px-2 text-[0.8125rem] text-ink-2"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="scroll-x flex items-center gap-1.5 pb-0.5">
        <SegmentGroup label="Range" options={RANGES} value={range} onChange={(v) => update('range', v)} />
        <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-line" />
        <SegmentGroup label="Kind" options={KINDS} value={kind} onChange={(v) => update('kind', v)} />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => startTransition(() => router.replace(pathname as Route, { scroll: false }))}
            className="ml-1 shrink-0 rounded-sm px-2 py-1 text-[0.8125rem] text-ink-3 hover:text-ink"
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SegmentGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-1">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'shrink-0 rounded-sm px-2 py-1 text-[0.8125rem] transition-colors duration-[var(--t-state)]',
              active ? 'bg-surface-3 font-medium text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
