import * as React from 'react';
import { useState, useCallback } from 'react';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@react/components/ui/alert-dialog';
import { cn } from '@react/lib/utils';

type DialogVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description/message */
  description: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Dialog variant for styling */
  variant?: DialogVariant;
  /** Whether confirm action is loading */
  loading?: boolean;
}

const variantConfig: Record<DialogVariant, {
  icon: React.ReactNode;
  buttonClass: string;
}> = {
  danger: {
    icon: <Trash2 className="icon-md" aria-hidden="true" />,
    buttonClass: 'btn-danger'
  },
  warning: {
    icon: <AlertTriangle className="icon-md" aria-hidden="true" />,
    buttonClass: 'btn-primary'
  },
  info: {
    icon: <Info className="icon-md" aria-hidden="true" />,
    buttonClass: 'btn-primary'
  }
};

/**
 * ConfirmDialog
 * Confirmation dialog for destructive or important actions
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  loading = false
}: ConfirmDialogProps) {
  const config = variantConfig[variant];

  const handleConfirm = useCallback(async () => {
    await onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="portal-modal">
        <AlertDialogHeader className="portal-modal-header">
          <AlertDialogTitle className="portal-modal-title">
            {config.icon}
            {title}
          </AlertDialogTitle>
          <button
            onClick={handleCancel}
            className="icon-btn portal-modal-close"
            aria-label="Close dialog"
            type="button"
          >
            <X className="icon-md" />
          </button>
        </AlertDialogHeader>
        <div className="confirm-dialog-content">
          <AlertDialogDescription className="confirm-dialog-description">
            {description}
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter className="confirm-dialog-footer">
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={loading}
            className="btn-secondary"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              config.buttonClass,
              loading && 'is-loading'
            )}
          >
            {loading ? 'Processing...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook for managing confirm dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const confirm = useCallback(async (action: () => Promise<void> | void) => {
    setIsLoading(true);
    try {
      await action();
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  }, []);

  return {
    isOpen,
    isLoading,
    open,
    close,
    setIsOpen,
    confirm
  };
}
