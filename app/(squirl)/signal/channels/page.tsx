import { ensureCategories } from '@/lib/signal/categories';
import { listChannels } from '@/lib/signal/channels';
import { ChannelManager } from '@/components/signal/channel-manager';

export const metadata = { title: 'Channels · Signal' };
export const dynamic = 'force-dynamic';

/**
 * The watched set.
 *
 * This screen is the entire input to Signal. Everything in the inbox arrived
 * because a channel is listed here, which is what makes the queue finite and
 * what makes it honest to say there is no algorithm underneath it.
 */
export default async function SignalChannels() {
  const [channels, categories] = await Promise.all([listChannels(), ensureCategories()]);

  return (
    <ChannelManager
      channels={channels}
      categories={categories.map((row) => ({ id: row.id, name: row.name, slug: row.slug }))}
    />
  );
}
