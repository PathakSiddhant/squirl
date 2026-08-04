'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { exportLedger, savePreferences } from '@/app/actions/accounts';
import { formatMoney, parseAmount, toRupees } from '@/lib/money';

import { Button } from '../ui/button';
import { Field, Input } from '../ui/primitives';

export function PreferencesForm({
  horizonDays,
  buffer,
  burnWindowDays,
}: {
  horizonDays: number;
  buffer: number;
  burnWindowDays: number;
}) {
  const [horizon, setHorizon] = useState(String(horizonDays));
  const [bufferValue, setBufferValue] = useState(String(toRupees(buffer)));
  const [burnWindow, setBurnWindow] = useState(String(burnWindowDays));
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const parsedBuffer = parseAmount(bufferValue) ?? 0;
    startTransition(async () => {
      const result = await savePreferences({
        horizonDays: Number(horizon) || 30,
        buffer: parsedBuffer,
        burnWindowDays: Number(burnWindow) || 7,
      });
      if (result.ok) toast.success('Saved');
      else toast.error(result.error);
    });
  };

  return (
    <div className="px-4 pb-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          label="Look ahead, days"
          hint="How far forward a promise counts against today"
        >
          <Input value={horizon} onChange={(e) => setHorizon(e.target.value)} inputMode="numeric" />
        </Field>

        <Field label="Buffer" hint="A floor you never want to dip below">
          <Input
            value={bufferValue}
            onChange={(e) => setBufferValue(e.target.value)}
            inputMode="decimal"
          />
        </Field>

        <Field label="Burn window, days" hint="Trailing days used for the daily average">
          <Input value={burnWindow} onChange={(e) => setBurnWindow(e.target.value)} inputMode="numeric" />
        </Field>
      </div>

      <p className="mt-3 text-[0.8125rem] text-ink-3">
        With these, safe to spend is what you hold, minus everything due in the next {horizon || 30}{' '}
        days, minus a {formatMoney(parseAmount(bufferValue) ?? 0)} buffer.
      </p>

      <Button className="mt-3" variant="primary" onClick={submit} disabled={pending}>
        Save
      </Button>
    </div>
  );
}

export function ExportButton() {
  const [pending, startTransition] = useTransition();

  const download = () => {
    startTransition(async () => {
      const json = await exportLedger();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `squirl-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Exported');
    });
  };

  return (
    <Button variant="secondary" onClick={download} disabled={pending}>
      Download everything as JSON
    </Button>
  );
}
