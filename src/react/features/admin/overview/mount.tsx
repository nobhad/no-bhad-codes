import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OverviewDashboard } from './OverviewDashboard';

// Import CSS for brutalist design
import '../../../styles/tailwind-generated.css';
import '../../../styles/brutalist.css';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface OverviewMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountOverviewDashboard(
  element: HTMLElement,
  options: OverviewMountOptions = {}
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
      <OverviewDashboard onNavigate={options.onNavigate} />
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

export function unmountOverviewDashboard(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
