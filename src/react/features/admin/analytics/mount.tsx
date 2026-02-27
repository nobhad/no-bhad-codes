import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnalyticsDashboard } from './AnalyticsDashboard';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface AnalyticsMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountAnalyticsDashboard(
  element: HTMLElement,
  options: AnalyticsMountOptions = {}
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
      <AnalyticsDashboard onNavigate={options.onNavigate} />
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

export function unmountAnalyticsDashboard(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
