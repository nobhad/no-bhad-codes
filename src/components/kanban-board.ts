/**
 * ===============================================
 * KANBAN BOARD COMPONENT
 * ===============================================
 * @file src/components/kanban-board.ts
 *
 * Reusable drag-and-drop Kanban board component.
 * Used for: Tasks, Lead Pipeline
 */

/* global DragEvent */

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  items: KanbanItem[];
}

export interface KanbanItem {
  id: string | number;
  title: string;
  subtitle?: string;
  badges?: KanbanBadge[];
  metadata?: Record<string, unknown>;
}

export interface KanbanBadge {
  text: string;
  color?: string;
  icon?: string;
}

export interface KanbanConfig {
  containerId: string;
  columns: KanbanColumn[];
  onItemMove?: (itemId: string | number, fromColumn: string, toColumn: string) => Promise<void>;
  onItemClick?: (item: KanbanItem) => void;
  renderItem?: (item: KanbanItem) => string;
  emptyColumnText?: string;
}

/**
 * Create and render a Kanban board
 */
export function createKanbanBoard(config: KanbanConfig): {
  refresh: (columns: KanbanColumn[]) => void;
  destroy: () => void;
} {
  const container = document.getElementById(config.containerId);
  if (!container) {
    console.error('[KanbanBoard] Container not found:', config.containerId);
    return {
      refresh: () => {},
      destroy: () => {}
    };
  }

  let currentColumns = config.columns;
  let draggedItem: HTMLElement | null = null;
  let draggedItemData: KanbanItem | null = null;
  let sourceColumnId: string | null = null;

  /**
   * Default item renderer
   */
  function defaultRenderItem(item: KanbanItem): string {
    const badges = item.badges?.map(b =>
      `<span class="kanban-badge" style="background-color: ${b.color || 'var(--color-neutral-600)'}">${b.text}</span>`
    ).join('') || '';

    return `
      <div class="kanban-card-title">${escapeHtml(item.title)}</div>
      ${item.subtitle ? `<div class="kanban-card-subtitle">${escapeHtml(item.subtitle)}</div>` : ''}
      ${badges ? `<div class="kanban-card-badges">${badges}</div>` : ''}
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Render the entire board
   */
  function render(): void {
    if (!container) return;
    container.innerHTML = '';
    container.className = 'kanban-board';

    currentColumns.forEach(column => {
      const columnEl = document.createElement('div');
      columnEl.className = 'kanban-column';
      columnEl.dataset.columnId = column.id;

      // Column header
      const header = document.createElement('div');
      header.className = 'kanban-column-header';
      header.innerHTML = `
        <span class="kanban-column-title">${escapeHtml(column.title)}</span>
        <span class="kanban-column-count">${column.items.length}</span>
      `;
      if (column.color) {
        header.style.borderTopColor = column.color;
      }
      columnEl.appendChild(header);

      // Column content (droppable area)
      const content = document.createElement('div');
      content.className = 'kanban-column-content';
      content.dataset.columnId = column.id;

      if (column.items.length === 0) {
        content.innerHTML = `<div class="kanban-empty">${config.emptyColumnText || 'No items'}</div>`;
      } else {
        column.items.forEach(item => {
          const card = document.createElement('div');
          card.className = 'kanban-card';
          card.dataset.itemId = String(item.id);
          card.draggable = true;
          card.innerHTML = config.renderItem ? config.renderItem(item) : defaultRenderItem(item);

          // Click handler
          if (config.onItemClick) {
            card.addEventListener('click', () => config.onItemClick!(item));
          }

          // Drag handlers
          card.addEventListener('dragstart', (e) => handleDragStart(e, item, column.id));
          card.addEventListener('dragend', handleDragEnd);

          content.appendChild(card);
        });
      }

      // Drop handlers on column content
      content.addEventListener('dragover', handleDragOver);
      content.addEventListener('dragenter', handleDragEnter);
      content.addEventListener('dragleave', handleDragLeave);
      content.addEventListener('drop', handleDrop);

      columnEl.appendChild(content);
      container.appendChild(columnEl);
    });
  }

  /**
   * Handle drag start
   */
  function handleDragStart(e: DragEvent, item: KanbanItem, columnId: string): void {
    draggedItem = e.target as HTMLElement;
    draggedItemData = item;
    sourceColumnId = columnId;

    if (draggedItem) {
      draggedItem.classList.add('dragging');
    }

    // Set drag data
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(item.id));
    }
  }

  /**
   * Handle drag end
   */
  function handleDragEnd(): void {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
    }
    draggedItem = null;
    draggedItemData = null;
    sourceColumnId = null;

    // Remove all drag-over states
    container?.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  }

  /**
   * Handle drag over
   */
  function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Handle drag enter
   */
  function handleDragEnter(e: DragEvent): void {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.classList.add('drag-over');
  }

  /**
   * Handle drag leave
   */
  function handleDragLeave(e: DragEvent): void {
    const target = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;

    // Only remove class if we're leaving the column content, not just moving to a card
    if (!target.contains(relatedTarget)) {
      target.classList.remove('drag-over');
    }
  }

  /**
   * Handle drop
   */
  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();

    const target = e.currentTarget as HTMLElement;
    target.classList.remove('drag-over');

    const targetColumnId = target.dataset.columnId;

    if (!targetColumnId || !sourceColumnId || !draggedItemData) return;

    // Don't do anything if dropped in same column
    if (targetColumnId === sourceColumnId) return;

    // Call the move handler
    if (config.onItemMove) {
      try {
        await config.onItemMove(draggedItemData.id, sourceColumnId, targetColumnId);

        // Update local state
        const sourceColumn = currentColumns.find(c => c.id === sourceColumnId);
        const targetColumn = currentColumns.find(c => c.id === targetColumnId);

        if (sourceColumn && targetColumn) {
          const itemIndex = sourceColumn.items.findIndex(i => i.id === draggedItemData!.id);
          if (itemIndex !== -1) {
            const [item] = sourceColumn.items.splice(itemIndex, 1);
            targetColumn.items.push(item);
            render();
          }
        }
      } catch (error) {
        console.error('[KanbanBoard] Failed to move item:', error);
        // Re-render to reset state
        render();
      }
    }
  }

  /**
   * Refresh board with new data
   */
  function refresh(columns: KanbanColumn[]): void {
    currentColumns = columns;
    render();
  }

  /**
   * Destroy the board
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
 * Get CSS for Kanban board
 */
export function getKanbanStyles(): string {
  return `
    .kanban-board {
      display: flex;
      gap: var(--portal-spacing-md);
      overflow-x: auto;
      padding: var(--portal-spacing-md) 0;
      min-height: 400px;
    }

    .kanban-column {
      flex: 0 0 280px;
      background: var(--portal-bg-dark);
      border-radius: var(--portal-radius-md);
      display: flex;
      flex-direction: column;
      max-height: 600px;
    }

    .kanban-column-header {
      padding: var(--portal-spacing-sm) var(--portal-spacing-md);
      border-top: 3px solid var(--app-color-primary);
      border-radius: var(--portal-radius-md) var(--portal-radius-md) 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--portal-bg-medium);
    }

    .kanban-column-title {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--portal-text-primary);
    }

    .kanban-column-count {
      background: var(--color-neutral-600);
      color: var(--color-white);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .kanban-column-content {
      flex: 1;
      overflow-y: auto;
      padding: var(--portal-spacing-sm);
      display: flex;
      flex-direction: column;
      gap: var(--portal-spacing-sm);
      min-height: 100px;
    }

    .kanban-column-content.drag-over {
      background: var(--portal-bg-medium);
    }

    .kanban-card {
      background: var(--portal-bg-light);
      border-radius: var(--portal-radius-sm);
      padding: var(--portal-spacing-sm) var(--portal-spacing-md);
      cursor: grab;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      border: 1px solid transparent;
    }

    .kanban-card:hover {
      border-color: var(--app-color-primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .kanban-card.dragging {
      opacity: 0.5;
      cursor: grabbing;
    }

    .kanban-card-title {
      font-weight: 500;
      font-size: 0.875rem;
      color: var(--portal-text-primary);
      margin-bottom: 4px;
    }

    .kanban-card-subtitle {
      font-size: 0.75rem;
      color: var(--portal-text-secondary);
      margin-bottom: 8px;
    }

    .kanban-card-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .kanban-badge {
      font-size: 0.625rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--color-white);
      text-transform: uppercase;
    }

    .kanban-empty {
      color: var(--portal-text-secondary);
      font-size: 0.875rem;
      text-align: center;
      padding: var(--portal-spacing-lg);
    }

    @media (max-width: 768px) {
      .kanban-board {
        flex-direction: column;
      }

      .kanban-column {
        flex: 0 0 auto;
        max-height: none;
      }
    }
  `;
}
