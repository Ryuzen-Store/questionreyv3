/**
 * Shared utility helpers: DOM, escaping, formatting, ids, delay, debounce,
 * hash, platform helpers. No UI framework — plain functions.
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create an element from an HTML string (safe for trusted template strings). */
export function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

/** Escape user content before injecting into innerHTML. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Normalize a value to an integer or a fallback. */
export function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Generates a short random id (not cryptographic). */
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Cryptographically random id when available. */
export function rid(len = 16) {
  const bytes = new Uint8Array(len);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Sleep helper. */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Debounce: postpone calling fn until `wait` ms have passed without a call. */
export function debounce(fn, wait = 250) {
  let timer = null;
  const debounced = function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
  debounced.cancel = () => { clearTimeout(timer); timer = null; };
  return debounced;
}

/** Throttle to at most one call per `limit` ms (trailing call included). */
export function throttle(fn, limit = 200) {
  let last = 0;
  let trailing = null;
  return function (...args) {
    const now = Date.now();
    if (now - last >= limit) {
      last = now;
      fn.apply(this, args);
    } else {
      clearTimeout(trailing);
      trailing = setTimeout(() => {
        last = Date.now();
        fn.apply(this, args);
      }, limit - (now - last));
    }
  };
}

/* ---------------- formatting ---------------- */

const ID_LOCALE = 'id-ID';

/** Format a number with Indonesian locale. */
export function fmtNumber(value) {
  return new Intl.NumberFormat(ID_LOCALE).format(toInt(value));
}

/** Format date/time as compact Indonesian locale string. */
export function fmtDateTime(input) {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(ID_LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export function fmtDate(input) {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(ID_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

/** Simple short relative time ("3 mnt lalu"). */
export function relTime(input) {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 30) return 'baru saja';
  if (s < 3600 * 1.5) return `${Math.max(1, Math.floor(s / 60))} mnt lalu`;
  if (s < 86400 * 7) return `${Math.floor(s / 3600)} jam lalu`;
  return fmtDate(d);
}

/**
 * Human label for elapsed seconds — used for the quiz timer (mm:ss).
 */
export function fmtDuration(totalSeconds) {
  const s = clamp(Math.floor(totalSeconds), 0, 359999);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/* ---------------- routing / platform ---------------- */

/** Get current hash route (e.g. '#/quiz' -> '/quiz'). */
export function currentRoutePath() {
  const h = window.location.hash || '#/';
  const path = h.startsWith('#') ? h.slice(1) : h;
  return path || '/';
}

/** True when the browser is roughly mobile-width. */
export function isMobile() {
  return window.innerWidth < 768;
}

/** Escape a regex special characters. */
export function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Basic email validation. */
export function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(str || ''));
}

/**
 * Shuffle in place + return a new array (Fisher-Yates).
 */
export function shuffle(arr) {
  const a = Array.from(arr);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic string hash used for cache keys. */
export function hashKey(str) {
  let h = 5381;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Pick N random distinct items from an array (without replacement). */
export function pickRandom(arr, n) {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

/** Deep-clone via structuredClone when available. */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

export default {
  $, $$, el, esc, toInt, clamp, uid, rid, sleep, debounce, throttle,
  fmtNumber, fmtDateTime, fmtDate, relTime, fmtDuration,
  currentRoutePath, isMobile, escapeRegExp, isEmail, shuffle, hashKey, pickRandom, deepClone,
};
