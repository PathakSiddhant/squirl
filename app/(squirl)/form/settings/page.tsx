import { SettingsPanel } from '@/components/form/settings-panel';
import { getActivePhase } from '@/lib/form/phases';
import { getProfile } from '@/lib/form/profile';

export const metadata = { title: 'Settings · Form' };
export const dynamic = 'force-dynamic';

/** What Form tracks, and how it reads things back. */
export default async function FormSettings() {
  const [profile, phase] = await Promise.all([getProfile(), getActivePhase()]);
  return <SettingsPanel profile={profile} phase={phase} />;
}
