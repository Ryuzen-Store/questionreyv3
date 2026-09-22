import { createButton } from '../components/button.js';
import { icon } from '../components/icons.js';
import { esc } from '../utils.js';
import { adminFetchProfiles } from '../supabase/database.js';
import { subscribeAllProfiles, unsubscribeScope } from '../supabase/realtime.js';

const ADMIN_SESSION_KEY = 'questionry.admin.verified';
const SCOPE = 'admin-usermanagement';

export function renderUserManagement(view) {
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== '1') {
    window.location.replace('/jekijink223');
    return;
  }

  let disposed = false;
  const page = document.createElement('div');
  page.className = 'page admin container admin--standalone';
  page.innerHTML = `
    <div class="admin-shell">
      <header class="admin-header">
        <div class="admin-header__titles">
          <div class="admin-eyebrow">QUESTIONRY / ADMIN</div>
          <h1 class="font-brand">USER MANAGEMENT</h1>
          <p>Data perangkat user yang tersimpan: Gmail, IP address, baterai, dan role.</p>
        </div>
        <div class="admin-header__actions">
          <a class="btn btn--secondary btn--sm" href="/jekijink223">Dashboard</a>
          <button class="btn btn--danger btn--sm" type="button" id="um-logout">LOGOUT</button>
        </div>
      </header>

      <section class="admin-users admin-users--standalone">
        <div class="admin-users__head">
          <h2 class="font-brand">USER MANAGEMENT</h2>
          <span class="pill pill--sky" id="um-count">0 pengguna</span>
        </div>
        <div class="admin-search admin-search--standalone">
          <span aria-hidden="true"></span>
          <input class="field__input" id="um-search" type="search" placeholder="Cari Gmail..." aria-label="Cari Gmail">
        </div>
        <div id="um-host"><div class="view-empty"><p>Memuat data user...</p></div></div>
      </section>
    </div>
  `;
  view.innerHTML = '';
  view.appendChild(page);

  const host = page.querySelector('#um-host');
  const count = page.querySelector('#um-count');
  const search = page.querySelector('#um-search');
  let users = [];

  function roleLabel(role) {
    return ({
      player: 'USER BIASA',
      einstein: 'ALBERT EINSTEIN',
      owner: 'MAHA RAJA'
    }[role] || String(role || 'player').toUpperCase());
  }

  function renderRows(query = '') {
    const q = String(query).trim().toLowerCase();
    const filtered = users.filter(u => !q || String(u.email || '').toLowerCase().includes(q));
    count.textContent = `${filtered.length} pengguna`;

    if (!filtered.length) {
      host.innerHTML = '<div class="view-empty"><p>Tidak ada user.</p></div>';
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'admin-table-wrap';
    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = '<thead><tr><th>Gmail</th><th>IP</th><th>🔋 Baterai</th><th>Role</th></tr></thead><tbody></tbody>';
    const tbody = table.querySelector('tbody');

    for (const user of filtered) {
      const device = user.device_info && typeof user.device_info === 'object' ? user.device_info : {};
      const ip = device.ip ? String(device.ip) : '—';
      const batteryNum = Number(device.battery);
      const battery = Number.isFinite(batteryNum) ? `${Math.round(batteryNum)}%` : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(user.email || '—')}</strong></td>
        <td><span class="admin-user-ip">${esc(ip)}</span></td>
        <td><span class="admin-user-battery">${esc(battery)}</span></td>
        <td><span class="pill ${user.role === 'owner' ? 'pill--amber' : user.role === 'einstein' ? 'pill--violet' : 'pill--sky'}">${esc(roleLabel(user.role))}</span></td>
      `;
      tbody.appendChild(tr);
    }

    wrap.appendChild(table);
    host.innerHTML = '';
    host.appendChild(wrap);

    const cards = document.createElement('div');
    cards.className = 'admin-cards';
    for (const user of filtered) {
      const device = user.device_info && typeof user.device_info === 'object' ? user.device_info : {};
      const ip = device.ip ? String(device.ip) : '—';
      const batteryNum = Number(device.battery);
      const battery = Number.isFinite(batteryNum) ? `${Math.round(batteryNum)}%` : '—';
      const card = document.createElement('div');
      card.className = 'admin-user-card card';
      card.innerHTML = `
        <div class="admin-user-card__row"><span>Gmail</span><strong>${esc(user.email || '—')}</strong></div>
        <div class="admin-user-card__row"><span>IP</span><strong>${esc(ip)}</strong></div>
        <div class="admin-user-card__row"><span>Baterai</span><strong>${esc(battery)}</strong></div>
        <div class="admin-user-card__row"><span>Role</span><strong>${esc(roleLabel(user.role))}</strong></div>
      `;
      cards.appendChild(card);
    }
    host.appendChild(cards);
  }

  async function load() {
    try {
      users = await adminFetchProfiles();
      if (!disposed) renderRows(search.value);
    } catch (err) {
      host.innerHTML = '<div class="view-empty"><p>Akses user management ditolak. Pastikan akun admin memiliki role owner.</p></div>';
    }
  }

  search.addEventListener('input', () => renderRows(search.value));
  page.querySelector('#um-logout').addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.replace('/jekijink223');
  });

  const off = subscribeAllProfiles(async () => {
    try {
      users = await adminFetchProfiles();
      if (!disposed) renderRows(search.value);
    } catch (_) {}
  });
  load();

  return {
    cleanup() {
      disposed = true;
      try { off?.(); } catch (_) {}
      unsubscribeScope(SCOPE);
    }
  };
}

export default { renderUserManagement };
