/**
 * Quiz generation coordinator: wraps ai-engine output with validation,
 * an overall watchdog timeout, status callbacks, and a user-friendly
 * failure result. Consumed by quiz-page.js on the GENERATING step.
 */

import { CONFIG } from '../config.js';
import { isValidCount } from './question-count.js';
import { canonicalSubject } from './subjects.js';
import { isQuestionObject } from '../validation.js';
import { sleep } from '../utils.js';
import { generateQuiz } from '../ai/ai-engine.js';

export class GenerationError extends Error {
  constructor(message, code = 'GEN_ERROR') {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
  }
}

/**
 * Generate + validate a quiz.
 * @returns {Promise<{ questions: Array, source: string, meta: object }>}
 */
export async function generateQuestions({ subject, difficulty, count, onProgress = () => {} }) {
  const safeSubject = canonicalSubject(subject) || subject;
  const safeCount = isValidCount(count) ? count : (count > 0 ? count : 10);

  const watchdog = withWatchdog(CONFIG.ai.globalTimeoutMs, 'Waktu pembuatan soal habis.');

  let result;
  try {
    result = await watchdog(async () => {
      const questions = await generateQuiz({
        subject: safeSubject,
        difficulty,
        count: safeCount,
        onProgress,
      });
      const valid = (questions || []).filter((q) => isQuestionObject(q, safeSubject));
      return { questions: valid, source: valid.length ? detectSource(valid) : 'none' };
    });
  } catch (err) {
    const message = err && err.message ? err.message : 'Gagal membuat soal.';
    const code = /habis|timeout|timed out|waktu/i.test(message) ? 'GEN_TIMEOUT' : 'GEN_ERROR';
    throw new GenerationError(message, code);
  }

  if (!result.questions.length) {
    throw new GenerationError('Tidak ada soal yang berhasil dibuat.', 'GEN_EMPTY');
  }
  if (result.questions.length < safeCount) {
    // The engine normally fills the requested count. Keep this guard tolerant
    // so a provider race can never display a shorter quiz.
    throw new GenerationError(`Soal yang tersedia hanya ${result.questions.length} dari ${safeCount}. Silakan coba lagi.`, 'GEN_SHORT');
  }
  return result;
}

function detectSource(questions) {
  const src = questions.length && questions[0].source ? questions[0].source : 'provider';
  const all = questions.every((q) => q.source === src);
  return all ? src : 'mixed';
}

function withWatchdog(ms, label) {
  return async (fn) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    });
    try {
      return await Promise.race([fn(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  };
}

export default { generateQuestions, GenerationError };
