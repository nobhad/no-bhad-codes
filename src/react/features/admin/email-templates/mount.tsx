/**
 * Email Templates Manager Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { EmailTemplatesManager } from './EmailTemplatesManager';

export interface EmailTemplatesMountOptions extends BaseMountOptions {
  /** Callback when template is clicked for detail view */
  onViewTemplate?: (templateId: number) => void;
}

export const {
  mount: mountEmailTemplatesManager,
  unmount: unmountEmailTemplatesManager,
  shouldUseReact: shouldUseReactEmailTemplatesManager
} = createMountWrapper<EmailTemplatesMountOptions>({
  Component: EmailTemplatesManager,
  displayName: 'EmailTemplatesManager'
});
