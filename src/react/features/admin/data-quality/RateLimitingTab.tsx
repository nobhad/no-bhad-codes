/**
 * Rate Limiting Tab
 * @file src/react/features/admin/data-quality/RateLimitingTab.tsx
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Ban, Unlock } from 'lucide-react';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import {
  fetchWithAuth,
  formatDate,
  type TabProps,
  type RateLimitStats
} from './types';

const logger = createLogger('RateLimitingTab');

export function RateLimitingTab({
  getAuthToken,
  showNotification
}: TabProps) {
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockIp, setBlockIp] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [unblockIp, setUnblockIp] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth<RateLimitStats>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_RATE_LIMITS_STATS,
        getAuthToken
      );
      setStats(data);
    } catch (err) {
      logger.error('Failed to load rate limit stats:', err);
      showNotification?.('Failed to load rate limit stats', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, showNotification]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleBlock = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockIp.trim()) return;

    try {
      setActionLoading(true);
      await fetchWithAuth(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_RATE_LIMITS_BLOCK,
        getAuthToken,
        { method: 'POST', body: JSON.stringify({ ip: blockIp.trim(), reason: blockReason.trim() }) }
      );
      showNotification?.(`IP ${blockIp} blocked successfully`, 'success');
      setBlockIp('');
      setBlockReason('');
      loadStats();
    } catch (err) {
      logger.error('Failed to block IP:', err);
      showNotification?.('Failed to block IP', 'error');
    } finally {
      setActionLoading(false);
    }
  }, [blockIp, blockReason, getAuthToken, showNotification, loadStats]);

  const handleUnblock = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unblockIp.trim()) return;

    try {
      setActionLoading(true);
      await fetchWithAuth(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_RATE_LIMITS_UNBLOCK,
        getAuthToken,
        { method: 'POST', body: JSON.stringify({ ip: unblockIp.trim() }) }
      );
      showNotification?.(`IP ${unblockIp} unblocked successfully`, 'success');
      setUnblockIp('');
      loadStats();
    } catch (err) {
      logger.error('Failed to unblock IP:', err);
      showNotification?.('Failed to unblock IP', 'error');
    } finally {
      setActionLoading(false);
    }
  }, [unblockIp, getAuthToken, showNotification, loadStats]);

  if (loading) {
    return <div className="loading-state">Loading rate limit stats...</div>;
  }

  return (
    <>
      {stats && (
        <div className="portal-card">
          <div className="data-table-header">
            <h3><span className="title-full">Rate Limit Overview</span></h3>
            <div className="data-table-actions">
              <button className="btn btn-secondary" onClick={loadStats}>
                <RefreshCw />
                Refresh
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalRequests.toLocaleString()}</div>
              <div className="stat-label">Total Requests</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.blockedRequests.toLocaleString()}</div>
              <div className="stat-label">Blocked Requests</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.activeBlocks}</div>
              <div className="stat-label">Active Blocks</div>
            </div>
          </div>

          {stats.topOffenders.length > 0 && (
            <>
              <div className="data-table-header mt-lg"><h3><span className="title-full">Top Offenders</span></h3></div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>IP Address</th>
                    <th>Request Count</th>
                    <th>Status</th>
                    <th>Last Request</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topOffenders.map(offender => (
                    <tr key={offender.ip}>
                      <td><code>{offender.ip}</code></td>
                      <td>{offender.requestCount.toLocaleString()}</td>
                      <td>
                        <span className={`status-badge status-badge-${offender.blocked ? 'danger' : 'active'}`}>
                          {offender.blocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td>{formatDate(offender.lastRequest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      <div className="portal-card">
        <div className="data-table-header"><h3><span className="title-full">Block / Unblock IP</span></h3></div>

        <div className="rate-limit-forms">
          <form onSubmit={handleBlock} className="rate-limit-form">
            <h4 className="field-label">Block an IP Address</h4>
            <div className="form-field">
              <label className="field-label" htmlFor="block-ip">IP Address</label>
              <input
                id="block-ip"
                className="form-input"
                type="text"
                placeholder="e.g. 192.168.1.1"
                value={blockIp}
                onChange={e => setBlockIp(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="field-label" htmlFor="block-reason">Reason (optional)</label>
              <input
                id="block-reason"
                className="form-input"
                type="text"
                placeholder="Reason for blocking"
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
              />
            </div>
            <button className="btn btn-danger" type="submit" disabled={actionLoading || !blockIp.trim()}>
              <Ban />
              Block IP
            </button>
          </form>

          <form onSubmit={handleUnblock} className="rate-limit-form">
            <h4 className="field-label">Unblock an IP Address</h4>
            <div className="form-field">
              <label className="field-label" htmlFor="unblock-ip">IP Address</label>
              <input
                id="unblock-ip"
                className="form-input"
                type="text"
                placeholder="e.g. 192.168.1.1"
                value={unblockIp}
                onChange={e => setUnblockIp(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-secondary" type="submit" disabled={actionLoading || !unblockIp.trim()}>
              <Unlock />
              Unblock IP
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
