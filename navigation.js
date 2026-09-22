/**
 * Bottom navigation (mobile) + header drawer fallback. Links are real hash
 * routes. The "Admin" link only appears for authorized owners.
 */

import { icon } from './icons.js';
import { CONFIG } from '../config.js';
import { isOwner } from '../supabase/database.js';

export function buildNavItems(getAuthState = () => ({ profile: null, offline: false })) {
  const auth = getAuthState();
  // Bottom navigation is intentionally disabled. User navigation is handled by
  // the two primary actions on Home and the Dashboard profile summary.
  return [];
}

/** Render bottom navigation into #app-nav (created by app.js). */
export function renderBottomNav(getAuthState) {
  const host = document.getElementById('app-nav');
  if (!host) return;
  host.innerHTML = '';
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Navigasi utama');

  const route = window.location.hash || '#/';
  const path = route.startsWith('#') ? route.slice(1) : route;

  for (const item of buildNavItems(getAuthState)) {
    const a = document.createElement('a');
    a.className = 'bottom-nav__item' + (item.primary ? ' bottom-nav__item--primary' : '');
    a.href = `#${item.route}`;
    if (path === item.route || (item.route !== '/' && path.startsWith(item.route))) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }
    const ic = icon(item.icon, 'ic');
    a.appendChild(ic);
    const label = document.createElement('span');
    label.className = 'bottom-nav__label';
    label.textContent = item.label;
    a.appendChild(label);
    nav.appendChild(a);
  }
  host.appendChild(nav);
}
