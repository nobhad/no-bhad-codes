/**
 * PortalFilesHub
 * Container with subtabs: All Files | Requested Uploads | Questionnaires
 * Wraps existing components as subtab panels.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { FolderOpen, Upload, ClipboardList } from 'lucide-react';
import { TabList, TabPanel } from '@react/factories/createTabs';
import { useFadeIn } from '@react/hooks/useGsap';
import type { PortalViewProps } from '../types';
import type { TabItem, TabIconMap } from '@react/factories/createTabs';

// Lazy-load subtab content to keep bundle small
const PortalFilesManager = React.lazy(() =>
  import('../files/PortalFilesManager').then(m => ({ default: m.PortalFilesManager }))
);
const PortalDocumentRequests = React.lazy(() =>
  import('../document-requests/PortalDocumentRequests').then(m => ({ default: m.PortalDocumentRequests }))
);
const PortalQuestionnairesView = React.lazy(() =>
  import('../questionnaires/PortalQuestionnairesView').then(m => ({ default: m.PortalQuestionnairesView }))
);

// ============================================================================
// CONSTANTS
// ============================================================================

type FilesSubtab = 'all-files' | 'requested-uploads' | 'questionnaires';

const SUBTABS: Array<TabItem<FilesSubtab>> = [
  { id: 'all-files', label: 'All Files' },
  { id: 'requested-uploads', label: 'Requested Uploads' },
  { id: 'questionnaires', label: 'Questionnaires' }
];

const SUBTAB_ICONS: TabIconMap<FilesSubtab> = {
  'all-files': FolderOpen,
  'requested-uploads': Upload,
  questionnaires: ClipboardList
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PortalFilesHub({ getAuthToken, showNotification }: PortalViewProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [activeTab, setActiveTab] = useState<FilesSubtab>('all-files');

  const handleTabChange = useCallback((tabId: FilesSubtab) => {
    setActiveTab(tabId);
  }, []);

  const viewProps = { getAuthToken, showNotification };

  return (
    <div ref={containerRef} className="section">
      <TabList
        tabs={SUBTABS}
        tabIcons={SUBTAB_ICONS}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        ariaLabel="Files navigation"
      />

      <React.Suspense fallback={<div className="loading-state"><div className="loading-spinner" /></div>}>
        <TabPanel tabId="all-files" isActive={activeTab === 'all-files'}>
          <PortalFilesManager {...viewProps} />
        </TabPanel>

        <TabPanel tabId="requested-uploads" isActive={activeTab === 'requested-uploads'}>
          <PortalDocumentRequests {...viewProps} />
        </TabPanel>

        <TabPanel tabId="questionnaires" isActive={activeTab === 'questionnaires'}>
          <PortalQuestionnairesView {...viewProps} />
        </TabPanel>
      </React.Suspense>
    </div>
  );
}
