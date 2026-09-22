/**
 * SELECT LEVEL step: Easy / Normal / Hard / Impossible. Same slide/swipe
 * card animation as subject selection. Difficulty is stored on the draft.
 */

import { LEVELS } from '../quiz/levels.js';
import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import { navigate } from '../router.js';

export function renderLevelSelect(view) {
  const subject = readSubject();
  const container = document.createElement('div');
  container.className = 'page step container';

  const head = document.createElement('header');
  head.className = 'step__head';
  const back = createButton({ label: '', iconName: 'i-arrow-left', variant: 'ghost', size: 'sm', ariaLabel: 'Kembali pilih mapel', onClick: () => navigate('/quiz') });
  head.appendChild(back);
  const titles = document.createElement('div');
  titles.className = 'step__titles';
  const kicker = document.createElement('p');
  kicker.className = 'step__kicker';
  kicker.textContent = 'STEP 2 / 4';
  const h1 = document.createElement('h1');
  h1.className = 'font-brand';
  h1.textContent = 'SELECT LEVEL';
  titles.appendChild(kicker);
  titles.appendChild(h1);
  head.appendChild(titles);
  container.appendChild(head);

  const hint = document.createElement('p');
  hint.className = 'step__hint';
  hint.textContent = `${subject.label || 'Mapel'}: pilih tingkat kesulitan. Kesulitan benar-benar memengaruhi materi soal.`;
  container.appendChild(hint);

  const track = document.createElement('div');
  track.className = 'level-track';
  for (const l of LEVELS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `level-card card--${l.color}`;
    card.setAttribute('aria-label', `Pilih level ${l.label}`);

    const ic = document.createElement('span');
    ic.className = 'level-card__icon';
    ic.appendChild(icon(l.icon, 'ic ic-xl'));
    const label = document.createElement('strong');
    label.className = 'level-card__label';
    label.textContent = l.short;
    const desc = document.createElement('span');
    desc.className = 'level-card__desc';
    desc.textContent = l.description;
    card.appendChild(ic);
    card.appendChild(label);
    card.appendChild(desc);

    card.addEventListener('click', () => {
      try {
        sessionStorage.setItem('qrquest.draft.difficulty', l.id);
        sessionStorage.setItem('qrquest.draft.difficultyLabel', l.label);
      } catch (err) { /* private mode */ }
      card.classList.add('is-selected');
      card.addEventListener('transitionend', () => navigate('/count'), { once: true });
      setTimeout(() => navigate('/count'), 320);
    });
    track.appendChild(card);
  }
  container.appendChild(track);

  view.appendChild(container);
  return { cleanup: () => {} };
}

function readSubject() {
  try {
    const id = sessionStorage.getItem('qrquest.draft.subject') || 'Matematika';
    const label = sessionStorage.getItem('qrquest.draft.subjectLabel') || id;
    return { id, label };
  } catch (err) { return { id: 'Matematika', label: 'Matematika' }; }
}
