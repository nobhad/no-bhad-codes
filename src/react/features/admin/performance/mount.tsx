import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PerformanceMetrics } from './PerformanceMetrics';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface PerformanceMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountPerformanceMetrics(
  element: HTMLElement,
  options: PerformanceMountOptions = {}
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
      <PerformanceMetrics onNavigate={options.onNavigate} />
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

export function unmountPerformanceMetrics(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
