/**
 * Card Formatters Utility
 * Shared formatting functions for card components (AdHocRequestCard, ApprovalCard, DocumentRequestCard)
 * Provides consistent formatting for dates, currency, file sizes, and due date calculations
 */

/**
 * Format ISO date string to readable format (e.g., "Feb 27, 2026")
 * @param dateString - ISO date string to format
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format number as US currency (e.g., "$1,234.56")
 * @param amount - Number to format as currency
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Format bytes to human readable file size (e.g., "1.5 MB")
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if a due date is in the past (overdue)
 * @param dueDate - ISO date string or undefined
 * @returns true if the date is in the past, false otherwise
 */
export function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

/**
 * Get the number of days until a due date
 * @param dueDate - ISO date string or undefined
 * @returns Number of days until due (negative if overdue), or null if no due date
 */
export function getDaysUntilDue(dueDate: string | undefined): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get human readable text for days until due date
 * @param dueDate - ISO date string or undefined
 * @returns Human readable string like "3 days left", "2 days overdue", "Due today", etc.
 */
export function getDueDaysText(dueDate: string | undefined): string {
  if (!dueDate) return '';

  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  }
  if (diffDays === 0) {
    return 'Due today';
  }
  if (diffDays === 1) {
    return 'Due tomorrow';
  }
  return `Due in ${diffDays} days`;
}
