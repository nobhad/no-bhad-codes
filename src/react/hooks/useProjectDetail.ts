/**
 * useProjectDetail
 * Thin orchestrator that composes focused sub-hooks for project detail data.
 * The public interface is unchanged so existing consumers are unaffected.
 */

import { useState, useEffect, useCallback } from 'react';

import { useProjectCore } from './project-detail/useProjectCore';
import { useProjectMilestones } from './project-detail/useProjectMilestones';
import { useProjectFiles } from './project-detail/useProjectFiles';
import { useProjectInvoices } from './project-detail/useProjectInvoices';
import { useProjectMessages } from './project-detail/useProjectMessages';

import type { UseProjectDetailOptions, UseProjectDetailReturn } from './project-detail/types';

const DEFAULT_ERROR_MESSAGE = 'An error occurred';

/**
 * useProjectDetail
 * Hook for fetching and managing project detail data.
 * Delegates to domain-specific sub-hooks and orchestrates initial data loading.
 */
export function useProjectDetail({
  projectId,
  getAuthToken,
  autoFetch = true
}: UseProjectDetailOptions): UseProjectDetailReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hookOptions = { projectId, getAuthToken };

  // Domain sub-hooks
  const {
    project,
    setProject,
    fetchProject,
    updateProject
  } = useProjectCore(hookOptions);

  const {
    milestones,
    setMilestones,
    progress,
    fetchMilestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestoneComplete
  } = useProjectMilestones(hookOptions);

  const {
    files,
    setFiles,
    fetchFiles,
    uploadFile,
    deleteFile,
    toggleFileSharing
  } = useProjectFiles(hookOptions);

  const {
    invoices,
    setInvoices,
    outstandingBalance,
    totalPaid,
    fetchInvoices
  } = useProjectInvoices(hookOptions);

  const {
    messages,
    setMessages,
    loadMessages,
    sendMessage,
    editMessage,
    reactions,
    toggleReaction
  } = useProjectMessages(hookOptions);

  // Fetch all data in parallel (messages loaded on demand)
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [fetchedProject, fetchedMilestones, fetchedFiles, fetchedInvoices] =
        await Promise.all([
          fetchProject(),
          fetchMilestones(),
          fetchFiles(),
          fetchInvoices()
        ]);

      setProject(fetchedProject);
      setMilestones(fetchedMilestones);
      setFiles(fetchedFiles);
      setInvoices(fetchedInvoices);
      setMessages([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : DEFAULT_ERROR_MESSAGE;
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchProject,
    fetchMilestones,
    fetchFiles,
    fetchInvoices,
    setProject,
    setMilestones,
    setFiles,
    setInvoices,
    setMessages
  ]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && projectId) {
      fetchAll();
    }
  }, [autoFetch, projectId, fetchAll]);

  return {
    project,
    milestones,
    files,
    invoices,
    messages,
    isLoading,
    error,
    progress,
    outstandingBalance,
    totalPaid,
    refetch: fetchAll,
    updateProject,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestoneComplete,
    uploadFile,
    deleteFile,
    toggleFileSharing,
    loadMessages,
    sendMessage,
    editMessage,
    reactions,
    toggleReaction
  };
}

// Re-export types for consumers that import them from this module
export type { UseProjectDetailOptions, UseProjectDetailReturn } from './project-detail/types';
