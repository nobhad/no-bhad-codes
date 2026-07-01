import * as React from 'react';
import { useActiveSubtab, useSetSubtabActions } from '@react/contexts/SubtabContext';
import { LoadingState } from '@react/factories';
import type { TrafficSubtab, TrafficViewProps } from './types';

// Lazy-load each subview so a tab only costs what it renders.
const TrafficOverview = React.lazy(() =>
  import('./TrafficOverview').then((m) => ({ default: m.TrafficOverview }))
);
const TrafficLive = React.lazy(() =>
  import('./TrafficLive').then((m) => ({ default: m.TrafficLive }))
);
const TrafficSessions = React.lazy(() =>
  import('./TrafficSessions').then((m) => ({ default: m.TrafficSessions }))
);

/**
 * TrafficDashboard — web traffic to the main site and portal.
 * Subtabs: Overview (totals, trend, top pages), Live (real-time), Sessions.
 */
export function TrafficDashboard({ onNavigate, getAuthToken, showNotification }: TrafficViewProps) {
  const activeSubtab = useActiveSubtab<TrafficSubtab>();
  const setSubtabActions = useSetSubtabActions();

  // Subviews own their own header actions; clear any inherited ones.
  React.useEffect(() => {
    setSubtabActions(null);
    return () => setSubtabActions(null);
  }, [setSubtabActions]);

  const viewProps: TrafficViewProps = { onNavigate, getAuthToken, showNotification };

  if (activeSubtab === 'live') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading live traffic..." />}>
        <TrafficLive {...viewProps} />
      </React.Suspense>
    );
  }

  if (activeSubtab === 'sessions') {
    return (
      <React.Suspense fallback={<LoadingState message="Loading sessions..." />}>
        <TrafficSessions {...viewProps} />
      </React.Suspense>
    );
  }

  return (
    <React.Suspense fallback={<LoadingState message="Loading traffic..." />}>
      <TrafficOverview {...viewProps} />
    </React.Suspense>
  );
}
