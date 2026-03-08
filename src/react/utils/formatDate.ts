/**
 * Date formatting utilities - re-exports from canonical source
 * @see src/utils/format-utils.ts for implementations
 *
 * This file exists as a convenience re-export for React components.
 * All implementations live in format-utils.ts (single source of truth).
 */

export {
  formatDate,
  formatDateTime,
  formatDateForInput,
  formatRelativeTime,
  formatDateShort,
  formatDateISO,
  formatDateRelative
} from '../../utils/format-utils';
