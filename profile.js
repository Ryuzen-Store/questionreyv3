/**
 * PROFILE page (#/profile). Player tag / email / score / quiz statistics /
 * account info + edit player-tag form + link to settings.
 */

import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import { statCard } from '../components/card.js';
import { loadingBlock } from '../components/loading.js';
import { toast } from '../components/toast.js';
import { getAuthState, onAppState } from '../app.js';
import { getMyQuizLogs, updateMyProfile } from '../supabase/database.js';
import { navigate } from '../router.js';
import { validators } from '../validation.js';
import { fmtDate, fmtNumber, esc } from '../utils.js';

export function renderProfile(view) {
  let disposed = false;
  const unsub = onAppState(() => { if (!disposed) refresh(); });

  const container = document.createElement('div');
  container.className = 'page profile container';

  const head = pageHead();
  container.appendChild(head);

  const body = document.createElement('div');
  body.className = 'dash-body';
  container.appendChild(body);
  body.appendChild(loadingBlock('Memuat profil...'));

  view.appendChild(container);

  refresh();

  return {
    cleanup: () => { disposed = true; unsub(); },
  };

  async function refresh() {
    if (disposed || !body.isConnected) return;
    const auth = getAuthState();
    const profile = auth.profile;
    if (!profile) {
      body.innerHTML = '<div class="view-empty"><p>Tidak ada profil aktif.</p></div>';
      return;
    }
    let logs = [];
    try { logs = await getMyQuizLogs(); } catch (err) { logs = []; }
    if (disposed) return;

    const quizCount = logs.length;
    const totalScore = logs.reduce((s, l) => s + (Number(l.score) || 0), 0);
    const totalCorrect = logs.reduce((s, l) => s + (Number(l.correct_count) || 0), 0);
    const totalQuestions = logs.reduce((s, l) => s + (Number(l.total_questions) || 0), 0);
    const bestScore = logs.length ? Math.max(...logs.map((l) => Number(l.score) || 0)) : 0;

    body.innerHTML = '';

    /* Identity card */
    const card = document.createElement('div');
    card.className = 'profile-card card';
    const avatar = document.createElement('div');
    avatar.className = 'profile-card__avatar';
    avatar.textContent = initial(profile.player_tag || 'P');
    const tag = document.createElement('h2');
    tag.className = 'font-brand';
    tag.textContent = profile.player_tag || 'PEMAIN BARU';
    const email = document.createElement('p');
    email.className = 'profile-card__email';
    email.textContent = auth.user && auth.user.email ? (auth.user.isAnonymous ? 'Tamu (sandbox)' : auth.user.email) : (auth.offline ? 'Mode offline (tamu)' : '—');
    const role = document.createElement('span');
    role.className = `pill ${profile.role === 'owner' ? 'pill--amber' : 'pill--mint'}`;
    role.textContent = getRoleLabel(profile);
    card.appendChild(avatar);
    card.appendChild(tag);
    card.appendChild(email);
    card.appendChild(role);

    const profileGrid = document.createElement('div');
    profileGrid.className = 'profile-info profile-info--identity';
    const identityRows = [
      ['ROLE', getRoleLabel(profile)],
      ['EMAIL', email.textContent],
      ['AKUN DIBUAT', profile.created_at ? fmtDate(profile.created_at) : '-'],
      ['DEVICE', getDeviceLabel(profile)],
    ];
    for (const [label, value] of identityRows) {
      const row = document.createElement('div');
      row.className = 'profile-info__row';
      const l = document.createElement('span'); l.textContent = label;
      const v = document.createElement('strong'); v.textContent = value;
      row.append(l, v);
      profileGrid.appendChild(row);
    }
    card.appendChild(profileGrid);
    body.appendChild(card);

    /* Stats */
    const grid = document.createElement('div');
    grid.className = 'dash-stats grid-2';
    const averageScore = quizCount ? Math.round(totalScore / quizCount) : 0;
    grid.appendChild(statCard('Total Score', fmtNumber(profile.score || totalScore || 0), 'i-score', 'violet'));
    grid.appendChild(statCard('Quiz Count', String(quizCount), 'i-quiz', 'amber'));
    grid.appendChild(statCard('Average Score', String(averageScore), 'i-stats', 'sky'));
    grid.appendChild(statCard('Best Score', String(bestScore), 'i-trophy', 'mint'));
    body.appendChild(grid);

    /* Edit player tag */
    const tagForm = document.createElement('form');
    tagForm.className = 'card tag-form';
    tagForm.noValidate = true;
    const tfTitle = document.createElement('h3');
    tfTitle.textContent = 'Ubah Player Tag';
    tagForm.appendChild(tfTitle);
    const field = document.createElement('label');
    field.className = 'field';
    const lbl = document.createElement('span');
    lbl.className = 'field__label';
    lbl.textContent = 'Player tag';
    const input = document.createElement('input');
    input.className = 'field__input';
    input.name = 'player_tag';
    input.maxLength = 20;
    input.value = profile.player_tag || '';
    input.placeholder = 'Masukkan player tag baru';
    field.appendChild(lbl);
    field.appendChild(input);
    tagForm.appendChild(field);
    const save = createButton({ type: 'submit', label: 'SIMPAN TAG', iconName: 'i-check', variant: 'primary', size: 'md' });
    tagForm.appendChild(save);

    tagForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = input.value.trim();
      const err = validators.playerTag(val);
      if (err) { toast({ type: 'error', title: 'Tidak valid', message: err }); return; }
      const { error } = await updateMyProfile(profile.id, { player_tag: val });
      if (error) {
        toast({ type: 'error', title: 'Gagal menyimpan', message: 'Hanya pemilik akun yang bisa mengubah profilnya.' });
      } else {
        toast({ type: 'success', title: 'Tersimpan', message: 'Player tag berhasil diperbarui.' });
        refresh();
      }
    });
    body.appendChild(tagForm);

    /* Settings link */
    const settingsLink = document.createElement('a');
    settingsLink.className = 'btn btn--secondary btn--block';
    settingsLink.href = '#/settings';
    const sl = document.createElement('span');
    sl.textContent = 'SETTINGS';
    settingsLink.appendChild(sl);
    body.appendChild(settingsLink);
  }

  function pageHead() {
    const head = document.createElement('header');
    head.className = 'dash-head';
    const back = createButton({ label: '', iconName: 'i-arrow-left', variant: 'ghost', size: 'sm', ariaLabel: 'Kembali', onClick: () => navigate('/') });
    head.appendChild(back);
    const titles = document.createElement('div');
    titles.className = 'dash-head__titles';
    const iconWrap = document.createElement('span');
    iconWrap.className = 'dash-head__icon';
    iconWrap.appendChild(icon('i-user', 'ic'));
    const h1 = document.createElement('h1');
    h1.className = 'font-brand';
    h1.textContent = 'PROFILE';
    const p = document.createElement('p');
    p.textContent = 'Akun, player tag, dan statistik kuis kamu.';
    titles.appendChild(iconWrap);
    titles.appendChild(h1);
    titles.appendChild(p);
    head.appendChild(titles);
    return head;
  }
}


function getRoleLabel(profile) {
  if (profile?.role === 'owner') return 'MAHA RAJA';
  if (profile?.role === 'einstein' || Number(profile?.correct_total) >= 320) return 'ALBERT EINSTEIN';
  return 'USER BIASA';
}

function getDeviceLabel(profile) {
  const info = profile?.device_info;
  if (info && typeof info === 'object') {
    if (info.model && info.model !== 'Tidak tersedia dari browser') return String(info.model);
    if (info.type) return String(info.type);
  }
  const ua = String(navigator?.userAgent || '');
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s[^;)]*;\s*(?:[^;)]*;\s*)?([^;)]+?)(?:\s+Build\/[^;)]+)?[;) ]/i);
    if (match?.[1]) return match[1].trim();
    return 'Android';
  }
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  return /Mobi/i.test(ua) ? 'Mobile' : 'Desktop';
}

let publicIpPromise = null;
