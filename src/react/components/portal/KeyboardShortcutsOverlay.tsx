/**
 * ===============================================
 * KEYBOARD SHORTCUTS OVERLAY
 * ===============================================
 * @file src/react/components/portal/KeyboardShortcutsOverlay.tsx
 *
 * Displays available keyboard shortcuts in a modal overlay.
 * Triggered by pressing "?" when not focused on an input.
 * Follows the CommandPalette pattern for consistency.
 */

import * as React from 'react';
import { Keyboard } from 'lucide-react';
import { usePortalRole } from '../../stores/portal-store';
import { KEYS } from '../../../constants/keyboard';
import { useFadeIn, useScaleIn } from '../../hooks/useGsap';

// ============================================
// CONSTANTS
// ============================================

const SHORTCUT_KEY = '?';

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

function getShortcutGroups(role: string, isMac: boolean): ShortcutGroup[] {
  const mod = isMac ? '\u2318' : 'Ctrl';

  const groups: ShortcutGroup[] = [
    {
      title: 'Navigation',
      shortcuts: [
        { keys: [`${mod}+K`], description: 'Open command palette' },
        { keys: [SHORTCUT_KEY], description: 'Show keyboard shortcuts' },
        { keys: ['Esc'], description: 'Close overlay / cancel' },
        { keys: ['/'], description: 'Focus search' },
        { keys: ['r'], description: 'Refresh current view' }
      ]
    },
    {
      title: 'Go To',
      shortcuts: [
        { keys: ['g', 'd'], description: 'Go to Dashboard' },
        { keys: ['g', 'p'], description: 'Go to Projects' },
        { keys: ['g', 'm'], description: 'Go to Messages' },
        { keys: ['g', 'i'], description: 'Go to Invoices' },
        { keys: ['g', 's'], description: 'Go to Settings' }
      ]
    },
    {
      title: 'Messages',
      shortcuts: [
        { keys: ['Enter'], description: 'Send message' },
        { keys: ['Shift+Enter'], description: 'New line in message' }
      ]
    },
    {
      title: 'Tables & Lists',
      shortcuts: [
        { keys: ['Tab'], description: 'Move to next element' },
        { keys: ['Shift+Tab'], description: 'Move to previous element' },
        { keys: ['Enter'], description: 'Open / confirm selection' }
      ]
    }
  ];

  if (role === 'admin') {
    groups.splice(1, 0, {
      title: 'Admin Quick Access',
      shortcuts: [
        { keys: ['1'], description: 'Dashboard' },
        { keys: ['2'], description: 'Work' },
        { keys: ['3'], description: 'CRM' },
        { keys: ['4'], description: 'Documents' },
        { keys: ['5-9'], description: 'Additional tabs' }
      ]
    });
  }

  return groups;
}

// ============================================
// HOOK: useKeyboardShortcuts
// ============================================

export function useKeyboardShortcuts() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === SHORTCUT_KEY && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}

// ============================================
// INNER COMPONENT
// ============================================

interface ShortcutsInnerProps {
  onClose: () => void;
}

function ShortcutsInner({ onClose }: ShortcutsInnerProps) {
  const overlayRef = useFadeIn<HTMLDivElement>();
  const panelRef = useScaleIn<HTMLDivElement>();
  const role = usePortalRole();
  const isMac = navigator.platform.toUpperCase().includes('MAC');

  const groups = React.useMemo(
    () => getShortcutGroups(role, isMac),
    [role, isMac]
  );

  // Close on Escape
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === KEYS.ESCAPE) {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="shortcuts-overlay"
      ref={overlayRef}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="shortcuts-panel"
        ref={panelRef}
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shortcuts-header">
          <Keyboard className="shortcuts-header-icon" aria-hidden="true" />
          <h2 className="shortcuts-title">Keyboard Shortcuts</h2>
        </div>

        <div className="shortcuts-divider" />

        {/* Shortcut groups */}
        <div className="shortcuts-body">
          {groups.map((group) => (
            <div key={group.title} className="shortcuts-group">
              <h3 className="shortcuts-group-title">{group.title}</h3>
              <div className="shortcuts-list">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.description} className="shortcuts-row">
                    <span className="shortcuts-description">{shortcut.description}</span>
                    <span className="shortcuts-keys">
                      {shortcut.keys.map((key) => (
                        <kbd key={key} className="shortcuts-kbd">{key}</kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shortcuts-footer">
          <span className="shortcuts-footer-hint">
            Press <kbd className="shortcuts-kbd">?</kbd> or <kbd className="shortcuts-kbd">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PUBLIC COMPONENT
// ============================================

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsOverlay = React.memo(({
  open,
  onClose
}: KeyboardShortcutsOverlayProps) => {
  if (!open) return null;
  return <ShortcutsInner onClose={onClose} />;
});
