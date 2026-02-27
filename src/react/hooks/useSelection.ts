import { useState, useCallback, useMemo } from 'react';

interface UseSelectionOptions<T> {
  /** Function to get unique ID from item */
  getId: (item: T) => string | number;
  /** All available items */
  items: T[];
}

interface UseSelectionReturn<T> {
  /** Set of selected item IDs */
  selectedIds: Set<string | number>;
  /** Array of selected items */
  selectedItems: T[];
  /** Number of selected items */
  selectedCount: number;
  /** Whether all items are selected */
  allSelected: boolean;
  /** Whether some (but not all) items are selected */
  someSelected: boolean;
  /** Check if specific item is selected */
  isSelected: (item: T) => boolean;
  /** Toggle selection of single item */
  toggleSelection: (item: T) => void;
  /** Select single item */
  select: (item: T) => void;
  /** Deselect single item */
  deselect: (item: T) => void;
  /** Select all items */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Toggle all selections (select all if not all selected, clear if all selected) */
  toggleSelectAll: () => void;
  /** Select multiple items */
  selectMany: (items: T[]) => void;
  /** Deselect multiple items */
  deselectMany: (items: T[]) => void;
}

/**
 * useSelection
 * Hook for managing selection state in tables/lists
 */
export function useSelection<T>({ getId, items }: UseSelectionOptions<T>): UseSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Get IDs of all current items
  const allIds = useMemo(() => new Set(items.map(getId)), [items, getId]);

  // Filter selected items to only include valid current items
  const validSelectedIds = useMemo(() => {
    const valid = new Set<string | number>();
    selectedIds.forEach((id) => {
      if (allIds.has(id)) {
        valid.add(id);
      }
    });
    return valid;
  }, [selectedIds, allIds]);

  // Get selected items
  const selectedItems = useMemo(
    () => items.filter((item) => validSelectedIds.has(getId(item))),
    [items, validSelectedIds, getId]
  );

  const selectedCount = validSelectedIds.size;
  const allSelected = selectedCount > 0 && selectedCount === items.length;
  const someSelected = selectedCount > 0 && selectedCount < items.length;

  const isSelected = useCallback(
    (item: T) => validSelectedIds.has(getId(item)),
    [validSelectedIds, getId]
  );

  const toggleSelection = useCallback(
    (item: T) => {
      const id = getId(item);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [getId]
  );

  const select = useCallback(
    (item: T) => {
      const id = getId(item);
      setSelectedIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [getId]
  );

  const deselect = useCallback(
    (item: T) => {
      const id = getId(item);
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [getId]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getId)));
  }, [items, getId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [allSelected, clearSelection, selectAll]);

  const selectMany = useCallback(
    (itemsToSelect: T[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        itemsToSelect.forEach((item) => next.add(getId(item)));
        return next;
      });
    },
    [getId]
  );

  const deselectMany = useCallback(
    (itemsToDeselect: T[]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        itemsToDeselect.forEach((item) => next.delete(getId(item)));
        return next;
      });
    },
    [getId]
  );

  return {
    selectedIds: validSelectedIds,
    selectedItems,
    selectedCount,
    allSelected,
    someSelected,
    isSelected,
    toggleSelection,
    select,
    deselect,
    selectAll,
    clearSelection,
    toggleSelectAll,
    selectMany,
    deselectMany
  };
}
