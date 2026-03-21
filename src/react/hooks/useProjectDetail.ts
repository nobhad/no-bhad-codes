/**
 * useProjectDetail
 * Thin orchestrator that composes focused sub-hooks for project detail data.
 * The public interface is unchanged so existing consumers are unaffected.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

import { useProjectCore } from './project-detail/useProjectCore';
import { useProjectMilestones } from './project-detail/useProjectMilestones';
import { useProjectTasks } from './project-detail/useProjectTasks';
import { useProjectFiles } from './project-detail/useProjectFiles';
import { useProjectInvoices } from './project-detail/useProjectInvoices';
import { useProjectMessages } from './project-detail/useProjectMessages';

import type { UseProjectDetailOptions, UseProjectDetailReturn } from './project-detail/types';
import { formatErrorMessage } from '@/utils/error-utils';
const PERCENTAGE_MULTIPLIER = 100;

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
    fetchMilestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    toggleMilestoneComplete,
    toggleDeliverable
  } = useProjectMilestones(hookOptions);

  const {
    tasks,
    setTasks,
    fetchTasks,
    toggleTaskComplete,
    assignTaskToMilestone
  } = useProjectTasks(hookOptions);

  const {
    files,
    setFiles,
    fetchFiles,
    uploadFile,
    deleteFile,
    toggleFileSharing,
    updateCategory
  } = useProjectFiles(hookOptions);

  const {
    invoices,
    setInvoices,
    outstandingBalance,
    totalPaid,
    fetchInvoices,
    sendInvoice,
    markAsPaid,
    deleteInvoice,
    downloadPdf
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

  // Progress: based solely on project_tasks (single source of truth)
  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return Math.round((completed / tasks.length) * PERCENTAGE_MULTIPLIER);
  }, [tasks]);

  // Fetch all data in parallel (messages loaded on demand)
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [fetchedProject, fetchedMilestones, fetchedTasks, fetchedFiles, fetchedInvoices] =
        await Promise.all([
          fetchProject(),
          fetchMilestones(),
          fetchTasks(),
          fetchFiles(),
          fetchInvoices()
        ]);

      setProject(fetchedProject);
      setMilestones(fetchedMilestones);
      setTasks(fetchedTasks);
      setFiles(fetchedFiles);
      setInvoices(fetchedInvoices);
      setMessages([]);
    } catch (err) {
      setError(formatErrorMessage(err, 'An error occurred'));
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchProject,
    fetchMilestones,
    fetchTasks,
    fetchFiles,
    fetchInvoices,
    setProject,
    setMilestones,
    setTasks,
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
    tasks,
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
    toggleDeliverable,
    toggleTaskComplete,
    assignTaskToMilestone,
    uploadFile,
    deleteFile,
    toggleFileSharing,
    updateCategory,
    sendInvoice,
    markAsPaid,
    deleteInvoice,
    downloadPdf,
    loadMessages,
    sendMessage,
    editMessage,
    reactions,
    toggleReaction
  };
}

// Re-export types for consumers that import them from this module
export type { UseProjectDetailOptions, UseProjectDetailReturn } from './project-detail/types';
