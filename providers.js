/**
 * AI provider adapters. Each provider is a REST endpoint on anabot.my.id.
 * A single `callProvider` executes ONE request per provider and aborts it via
 * the shared AbortController when another provider wins the race.
 *
 * Response envelopes observed (handled in parser.js):
 *   success: {"success":true,"data":{"result":{"gpt":"...","source":[]}}}
 *   error  : {"success":false,"error":"..."}  (HTTP may still be 200 or 500)
 */

import { CONFIG } from '../config.js';
import { sleep } from '../utils.js';

export function keyPool() { return []; }

/** Pick a key from the pool (round-robin with a random start). */
let keyCursor = Math.floor(Math.random() * (keyPool().length || 1));
export function nextApiKey() { return ''; }

/** Build a provider request URL from its config + prompt + key. */
export function buildProviderUrl(provider, prompt, apiKey, baseOverride) {
  const url = new URL(provider.url, window.location.origin);
  // Provider-specific params first (per spec). The new REST API uses either
  // `prompt` or `query`, depending on the provider.
  const params = provider.params || {};
  for (const [k, v] of Object.entries(params)) {
    if (k === 'promptParam' || v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  url.searchParams.set(params.promptParam || 'prompt', prompt);
  return url.toString();
}

// Runtime endpoint override (from system_settings `ai_api_endpoint`).
let endpointOverride = '';

/** Set a runtime override for the provider base endpoint. */
export function setEndpointOverride(endpoint) {
  endpointOverride = String(endpoint || '');
}

/** Resolve the effective URL for a provider (override may rewrite the host). */
export function resolveProviderUrl(provider) {
  const original = provider.url;
  if (!endpointOverride) return original;
  try {
    const o = new URL(original);
    const n = new URL(endpointOverride);
    o.protocol = n.protocol;
    o.host = n.host;
    o.pathname = n.pathname;
    return o.toString();
  } catch (err) {
    return endpointOverride;
  }
}

/**
 * Fetch a provider with a hard timeout and optional external AbortSignal.
 * @returns {Promise<object>} { ok, status, envelope, text, error, ms }
 */
export async function callProvider(provider, prompt, { apiKey, timeoutMs, signal } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs || CONFIG.ai.requestTimeoutMs);

  // Chain external signal (e.g. another provider won) into our controller.
  const onExtAbort = () => controller.abort(new Error('superseded'));
  if (signal) {
    if (signal.aborted) controller.abort(new Error('superseded'));
    else signal.addEventListener('abort', onExtAbort, { once: true });
  }

  const started = Date.now();
  try {
    const effectiveProvider = { ...provider, url: resolveProviderUrl(provider) };
    // resolveProviderUrl may return a relative path; buildProviderUrl resolves it
    // against the current origin so both Netlify proxies and absolute endpoints work.
    const url = buildProviderUrl(effectiveProvider, prompt, apiKey);
    let res;
    try {
      res = await fetch(url, { method: 'GET', signal: controller.signal });
    } catch (fetchErr) {
      // Some browsers/environments fail on https for this host — retry http once.
      if (url.startsWith('https:') && !signal?.aborted) {
        try {
          res = await fetch(url.replace('https:', 'http:'), { method: 'GET', signal: controller.signal });
        } catch (retryErr) {
          throw fetchErr;
        }
      } else {
        throw fetchErr;
      }
    }
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      text,
      ms: Date.now() - started,
      providerId: provider.id,
      providerLabel: provider.label,
      error: null,
    };
  } catch (err) {
    const aborted = controller.signal.aborted;
    return {
      ok: false,
      status: aborted ? 0 : null,
      text: '',
      ms: Date.now() - started,
      providerId: provider.id,
      providerLabel: provider.label,
      error: err && err.message ? err.message : String(err),
      aborted,
    };
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onExtAbort);
  }
}

/**
 * Parallel race orchestration: launch every provider at once, then resolve
 * with the first response whose parsed questions validate. Aborts the rest.
 *
 * @param {Array<object>} providers provider configs
 * @param {string} prompt generation prompt
 * @param {Function} parseAndValidate (provider, result) => { questions } | null
 * @returns {Promise<{winner, questions, attempts}>}
 */
export async function raceProviders(providers, prompt, parseAndValidate, { timeoutMs } = {}) {
  const controller = new AbortController();
  const attempts = [];
  let finished = false;
  let resolveWinner;
  const winnerPromise = new Promise((resolve) => { resolveWinner = resolve; });

  const tasks = providers.map(async (provider) => {
    const apiKey = '';
    const result = await callProvider(provider, prompt, {
      apiKey,
      timeoutMs: timeoutMs || CONFIG.ai.requestTimeoutMs,
      signal: controller.signal,
    });
    attempts.push({ provider: provider.id, ...result });
    if (finished) return;

    let parsed = [];
    if (result.ok) {
      try { parsed = parseAndValidate(provider, result) || []; } catch (err) { parsed = []; }
    }
    if (parsed.length && !finished) {
      finished = true;
      resolveWinner({ provider, questions: parsed });
      controller.abort(new Error('winner-found'));
    }
  });

  Promise.allSettled(tasks).then(() => {
    if (!finished) {
      finished = true;
      resolveWinner(null);
    }
  });

  const winner = await winnerPromise;
  return { winner, attempts, questions: winner ? winner.questions : null };
}
/** Small helper: retry a single provider once after a short backoff (429/5xx reuse). */
export async function callWithRetry(provider, prompt, opts, retries = 1) {
  let last = null;
  for (let i = 0; i <= retries; i++) {
    last = await callProvider(provider, prompt, opts);
    if (last.ok && last.status !== 429 && last.status < 500) return last;
    await sleep(250 * (i + 1));
  }
  return last;
}
