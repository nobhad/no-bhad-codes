/**
 * Duplicate Detection Tab
 * @file src/react/features/admin/data-quality/DuplicateDetectionTab.tsx
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Play, Merge, X } from 'lucide-react';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import {
  fetchWithAuth,
  formatDate,
  getConfidenceBadgeVariant,
  type TabProps,
  type DuplicateRecord
} from './types';

const logger = createLogger('DuplicateDetectionTab');

export function DuplicateDetectionTab({
  getAuthToken,
  showNotification
}: TabProps) {
  const [duplicates, setDuplicates] = useState<DuplicateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const loadDuplicates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth<DuplicateRecord[]>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_DUPLICATES_HISTORY,
        getAuthToken
      );
      setDuplicates(data);
    } catch (err) {
      logger.error('Failed to load duplicates history:', err);
      showNotification?.('Failed to load duplicate history', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, showNotification]);

  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  const handleScan = useCallback(async () => {
    try {
      setScanning(true);
      const data = await fetchWithAuth<DuplicateRecord[]>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_DUPLICATES_SCAN,
        getAuthToken,
        { method: 'POST' }
      );
      setDuplicates(data);
      showNotification?.(`Scan complete. Found ${data.length} potential duplicate(s).`, 'success');
    } catch (err) {
      logger.error('Duplicate scan failed:', err);
      showNotification?.('Duplicate scan failed', 'error');
    } finally {
      setScanning(false);
    }
  }, [getAuthToken, showNotification]);

  const handleMerge = useCallback(async (duplicateId: string) => {
    try {
      await fetchWithAuth(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_DUPLICATES_MERGE,
        getAuthToken,
        { method: 'POST', body: JSON.stringify({ duplicateId }) }
      );
      setDuplicates(prev => prev.map(d =>
        d.id === duplicateId ? { ...d, status: 'merged' as const } : d
      ));
      showNotification?.('Records merged successfully', 'success');
    } catch (err) {
      logger.error('Merge failed:', err);
      showNotification?.('Failed to merge records', 'error');
    }
  }, [getAuthToken, showNotification]);

  const handleDismiss = useCallback(async (duplicateId: string) => {
    try {
      await fetchWithAuth(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_DUPLICATES_DISMISS,
        getAuthToken,
        { method: 'POST', body: JSON.stringify({ duplicateId }) }
      );
      setDuplicates(prev => prev.map(d =>
        d.id === duplicateId ? { ...d, status: 'dismissed' as const } : d
      ));
      showNotification?.('Duplicate dismissed', 'info');
    } catch (err) {
      logger.error('Dismiss failed:', err);
      showNotification?.('Failed to dismiss duplicate', 'error');
    }
  }, [getAuthToken, showNotification]);

  const pendingDuplicates = duplicates.filter(d => d.status === 'pending');

  return (
    <div className="portal-card">
      <div className="layout-row-between">
        <h3 className="section-title">Duplicate Detection</h3>
        <button
          className="btn btn-primary"
          onClick={handleScan}
          disabled={scanning}
        >
          <Play size={14} />
          {scanning ? 'Scanning...' : 'Run Duplicate Scan'}
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading duplicates...</div>
      ) : pendingDuplicates.length === 0 ? (
        <div className="empty-state">No pending duplicates found.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Entity Type</th>
              <th>Record 1</th>
              <th>Record 2</th>
              <th>Confidence</th>
              <th>Match Fields</th>
              <th>Detected</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingDuplicates.map(dup => (
              <tr key={dup.id}>
                <td>
                  <span className="status-badge status-badge-info">{dup.entityType}</span>
                </td>
                <td>{dup.entity1Name}</td>
                <td>{dup.entity2Name}</td>
                <td>
                  <span className={`status-badge status-badge-${getConfidenceBadgeVariant(dup.confidence)}`}>
                    {Math.round(dup.confidence * 100)}%
                  </span>
                </td>
                <td>{dup.matchFields.join(', ')}</td>
                <td>{formatDate(dup.detectedAt)}</td>
                <td className="col-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleMerge(dup.id)}
                    title="Merge records"
                  >
                    <Merge size={14} />
                    Merge
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDismiss(dup.id)}
                    title="Dismiss duplicate"
                  >
                    <X size={14} />
                    Dismiss
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
