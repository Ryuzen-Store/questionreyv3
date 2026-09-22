/**
 * Subject definitions — the five top-level subjects only:
 * Matematika / IPA / IPS / Sejarah / Informatika.
 * Each carries a contextual icon id and an accent color.
 * The full subtopic taxonomy lives in data/bank.js.
 */

import { SUBJECT_TAXONOMY } from '../data/bank.js';

export const SUBJECTS = [
  { id: 'Matematika', label: 'MATEMATIKA', icon: 'i-quiz', color: 'violet', short: 'MAT' },
  { id: 'IPA', label: 'IPA', icon: 'i-quiz', color: 'mint', short: 'IPA' },
  { id: 'IPS', label: 'IPS', icon: 'i-dashboard', color: 'amber', short: 'IPS' },
  { id: 'Sejarah', label: 'SEJARAH', icon: 'i-history', color: 'sky', short: 'SEJ' },
  { id: 'Informatika', label: 'INFORMATIKA', icon: 'i-server', color: 'rose', short: 'INF' },
];

/** Plain string list of the canonical subject ids. */
export const SUBJECT_IDS = SUBJECTS.map((s) => s.id);

export function getSubject(id) {
  return SUBJECTS.find((s) => s.id === id || s.id.toLowerCase() === String(id || '').toLowerCase()) || null;
}

/** Subtopic summary for the step title (joins taxonomy items). */
export function topicSummary(subject) {
  const taxonomy = SUBJECT_TAXONOMY[subject];
  if (!Array.isArray(taxonomy) || !taxonomy.length) return 'Topik relevan dicakup otomatis.';
  const slice = taxonomy.slice(0, 4).map((t) => String(t).split(':')[0].trim());
  return `Meliputi ${slice.join(', ')}${taxonomy.length > 4 ? ', dan lainnya' : ''}.`;
}

/**
 * Validate an unknown subject string against the canonical list.
 * Returns the canonical id when supported, otherwise null.
 */
export function canonicalSubject(raw) {
  if (!raw) return null;
  const match = getSubject(raw);
  return match ? match.id : null;
}

export default SUBJECTS;
