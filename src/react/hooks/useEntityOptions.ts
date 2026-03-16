/**
 * useEntityOptions
 * Fetches client and project lists for dropdown options in create modals.
 * Caches results per session to avoid redundant API calls.
 */

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/utils/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { ModalDropdownOption } from '@react/components/portal/ModalDropdown';

interface EntityOptionsResult {
  clientOptions: ModalDropdownOption[];
  projectOptions: ModalDropdownOption[];
  isLoading: boolean;
}

// Session-level cache so multiple tables don't refetch
let cachedClients: ModalDropdownOption[] | null = null;
let cachedProjects: ModalDropdownOption[] | null = null;

export function useEntityOptions(enabled = true): EntityOptionsResult {
  const [clientOptions, setClientOptions] = useState<ModalDropdownOption[]>(cachedClients || []);
  const [projectOptions, setProjectOptions] = useState<ModalDropdownOption[]>(cachedProjects || []);
  const [isLoading, setIsLoading] = useState(!cachedClients || !cachedProjects);
  const fetched = useRef(false);

  useEffect(() => {
    if (!enabled || fetched.current || (cachedClients && cachedProjects)) {
      setIsLoading(false);
      return;
    }
    fetched.current = true;

    async function load() {
      try {
        const [clientsRes, projectsRes] = await Promise.all([
          apiFetch(API_ENDPOINTS.ADMIN.CLIENTS),
          apiFetch(API_ENDPOINTS.ADMIN.PROJECTS)
        ]);

        if (clientsRes.ok) {
          const json = await clientsRes.json();
          const clients = (json.data?.clients || json.clients || []) as Array<{ id: number; company_name?: string; contact_name?: string; email?: string }>;
          const opts = clients.map((c) => ({
            value: String(c.id),
            label: c.company_name || c.contact_name || c.email || `Client #${c.id}`
          }));
          cachedClients = opts;
          setClientOptions(opts);
        }

        if (projectsRes.ok) {
          const json = await projectsRes.json();
          const projects = (json.data?.projects || json.projects || []) as Array<{ id: number; name?: string; project_name?: string }>;
          const opts = projects.map((p) => ({
            value: String(p.id),
            label: p.name || p.project_name || `Project #${p.id}`
          }));
          cachedProjects = opts;
          setProjectOptions(opts);
        }
      } catch {
        // Silently fail — dropdowns will be empty
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [enabled]);

  return { clientOptions, projectOptions, isLoading };
}
