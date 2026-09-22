/**
 * Accessible modal manager. One container (#modal-root) hosts stacked modals.
 * Focus moves into the dialog on open and returns on close; ESC closes the
 * top modal; overlay click closes unless `persistent`.
 */

import { icon } from './icons.js';

const root = document.getElementById('modal-root');
const stack = [];
let lastActive = null;

export function openModal({ title = '', body = null, footer = null, persistent = false, onClose = null, size = 'md', iconName = null }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'presentation');

  const dialog = document.createElement('div');
  dialog.className = `modal modal--${size}`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (title) dialog.setAttribute('aria-label', title);

  const head = document.createElement('div');
  head.className = 'modal__head';
  const titleNode = document.createElement('h3');
  titleNode.className = 'modal__title';
  if (iconName) titleNode.appendChild(icon(iconName, 'ic'));
  titleNode.appendChild(document.createTextNode(title));
  head.appendChild(titleNode);
  if (!persistent) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'modal__close icon-btn';
    close.setAttribute('aria-label', 'Tutup');
    close.appendChild(icon('i-x', 'ic'));
    close.addEventListener('click', () => closeModal(overlay));
    head.appendChild(close);
  }
  dialog.appendChild(head);

  const content = document.createElement('div');
  content.className = 'modal__content';
  if (typeof body === 'string') content.innerHTML = body;
  else if (body) content.appendChild(body);
  dialog.appendChild(content);

  if (footer) {
    const foot = document.createElement('div');
    foot.className = 'modal__footer';
    if (typeof footer === 'string') foot.innerHTML = footer;
    else foot.appendChild(footer);
    dialog.appendChild(foot);
  }

  overlay.appendChild(dialog);
  root.appendChild(overlay);

  const entry = { overlay, onClose };
  stack.push(entry);

  // Focus management
  lastActive = document.activeElement;
  const focusable = dialog.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable) focusable.focus();
  else { dialog.setAttribute('tabindex', '-1'); dialog.focus(); }

  const keyListener = (e) => {
    if (e.key === 'Escape' && !persistent) closeModal(overlay);
  };
  overlay.addEventListener('keydown', keyListener);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !persistent) closeModal(overlay);
  });
  entry.keyListener = keyListener;

  return { close: () => closeModal(overlay), overlay, dialog };
}

export function closeModal(target) {
  const idx = stack.findIndex((s) => s.overlay === target);
  if (idx < 0) return;
  const [entry] = stack.splice(idx, 1);
  try { entry.overlay.remove(); } catch (err) { /* already removed */ }
  if (entry.onClose) { try { entry.onClose(); } catch (err) { /* ignore */ } }
  if (!stack.length && lastActive && document.contains(lastActive)) {
    try { lastActive.focus(); } catch (err) { /* ignore */ }
    lastActive = null;
  }
}

export function closeAll() {
  while (stack.length) closeModal(stack[stack.length - 1].overlay);
}

export function confirmDialog({ title, message, confirmLabel = 'YA', cancelLabel = 'BATAL', danger = false, onConfirm }) {
  const msg = document.createElement('p');
  msg.textContent = message;
  const footer = document.createElement('div');
  footer.className = 'modal__actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn--secondary';
  cancel.textContent = cancelLabel;
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;
  confirm.textContent = confirmLabel;

  let modal;
  cancel.addEventListener('click', () => closeModal(modal.overlay));
  confirm.addEventListener('click', () => {
    closeModal(modal.overlay);
    if (onConfirm) onConfirm();
  });
  footer.appendChild(cancel);
  footer.appendChild(confirm);

  modal = openModal({ title, body: msg, footer });
  return modal;
}

export function alertDialog({ title, message, confirmLabel = 'OK' }) {
  const msg = document.createElement('p');
  msg.textContent = message;
  const footer = document.createElement('div');
  footer.className = 'modal__actions';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'btn btn--primary';
  ok.textContent = confirmLabel;
  let modal;
  ok.addEventListener('click', () => closeModal(modal.overlay));
  footer.appendChild(ok);
  modal = openModal({ title, body: msg, footer });
  return modal;
}

export default { openModal, closeModal, closeAll, confirmDialog, alertDialog };
