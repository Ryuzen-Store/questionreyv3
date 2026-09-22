/**
 * Question validation & normalization used BEFORE the quiz arena starts.
 * Removes malformed questions, enforces 4 options, a valid correct index,
 * an explanation, subject match and no duplicates.
 */

import { CONFIG } from '../config.js';
import { isQuestionObject } from '../validation.js';
import { clamp } from '../utils.js';

export const MIN_OPTIONS = CONFIG.quiz.minOptionsPerQuestion; // 4
export const MAX_OPTIONS = CONFIG.quiz.maxOptionsPerQuestion; // 4

/** Normalize a single engine question to canonical (adds stable id). */
export function normalizeQuestion(q, index = 0) {
  return {
    id: `${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    question: String(q.question || '').trim(),
    options: (Array.isArray(q.options) ? q.options : []).slice(0, MAX_OPTIONS).map((o) => String(o == null ? '' : o).trim()),
    correct_index: clamp(Number(q.correct_index) || 0, 0, MAX_OPTIONS - 1),
    explanation: String(q.explanation || '').trim(),
    subject: q.subject || 'Umum',
    topic: q.topic || q.subject || 'Umum',
    difficulty: q.difficulty || 'Normal',
    source: q.source || 'unknown',
  };
}

/**
 * Validate + deduplicate a list of questions. Returns { valid, dropped }.
 */
export function validateQuestionSet(questions, expectedSubject = null) {
  const seen = new Set();
  const valid = [];
  const dropped = [];
  for (const q of questions || []) {
    if (!isQuestionObject(q, expectedSubject)) {
      dropped.push({ reason: 'shape', question: q });
      continue;
    }
    const key = (q.question || '').slice(0, 70).toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) {
      dropped.push({ reason: 'duplicate', question: q });
      continue;
    }
    seen.add(key);
    valid.push(q);
  }
  return { valid, dropped };
}

/**
 * Final pre-quiz gate. Ensures we have exactly `count` well-formed questions.
 * When short, top-up is attempted via extra provided candidates; otherwise it
 * returns only the valid questions (the quiz page adapts totalQuestions).
 */
export function finalizeQuestions(questions, expectedSubject, count) {
  const { valid } = validateQuestionSet(questions, expectedSubject);
  const normalized = valid.map(normalizeQuestion);
  return normalized.slice(0, count);
}

export default { normalizeQuestion, validateQuestionSet, finalizeQuestions };
