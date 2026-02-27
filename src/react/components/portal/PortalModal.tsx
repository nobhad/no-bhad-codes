import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useScaleIn } from '@react/hooks/useGsap';

/**
 * Modal size variants - brutalist design
 */
const modalSizes = {
  sm: 'tw-max-w-sm',
  md: 'tw-max-w-lg',
  lg: 'tw-max-w-2xl',
  xl: 'tw-max-w-4xl',
  full: 'tw-max-w-full tw-m-4',
} as const;

type ModalSize = keyof typeof modalSizes;

interface PortalModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Modal size */
  size?: ModalSize;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Footer content (usually action buttons) */
  footer?: React.ReactNode;
  /** Additional class names for the content */
  className?: string;
}

/**
 * PortalModal
 * Modal component matching the portal design system
 * Uses GSAP for entrance animation via useScaleIn hook
 */
export function PortalModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  footer,
  className,
}: PortalModalProps) {
  const contentRef = useScaleIn<HTMLDivElement>();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="tw-modal-overlay" />

        {/* Content */}
        <DialogPrimitive.Content
          ref={contentRef}
          className={cn('tw-modal tw-fixed tw-top-1/2 tw-left-1/2 tw--translate-x-1/2 tw--translate-y-1/2 tw-z-50', modalSizes[size], className)}
        >
          {/* Header */}
          <div className="tw-modal-header">
            <div className="tw-flex-1">
              <DialogPrimitive.Title className="tw-modal-title">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="tw-text-sm tw-text-muted tw-mt-1">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>

            {showCloseButton && (
              <DialogPrimitive.Close className="tw-btn-close">
                <X className="tw-h-4 tw-w-4" />
                <span className="tw-sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </div>

          {/* Body */}
          <div className="tw-py-4 tw-scroll-container tw-max-h-[60vh]">{children}</div>

          {/* Footer */}
          {footer && <div className="tw-flex tw-justify-end tw-gap-2 tw-pt-4 tw-border-t tw-border-white/20">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * useModal hook for managing modal state
 */
export function useModal(initialOpen = false) {
  const [isOpen, setIsOpen] = React.useState(initialOpen);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);
  const toggle = React.useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    setIsOpen,
    open,
    close,
    toggle,
  };
}

export { DialogPrimitive };
