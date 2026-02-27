import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { ChevronRight, Check } from 'lucide-react';
import { cn } from '@react/lib/utils';

/**
 * Portal Dropdown Menu
 * Styled to match the portal design system
 */

const PortalDropdown = DropdownMenuPrimitive.Root;
const PortalDropdownTrigger = DropdownMenuPrimitive.Trigger;
const PortalDropdownGroup = DropdownMenuPrimitive.Group;
const PortalDropdownPortal = DropdownMenuPrimitive.Portal;
const PortalDropdownSub = DropdownMenuPrimitive.Sub;
const PortalDropdownRadioGroup = DropdownMenuPrimitive.RadioGroup;

const PortalDropdownSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'portal-dropdown-sub-trigger',
      inset && 'inset',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="chevron-icon" />
  </DropdownMenuPrimitive.SubTrigger>
));
PortalDropdownSubTrigger.displayName = 'PortalDropdownSubTrigger';

const PortalDropdownSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn('portal-dropdown-sub-content', className)}
    {...props}
  />
));
PortalDropdownSubContent.displayName = 'PortalDropdownSubContent';

const PortalDropdownContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn('portal-dropdown-content', className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
PortalDropdownContent.displayName = 'PortalDropdownContent';

const PortalDropdownItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    destructive?: boolean;
  }
>(({ className, inset, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'portal-dropdown-item',
      destructive && 'destructive',
      inset && 'inset',
      className
    )}
    {...props}
  />
));
PortalDropdownItem.displayName = 'PortalDropdownItem';

const PortalDropdownCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn('portal-dropdown-checkbox-item', className)}
    checked={checked}
    {...props}
  >
    <span className="indicator-wrapper">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="check-icon" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
PortalDropdownCheckboxItem.displayName = 'PortalDropdownCheckboxItem';

const PortalDropdownRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn('portal-dropdown-radio-item', className)}
    {...props}
  >
    <span className="indicator-wrapper">
      <DropdownMenuPrimitive.ItemIndicator>
        <span className="radio-dot" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
PortalDropdownRadioItem.displayName = 'PortalDropdownRadioItem';

const PortalDropdownLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'portal-dropdown-label',
      inset && 'inset',
      className
    )}
    {...props}
  />
));
PortalDropdownLabel.displayName = 'PortalDropdownLabel';

const PortalDropdownSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('portal-dropdown-separator', className)}
    {...props}
  />
));
PortalDropdownSeparator.displayName = 'PortalDropdownSeparator';

const PortalDropdownShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn('portal-dropdown-shortcut', className)}
      {...props}
    />
  );
};
PortalDropdownShortcut.displayName = 'PortalDropdownShortcut';

export {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
  PortalDropdownCheckboxItem,
  PortalDropdownRadioItem,
  PortalDropdownLabel,
  PortalDropdownSeparator,
  PortalDropdownShortcut,
  PortalDropdownGroup,
  PortalDropdownPortal,
  PortalDropdownSub,
  PortalDropdownSubContent,
  PortalDropdownSubTrigger,
  PortalDropdownRadioGroup,
};
