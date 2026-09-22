/**
 * Thin storage abstraction over localStorage/sessionStorage with safe JSON
 * (de)serialization and size guards. Used by the AI cache, quiz draft state
 * and settings persistence.
 */

const MEMORY = new Map(); // in-memory fallback when storage is unavailable

function backend(areaName) {
  try {
    const s = window[areaName];
    const probe = '__qr_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch (err) {
    return null;
  }
}

function safeGet(area, key) {
  if (!area) return MEMORY.has(`${area}:${key}`) ? MEMORY.get(`${area}:${key}`) : null;
  try { return area.getItem(key); } catch (err) { return null; }
}

function safeSet(area, key, value) {
  if (!area) { MEMORY.set(`${area}:${key}`, value); } else {
    try { area.setItem(key, value); } catch (err) { /* quota exceeded — ignore */ }
  }
}

function safeRemove(area, key) {
  if (!area) { MEMORY.delete(`${area}:${key}`); } else {
    try { area.removeItem(key); } catch (err) { /* ignore */ }
  }
}

export const storage = {
  _local: backend('localStorage'),
  _session: backend('sessionStorage'),

  /** Read a raw string (or null). */
  getRaw(area, key) {
    return safeGet(area === 'session' ? this._session : this._local, key);
  },

  setRaw(area, key, value) {
    safeSet(area === 'session' ? this._session : this._local, key, value);
  },

  /** Read + JSON.parse with fallback. */
  getJSON(area, key, fallback = null) {
    const raw = this.getRaw(area, key);
    if (raw === null || raw === undefined) return fallback;
    try { return JSON.parse(raw); } catch (err) { return fallback; }
  },

  setJSON(area, key, value) {
    try { this.setRaw(area, key, JSON.stringify(value)); }
    catch (err) { /* circular/oversized — ignore */ }
  },

  remove(area, key) {
    safeRemove(area === 'session' ? this._session : this._local, key);
  },

  /** Keys with a given prefix in an area. */
  keys(area, prefix = '') {
    const s = area === 'session' ? this._session : this._local;
    if (!s) return Array.from(MEMORY.keys()).filter((k) => k.startsWith(`${area}:`) && k.includes(prefix)).map((k) => k.replace(/^[^:]+:/, ''));
    try {
      const out = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && k.startsWith(prefix)) out.push(k);
      }
      return out;
    } catch (err) { return []; }
  },
};

export default storage;
