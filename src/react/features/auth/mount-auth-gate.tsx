import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AuthGate } from './AuthGate';

type AuthGateMountOptions = {
  portalType: 'admin' | 'client';
  businessName?: string;
  authTitle: string;
  authDescription: string;
};

let root: Root | null = null;

export function mountAuthGate(container: HTMLElement, options: AuthGateMountOptions): () => void {
  if (root) {
    root.unmount();
    root = null;
  }

  root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AuthGate {...options} />
    </React.StrictMode>
  );

  return () => {
    root?.unmount();
    root = null;
  };
}

export function autoMountAuthGate(): void {
  const container = document.getElementById('auth-gate');
  if (!container) return;

  const ds = container.dataset;
  const portalType = (ds.portalType === 'admin' ? 'admin' : 'client') as 'admin' | 'client';

  const authTitle = ds.authTitle || (portalType === 'admin' ? 'Admin Access' : 'Client Portal');
  const authDescription =
    ds.authDescription ||
    (portalType === 'admin'
      ? 'Enter your admin password to continue'
      : 'Sign in to access your projects and documents');

  mountAuthGate(container, {
    portalType,
    businessName: ds.businessName,
    authTitle,
    authDescription
  });
}
