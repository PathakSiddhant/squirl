import { MobileHeader, Sidebar, TabBar } from '@/components/shell/sidebar';

/**
 * Ledger's own shell.
 *
 * `app-ledger` fills the --app-accent slot with Ledger's forest green for
 * everything nested inside, which is how you can tell at a glance which
 * application you are standing in. The money palette is untouched by it: an
 * accent marks the place, data keeps its own colours.
 */
export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-ledger flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        {/* Bottom padding clears the mobile tab bar. */}
        <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
        <TabBar />
      </div>
    </div>
  );
}
