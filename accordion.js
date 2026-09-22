/**
 * Collapsible accordion items with proper ARIA (aria-expanded). Used for the
 * PEMBAHASAN SOAL on the result page — every item starts CLOSED.
 */

import { icon } from './icons.js';

const KEY_PREFIX = 'qrquest.accordion.';

/** Build one accordion item's DOM. */
export function createAccordionItem({ id, title, subtitle = '', iconName = null, badge = null, content, open = false, group = '' }) {
  const item = document.createElement('div');
  item.className = 'acc';
  item.dataset.accId = id;

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'acc__head';
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  head.setAttribute('aria-controls', `${id}-panel`);

  const left = document.createElement('span');
  left.className = 'acc__left';
  const chevron = document.createElement('span');
  chevron.className = 'acc__chevron';
  chevron.appendChild(icon('i-chevron-down', 'ic'));
  left.appendChild(chevron);
  if (iconName) left.appendChild(icon(iconName, 'ic acc__icon'));
  const titleWrap = document.createElement('span');
  titleWrap.className = 'acc__titles';
  const t = document.createElement('span');
  t.className = 'acc__title';
  t.textContent = title;
  titleWrap.appendChild(t);
  if (subtitle) {
    const st = document.createElement('span');
    st.className = 'acc__subtitle';
    st.textContent = subtitle;
    titleWrap.appendChild(st);
  }
  left.appendChild(titleWrap);
  head.appendChild(left);

  if (badge) {
    const b = document.createElement('span');
    b.className = 'acc__badge';
    b.textContent = badge;
    head.appendChild(b);
  }

  const panel = document.createElement('div');
  panel.className = 'acc__panel';
  panel.id = `${id}-panel`;
  panel.setAttribute('role', 'region');
  if (typeof content === 'string') panel.innerHTML = content;
  else if (content) panel.appendChild(content);
  panel.hidden = !open;

  head.addEventListener('click', () => toggleAccordion(item));
  item.appendChild(head);
  item.appendChild(panel);
  return item;
}

export function toggleAccordion(item, force = null) {
  const head = item.querySelector('.acc__head');
  const panel = item.querySelector('.acc__panel');
  const willOpen = force === null ? panel.hidden : force;
  panel.hidden = !willOpen;
  head.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  item.classList.toggle('is-open', willOpen);
}

export function expandAll(container) {
  container.querySelectorAll('.acc').forEach((item) => toggleAccordion(item, true));
}

export function collapseAll(container) {
  container.querySelectorAll('.acc').forEach((item) => toggleAccordion(item, false));
}

export default { createAccordionItem, toggleAccordion, expandAll, collapseAll };
