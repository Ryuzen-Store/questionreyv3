/**
 * SVG icon helpers. Icons are `<use href="#i-name">` references into an
 * inline-injected sprite (see ensureSprite below). Monochrome, contextual,
 * accessible icons. No emojis.
 */

const SPRITE_ID = 'qr-icons-sprite';
const SPRITE_URL = './assets/icons/questionry-icons.svg';

/**
 * Basic icon factory. `focusable=false` + `aria-hidden` keeps decorative
 * icons out of the accessibility tree.
 */
export function icon(name, className = 'ic', { label = null, size = null } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('focusable', 'false');
  if (size) { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); }
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${name}`);
  svg.appendChild(use);
  return svg;
}

/** Inject an internal copy of the sprite so <use> resolves everywhere. */
async function ensureSprite() {
  if (document.getElementById(SPRITE_ID)) return;
  try {
    const res = await fetch(SPRITE_URL);
    if (!res.ok) return;
    const text = await res.text();
    const wrapper = document.createElement('div');
    wrapper.id = SPRITE_ID;
    wrapper.innerHTML = text;
    wrapper.setAttribute('aria-hidden', 'true');
    const style = document.createElement('style');
    style.textContent = `#${SPRITE_ID}{display:none;}`;
    wrapper.appendChild(style);
    document.body.appendChild(wrapper);
  } catch (err) {
    console.warn('[icons] sprite fetch failed; symbolic icons unavailable', err.message);
  }
}

export function initIcons() {
  return ensureSprite();
}

/** Render an icon button (no visible text) with an aria-label. */
export function iconButton(name, label, className = 'icon-btn') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.setAttribute('aria-label', label);
  btn.appendChild(icon(name, 'ic'));
  return btn;
}

/** Pseudo-icon for the large feature tiles on the landing page. */
export function featureIcon(name, label) {
  const span = document.createElement('span');
  span.className = 'feature-icon';
  span.appendChild(icon(name, 'ic ic-lg', { label }));
  return span;
}

export default { icon, iconButton, featureIcon, initIcons };
