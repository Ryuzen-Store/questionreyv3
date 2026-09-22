/**
 * LEADERBOARD page (#/leaderboard).
 * Rank / Player Tag / Score (+ quiz count). Email NEVER exposed publicly.
 * Realtime subscription keeps rankings fresh while the page is open.
 */

import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import { loadingBlock } from '../components/loading.js';
import { toast } from '../components/toast.js';
import { getAuthState } from '../app.js';
import { getClient } from '../supabase/client.js';
import { CONFIG } from '../config.js';
import { subscribeToTable, unsubscribeScope } from '../supabase/realtime.js';
import { navigate } from '../router.js';
import { fmtNumber } from '../utils.js';

export function renderLeaderboard(view) {
  let disposed = false;
  const container = document.createElement('div');
  container.className = 'page leaderboard container';

  const head = document.createElement('header');
  head.className = 'dash-head';
  const back = createButton({ label: '', iconName: 'i-arrow-left', variant: 'ghost', size: 'sm', ariaLabel: 'Kembali', onClick: () => navigate('/') });
  head.appendChild(back);
  const titles = document.createElement('div');
  titles.className = 'dash-head__titles';
  const iconWrap = document.createElement('span');
  iconWrap.className = 'dash-head__icon';
  iconWrap.appendChild(icon('i-trophy', 'ic'));
  const h1 = document.createElement('h1');
  h1.className = 'font-brand';
  h1.textContent = 'LEADERBOARD';
  const p = document.createElement('p');
  p.textContent = 'Peringkat pemain berdasarkan total skor.';
  titles.appendChild(iconWrap);
  titles.appendChild(h1);
  titles.appendChild(p);
  head.appendChild(titles);
  container.appendChild(head);

  const live = document.createElement('div');
  live.className = 'leaderboard__live';
  const dot = document.createElement('span');
  dot.className = 'live-dot';
  dot.setAttribute('aria-hidden', 'true');
  const liveLabel = document.createElement('span');
  liveLabel.textContent = 'LIVE';
  live.appendChild(dot);
  live.appendChild(liveLabel);
  container.appendChild(live);

  const listHost = document.createElement('div');
  listHost.className = 'leaderboard__list';
  listHost.appendChild(loadingBlock('Memuat peringkat...'));
  container.appendChild(listHost);

  view.appendChild(container);

  loadLeaderboard(listHost, disposedFlag());

  // Realtime refresh on profile/score changes (admin scope not required —
  // public profiles are readable by everyone via RLS).
  subscribeToTable('leaderboard', CONFIG.supabase.tables.profiles, () => {
    if (!disposed) loadLeaderboard(listHost, disposedFlag());
  });

  return {
    cleanup: () => {
      disposed = true;
      unsubscribeScope('leaderboard');
    },
  };

  function disposedFlag() { return () => disposed; }
}

async function loadLeaderboard(host, isDisposed) {
  const client = getClient();
  try {
    const { data, error } = await client
      .from(CONFIG.supabase.tables.profiles)
      .select('id, player_tag, role, score, updated_at')
      .order('score', { ascending: false })
      .limit(100);
    if (error) throw error;
    if (isDisposed()) return;

    const rows = (data || []).filter((p) => p.player_tag);

    host.innerHTML = '';
    if (!rows.length) {
      host.innerHTML = '<div class="view-empty"><h3>Belum ada pemain</h3><p>Ranking akan muncul setelah pemain menyelesaikan kuis.</p></div>';
      return;
    }

    const list = document.createElement('ol');
    list.className = 'lb';
    rows.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'lb__row';
      const rank = document.createElement('span');
      rank.className = `lb__rank lb__rank--${rankTier(i)}`;
      rank.textContent = String(i + 1);
      const tag = document.createElement('span');
      tag.className = 'lb__tag';
      tag.textContent = p.player_tag + (p.role === 'owner' ? '  (admin)' : '');
      const score = document.createElement('span');
      score.className = 'lb__score font-brand';
      score.textContent = fmtNumber(p.score || 0);
      li.appendChild(rank);
      li.appendChild(tag);
      li.appendChild(score);
      list.appendChild(li);
    });
    host.appendChild(list);

    // Highlight self
    const auth = getAuthState();
    if (auth.profile) {
      const me = rows.find((p) => p.id === auth.profile.id);
      if (me) {
        const idx = rows.indexOf(me);
        const selfLine = document.createElement('p');
        selfLine.className = 'lb__self';
        selfLine.textContent = `Posisimu: #${idx + 1} — ${me.player_tag} (${me.score})`;
        host.appendChild(selfLine);
      }
    }
  } catch (err) {
    if (isDisposed()) return;
    host.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'view-empty';
    const h = document.createElement('h3');
    h.textContent = 'Leaderboard tidak tersedia';
    const p = document.createElement('p');
    p.textContent = 'Periksa koneksi atau coba lagi nanti.';
    empty.appendChild(h);
    empty.appendChild(p);
    host.appendChild(empty);
  }
}

function rankTier(i) {
  if (i === 0) return 'gold';
  if (i === 1) return 'silver';
  if (i === 2) return 'bronze';
  return 'plain';
}
