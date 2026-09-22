/**
 * Supabase Auth helpers: session, sign-in/sign-up/sign-out, listener wiring,
 * Google OAuth, guest (anonymous) sessions.
 *
 * The result page for Google login is the home of the app — Supabase will
 * receive a hash fragment with provider tokens and complete the session.
 */

import { CONFIG } from '../config.js';
import { getClient, tryGetClient } from './client.js';
import { getMyProfile } from './database.js';

/* ---------------- session ---------------- */

export async function getSession() {
  const client = tryGetClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) return null;
    return data && data.session ? data.session : null;
  } catch (err) { return null; }
}

export async function getUser() {
  const client = tryGetClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (err) { return null; }
}

export async function getTokens() {
  const session = await getSession();
  return session ? { access_token: session.access_token, refresh_token: session.refresh_token } : null;
}

/* ---------------- actions ---------------- */

export async function signInWithEmail(email, password) {
  const client = getClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password) {
  const client = getClient();
  const redirectTo = window.location.origin + window.location.pathname;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const client = getClient();
  const redirectTo = window.location.origin + window.location.pathname;
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  return data;
}

export async function signInAsGuest() {
  const client = getClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = tryGetClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) console.warn('[auth] signOut error', error.message);
}

/** Full sign-out + local cleanup performed by app.js / onAuthChange handlers. */
export async function signOutAndCleanup(extraCleanup = null) {
  try { await signOut(); } catch (err) { /* ignore */ }
  if (typeof extraCleanup === 'function') extraCleanup();
}

/* ---------------- listeners ---------------- */

const listeners = new Set();

/**
 * Register a callback invoked with (event, session) whenever auth state
 * changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc).
 */
export function onAuthStateChange(callback) {
  const client = tryGetClient();
  if (!client) return () => {};
  const wrapped = (event, session) => callback(event, session);
  listeners.add(wrapped);
  const { data } = client.auth.onAuthStateChange((event, session) => {
    for (const l of listeners) {
      try { l(event, session); } catch (err) { console.error('[auth listener]', err); }
    }
  });
  const sub = data ? data.subscription : null;
  return () => {
    listeners.delete(wrapped);
    if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
  };
}

/**
 * Best-effort profile object: null (no session), or a merged record of the
 * Supabase user email + the `profiles` row (guaranteed by the ensureProfile
 * trigger) with player_tag/role/score. Callers must handle null.
 */
export async function getCurrentUserProfile() {
  const user = await getUser();
  if (!user) return null;
  const profile = await getMyProfile(user.id);
  return {
    id: user.id,
    email: user.email || user.email_confirmable || '',
    isAnonymous: Boolean(user.is_anonymous),
    app_metadata: user.app_metadata || {},
    ...(profile || {}),
  };
}
