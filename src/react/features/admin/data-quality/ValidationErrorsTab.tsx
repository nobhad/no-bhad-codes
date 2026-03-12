/**
 * Validation Errors Tab
 * @file src/react/features/admin/data-quality/ValidationErrorsTab.tsx
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import {
  fetchWithAuth,
  formatDate,
  getSeverityBadgeVariant,
  type TabProps,
  type ValidationError
} from './types';

const logger = createLogger('ValidationErrorsTab');

export function ValidationErrorsTab({
  getAuthToken,
  showNotification
}: TabProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorTypeFilter, setErrorTypeFilter] = useState('');

  const loadErrors = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth<ValidationError[]>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_VALIDATION_ERRORS,
        getAuthToken
      );
      setErrors(data);
    } catch (err) {
      logger.error('Failed to load validation errors:', err);
      showNotification?.('Failed to load validation errors', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, showNotification]);

  useEffect(() => {
    loadErrors();
  }, [loadErrors]);

  const errorTypes = useMemo(() => {
    const types = new Set(errors.map(e => e.errorType));
    return Array.from(types).sort();
  }, [errors]);

  const filteredErrors = useMemo(() => {
    if (!errorTypeFilter) return errors;
    return errors.filter(e => e.errorType === errorTypeFilter);
  }, [errors, errorTypeFilter]);

  return (
    <div className="portal-card">
      <div className="layout-row-between">
        <h3 className="section-title">Validation Errors</h3>
        <div className="form-field mb-0">
          <div className="filter-inline">
            <Filter size={14} />
            <select
              className="form-input"
              value={errorTypeFilter}
              onChange={e => setErrorTypeFilter(e.target.value)}
              aria-label="Filter by error type"
            >
              <option value="">All Error Types</option>
              {errorTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading validation errors...</div>
      ) : filteredErrors.length === 0 ? (
        <div className="empty-state">
          {errorTypeFilter ? 'No errors match the selected filter.' : 'No validation errors found.'}
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Entity Type</th>
              <th>Entity</th>
              <th>Error Type</th>
              <th>Message</th>
              <th>Severity</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody>
            {filteredErrors.map(error => (
              <tr key={error.id}>
                <td>{error.entityType}</td>
                <td>{error.entityName}</td>
                <td>
                  <span className="status-badge status-badge-neutral">{error.errorType}</span>
                </td>
                <td>{error.message}</td>
                <td>
                  <span className={`status-badge status-badge-${getSeverityBadgeVariant(error.severity)}`}>
                    {error.severity}
                  </span>
                </td>
                <td>{formatDate(error.detectedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
