/**
 * ===============================================
 * COMMAND PALETTE
 * ===============================================
 * @file src/react/components/portal/CommandPalette.tsx
 *
 * Cmd+K command palette for quick navigation across
 * portal pages. Reads from unified-navigation config
 * and filters by the current user role.
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { SIDEBAR_ICONS } from '../../app/portal-icons';
import {
  useNavItems,
  usePortalRole,
  useSwitchTab
} from '../../stores/portal-store';
import { KEYS, isKeyCombo } from '../../../constants/keyboard';
import { useFadeIn, useScaleIn } from '../../hooks/useGsap';
import type { UnifiedNavItem } from '../../../../server/config/unified-navigation';

// ============================================
// CONSTANTS
// ============================================

const COMMAND_PALETTE_ID = 'command-palette';
const INPUT_PLACEHOLDER = 'Search pages...';
const NO_RESULTS_TEXT = 'No matching pages found.';
const MAX_VISIBLE_ITEMS = 20;

// ============================================
// TYPES
// ============================================

interface CommandItem {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  group?: string;
  path: string;
}

// ============================================
// HELPERS
// ============================================

function buildCommandItems(navItems: UnifiedNavItem[]): CommandItem[] {
  return navItems
    .map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      shortcut: item.shortcut,
      group: item.group,
      path: `/${item.dataTab || item.id}`
    }))
    .slice(0, MAX_VISIBLE_ITEMS);
}

function filterItems(items: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return items;
  const lower = query.toLowerCase();
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(lower) ||
      item.id.toLowerCase().includes(lower)
  );
}

// ============================================
// HOOK: useCommandPalette
// ============================================

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isKeyCombo(e, 'k', 'cmd')) {
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
// INNER COMPONENT (mounts only when open)
// ============================================

interface CommandPaletteInnerProps {
  onClose: () => void;
}

function CommandPaletteInner({ onClose }: CommandPaletteInnerProps) {
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null); // eslint-disable-line no-undef
  const overlayRef = useFadeIn<HTMLDivElement>();
  const panelRef = useScaleIn<HTMLDivElement>();

  const navItems = useNavItems();
  const role = usePortalRole();
  const switchTab = useSwitchTab();
  const navigate = useNavigate();

  const commandItems = React.useMemo(
    () => buildCommandItems(navItems),
    [navItems]
  );

  const filtered = React.useMemo(
    () => filterItems(commandItems, query),
    [commandItems, query]
  );

  // Focus input on mount
  React.useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Close on Escape (document-level for when input isn't focused)
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

  // Keep selection in bounds
  React.useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected item into view
  React.useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = React.useCallback(
    (item: CommandItem) => {
      switchTab(item.id);
      navigate(item.path);
      onClose();
    },
    [switchTab, navigate, onClose]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
      case KEYS.ARROW_DOWN:
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : 0
        );
        break;
      case KEYS.ARROW_UP:
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filtered.length - 1
        );
        break;
      case KEYS.ENTER:
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex]);
        }
        break;
      case KEYS.ESCAPE:
        e.preventDefault();
        onClose();
        break;
      }
    },
    [filtered, selectedIndex, handleSelect, onClose]
  );

  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const shortcutHint = isMac ? '\u2318K' : 'Ctrl+K';

  return (
    <div
      className="command-palette-overlay"
      ref={overlayRef}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="command-palette"
        id={COMMAND_PALETTE_ID}
        ref={panelRef}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="command-palette-input-wrapper">
          <Search className="command-palette-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder={INPUT_PLACEHOLDER}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            aria-label="Search pages"
            aria-controls="command-palette-list"
            aria-activedescendant={
              filtered[selectedIndex]
                ? `command-item-${filtered[selectedIndex].id}`
                : undefined
            }
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
          />
          <kbd className="command-palette-kbd">{shortcutHint}</kbd>
        </div>

        {/* Divider */}
        <div className="command-palette-divider" />

        {/* Results list */}
        <ul
          ref={listRef}
          id="command-palette-list"
          className="command-palette-list"
          role="listbox"
          aria-label={`Navigation for ${role} portal`}
        >
          {filtered.length === 0 ? (
            <li className="command-palette-empty" role="option" aria-selected={false}>
              {NO_RESULTS_TEXT}
            </li>
          ) : (
            filtered.map((item, index) => {
              const IconComponent = SIDEBAR_ICONS[item.icon];
              const isSelected = index === selectedIndex;

              return (
                <li
                  key={`${item.id}-${item.group || 'root'}`}
                  id={`command-item-${item.id}`}
                  className={`command-palette-item${isSelected ? ' selected' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {IconComponent && (
                    <IconComponent
                      className="command-palette-item-icon"
                      aria-hidden="true"
                    />
                  )}
                  <span className="command-palette-item-label">{item.label}</span>
                  {item.group && (
                    <span className="command-palette-item-group">{item.group}</span>
                  )}
                  {item.shortcut && (
                    <kbd className="command-palette-item-shortcut">{item.shortcut}</kbd>
                  )}
                </li>
              );
            })
          )}
        </ul>

        {/* Footer hint */}
        <div className="command-palette-footer">
          <span className="command-palette-hint">
            <kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate
          </span>
          <span className="command-palette-hint">
            <kbd>&crarr;</kbd> select
          </span>
          <span className="command-palette-hint">
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PUBLIC COMPONENT
// ============================================

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette = React.memo(({
  open,
  onClose
}: CommandPaletteProps) => {
  if (!open) return null;
  return <CommandPaletteInner onClose={onClose} />;
});
