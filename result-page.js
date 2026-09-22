/**
 * RESULT page (#/result).
 *
 * 1) Summary (score / correct / incorrect / total / subject / difficulty).
 * 2) PEMBAHASAN SOAL as accordion items — ALL CLOSED by default.
 *    [ Buka Semua ] [ Tutup Semua ] controls.
 * Uses the explanations already carried by the questions — NO AI calls here.
 * Persists the quiz_log to Supabase (RLS: own rows) when signed in.
 */

import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import * as acc from '../components/accordion.js';
import { statCard } from '../components/card.js';
import { loadQuizDraft, persistFinishedQuiz } from '../quiz/results.js';
import { navigate } from '../router.js';
import { CONFIG } from '../config.js';
import { esc } from '../utils.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function renderResultPage(view) {
  let persisted = false;

  const draft = loadQuizDraft();
  const container = document.createElement('div');
  container.className = 'page result container';

  if (!draft || !Array.isArray(draft.questions) || !draft.questions.length) {
    container.appendChild(emptyState());
    view.appendChild(container);
    return { cleanup: () => {} };
  }

  // Reconstruct a summary from the draft data.
  const total = draft.totalQuestions || draft.questions.length;
  const answers = draft.answers || [];
  const answered = answers.filter((a) => a && Number.isInteger(a.userAnswer));
  const correct = answered.filter((a) => a.isCorrect).length;
  const incorrect = answered.length - correct;
  const score = correct * (CONFIG.quiz.scorePerCorrect || 10);
  const summary = { total, answered: answered.length, correct, incorrect, score };

  /* ---------- Header block ---------- */
  const head = document.createElement('header');
  head.className = 'result__head';
  const kicker = document.createElement('p');
  kicker.className = 'step__kicker';
  kicker.textContent = 'QUIZ SELESAI';
  const h1 = document.createElement('h1');
  h1.className = 'font-brand';
  h1.textContent = 'RESULT';
  head.appendChild(kicker);
  head.appendChild(h1);
  container.appendChild(head);

  /* ---------- Summary card ---------- */
  const summaryCard = document.createElement('section');
  summaryCard.className = 'result__summary card';

  const scoreRow = document.createElement('div');
  scoreRow.className = 'result__score font-brand';
  scoreRow.textContent = String(summary.score);
  const scoreCaption = document.createElement('div');
  scoreCaption.className = 'result__score-caption';
  scoreCaption.textContent = 'TOTAL SKOR';
  summaryCard.appendChild(scoreRow);
  summaryCard.appendChild(scoreCaption);

  const statsGrid = document.createElement('div');
  statsGrid.className = 'result__stats';
  statsGrid.appendChild(statCard('Benar', summary.correct, 'i-check', 'mint'));
  statsGrid.appendChild(statCard('Salah', summary.incorrect, 'i-x', 'rose'));
  statsGrid.appendChild(statCard('Total Soal', summary.total, 'i-quiz', 'sky'));

  const metaRow = document.createElement('div');
  metaRow.className = 'result__meta';
  const subj = document.createElement('span');
  subj.className = 'pill pill--violet';
  subj.textContent = String(draft.subject || 'Umum').toUpperCase();
  const diff = document.createElement('span');
  diff.className = 'pill pill--sky';
  diff.textContent = String(draft.difficulty || 'Normal').toUpperCase();
  metaRow.appendChild(subj);
  metaRow.appendChild(diff);

  summaryCard.appendChild(statsGrid);
  summaryCard.appendChild(metaRow);
  container.appendChild(summaryCard);

  /* Actions */
  const actions = document.createElement('div');
  actions.className = 'result__actions';
  actions.appendChild(createButton({
    label: 'DASHBOARD', iconName: 'i-dashboard', variant: 'secondary', size: 'lg',
    onClick: () => navigate('/dashboard'),
  }));
  actions.appendChild(createButton({
    label: 'MAIN LAGI', iconName: 'i-play', variant: 'primary', size: 'lg',
    onClick: () => navigate('/quiz'),
  }));
  container.appendChild(actions);

  /* Persist quiz log (once) — local always, Supabase when signed in */
  if (!persisted) {
    persisted = true;
    persistFinishedQuiz(summary, draft).catch(() => {});
  }

  /* ---------- PEMBAHASAN SOAL ---------- */
  const pembahasan = document.createElement('section');
  pembahasan.className = 'result__review';

  const reviewHead = document.createElement('div');
  reviewHead.className = 'result__review-head';
  const h2 = document.createElement('h2');
  h2.className = 'font-brand';
  h2.textContent = 'PEMBAHASAN SOAL';
  const controls = document.createElement('div');
  controls.className = 'result__review-controls';
  controls.appendChild(createButton({ label: 'Buka Semua', iconName: 'i-chevron-down', variant: 'ghost', size: 'sm', onClick: () => acc.expandAll(listWrap) }));
  controls.appendChild(createButton({ label: 'Tutup Semua', iconName: 'i-chevron-down', variant: 'ghost', size: 'sm', onClick: () => acc.collapseAll(listWrap) }));
  reviewHead.appendChild(h2);
  reviewHead.appendChild(controls);
  pembahasan.appendChild(reviewHead);

  const listWrap = document.createElement('div');
  listWrap.className = 'result__accordions';
  buildAccordions(listWrap, draft, answers);
  pembahasan.appendChild(listWrap);
  container.appendChild(pembahasan);

  view.appendChild(container);

  return {
    cleanup: () => {},
    get listWrapRef() { return listWrap; },
  };
}

/* ---------------- builders ---------------- */

function buildAccordions(host, draft, answers) {
  const total = draft.totalQuestions || draft.questions.length;
  for (let i = 0; i < total; i++) {
    const q = draft.questions[i];
    if (!q) continue;
    const a = answers[i] || null;
    const isCorrect = a ? Boolean(a.isCorrect) : false;
    const statusText = a ? (isCorrect ? 'BENAR' : 'SALAH') : 'BELUM DIJAWAB';
    const title = `${q.subject || 'Soal'} — Nomor ${i + 1}`;

    const details = document.createElement('div');
    details.className = 'review-detail';

    details.appendChild(reviewRow('Jawaban kamu', a && Number.isInteger(a.userAnswer)
      ? `${LETTERS[a.userAnswer]}. ${esc(q.options[a.userAnswer] || '')}`
      : '—'));

    details.appendChild(reviewRow('Jawaban benar', `${LETTERS[q.correct_index]}. ${esc((q.options || [])[q.correct_index] || '')}`));

    const statusValue = document.createElement('div');
    statusValue.className = `review-status review-status--${isCorrect ? 'ok' : 'bad'}`;
    const sIcon = icon(isCorrect ? 'i-check' : (a ? 'i-x' : 'i-info'), 'ic');
    const sText = document.createElement('strong');
    sText.textContent = statusText;
    statusValue.appendChild(sIcon);
    statusValue.appendChild(sText);
    const statusRow = reviewRow('Status', null, statusValue);
    details.appendChild(statusRow);

    details.appendChild(reviewRow('Penjelasan', esc(q.explanation || '—')));
    details.appendChild(reviewRow('Topic', esc(q.topic || '—')));

    host.appendChild(acc.createAccordionItem({
      id: `rev-${i}`,
      title,
      iconName: 'i-quiz',
      badge: statusText,
      content: details,
      open: false,
    }));
  }
}

function reviewRow(label, valueText, customValue) {
  const row = document.createElement('div');
  row.className = 'review-row';
  const lab = document.createElement('span');
  lab.className = 'review-row__label';
  lab.textContent = label;
  row.appendChild(lab);
  if (customValue) {
    row.appendChild(customValue);
  } else {
    const val = document.createElement('div');
    val.className = 'review-row__value';
    val.innerHTML = valueText; // escaped upstream
    row.appendChild(val);
  }
  return row;
}

function emptyState() {
  const node = document.createElement('div');
  node.className = 'view-empty';
  const h = document.createElement('h2');
  h.textContent = 'Belum ada hasil';
  const p = document.createElement('p');
  p.textContent = 'Selesaikan kuis terlebih dahulu untuk melihat hasil dan pembahasan.';
  const btn = createButton({ label: 'START QUIZ', iconName: 'i-play', variant: 'primary', size: 'md', onClick: () => navigate('/quiz') });
  node.appendChild(h);
  node.appendChild(p);
  node.appendChild(btn);
  return node;
}
