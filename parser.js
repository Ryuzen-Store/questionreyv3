/**
 * Robust AI response parser.
 *
 * Accepts the observed envelopes plus free-form variants, extracts the array
 * of questions, normalizes fields, deduplicates, and applies structural
 * validation. Returns an empty array for anything unusable.
 */

import { isQuestionObject } from '../validation.js';

function stripCodeFence(value) {
  return String(value || '')
    .trim()
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function tryJson(value) {
  const cleaned = stripCodeFence(value);
  try { return JSON.parse(cleaned); } catch (err) { /* continue */ }
  // Providers sometimes return JSON with a short prose prefix/suffix.
  const starts = [cleaned.indexOf('{'), cleaned.indexOf('[')].filter((i) => i >= 0);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const open = cleaned[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)); } catch (err) { return null; }
      }
    }
  }
  return null;
}

/** Parsed envelope from a provider result. */
export function parseEnvelope(result) {
  try {
    return tryJson(result.text);
  } catch (err) {
    return null;
  }
}

/**
 * Extract candidate questions from any supported shape:
 *  - success envelope {"success":true,"data":{"result":{"gpt":...}}}
 *  - {questions:[...]} / [...]
 *  - raw text response (contains a JSON object/array)
 */
export function extractQuestions(result, expectedSubject) {
  const source = [];

  // Strip known provider non-content markers.
  const gptValue = (env) => {
    const raw = env && env.data && env.data.result && (env.data.result.gpt ?? env.data.result.content ?? env.data.result.text);
    if (typeof raw === 'string') {
      if (/sign up and repeat your request/i.test(raw)) return null;
      if (/internal server error/i.test(raw)) return null;
      return raw;
    }
    return null;
  };

  const pouch = [];
  const pushUnique = (arr) => { for (const q of arr) pouch.push(q); };

  // 1) success envelope string content
  const env = parseEnvelope(result);
  if (env) {
    if (env.success === false) {
      const errMsg = String(env.error || env.message || '').toLowerCase();
      // Reject provider-side errors as unusable (fallthrough to fallback).
      result.providerError = env.error || env.message || 'provider error';
      if (/sign up|internal server|unauthorized|forbidden|invalid key|rate limit/i.test(errMsg)) return [];
    }
    const g = gptValue(env);
    if (g) source.push(g);
    else if (Array.isArray(env.data)) pushUnique(env.data);
    else if (env.data && Array.isArray(env.data.result)) pushUnique(env.data.result);
  }

  // 2) envelope embedded raw arrays/objects
  if (env && !source.length) {
    const candidates = [
      env.questions, env.result, env.answers,
      env.data && env.data.questions,
      env.data && env.data.result && env.data.result.questions,
    ];
    for (const c of candidates) if (Array.isArray(c)) pushUnique(c);
  }

  // 3) raw text that itself contains JSON (fallback for plain-text AIs)
  let text = result.text || '';
  if (!source.length && text) {
    // Only try multiline JSON if the body is not HTML
    const trimmed = text.trim();
    let candidate = null;
    try { candidate = JSON.parse(trimmed); if (candidate && typeof candidate === 'object') source.push(JSON.stringify(candidate)); }
    catch (err) { candidate = null; }

    if (!candidate) {
      // Balanced-brace object finder
      const objStart = trimmed.indexOf('{');
      const arrStart = trimmed.indexOf('[');
      const startIdx = [objStart, arrStart].filter((i) => i >= 0);
      if (startIdx.length) {
        const start = Math.min(...startIdx);
        const open = trimmed[start];
        const close = open === '{' ? '}' : ']';
        let depth = 0;
        let end = -1;
        for (let i = start; i < trimmed.length; i++) {
          const ch = trimmed[i];
          if (ch === open) depth++;
          else if (ch === close) { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end > start) source.push(trimmed.slice(start, end + 1));
      }
    }
  }

  // Now transform every source chunk into question arrays
  let rawList = [];
  for (const chunk of source) {
    let data = null;
    if (typeof chunk !== 'string') { data = chunk; }
    else {
      data = tryJson(chunk);
    }
    if (Array.isArray(data)) { rawList = rawList.concat(data); continue; }
    if (data && typeof data === 'object') {
      const arr = data.questions || data.data || data.result || data.quiz || data.soal;
      if (Array.isArray(arr)) rawList = rawList.concat(arr);
      else if (isQuestionObject(data)) rawList.push(data);
    }
  }

  if (!rawList.length) return [];

  // Normalize + validate + dedupe
  const seen = new Set();
  const out = [];
  for (const q of rawList) {
    const norm = normalizeQuestion(q, expectedSubject);
    if (!norm) continue;
    if (!isQuestionObject(norm, expectedSubject)) continue;
    const dupKey = `${norm.subject}|${norm.question.slice(0, 60).toLowerCase().replace(/\s+/g, ' ')}`;
    if (seen.has(dupKey)) continue;
    seen.add(dupKey);
    out.push(norm);
  }
  return out;
}

/** Normalize one question item into the canonical shape (English field names). */
export function normalizeQuestion(q, expectedSubject) {
  if (!q || typeof q !== 'object') return null;
  const text = firstNonEmpty([q.question, q.question_text, q.text, q.soal, q.pertanyaan]);
  if (!text) return null;

  let options = q.options ?? q.choices ?? q.answers ?? q.pilihan ?? q.jawaban;
  if (!Array.isArray(options)) return null;
  // Flatten possible {A:'',B:'',C:'',D:''} maps
  if (options.length === 1 && options[0] && typeof options[0] === 'object' && !Array.isArray(options[0])) {
    options = ['A', 'B', 'C', 'D', 'E', 'F'].map((k) => options[0][k]).filter((v) => v !== undefined && v !== null);
  }
  options = options.slice(0, 6).map((o) => {
    if (typeof o === 'string') return o.trim();
    if (o && typeof o === 'object' && typeof o.text === 'string') return o.text.trim();
    return String(o == null ? '' : o).trim();
  });
  if (options.length !== 6 || options.some((o) => !o)) return null;

  const idxRaw = q.correct_indices ?? q.correctIndexes ?? q.correct_index ?? q.correctIndex ?? q.answer_index ?? q.answer ?? q.correct ?? q.kunci;
  const ci = resolveCorrectIndices(idxRaw, options);
  if (!Array.isArray(ci) || ci.length !== 2) return null;

  const explanation = firstNonEmpty([q.explanation, q.pembahasan, q.reason, q.explain, q.jawaban_penjelasan]);
  if (!explanation) return null;

  const subject = firstNonEmpty([q.subject, q.mapel, q.mata_pelajaran]) || expectedSubject || 'Umum';
  const topic = firstNonEmpty([q.topic, q.subtopic, q.topik, q.bab]) || subject;
  const difficulty = firstNonEmpty([q.difficulty, q.level, q.kesulitan]) || 'Normal';

  return {
    question: text,
    options,
    correct_indices: ci,
    correct_index: ci[0],
    explanation,
    subject,
    topic,
    difficulty,
  };
}

function firstNonEmpty(keys) {
  for (const k of keys) {
    if (k === undefined || k === null) continue;
    if (typeof k === 'string') { const v = k.trim(); if (v) return v; }
    else if (typeof k === 'number') return k;
  }
  return null;
}

/** Convert the correct-answer field to an index 0..3. */
function resolveCorrectIndices(raw, options) {
  let values = Array.isArray(raw) ? raw : (typeof raw === 'string' && /[,|]/.test(raw) ? raw.split(/[,|]/) : [raw]);
  const out = [];
  for (const value of values) {
    const one = resolveCorrectIndex(value, options);
    if (Number.isInteger(one) && one >= 0 && one < 6 && !out.includes(one)) out.push(one);
  }
  return out.length === 2 ? out.sort((a,b) => a-b) : null;
}

function resolveCorrectIndex(raw, options) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null;
  const s = String(raw).trim();
  if (/^[0-3]$/.test(s)) return parseInt(s, 10);
  // Letter form A/B/C/D
  const letter = s.replace(/[^a-fA-F]/g, '').slice(-1).toUpperCase();
  if (letter && 'ABCDEF'.includes(letter)) return 'ABCDEF'.indexOf(letter);
  // Exact text match
  const matchIdx = options.findIndex((o, i) => {
    if (!o) return false;
    const oN = o.replace(/^[A-Da-d][.]:\s*/, '').trim().toLowerCase();
    const sN = s.replace(/^[A-Fa-f][.)]:\s*/, '').trim().toLowerCase();
    return oN === sN && oN.length > 1;
  });
  return matchIdx >= 0 ? matchIdx : null;
}

export default { parseEnvelope, extractQuestions, normalizeQuestion };
