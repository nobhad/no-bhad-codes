/**
 * PortalFilesHub
 * Simple files view for client portal — just files, no subtabs.
 * Questionnaires and document requests now live under /requests-hub.
 */

import * as React from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
import type { PortalViewProps } from '../types';

const PortalFilesManager = React.lazy(() =>
  import('../files/PortalFilesManager').then(m => ({ default: m.PortalFilesManager }))
);

export function PortalFilesHub({ getAuthToken, showNotification }: PortalViewProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  return (
    <div ref={containerRef}>
      <React.Suspense fallback={<div className="loading-state"><div className="loading-spinner" /></div>}>
        <PortalFilesManager getAuthToken={getAuthToken} showNotification={showNotification} />
      </React.Suspense>
    </div>
  );
}
