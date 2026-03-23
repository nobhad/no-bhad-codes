/**
 * ===============================================
 * USE DELETE CONFIRM HOOK
 * ===============================================
 * @file src/react/hooks/useDeleteConfirm.ts
 *
 * Encapsulates the common pattern of tracking a pending delete
 * target, opening a ConfirmDialog, executing the async delete,
 * and resetting state. Eliminates boilerplate across tables.
 */

import { useState, useCallback, useMemo } from 'react';
import { useConfirmDialog } from '@react/components/portal/ConfirmDialog';

// ============================================
// TYPES
// ============================================

interface UseDeleteConfirmOptions<T> {
  /** Async function to execute the delete. Return false to indicate failure. */
  onDelete: (item: T) => Promise<boolean | void>;
  /** Entity label for the dialog title (e.g., "invoice", "file") */
  entityLabel?: string;
  /** Extract a human-readable description for the dialog body */
  getDescription?: (item: T) => string;
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => Promise<void>;
  variant: 'danger';
  loading: boolean;
}

interface UseDeleteConfirmReturn<T> {
  /** The item currently targeted for deletion, or null */
  target: T | null;
  /** Call this to set the target and open the dialog */
  openConfirm: (item: T) => void;
  /** Props object that spreads directly onto ConfirmDialog */
  dialogProps: DeleteConfirmDialogProps;
}

// ============================================
// HOOK
// ============================================

const DEFAULT_ENTITY_LABEL = 'item';

export function useDeleteConfirm<T>(
  options: UseDeleteConfirmOptions<T>
): UseDeleteConfirmReturn<T> {
  const { onDelete, entityLabel = DEFAULT_ENTITY_LABEL, getDescription } = options;
  const [target, setTarget] = useState<T | null>(null);
  const dialog = useConfirmDialog();

  const openConfirm = useCallback(
    (item: T) => {
      setTarget(item);
      dialog.open();
    },
    [dialog]
  );

  const handleConfirm = useCallback(async () => {
    if (!target) return;
    await onDelete(target);
    setTarget(null);
  }, [target, onDelete]);

  const capitalizedLabel = entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1);

  const description = useMemo(() => {
    const base = `Are you sure you want to delete this ${entityLabel}?`;
    const detail = target && getDescription ? ` (${getDescription(target)})` : '';
    return `${base}${detail} This action cannot be undone.`;
  }, [entityLabel, target, getDescription]);

  const dialogProps: DeleteConfirmDialogProps = useMemo(
    () => ({
      open: dialog.isOpen,
      onOpenChange: dialog.setIsOpen,
      title: `Delete ${capitalizedLabel}`,
      description,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: handleConfirm,
      variant: 'danger' as const,
      loading: dialog.isLoading
    }),
    [dialog.isOpen, dialog.setIsOpen, dialog.isLoading, capitalizedLabel, description, handleConfirm]
  );

  return { target, openConfirm, dialogProps };
}
