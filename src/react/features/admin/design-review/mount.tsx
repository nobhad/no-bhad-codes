import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DesignReviewPanel } from './DesignReviewPanel';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface DesignReviewMountOptions {
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountDesignReviewPanel(
  element: HTMLElement,
  options: DesignReviewMountOptions = {}
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
      <DesignReviewPanel projectId={options.projectId} onNavigate={options.onNavigate} />
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

export function unmountDesignReviewPanel(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
