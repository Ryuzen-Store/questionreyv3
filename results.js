/**
 * Result helpers + persistence of quiz logs. The Result page reads the saved
 * draft (storage.js) — it NEVER re-invokes the AI.
 */

import { CONFIG } from '../config.js';
import { storage } from '../storage.js';
import { insertQuizLog } from '../supabase/database.js';
import { tryGetClient } from '../supabase/client.js';
import { getUser } from '../supabase/auth.js';

const DRAFT_KEY = 'qrquest.quiz.draft';
const LAST_RESULT_KEY = 'qrquest.quiz.last_result';

export function saveQuizDraft(state) {
  storage.setJSON('session', DRAFT_KEY, {
    subject: state.subject,
    difficulty: state.difficulty,
    totalQuestions: state.totalQuestions,
    currentIndex: state.currentIndex,
    questions: state.questions,
    answers: state.answers,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
  });
}

export function loadQuizDraft() {
  const draft = storage.getJSON('session', DRAFT_KEY, null);
  if (!draft || !Array.isArray(draft.questions) || !draft.questions.length) return null;
  return draft;
}

export function clearQuizDraft() {
  storage.remove('session', DRAFT_KEY);
}

export function hasInProgressDraft() {
  const d = loadQuizDraft();
  return Boolean(d && !d.finishedAt);
}

/**
 * Persist the finished quiz summary for the dashboard/result pages, and
 * push a quiz_log row to Supabase when a user is signed in (RLS allows
 * creating own history). Offline/guest results are kept locally so the
 * dashboard still reflects the last quiz on this device.
 */
export async function persistFinishedQuiz(summary, state) {
  const record = {
    subject: state.subject,
    difficulty: state.difficulty,
    totalQuestions: summary.total,
    correctCount: summary.correct,
    score: summary.score,
    answers: state.answers,
    deviceInfo: getDeviceInfo(),
    finishedAt: state.finishedAt || Date.now(),
  };
  storage.setJSON('session', LAST_RESULT_KEY, record);

  const client = tryGetClient();
  if (client) {
    const user = await getUser().catch(() => null);
    if (user) {
      try {
        await insertQuizLog(record);
      } catch (err) {
        console.warn('[results] insertQuizLog failed', err.message);
        queueOfflineLog(record);
      }
    }
  }
  return record;
}

export function getLastResult() {
  return storage.getJSON('session', LAST_RESULT_KEY, null);
}

/* Offline quiz-log queue (retried on next app boot in app.js). */
export function queueOfflineLog(record) {
  const queue = storage.getJSON('local', 'qrquest.quiz.log_queue', []);
  queue.push(record);
  storage.setJSON('local', 'qrquest.quiz.log_queue', queue.slice(-30));
}

export function peekOfflineLogs() {
  return storage.getJSON('local', 'qrquest.quiz.log_queue', []);
}

export function clearOfflineLogs() {
  storage.remove('local', 'qrquest.quiz.log_queue');
}

export default { saveQuizDraft, loadQuizDraft, clearQuizDraft, hasInProgressDraft, persistFinishedQuiz, getLastResult, queueOfflineLog, peekOfflineLogs, clearOfflineLogs };


function getDeviceInfo() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const ua = String(nav.userAgent || '');
  let type = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop';
  let platform = String(nav.platform || 'Unknown');
  let model = 'Tidak tersedia dari browser';
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android\s[^;)]*(?:;\s*[^;)]*)?;\s*([^;)]+?)(?:\s+Build\/[^;)]+)?[;) ]/i);
    if (m && m[1]) model = m[1].trim();
  } else if (/iPhone/i.test(ua)) model = 'iPhone';
  else if (/iPad/i.test(ua)) model = 'iPad';
  return { type, platform, model, userAgent: ua.slice(0, 1000), language: nav.language || '', screen: `${screen?.width || 0}x${screen?.height || 0}`, captured_at: new Date().toISOString() };
}
