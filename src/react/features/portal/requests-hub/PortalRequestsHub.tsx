/**
 * PortalRequestsHub
 * Unified tabbed view for client-facing request systems:
 * Questionnaires, Document Requests, and Content Requests.
 */

import * as React from 'react';
import { Suspense } from 'react';
import { useTabs, TabList, TabPanel } from '@react/factories/createTabs';
import { LoadingState } from '@react/components/portal/EmptyState';
import type { PortalViewProps } from '../types';

// Lazy load sub-views
const PortalQuestionnairesView = React.lazy(() =>
  import('../questionnaires').then(m => ({ default: m.PortalQuestionnairesView }))
);
const PortalDocumentRequests = React.lazy(() =>
  import('../document-requests').then(m => ({ default: m.PortalDocumentRequests }))
);
const ContentChecklistView = React.lazy(() =>
  import('../content-requests').then(m => ({ default: m.ContentChecklistView }))
);

export interface PortalRequestsHubProps extends PortalViewProps {}

type RequestTab = 'questionnaires' | 'documents' | 'content';

const TABS = [
  { id: 'questionnaires' as RequestTab, label: 'Questionnaires' },
  { id: 'documents' as RequestTab, label: 'Document Requests' },
  { id: 'content' as RequestTab, label: 'Content' }
];

export function PortalRequestsHub(_props: PortalRequestsHubProps) {
  const { activeTab, setActiveTab, isActive } = useTabs<RequestTab>({
    initialTab: 'questionnaires'
  });

  return (
    <div className="portal-requests-hub">
      <TabList<RequestTab>
        tabs={TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <Suspense fallback={<LoadingState message="Loading..." />}>
        <TabPanel tabId="questionnaires" isActive={isActive('questionnaires')}>
          <PortalQuestionnairesView />
        </TabPanel>

        <TabPanel tabId="documents" isActive={isActive('documents')}>
          <PortalDocumentRequests />
        </TabPanel>

        <TabPanel tabId="content" isActive={isActive('content')}>
          <ContentChecklistView />
        </TabPanel>
      </Suspense>
    </div>
  );
}
