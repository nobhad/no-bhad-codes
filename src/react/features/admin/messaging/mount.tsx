import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MessagingPanel } from './MessagingPanel';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface MessagingMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountMessagingPanel(
  element: HTMLElement,
  options: MessagingMountOptions = {}
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
      <MessagingPanel onNavigate={options.onNavigate} />
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

export function unmountMessagingPanel(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
