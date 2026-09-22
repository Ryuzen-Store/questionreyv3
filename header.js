/**
 * Global sticky header: brand (left), server status (center/right), nav
 * toggle (right). Admin button appears only for authorized owners.
 */

import { icon } from './icons.js';
import { CONFIG } from '../config.js';
import { isOwner } from '../supabase/database.js';

const headerHost = document.getElementById('app-header');

/**
 * Render the header. `auth` is a getter returning the current app-auth state
 * { user, profile, offline } so re-renders always reflect the latest roles.
 */
export function renderHeader(getAuthState) {
  if (!headerHost) return;
  headerHost.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'header__bar';

  // LEFT: brand
  const brand = document.createElement('a');
  brand.className = 'header__brand font-brand';
  brand.href = '#/';
  brand.setAttribute('aria-label', 'QuestionRy — beranda');
  const badge = document.createElement('span');
  badge.className = 'header__logo';
  badge.appendChild(icon('i-logo', 'ic'));
  const name = document.createElement('span');
  name.className = 'header__name';
  name.textContent = 'QUESTIONRY';
  brand.appendChild(badge);
  brand.appendChild(name);
  bar.appendChild(brand);

  // RIGHT: live battery percentage + compact public IP display.
  const right = document.createElement('div');
  right.className = 'header__right';

  const deviceBadge = document.createElement('span');
  deviceBadge.className = 'header__device';
  deviceBadge.textContent = '—% —';
  deviceBadge.title = 'Baterai perangkat dan alamat IP publik';
  right.appendChild(deviceBadge);

  // Admin shortcut — only for owners.
  const auth = getAuthState ? getAuthState() : { profile: null };
  const isAdmin = isOwner(auth.profile) && !auth.offline;
  if (isAdmin) {
    const adminBtn = document.createElement('a');
    adminBtn.className = 'header__admin';
    adminBtn.href = '/jekijink223';
    adminBtn.setAttribute('aria-label', 'Panel admin');
    adminBtn.title = 'Admin';
    adminBtn.appendChild(icon('i-admin', 'ic'));
    right.appendChild(adminBtn);
  }

  function compactIp(ip) {
    if (!ip || ip === '—') return '—';

    // IPv4 has a maximum of 15 characters (255.255.255.255).
    // Show the complete valid IPv4 instead of cutting it off.
    const ipv4 = String(ip).trim();
    const octets = ipv4.split('.');
    if (octets.length === 4 && octets.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)) {
      return ipv4;
    }

    // IPv6 can be long, so compact only IPv6 for the small header.
    if (ipv4.includes(':')) {
      const parts = ipv4.split(':').filter(Boolean);
      if (parts.length <= 2) return ipv4;
      return `${parts[0]}…${parts[parts.length - 1]}`;
    }

    return ipv4.length > 15 ? `${ipv4.slice(0, 7)}…${ipv4.slice(-4)}` : ipv4;
  }

  function renderDeviceBadge(battery, ip) {
    const shownIp = compactIp(ip);
    deviceBadge.textContent = `${battery === null ? '—' : `${battery}%`} ${shownIp}`;
    deviceBadge.title = ip && ip !== '—'
      ? `Baterai ${battery === null ? 'tidak tersedia' : `${battery}%`} • IP publik: ${ip}`
      : 'Baterai perangkat dan alamat IP publik';
  }

  async function updateDeviceBadge() {
    let battery = null;
    let ip = '';

    try {
      if ('getBattery' in navigator) {
        const batteryManager = await navigator.getBattery();
        const renderBattery = () => {
          battery = Math.round(Number(batteryManager.level || 0) * 100);
          renderDeviceBadge(battery, ip);
        };
        renderBattery();
        batteryManager.addEventListener('levelchange', renderBattery);
        batteryManager.addEventListener('chargingchange', renderBattery);
        // Fallback refresh so the badge follows battery changes even if the browser
        // delays Battery Status events.
        setInterval(renderBattery, 15000);
      }
    } catch (_) {
      battery = null;
    }

    try {
      const res = await fetch('https://api4.ipify.org?format=json', { cache: 'no-store' });
      if (!res.ok) throw new Error('IP request failed');
      const data = await res.json();
      ip = String(data?.ip || '');
    } catch (_) {
      ip = '—';
    }

    renderDeviceBadge(battery, ip);
  }

  updateDeviceBadge();

  bar.appendChild(right);
  headerHost.appendChild(bar);
}


export default { renderHeader };
