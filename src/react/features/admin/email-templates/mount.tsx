import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EmailTemplatesManager } from './EmailTemplatesManager';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface EmailTemplatesMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountEmailTemplatesManager(
  element: HTMLElement,
  options: EmailTemplatesMountOptions = {}
): () => void {
  if (root) {
    root.unmount();
    root = null;
  }

  mountedContainer = element;
  element.innerHTML = '';

  root = createRoot(element);
  root.render(
    <React.StrictMode>
      <EmailTemplatesManager onNavigate={options.onNavigate} />
    </React.StrictMode>
  );

  return () => {
    if (root) {
      root.unmount();
      root = null;
    }
    if (mountedContainer) {
      mountedContainer.innerHTML = '';
      mountedContainer = null;
    }
  };
}

export function unmountEmailTemplatesManager(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
