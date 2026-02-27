import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FilesManager } from './FilesManager';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface FilesMountOptions {
  projectId?: string;
  clientId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountFilesManager(
  element: HTMLElement,
  options: FilesMountOptions = {}
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
      <FilesManager
        projectId={options.projectId}
        clientId={options.clientId}
        onNavigate={options.onNavigate}
      />
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

export function unmountFilesManager(): void {
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
