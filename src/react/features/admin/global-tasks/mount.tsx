import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GlobalTasksTable } from './GlobalTasksTable';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface GlobalTasksMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountGlobalTasksTable(
  element: HTMLElement,
  options: GlobalTasksMountOptions = {}
): () => void {
  if (root) {
    root.unmount();
    root = null;
  }

  mountedContainer = element;
  element.innerHTML = '';

  // Add brutalist styling class
  element.classList.add('react-portal-mount');

  root = createRoot(element);
  root.render(
    <React.StrictMode>
      <GlobalTasksTable onNavigate={options.onNavigate} />
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

export function unmountGlobalTasksTable(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.classList.remove('react-portal-mount');
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
