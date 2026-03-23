/**
 * ===============================================
 * STATUS ICON
 * ===============================================
 * @file src/react/components/portal/StatusIcon.tsx
 *
 * Shared component that maps status strings to Lucide icons.
 * Eliminates duplicate getStatusIcon() functions across portal.
 */

import * as React from 'react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Circle,
  XCircle,
  Eye,
  Send,
  FileText
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface StatusIconProps {
  /** Status string to map to an icon */
  status: string;
  /** CSS class name for sizing (default: icon-xs) */
  className?: string;
}

// ============================================
// ICON MAP
// ============================================

const ICON_MAP: Record<string, React.ReactNode> = {
  // Completion states
  completed: <CheckCircle />,
  complete: <CheckCircle />,
  done: <CheckCircle />,
  accepted: <CheckCircle />,
  approved: <CheckCircle />,
  signed: <CheckCircle />,
  paid: <CheckCircle />,

  // In-progress states
  in_progress: <Clock />,
  active: <Clock />,
  pending: <Clock />,
  processing: <Loader2 />,

  // Viewing states
  viewed: <Eye />,
  sent: <Send />,

  // Warning/error states
  revision_needed: <AlertCircle />,
  rejected: <XCircle />,
  overdue: <AlertCircle />,
  failed: <XCircle />,
  cancelled: <XCircle />,
  expired: <XCircle />,

  // Neutral states
  draft: <FileText />,
  new: <Circle />,
  not_started: <Circle />
};

const DEFAULT_ICON = <Clock />;

// ============================================
// COMPONENT
// ============================================

export function StatusIcon({ status, className = 'icon-xs' }: StatusIconProps) {
  const icon = ICON_MAP[status.toLowerCase()] || DEFAULT_ICON;
  return (
    <span className={className}>
      {icon}
    </span>
  );
}
