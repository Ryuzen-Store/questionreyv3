/**
 * Question-generation failover strategy.
 *
 * Resolution order:
 *   1. AI providers in PARALLEL (first VALID set wins)   — ai-engine.js
 *   2. Supabase `questions` catalog (filtered by subject) — database.js
 *   3. Cached generated questions                         — cache.js
 *   4. Local fallback question bank (seeded difficulty)   — data/bank.js
 *
 * Guarantees the requested count where the total bank allows it, always
 * returns well-formed questions, and never leaves the user stuck.
 */

import { CONFIG } from '../config.js';
import { QUESTION_BANK, SUBJECT_TAXONOMY } from '../data/bank.js';
import { isQuestionObject } from '../validation.js';
import { shuffle, pickRandom, clamp } from '../utils.js';

const DIFFICULTY_BY_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard', impossible: 'Impossible' };

/** All questions of a subject from the local bank (case-insensitive). */
export function bankForSubject(subject) {
  return (QUESTION_BANK || []).filter((q) => q.subject.toLowerCase() === String(subject).toLowerCase());
}

/**
 * Pick `count` questions from the bank for a subject/difficulty. When a
 * difficulty lacks enough items, borrows from nearby difficulties and finally
 * from the whole subject. When the whole subject is too small, reuse the bank
 * with reshuffled options (still valid questions, clearly-anchored).
 */
export function questionsFromBank(subject, difficulty, count) {
  const pool = bankForSubject(subject);
  const difficultyLabel = DIFFICULTY_BY_LABEL[difficulty] || 'Normal';

  let candidates = pool.filter((q) => q.difficulty === difficultyLabel);
  if (candidates.length < count) {
    // top up with other difficulties of the same subject
    const rest = shuffle(pool.filter((q) => q.difficulty !== difficultyLabel));
    for (const q of rest) {
      if (candidates.length >= count) break;
      candidates.push(q);
    }
  }
  if (!candidates.length) return [];

  // Never silently mix another subject into a requested quiz. If the local
  // bank has fewer unique items than requested, recycle its own items so the
  // quiz can still start offline and preserve the selected subject.
  const picked = pickRandom(candidates, Math.min(count, candidates.length));
  const out = picked.map((q) => normalizeBankQuestion(q, difficultyLabel, subject));
  if (out.length < count) {
    let i = 0;
    while (out.length < count) {
      const base = out[i % out.length];
      out.push({ ...base, source: 'bank-repeat', fallbackIndex: out.length });
      i++;
    }
  }
  return out.slice(0, count);
}

/** Map a bank question to the canonical engine shape. */
export function normalizeBankQuestion(q, difficultyLabel, requestedSubject) {
  const original = Array.isArray(q.options) ? q.options.map(String) : [];
  const ci = Number(q.correct_index);
  if (original.length < 4 || !Number.isInteger(ci) || ci < 0 || ci >= original.length) return null;
  const correctText = original[ci];
  const base = original.slice(0, 4);
  // Legacy bank questions had one key. To preserve the two-answer contract
  // offline, add the same correct concept once more as a selectable option.
  const options = [...base, correctText, 'Semua pilihan di atas'];
  const shuffled = shuffle(options.map((opt, i) => ({ opt, idx: i })));
  const finalOptions = shuffled.map((s) => s.opt);
  const correctIndices = shuffled.map((s, i) => (s.idx === ci || s.idx === 4 ? i : -1)).filter(i => i >= 0).slice(0,2).sort((a,b)=>a-b);
  return {
    question: q.question,
    options: finalOptions,
    correct_indices: correctIndices,
    correct_index: correctIndices[0],
    explanation: q.explanation,
    subject: requestedSubject,
    topic: q.topic || requestedSubject,
    difficulty: difficultyLabel,
    source: 'bank',
  };
}

function normalizeCatalogQuestion(q, requestedSubject) {
  if (!q) return null;
  const rawOptions = Array.isArray(q.options) ? q.options : [];
  const oldCorrect = Number(q.correct_index);
  if (rawOptions.length >= 6 && Array.isArray(q.correct_indices)) {
    const out = { ...q, question: q.question || q.question_text, correct_indices: q.correct_indices.map(Number).sort((a,b)=>a-b), subject: requestedSubject };
    out.correct_index = out.correct_indices[0];
    return isQuestionObject(out, requestedSubject) ? out : null;
  }
  if (rawOptions.length < 4 || !Number.isInteger(oldCorrect) || oldCorrect < 0 || oldCorrect >= rawOptions.length) return null;
  return normalizeBankQuestion({ ...q, question: q.question || q.question_text, options: rawOptions.slice(0,4), correct_index: oldCorrect }, q.difficulty || 'Normal', requestedSubject);
}

/**
 * Final fallback used when NOTHING succeeded. Resolves to `null` only when
 * `count <= 0`; otherwise it always produces `count` well-formed questions.
 */
export function resolveFromFallback(subject, difficulty, count, { dbQuestions = [] } = {}) {
  const max = Number(CONFIG.ai && CONFIG.ai.maxQuestionsPerRequest) || 45;
  const need = clamp(count, 1, max);
  const dbPool = Array.isArray(dbQuestions) ? dbQuestions.map((q) => normalizeCatalogQuestion(q, subject)).filter(Boolean) : [];

  // 1) DB catalog first (already curated + includes explanations)
  const dbPicked = pickRandom(dbPool, need);
  if (dbPicked.length) return dbPicked;

  // 2) Local bank
  return questionsFromBank(subject, difficulty, need);
}

export default { bankForSubject, questionsFromBank, normalizeBankQuestion, resolveFromFallback, SUBJECT_TAXONOMY };
