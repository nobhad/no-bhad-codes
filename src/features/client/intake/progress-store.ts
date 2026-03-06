/**
 * ===============================================
 * INTAKE - PROGRESS PERSISTENCE
 * ===============================================
 * @file src/features/client/intake/progress-store.ts
 *
 * Handles saving, loading, and clearing intake progress
 * from localStorage with 24-hour expiry.
 */

import type { SavedProgress, IntakeData } from '../terminal-intake-types';

const STORAGE_KEY = 'terminalIntakeProgress';
const EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Save current intake progress to localStorage.
 */
export function saveIntakeProgress(
  currentQuestionIndex: number,
  intakeData: IntakeData
): void {
  const progress: SavedProgress = {
    currentQuestionIndex,
    intakeData,
    timestamp: Date.now()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

/**
 * Load saved intake progress from localStorage.
 * Returns null if no progress exists or if it has expired.
 */
export function loadIntakeProgress(): SavedProgress | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const progress = JSON.parse(saved) as SavedProgress;
      if (Date.now() - progress.timestamp < EXPIRY_MS) {
        return progress;
      }
    }
  } catch {
    // Silently fail on corrupt data
  }
  return null;
}

/**
 * Clear saved intake progress from localStorage.
 */
export function clearIntakeProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
}
