/**
 * ===============================================
 * ADMIN SYSTEM HEALTH DASHBOARD
 * ===============================================
 * @file src/react/features/admin/system-health/SystemHealthDashboard.tsx
 *
 * Surfaces the infrastructure the resilience + audit layers expose:
 *   - Circuit breaker state per external dependency
 *   - Async task outbox health (pending / running / completed / failed
 *     / dead counts; a non-zero `dead` means ops attention needed)
 *   - On-demand audit chain verification (runs the server-side walk
 *     and reports any tamper-evidence breaks)
 *
 * Everything was already live on the server, just invisible to an
 * admin who wasn't tailing logs. This page puts it in front of them.
 */

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  CircleSlash,
  CheckCircle,
  AlertTriangle,
  ListChecks
} from 'lucide-react';
import { StatCard } from '@react/components/portal/StatCard';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { useFadeIn } from '@react/hooks/useGsap';
import {
  apiFetch,
  unwrapApiData,
  toFriendlyError
} from '@/utils/api-client';
import type {
  CircuitBreakerSnapshot,
  AsyncTasksSummary,
  AuditChainVerification,
  SchemaDriftReport
} from './types';

const ENDPOINT_BREAKERS = '/api/admin/circuit-breakers';
const ENDPOINT_ASYNC_TASKS = '/api/admin/async-tasks';
const ENDPOINT_AUDIT_VERIFY = '/api/admin/audit-chain/verify';
const ENDPOINT_SCHEMA_DRIFT = '/api/admin/schema-drift';

interface SystemHealthDashboardProps {
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function SystemHealthDashboard({ showNotification }: SystemHealthDashboardProps = {}) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const [breakers, setBreakers] = useState<CircuitBreakerSnapshot[]>([]);
  const [asyncTasks, setAsyncTasks] = useState<AsyncTasksSummary | null>(null);
  const [schemaDrift, setSchemaDrift] = useState<SchemaDriftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [auditVerifying, setAuditVerifying] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditChainVerification | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [breakersRes, tasksRes, driftRes] = await Promise.all([
        apiFetch(ENDPOINT_BREAKERS),
        apiFetch(ENDPOINT_ASYNC_TASKS),
        apiFetch(ENDPOINT_SCHEMA_DRIFT)
      ]);

      if (!breakersRes.ok) {
        throw new Error(await toFriendlyError(breakersRes, { fallback: 'Failed to load circuit breakers' }));
      }
      if (!tasksRes.ok) {
        throw new Error(await toFriendlyError(tasksRes, { fallback: 'Failed to load async tasks' }));
      }
      if (!driftRes.ok) {
        throw new Error(await toFriendlyError(driftRes, { fallback: 'Failed to load schema drift' }));
      }

      const breakersJson = await breakersRes.json();
      const tasksJson = await tasksRes.json();
      const driftJson = await driftRes.json();

      const breakerData = unwrapApiData<{ breakers: CircuitBreakerSnapshot[] }>(breakersJson);
      const tasksData = unwrapApiData<AsyncTasksSummary>(tasksJson);
      const driftData = unwrapApiData<SchemaDriftReport>(driftJson);

      setBreakers(breakerData.breakers ?? []);
      setAsyncTasks(tasksData);
      setSchemaDrift(driftData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load system health';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const verifyAuditChain = useCallback(async () => {
    setAuditVerifying(true);
    try {
      const response = await apiFetch(ENDPOINT_AUDIT_VERIFY);
      if (!response.ok) {
        throw new Error(await toFriendlyError(response, { fallback: 'Audit chain verify failed' }));
      }
      const json = await response.json();
      const result = unwrapApiData<AuditChainVerification>(json);
      setAuditResult(result);

      if (result.breaks.length > 0) {
        showNotification?.(`${result.breaks.length} tamper-evidence break(s) detected`, 'error');
      } else {
        showNotification?.(`Audit chain verified: ${result.verified} row(s) clean`, 'success');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audit chain verify failed';
      showNotification?.(message, 'error');
    } finally {
      setAuditVerifying(false);
    }
  }, [showNotification]);

  if (loading) return <LoadingState message="Loading system health..." />;
  if (error) return <ErrorState message={error} onRetry={loadHealth} />;

  const counts = asyncTasks?.counts;
  const deadCount = counts?.dead ?? 0;
  const anyBreakerOpen = breakers.some((b) => b.state !== 'closed');

  return (
    <div ref={containerRef} className="dashboard-section">
      <div className="dashboard-header">
        <div>
          <h1 className="section-title">System Health</h1>
          <p className="section-subtitle">
            Resilience layer + async outbox + audit chain state.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadHealth}
          aria-label="Refresh system health"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <section className="dashboard-group">
        <h2 className="dashboard-group-title">
          {anyBreakerOpen ? (
            <ShieldAlert className="icon-sm icon-warning" />
          ) : (
            <ShieldCheck className="icon-sm icon-success" />
          )}
          Circuit Breakers
        </h2>
        {breakers.length === 0 ? (
          <p className="text-muted">No breakers registered yet — they're created lazily on first use.</p>
        ) : (
          <div className="stats-grid">
            {breakers.map((b) => (
              <StatCard
                key={b.name}
                label={b.name}
                value={b.state.toUpperCase()}
                variant={
                  b.state === 'open'
                    ? 'alert'
                    : b.state === 'half-open'
                      ? 'warning'
                      : 'success'
                }
                meta={
                  b.state === 'open' && b.openedAt
                    ? `Opened ${new Date(b.openedAt).toLocaleTimeString()} • ${b.rejectedCount} rejected`
                    : `${b.consecutiveFailures} recent failure(s)`
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-group">
        <h2 className="dashboard-group-title">
          {deadCount > 0 ? (
            <AlertTriangle className="icon-sm icon-warning" />
          ) : (
            <ListChecks className="icon-sm icon-success" />
          )}
          Async Task Outbox
        </h2>
        {counts ? (
          <div className="stats-grid">
            <StatCard label="Pending" value={counts.pending} />
            <StatCard label="Running" value={counts.running} />
            <StatCard label="Completed" value={counts.completed} variant="success" />
            <StatCard label="Failed" value={counts.failed} variant="warning" />
            <StatCard
              label="Dead"
              value={counts.dead}
              variant={deadCount > 0 ? 'alert' : 'default'}
              meta={deadCount > 0 ? 'Exhausted retries — inspect manually' : 'All clear'}
            />
          </div>
        ) : (
          <p className="text-muted">No data.</p>
        )}
      </section>

      <section className="dashboard-group">
        <h2 className="dashboard-group-title">
          {schemaDrift && !schemaDrift.ok ? (
            <AlertTriangle className="icon-sm icon-warning" />
          ) : (
            <ShieldCheck className="icon-sm icon-success" />
          )}
          Schema Drift
        </h2>
        <p className="text-muted">
          Compares the live sqlite_master state to the snapshot
          recorded after the previous clean boot. Drift means the
          schema changed outside the migration path — a manual ALTER
          in production, a half-applied migration, or a feature-branch
          schema leak.
        </p>
        {schemaDrift ? (
          schemaDrift.firstBoot ? (
            <p className="text-muted">First boot — baseline just recorded. Drift tracking starts next restart.</p>
          ) : schemaDrift.ok ? (
            <div className="stats-grid mt-2">
              <StatCard
                label="Status"
                value="IN SYNC"
                variant="success"
                meta={`Fingerprint ${schemaDrift.currentFingerprint.slice(0, 12)}…`}
              />
            </div>
          ) : (
            <>
              <div className="stats-grid mt-2">
                <StatCard label="Added" value={schemaDrift.added.length} variant="warning" />
                <StatCard label="Removed" value={schemaDrift.removed.length} variant="alert" />
                <StatCard label="Modified" value={schemaDrift.modified.length} variant="alert" />
              </div>
              {(schemaDrift.added.length
                || schemaDrift.removed.length
                || schemaDrift.modified.length) > 0 ? (
                  <div className="dashboard-subtle mt-2">
                    <ul className="text-small">
                      {schemaDrift.added.slice(0, 10).map((o) => (
                        <li key={`a:${o.type}:${o.name}`}>+ {o.type} <strong>{o.name}</strong></li>
                      ))}
                      {schemaDrift.removed.slice(0, 10).map((o) => (
                        <li key={`r:${o.type}:${o.name}`}>− {o.type} <strong>{o.name}</strong></li>
                      ))}
                      {schemaDrift.modified.slice(0, 10).map((o) => (
                        <li key={`m:${o.type}:${o.name}`}>~ {o.type} <strong>{o.name}</strong></li>
                      ))}
                    </ul>
                  </div>
                ) : null}
            </>
          )
        ) : (
          <p className="text-muted">No data.</p>
        )}
      </section>

      <section className="dashboard-group">
        <h2 className="dashboard-group-title">
          <CheckCircle className="icon-sm" />
          Audit Chain
        </h2>
        <p className="text-muted">
          Walks every audit_logs row, recomputes its hash from current
          content, and confirms the prev_hash links are intact. A
          non-zero break count means someone or something mutated a
          historical row.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={verifyAuditChain}
          disabled={auditVerifying}
        >
          {auditVerifying ? (
            <><RefreshCw size={16} className="animate-spin" /> Verifying...</>
          ) : (
            <>Verify chain</>
          )}
        </button>

        {auditResult ? (
          <div className="stats-grid mt-2">
            <StatCard label="Rows" value={auditResult.total} />
            <StatCard label="Verified" value={auditResult.verified} variant="success" />
            <StatCard
              label="Skipped"
              value={auditResult.skipped}
              meta="Pre-chain rows; expected nonzero"
            />
            <StatCard
              label="Breaks"
              value={auditResult.breaks.length}
              variant={auditResult.breaks.length > 0 ? 'alert' : 'default'}
              meta={
                auditResult.breaks.length > 0
                  ? `First break at id ${auditResult.breaks[0].id} (${auditResult.breaks[0].kind})`
                  : 'Chain intact'
              }
            />
          </div>
        ) : null}

        {auditResult && auditResult.breaks.length > 0 ? (
          <div className="dashboard-subtle mt-2">
            <p className="text-warning">
              <CircleSlash size={14} /> First {Math.min(5, auditResult.breaks.length)} break(s):
            </p>
            <ul className="text-small">
              {auditResult.breaks.slice(0, 5).map((b) => (
                <li key={b.id}>
                  id={b.id} · {b.kind} · {new Date(b.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
