import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ContactsTable } from './ContactsTable';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface ContactsMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountContactsTable(
  element: HTMLElement,
  options: ContactsMountOptions = {}
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
      <ContactsTable onNavigate={options.onNavigate} />
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

export function unmountContactsTable(): void {
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
