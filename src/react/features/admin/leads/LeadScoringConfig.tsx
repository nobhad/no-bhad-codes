/**
 * LeadScoringConfig
 * Admin UI for managing lead scoring rules.
 * Lists all rules with toggle, edit, delete actions.
 * Opens a modal form for create/edit.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Inbox
} from 'lucide-react';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { TableLayout } from '@react/components/portal/TableLayout';
import { StatusBadge } from '@react/components/portal/StatusBadge';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { IconButton } from '@react/factories';
import { useFadeIn } from '@react/hooks/useGsap';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPost, apiPut, apiDelete } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import { showToast } from '@/utils/toast-notifications';
import { LeadScoringRuleForm, type ScoringRule, type ScoringRuleFormData } from './LeadScoringRuleForm';

const logger = createLogger('LeadScoringConfig');

// ============================================
// CONSTANTS
// ============================================

const FIELD_LABELS: Record<string, string> = {
  budget_range: 'Budget Range',
  project_type: 'Project Type',
  description: 'Description',
  priority: 'Priority',
  client_type: 'Client Type',
  timeline: 'Timeline'
};

const OPERATOR_LABELS: Record<string, string> = {
  equals: 'Equals',
  contains: 'Contains',
  greater_than: 'Greater Than',
  less_than: 'Less Than',
  in: 'In',
  not_empty: 'Not Empty'
};

// ============================================
// COMPONENT
// ============================================

export function LeadScoringConfig() {
  const containerRef = useFadeIn<HTMLDivElement>();

  // State
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const deleteDialog = useConfirmDialog();
  const [ruleToDelete, setRuleToDelete] = useState<ScoringRule | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `${API_ENDPOINTS.ADMIN.LEADS_SCORING_RULES}?includeInactive=true`
      );
      if (response.ok) {
        const data = unwrapApiData<{ rules: ScoringRule[] }>(await response.json());
        setRules(data.rules || []);
      } else {
        setError('Failed to load scoring rules');
      }
    } catch (err) {
      logger.error('Failed to fetch scoring rules:', err);
      setError('Failed to load scoring rules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleCreate = useCallback(() => {
    setEditingRule(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((rule: ScoringRule) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback((rule: ScoringRule) => {
    setRuleToDelete(rule);
    deleteDialog.open();
  }, [deleteDialog]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!ruleToDelete) return;
    try {
      const response = await apiDelete(buildEndpoint.adminScoringRule(ruleToDelete.id));
      if (response.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id));
        showToast('Scoring rule deleted', 'success');
      } else {
        showToast('Failed to delete rule', 'error');
      }
    } catch (err) {
      logger.error('Failed to delete scoring rule:', err);
      showToast('Failed to delete rule', 'error');
    }
    setRuleToDelete(null);
  }, [ruleToDelete]);

  const handleToggleActive = useCallback(async (rule: ScoringRule) => {
    const newActive = !rule.isActive;
    try {
      const response = await apiPut(buildEndpoint.adminScoringRule(rule.id), {
        isActive: newActive
      });
      if (response.ok) {
        setRules((prev) =>
          prev.map((r) => r.id === rule.id ? { ...r, isActive: newActive } : r)
        );
        showToast(
          `Rule "${rule.name}" ${newActive ? 'activated' : 'deactivated'}`,
          'success'
        );
      }
    } catch (err) {
      logger.error('Failed to toggle rule:', err);
      showToast('Failed to update rule', 'error');
    }
  }, []);

  const handleSave = useCallback(async (data: ScoringRuleFormData) => {
    setIsSaving(true);
    try {
      if (editingRule) {
        // Update existing
        const response = await apiPut(buildEndpoint.adminScoringRule(editingRule.id), data);
        if (response.ok) {
          const result = unwrapApiData<{ rule: ScoringRule }>(await response.json());
          setRules((prev) =>
            prev.map((r) => r.id === editingRule.id ? result.rule : r)
          );
          showToast('Scoring rule updated', 'success');
          setIsFormOpen(false);
        } else {
          showToast('Failed to update rule', 'error');
        }
      } else {
        // Create new
        const response = await apiPost(API_ENDPOINTS.ADMIN.LEADS_SCORING_RULES, data);
        if (response.ok) {
          const result = unwrapApiData<{ rule: ScoringRule }>(await response.json());
          setRules((prev) => [...prev, result.rule]);
          showToast('Scoring rule created', 'success');
          setIsFormOpen(false);
        } else {
          showToast('Failed to create rule', 'error');
        }
      }
    } catch (err) {
      logger.error('Failed to save scoring rule:', err);
      showToast('Failed to save rule', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [editingRule]);

  const handleRecalculateAll = useCallback(async () => {
    setIsRecalculating(true);
    try {
      const response = await apiPost(`${API_ENDPOINTS.ADMIN.LEADS}/recalculate-all`);
      if (response.ok) {
        const data = unwrapApiData<{ count: number }>(await response.json());
        showToast(`Recalculated scores for ${data.count} leads`, 'success');
      } else {
        showToast('Failed to recalculate scores', 'error');
      }
    } catch (err) {
      logger.error('Failed to recalculate:', err);
      showToast('Failed to recalculate scores', 'error');
    } finally {
      setIsRecalculating(false);
    }
  }, []);

  // ============================================
  // COMPUTED
  // ============================================

  const activeCount = rules.filter((r) => r.isActive).length;
  const totalPoints = rules
    .filter((r) => r.isActive)
    .reduce((sum, r) => sum + r.points, 0);

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="LEAD SCORING RULES"
        stats={
          <div className="table-stats">
            <span className="table-stat">
              <span className="table-stat-value">{rules.length}</span>
              <span className="table-stat-label">total</span>
            </span>
            <span className="table-stat table-stat--active">
              <span className="table-stat-value">{activeCount}</span>
              <span className="table-stat-label">active</span>
            </span>
            <span className="table-stat">
              <span className="table-stat-value">{totalPoints}</span>
              <span className="table-stat-label">max pts</span>
            </span>
          </div>
        }
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={handleRecalculateAll}
              disabled={isRecalculating}
              title="Recalculate all lead scores"
            >
              <RefreshCw
                className={isRecalculating ? 'icon-spin' : ''}
              />
              <span>{isRecalculating ? 'Recalculating...' : 'Recalculate All'}</span>
            </button>
            <button
              className="btn-primary"
              onClick={handleCreate}
              title="Add scoring rule"
            >
              <Plus />
              <span>Add Rule</span>
            </button>
            <IconButton
              action="refresh"
              onClick={fetchRules}
              disabled={isLoading}
              loading={isLoading}
            />
          </>
        }
      >
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead>Name</PortalTableHead>
              <PortalTableHead>Field</PortalTableHead>
              <PortalTableHead>Operator</PortalTableHead>
              <PortalTableHead>Threshold</PortalTableHead>
              <PortalTableHead>Points</PortalTableHead>
              <PortalTableHead>Status</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={7} message={error} onRetry={fetchRules} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={7} rows={5} />
            ) : rules.length === 0 ? (
              <PortalTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message="No scoring rules configured"
              />
            ) : (
              rules.map((rule) => (
                <PortalTableRow key={rule.id}>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-content">
                      <span className="cell-title">{rule.name}</span>
                      {rule.description && (
                        <span className="cell-subtitle">{rule.description}</span>
                      )}
                    </div>
                  </PortalTableCell>

                  <PortalTableCell>
                    {FIELD_LABELS[rule.fieldName] || rule.fieldName}
                  </PortalTableCell>

                  <PortalTableCell>
                    {OPERATOR_LABELS[rule.operator] || rule.operator}
                  </PortalTableCell>

                  <PortalTableCell>
                    {rule.operator === 'not_empty' ? (
                      <span className="field-label">N/A</span>
                    ) : (
                      <code className="scoring-threshold">{rule.thresholdValue}</code>
                    )}
                  </PortalTableCell>

                  <PortalTableCell>
                    <span className={`scoring-points ${rule.points > 0 ? 'scoring-points--positive' : 'scoring-points--negative'}`}>
                      {rule.points > 0 ? '+' : ''}{rule.points}
                    </span>
                  </PortalTableCell>

                  <PortalTableCell>
                    <StatusBadge status={rule.isActive ? 'active' : 'inactive'}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </PortalTableCell>

                  <PortalTableCell className="col-actions">
                    <div className="action-group">
                      <button
                        className="icon-btn"
                        onClick={() => handleToggleActive(rule)}
                        title={rule.isActive ? 'Deactivate' : 'Activate'}
                        aria-label={rule.isActive ? 'Deactivate rule' : 'Activate rule'}
                      >
                        {rule.isActive ? (
                          <ToggleRight className="icon-sm" />
                        ) : (
                          <ToggleLeft className="icon-sm" />
                        )}
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => handleEdit(rule)}
                        title="Edit rule"
                        aria-label="Edit rule"
                      >
                        <Pencil className="icon-sm" />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => handleDeleteClick(rule)}
                        title="Delete rule"
                        aria-label="Delete rule"
                      >
                        <Trash2 className="icon-sm" />
                      </button>
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>

      {/* Create/Edit Modal */}
      <LeadScoringRuleForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        rule={editingRule}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Scoring Rule"
        description={`Are you sure you want to delete "${ruleToDelete?.name || ''}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="danger"
      />
    </>
  );
}
