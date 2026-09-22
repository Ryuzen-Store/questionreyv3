/**
 * Neobrutalist buttons. Every button is a real <button> element with a
 * callback; no fake/dead buttons.
 */

import { icon } from './icons.js';

/**
 * @param {object} opts { label, iconName, variant, size, onClick, type, disabled, className, ariaLabel, id }
 * variants: primary (violet), secondary (white/ink), accent (amber),
 *           danger (rose), ghost, success (mint)
 * sizes: sm, md, lg, block
 */
export function createButton(opts = {}) {
  const btn = document.createElement('button');
  btn.type = opts.type || 'button';
  btn.className = [
    'btn',
    opts.variant ? `btn--${opts.variant}` : 'btn--primary',
    opts.size ? `btn--${opts.size}` : '',
    opts.className || '',
  ].filter(Boolean).join(' ').trim();

  if (opts.id) btn.id = opts.id;
  if (opts.disabled) btn.disabled = true;
  if (opts.ariaLabel) btn.setAttribute('aria-label', opts.ariaLabel);

  if (opts.iconName) {
    const ic = icon(opts.iconName, 'ic');
    ic.setAttribute('aria-hidden', 'true');
    btn.appendChild(ic);
  }
  if (opts.label) {
    const span = document.createElement('span');
    span.textContent = opts.label;
    btn.appendChild(span);
    if (opts.iconPosition === 'end' && btn.firstChild && btn.firstChild.tagName === 'svg') {
      btn.appendChild(btn.firstChild); // move icon after label
    }
  }
  if (opts.onClick) {
    btn.addEventListener('click', (e) => opts.onClick(e));
  }
  return btn;
}

/** Shortcut for a full-width primary action. */
export function primaryAction(label, onClick, iconName = null) {
  return createButton({ label, onClick, iconName, variant: 'primary', size: 'block' });
}

export function dangerAction(label, onClick, iconName = null) {
  return createButton({ label, onClick, iconName, variant: 'danger', size: 'block' });
}

export default { createButton, primaryAction, dangerAction };
