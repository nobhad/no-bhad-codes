/**
 * Types mirroring the shapes served by the server-side admin health
 * endpoints. Kept here (not in a shared types module) because only
 * this feature consumes them and they track server changes 1:1.
 */

export interface CircuitBreakerSnapshot {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  consecutiveFailures: number;
  openedAt: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  rejectedCount: number;
}

export interface AsyncTaskStatusCounts {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  dead: number;
}

export interface AsyncTaskListItem {
  id: number;
  task_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  created_at: string;
  completed_at: string | null;
}

export interface AsyncTasksSummary {
  counts: AsyncTaskStatusCounts;
  tasks: AsyncTaskListItem[];
}

export interface AuditChainBreak {
  id: number;
  kind: 'prev_hash_mismatch' | 'hash_mismatch' | 'missing_hash';
  expected?: string;
  actual?: string;
  createdAt: string;
}

export interface AuditChainVerification {
  total: number;
  verified: number;
  skipped: number;
  breaks: AuditChainBreak[];
}
