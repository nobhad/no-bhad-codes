/**
 * Project Templates feature types, constants, and helpers
 * @file src/react/features/admin/project-templates/types.ts
 */

import type { SortConfig } from '../types';

// ============================================
// CONSTANTS
// ============================================

export const PROJECT_TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'simple-site', label: 'Simple Site' },
  { value: 'business-site', label: 'Business Site' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'web-app', label: 'Web App' },
  { value: 'browser-extension', label: 'Browser Extension' }
];

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

export const TEMPLATES_FILTER_CONFIG = [
  { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
  { key: 'projectType', label: 'TYPE', options: PROJECT_TYPE_OPTIONS }
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
] as const;

// ============================================
// TYPES
// ============================================

export interface TemplateMilestone {
  name: string;
  description?: string;
  deliverables?: string;
  order: number;
  estimatedDays?: number;
}

export interface TemplateTask {
  title: string;
  description?: string;
  milestoneIndex: number;
  priority?: string;
  estimatedHours?: number;
}

export interface ProjectTemplateItem {
  id: number;
  name: string;
  description?: string;
  projectType?: string;
  defaultMilestones: TemplateMilestone[];
  defaultTasks: TemplateTask[];
  estimatedDurationDays?: number;
  defaultHourlyRate?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTemplateFormData {
  name: string;
  description: string;
  projectType: string;
  estimatedDurationDays: number | '';
  defaultHourlyRate: number | '';
  isActive: boolean;
  milestones: TemplateMilestone[];
  tasks: TemplateTask[];
}

export interface ProjectTemplatesManagerProps {
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  defaultPageSize?: number;
}

export const EMPTY_FORM: ProjectTemplateFormData = {
  name: '',
  description: '',
  projectType: '',
  estimatedDurationDays: '',
  defaultHourlyRate: '',
  isActive: true,
  milestones: [],
  tasks: []
};

// ============================================
// HELPERS
// ============================================

export function getProjectTypeLabel(type?: string): string {
  if (!type) return '--';
  const option = PROJECT_TYPE_OPTIONS.find((o) => o.value === type);
  return option?.label || type;
}

export function filterTemplate(
  template: ProjectTemplateItem,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    const matchesSearch =
      template.name.toLowerCase().includes(query) ||
      (template.description || '').toLowerCase().includes(query) ||
      (template.projectType || '').toLowerCase().includes(query);
    if (!matchesSearch) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    const activeValue = template.isActive ? 'active' : 'inactive';
    if (!statusFilter.includes(activeValue)) return false;
  }

  const typeFilter = filters.projectType;
  if (typeFilter && typeFilter.length > 0) {
    if (!template.projectType || !typeFilter.includes(template.projectType)) return false;
  }

  return true;
}

export function sortTemplates(a: ProjectTemplateItem, b: ProjectTemplateItem, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'name':
    return a.name.localeCompare(b.name) * multiplier;
  case 'projectType':
    return (a.projectType || '').localeCompare(b.projectType || '') * multiplier;
  case 'estimatedDurationDays':
    return ((a.estimatedDurationDays || 0) - (b.estimatedDurationDays || 0)) * multiplier;
  case 'defaultHourlyRate':
    return ((a.defaultHourlyRate || 0) - (b.defaultHourlyRate || 0)) * multiplier;
  case 'updatedAt':
    return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * multiplier;
  default:
    return 0;
  }
}
