/**
 * ===============================================
 * COMMAND PALETTE (Linear-style ⌘K)
 * ===============================================
 * @file src/components/command-palette.ts
 *
 * A Linear-inspired command palette for quick navigation and actions.
 * Opens with ⌘K (Cmd+K on Mac, Ctrl+K on Windows/Linux).
 *
 * Features:
 * - Fuzzy search across all items
 * - Keyboard navigation (↑↓ arrows, Enter to select, Escape to close)
 * - Sections: Recent, Actions, Navigation
 * - Keyboard shortcut hints
 * - Focus trapping for accessibility
 */

import { ICONS } from '../constants/icons';

// ============================================================================
// TYPES
// ============================================================================

export type CommandSection = 'recent' | 'actions' | 'navigation' | 'search';

export interface CommandItem {
  id: string;
  label: string;
  /** Optional keyboard shortcut hint (e.g., "⌘N") */
  shortcut?: string;
  /** Icon HTML string */
  icon?: string;
  /** Section to display in */
  section: CommandSection;
  /** Keywords for search matching */
  keywords?: string[];
  /** Action to perform when selected */
  action: () => void;
}

export interface CommandPaletteConfig {
  /** Items to display in the palette */
  items: CommandItem[];
  /** Placeholder text for search input */
  placeholder?: string;
  /** Called when palette is closed */
  onClose?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECTION_LABELS: Record<CommandSection, string> = {
  recent: 'Recent',
  actions: 'Actions',
  navigation: 'Navigation',
  search: 'Search Results'
};

const SECTION_ORDER: CommandSection[] = ['recent', 'actions', 'navigation', 'search'];

// ============================================================================
// STATE
// ============================================================================

let paletteInstance: HTMLElement | null = null;
let currentItems: CommandItem[] = [];
let filteredItems: CommandItem[] = [];
let selectedIndex = 0;
let isOpen = false;

// ============================================================================
// FUZZY SEARCH
// ============================================================================

function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Simple substring match for now
  if (lowerText.includes(lowerQuery)) return true;

  // Check keywords
  return false;
}

function filterItems(items: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) {
    // Show all items except search results when no query
    return items.filter(item => item.section !== 'search');
  }

  return items.filter(item => {
    if (fuzzyMatch(item.label, query)) return true;
    if (item.keywords?.some(kw => fuzzyMatch(kw, query))) return true;
    return false;
  });
}

// ============================================================================
// RENDERING
// ============================================================================

function renderItems(items: CommandItem[]): string {
  if (items.length === 0) {
    return `
      <div class="command-palette-empty">
        <span>No results found</span>
      </div>
    `;
  }

  // Group by section
  const grouped = new Map<CommandSection, CommandItem[]>();
  for (const item of items) {
    const section = item.section;
    if (!grouped.has(section)) {
      grouped.set(section, []);
    }
    grouped.get(section)!.push(item);
  }

  // Render sections in order
  let html = '';
  let globalIndex = 0;

  for (const section of SECTION_ORDER) {
    const sectionItems = grouped.get(section);
    if (!sectionItems || sectionItems.length === 0) continue;

    html += `
      <div class="command-palette-section">
        <div class="command-palette-section-label">${SECTION_LABELS[section]}</div>
        <div class="command-palette-section-items">
    `;

    for (const item of sectionItems) {
      const isSelected = globalIndex === selectedIndex;
      html += `
        <button
          type="button"
          class="command-palette-item ${isSelected ? 'selected' : ''}"
          data-index="${globalIndex}"
          data-id="${item.id}"
        >
          <span class="command-palette-item-icon">${item.icon || ''}</span>
          <span class="command-palette-item-label">${item.label}</span>
          ${item.shortcut ? `<span class="command-palette-item-shortcut">${item.shortcut}</span>` : ''}
        </button>
      `;
      globalIndex++;
    }

    html += `
        </div>
      </div>
    `;
  }

  return html;
}

function updateResults(query: string): void {
  filteredItems = filterItems(currentItems, query);
  selectedIndex = 0;

  const resultsContainer = paletteInstance?.querySelector('.command-palette-results');
  if (resultsContainer) {
    resultsContainer.innerHTML = renderItems(filteredItems);
    attachItemListeners();
  }
}

function updateSelection(newIndex: number): void {
  if (filteredItems.length === 0) return;

  // Wrap around
  if (newIndex < 0) newIndex = filteredItems.length - 1;
  if (newIndex >= filteredItems.length) newIndex = 0;

  selectedIndex = newIndex;

  // Update visual selection
  const items = paletteInstance?.querySelectorAll('.command-palette-item');
  items?.forEach((item, idx) => {
    item.classList.toggle('selected', idx === selectedIndex);
  });

  // Scroll selected item into view
  const selectedItem = paletteInstance?.querySelector('.command-palette-item.selected');
  selectedItem?.scrollIntoView({ block: 'nearest' });
}

function executeSelected(): void {
  if (filteredItems.length === 0) return;

  const item = filteredItems[selectedIndex];
  if (item) {
    close();
    item.action();
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleKeyDown(e: KeyboardEvent): void {
  switch (e.key) {
  case 'ArrowDown':
    e.preventDefault();
    updateSelection(selectedIndex + 1);
    break;
  case 'ArrowUp':
    e.preventDefault();
    updateSelection(selectedIndex - 1);
    break;
  case 'Enter':
    e.preventDefault();
    executeSelected();
    break;
  case 'Escape':
    e.preventDefault();
    close();
    break;
  case 'Tab':
    // Trap focus within palette
    e.preventDefault();
    break;
  }
}

function handleInput(e: Event): void {
  const input = e.target as HTMLInputElement;
  updateResults(input.value);
}

function handleBackdropClick(e: MouseEvent): void {
  if ((e.target as HTMLElement).classList.contains('command-palette-overlay')) {
    close();
  }
}

function attachItemListeners(): void {
  const items = paletteInstance?.querySelectorAll('.command-palette-item');
  items?.forEach((item) => {
    item.addEventListener('click', () => {
      const index = parseInt(item.getAttribute('data-index') || '0', 10);
      selectedIndex = index;
      executeSelected();
    });

    item.addEventListener('mouseenter', () => {
      const index = parseInt(item.getAttribute('data-index') || '0', 10);
      updateSelection(index);
    });
  });
}

// ============================================================================
// GLOBAL KEYBOARD SHORTCUT
// ============================================================================

function handleGlobalKeyDown(e: KeyboardEvent): void {
  // ⌘K or Ctrl+K to open
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (isOpen) {
      close();
    } else {
      open();
    }
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize the command palette with items
 */
export function initCommandPalette(config: CommandPaletteConfig): void {
  currentItems = config.items;

  // Create palette element if not exists
  if (!paletteInstance) {
    paletteInstance = document.createElement('div');
    paletteInstance.className = 'command-palette-overlay hidden';
    paletteInstance.innerHTML = `
      <div class="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="command-palette-header">
          <span class="command-palette-icon">${ICONS.SEARCH}</span>
          <input
            type="text"
            class="command-palette-input"
            placeholder="${config.placeholder || 'Search or jump to...'}"
            autocomplete="off"
            spellcheck="false"
          />
          <kbd class="command-palette-kbd">ESC</kbd>
        </div>
        <div class="command-palette-results">
          ${renderItems(filterItems(currentItems, ''))}
        </div>
      </div>
    `;

    document.body.appendChild(paletteInstance);

    // Attach event listeners
    const input = paletteInstance.querySelector('.command-palette-input') as HTMLInputElement | null;
    input?.addEventListener('input', handleInput);
    input?.addEventListener('keydown', handleKeyDown as EventListener);

    paletteInstance.addEventListener('click', handleBackdropClick);
    attachItemListeners();
  }

  // Register global shortcut
  document.addEventListener('keydown', handleGlobalKeyDown);
}

/**
 * Open the command palette
 */
export function open(): void {
  if (!paletteInstance || isOpen) return;

  isOpen = true;
  paletteInstance.classList.remove('hidden');

  // Reset state
  selectedIndex = 0;
  filteredItems = filterItems(currentItems, '');

  // Clear and focus input
  const input = paletteInstance.querySelector('.command-palette-input') as HTMLInputElement;
  if (input) {
    input.value = '';
    input.focus();
  }

  // Update results
  const resultsContainer = paletteInstance.querySelector('.command-palette-results');
  if (resultsContainer) {
    resultsContainer.innerHTML = renderItems(filteredItems);
    attachItemListeners();
  }

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

/**
 * Close the command palette
 */
export function close(): void {
  if (!paletteInstance || !isOpen) return;

  isOpen = false;
  paletteInstance.classList.add('hidden');

  // Restore body scroll
  document.body.style.overflow = '';
}

/**
 * Update the items in the palette (e.g., to add recent items)
 */
export function updateItems(items: CommandItem[]): void {
  currentItems = items;
  if (isOpen) {
    const input = paletteInstance?.querySelector('.command-palette-input') as HTMLInputElement;
    updateResults(input?.value || '');
  }
}

/**
 * Add a recent item to the palette
 */
export function addRecentItem(item: Omit<CommandItem, 'section'>): void {
  // Remove existing item with same id
  currentItems = currentItems.filter(i => i.id !== item.id || i.section !== 'recent');

  // Add to front of recent
  currentItems.unshift({
    ...item,
    section: 'recent'
  });

  // Keep only last 5 recent items
  const recentItems = currentItems.filter(i => i.section === 'recent');
  if (recentItems.length > 5) {
    const toRemove = recentItems.slice(5);
    currentItems = currentItems.filter(i => !toRemove.includes(i));
  }
}

/**
 * Check if palette is currently open
 */
export function isPaletteOpen(): boolean {
  return isOpen;
}

/**
 * Destroy the command palette and remove event listeners
 */
export function destroyCommandPalette(): void {
  document.removeEventListener('keydown', handleGlobalKeyDown);

  if (paletteInstance) {
    paletteInstance.remove();
    paletteInstance = null;
  }

  isOpen = false;
  currentItems = [];
  filteredItems = [];
}
