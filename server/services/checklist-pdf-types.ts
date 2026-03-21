/**
 * ===============================================
 * CHECKLIST PDF TYPES
 * ===============================================
 * @file server/services/checklist-pdf-types.ts
 *
 * Types for the client checklist/to-do PDF generator.
 * Supports auto-generation from DB, markdown, and JSON input.
 */

// ============================================
// Checklist Item
// ============================================

export interface ChecklistItem {
  /** Display label */
  label: string;
  /** Optional description/details */
  description?: string;
  /** Whether this item is completed */
  completed: boolean;
  /** Due date (ISO string or display string) */
  dueDate?: string;
  /** Priority: urgent, high, normal, low */
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  /** Whether this item is required vs optional */
  required?: boolean;
}

// ============================================
// Checklist Section (group of items)
// ============================================

export interface ChecklistSection {
  /** Section heading */
  title: string;
  /** Items in this section */
  items: ChecklistItem[];
}

// ============================================
// Full Checklist Data
// ============================================

export interface ChecklistPdfData {
  /** Client name (displayed in header) */
  clientName: string;
  /** Client company */
  clientCompany?: string;
  /** Project name */
  projectName?: string;
  /** Date the checklist was generated */
  generatedDate: string;
  /** Optional note at the top */
  introText?: string;
  /** Grouped sections of checklist items */
  sections: ChecklistSection[];
}

// ============================================
// JSON Template Format
// ============================================

export interface ChecklistTemplate {
  /** Template name for identification */
  name: string;
  /** Default intro text */
  introText?: string;
  /** Section definitions with placeholder items */
  sections: Array<{
    title: string;
    items: Array<{
      label: string;
      description?: string;
      required?: boolean;
      priority?: 'urgent' | 'high' | 'normal' | 'low';
    }>;
  }>;
}

// ============================================
// Built-in Templates
// ============================================

export const CHECKLIST_TEMPLATES: Record<string, ChecklistTemplate> = {
  website: {
    name: 'Website Project Checklist',
    introText: 'Here is a summary of outstanding items we need from you to keep your project on track. Please complete these at your earliest convenience.',
    sections: [
      {
        title: 'Content & Copy',
        items: [
          { label: 'Written bios / About page content', required: true, priority: 'high' },
          { label: 'Service/offering descriptions', required: true, priority: 'high' },
          { label: 'Contact information to display', required: true },
          { label: 'Testimonials or reviews (if available)', required: false },
          { label: 'Blog posts or articles (if applicable)', required: false }
        ]
      },
      {
        title: 'Visual Assets',
        items: [
          { label: 'Logo files (SVG, PNG, or high-res)', required: true, priority: 'high' },
          { label: 'Brand colors and fonts (if established)', required: false },
          { label: 'Photos (team, products, workspace, etc.)', required: true, priority: 'high' },
          { label: 'Any existing brand guidelines', required: false }
        ]
      },
      {
        title: 'Access & Accounts',
        items: [
          { label: 'Domain registrar login or transfer authorization', required: true, priority: 'urgent' },
          { label: 'Current hosting access (if migrating)', required: false },
          { label: 'Google Search Console / Analytics access', required: false },
          { label: 'Social media links', required: false }
        ]
      },
      {
        title: 'Administrative',
        items: [
          { label: 'Signed contract returned', required: true, priority: 'urgent' },
          { label: 'First payment received', required: true, priority: 'urgent' },
          { label: 'Completed project questionnaire', required: true, priority: 'high' },
          { label: 'W-9 form (if required)', required: false }
        ]
      }
    ]
  },
  maintenance: {
    name: 'Maintenance Plan Checklist',
    introText: 'Items needed to get your maintenance plan started.',
    sections: [
      {
        title: 'Access',
        items: [
          { label: 'Hosting credentials or contributor access', required: true, priority: 'high' },
          { label: 'Domain registrar access', required: true },
          { label: 'Analytics access', required: false }
        ]
      },
      {
        title: 'Administrative',
        items: [
          { label: 'Signed maintenance agreement', required: true, priority: 'urgent' },
          { label: 'Payment method on file', required: true, priority: 'high' }
        ]
      }
    ]
  },
  general: {
    name: 'General Project Checklist',
    introText: 'Here are the items we still need from you. Please review and complete at your earliest convenience.',
    sections: [
      {
        title: 'Outstanding Items',
        items: []
      }
    ]
  }
};
