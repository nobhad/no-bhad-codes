import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { KnowledgeBase } from './KnowledgeBase';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface KnowledgeBaseMountOptions {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountKnowledgeBase(
  element: HTMLElement,
  options: KnowledgeBaseMountOptions = {}
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
      <KnowledgeBase onNavigate={options.onNavigate} />
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

export function unmountKnowledgeBase(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
