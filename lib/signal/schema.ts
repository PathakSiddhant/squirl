import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Signal's tables. Every one of them is prefixed `signal_`, because Squirl
 * holds one database file and a table belongs to exactly one application.
 *
 * The shape of this schema follows from one product rule: Signal is an inbox,
 * not an archive. What is stored is what is needed to answer "does this still
 * need me", plus the minimum required to never ask again about something
 * already dealt with. There is no watch history here, and nothing counts how
 * much was consumed.
 *
 * Nothing that can be derived is stored. There is no `unresolved_count` on a
 * channel and no `total_waiting` anywhere: a stored count and a queue will
 * eventually disagree, and then there is no way to know which one lied. That
 * is Ledger's rule about running totals, and it holds here for the same reason.
 */

const now = () => Date.now();

// ------------------------------------------------------------- categories

/**
 * Broad subjects. Squirl-flavoured rather than YouTube's own category list,
 * because YouTube's video categories describe a single upload and this
 * describes a channel's standing subject.
 *
 * Seeded with a default set, but they are rows rather than an enum: the user
 * is allowed to rename them, and a classifier that cannot be corrected is a
 * classifier that will be wrong forever.
 */
export const signalCategories = sqliteTable(
  'signal_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Stable key for the seeded rows, so a rename does not orphan a lookup. */
    slug: text('slug').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex('signal_categories_slug_idx').on(t.slug)],
);

/**
 * The narrower thing inside a category. Sport is a category; cricket is a
 * topic. Kept in its own table rather than as a second category column,
 * because a channel genuinely has several and a column would cap it at one.
 */
export const signalTopics = sqliteTable(
  'signal_topics',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    categoryId: text('category_id').references(() => signalCategories.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex('signal_topics_slug_idx').on(t.slug)],
);

// --------------------------------------------------------------- channels

/**
 * A channel the reader deliberately chose. This is the whole input to Signal:
 * nothing arrives here that was not asked for, and there is no mechanism by
 * which anything else could.
 *
 * `enabled` rather than deletion is what "remove a channel" does by default.
 * Content already pulled from it stays put and stays resolvable; the channel
 * simply stops being synced. Deleting the row is a separate, explicit act.
 */
export const signalChannels = sqliteTable(
  'signal_channels',
  {
    id: text('id').primaryKey(),
    /** YouTube's own channel id, `UC...`. The identity everything else hangs off. */
    youtubeId: text('youtube_id').notNull(),
    /**
     * The uploads playlist for this channel, read once from
     * `channels.list(part=contentDetails)`. Monitoring reads this playlist
     * rather than running a search per channel: a playlistItems.list call
     * costs one quota unit and a search.list call costs a hundred, out of a
     * ten thousand unit day that also caps searches at a hundred outright.
     */
    uploadsPlaylistId: text('uploads_playlist_id'),

    title: text('title').notNull(),
    /** The @handle, without the at sign. Absent on older channels. */
    handle: text('handle'),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),
    /** YouTube rounds this to three significant figures, and hides it entirely
     *  on some channels. Stored as read; never presented as exact. */
    subscriberCount: integer('subscriber_count'),

    categoryId: text('category_id').references(() => signalCategories.id, { onDelete: 'set null' }),
    /** True once the reader has corrected the classifier, so a later
     *  re-classification never overwrites a human decision. */
    categoryLocked: integer('category_locked', { mode: 'boolean' }).notNull().default(false),

    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    addedAt: integer('added_at').notNull().$defaultFn(now),

    /**
     * Where the reader put it.
     *
     * Null until something is dragged, and nulls sort last, so an untouched
     * shelf stays in the alphabetical order it already had rather than
     * scrambling itself the first time this column exists.
     */
    position: integer('position'),

    // --- sync checkpoint -------------------------------------------------
    //
    // Kept on the channel rather than in a parallel one-to-one table. It is
    // exactly one row per channel with the same lifetime, and a second table
    // to hold four columns would be structure for its own sake.

    /** Last sync that completed without error. The anchor for catch-up: a
     *  reconnect asks "what is new since this", not "what happened in the last
     *  fifteen minutes", so time spent offline cannot open a gap. */
    lastSyncedAt: integer('last_synced_at'),
    /** Newest video id seen on the uploads playlist. Lets a sync stop reading
     *  pages the moment it reaches known ground. */
    lastSeenVideoId: text('last_seen_video_id'),
    syncStatus: text('sync_status', { enum: ['never', 'ok', 'error'] }).notNull().default('never'),
    /** Human-readable, and shown as such. Raw API errors never reach a screen. */
    lastError: text('last_error'),
    /** Consecutive failures, for backoff. Reset to zero by any success. */
    failureCount: integer('failure_count').notNull().default(0),
  },
  (t) => [
    uniqueIndex('signal_channels_youtube_idx').on(t.youtubeId),
    index('signal_channels_enabled_idx').on(t.enabled),
    index('signal_channels_category_idx').on(t.categoryId),
    index('signal_channels_position_idx').on(t.position),
  ],
);

/** A channel's narrower subjects. Many per channel, none required. */
export const signalChannelTopics = sqliteTable(
  'signal_channel_topics',
  {
    channelId: text('channel_id')
      .notNull()
      .references(() => signalChannels.id, { onDelete: 'cascade' }),
    topicId: text('topic_id')
      .notNull()
      .references(() => signalTopics.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('signal_channel_topics_pair_idx').on(t.channelId, t.topicId),
    index('signal_channel_topics_channel_idx').on(t.channelId),
  ],
);

// ---------------------------------------------------------------- content

/**
 * What kind of thing this is.
 *
 * Derived at sync time from `snippet.liveBroadcastContent` and the duration,
 * rather than stored as YouTube reports it, because YouTube has no "short" of
 * its own in this response: a short is an ordinary video that happens to be
 * brief and vertical. The distinction is made once, here, so no screen has to
 * work it out again.
 */
export const CONTENT_KINDS = ['video', 'short', 'live', 'upcoming'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

/**
 * Where an item is in its life.
 *
 * The whole product is this list being short. `unseen` is the queue; the other
 * three are all ways of leaving it, and only `snoozed` comes back.
 */
export const CONTENT_STATES = ['unseen', 'snoozed', 'done', 'dismissed'] as const;
export type ContentState = (typeof CONTENT_STATES)[number];

/**
 * One piece of content, and what the reader has decided about it.
 *
 * State lives on this row rather than in a separate `content_state` table. It
 * is one-to-one and created at the same instant, and the queue reads it on
 * every single query; splitting it would add a join to the hottest path in the
 * product to buy nothing.
 *
 * The unique index on `youtube_id` is what makes sync idempotent. Running the
 * same sync twice, or reconnecting mid-page, cannot duplicate a row, and an
 * item already marked done cannot be resurrected as unseen by a later pass,
 * because the insert conflicts and the state column is never part of what an
 * upsert is allowed to overwrite.
 */
export const signalContent = sqliteTable(
  'signal_content',
  {
    id: text('id').primaryKey(),
    youtubeId: text('youtube_id').notNull(),
    channelId: text('channel_id')
      .notNull()
      .references(() => signalChannels.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),

    kind: text('kind', { enum: CONTENT_KINDS }).notNull(),
    /** Seconds. Null while a stream is upcoming, because it has no length yet. */
    durationSeconds: integer('duration_seconds'),

    /** When YouTube published it. Epoch milliseconds: unlike Ledger, whose day
     *  is the unit that matters, an upcoming stream is at a time. */
    publishedAt: integer('published_at').notNull(),
    /** For a scheduled broadcast, when it is meant to begin. */
    scheduledAt: integer('scheduled_at'),
    /** For a broadcast that started, when it actually did. */
    startedAt: integer('started_at'),

    // --- the reader's decision -------------------------------------------

    state: text('state', { enum: CONTENT_STATES }).notNull().default('unseen'),
    /** Set only while snoozed. The moment this passes, the item is back in the
     *  queue; no job has to run to put it there, because the queue asks. */
    snoozedUntil: integer('snoozed_until'),
    /** When it left the queue. Kept so an accidental dismissal can be undone,
     *  not so anything can be counted. */
    processedAt: integer('processed_at'),

    discoveredAt: integer('discovered_at').notNull().$defaultFn(now),
    updatedAt: integer('updated_at').notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex('signal_content_youtube_idx').on(t.youtubeId),
    // The queue's own index: everything unresolved, newest first.
    index('signal_content_state_idx').on(t.state, t.publishedAt),
    index('signal_content_channel_idx').on(t.channelId, t.publishedAt),
    index('signal_content_kind_idx').on(t.kind),
    // Snoozed items waking up.
    index('signal_content_snooze_idx').on(t.snoozedUntil),
    check(
      'signal_content_snooze_needs_time',
      sql`(${t.state} <> 'snoozed') OR (${t.snoozedUntil} IS NOT NULL)`,
    ),
    check('signal_content_duration_sane', sql`${t.durationSeconds} IS NULL OR ${t.durationSeconds} >= 0`),
  ],
);

// ------------------------------------------------------------------ types

export type SignalChannel = typeof signalChannels.$inferSelect;
export type SignalContent = typeof signalContent.$inferSelect;
export type SignalCategory = typeof signalCategories.$inferSelect;
export type SignalTopic = typeof signalTopics.$inferSelect;
