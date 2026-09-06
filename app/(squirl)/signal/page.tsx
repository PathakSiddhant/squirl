import { listChannels } from '@/lib/signal/channels';
import { SIGNAL_EPOCH, beforeBaseline } from '@/lib/signal/epoch';
import { getQueue, groupByDay, orderByShelf } from '@/lib/signal/queue';
import { Inbox } from '@/components/signal/inbox';

export const metadata = { title: 'Signal' };

// The queue is read from the local database on every visit. It is the truth,
// and it changes underneath the page whenever the background sync runs.
export const dynamic = 'force-dynamic';

/**
 * What is waiting.
 *
 * The only screen that matters in Signal. Everything on it is read from the
 * local database, so it renders identically with the network unplugged, and
 * nothing here calls YouTube: the sync engine put these rows here at some
 * earlier point, and whether that was two minutes or two days ago changes
 * nothing about the page's ability to draw itself.
 */
export default async function SignalInbox() {
  const [items, channels] = await Promise.all([getQueue(), listChannels()]);

  const groups = groupByDay(items);
  const live = orderByShelf(items.filter((item) => item.kind === 'live'));

  return (
    <Inbox
      groups={groups}
      live={live}
      channelCount={channels.filter((channel) => channel.enabled).length}
      baselineAt={beforeBaseline() ? SIGNAL_EPOCH : null}
    />
  );
}
