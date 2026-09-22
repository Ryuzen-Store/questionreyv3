/**
 * Difficulty level definitions + descriptor access. Difficulty genuinely
 * alters the generation prompt (see ai-engine.js / data/bank.js).
 */

import { LEVEL_DESCRIPTORS } from '../data/bank.js';

export const LEVELS = [
  { id: 'easy', label: 'Easy', short: 'EASY', color: 'mint', icon: 'i-check', description: 'Konsep dasar, ingatan langsung, dan perhitungan sederhana.' },
  { id: 'normal', label: 'Normal', short: 'NORMAL', color: 'sky', icon: 'i-stats', description: 'Penalaran sedang, penerapan konsep, soal bertingkat.' },
  { id: 'hard', label: 'Hard', short: 'HARD', color: 'amber', icon: 'i-score', description: 'Penalaran lanjutan dan analisis multi-langkah.' },
  { id: 'impossible', label: 'Impossible', short: 'IMPOSSIBLE', color: 'rose', icon: 'i-lock', description: 'Tantangan ekstrem: konsep terhubung, kasus tepi, analisis mendalam.' },
];

/** Canonical list of valid difficulty ids. */
export const LEVEL_IDS = LEVELS.map((l) => l.id);

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || null;
}

export function levelLabel(id) {
  const level = getLevel(id);
  if (level) return level.label;
  if (LEVEL_DESCRIPTORS[id]) return LEVEL_DESCRIPTORS[id].label;
  return 'Normal';
}

export function levelDescriptor(id) {
  return LEVEL_DESCRIPTORS[id] || LEVEL_DESCRIPTORS.normal;
}

export default LEVELS;
