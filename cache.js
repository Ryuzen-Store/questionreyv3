/**
 * AI generation cache.
 *
 * Caches validated question arrays by (subject, difficulty, count). Stored in
 * localStorage (2-day TTL). Only quiz content (already public) is cached —
 * never tokens, profile data or anything private.
 */

import { CONFIG } from '../config.js';
import { storage } from '../storage.js';
import { hashKey } from '../utils.js';
import { isQuestionObject } from '../validation.js';

// v2 prevents stale/incompatible question objects from older builds from being reused.
const PREFIX = String(CONFIG.cache.storageKeyPrefix || 'qrquest:cache:').replace(/:v1:?$/, ':v2:');
const TTL = CONFIG.cache.ttlMs;
const MAX = CONFIG.cache.maxEntries;

export function cacheKeyFor(subject, difficulty, count) {
  const encoded = encodeURIComponent(`${subject}|${difficulty}|${count}`);
  return `${PREFIX}${hashKey(`${subject}|${difficulty}|${count}`)}`;
}

/** Write questions into the cache (with meta). */
export function saveCache(subject, difficulty, count, questions) {
  try {
    const key = cacheKeyFor(subject, difficulty, count);
    const entry = {
      key,
      subject,
      difficulty,
      count,
      savedAt: new Date().toISOString(),
      questions,
    };
    storage.setJSON('local', key, entry);
    prune();
  } catch (err) { /* cache is best-effort */ }
}

/** Try to read a fresh cached quiz. */
export function readCache(subject, difficulty, count) {
  try {
    const key = cacheKeyFor(subject, difficulty, count);
    const entry = storage.getJSON('local', key, null);
    if (!entry || !Array.isArray(entry.questions)) return null;
    if (Date.now() - new Date(entry.savedAt || 0).getTime() > TTL) {
      storage.remove('local', key);
      return null;
    }
    // Never trust stale cache data: an older build may have stored an incomplete
    // question shape. Only return a complete, subject-matching quiz.
    const valid = entry.questions.filter((q) => isQuestionObject(q, subject));
    const requested = Math.max(1, Number(count) || 1);
    if (valid.length < requested) {
      storage.remove('local', key);
      return null;
    }
    return valid.slice(0, requested);
  } catch (err) { return null; }
}

/** Delete expired entries; keep the newest MAX entries. */
export function prune() {
  try {
    const keys = storage.keys('local', PREFIX);
    const entries = [];
    const now = Date.now();
    for (const key of keys) {
      const entry = storage.getJSON('local', key, null);
      if (!entry) { storage.remove('local', key); continue; }
      if (now - new Date(entry.savedAt || 0).getTime() > TTL) { storage.remove('local', key); continue; }
      entries.push({ key, savedAt: entry.savedAt || 0 });
    }
    if (entries.length > MAX) {
      entries.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      for (const e of entries.slice(MAX)) storage.remove('local', e.key);
    }
  } catch (err) { /* ignore */ }
}

export default { cacheKeyFor, saveCache, readCache, prune };
