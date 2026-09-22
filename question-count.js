/**
 * Question-count options + related helpers.
 */

import { CONFIG } from '../config.js';

export const COUNTS = CONFIG.quiz.counts; // [10, 15, 20, 30, 40, 45]

export function isValidCount(value) {
  const n = Number(value);
  return COUNTS.includes(n);
}

/** Human hint per count. */
export function countNote(count) {
  if (count <= 10) return 'Sesi cepat, cocok untuk latihan singkat.';
  if (count <= 20) return 'Durasi menengah, keseimbangan materi.';
  if (count <= 30) return 'Latihan intensif dengan variasi subtopik.';
  return 'Tantangan panjang — menyertakan soal penguatan fondasi.';
}

export default COUNTS;
