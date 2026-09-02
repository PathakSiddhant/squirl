import { Lockup } from '@/components/brand/logo';

/**
 * What you see for the first second after Squirl opens.
 *
 * Deliberately short and deliberately quiet. An opening is a held breath, not a
 * performance: the mark settles, a rule draws itself beneath, and the sheet
 * lifts. There is no spinner, because nothing is being waited for, and
 * pretending otherwise would be theatre.
 *
 * The mark is centred in the window and drawn at the size the lock screen uses
 * for its own, so the sheet lifting reads as one continuous moment rather than
 * as two separate screens.
 *
 * All of the motion lives in globals.css so that it runs on the first paint
 * rather than after hydration, and so a failed script cannot leave the sheet
 * stuck over the interface. This component is only the markup.
 */
export function BootScreen() {
  return (
    <div className="boot" aria-hidden="true">
      <div className="flex flex-col items-center">
        <Lockup size={104} className="boot-mark" alt="" />
        <span className="boot-rule mt-6" />
      </div>
    </div>
  );
}
