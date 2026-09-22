/**
 * SETTINGS page (#/settings). Session info, auth actions (logout), app info,
 * and (owner only) a shortcut to the admin panel.
 */

import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import { toast, toastInfo } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import { getAuthState } from '../app.js';
import { signOutAndCleanup } from '../supabase/auth.js';
import { isOwner, getMyQuizLogs } from '../supabase/database.js';
import { navigate } from '../router.js';
import { CONFIG } from '../config.js';
import { fmtDateTime } from '../utils.js';

export function renderSettings(view) {
  const container = document.createElement('div');
  container.className = 'page settings container';

  const head = document.createElement('header');
  head.className = 'dash-head';
  const back = createButton({ label: '', iconName: 'i-arrow-left', variant: 'ghost', size: 'sm', ariaLabel: 'Kembali', onClick: () => navigate('/profile') });
  head.appendChild(back);
  const titles = document.createElement('div');
  titles.className = 'dash-head__titles';
  const iconWrap = document.createElement('span');
  iconWrap.className = 'dash-head__icon';
  iconWrap.appendChild(icon('i-settings', 'ic'));
  const h1 = document.createElement('h1');
  h1.className = 'font-brand';
  h1.textContent = 'SETTINGS';
  const p = document.createElement('p');
  p.textContent = 'Pengaturan akun dan aplikasi.';
  titles.appendChild(iconWrap);
  titles.appendChild(h1);
  titles.appendChild(p);
  head.appendChild(titles);
  container.appendChild(head);

  const auth = getAuthState();

  /* Account card */
  const account = document.createElement('section');
  account.className = 'card settings-card';
  const acTitle = document.createElement('h2');
  acTitle.textContent = 'Akun';
  account.appendChild(acTitle);
  const rows = [
    ['Mode', auth.offline ? 'Offline (tamu)' : 'Online — tersambung ke Supabase'],
    ['Status', auth.user ? 'Masuk' : 'Tidak masuk'],
    ['Email', (auth.user && auth.user.email) ? auth.user.email : (auth.offline ? 'Tamu' : '—')],
    ['Player Tag', auth.profile ? auth.profile.player_tag || '—' : '—'],
    ['Role', auth.profile ? (auth.profile.role || 'player').toUpperCase() : '—'],
    ['Versi', `${CONFIG.app.name} v${CONFIG.app.version}`],
    ['Zona waktu', Intl.DateTimeFormat().resolvedOptions().timeZone || '—'],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'settings-row';
    const l = document.createElement('span');
    l.textContent = label;
    const v = document.createElement('strong');
    v.textContent = value;
    row.appendChild(l);
    row.appendChild(v);
    account.appendChild(row);
  }
  container.appendChild(account);

  /* Actions */
  const actions = document.createElement('section');
  actions.className = 'card settings-card';
  const actTitle = document.createElement('h2');
  actTitle.textContent = 'Tindakan';
  actions.appendChild(actTitle);

  if (isOwner(auth.profile)) {
    const adminBtn = document.createElement('a');
    adminBtn.className = 'btn btn--secondary btn--block';
    adminBtn.href = '/jekijink223';
    const l1 = document.createElement('span');
    l1.textContent = 'PANEL ADMIN';
    adminBtn.appendChild(l1);
    actions.appendChild(adminBtn);
  }

  const exportBtn = createButton({
    label: 'Lihat Statistik Saya',
    iconName: 'i-stats', variant: 'ghost', size: 'block',
    onClick: async () => {
      try {
        const logs = await getMyQuizLogs();
        toastInfo('Statistik', `${logs.length} kuis tersimpan di akun kamu.`);
      } catch (err) {
        toast({ type: 'error', title: 'Gagal', message: 'Tidak dapat membaca riwayat.' });
      }
    },
  });
  actions.appendChild(exportBtn);

  const logoutBtn = createButton({
    label: 'LOGOUT',
    iconName: 'i-logout', variant: 'danger', size: 'block',
    onClick: () => {
      confirmDialog({
        title: 'Keluar dari akun?',
        message: 'Sesi kamu akan diakhiri. Skor dan riwayat tetap tersimpan di server.',
        confirmLabel: 'YA, KELUAR',
        danger: true,
        onConfirm: async () => {
          try {
            await signOutAndCleanup();
            toast({ type: 'success', title: 'Keluar', message: 'Kamu telah keluar dari akun.' });
          } catch (err) {
            toast({ type: 'error', title: 'Gagal', message: 'Tidak dapat keluar.' });
          }
          navigate('/login');
        },
      });
    },
  });
  actions.appendChild(logoutBtn);
  container.appendChild(actions);

  /* About */
  const about = document.createElement('section');
  about.className = 'card settings-card settings-about';
  const abTitle = document.createElement('h2');
  abTitle.textContent = 'Tentang';
  about.appendChild(abTitle);
  const abP = document.createElement('p');
  abP.innerHTML = '<strong>QuestionRy Multi Quest</strong> — platform kuis dinamis dengan pembangkitan soal paralel multi-provider, cache, failover, leaderboard realtime, dan pembahasan soal yang dapat dibuka-tutup.';
  about.appendChild(abP);
  container.appendChild(about);

  view.appendChild(container);
  return { cleanup: () => {} };
}
