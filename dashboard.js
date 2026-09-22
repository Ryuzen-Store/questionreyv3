/**
 * DASHBOARD page (#/dashboard) and HISTORY page (#/history).
 *
 * Dashboard: Total Score / Quiz Count / Average / Best + subject stats +
 * recent quizzes. History: full sortable history table (responsive cards on
 * mobile). Data comes from my own quiz_logs (RLS) + profile.
 */

import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import { statCard, createCard } from '../components/card.js';
import { loadingBlock, skeleton } from '../components/loading.js';
import { toast } from '../components/toast.js';
import { getAuthState } from '../app.js';
import { getMyQuizLogs } from '../supabase/database.js';
import { getLastResult } from '../quiz/results.js';
import { navigate } from '../router.js';
import { fmtDateTime, fmtNumber, fmtDate } from '../utils.js';

export function renderDashboard(view) {
  let disposed = false;
  const container = document.createElement('div');
  container.className = 'page dashboard container';

  const head = pageHead('DASHBOARD', 'i-dashboard', 'Ringkasan performa kuis kamu.', '/');
  container.appendChild(head);

  const body = document.createElement('div');
  body.className = 'dash-body';
  container.appendChild(body);
  body.appendChild(loadingBlock('Memuat statistik...'));

  view.appendChild(container);

  loadData(body).catch(() => {
    if (!disposed) body.innerHTML = '<div class="view-empty"><p>Gagal memuat data dashboard.</p></div>';
  });

  return { cleanup: () => { disposed = true; } };
}

async function loadData(host) {
  const auth = getAuthState();
  let logs = [];
  try { logs = await getMyQuizLogs(); } catch (err) { logs = []; }

  // Merge the just-finished quiz (not yet synced) for instant feedback.
  const last = getLastResult();
  const hasLast = last && last.totalQuestions && !logs.some((l) =>
    l.subject === last.subject && Math.abs(new Date(l.created_at) - last.finishedAt) < 2000);

  const rows = logs.map((l) => ({
    date: l.created_at,
    subject: l.subject,
    difficulty: l.difficulty,
    total: l.total_questions,
    correct: l.correct_count,
    score: l.score,
  }));
  if (hasLast) {
    rows.unshift({
      date: new Date(last.finishedAt).toISOString(),
      subject: last.subject,
      difficulty: last.difficulty,
      total: last.totalQuestions,
      correct: last.correct,
      score: last.score,
    });
  }

  const quizCount = rows.length;
  const totalScore = rows.reduce((s, r) => s + (Number(r.score) || 0), 0);
  const avgScore = quizCount ? Math.round(totalScore / quizCount) : 0;
  const bestScore = rows.length ? Math.max(...rows.map((r) => Number(r.score) || 0)) : 0;
  const totalCorrect = rows.reduce((s, r) => s + (Number(r.correct) || 0), 0);

  // Subject statistics
  const subjectStats = {};
  for (const r of rows) {
    const key = r.subject || 'Umum';
    if (!subjectStats[key]) subjectStats[key] = { total: 0, correct: 0, quizes: 0 };
    subjectStats[key].total += Number(r.total) || 0;
    subjectStats[key].correct += Number(r.correct) || 0;
    subjectStats[key].quizes += 1;
  }

  host.innerHTML = '';

  /* Stat cards */
  /* Account summary: profile is accessed from Dashboard for normal users. */
  const profile = auth.profile;
  if (profile) {
    const account = document.createElement('section');
    account.className = 'dashboard-account card';
    const accountTitle = document.createElement('h2');
    accountTitle.className = 'dash-section__title';
    accountTitle.textContent = 'PROFILE';
    const accountGrid = document.createElement('div');
    accountGrid.className = 'dashboard-account__grid';

    const makeInfo = (label, value) => {
      const item = document.createElement('div');
      item.className = 'dashboard-account__item';
      const l = document.createElement('span');
      l.className = 'dashboard-account__label';
      l.textContent = label;
      const v = document.createElement('strong');
      v.className = 'dashboard-account__value';
      v.textContent = value;
      item.append(l, v);
      return item;
    };

    const roleLabel = getRoleLabel(profile);
    const deviceLabel = getDeviceLabel(profile);
    accountGrid.appendChild(makeInfo('ROLE', roleLabel));
    accountGrid.appendChild(makeInfo('EMAIL', profile.email || auth.user?.email || '-'));
    accountGrid.appendChild(makeInfo('AKUN DIBUAT', profile.created_at ? fmtDate(profile.created_at) : '-'));
    accountGrid.appendChild(makeInfo('DEVICE', deviceLabel));
    account.append(accountTitle, accountGrid);
    host.appendChild(account);
  }

  const grid = document.createElement('div');
  grid.className = 'dash-stats grid-2';
  grid.appendChild(statCard('Total Score', fmtNumber(totalScore), 'i-score', 'violet'));
  grid.appendChild(statCard('Quiz Count', String(quizCount), 'i-quiz', 'amber'));
  grid.appendChild(statCard('Average Score', String(avgScore), 'i-stats', 'sky'));
  grid.appendChild(statCard('Best Score', String(bestScore), 'i-trophy', 'mint'));
  host.appendChild(grid);

  if (quizCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'view-empty card';
    const h = document.createElement('h3');
    h.textContent = 'Belum ada kuis';
    const p = document.createElement('p');
    p.textContent = 'Kerjakan kuis pertamamu untuk melihat statistik.';
    const btn = createButton({ label: 'START QUIZ', iconName: 'i-play', variant: 'primary', size: 'md', onClick: () => navigate('/quiz') });
    empty.appendChild(h);
    empty.appendChild(p);
    empty.appendChild(btn);
    host.appendChild(empty);
    return;
  }

  /* Subject statistics */
  const subjSection = document.createElement('section');
  subjSection.className = 'dash-section';
  const subjTitle = document.createElement('h2');
  subjTitle.className = 'dash-section__title';
  subjTitle.textContent = 'Statistik Mapel';
  subjSection.appendChild(subjTitle);
  const subjList = document.createElement('div');
  subjList.className = 'subject-stats';
  for (const [subject, s] of Object.entries(subjectStats)) {
    const card = createCard('div', {
      className: 'subject-stat',
      accent: 'violet',
      title: subject,
      body: `<div class="subject-stat__line">Akurasi: <strong>${s.total ? Math.round((s.correct / s.total) * 100) : 0}%</strong></div><div class="subject-stat__line">Quiz: <strong>${s.quizes}</strong> · Benar: <strong>${s.correct}/${s.total}</strong></div>`,
    });
    subjList.appendChild(card);
  }
  subjSection.appendChild(subjList);
  host.appendChild(subjSection);

  /* Recent quizzes */
  const recent = document.createElement('section');
  recent.className = 'dash-section';
  const recentTitle = document.createElement('h2');
  recentTitle.className = 'dash-section__title';
  recentTitle.textContent = 'Recent Quiz';
  recent.appendChild(recentTitle);
  const table = historyTable(rows.slice(0, 8), false);
  recent.appendChild(table);
  host.appendChild(recent);

  const seeAll = document.createElement('a');
  seeAll.className = 'btn btn--secondary btn--sm';
  seeAll.href = '#/history';
  const label = document.createElement('span');
  label.textContent = 'Lihat Semua Riwayat';
  seeAll.appendChild(label);
  recent.appendChild(seeAll);
}

export function renderHistory(view) {
  const container = document.createElement('div');
  container.className = 'page dashboard container';

  const head = pageHead('HISTORY', 'i-history', 'Seluruh riwayat kuis kamu.', '/dashboard');
  container.appendChild(head);

  const body = document.createElement('div');
  body.className = 'dash-body';
  container.appendChild(body);
  body.appendChild(loadingBlock('Memuat riwayat...'));
  view.appendChild(container);

  (async () => {
    try {
      const logs = await getMyQuizLogs();
      const rows = logs.map((l) => ({
        date: l.created_at, subject: l.subject, difficulty: l.difficulty,
        total: l.total_questions, correct: l.correct_count, score: l.score,
      }));
      body.innerHTML = '';
      if (!rows.length) {
        body.innerHTML = '<div class="view-empty card"><h3>Tidak ada riwayat kuis</h3><p>Mulai kuis pertamamu sekarang.</p></div>';
        return;
      }
      const controls = document.createElement('div');
      controls.className = 'dash-toolbar';
      const filter = document.createElement('select');
      filter.className = 'select';
      filter.setAttribute('aria-label', 'Filter mapel');
      const subjects = ['Semua', ...new Set(rows.map((r) => r.subject).filter(Boolean))];
      for (const s of subjects) {
        const o = document.createElement('option');
        o.value = s === 'Semua' ? '' : s;
        o.textContent = s;
        filter.appendChild(o);
      }
      controls.appendChild(filter);
      body.appendChild(controls);

      const tableHost = document.createElement('div');
      tableHost.id = 'history-table-host';
      body.appendChild(tableHost);

      const renderTable = () => {
        const filtered = filter.value ? rows.filter((r) => r.subject === filter.value) : rows;
        tableHost.innerHTML = '';
        tableHost.appendChild(historyTable(filtered, true));
      };
      filter.addEventListener('change', renderTable);
      renderTable();
    } catch (err) {
      body.innerHTML = '<div class="view-empty"><p>Gagal memuat riwayat kuis.</p></div>';
    }
  })();

  return { cleanup: () => {} };
}

/* ---------------- shared ---------------- */


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
