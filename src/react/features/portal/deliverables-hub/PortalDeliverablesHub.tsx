/**
 * PortalDeliverablesHub
 * Container with subtabs: Deliverables | Approvals
 * Wraps existing components as subtab panels.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Package, CheckCircle } from 'lucide-react';
import { TabList, TabPanel } from '@react/factories/createTabs';
import { useFadeIn } from '@react/hooks/useGsap';
import type { PortalViewProps } from '../types';
import type { TabItem, TabIconMap } from '@react/factories/createTabs';

// Lazy-load subtab content
const PortalDeliverables = React.lazy(() =>
  import('../deliverables/PortalDeliverables').then(m => ({ default: m.PortalDeliverables }))
);
const PortalApprovals = React.lazy(() =>
  import('../approvals/PortalApprovals').then(m => ({ default: m.PortalApprovals }))
);

// ============================================================================
// CONSTANTS
// ============================================================================

type DeliverablesSubtab = 'deliverables' | 'approvals';

const SUBTABS: Array<TabItem<DeliverablesSubtab>> = [
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'approvals', label: 'Approvals' }
];

const SUBTAB_ICONS: TabIconMap<DeliverablesSubtab> = {
  deliverables: Package,
  approvals: CheckCircle
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PortalDeliverablesHub({ getAuthToken, showNotification }: PortalViewProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [activeTab, setActiveTab] = useState<DeliverablesSubtab>('deliverables');

  const handleTabChange = useCallback((tabId: DeliverablesSubtab) => {
    setActiveTab(tabId);
  }, []);

  const viewProps = { getAuthToken, showNotification };

  return (
    <div ref={containerRef} className="subsection">
      <TabList
        tabs={SUBTABS}
        tabIcons={SUBTAB_ICONS}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        ariaLabel="Deliverables navigation"
      />

      <React.Suspense fallback={<div className="loading-state"><div className="loading-spinner" /></div>}>
        <TabPanel tabId="deliverables" isActive={activeTab === 'deliverables'}>
          <PortalDeliverables {...viewProps} />
        </TabPanel>

        <TabPanel tabId="approvals" isActive={activeTab === 'approvals'}>
          <PortalApprovals {...viewProps} />
        </TabPanel>
      </React.Suspense>
    </div>
  );
}
