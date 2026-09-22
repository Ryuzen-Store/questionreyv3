/**
 * Data-access functions over Supabase. RLS enforces ownership + role rules on
 * the server; every function here assumes the current authenticated user
 * context and NEVER sends service-role credentials.
 */

import { CONFIG } from '../config.js';
import { getClient, tryGetClient } from './client.js';
import { rid, debounce } from '../utils.js';

const T = CONFIG.supabase.tables;

/* ================= profile ================= */

/**
 * Fetch my own profile. When the row is missing (e.g. trigger not installed)
 * a best-effort client-side upsert is attempted ONCE using the anon key. If
 * RLS blocks it, the app keeps working in memory (guest-like) rather than
 * crashing — read-only bookkeeping follows RLS as well.
 */
export async function getMyProfile(userId) {
  const client = tryGetClient();
  if (!client || !userId) return null;
  const { data, error } = await client
    .from(T.profiles)
    .select('id, email, player_tag, role, score, correct_total, device_info, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) {
    return bestEffortProfileUpsert(userId).catch(() => null);
  }
  return data;
}

let profileUpsertAttempts = new Set();

/**
 * Best effort (non-fatal) profile ensure. Production deployments should rely
 * on the SQL trigger `handle_new_user` that inserts into profiles on sign-up.
 */
export async function bestEffortProfileUpsert(userId, email = '') {
  const client = tryGetClient();
  if (!client || !userId || profileUpsertAttempts.has(userId)) return null;
  profileUpsertAttempts.add(userId);
  const base = {
    id: userId,
    updated_at: new Date().toISOString(),
  };
  if (email) base.email = email;
  const generated = await generatePlayerTag();
  base.player_tag = generated;
  base.role = CONFIG.auth.playerRole;
  base.score = 0;
  // Use upsert with onConflict so a pre-existing row is preserved.
  const { data, error } = await client
    .from(T.profiles)
    .upsert({ ...base, id: userId }, { onConflict: 'id' })
    .select()
    .maybeSingle();
  if (error) {
    profileUpsertAttempts.delete(userId);
    return null;
  }
  return data;
}

/** Update my own profile fields (player_tag only — role/score are protected). */
export async function updateMyProfile(userId, patch = {}) {
  const client = getClient();
  const allowed = {};
  if (typeof patch.player_tag === 'string' && patch.player_tag.trim()) {
    allowed.player_tag = patch.player_tag.trim();
  }
  // Device/IP/battery presence is stored inside the existing JSONB column,
  // so no extra database columns are required.
  if (patch.device_info && typeof patch.device_info === 'object' && !Array.isArray(patch.device_info)) {
    allowed.device_info = patch.device_info;
  }
  if (!Object.keys(allowed).length) return { data: null, error: null };
  allowed.updated_at = new Date().toISOString();
  const { data, error } = await client
    .from(T.profiles)
    .update(allowed)
    .eq('id', userId)
    .select()
    .maybeSingle();
  return { data, error };
}

/** Save the current browser/device presence for the signed-in user. */
export async function syncDevicePresence(userId, existing = {}) {
  if (!userId) return null;
  const info = existing && typeof existing === 'object' ? { ...existing } : {};
  info.device = getBrowserDeviceLabel();
  info.type = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '') ? 'Mobile' : 'Desktop';
  info.last_seen = new Date().toISOString();

  try {
    const response = await fetch('https://api4.ipify.org?format=json', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data?.ip) info.ip = String(data.ip);
    }
  } catch (_) { /* IP is optional */ }

  try {
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      info.battery = Math.round(Number(battery.level || 0) * 100);
    }
  } catch (_) { /* battery API is optional */ }

  const { data } = await updateMyProfile(userId, { device_info: info });
  return data || { device_info: info };
}

function getBrowserDeviceLabel() {
  const ua = String(navigator?.userAgent || '');
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s[^;)]*;\s*(?:[^;)]*;\s*)?([^;)]+?)(?:\s+Build\/[^;)]+)?[;) ]/i);
    return match?.[1]?.trim() || 'Android';
  }
  return /Mobi/i.test(ua) ? 'Mobile' : 'Desktop';
}

/**
 * Generate a unique player tag like "RIAN_4821" or "PLAYER-A7F3".
 * Collision handling relies on the DB unique constraint + fallback suffix.
 */
export async function generatePlayerTag() {
  const adjectives = ['NJAGEL', 'KAPTI', 'RAYA', 'TAMA', 'SETIA', 'CITRA', 'LINTANG', 'BIMA', 'SAKA', 'PRAM'];
  const noun = ['QUEST', 'PLAYER', 'PION', 'RONA', 'KILAT', 'PENA', 'ARKA', 'RAYA', 'ZOLA', 'VIKA'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const suffix = rid(3).toUpperCase();
  return `${pick(adjectives)}_${pick(noun)}${suffix}`;
}

/* ================= quiz logs ================= */

/** Insert a finished quiz (RLS: owned row). */
export async function insertQuizLog(payload) {
  const client = getClient();
  const { user } = (await client.auth.getUser()).data || {};
  const row = {
    user_id: user ? user.id : null,
    subject: payload.subject || 'Umum',
    difficulty: payload.difficulty || 'Normal',
    total_questions: payload.totalQuestions || 0,
    correct_count: payload.correctCount || 0,
    score: payload.score || 0,
    answers: Array.isArray(payload.answers) ? payload.answers : [],
    device_info: payload.deviceInfo || null,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await client.from(T.quizLogs).insert(row).select().maybeSingle();
  if (error) console.warn('[db] insertQuizLog', error.message);
  return { data, error };
}

/** Fetch my quiz history (RLS: only the caller's rows are returned). */
export async function getMyQuizLogs() {
  const client = tryGetClient();
  if (!client) return [];
  const { data, error } = await client
    .from(T.quizLogs)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return [];
  return data || [];
}

/* ================= questions (public catalog) ================= */

/** Fetch questions from the curated database (optional filter). */
export async function getQuestionsFromDb({ subject = null } = {}) {
  const client = tryGetClient();
  if (!client) return [];
  let query = client.from(T.questions).select('*').limit(500);
  if (subject) query = query.eq('subject', subject);
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

/* ================= system settings ================= */

/** Read system settings (public rows only — keys must be RLS-readable). */
export async function getSystemSettings() {
  const client = tryGetClient();
  if (!client) return {};
  const { data, error } = await client.from(T.systemSettings).select('key, value');
  if (error) return {};
  const out = {};
  for (const row of data || []) out[row.key] = row.value;
  return out;
}

/** Determine effective server_status from settings key. */
export async function readServerStatus() {
  const settings = await getSystemSettings();
  const raw = settings[CONFIG.supabase.settingsKeys.serverStatus];
  return String(raw || '').toLowerCase() === 'offline' ? 'offline' : 'online';
}

/* ================= admin (RLS-gated: role = owner) ================= */

/**
 * Strict ownership check. When `useCache` is true, the current profile is
 * passed in (cached after login); otherwise it re-reads the profile from the
 * database so a stale UI cannot grant access.
 */
export function isOwner(profile) {
  return Boolean(
    profile &&
    profile.role === CONFIG.auth.ownerRole &&
    String(profile.email || '').trim().toLowerCase() === CONFIG.auth.ownerEmail.toLowerCase()
  );
}

export async function adminFetchProfiles() {
  const client = getClient();
  const { data, error } = await client
    .from(T.profiles)
    .select('id, email, player_tag, role, score, correct_total, device_info, created_at, updated_at')
    .order('score', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

export async function adminFetchQuizLogs() {
  const client = getClient();
  const { data, error } = await client
    .from(T.quizLogs)
    .select('id, user_id, subject, difficulty, total_questions, correct_count, score, answers, device_info, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

export async function adminFetchUserQuizLogs(userId) {
  const client = getClient();
  const { data, error } = await client
    .from(T.quizLogs)
    .select('id, user_id, subject, difficulty, total_questions, correct_count, score, answers, device_info, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function adminUpdateUserRole(userId, role) {
  if (!['player','einstein','owner'].includes(role)) throw new Error('Role tidak valid.');
  const client = getClient();
  const { data, error } = await client
    .from(T.profiles)
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function adminGetSystemSettings() {
  const client = getClient();
  const { data, error } = await client.from(T.systemSettings).select('key, value');
  if (error) throw error;
  const out = {};
  for (const row of data || []) out[row.key] = row.value;
  return out;
}

export async function adminSetSystemSetting(key, value) {
  const client = getClient();
  const { data, error } = await client
    .from(T.systemSettings)
    .upsert({ key, value: String(value ?? '') }, { onConflict: 'key' })
    .select('key, value')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function adminSetServerStatus(status) {
  const client = getClient();
  const { data, error } = await client
    .from(T.systemSettings)
    .upsert({ key: CONFIG.supabase.settingsKeys.serverStatus, value: status }, { onConflict: 'key' });
  if (error) throw error;
  return data;
}

/**
 * Compose a Supabase row filter SQL string for an arbitrary quiz_logs query —
 * used to compute per-subject aggregates with fewer round-trips. Returns
 * `null` when the configured tables differ from the default schema, in which
 * case callers fall back to client-side aggregation.
 */
export function buildQuizFilterSql(kind) {
  if (T.quizLogs !== 'quiz_logs') return null;
  const filters = {
    since_last_7_days: "created_at >= (now() - interval '7 days')",
    'subject.eq.Matematika': "subject = 'Matematika'",
    'subject.eq.IPA': "subject = 'IPA'",
    'subject.eq.IPS': "subject = 'IPS'",
    'subject.eq.Sejarah': "subject = 'Sejarah'",
    'subject.eq.Informatika': "subject = 'Informatika'",
  };
  return filters[kind] || null;
}

export default {
  getMyProfile, updateMyProfile, syncDevicePresence, bestEffortProfileUpsert, generatePlayerTag, isOwner,
  insertQuizLog, getMyQuizLogs, getQuestionsFromDb,
  getSystemSettings, readServerStatus,
  adminFetchProfiles, adminFetchQuizLogs, adminFetchUserQuizLogs,
  adminUpdateUserRole, adminGetSystemSettings, adminSetSystemSetting, adminSetServerStatus, buildQuizFilterSql,
};
