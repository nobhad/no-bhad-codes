import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TasksManager } from './TasksManager';

let root: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export interface TasksMountOptions {
  clientId?: string;
  projectId?: string;
  assigneeId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function mountTasksManager(
  element: HTMLElement,
  options: TasksMountOptions = {}
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
      <TasksManager
        clientId={options.clientId}
        projectId={options.projectId}
        assigneeId={options.assigneeId}
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

export function unmountTasksManager(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (mountedContainer) {
    mountedContainer.innerHTML = '';
    mountedContainer = null;
  }
}
