/**
 * Inline editing utilities for project detail fields
 * @file src/features/admin/project-details/inline-editing.ts
 */

import { formatDate, formatCurrency } from '../../../utils/format-utils';
import { apiPut } from '../../../utils/api-client';
import { makeEditable } from '../../../components/inline-edit';
import { showToast } from '../../../utils/toast-notifications';
import { domCache } from './dom-cache';
import type { ProjectResponse } from '../../../types/api';

/**
 * Set up inline editing for all overview fields
 */
export function setupInlineEditing(
  project: ProjectResponse,
  projectsData: ProjectResponse[],
  populateProjectDetailView: (project: ProjectResponse) => void,
  showTypeDropdownFn: (element: HTMLElement, project: ProjectResponse, projectId: number) => void,
  showStatusDropdownFn: (element: HTMLElement, project: ProjectResponse, projectId: number) => void,
  showTextareaEditFn: (element: HTMLElement, currentValue: string, onSave: (value: string) => Promise<void>) => void
): void {
  const projectId = project.id;

  const saveField = async (
    field: string,
    value: string,
    element: HTMLElement,
    displayFn?: (v: string) => string
  ) => {
    try {
      const res = await apiPut(`/api/projects/${projectId}`, { [field]: value || null });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();

      if (projectsData) {
        const idx = projectsData.findIndex((p) => p.id === projectId);
        if (idx !== -1) {
          projectsData[idx] = { ...projectsData[idx], ...data.project };
        }
      }

      element.textContent = displayFn ? displayFn(value) : value || '-';
      showToast('Saved', 'success');
    } catch {
      showToast('Failed to save', 'error');
      throw new Error('Save failed');
    }
  };

  // Project Name
  const projectName = document.getElementById('pd-project-name');
  if (projectName) {
    makeEditable(
      projectName,
      () => project.project_name || '',
      async (newValue) => {
        await saveField('project_name', newValue, projectName);
        const detailTitle = domCache.get('detailTitle');
        if (detailTitle) detailTitle.textContent = newValue || 'Untitled Project';
      },
      { required: true, placeholder: 'Project name' }
    );
  }

  // Project Type (dropdown)
  const projectType = document.getElementById('pd-type');
  if (projectType) {
    projectType.addEventListener('click', () => {
      if (projectType.classList.contains('is-editing')) return;
      showTypeDropdownFn(projectType, project, projectId);
    });
  }

  // Status (dropdown)
  const statusBadge = document.getElementById('pd-status');
  if (statusBadge) {
    statusBadge.addEventListener('click', () => {
      if (statusBadge.classList.contains('is-editing')) return;
      showStatusDropdownFn(statusBadge, project, projectId);
    });
  }

  // Start Date
  const startDate = document.getElementById('pd-start-date');
  if (startDate) {
    makeEditable(
      startDate,
      () => (project.start_date ? project.start_date.split('T')[0] : ''),
      async (newValue) => {
        await saveField('start_date', newValue, startDate, (v) => (v ? formatDate(v) : '-'));
      },
      { type: 'date' }
    );
  }

  // End Date
  const endDate = document.getElementById('pd-end-date');
  if (endDate) {
    makeEditable(
      endDate,
      () => (project.estimated_end_date ? project.estimated_end_date.split('T')[0] : ''),
      async (newValue) => {
        await saveField('estimated_end_date', newValue, endDate, (v) =>
          v ? formatDate(v) : '-'
        );
      },
      { type: 'date' }
    );
  }

  // Budget
  const budget = document.getElementById('pd-budget');
  if (budget) {
    makeEditable(
      budget,
      () => project.budget_range || (project.budget ? String(project.budget) : ''),
      async (newValue) => {
        await saveField('budget_range', newValue, budget);
      },
      { placeholder: 'Budget range' }
    );
  }

  // Timeline
  const timeline = document.getElementById('pd-timeline');
  if (timeline) {
    makeEditable(
      timeline,
      () => project.timeline || '',
      async (newValue) => {
        await saveField('timeline', newValue, timeline);
      },
      { placeholder: 'e.g., 4-6 weeks' }
    );
  }

  // Price
  const price = document.getElementById('pd-price');
  if (price) {
    makeEditable(
      price,
      () => (project.price ? String(project.price) : ''),
      async (newValue) => {
        const numValue = parseFloat(newValue.replace(/[,$]/g, '')) || 0;
        await saveField('price', String(numValue), price, (v) =>
          v ? formatCurrency(parseFloat(v)) : '-'
        );
      },
      { placeholder: 'Quoted price' }
    );
  }

  // Deposit
  const deposit = document.getElementById('pd-deposit');
  if (deposit) {
    makeEditable(
      deposit,
      () => (project.deposit_amount ? String(project.deposit_amount) : ''),
      async (newValue) => {
        const numValue = parseFloat(newValue.replace(/[,$]/g, '')) || 0;
        await saveField('deposit_amount', String(numValue), deposit, (v) =>
          v ? formatCurrency(parseFloat(v)) : '-'
        );
      },
      { placeholder: 'Deposit amount' }
    );
  }

  // Description (textarea)
  const description = document.getElementById('pd-description');
  if (description) {
    description.addEventListener('click', () => {
      if (description.classList.contains('is-editing')) return;
      showTextareaEditFn(description, project.description || '', async (newValue) => {
        await saveField('description', newValue, description);
      });
    });
  }

  // Admin Notes (textarea)
  const adminNotes = document.getElementById('pd-admin-notes');
  if (adminNotes) {
    adminNotes.addEventListener('click', () => {
      if (adminNotes.classList.contains('is-editing')) return;
      showTextareaEditFn(adminNotes, project.notes || '', async (newValue) => {
        await saveField('notes', newValue, adminNotes, (v) => v || 'Click to add notes...');
      });
    });
  }
}

/**
 * Show dropdown for project type selection
 */
export function showTypeDropdown(
  element: HTMLElement,
  project: ProjectResponse,
  projectId: number,
  showSelectDropdownFn: (
    element: HTMLElement,
    options: string[],
    currentValue: string,
    labels: Record<string, string>,
    onSave: (value: string) => Promise<void>
  ) => void
): void {
  const types = [
    'simple_site',
    'business',
    'portfolio',
    'ecommerce',
    'web_app',
    'extension',
    'other'
  ];
  const labels: Record<string, string> = {
    simple_site: 'Simple Website',
    business: 'Business Website',
    portfolio: 'Portfolio',
    ecommerce: 'E-Commerce',
    web_app: 'Web Application',
    extension: 'Browser Extension',
    other: 'Other'
  };

  showSelectDropdownFn(
    element,
    types,
    project.project_type || '',
    labels,
    async (newValue) => {
      try {
        const res = await apiPut(`/api/projects/${projectId}`, { project_type: newValue });
        if (!res.ok) throw new Error('Failed to save');
        element.textContent = labels[newValue] || newValue || '-';
        showToast('Saved', 'success');
      } catch {
        showToast('Failed to save', 'error');
      }
    }
  );
}

/**
 * Show dropdown for status selection
 */
export function showStatusDropdown(
  element: HTMLElement,
  project: ProjectResponse,
  projectId: number,
  showSelectDropdownFn: (
    element: HTMLElement,
    options: string[],
    currentValue: string,
    labels: Record<string, string>,
    onSave: (value: string) => Promise<void>
  ) => void
): void {
  const statuses = ['pending', 'active', 'on_hold', 'completed', 'archived'];
  const labels: Record<string, string> = {
    pending: 'Pending',
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    archived: 'Archived'
  };

  showSelectDropdownFn(element, statuses, project.status || '', labels, async (newValue) => {
    try {
      const res = await apiPut(`/api/projects/${projectId}`, { status: newValue });
      if (!res.ok) throw new Error('Failed to save');
      element.textContent = labels[newValue] || newValue || '-';
      element.className = `status-badge inline-editable status-${newValue}`;
      showToast('Saved', 'success');
    } catch {
      showToast('Failed to save', 'error');
    }
  });
}

/**
 * Show select dropdown for inline editing
 */
export function showSelectDropdown(
  element: HTMLElement,
  options: string[],
  currentValue: string,
  labels: Record<string, string>,
  onSave: (value: string) => Promise<void>
): void {
  element.classList.add('is-editing');

  const select = document.createElement('select');
  select.className = 'inline-edit-select form-select';
  select.style.cssText = `
    padding: 4px 8px;
    border: 1px solid var(--color-primary);
    border-radius: 4px;
    background: var(--portal-bg-darker);
    color: var(--portal-text-light);
    font-size: inherit;
    outline: none;
    cursor: pointer;
    min-width: 120px;
  `;

  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = labels[opt] || opt;
    if (opt === currentValue) option.selected = true;
    select.appendChild(option);
  });

  const originalContent = element.innerHTML;
  element.innerHTML = '';
  element.appendChild(select);
  select.focus();

  const cleanup = () => {
    element.classList.remove('is-editing');
    element.innerHTML = originalContent;
  };

  select.addEventListener('change', async () => {
    const newValue = select.value;
    cleanup();
    await onSave(newValue);
  });

  select.addEventListener('blur', () => {
    setTimeout(() => {
      if (element.contains(select)) {
        cleanup();
      }
    }, 100);
  });

  select.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  });
}

/**
 * Show textarea for inline editing
 */
export function showTextareaEdit(
  element: HTMLElement,
  currentValue: string,
  onSave: (value: string) => Promise<void>
): void {
  element.classList.add('is-editing');

  const textarea = document.createElement('textarea');
  textarea.className = 'inline-edit-textarea form-textarea';
  textarea.value = currentValue;
  textarea.style.cssText = `
    width: 100%;
    min-height: 80px;
    padding: 8px;
    border: 1px solid var(--color-primary);
    border-radius: 4px;
    background: var(--portal-bg-darker);
    color: var(--portal-text-light);
    font-size: inherit;
    font-family: inherit;
    outline: none;
    resize: vertical;
  `;

  const originalContent = element.innerHTML;
  element.innerHTML = '';
  element.appendChild(textarea);
  textarea.focus();

  const cleanup = () => {
    element.classList.remove('is-editing');
    element.innerHTML = originalContent;
  };

  const save = async () => {
    const newValue = textarea.value.trim();
    element.classList.remove('is-editing');
    element.textContent = newValue || 'Click to add...';
    await onSave(newValue);
  };

  textarea.addEventListener('blur', () => {
    setTimeout(() => {
      if (element.contains(textarea)) {
        save();
      }
    }, 100);
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
    // Ctrl/Cmd + Enter to save
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  });
}
