import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SystemStatusPanel } from './SystemStatusPanel';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface SystemStatusMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountSystemStatusPanel(
  element: HTMLElement,
  options: SystemStatusMountOptions = {}
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
      <SystemStatusPanel onNavigate={options.onNavigate} />
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

export function unmountSystemStatusPanel(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
