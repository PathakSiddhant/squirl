import { MobileHeader, Sidebar, TabBar } from '@/components/shell/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
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
