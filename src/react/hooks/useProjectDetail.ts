import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Project,
  ProjectMilestone,
  ProjectFile,
  Invoice,
  Message,
  ApiResponse
} from '@react/features/admin/types';

interface UseProjectDetailOptions {
  /** Project ID to fetch */
  projectId: number;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Whether to fetch immediately on mount */
  autoFetch?: boolean;
}

interface ProjectDetailData {
  project: Project | null;
  milestones: ProjectMilestone[];
  files: ProjectFile[];
  invoices: Invoice[];
  messages: Message[];
}

interface UseProjectDetailReturn {
  /** Project data */
  project: Project | null;
  /** Project milestones */
  milestones: ProjectMilestone[];
  /** Project files */
  files: ProjectFile[];
  /** Project invoices */
  invoices: Invoice[];
  /** Project messages */
  messages: Message[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Computed progress percentage */
  progress: number;
  /** Outstanding balance */
  outstandingBalance: number;
  /** Total paid amount */
  totalPaid: number;
  /** Refetch all data */
  refetch: () => Promise<void>;
  /** Update project */
  updateProject: (updates: Partial<Project>) => Promise<boolean>;
  /** Add milestone */
  addMilestone: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  /** Update milestone */
  updateMilestone: (id: number, updates: Partial<ProjectMilestone>) => Promise<boolean>;
  /** Delete milestone */
  deleteMilestone: (id: number) => Promise<boolean>;
  /** Toggle milestone completion */
  toggleMilestoneComplete: (id: number) => Promise<boolean>;
  /** Upload file */
  uploadFile: (file: File, category?: string) => Promise<boolean>;
  /** Delete file */
  deleteFile: (id: number) => Promise<boolean>;
  /** Toggle file sharing */
  toggleFileSharing: (id: number) => Promise<boolean>;
  /** Load messages */
  loadMessages: () => Promise<void>;
  /** Send message */
  sendMessage: (content: string) => Promise<boolean>;
}

/**
 * useProjectDetail
 * Hook for fetching and managing project detail data
 */
export function useProjectDetail({
  projectId,
  getAuthToken,
  autoFetch = true
}: UseProjectDetailOptions): UseProjectDetailReturn {
  const [data, setData] = useState<ProjectDetailData>({
    project: null,
    milestones: [],
    files: [],
    invoices: [],
    messages: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build headers helper
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  // Calculate progress from milestones
  const progress = useMemo(() => {
    if (data.milestones.length === 0) return 0;
    const completed = data.milestones.filter((m) => m.is_completed).length;
    return Math.round((completed / data.milestones.length) * 100);
  }, [data.milestones]);

  // Calculate outstanding balance and total paid
  const { outstandingBalance, totalPaid } = useMemo(() => {
    let outstanding = 0;
    let paid = 0;

    for (const invoice of data.invoices) {
      const total =
        typeof invoice.amount_total === 'string'
          ? parseFloat(invoice.amount_total)
          : invoice.amount_total || 0;
      const amountPaid =
        typeof invoice.amount_paid === 'string'
          ? parseFloat(invoice.amount_paid)
          : invoice.amount_paid || 0;

      if (invoice.status === 'paid') {
        paid += total;
      } else if (invoice.status !== 'cancelled' && invoice.status !== 'draft') {
        outstanding += total - amountPaid;
        paid += amountPaid;
      }
    }

    return { outstandingBalance: outstanding, totalPaid: paid };
  }, [data.invoices]);

  // Fetch project details
  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch project: ${response.statusText}`);
      }

      // API returns { project, files, messages, updates } directly
      // or { success, data: { project, ... } } format
      const result = await response.json();

      // Handle both response formats
      if (result.project) {
        return result.project as Project;
      }
      if (result.success && result.data?.project) {
        return result.data.project as Project;
      }
      if (result.success && result.data) {
        return result.data as Project;
      }
      throw new Error(result.error || 'Failed to load project');
    } catch (err) {
      console.error('[useProjectDetail] Error fetching project:', err);
      throw err;
    }
  }, [projectId, getHeaders]);

  // Fetch milestones
  const fetchMilestones = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        // Milestones might not exist yet, return empty array
        return [];
      }

      const result: ApiResponse<{ milestones: ProjectMilestone[] }> = await response.json();
      if (result.success && result.data) {
        return result.data.milestones || [];
      }
      return [];
    } catch (err) {
      console.error('[useProjectDetail] Error fetching milestones:', err);
      return [];
    }
  }, [projectId, getHeaders]);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const result: ApiResponse<{ files: ProjectFile[] }> = await response.json();
      if (result.success && result.data) {
        return result.data.files || [];
      }
      return [];
    } catch (err) {
      console.error('[useProjectDetail] Error fetching files:', err);
      return [];
    }
  }, [projectId, getHeaders]);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      const response = await fetch(`/api/invoices/project/${projectId}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const result: ApiResponse<{ invoices: Invoice[] }> = await response.json();
      if (result.success && result.data) {
        return result.data.invoices || [];
      }
      return [];
    } catch (err) {
      console.error('[useProjectDetail] Error fetching invoices:', err);
      return [];
    }
  }, [projectId, getHeaders]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/messages`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        return [];
      }

      const result: ApiResponse<{ messages: Message[] }> = await response.json();
      if (result.success && result.data) {
        return result.data.messages || [];
      }
      return [];
    } catch (err) {
      console.error('[useProjectDetail] Error fetching messages:', err);
      return [];
    }
  }, [projectId, getHeaders]);

  // Fetch all data
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [project, milestones, files, invoices] = await Promise.all([
        fetchProject(),
        fetchMilestones(),
        fetchFiles(),
        fetchInvoices()
      ]);

      // Messages are loaded on demand to avoid performance issues
      setData({ project, milestones, files, invoices, messages: [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProject, fetchMilestones, fetchFiles, fetchInvoices]);

  // Load messages (on demand)
  const loadMessages = useCallback(async () => {
    const messages = await fetchMessages();
    setData((prev) => ({ ...prev, messages }));
  }, [fetchMessages]);

  // Send message
  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/projects/${projectId}/messages`, {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify({ content })
        });

        if (!response.ok) {
          throw new Error(`Failed to send message: ${response.statusText}`);
        }

        const result: ApiResponse<Message> = await response.json();
        if (result.success && result.data) {
          setData((prev) => ({
            ...prev,
            messages: [...prev.messages, result.data!]
          }));
          return true;
        }
        return false;
      } catch (err) {
        console.error('[useProjectDetail] Send message error:', err);
        return false;
      }
    },
    [projectId, getHeaders]
  );

  // Update project
  const updateProject = useCallback(
    async (updates: Partial<Project>): Promise<boolean> => {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update project: ${response.statusText}`);
        }

        const result: ApiResponse<Project> = await response.json();
        if (result.success) {
          setData((prev) => ({
            ...prev,
            project: prev.project ? { ...prev.project, ...updates } : null
          }));
          return true;
        }
        return false;
      } catch (err) {
        console.error('[useProjectDetail] Update error:', err);
        return false;
      }
    },
    [projectId, getHeaders]
  );

  // Add milestone
  const addMilestone = useCallback(
    async (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>): Promise<boolean> => {
      try {
        const response = await fetch(`/api/projects/${projectId}/milestones`, {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify(milestone)
        });

        if (!response.ok) {
          throw new Error(`Failed to add milestone: ${response.statusText}`);
        }

        const result: ApiResponse<ProjectMilestone> = await response.json();
        if (result.success && result.data) {
          setData((prev) => ({
            ...prev,
            milestones: [...prev.milestones, result.data!]
          }));
          return true;
        }
        return false;
      } catch (err) {
        console.error('[useProjectDetail] Add milestone error:', err);
        return false;
      }
    },
    [projectId, getHeaders]
  );

  // Update milestone
  const updateMilestone = useCallback(
    async (id: number, updates: Partial<ProjectMilestone>): Promise<boolean> => {
      try {
        const response = await fetch(`/api/milestones/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update milestone: ${response.statusText}`);
        }

        const result: ApiResponse<ProjectMilestone> = await response.json();
        if (result.success) {
          setData((prev) => ({
            ...prev,
            milestones: prev.milestones.map((m) => (m.id === id ? { ...m, ...updates } : m))
          }));
          return true;
        }
        return false;
      } catch (err) {
        console.error('[useProjectDetail] Update milestone error:', err);
        return false;
      }
    },
    [getHeaders]
  );

  // Delete milestone
  const deleteMilestone = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`/api/milestones/${id}`, {
          method: 'DELETE',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to delete milestone: ${response.statusText}`);
        }

        setData((prev) => ({
          ...prev,
          milestones: prev.milestones.filter((m) => m.id !== id)
        }));
        return true;
      } catch (err) {
        console.error('[useProjectDetail] Delete milestone error:', err);
        return false;
      }
    },
    [getHeaders]
  );

  // Toggle milestone completion
  const toggleMilestoneComplete = useCallback(
    async (id: number): Promise<boolean> => {
      const milestone = data.milestones.find((m) => m.id === id);
      if (!milestone) return false;

      const updates = {
        is_completed: !milestone.is_completed,
        completed_date: !milestone.is_completed ? new Date().toISOString() : undefined
      };

      return updateMilestone(id, updates);
    },
    [data.milestones, updateMilestone]
  );

  // Upload file
  const uploadFile = useCallback(
    async (file: File, category?: string): Promise<boolean> => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (category) {
          formData.append('category', category);
        }

        const token = getAuthToken?.();
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/projects/${projectId}/files`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Failed to upload file: ${response.statusText}`);
        }

        const result: ApiResponse<ProjectFile> = await response.json();
        if (result.success && result.data) {
          setData((prev) => ({
            ...prev,
            files: [...prev.files, result.data!]
          }));
          return true;
        }
        return false;
      } catch (err) {
        console.error('[useProjectDetail] Upload file error:', err);
        return false;
      }
    },
    [projectId, getAuthToken]
  );

  // Delete file
  const deleteFile = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await fetch(`/api/files/${id}`, {
          method: 'DELETE',
          headers: getHeaders(),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to delete file: ${response.statusText}`);
        }

        setData((prev) => ({
          ...prev,
          files: prev.files.filter((f) => f.id !== id)
        }));
        return true;
      } catch (err) {
        console.error('[useProjectDetail] Delete file error:', err);
        return false;
      }
    },
    [getHeaders]
  );

  // Toggle file sharing
  const toggleFileSharing = useCallback(
    async (id: number): Promise<boolean> => {
      const file = data.files.find((f) => f.id === id);
      if (!file) return false;

      try {
        const response = await fetch(`/api/files/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify({ is_shared: !file.is_shared })
        });

        if (!response.ok) {
          throw new Error(`Failed to update file: ${response.statusText}`);
        }

        setData((prev) => ({
          ...prev,
          files: prev.files.map((f) => (f.id === id ? { ...f, is_shared: !f.is_shared } : f))
        }));
        return true;
      } catch (err) {
        console.error('[useProjectDetail] Toggle file sharing error:', err);
        return false;
      }
    },
    [data.files, getHeaders]
  );

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && projectId) {
      fetchAll();
    }
  }, [autoFetch, projectId, fetchAll]);

  return {
    project: data.project,
    milestones: data.milestones,
    files: data.files,
    invoices: data.invoices,
    messages: data.messages,
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
    sendMessage
  };
}
