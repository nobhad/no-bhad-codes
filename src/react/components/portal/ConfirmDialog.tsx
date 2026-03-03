import * as React from 'react';
import { useState, useCallback } from 'react';
import { AlertTriangle, Trash2, Info } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  iconClass: string;
  buttonClass: string;
}> = {
  danger: {
    icon: <Trash2 className="tw-h-5 tw-w-5" />,
    iconClass: 'tw-p-2 tw-border tw-border-primary',
    buttonClass: 'btn-danger'
  },
  warning: {
    icon: <AlertTriangle className="tw-h-5 tw-w-5" />,
    iconClass: 'tw-p-2 tw-border tw-border-primary',
    buttonClass: 'btn-primary'
  },
  info: {
    icon: <Info className="tw-h-5 tw-w-5" />,
    iconClass: 'tw-p-2 tw-border tw-border-primary',
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
      <AlertDialogContent className="tw-modal">
        <AlertDialogHeader className="tw-modal-header">
          <div className="tw-flex tw-items-start tw-gap-4">
            <div className={config.iconClass}>
              {config.icon}
            </div>
            <div className="tw-flex-1">
              <AlertDialogTitle className="tw-modal-title">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="tw-text-sm tw-text-muted tw-mt-1">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="tw-flex tw-justify-end tw-gap-2 tw-pt-4 tw-border-t tw-border-primary/20">
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
              loading && 'tw-opacity-50'
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
