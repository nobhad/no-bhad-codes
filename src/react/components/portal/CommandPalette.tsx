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
import { Search, Folder, MessageSquare, Receipt, Users, X } from 'lucide-react';
import { SIDEBAR_ICONS } from '../../app/portal-icons';
import {
  useNavItems,
  usePortalRole,
  useSwitchTab
} from '../../stores/portal-store';
import { KEYS, isKeyCombo } from '../../../constants/keyboard';
import { TIMING } from '../../../constants/timing';
import { API_ENDPOINTS } from '../../../constants/api-endpoints';
import { useFadeIn, useScaleIn } from '../../hooks/useGsap';
import type { UnifiedNavItem } from '../../../../server/config/unified-navigation';

// ============================================
// CONSTANTS
// ============================================

const COMMAND_PALETTE_ID = 'command-palette';
const INPUT_PLACEHOLDER = 'Search pages and entities...';
const NO_RESULTS_TEXT = 'No results found.';
const MAX_VISIBLE_ITEMS = 20;
const ENTITY_SEARCH_MIN_LENGTH = 2;

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

interface EntityResult {
  type: 'project' | 'client' | 'message' | 'invoice';
  id: number;
  title: string;
  subtitle: string;
  path: string;
}

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  project: Folder,
  client: Users,
  message: MessageSquare,
  invoice: Receipt
};

// ============================================
// HELPERS
// ============================================

function buildCommandItems(navItems: UnifiedNavItem[]): CommandItem[] {
  return navItems.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    shortcut: item.shortcut,
    group: item.group,
    path: `/${item.dataTab || item.id}`
  }));
}

function filterItems(items: CommandItem[], query: string): CommandItem[] {
  const lower = query.trim().toLowerCase();
  const matched = lower
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(lower) ||
          item.id.toLowerCase().includes(lower)
      )
    : items;
  return matched.slice(0, MAX_VISIBLE_ITEMS);
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
  const [entityResults, setEntityResults] = React.useState<EntityResult[]>([]);
  const [entityLoading, setEntityLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null); // eslint-disable-line no-undef
  const overlayRef = useFadeIn<HTMLDivElement>();
  const panelRef = useScaleIn<HTMLDivElement>();
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Total items = page results + entity results
  const totalItems = filtered.length + entityResults.length;

  // Debounced entity search
  React.useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (query.trim().length < ENTITY_SEARCH_MIN_LENGTH) {
      setEntityResults([]);
      setEntityLoading(false);
      return;
    }

    const controller = new AbortController();

    setEntityLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_ENDPOINTS.SEARCH}?q=${encodeURIComponent(query.trim())}`,
          { credentials: 'include', signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          const results = data?.data?.results ?? data?.results ?? [];
          setEntityResults(results);
        } else {
          setEntityResults([]);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setEntityResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setEntityLoading(false);
        }
      }
    }, TIMING.SEARCH_DEBOUNCE);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      controller.abort();
    };
  }, [query]);

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
    if (selectedIndex >= totalItems) {
      setSelectedIndex(Math.max(0, totalItems - 1));
    }
  }, [totalItems, selectedIndex]);

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

  const handleEntitySelect = React.useCallback(
    (entity: EntityResult) => {
      navigate(entity.path);
      onClose();
    },
    [navigate, onClose]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
      case KEYS.ARROW_DOWN:
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < totalItems - 1 ? prev + 1 : 0
        );
        break;
      case KEYS.ARROW_UP:
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : totalItems - 1
        );
        break;
      case KEYS.ENTER:
        e.preventDefault();
        if (selectedIndex < filtered.length) {
          if (filtered[selectedIndex]) handleSelect(filtered[selectedIndex]);
        } else {
          const entityIndex = selectedIndex - filtered.length;
          if (entityResults[entityIndex]) handleEntitySelect(entityResults[entityIndex]);
        }
        break;
      case KEYS.ESCAPE:
        e.preventDefault();
        onClose();
        break;
      }
    },
    [filtered, entityResults, selectedIndex, totalItems, handleSelect, handleEntitySelect, onClose]
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
        {/* Close button */}
        <button
          className="command-palette-close"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <X />
        </button>

        {/* Search input — uses shared search-bar pattern */}
        <div className="command-palette-input-wrapper filter-search-dropdown">
          <Search className="search-bar-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="search-bar-input command-palette-input"
            placeholder={INPUT_PLACEHOLDER}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            aria-label="Search pages and entities"
            aria-controls="command-palette-list"
            aria-activedescendant={
              selectedIndex < filtered.length && filtered[selectedIndex]
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
          aria-label={`Search results for ${role} portal`}
        >
          {/* Page results */}
          {filtered.length > 0 && (
            <>
              {query.trim().length >= ENTITY_SEARCH_MIN_LENGTH && (
                <li className="command-palette-section-label" role="presentation">Pages</li>
              )}
              {filtered.map((item, index) => {
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
              })}
            </>
          )}

          {/* Entity results */}
          {entityResults.length > 0 && (
            <>
              <li className="command-palette-section-label" role="presentation">Results</li>
              {entityResults.map((entity, index) => {
                const globalIndex = filtered.length + index;
                const isSelected = globalIndex === selectedIndex;
                const EntityIcon = ENTITY_ICONS[entity.type] || Search;

                return (
                  <li
                    key={`entity-${entity.type}-${entity.id}`}
                    id={`command-item-entity-${entity.type}-${entity.id}`}
                    className={`command-palette-item${isSelected ? ' selected' : ''}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleEntitySelect(entity)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <EntityIcon className="command-palette-item-icon" aria-hidden="true" />
                    <span className="command-palette-item-label">{entity.title}</span>
                    <span className="command-palette-item-group">{entity.subtitle}</span>
                  </li>
                );
              })}
            </>
          )}

          {/* Loading state */}
          {entityLoading && filtered.length === 0 && (
            <li className="command-palette-empty" role="option" aria-selected={false}>
              Searching...
            </li>
          )}

          {/* No results */}
          {!entityLoading && totalItems === 0 && query.trim().length > 0 && (
            <li className="command-palette-empty" role="option" aria-selected={false}>
              {NO_RESULTS_TEXT}
            </li>
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
