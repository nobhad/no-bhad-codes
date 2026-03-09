import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

import { cn } from '@react/lib/utils';

/**
 * Checkbox component using Radix primitives with vanilla CSS
 * Styles defined in portal-forms.css (.portal-checkbox)
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn('portal-checkbox', className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="portal-checkbox-indicator">
      <Check className="portal-checkbox-icon" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
