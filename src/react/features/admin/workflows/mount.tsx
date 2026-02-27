import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorkflowsManager } from './WorkflowsManager';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface WorkflowsMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountWorkflowsManager(
  element: HTMLElement,
  options: WorkflowsMountOptions = {}
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
      <WorkflowsManager onNavigate={options.onNavigate} />
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

export function unmountWorkflowsManager(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
