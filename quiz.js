/**
 * Pure quiz state machine. No DOM — the arena page renders from this state.
 *
 * State shape (matches spec §31):
 *   {
 *     subject, difficulty, totalQuestions, currentIndex,
 *     questions: [], answers: [], startedAt, finishedAt
 *   }
 * answers entries (spec §31):
 *   { number, subject, topic, question, options, userAnswer, correctAnswer,
 *     explanation, isCorrect }
 */

import { CONFIG } from '../config.js';

export function createQuizState({ subject, difficulty, questions }) {
  return {
    subject,
    difficulty,
    totalQuestions: questions.length,
    currentIndex: 0,
    questions: questions.map((q) => ({ ...q })),
    answers: [],
    startedAt: Date.now(),
    finishedAt: null,
  };
}

export function currentQuestion(state) {
  return state.questions[state.currentIndex] || null;
}

export function isAnswered(state, index) {
  const a = state.answers[index];
  return Boolean(a && Array.isArray(a.userAnswer) && a.userAnswer.length === 2);
}

export function hasSelection(state) {
  return isAnswered(state, state.currentIndex);
}

/**
 * Record an answer for the CURRENT question. Uses immutable-ish updates while
 * keeping references simple for rendering.
 */
export function answerCurrent(state, optionIndex) {
  const q = currentQuestion(state);
  if (!q || state.finishedAt) return state;
  const idx = state.currentIndex;
  const prev = state.answers[idx];
  const selected = Array.isArray(prev?.userAnswer) ? [...prev.userAnswer] : [];
  const pos = selected.indexOf(optionIndex);
  if (pos >= 0) selected.splice(pos, 1); else if (selected.length < 2) selected.push(optionIndex);
  const correctSet = Array.isArray(q.correct_indices) ? q.correct_indices.map(Number).sort((a,b)=>a-b) : [Number(q.correct_index)];
  const userSet = [...selected].map(Number).sort((a,b)=>a-b);
  const isCorrect = userSet.length === 2 && userSet.length === correctSet.length && userSet.every((v,i)=>v === correctSet[i]);
  const entry = {
    number: idx + 1,
    subject: q.subject,
    topic: q.topic,
    question: q.question,
    options: q.options.slice(),
    userAnswer: selected,
    correctAnswer: correctSet,
    explanation: q.explanation,
    isCorrect,
  };
  state.answers[idx] = entry;
  return state;
}

export function goNext(state) {
  if (state.currentIndex < state.totalQuestions - 1) {
    state.currentIndex += 1;
  }
  return state;
}

export function goPrev(state) {
  if (state.currentIndex > 0) state.currentIndex -= 1;
  return state;
}

export function finish(state) {
  state.finishedAt = Date.now();
  return state;
}

export function isFinished(state) {
  return Boolean(state.finishedAt);
}

/** Results summary (used by results.js + result-page). */
export function summarize(state) {
  const total = state.totalQuestions;
  const answered = state.answers.filter((a) => a && Number.isInteger(a.userAnswer));
  const correct = answered.filter((a) => a.isCorrect).length;
  const incorrect = answered.length - correct;
  const score = correct * (CONFIG.quiz.scorePerCorrect || 10);
  return {
    total,
    answered: answered.length,
    correct,
    incorrect,
    score,
    // Derived for dashboards
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    durationSeconds: state.finishedAt ? Math.max(0, Math.round((state.finishedAt - state.startedAt) / 1000)) : 0,
  };
}

export default { createQuizState, currentQuestion, isAnswered, hasSelection, answerCurrent, goNext, goPrev, finish, isFinished, summarize };
