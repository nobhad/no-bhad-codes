import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useScaleIn } from '@react/hooks/useGsap';

/**
 * Modal size variants - portal design system
 */
const modalSizes = {
  sm: 'portal-modal--sm',
  md: '',
  lg: 'portal-modal--wide',
  xl: 'portal-modal--xl',
  full: 'portal-modal--full'
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
  /** Icon displayed next to the title */
  icon?: React.ReactNode;
  /** When provided, wraps body + footer in a <form> */
  onSubmit?: (e: React.FormEvent) => void;
}

/**
 * PortalModal
 * Shared modal component for the portal design system.
 * Uses GSAP for entrance animation via useScaleIn hook.
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
  icon,
  onSubmit
}: PortalModalProps) {
  const contentRef = useScaleIn<HTMLDivElement>();

  const bodyAndFooter = (
    <>
      <div className="portal-modal-body">{children}</div>
      {footer && <div className="portal-modal-footer">{footer}</div>}
    </>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="portal-modal-overlay" />
        <DialogPrimitive.Content
          ref={contentRef}
          className={cn('portal-modal', modalSizes[size], className)}
        >
          {/* Header */}
          <div className="portal-modal-header">
            <div className="portal-modal-title">
              {icon && <span className="heading-icon">{icon}</span>}
              <DialogPrimitive.Title asChild>
                <h2>{title}</h2>
              </DialogPrimitive.Title>
            </div>
            {description && (
              <DialogPrimitive.Description className="portal-modal-description">
                {description}
              </DialogPrimitive.Description>
            )}
            {showCloseButton && (
              <DialogPrimitive.Close className="portal-modal-close" aria-label="Close modal">
                <X />
              </DialogPrimitive.Close>
            )}
          </div>

          {/* Body + Footer — optionally wrapped in <form> */}
          {onSubmit ? (
            <form onSubmit={onSubmit}>{bodyAndFooter}</form>
          ) : (
            bodyAndFooter
          )}
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
    toggle
  };
}

export { DialogPrimitive };
