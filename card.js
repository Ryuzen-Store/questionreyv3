/**
 * Reusable card builders (neobrutalist blocks).
 */

import { icon } from './icons.js';
import { esc } from '../utils.js';

/**
 * Build a generic card element.
 * @param {string} tag html tag (default 'div')
 * @param {object} opts { className, title, body, iconName, footer, onClick, accent }
 */
export function createCard(tag = 'div', opts = {}) {
  const node = document.createElement(tag);
  node.className = `card ${opts.className || ''} ${opts.onClick ? 'card--clickable' : ''}`.trim();
  if (opts.accent) node.classList.add(`card--${opts.accent}`);

  if (opts.iconName) {
    const head = document.createElement('div');
    head.className = 'card__icon';
    head.appendChild(icon(opts.iconName, 'ic ic-md'));
    node.appendChild(head);
  }
  if (opts.title) {
    const title = document.createElement('div');
    title.className = 'card__title';
    title.textContent = opts.title;
    node.appendChild(title);
  }
  if (opts.body) {
    const body = document.createElement('div');
    body.className = 'card__body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body; // caller must escape
    else body.appendChild(opts.body);
    node.appendChild(body);
  }
  if (opts.footer) {
    const footer = document.createElement('div');
    footer.className = 'card__footer';
    footer.appendChild(opts.footer);
    node.appendChild(footer);
  }
  if (opts.onClick) {
    node.addEventListener('click', opts.onClick);
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(e); }
    });
  }
  return node;
}

/** Small stat card for the result page. */
export function statCard(label, value, iconName = null, accent = '') {
  const node = document.createElement('div');
  node.className = `stat-card ${accent ? `stat-card--${accent}` : ''}`.trim();
  if (iconName) node.appendChild(icon(iconName, 'ic'));
  const val = document.createElement('div');
  val.className = 'stat-card__value';
  val.textContent = String(value);
  const lab = document.createElement('div');
  lab.className = 'stat-card__label';
  lab.textContent = label;
  node.appendChild(val);
  node.appendChild(lab);
  return node;
}

export default { createCard, statCard };
