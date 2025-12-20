/**
 * @file state/types.ts
 * @description Type definitions for state management
 */

import type { StateManager } from './state-manager';

export interface WorkItem {
  id: string | number;
  title: string;
  description?: string;
  category?: string;
  image?: string;
  url?: string;
  tags?: string[];
}

export type StateListener<T> = (newState: T, previousState: T) => void;
export type StateSelector<T, U> = (state: T) => U;
export type StateAction<_T = unknown> = {
  type: string;
  payload?: unknown;
  meta?: {
    timestamp: number;
    source?: string;
  };
};
export type StateReducer<T> = (state: T, action: StateAction<T>) => Partial<T>;
export type StateMiddleware<T> = (
  store: StateManager<T>
) => (next: (action: StateAction<T>) => void) => (action: StateAction<T>) => void;
export type ComputedProperty<T, U> = {
  selector: StateSelector<T, U>;
  dependencies: (keyof T)[];
  lastValue?: U;
  listeners: ((value: U) => void)[];
};

export interface AppState {
  // UI State
  theme: 'light' | 'dark';
  navOpen: boolean;
  currentSection: string | null;

  // Intro State
  introComplete: boolean;
  introAnimating: boolean;

  // Works State
  currentChannel: number;
  channelsLoaded: boolean;
  worksData: WorkItem[] | null;

  // Form State
  contactFormVisible: boolean;
  contactFormSubmitting: boolean;

  // Performance State
  reducedMotion: boolean;
  devicePixelRatio: number;

  // Network State
  online: boolean;
  connectionType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

  // Error State
  lastError: string | null;
  errorCount: number;
}
