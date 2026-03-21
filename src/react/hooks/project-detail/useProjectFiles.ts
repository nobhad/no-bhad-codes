/**
 * useProjectFiles
 * Handles file upload, delete, and sharing toggle for a project.
 */

import { useState, useCallback } from 'react';
import type { ProjectFile } from '@react/features/admin/types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPut, apiDelete, getCsrfToken, CSRF_HEADER_NAME } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import type { ProjectDetailHookOptions } from './types';

const logger = createLogger('useProjectFiles');

interface UseProjectFilesReturn {
  files: ProjectFile[];
  setFiles: React.Dispatch<React.SetStateAction<ProjectFile[]>>;
  fetchFiles: () => Promise<ProjectFile[]>;
  uploadFile: (file: File, category?: string) => Promise<boolean>;
  deleteFile: (id: number) => Promise<boolean>;
  toggleFileSharing: (id: number) => Promise<boolean>;
  updateCategory: (id: number, category: string) => Promise<boolean>;
}

export function useProjectFiles({
  projectId
}: ProjectDetailHookOptions): UseProjectFilesReturn {
  const [files, setFiles] = useState<ProjectFile[]>([]);

  const fetchFiles = useCallback(async (): Promise<ProjectFile[]> => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/files`);

      if (!response.ok) {
        return [];
      }

      const json = await response.json();
      const parsed = unwrapApiData<{ files: ProjectFile[] }>(json);
      return parsed.files || [];
    } catch (err) {
      logger.error('Error fetching files:', err);
      return [];
    }
  }, [projectId]);

  const uploadFile = useCallback(
    async (file: File, category?: string): Promise<boolean> => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (category) {
          formData.append('category', category);
        }

        // FormData uploads skip apiPost (no JSON Content-Type); manually add CSRF
        const headers: Record<string, string> = {};
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers[CSRF_HEADER_NAME] = csrfToken;
        }

        const response = await fetch(`${API_ENDPOINTS.PROJECTS}/${projectId}/files`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Failed to upload file: ${response.statusText}`);
        }

        const json = await response.json();
        const newFile = unwrapApiData<ProjectFile>(json);
        setFiles((prev) => [...prev, newFile]);
        return true;
      } catch (err) {
        logger.error('Upload file error:', err);
        return false;
      }
    },
    [projectId]
  );

  const deleteFile = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const response = await apiDelete(`${API_ENDPOINTS.FILES}/${id}`);

        if (!response.ok) {
          throw new Error(`Failed to delete file: ${response.statusText}`);
        }

        setFiles((prev) => prev.filter((f) => f.id !== id));
        return true;
      } catch (err) {
        logger.error('Delete file error:', err);
        return false;
      }
    },
    []
  );

  const toggleFileSharing = useCallback(
    async (id: number): Promise<boolean> => {
      const file = files.find((f) => f.id === id);
      if (!file) return false;

      try {
        const response = await apiPut(`${API_ENDPOINTS.FILES}/${id}`, { is_shared: !file.is_shared });

        if (!response.ok) {
          throw new Error(`Failed to update file: ${response.statusText}`);
        }

        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, is_shared: !f.is_shared } : f))
        );
        return true;
      } catch (err) {
        logger.error('Toggle file sharing error:', err);
        return false;
      }
    },
    [files]
  );

  const updateCategory = useCallback(
    async (id: number, category: string): Promise<boolean> => {
      try {
        const response = await apiPut(`${API_ENDPOINTS.FILES}/${id}`, { category });
        if (!response.ok) return false;
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, category } : f)));
        return true;
      } catch (err) {
        logger.error('Update category error:', err);
        return false;
      }
    },
    []
  );

  return {
    files,
    setFiles,
    fetchFiles,
    uploadFile,
    deleteFile,
    toggleFileSharing,
    updateCategory
  };
}
