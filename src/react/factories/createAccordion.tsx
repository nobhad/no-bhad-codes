import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { KEYS } from '@/constants/keyboard';

// ============================================================================
// TYPES
// ============================================================================

export interface AccordionItemProps {
  /** Content rendered inside the trigger row (before the caret) */
  header: React.ReactNode;
  /** Content shown when expanded */
  children: React.ReactNode;
  /** Controlled expanded state */
  isExpanded: boolean;
  /** Called when the trigger is activated */
  onToggle: () => void;
  /** Extra class on the outer wrapper (border container) */
  wrapperClassName?: string;
  /** Extra class on the trigger row */
  triggerClassName?: string;
  /** Extra class on the expanded content area */
  contentClassName?: string;
  /** Accessible label for the trigger button */
  ariaLabel?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AccordionItem
 *
 * Reusable collapsible disclosure pattern.
 * Renders a bordered wrapper with a clickable trigger row and
 * a conditionally-rendered content area.
 *
 * The caller controls expand state externally — useful when multiple
 * accordion items share state (e.g. "expand all").
 *
 * @example
 * <AccordionItem
 *   header={<><GripVertical className="icon-md" /><span>Title</span></>}
 *   isExpanded={isExpanded}
 *   onToggle={() => setIsExpanded(!isExpanded)}
 *   wrapperClassName="milestone-item-wrapper"
 *   triggerClassName="milestone-item"
 *   contentClassName="tasks-expanded-content"
 * >
 *   <p>Expanded detail content here</p>
 * </AccordionItem>
 */
export function AccordionItem({
  header,
  children,
  isExpanded,
  onToggle,
  wrapperClassName,
  triggerClassName,
  contentClassName,
  ariaLabel
}: AccordionItemProps) {
  return (
    <div className={cn('accordion-item-wrapper', wrapperClassName)}>
      {/* Trigger row */}
      <div
        className={cn('accordion-item-trigger', triggerClassName)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={ariaLabel}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        {header}

        {/* Caret — always last, managed by AccordionItem */}
        {isExpanded ? (
          <ChevronDown className={cn('icon-md', 'accordion-item-caret', 'is-expanded')} />
        ) : (
          <ChevronRight className="icon-md accordion-item-caret" />
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className={cn('accordion-item-content', contentClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}
