import { ExportButton, PreferencesForm } from '@/components/settings/preferences-form';
import { PageHeader, Panel, PanelHeader } from '@/components/ui/primitives';
import { CAPTURE_EXAMPLES } from '@/lib/domain/capture';
import { getPreferences } from '@/lib/queries/reference';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const preferences = await getPreferences();

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="How the safe-to-spend number is worked out" />

      <Panel>
        <PanelHeader
          title="Safe to spend"
          hint="These three numbers decide the figure on the home screen"
        />
        <PreferencesForm
          horizonDays={preferences.horizonDays}
          buffer={preferences.buffer}
          burnWindowDays={preferences.burnWindowDays}
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Quick capture"
          hint="Everything the capture bar understands. It parses on your machine, with no model call."
        />
        <div className="px-4 pb-4">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {CAPTURE_EXAMPLES.map((example) => (
              <li
                key={example}
                className="rounded-sm border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[0.8125rem] text-ink-2"
              >
                {example}
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-[68ch] text-[0.8125rem] text-ink-3">
            Dates work as today, yesterday, kal, aaj, 3 days ago, last friday, 2 aug, 12/7 or
            2026-07-12. Amounts take k and L, so 1.2k is 1,200. Naming a person you have not added
            yet creates them.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Your data"
          hint="One SQLite file on this machine. Nothing is sent anywhere."
        />
        <div className="px-4 pb-4">
          <p className="mb-3 max-w-[68ch] text-[0.875rem] text-ink-2">
            Everything lives in <code className="font-mono text-[0.8125rem] text-ink">data/hisaab.db</code>.
            Copy that file and you have copied your entire financial history. Delete it and nothing
            of yours remains. There is no account, no sync and no server.
          </p>
          <ExportButton />
        </div>
      </Panel>
    </div>
  );
}
