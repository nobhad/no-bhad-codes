import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ContractsTable } from './ContractsTable';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface ContractsMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountContractsTable(
  element: HTMLElement,
  options: ContractsMountOptions = {}
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
      <ContractsTable onNavigate={options.onNavigate} />
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

export function unmountContractsTable(): void {
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
