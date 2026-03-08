/**
 * Shared types for client detail sub-hooks
 */

import type {
  Client,
  ClientHealth,
  ClientContact,
  ClientActivity,
  ClientNote,
  ClientDetailStats,
  ClientProject,
  ClientTag
} from '@react/features/admin/types';

/**
 * Common options passed to every client-detail sub-hook
 */
export interface ClientDetailHookOptions {
  clientId: number;
  getAuthToken?: () => string | null;
}

/**
 * Aggregate data shape used by the orchestrator
 */
export interface ClientDetailData {
  client: Client | null;
  health: ClientHealth | null;
  contacts: ClientContact[];
  activities: ClientActivity[];
  notes: ClientNote[];
  stats: ClientDetailStats | null;
  projects: ClientProject[];
  tags: ClientTag[];
  availableTags: ClientTag[];
}

/**
 * Full return type of the useClientDetail orchestrator hook
 */
export interface UseClientDetailReturn {
  /** Client data */
  client: Client | null;
  /** Client health score */
  health: ClientHealth | null;
  /** Client contacts */
  contacts: ClientContact[];
  /** Client activities */
  activities: ClientActivity[];
  /** Client notes */
  notes: ClientNote[];
  /** Client statistics */
  stats: ClientDetailStats | null;
  /** Client projects */
  projects: ClientProject[];
  /** Client tags */
  tags: ClientTag[];
  /** Available tags for selection */
  availableTags: ClientTag[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refetch all data */
  refetch: () => Promise<void>;
  /** Update client */
  updateClient: (updates: Partial<Client>) => Promise<boolean>;
  /** Add contact */
  addContact: (contact: Omit<ClientContact, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  /** Update contact */
  updateContact: (id: number, updates: Partial<ClientContact>) => Promise<boolean>;
  /** Delete contact */
  deleteContact: (id: number) => Promise<boolean>;
  /** Add note */
  addNote: (content: string) => Promise<boolean>;
  /** Update note */
  updateNote: (id: number, updates: Partial<ClientNote>) => Promise<boolean>;
  /** Delete note */
  deleteNote: (id: number) => Promise<boolean>;
  /** Toggle note pinned status */
  toggleNotePin: (id: number) => Promise<boolean>;
  /** Add tag to client */
  addTag: (tagId: number) => Promise<boolean>;
  /** Remove tag from client */
  removeTag: (tagId: number) => Promise<boolean>;
  /** Send client invitation */
  sendInvitation: () => Promise<boolean>;
}

/**
 * Options for the orchestrator hook
 */
export interface UseClientDetailOptions {
  /** Client ID to fetch */
  clientId: number;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Whether to fetch immediately on mount */
  autoFetch?: boolean;
}
