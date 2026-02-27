import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AdHocAnalytics } from './AdHocAnalytics';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface AdHocAnalyticsMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountAdHocAnalytics(
  element: HTMLElement,
  options: AdHocAnalyticsMountOptions = {}
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
      <AdHocAnalytics onNavigate={options.onNavigate} />
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

export function unmountAdHocAnalytics(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
