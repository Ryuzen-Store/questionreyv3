/**
 * QUIZ ARENA page (#/arena). Two phases:
 *   1. GENERATING QUESTIONS — parallel AI providers, first valid wins,
 *      with progressive status and timeouts.
 *   2. ARENA — question / options / timer / NEXT, saving answers to state.
 * No long explanations while answering; no AI calls for explanations.
 */

import { icon } from '../components/icons.js';
import { createButton } from '../components/button.js';
import { toast } from '../components/toast.js';
import { showGenerationOverlay, phaseText } from '../components/loading.js';
import { generateQuestions } from '../quiz/question-generator.js';
import * as engine from '../quiz/quiz.js';
import { saveQuizDraft, loadQuizDraft } from '../quiz/results.js';
import { navigate } from '../router.js';
import { fmtDuration } from '../utils.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function renderQuizPage(view) {
  let disposed = false;
  let timerInterval = null;

  const container = document.createElement('div');
  container.className = 'page quiz container';
  view.appendChild(container);

  let draft = readDraft();

  startGeneration(container, draft)
    .then((questions) => {
      if (disposed) return;
      beginArena(container, draft, questions);
    })
    .catch((err) => {
      if (disposed) return;
      showGenerationError(container, err);
    });

  return {
    cleanup: () => {
      disposed = true;
      if (timerInterval) clearInterval(timerInterval);
    },
  };

  /* ---------------- generation ---------------- */

  async function startGeneration(target, d) {
    const overlay = showGenerationOverlay({
      subject: d.subjectLabel || d.subject,
      difficulty: d.difficultyLabel || d.difficulty,
      count: d.count,
    });
    target.innerHTML = '';
    target.appendChild(overlayHost());

    try {
      const { questions } = await generateQuestions({
        subject: d.subject,
        difficulty: d.difficulty,
        count: d.count,
        onProgress: (phase) => {
          if (overlay.setStatus) overlay.setStatus(phaseText(phase));
        },
      });
      if (!questions || !questions.length) throw new Error('Tidak ada soal valid.');
      return questions;
    } finally {
      overlay.destroy();
    }
  }

  function overlayHost() {
    const n = document.createElement('div');
    n.style.display = 'none';
    return n;
  }

  function showGenerationError(target, err) {
    target.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'gen-error';
    const ic = document.createElement('span');
    ic.className = 'gen-error__icon';
    ic.appendChild(icon('i-wrong', 'ic ic-xl'));
    const h = document.createElement('h2');
    h.className = 'font-brand';
    h.textContent = 'GAGAL MEMBUAT SOAL';
    const p = document.createElement('p');
    p.textContent = (err && err.message) || 'Terjadi kesalahan saat membuat soal.';
    const retry = createButton({ label: 'COBA LAGI', iconName: 'i-refresh', variant: 'primary', size: 'block', onClick: () => navigate('/count') });
    const backHome = createButton({ label: 'KEMBALI', iconName: 'i-back', variant: 'ghost', size: 'block', onClick: () => navigate('/') });
    box.appendChild(ic);
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(retry);
    box.appendChild(backHome);
    target.appendChild(box);
  }

  /* ---------------- arena ---------------- */

  function beginArena(target, d, questions) {
    const requestedCount = d.count > 0 ? d.count : questions.length;
    const finalQuestions = questions.filter((q) => q && typeof q.question === 'string' && q.question.trim() && Array.isArray(q.options) && q.options.length === 6).slice(0, requestedCount);
    if (!finalQuestions.length) {
      throw new Error('Soal berhasil dibuat tetapi formatnya tidak lengkap. Silakan coba lagi.');
    }
    const state = engine.createQuizState({
      subject: d.subject || 'Umum',
      difficulty: d.difficultyLabel || d.difficulty || 'Normal',
      questions: finalQuestions,
    });
    saveQuizDraft(state);

    target.innerHTML = '';
    const arena = buildArenaUI(state);
    target.appendChild(arena);
    startTimer(state);
  }

  function buildArenaUI(state) {
    const arena = document.createElement('div');
    arena.className = 'arena';

    const meta = document.createElement('div');
    meta.className = 'arena__meta';
    const subjectPill = document.createElement('span');
    subjectPill.className = 'pill pill--violet';
    subjectPill.textContent = String(state.subject || 'Umum').toUpperCase();
    const diffPill = document.createElement('span');
    diffPill.className = `pill pill--${diffColor(state.difficulty)}`;
    diffPill.textContent = String(state.difficulty || 'Normal').toUpperCase();
    meta.append(subjectPill, diffPill);
    arena.appendChild(meta);

    const progress = document.createElement('div');
    progress.className = 'arena__progress';
    const qnum = document.createElement('div');
    qnum.className = 'arena__qnum font-brand';
    const bar = document.createElement('div');
    bar.className = 'arena__bar';
    const fill = document.createElement('span');
    fill.className = 'arena__bar-fill';
    bar.appendChild(fill);
    const timer = document.createElement('div');
    timer.className = 'arena__timer';
    timer.appendChild(icon('i-clock', 'ic'));
    const tLabel = document.createElement('span');
    tLabel.textContent = '00:00';
    timer.appendChild(tLabel);
    progress.append(qnum, bar, timer);
    arena.appendChild(progress);

    const qCard = document.createElement('div');
    qCard.className = 'arena__question card';
    const qTopic = document.createElement('span');
    qTopic.className = 'arena__topic';
    const qText = document.createElement('p');
    qText.className = 'arena__qtext';
    qCard.append(qTopic, qText);
    arena.appendChild(qCard);

    const opts = document.createElement('div');
    opts.className = 'arena__options';
    arena.appendChild(opts);

    const controls = document.createElement('div');
    controls.className = 'arena__controls';
    // No Back/Kembali button: quiz navigation only moves forward.
    const next = createButton({
      label: 'NEXT',
      iconName: 'i-arrow-right',
      variant: 'primary',
      size: 'lg',
      className: 'js-next',
      onClick: () => {
        if (!engine.hasSelection(state)) {
          toast({ type: 'warning', title: 'Pilih jawaban', message: 'Wajib pilih tepat 2 jawaban.' });
          return;
        }
        if (state.currentIndex >= state.totalQuestions - 1) { finishQuiz(state); return; }
        engine.goNext(state);
        renderQuestion(state);
        syncNextLabel(state);
      },
    });
    controls.appendChild(next);
    arena.appendChild(controls);

    // Keep direct element references. This avoids global-ID collisions/race
    // conditions when the SPA changes routes while AI generation is running.
    Object.defineProperty(state, '__ui', { value: { qnum, fill, timerLabel: tLabel, topic: qTopic, qtext: qText, opts, next }, writable: true, configurable: true, enumerable: false });
    renderQuestion(state);
    syncNextLabel(state);
    return arena;
  }

  function renderQuestion(state) {
    const ui = state.__ui;
    const raw = engine.currentQuestion(state);
    if (!ui) return;

    const q = normalizeArenaQuestion(raw);
    if (!q) {
      ui.qnum.textContent = `Question ${state.currentIndex + 1} / ${state.totalQuestions}`;
      ui.fill.style.width = `${((state.currentIndex + 1) / Math.max(1, state.totalQuestions)) * 100}%`;
      ui.topic.textContent = 'SOAL TIDAK TERSEDIA';
      ui.qtext.textContent = 'Soal gagal dimuat. Silakan ulangi kuis.';
      ui.opts.innerHTML = '';
      return;
    }

    ui.qnum.textContent = `Question ${state.currentIndex + 1} / ${state.totalQuestions}`;
    ui.fill.style.width = `${((state.currentIndex + 1) / state.totalQuestions) * 100}%`;
    ui.topic.textContent = `${q.topic || 'Soal'} • PILIH TEPAT 2 JAWABAN`;
    ui.qtext.textContent = q.question;
    ui.opts.innerHTML = '';

    const selected = state.answers[state.currentIndex] && Array.isArray(state.answers[state.currentIndex].userAnswer)
      ? state.answers[state.currentIndex].userAnswer : [];

    q.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option' + (selected.includes(idx) ? ' is-selected' : '');
      btn.setAttribute('aria-pressed', selected.includes(idx) ? 'true' : 'false');
      const letter = document.createElement('span');
      letter.className = 'option__letter';
      letter.textContent = LETTERS[idx];
      const label = document.createElement('span');
      label.className = 'option__text';
      label.textContent = optText;
      btn.append(letter, label);
      btn.addEventListener('click', () => {
        engine.answerCurrent(state, idx);
        const now = state.answers[state.currentIndex]?.userAnswer || [];
        Array.from(ui.opts.children).forEach((b, i) => {
          b.classList.toggle('is-selected', now.includes(i));
          b.setAttribute('aria-pressed', now.includes(i) ? 'true' : 'false');
        });
      });
      ui.opts.appendChild(btn);
    });
  }

  function normalizeArenaQuestion(q) {
    if (!q || typeof q !== 'object') return null;
    const question = String(q.question ?? q.question_text ?? q.text ?? q.soal ?? '').trim();
    const options = Array.isArray(q.options)
      ? q.options.map((v) => String(v ?? '').trim()).filter(Boolean)
      : [];
    if (!question || options.length !== 6) return null;
    return { ...q, question, options };
  }

  function syncNextLabel(state) {
    const nextLabel = state.__ui?.next?.querySelector?.('span');
    if (nextLabel) nextLabel.textContent = state.currentIndex >= state.totalQuestions - 1 ? 'SELESAI' : 'NEXT';
  }

  function startTimer(state) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - state.startedAt) / 1000);
      const label = state.__ui?.timerLabel;
      if (label) label.textContent = fmtDuration(elapsed);
    }, 1000);
  }

  function finishQuiz(state) {
    if (timerInterval) clearInterval(timerInterval);
    engine.finish(state);
    saveQuizDraft(state);
    navigate('/result');
  }
}

/* ---------------- shared helpers ---------------- */

function readDraft() {
  try {
    return {
      subject: sessionStorage.getItem('qrquest.draft.subject') || 'Matematika',
      difficulty: sessionStorage.getItem('qrquest.draft.difficulty') || 'normal',
      count: parseInt(sessionStorage.getItem('qrquest.draft.count') || '10', 10),
      subjectLabel: sessionStorage.getItem('qrquest.draft.subjectLabel') || '',
      difficultyLabel: sessionStorage.getItem('qrquest.draft.difficultyLabel') || '',
    };
  } catch (err) {
    return { subject: 'Matematika', difficulty: 'normal', count: 10, subjectLabel: '', difficultyLabel: '' };
  }
}

function diffColor(diff) {
  const map = { easy: 'mint', normal: 'sky', hard: 'amber', impossible: 'rose' };
  return map[String(diff || '').toLowerCase()] || 'sky';
}
