/**
 * SELECT QUESTION COUNT step: 10 / 15 / 20 / 30 / 40 / 45. Then the user
 * navigates to the arena where GENERATE QUESTIONS runs.
 */

import { COUNTS, countNote } from '../quiz/question-count.js';
import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import { navigate } from '../router.js';

export function renderCountSelect(view) {
  const container = document.createElement('div');
  container.className = 'page step container';

  const head = document.createElement('header');
  head.className = 'step__head';
  const back = createButton({ label: '', iconName: 'i-arrow-left', variant: 'ghost', size: 'sm', ariaLabel: 'Kembali pilih level', onClick: () => navigate('/level') });
  head.appendChild(back);
  const titles = document.createElement('div');
  titles.className = 'step__titles';
  const kicker = document.createElement('p');
  kicker.className = 'step__kicker';
  kicker.textContent = 'STEP 3 / 4';
  const h1 = document.createElement('h1');
  h1.className = 'font-brand';
  h1.textContent = 'SELECT QUESTION COUNT';
  titles.appendChild(kicker);
  titles.appendChild(h1);
  head.appendChild(titles);
  container.appendChild(head);

  const hint = document.createElement('p');
  hint.className = 'step__hint';
  hint.textContent = 'Semua soal dibuat dalam satu permintaan per provider (paralel).';
  container.appendChild(hint);

  const grid = document.createElement('div');
  grid.className = 'count-grid';

  for (const n of COUNTS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'count-card';
    card.setAttribute('aria-label', `${n} soal`);

    const num = document.createElement('strong');
    num.className = 'count-card__num font-brand';
    num.textContent = String(n);
    const note = document.createElement('span');
    note.className = 'count-card__note';
    note.textContent = countNote(n);
    card.appendChild(num);
    card.appendChild(note);

    card.addEventListener('click', () => {
      try {
        sessionStorage.setItem('qrquest.draft.count', String(n));
      } catch (err) { /* private mode */ }
      card.classList.add('is-selected');
      // Navigate immediately. The router renders the arena synchronously
      // without relying on a later hashchange event.
      navigate('/arena');
    });
    grid.appendChild(card);
  }
  container.appendChild(grid);

  view.appendChild(container);
  return { cleanup: () => {} };
}
