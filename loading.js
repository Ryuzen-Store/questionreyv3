/**
 * Reusable loading UI: spinners, skeletons, and the full-screen generation
 * overlay (used by the quiz GENERATING step).
 */

import { icon } from './icons.js';
import { esc } from '../utils.js';

/** A small inline spinner with an optional label. */
export function spinner(label = '', className = '') {
  const wrap = document.createElement('div');
  wrap.className = `spinner-wrap ${className}`.trim();
  const spin = document.createElement('span');
  spin.className = 'spinner';
  spin.setAttribute('aria-hidden', 'true');
  wrap.appendChild(spin);
  if (label) {
    const s = document.createElement('span');
    s.className = 'spinner__label';
    s.textContent = label;
    wrap.appendChild(s);
  }
  return wrap;
}

/** Inline "loading..." block. */
export function loadingBlock(label = 'Memuat...') {
  const node = document.createElement('div');
  node.className = 'loading-block';
  node.appendChild(spinner(label));
  return node;
}

/** Skeleton rows for tables/lists. */
export function skeleton(rows = 3) {
  const node = document.createElement('div');
  node.className = 'skeleton-list';
  for (let i = 0; i < rows; i++) {
    const row = document.createElement('div');
    row.className = 'skeleton-row';
    node.appendChild(row);
  }
  return node;
}

/**
 * Full-screen generation overlay with progress status text. Lightweight
 * animation only.
 */
const genRoot = document.getElementById('loading-root');

export function showGenerationOverlay({ subject = '', difficulty = '', count = 0 } = {}) {
  genRoot.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'gen';
  box.id = 'gen-overlay';

  const head = document.createElement('div');
  head.className = 'gen__head';
  head.appendChild(icon('i-quiz', 'ic ic-xl'));
  const h = document.createElement('h2');
  h.className = 'gen__title';
  h.textContent = 'GENERATING QUESTIONS';
  head.appendChild(h);
  box.appendChild(head);

  const meta = document.createElement('div');
  meta.className = 'gen__meta';
  meta.textContent = `${subject ? `${subject} — ` : ''}${difficulty ? `${difficulty} — ` : ''}${count} soal`;
  box.appendChild(meta);

  const bars = document.createElement('div');
  bars.className = 'gen__bars';
  for (let i = 0; i < 3; i++) {
    const b = document.createElement('span');
    b.className = 'gen__bar';
    bars.appendChild(b);
  }
  box.appendChild(bars);

  const status = document.createElement('p');
  status.id = 'gen-status';
  status.className = 'gen__status';
  status.textContent = 'Menghubungi 3 provider AI secara paralel...';
  box.appendChild(status);

  const hint = document.createElement('p');
  hint.className = 'gen__hint';
  hint.textContent = 'Jeda tergantung jaringan & respons provider. Jangan tutup halaman ini.';
  box.appendChild(hint);

  genRoot.appendChild(box);
  return {
    setStatus(text) { status.textContent = text; },
    destroy() { genRoot.innerHTML = ''; },
  };
}

const GEN_PHASES = {
  'cache': 'Memeriksa cache soal...',
  'cache-hit': 'Ditemukan di cache — menyiapkan arena...',
  'generating': 'Menghubungi provider AI secara paralel...',
  'retry': 'Menambah soal yang kurang...',
  'retry-chunk': 'Mengambil soal lanjutan...',
  'database': 'Mengambil bank soal terkurasi...',
  'fallback': 'Menggunakan bank soal lokal...',
  'done': 'Soal siap — membuka arena...',
};

/** Map an engine phase id to a friendly status text. */
export function phaseText(phase) {
  return GEN_PHASES[phase] || 'Memproses...';
}

export default { spinner, loadingBlock, skeleton, showGenerationOverlay, phaseText };
