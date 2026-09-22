/**
 * Toast notifications (non-blocking). Types: info | success | warning | error.
 * Auto-dismisses. Never uses browser alert() for routine messages.
 */

import { icon } from './icons.js';

const root = document.getElementById('toast-root');
let counter = 0;

const TYPE_ICONS = {
  info: 'i-info',
  success: 'i-check',
  warning: 'i-refresh',
  error: 'i-wrong',
};

export function toast({ type = 'info', title = '', message = '', icon: iconName = null, duration = 3800 }) {
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const ic = icon(iconName || TYPE_ICONS[type] || 'i-info', 'ic');
  el.appendChild(ic);

  const body = document.createElement('div');
  body.className = 'toast__body';
  if (title) {
    const t = document.createElement('strong');
    t.textContent = title;
    body.appendChild(t);
  }
  if (message) {
    const m = document.createElement('span');
    m.className = 'toast__msg';
    m.textContent = message;
    body.appendChild(m);
  }
  el.appendChild(body);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast__close icon-btn';
  close.setAttribute('aria-label', 'Tutup notifikasi');
  close.appendChild(icon('i-x', 'ic'));
  close.addEventListener('click', () => dismiss());
  el.appendChild(close);

  const id = ++counter;
  root.appendChild(el);
  // limit stack length
  while (root.children.length > 4) root.removeChild(root.firstChild);

  let timer = setTimeout(dismiss, duration);
  function dismiss() {
    clearTimeout(timer);
    el.classList.add('toast--leaving');
    setTimeout(() => { try { el.remove(); } catch (err) { /* ignore */ } }, 180);
  }
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1500); });

  return { dismiss, id };
}

/* Convenience presets used across pages. */
export const toastError = (title, message) => toast({ type: 'error', title, message });
export const toastSuccess = (title, message) => toast({ type: 'success', title, message });
export const toastInfo = (title, message) => toast({ type: 'info', title, message });
export const toastWarning = (title, message) => toast({ type: 'warning', title, message });

export default { toast, toastError, toastSuccess, toastInfo, toastWarning };
