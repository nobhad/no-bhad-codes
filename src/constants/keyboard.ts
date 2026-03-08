/**
 * ===============================================
 * KEYBOARD CONSTANTS
 * ===============================================
 * @file src/constants/keyboard.ts
 *
 * Centralized keyboard key constants for event handlers.
 * Use these instead of inline key strings for consistency.
 */

export const KEYS = {
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  SPACE: ' ',
  TAB: 'Tab',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  HOME: 'Home',
  END: 'End',
  BACKSPACE: 'Backspace',
  DELETE: 'Delete'
} as const;

export type KeyValue = (typeof KEYS)[keyof typeof KEYS];

/**
 * Check if an event matches a keyboard shortcut with modifier
 */
export function isKeyCombo(
  e: React.KeyboardEvent | KeyboardEvent,
  key: string,
  modifier: 'cmd' | 'ctrl' | 'shift' | 'alt'
): boolean {
  const modMap = {
    cmd: e.metaKey || e.ctrlKey,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey
  };
  return modMap[modifier] && e.key === key;
}
