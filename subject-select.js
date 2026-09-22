/**
 * SELECT MAPEL step. Top-level subjects ONLY: Matematika / IPA / IPS /
 * Sejarah / Informatika. Sideways slide/swipe card interaction
 * (CSS transition; fast on low-end phones).
 */

import { SUBJECTS, topicSummary } from '../quiz/subjects.js';
import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import { navigate } from '../router.js';

export function renderSubjectSelect(view) {
  const container = document.createElement('div');
  container.className = 'page step container';

  const head = document.createElement('header');
  head.className = 'step__head';
  const back = createButton({ label: '', iconName: 'i-arrow-left', variant: 'ghost', size: 'sm', ariaLabel: 'Kembali ke beranda', onClick: () => navigate('/') });
  head.appendChild(back);
  const titles = document.createElement('div');
  titles.className = 'step__titles';
  const kicker = document.createElement('p');
  kicker.className = 'step__kicker';
  kicker.textContent = 'STEP 1 / 4';
  const h1 = document.createElement('h1');
  h1.className = 'font-brand';
  h1.textContent = 'SELECT MAPEL';
  titles.appendChild(kicker);
  titles.appendChild(h1);
  head.appendChild(titles);
  container.appendChild(head);

  const hint = document.createElement('p');
  hint.className = 'step__hint';
  hint.textContent = 'Pilih mata pelajaran utama. Subtopic relevan akan dicakup otomatis.';
  container.appendChild(hint);

  /* Track */
  const track = document.createElement('div');
  track.className = 'subject-track';
  const items = [];
  for (const s of SUBJECTS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `subject-card card--${s.color}`;
    card.setAttribute('aria-label', `Pilih mapel ${s.label}`);

    const ic = document.createElement('span');
    ic.className = 'subject-card__icon';
    ic.appendChild(icon(s.icon, 'ic ic-xl'));
    const label = document.createElement('strong');
    label.className = 'subject-card__label';
    label.textContent = s.label;
    const topics = document.createElement('span');
    topics.className = 'subject-card__topics';
    topics.textContent = topicSummary(s.id);
    card.appendChild(ic);
    card.appendChild(label);
    card.appendChild(topics);

    card.addEventListener('click', () => {
      try {
        sessionStorage.setItem('qrquest.draft.subject', s.id);
        sessionStorage.setItem('qrquest.draft.subjectLabel', s.label);
      } catch (err) { /* private mode */ }
      animateOut(card, () => navigate('/level'));
    });
    track.appendChild(card);
    items.push(card);
  }
  container.appendChild(track);

  /* Swipe affordance */
  const progress = document.createElement('div');
  progress.className = 'step__progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-valuemin', '1');
  progress.setAttribute('aria-valuemax', '4');
  progress.setAttribute('aria-valuenow', '1');
  progress.setAttribute('aria-label', 'Langkah 1 dari 4');
  for (let i = 0; i < 4; i++) {
    const seg = document.createElement('span');
    seg.className = 'step__seg' + (i === 0 ? ' is-on' : '');
    progress.appendChild(seg);
  }
  container.appendChild(progress);

  view.appendChild(container);
  return { cleanup: () => {} };

  function animateOut(card, cb) {
    card.classList.add('is-selected');
    card.addEventListener('transitionend', () => cb(), { once: true });
    setTimeout(() => cb(), 320); // safety fallback
  }
}
