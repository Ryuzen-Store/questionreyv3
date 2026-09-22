/**
 * Supabase Realtime orchestration.
 *
 * Provides scoped subscriptions:
 *   - player:  own profile + own quiz_logs (updated after finishing a quiz)
 *   - admin:   ALL profiles + ALL quiz_logs + system_settings (server_status)
 *   - status:  system_settings only (server_status for the global header)
 *
 * Every subscription is tracked and can be torn down by `unsubscribeScope`.
 * Pages call subscribe/unsubscribe on init/dispose so channels are only open
 * while they are needed.
 */

import { CONFIG } from '../config.js';
import { tryGetClient } from './client.js';

const T = CONFIG.supabase.tables;

/** Registry of active channel names -> unsubscribe fn. */
const channels = new Map();
const scopeChannels = new Map(); // scope -> Set(channelKey)

function resolveClient() {
  return { client: tryGetClient(), ok: Boolean(tryGetClient()) };
}

/**
 * Open a realtime channel with a Postgres Change listener.
 * @param {string} channelKey unique key (deduplicated)
 * @param {object} opts { table, event?, filter?, cb }
 */
function openChannel(scope, channelKey, opts) {
  const { client } = resolveClient();
  if (!client) return () => {};
  if (channels.has(channelKey)) return () => {}; // already subscribed

  const table = opts.table;
  const onDmlEvent = (payload) => {
    try { opts.cb(payload.new, payload.old, payload.eventType); } catch (err) { console.error('[realtime cb]', err); }
  };

  let channel;
  try {
    channel = client
      .channel(channelKey, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: opts.event || '*', schema: 'public', table, filter: opts.filter || undefined }, onDmlEvent)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.debug(`[realtime] subscribed ${channelKey}`);
        if (err) console.warn(`[realtime] ${channelKey}:`, err.message);
      });
  } catch (err) {
    console.warn('[realtime] failed to open channel', channelKey, err);
    return () => {};
  }

  const unsubscribe = () => {
    try {
      if (channels.has(channelKey)) {
        const c = channels.get(channelKey);
        try { c.channel.unsubscribe(); } catch (e) { /* ignore */ }
        channels.delete(channelKey);
      } else if (channel) {
        client.removeChannel(channel);
      }
    } catch (err) { /* ignore */ }
    const set = scopeChannels.get(scope);
    if (set) set.delete(channelKey);
  };

  const entry = { channel, unsubscribe };
  channels.set(channelKey, entry);
  if (!scopeChannels.has(scope)) scopeChannels.set(scope, new Set());
  scopeChannels.get(scope).add(channelKey);
  return unsubscribe;
}

/**
 * Subscribe a callback to table changes within a scope.
 */
export function subscribeToTable(scope, table, cb, filter = undefined, event = '*') {
  const channelKey = `${CONFIG.realtime.channelNS}:${scope}:${table}:${filter || 'all'}`;
  return openChannel(scope, channelKey, { table, filter, cb, event });
}

/** Unsubscribe every channel registered to a scope. */
export function unsubscribeScope(scope) {
  const keys = Array.from(scopeChannels.get(scope) || []);
  for (const key of keys) {
    const entry = channels.get(key);
    if (entry) entry.unsubscribe();
  }
}

/** Tear down ALL channels (full sign-out / reset). */
export function unsubscribeAll() {
  for (const key of Array.from(channels.keys())) {
    const entry = channels.get(key);
    if (entry) entry.unsubscribe();
  }
  scopeChannels.clear();
}

/* ---------------- presets ---------------- */

/** Subscribe to global server_status from system_settings. */
export function subscribeServerStatus(onStatus) {
  return subscribeToTable('status', T.systemSettings, (row) => {
    if (!row) return;
    if (row.key === CONFIG.supabase.settingsKeys.serverStatus) {
      onStatus(String(row.value || '').toLowerCase() === 'offline' ? 'offline' : 'online');
    }
  }, `key=eq.${CONFIG.supabase.settingsKeys.serverStatus}`);
}

/** Player scope: my profile changes. */
export function subscribeOwnProfile(userId, onChange) {
  if (!userId) return () => {};
  return subscribeToTable('player', T.profiles, onChange, `id=eq.${userId}`);
}

/** Player scope: my quiz_logs inserts. */
export function subscribeOwnQuizLogs(userId, onInsert) {
  if (!userId) return () => {};
  return subscribeToTable('player', T.quizLogs, onInsert, `user_id=eq.${userId}`, 'INSERT');
}

/** Admin scope: all profiles. */
export function subscribeAllProfiles(onChange) {
  return subscribeToTable('admin', T.profiles, (row) => onChange(row), undefined, '*');
}

/** Admin scope: all quiz_logs. */
export function subscribeAllQuizLogs(onChange) {
  return subscribeToTable('admin', T.quizLogs, (row) => onChange(row), undefined, '*');
}

/** Admin scope: system_settings changes (server status + AI keys). */
export function subscribeSystemSettings(onChange) {
  return subscribeToTable('admin', T.systemSettings, (row) => onChange(row), undefined, '*');
}

export default {
  subscribeToTable, unsubscribeScope, unsubscribeAll,
  subscribeServerStatus, subscribeOwnProfile, subscribeOwnQuizLogs,
  subscribeAllProfiles, subscribeAllQuizLogs, subscribeSystemSettings,
};
