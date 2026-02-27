import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TimeTrackingPanel } from './TimeTrackingPanel';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface TimeTrackingMountOptions {
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountTimeTrackingPanel(
  element: HTMLElement,
  options: TimeTrackingMountOptions = {}
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
      <TimeTrackingPanel projectId={options.projectId} onNavigate={options.onNavigate} />
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

export function unmountTimeTrackingPanel(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
