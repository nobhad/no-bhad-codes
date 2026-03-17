/**
 * ===============================================
 * useClickOutside Hook
 * ===============================================
 * @file src/react/hooks/useClickOutside.ts
 *
 * Shared hook for closing dropdowns, modals, and popovers
 * when the user clicks outside the referenced element.
 * Replaces 7+ duplicate addEventListener patterns.
 */

import { useEffect, type RefObject } from 'react';

/**
 * Calls `onClose` when a mousedown occurs outside `ref`.
 * Only active when `isOpen` is true.
 *
 * Accepts a single ref OR an array of refs (for portaled elements
 * where the trigger and menu are in separate DOM trees).
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  onClose: () => void,
  isOpen: boolean
): void {
  useEffect(() => {
    if (!isOpen) return;

    const refs = Array.isArray(ref) ? ref : [ref];

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      const isInside = refs.some((r) => r.current?.contains(target));
      if (!isInside) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [ref, onClose, isOpen]);
}
