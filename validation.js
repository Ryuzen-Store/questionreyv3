/**
 * Lightweight validation helpers for forms and data shapes (quiz, questions,
 * profile edits, admin forms). Shared by auth page, settings and generators.
 */

export const validators = {
  email(value) {
    const v = String(value || '').trim();
    if (!v) return 'Email wajib diisi.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Format email tidak valid.';
    return null;
  },

  password(value, { min = 6 } = {}) {
    const v = String(value || '');
    if (!v) return 'Kata sandi wajib diisi.';
    if (v.length < min) return `Kata sandi minimal ${min} karakter.`;
    return null;
  },

  playerTag(value) {
    const v = String(value || '').trim();
    if (v.length < 3) return 'Player tag minimal 3 karakter.';
    if (v.length > 20) return 'Player tag maksimal 20 karakter.';
    if (!/^[\p{L}\p{N}_\- ]+$/u.test(v)) return 'Hanya huruf, angka, spasi, _ dan - yang diizinkan.';
    return null;
  },

  /** Returns null when OK, or the first error string. */
  run(field, value, rules) {
    if (field === 'email') return this.email(value);
    if (field === 'password') return this.password(value, rules || {});
    if (field === 'playerTag') return this.playerTag(value);
    return null;
  },
};

/**
 * Basic shape check for a single quiz question record.
 * `expectedSubject` is optional; when provided the question must match it
 * (case-insensitive) for the provider payload to be accepted.
 */
export function isQuestionObject(q, expectedSubject = null) {
  if (!q || typeof q !== 'object') return false;
  const text = String((q.question || q.question_text || '')).trim();
  if (!text) return false;
  const options = q.options;
  if (!Array.isArray(options) || options.length !== 6) return false;
  if (!options.every((o) => typeof o === 'string' && o.trim().length > 0)) return false;
  const raw = q.correct_indices ?? q.correctIndexes ?? q.correct_index ?? q.correctIndex ?? q.answer;
  const arr = Array.isArray(raw) ? raw : [raw];
  const indices = arr.map(Number).filter(Number.isInteger);
  if (indices.length !== 2 || new Set(indices).size !== 2 || indices.some((i) => i < 0 || i > 5)) return false;
  const explanation = String((q.explanation || q.pembahasan || '')).trim();
  if (!explanation) return false;
  if (expectedSubject) {
    const subj = String(q.subject || expectedSubject).trim().toLowerCase();
    if (subj && subj !== expectedSubject.toLowerCase()) return false;
  }
  return true;
}

export default validators;
