/**
 * Integrations feature types, constants, and helpers
 * @file src/react/features/admin/integrations/types.ts
 */

import * as React from 'react';
import {
  CreditCard,
  Calendar,
  MessageSquare,
  Zap
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface IntegrationStatus {
  name: string;
  configured: boolean;
  active: boolean;
  lastActivity: string | null;
}

export interface NotificationConfig {
  id: number;
  name: string;
  channel: string;
  event: string;
  enabled: boolean;
  createdAt: string;
}

export interface StripeStatus {
  connected: boolean;
  accountId: string | null;
  mode: 'live' | 'test' | null;
  lastCharge: string | null;
}

export interface CalendarStatus {
  connected: boolean;
  provider: string | null;
  syncEnabled: boolean;
  lastSync: string | null;
}

export interface NotificationFormData {
  name: string;
  channel: string;
  event: string;
  enabled: boolean;
}

export interface IntegrationsManagerProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================
// CONSTANTS
// ============================================

export const EMPTY_NOTIFICATION_FORM: NotificationFormData = {
  name: '',
  channel: 'email',
  event: '',
  enabled: true
};

export const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack' },
  { value: 'discord', label: 'Discord' },
  { value: 'webhook', label: 'Webhook' }
];

export const EVENT_OPTIONS = [
  { value: 'invoice.paid', label: 'Invoice Paid' },
  { value: 'invoice.overdue', label: 'Invoice Overdue' },
  { value: 'client.created', label: 'Client Created' },
  { value: 'project.completed', label: 'Project Completed' },
  { value: 'contract.signed', label: 'Contract Signed' },
  { value: 'proposal.accepted', label: 'Proposal Accepted' }
];

export const SERVICE_ICONS: Record<string, React.ReactNode> = {
  Stripe: React.createElement(CreditCard, { className: 'icon-lg' }),
  'Google Calendar': React.createElement(Calendar, { className: 'icon-lg' }),
  Slack: React.createElement(MessageSquare, { className: 'icon-lg' }),
  Discord: React.createElement(MessageSquare, { className: 'icon-lg' }),
  Zapier: React.createElement(Zap, { className: 'icon-lg' })
};

// ============================================
// HELPERS
// ============================================

export function getIntegrationHealthClass(configured: boolean, active: boolean): string {
  if (configured && active) return 'health-indicator health-ok';
  if (configured && !active) return 'health-indicator health-warning';
  return 'health-indicator health-error';
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
