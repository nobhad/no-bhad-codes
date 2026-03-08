/**
 * PortalPreview
 * Design review / project preview iframe component.
 * Fetches the first project's preview_url and displays it in a sandboxed iframe.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@react/lib/utils';
import { getLucideIcon } from '@/react/factories';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { useFadeIn } from '@react/hooks/useGsap';
import type { PortalViewProps } from '../types';
import { createLogger } from '@/utils/logger';
import { unwrapApiData } from '@/utils/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

const logger = createLogger('PortalPreview');

// ============================================
// TYPES
// ============================================

export interface PortalPreviewProps extends PortalViewProps {
  /** Navigation callback */
  onNavigate?: (tab: string, entityId?: string) => void;
}

// ============================================
// ICONS
// ============================================

const GlobeIcon = getLucideIcon('globe');
const ExternalLinkIcon = getLucideIcon('external-link');
const RefreshIcon = getLucideIcon('refresh');

// ============================================
// COMPONENT
// ============================================

/**
 * PortalPreview Component
 * Shows an iframe with the first project's preview URL, plus a toolbar for actions.
 */
export function PortalPreview({
  getAuthToken,
  showNotification
}: PortalPreviewProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stable refs for callback props
  const getAuthTokenRef = useRef(getAuthToken);
  const showNotificationRef = useRef(showNotification);

  useEffect(() => {
    getAuthTokenRef.current = getAuthToken;
    showNotificationRef.current = showNotification;
  }, [getAuthToken, showNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /** Build authorization headers */
  const buildHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const token = getAuthTokenRef.current?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  /** Fetch projects and extract the first preview URL */
  const fetchPreviewUrl = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.PORTAL.PROJECTS, {
        method: 'GET',
        headers: buildHeaders(),
        credentials: 'include',
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = unwrapApiData<Record<string, unknown>>(await response.json());

      // Handle various response formats
      let projects: Record<string, unknown>[] = [];
      if (data.projects && Array.isArray(data.projects)) {
        projects = data.projects;
      } else if (Array.isArray(data)) {
        projects = data;
      }

      // Find the first project with a preview_url
      const projectWithPreview = projects.find(
        (p) => typeof p.preview_url === 'string' && p.preview_url.length > 0
      );

      setPreviewUrl((projectWithPreview?.preview_url as string) || null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      logger.error('Error fetching preview URL:', err);
      setError('Failed to load preview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [buildHeaders]);

  // Initial fetch
  useEffect(() => {
    fetchPreviewUrl();
  }, [fetchPreviewUrl]);

  /** Open the preview URL in a new browser tab */
  const handleOpenNewTab = useCallback(() => {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  }, [previewUrl]);

  /** Reload the iframe content */
  const handleRefresh = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  return (
    <div ref={containerRef} className="section">
      {isLoading ? (
        <LoadingState message="Loading preview..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPreviewUrl} />
      ) : previewUrl ? (
        <div className={cn('preview-container')}>
          <div className="preview-toolbar">
            <div className="preview-url">
              <span className="url-icon">
                {GlobeIcon && <GlobeIcon />}
              </span>
              <span className="url-text">{previewUrl}</span>
            </div>
            <div className="preview-actions">
              <button
                className="icon-btn"
                onClick={handleOpenNewTab}
                title="Open in new tab"
                aria-label="Open in new tab"
              >
                {ExternalLinkIcon && <ExternalLinkIcon />}
              </button>
              <button
                className="icon-btn"
                onClick={handleRefresh}
                title="Refresh preview"
                aria-label="Refresh preview"
              >
                {RefreshIcon && <RefreshIcon />}
              </button>
            </div>
          </div>
          <div className="preview-frame-wrapper">
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="preview-frame"
              title="Project Preview"
            />
          </div>
        </div>
      ) : (
        <div className={cn('preview-container')}>
          <div className="preview-toolbar">
            <div className="preview-url">
              <span className="url-icon">
                {GlobeIcon && <GlobeIcon />}
              </span>
              <span className="url-text">No preview available</span>
            </div>
          </div>
          <div className="preview-frame-wrapper" />
        </div>
      )}
    </div>
  );
}
