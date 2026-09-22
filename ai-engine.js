/**
 * AI generation engine. Orchestrates the full question-generation lifecycle:
 *
 *   cache? → parallel providers (first valid wins) → optional split retry
 *   → DB catalog → local bank.
 *
 * Emits progress via `onProgress` so the generation screen can update status.
 */

import { CONFIG } from '../config.js';
import { SUBJECT_TAXONOMY, LEVEL_DESCRIPTORS } from '../data/bank.js';
import { isQuestionObject } from '../validation.js';
import { sleep } from '../utils.js';
import { raceProviders } from './providers.js';
import { extractQuestions } from './parser.js';
import { saveCache, readCache } from './cache.js';
import { resolveFromFallback } from './failover.js';
import { getQuestionsFromDb } from '../supabase/database.js';

/** Level label from id. */
export function difficultyLabel(difficultyId) {
  const d = (CONFIG.quiz.difficulties || []).find((x) => x.id === difficultyId);
  return d ? d.label : (LEVEL_DESCRIPTORS[difficultyId] ? LEVEL_DESCRIPTORS[difficultyId].label : 'Normal');
}

/**
 * Build the single generation prompt that asks for ALL questions at once.
 */
export function buildPrompt(subject, difficultyId, count) {
  const level = LEVEL_DESCRIPTORS[difficultyId] || LEVEL_DESCRIPTORS.normal;
  const taxonomy = (SUBJECT_TAXONOMY[subject] || [subject]);
  const topicList = Array.isArray(taxonomy)
    ? taxonomy.join(', ')
    : String(taxonomy);

  // Fundamentals ratio for large quizzes (violate difficulty a little on purpose)
  let fundamentals = '';
  if (count > 20) {
    const ratio = Math.round(CONFIG.quiz.fundamentalsRatio * 100);
    fundamentals = `Sekitar ${ratio}% soal boleh bersifat dasar/penguatan untuk mempertahankan pemahaman fondasi.`;
  }

  return [
    `Kamu adalah pembuat soal ujian berbahasa Indonesia untuk platform "QuestionRy Multi Quest".`,
    ``,
    `Buatkan TEPAT ${count} soal pilihan ganda tentang mata pelajaran: ${subject}.`,
    `Cakupan subtopik (gunakan secara seimbang, dan boleh meluas ke topik relevan): ${topicList}.`,
    ``,
    `TINGKAT KESULITAN: ${level.label}. ${level.instruction}`,
    fundamentals,
    ``,
    `ATURAN WAJIB:`,
    `1. Setiap soal memiliki tepat 6 pilihan jawaban (A, B, C, D, E, F) dan WAJIB TEPAT DUA jawaban benar.`,
    `2. Tulis pertanyaan dengan jelas, singkat, dan tidak ambigu dalam Bahasa Indonesia.`,
    `3. Setiap soal wajib memiliki penjelasan (explanation) yang mendidik, menjelaskan mengapa jawaban tersebut benar.`,
    `4. Hindari soal duplikat (pertanyaan yang sama persis atau hampir sama).`,
    `5. Hanya gunakan subjek "${subject}" — jangan mencampur mata pelajaran lain.`,
    `6. Nomor jawaban benar harus berupa array tepat dua indeks angka 0 sampai 5 (0=A, 1=B, 2=C, 3=D, 4=E, 5=F).`,
    ``,
    `KELUARKAN HANYA JSON yang valid, tanpa markdown, tanpa komentar, dengan struktur tepat seperti ini:`,
    `{"questions":[{"question":"...","options":["...","...","...","...","...","..."],"correct_indices":[0,3],"explanation":"...","subject":"${subject}","topic":"...","difficulty":"${level.label}"}]}`,
  ].join('\n');
}

/**
 * Validate + normalize a provider's raw result into engine questions.
 * Returns `[]` for anything not usable.
 */
function parseAndValidate(provider, result, expectedSubject) {
  const questions = extractQuestions(result, expectedSubject);
  if (!questions.length) return [];
  return questions;
}

/**
 * Generate `count` questions for subject/difficulty.
 *
 * @param {object} opts { subject, difficulty, count, onProgress(phase, meta), signal }
 * @returns {Promise<Array>} validated question array (exact count when possible)
 */
export async function generateQuiz({ subject, difficulty, count, onProgress = () => {} } = {}) {
  const progress = (phase, meta = {}) => { try { onProgress(phase, meta); } catch (e) { /* ignore */ } };
  const need = Math.min(count, CONFIG.ai.maxQuestionsPerRequest);

  // 0) cache hit
  progress('cache', { subject, difficulty, count });
  const cached = readCache(subject, difficulty, count);
  if (cached && cached.length >= need && cached.every((q) => isQuestionObject(q, subject))) {
    progress('cache-hit', { source: 'cache', total: cached.length });
    return cached.slice(0, need);
  }

  const prompt = buildPrompt(subject, difficulty, need);
  const parseForSubject = (provider, result) => parseAndValidate(provider, result, subject);

  // 1) primary parallel race across ALL providers
  progress('generating', { total: CONFIG.ai.providers.length });
  const primary = await raceProviders(CONFIG.ai.providers, prompt, parseForSubject, {
    timeoutMs: CONFIG.ai.requestTimeoutMs,
  });
  let partialForFallback = (primary.questions || []).slice();

  if (partialForFallback.length >= need) {
    progress('done', { source: primary.winner ? primary.winner.id : 'provider', total: partialForFallback.length });
    saveCache(subject, difficulty, count, partialForFallback);
    return partialForFallback.slice(0, need);
  }

  // 2) split retry when outputs are partial but valid (large quizzes)
  if (CONFIG.ai.allowSplitRetry && partialForFallback.length > 0) {
    progress('retry', { have: partialForFallback.length, need });
    const missing = need - partialForFallback.length;
    const chunkSize = Math.max(CONFIG.ai.minQuestionsPerRequest, Math.ceil(missing / 2));
    const composed = [...partialForFallback];
    let guard = 0;
    while (composed.length < need && guard < 3) {
      guard++;
      const stillMissing = need - composed.length;
      const ask = Math.min(chunkSize, stillMissing);
      progress('retry-chunk', { ask, have: composed.length });
      const chunkPrompt = `Lanjutkan. Buatkan TEPAT ${ask} soal BARU (tidak boleh sama dengan sebelumnya) dengan subjek ${subject}, tingkat ${difficultyLabel(difficulty)}. Keluar hanya JSON dengan struktur {"questions":[...]}.`;
      const chunkResult = await raceProviders(CONFIG.ai.providers, chunkPrompt, parseForSubject, {
        timeoutMs: CONFIG.ai.requestTimeoutMs,
      });
      if (chunkResult.questions && chunkResult.questions.length) {
        for (const q of chunkResult.questions) {
          if (composed.length >= need) break;
          const duplicate = composed.some((c) => (c.question || '').slice(0, 50).toLowerCase() === (q.question || '').slice(0, 50).toLowerCase());
          if (!duplicate) composed.push(q);
        }
      } else {
        break; // no more valid output — stop looping
      }
      await sleep(120);
    }
    if (composed.length >= need) {
      progress('done', { source: 'split', total: composed.length });
      saveCache(subject, difficulty, count, composed);
      return composed.slice(0, need);
    }
    partialForFallback = composed;
  }

  // 3) DB catalog
  progress('database', { subject });
  let dbQuestions = [];
  try {
    dbQuestions = await getQuestionsFromDb({ subject });
  } catch (err) {
    dbQuestions = [];
  }

  // 4) local bank fallback (guarantees a non-empty result)
  progress('fallback', { subject });
  const fallbackQuestions = resolveFromFallback(subject, difficulty, need, { dbQuestions });
  const final = mergeValid(partialForFallback, fallbackQuestions, subject, need);
  progress('done', { source: 'fallback', total: final.length });
  if (final.length) saveCache(subject, difficulty, count, final);
  return final;
}

/** Merge valid questions from multiple sources up to `need`, deduped. */
function mergeValid(partial, fallback, subject, need) {
  const out = [];
  const seen = new Set();
  const pushItem = (q) => {
    if (!isQuestionObject(q, subject)) return;
    const baseKey = (q.question || '').slice(0, 60).toLowerCase().replace(/\s+/g, ' ');
    // AI/DB questions are deduplicated. The local fallback may intentionally
    // recycle its own bank when a 40/45-question quiz is requested, so those
    // marked repeats must still count toward the requested total.
    const key = q.source === 'bank-repeat'
      ? `${baseKey}|repeat:${q.fallbackIndex ?? out.length}`
      : baseKey;
    if (seen.has(key)) return;
    seen.add(key);
    q.subject = subject;
    out.push(q);
  };
  for (const q of partial || []) pushItem(q);
  for (const q of fallback || []) { if (out.length >= need) break; pushItem(q); }
  return out.slice(0, need);
}

export default { generateQuiz, buildPrompt, difficultyLabel };
