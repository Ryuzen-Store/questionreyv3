/**
 * Server-status component for the sticky header. Displays ONLINE / OFFLINE
 * with a small SVG dot. Updates via realtime (system_settings) — no polling.
 */

import { icon } from './icons.js';

let state = 'online';
const subscribers = new Set();

export function getServerStatus() { return state; }

export function setServerStatus(status) {
  const next = status === 'offline' ? 'offline' : 'online';
  if (next === state) return;
  state = next;
  for (const fn of subscribers) { try { fn(state); } catch (err) { /* ignore */ } }
}

export function onServerStatusChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Build the status element used in the header. */
export function createStatusElement() {
  const wrap = document.createElement('div');
  wrap.className = 'server-status';
  wrap.dataset.status = state;

  const dot = document.createElement('span');
  dot.className = 'server-status__dot';
  dot.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'server-status__label';
  label.textContent = state === 'online' ? 'ONLINE' : 'OFFLINE';

  wrap.appendChild(dot);
  wrap.appendChild(label);
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-label', `Server: ${state === 'online' ? 'online' : 'offline'}`);

  // Keep in sync when status changes.
  const unsub = onServerStatusChange((s) => {
    wrap.dataset.status = s;
    label.textContent = s === 'online' ? 'ONLINE' : 'OFFLINE';
    wrap.setAttribute('aria-label', `Server: ${s === 'online' ? 'online' : 'offline'}`);
  });
  wrap.addEventListener('DOMNodeRemoved', unsub, { once: true });
  return wrap;
}

export default { getServerStatus, setServerStatus, onServerStatusChange, createStatusElement };
