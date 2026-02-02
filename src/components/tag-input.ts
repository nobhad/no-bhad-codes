/**
 * ===============================================
 * TAG INPUT COMPONENT
 * ===============================================
 * @file src/components/tag-input.ts
 *
 * Reusable tag input component with autocomplete.
 * Used for: Clients, Files, Projects
 */

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface TagInputConfig {
  containerId: string;
  availableTags: Tag[];
  selectedTags: Tag[];
  onTagAdd?: (tag: Tag) => Promise<void>;
  onTagRemove?: (tag: Tag) => Promise<void>;
  onTagCreate?: (name: string) => Promise<Tag | null>;
  placeholder?: string;
  allowCreate?: boolean;
  maxTags?: number;
}

/**
 * Create a tag input component
 */
export function createTagInput(config: TagInputConfig): {
  refresh: (availableTags: Tag[], selectedTags: Tag[]) => void;
  destroy: () => void;
} {
  const container = document.getElementById(config.containerId);
  if (!container) {
    console.error('[TagInput] Container not found:', config.containerId);
    return {
      refresh: () => {},
      destroy: () => {}
    };
  }

  let availableTags = config.availableTags;
  let selectedTags = config.selectedTags;
  let inputEl: HTMLInputElement | null = null;
  let dropdownEl: HTMLElement | null = null;
  let isDropdownOpen = false;

  /**
   * Escape HTML
   */
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get contrasting text color for background
   */
  function getContrastColor(hexColor: string): string {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  /**
   * Render selected tags
   */
  function renderSelectedTags(): string {
    return selectedTags.map(tag => `
      <span class="tag-pill" style="background-color: ${tag.color}; color: ${getContrastColor(tag.color)}">
        ${escapeHtml(tag.name)}
        <button type="button" class="tag-remove" data-tag-id="${tag.id}" aria-label="Remove ${tag.name}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </span>
    `).join('');
  }

  /**
   * Filter available tags based on input
   */
  function getFilteredTags(query: string): Tag[] {
    const lowerQuery = query.toLowerCase();
    const selectedIds = new Set(selectedTags.map(t => t.id));

    return availableTags.filter(tag =>
      !selectedIds.has(tag.id) &&
      tag.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Render dropdown
   */
  function renderDropdown(filteredTags: Tag[], query: string): void {
    if (!dropdownEl) return;

    if (filteredTags.length === 0 && !config.allowCreate) {
      dropdownEl.innerHTML = '<div class="tag-dropdown-empty">No matching tags</div>';
    } else {
      let html = filteredTags.map(tag => `
        <button type="button" class="tag-dropdown-item" data-tag-id="${tag.id}">
          <span class="tag-dropdown-color" style="background-color: ${tag.color}"></span>
          ${escapeHtml(tag.name)}
        </button>
      `).join('');

      // Add create option if allowed and query doesn't match existing tag
      if (config.allowCreate && query.length > 0) {
        const exactMatch = availableTags.some(t => t.name.toLowerCase() === query.toLowerCase());
        if (!exactMatch) {
          html += `
            <button type="button" class="tag-dropdown-item tag-create-item" data-create="${escapeHtml(query)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create "${escapeHtml(query)}"
            </button>
          `;
        }
      }

      dropdownEl.innerHTML = html;
    }

    dropdownEl.classList.toggle('hidden', !isDropdownOpen);
  }

  /**
   * Handle tag removal
   */
  async function handleTagRemove(tagId: number): Promise<void> {
    const tag = selectedTags.find(t => t.id === tagId);
    if (!tag) return;

    if (config.onTagRemove) {
      try {
        await config.onTagRemove(tag);
        selectedTags = selectedTags.filter(t => t.id !== tagId);
        render();
      } catch (error) {
        console.error('[TagInput] Failed to remove tag:', error);
      }
    } else {
      selectedTags = selectedTags.filter(t => t.id !== tagId);
      render();
    }
  }

  /**
   * Handle tag add
   */
  async function handleTagAdd(tagId: number): Promise<void> {
    const tag = availableTags.find(t => t.id === tagId);
    if (!tag) return;

    // Check max tags
    if (config.maxTags && selectedTags.length >= config.maxTags) {
      return;
    }

    if (config.onTagAdd) {
      try {
        await config.onTagAdd(tag);
        selectedTags = [...selectedTags, tag];
        render();
      } catch (error) {
        console.error('[TagInput] Failed to add tag:', error);
      }
    } else {
      selectedTags = [...selectedTags, tag];
      render();
    }

    if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
    isDropdownOpen = false;
    if (dropdownEl) dropdownEl.classList.add('hidden');
  }

  /**
   * Handle tag creation
   */
  async function handleTagCreate(name: string): Promise<void> {
    if (!config.onTagCreate) return;

    try {
      const newTag = await config.onTagCreate(name);
      if (newTag) {
        availableTags = [...availableTags, newTag];
        selectedTags = [...selectedTags, newTag];
        render();
      }
    } catch (error) {
      console.error('[TagInput] Failed to create tag:', error);
    }

    if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
    isDropdownOpen = false;
    if (dropdownEl) dropdownEl.classList.add('hidden');
  }

  /**
   * Render the component
   */
  function render(): void {
    if (!container) return;
    container.className = 'tag-input-container';
    container.innerHTML = `
      <div class="tag-input-wrapper">
        <div class="tag-input-tags">
          ${renderSelectedTags()}
        </div>
        <input
          type="text"
          class="tag-input-field"
          placeholder="${config.placeholder || 'Add tags...'}"
          aria-label="Add tags"
        />
      </div>
      <div class="tag-dropdown hidden"></div>
    `;

    inputEl = container.querySelector('.tag-input-field');
    dropdownEl = container.querySelector('.tag-dropdown');

    // Add event listeners
    if (inputEl) {
      inputEl.addEventListener('input', handleInput);
      inputEl.addEventListener('focus', () => {
        isDropdownOpen = true;
        const filtered = getFilteredTags(inputEl!.value);
        renderDropdown(filtered, inputEl!.value);
      });
      inputEl.addEventListener('blur', () => {
        // Delay to allow click on dropdown item
        setTimeout(() => {
          isDropdownOpen = false;
          if (dropdownEl) dropdownEl.classList.add('hidden');
        }, 200);
      });
      inputEl.addEventListener('keydown', handleKeydown);
    }

    // Tag remove buttons
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tagId = parseInt((btn as HTMLElement).dataset.tagId || '0');
        if (tagId) handleTagRemove(tagId);
      });
    });

    // Dropdown item clicks are handled via event delegation
    if (dropdownEl) {
      dropdownEl.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest('.tag-dropdown-item') as HTMLElement;
        if (!target) return;

        if (target.dataset.create) {
          handleTagCreate(target.dataset.create);
        } else if (target.dataset.tagId) {
          handleTagAdd(parseInt(target.dataset.tagId));
        }
      });
    }
  }

  /**
   * Handle input
   */
  function handleInput(): void {
    if (!inputEl || !dropdownEl) return;
    const query = inputEl.value;
    const filtered = getFilteredTags(query);
    isDropdownOpen = true;
    renderDropdown(filtered, query);
  }

  /**
   * Handle keyboard navigation
   */
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      isDropdownOpen = false;
      if (dropdownEl) dropdownEl.classList.add('hidden');
    }
  }

  /**
   * Refresh the component
   */
  function refresh(newAvailableTags: Tag[], newSelectedTags: Tag[]): void {
    availableTags = newAvailableTags;
    selectedTags = newSelectedTags;
    render();
  }

  /**
   * Destroy the component
   */
  function destroy(): void {
    if (!container) return;
    container.innerHTML = '';
    container.className = '';
  }

  // Initial render
  render();

  return { refresh, destroy };
}

/**
 * Get CSS for tag input
 */
export function getTagInputStyles(): string {
  return `
    .tag-input-container {
      position: relative;
    }

    .tag-input-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px;
      background: var(--portal-bg-dark);
      border: 1px solid var(--portal-border);
      border-radius: var(--portal-radius-sm);
      min-height: 42px;
      align-items: center;
    }

    .tag-input-wrapper:focus-within {
      border-color: var(--app-color-primary);
    }

    .tag-input-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tag-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .tag-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      opacity: 0.7;
      transition: opacity 0.15s;
    }

    .tag-remove:hover {
      opacity: 1;
    }

    .tag-input-field {
      flex: 1;
      min-width: 100px;
      background: transparent;
      border: none;
      outline: none;
      color: var(--portal-text-primary);
      font-size: 0.875rem;
    }

    .tag-input-field::placeholder {
      color: var(--portal-text-secondary);
    }

    .tag-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: var(--portal-bg-medium);
      border: 1px solid var(--portal-border);
      border-radius: var(--portal-radius-sm);
      max-height: 200px;
      overflow-y: auto;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .tag-dropdown.hidden {
      display: none;
    }

    .tag-dropdown-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      background: transparent;
      border: none;
      text-align: left;
      cursor: pointer;
      color: var(--portal-text-primary);
      font-size: 0.875rem;
      transition: background-color 0.15s;
    }

    .tag-dropdown-item:hover {
      background: var(--portal-bg-light);
    }

    .tag-dropdown-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .tag-create-item {
      border-top: 1px solid var(--portal-border);
      color: var(--app-color-primary);
    }

    .tag-dropdown-empty {
      padding: 12px;
      text-align: center;
      color: var(--portal-text-secondary);
      font-size: 0.875rem;
    }
  `;
}
