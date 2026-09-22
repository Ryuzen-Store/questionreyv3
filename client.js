/**
 * Supabase client bootstrap. Resolves the v2 client constructor from a CDN
 * global, validates configuration, and exposes a lazily-created singleton.
 *
 * Only the PUBLISHABLE anon key is used. Service-role keys are NEVER read in
 * frontend code. Authorization is enforced server-side by RLS.
 */

import { CONFIG } from '../config.js';
import { toast } from '../components/toast.js';

let clientInstance = null;

/** Resolve the Supabase constructor (window.supabase from the loaded CDN). */
export function getSupabaseConstructor() {
  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    return window.supabase.createClient;
  }
  return null;
}

export function isSupabaseAvailable() {
  return Boolean(getSupabaseConstructor());
}

/**
 * Create (or reuse) the Supabase client.
 * Throws when unavailable — app rows handle that by entering offline/guest mode.
 */
export function getClient() {
  if (clientInstance) return clientInstance;
  const createClient = getSupabaseConstructor();
  if (!createClient) {
    const err = new Error('Supabase client library tidak dimuat.');
    err.code = 'SUPABASE_UNAVAILABLE';
    throw err;
  }
  if (!CONFIG.supabase.url || !CONFIG.supabase.anonKey) {
    const err = new Error('Konfigurasi Supabase belum lengkap.');
    err.code = 'SUPABASE_MISCONFIGURED';
    throw err;
  }
  clientInstance = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'qrquest.auth.token',
    },
    global: { headers: { 'x-questionry-client': 'web' } },
    realtime: { params: { eventsPerSecond: 6 } },
  });
  return clientInstance;
}

/** Returns the client, or null (never throws) — used by ambient code paths. */
export function tryGetClient() {
  try { return getClient(); } catch (err) { return null; }
}

export async function checkSupabaseHealth() {
  const client = tryGetClient();
  if (!client) return { ok: false, reason: 'lib' };
  try {
    const start = Date.now();
    const { error } = await client.from(CONFIG.supabase.tables.systemSettings)
      .select('key', { count: 'exact', head: true });
    const latency = Date.now() - start;
    // Any structured Supabase error (RLS hidden rows are not an error here).
    if (error) return { ok: false, reason: error.code || 'error', latency };
    return { ok: true, latency };
  } catch (err) {
    return { ok: false, reason: 'network', latency: null };
  }
}

/**
 * Attempt to reset the client (e.g. after sign-out). The realtime manager
 * must be torn down independently (see realtime.js).
 */
export function invalidateClient() {
  clientInstance = null;
}

/**
 * Post a structured "client log" — invoked on unexpected environment errors so
 * the developer can see what happened. Harmless when Supabase is unavailable.
 */
export function reportClientEvent(event, detail = {}) {
  const client = tryGetClient();
  if (!client) return;
  try {
    client.from('client_events').insert({ event, payload: detail }).then(() => {}).catch(() => {});
  } catch (err) { /* ignore */ }
}

// Ambient initialization check (single toast, no spam)
let warnedUnavailable = false;
export function ambientWarnUnavailable() {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  try {
    toast({ type: 'warning', icon: 'i-server', title: 'Mode offline', message: 'Layanan Supabase tidak terhubung — berjalan sebagai tamu dengan bank soal lokal.' });
  } catch (err) { /* toast host may not be ready */ }
}
