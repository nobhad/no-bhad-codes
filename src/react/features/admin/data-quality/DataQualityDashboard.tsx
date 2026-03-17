/**
 * ===============================================
 * DATA QUALITY DASHBOARD
 * ===============================================
 * @file src/react/features/admin/data-quality/DataQualityDashboard.tsx
 *
 * Thin orchestrator for the data quality admin panel.
 * Sub-components: DuplicateDetectionTab, MetricsHistoryTab,
 * ValidationErrorsTab, RateLimitingTab.
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
import {
  TAB_CONFIG,
  type DataQualityDashboardProps,
  type DataQualityTab
} from './types';
import { DuplicateDetectionTab } from './DuplicateDetectionTab';
import { MetricsHistoryTab } from './MetricsHistoryTab';
import { ValidationErrorsTab } from './ValidationErrorsTab';
import { RateLimitingTab } from './RateLimitingTab';

export function DataQualityDashboard({ getAuthToken, showNotification, onNavigate }: DataQualityDashboardProps) {
  const containerRef = useFadeIn();
  const [activeTab, setActiveTab] = useState<DataQualityTab>('duplicates');

  const sharedProps = useMemo(() => ({ getAuthToken, showNotification, onNavigate }), [getAuthToken, showNotification, onNavigate]);

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
      <div className="view-toggle">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="data-quality-content">
        {activeTab === 'duplicates' && <DuplicateDetectionTab {...sharedProps} />}
        {activeTab === 'metrics' && <MetricsHistoryTab {...sharedProps} />}
        {activeTab === 'validation' && <ValidationErrorsTab {...sharedProps} />}
        {activeTab === 'rate-limits' && <RateLimitingTab {...sharedProps} />}
      </div>
    </div>
  );
}

export default DataQualityDashboard;
