/**
 * ===============================================
 * SEARCH BAR COMPONENT
 * ===============================================
 * @file src/components/search-bar.ts
 *
 * Reusable inline search bar: icon + input + optional clear.
 * Use shared class .search-bar so shared CSS applies (padding so text doesn't overlap icon).
 */

import { ICONS } from '../constants/icons';

export interface SearchBarConfig {
  placeholder?: string;
  value?: string;
  ariaLabel?: string;
  id?: string;
  onInput?: (value: string) => void;
  onClear?: () => void;
  showClear?: boolean;
}

function escapeAttr(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/**
 * Creates a reusable search bar DOM (wrapper + icon + input + optional clear).
 * Apply shared styles via class .search-bar (see src/styles/shared/search-bar.css).
 */
export function createSearchBar(config: SearchBarConfig): { wrapper: HTMLElement; input: HTMLInputElement } {
  const {
    placeholder = 'Search...',
    value = '',
    ariaLabel = 'Search',
    id,
    onInput,
    onClear,
    showClear = true
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = 'search-bar';

  wrapper.innerHTML = `
    <span class="search-bar-icon" aria-hidden="true">${ICONS.SEARCH_SMALL}</span>
    <input type="text" class="search-bar-input" placeholder="${escapeAttr(placeholder)}" value="${escapeAttr(value)}" ${id ? `id="${escapeAttr(id)}"` : ''} aria-label="${escapeAttr(ariaLabel)}" />
    ${showClear ? `<button type="button" class="search-bar-clear" title="Clear search" aria-label="Clear search">${ICONS.X_SMALL}</button>` : ''}
  `;

  const input = wrapper.querySelector('input') as HTMLInputElement;
  const clearBtn = wrapper.querySelector('.search-bar-clear') as HTMLButtonElement | null;

  if (onInput) {
    input.addEventListener('input', () => onInput(input.value));
  }

  if (clearBtn && (onClear || onInput)) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      onClear?.();
      onInput?.('');
      input.focus();
    });
  }

  return { wrapper, input };
}
