/**
 * Data Quality feature types, constants, and helpers
 * @file src/react/features/admin/data-quality/types.ts
 */

import * as React from 'react';
import {
  Copy,
  BarChart3,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { unwrapApiData } from '@/utils/api-client';

// ============================================
// TYPES
// ============================================

export interface DataQualityDashboardProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

export type DataQualityTab = 'duplicates' | 'metrics' | 'validation' | 'rate-limits';

export interface DuplicateRecord {
  id: string;
  entityType: string;
  entity1Id: string;
  entity1Name: string;
  entity2Id: string;
  entity2Name: string;
  confidence: number;
  matchFields: string[];
  status: 'pending' | 'merged' | 'dismissed';
  detectedAt: string;
}

export interface DataQualityMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  lastCalculated: string;
}

export interface MetricHistoryEntry {
  id: string;
  metricName: string;
  value: number;
  calculatedAt: string;
}

export interface ValidationError {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  errorType: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
}

export interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  activeBlocks: number;
  topOffenders: Array<{
    ip: string;
    requestCount: number;
    blocked: boolean;
    lastRequest: string;
  }>;
}

/** Shared props passed down to each tab */
export type TabProps = Pick<DataQualityDashboardProps, 'getAuthToken' | 'showNotification'>;

// ============================================
// TAB CONFIGURATION
// ============================================

export const TAB_CONFIG: Array<{ key: DataQualityTab; label: string; icon: React.ReactNode }> = [
  { key: 'duplicates', label: 'Duplicate Detection', icon: React.createElement(Copy, { size: 16 }) },
  { key: 'metrics', label: 'Metrics & History', icon: React.createElement(BarChart3, { size: 16 }) },
  { key: 'validation', label: 'Validation Errors', icon: React.createElement(AlertTriangle, { size: 16 }) },
  { key: 'rate-limits', label: 'Rate Limiting', icon: React.createElement(Shield, { size: 16 }) }
];

// ============================================
// CONSTANTS
// ============================================

export const HIGH_CONFIDENCE_THRESHOLD = 0.8;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

// ============================================
// HELPERS
// ============================================

export function getConfidenceBadgeVariant(confidence: number): string {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return 'danger';
  if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) return 'warning';
  return 'info';
}

export function getSeverityBadgeVariant(severity: string): string {
  const variantMap: Record<string, string> = {
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'neutral'
  };
  return variantMap[severity] || 'neutral';
}

export function getMetricStatusVariant(status: string): string {
  const variantMap: Record<string, string> = {
    good: 'active',
    warning: 'warning',
    critical: 'danger'
  };
  return variantMap[status] || 'neutral';
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export async function fetchWithAuth<T>(
  url: string,
  getAuthToken?: () => string | null,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken?.();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const response = await fetch(url, { ...options, headers: { ...headers, ...options?.headers } });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }
  const json = await response.json();
  return unwrapApiData<T>(json);
}
