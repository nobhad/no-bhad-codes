/**
 * ===============================================
 * ADMIN DATA SERVICE
 * ===============================================
 * @file src/features/admin/services/admin-data.service.ts
 *
 * Centralized data fetching and state management for admin dashboard.
 * Handles all API calls and data caching.
 */

import { apiFetch, apiPost, apiPut } from '../../../utils/api-client';
import { createLogger } from '../../../utils/logging';

const logger = createLogger('AdminDataService');

// ============================================
// Types
// ============================================

export interface Lead {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status: string;
  source?: string;
  notes?: string;
  project_name?: string;
  project_type?: string;
  description?: string;
  budget_range?: string;
  timeline?: string;
  features?: string;
  created_at: string;
  updated_at?: string;
  invited_at?: string;
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  subject?: string;
  message: string;
  status: string;
  created_at: string;
  read_at?: string;
  replied_at?: string;
}

export interface Project {
  id: number;
  name: string;
  client_id: number;
  client_name?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  description?: string;
  progress?: number;
  created_at: string;
  updated_at?: string;
}

export interface Client {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  status: string;
  created_at: string;
  project_count?: number;
}

export interface MessageThread {
  id: number;
  subject: string;
  client_id: number;
  client_name?: string;
  status: string;
  last_message_at?: string;
  unread_count: number;
}

export interface Message {
  id: number;
  thread_id: number;
  sender_type: 'client' | 'admin' | 'system';
  sender_name: string;
  message: string;
  content?: string;
  is_read: boolean;
  created_at: string;
}

export interface SidebarCounts {
  leads: number;
  messages: number;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
}

export interface ContactStats {
  total: number;
  new: number;
  read: number;
  replied: number;
  archived: number;
}

// ============================================
// Data Cache
// ============================================

class DataCache {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private ttl: number;

  constructor(ttlMs: number = 30000) {
    this.ttl = ttlMs;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

// ============================================
// Admin Data Service
// ============================================

class AdminDataService {
  private cache = new DataCache(30000); // 30 second cache

  // Stored data for detail views
  private _leadsData: Lead[] = [];
  private _contactsData: Contact[] = [];
  private _projectsData: Project[] = [];
  private _clientsData: Client[] = [];
  private _threadsData: MessageThread[] = [];

  // Getters
  get leadsData(): Lead[] { return this._leadsData; }
  get contactsData(): Contact[] { return this._contactsData; }
  get projectsData(): Project[] { return this._projectsData; }
  get clientsData(): Client[] { return this._clientsData; }
  get threadsData(): MessageThread[] { return this._threadsData; }

  // ----------------------------------------
  // Leads
  // ----------------------------------------

  async fetchLeads(): Promise<{ leads: Lead[]; stats: LeadStats }> {
    const cached = this.cache.get<{ leads: Lead[]; stats: LeadStats }>('leads');
    if (cached) return cached;

    try {
      const response = await apiFetch('/api/admin/leads');
      if (!response.ok) throw new Error('Failed to fetch leads');

      const data = await response.json();
      this._leadsData = data.leads || [];
      this.cache.set('leads', data);
      return data;
    } catch (error) {
      logger.error('Failed to fetch leads', { error });
      throw error;
    }
  }

  async updateLeadStatus(id: number, status: string): Promise<boolean> {
    try {
      const response = await apiPut(`/api/admin/leads/${id}/status`, { status });
      if (response.ok) {
        this.cache.invalidate('leads');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to update lead status', { error, id, status });
      return false;
    }
  }

  async inviteLead(leadId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiPost(`/api/admin/leads/${leadId}/invite`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.cache.invalidate('leads');
          this.cache.invalidate('projects');
          return { success: true };
        }
        return { success: false, error: data.error || 'Failed to send invitation' };
      }

      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to send invitation' };
    } catch (error) {
      logger.error('Failed to invite lead', { error, leadId });
      return { success: false, error: 'An error occurred' };
    }
  }

  getLeadById(id: number): Lead | undefined {
    return this._leadsData.find(l => l.id === id);
  }

  // ----------------------------------------
  // Contacts
  // ----------------------------------------

  async fetchContacts(): Promise<{ submissions: Contact[]; stats: ContactStats }> {
    const cached = this.cache.get<{ submissions: Contact[]; stats: ContactStats }>('contacts');
    if (cached) return cached;

    try {
      const response = await apiFetch('/api/admin/contact-submissions');
      if (!response.ok) throw new Error('Failed to fetch contacts');

      const data = await response.json();
      this._contactsData = data.submissions || [];
      this.cache.set('contacts', data);
      return data;
    } catch (error) {
      logger.error('Failed to fetch contacts', { error });
      throw error;
    }
  }

  async updateContactStatus(id: number, status: string): Promise<boolean> {
    try {
      const response = await apiPut(`/api/admin/contact-submissions/${id}/status`, { status });
      if (response.ok) {
        this.cache.invalidate('contacts');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to update contact status', { error, id, status });
      return false;
    }
  }

  getContactById(id: number): Contact | undefined {
    return this._contactsData.find(c => c.id === id);
  }

  // ----------------------------------------
  // Projects
  // ----------------------------------------

  async fetchProjects(): Promise<{ projects: Project[]; stats: unknown }> {
    const cached = this.cache.get<{ projects: Project[]; stats: unknown }>('projects');
    if (cached) return cached;

    try {
      const response = await apiFetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');

      const data = await response.json();
      this._projectsData = data.projects || [];
      this.cache.set('projects', data);
      return data;
    } catch (error) {
      logger.error('Failed to fetch projects', { error });
      throw error;
    }
  }

  async updateProjectStatus(id: number, status: string): Promise<boolean> {
    try {
      const response = await apiPut(`/api/projects/${id}`, { status });
      if (response.ok) {
        this.cache.invalidate('projects');
        this.cache.invalidate('leads');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to update project status', { error, id, status });
      return false;
    }
  }

  getProjectById(id: number): Project | undefined {
    return this._projectsData.find(p => p.id === id);
  }

  // ----------------------------------------
  // Clients
  // ----------------------------------------

  async fetchClients(): Promise<{ clients: Client[]; stats: unknown }> {
    const cached = this.cache.get<{ clients: Client[]; stats: unknown }>('clients');
    if (cached) return cached;

    try {
      const response = await apiFetch('/api/admin/clients');
      if (!response.ok) throw new Error('Failed to fetch clients');

      const data = await response.json();
      this._clientsData = data.clients || [];
      this.cache.set('clients', data);
      return data;
    } catch (error) {
      logger.error('Failed to fetch clients', { error });
      throw error;
    }
  }

  getClientById(id: number): Client | undefined {
    return this._clientsData.find(c => c.id === id);
  }

  // ----------------------------------------
  // Messages
  // ----------------------------------------

  async fetchThreads(): Promise<MessageThread[]> {
    try {
      const response = await apiFetch('/api/messages/threads');
      if (!response.ok) throw new Error('Failed to fetch threads');

      const data = await response.json();
      this._threadsData = data.threads || [];
      return this._threadsData;
    } catch (error) {
      logger.error('Failed to fetch threads', { error });
      throw error;
    }
  }

  async fetchMessages(threadId: number): Promise<Message[]> {
    try {
      const response = await apiFetch(`/api/messages/threads/${threadId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      logger.error('Failed to fetch messages', { error, threadId });
      throw error;
    }
  }

  async sendMessage(threadId: number, message: string): Promise<boolean> {
    try {
      const response = await apiPost(`/api/messages/threads/${threadId}/messages`, { message });
      return response.ok;
    } catch (error) {
      logger.error('Failed to send message', { error, threadId });
      return false;
    }
  }

  async markThreadRead(threadId: number): Promise<void> {
    try {
      await apiPut(`/api/messages/threads/${threadId}/read`);
    } catch (error) {
      logger.error('Failed to mark thread read', { error, threadId });
    }
  }

  getThreadById(id: number): MessageThread | undefined {
    return this._threadsData.find(t => t.id === id);
  }

  // ----------------------------------------
  // Sidebar Counts
  // ----------------------------------------

  async fetchSidebarCounts(): Promise<SidebarCounts> {
    try {
      const response = await apiFetch('/api/admin/sidebar-counts');
      if (!response.ok) return { leads: 0, messages: 0 };

      const data = await response.json();
      return {
        leads: data.leads || 0,
        messages: data.messages || 0
      };
    } catch (error) {
      logger.error('Failed to fetch sidebar counts', { error });
      return { leads: 0, messages: 0 };
    }
  }

  // ----------------------------------------
  // Cache Management
  // ----------------------------------------

  invalidateCache(key?: string): void {
    if (key) {
      this.cache.invalidate(key);
    } else {
      this.cache.invalidateAll();
    }
  }

  refreshAll(): void {
    this.cache.invalidateAll();
  }
}

// Singleton instance
export const adminDataService = new AdminDataService();
export default adminDataService;
