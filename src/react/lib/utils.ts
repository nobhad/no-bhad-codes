import { clsx, type ClassValue } from 'clsx';

/**
 * Join class names, dropping falsy values. This used to run the result
 * through tailwind-merge as well; Tailwind was removed in 2026-09 (no
 * utility class was ever used), and the portal's own class names have no
 * conflicts for a merger to resolve.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
