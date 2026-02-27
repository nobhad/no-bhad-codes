import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DeletedItemsTable } from './DeletedItemsTable';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface DeletedItemsMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountDeletedItemsTable(
  element: HTMLElement,
  options: DeletedItemsMountOptions = {}
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
      <DeletedItemsTable onNavigate={options.onNavigate} />
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

export function unmountDeletedItemsTable(): void {
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
