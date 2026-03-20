/**
 * ===============================================
 * AUTO-PAY SETTINGS
 * ===============================================
 * @file src/react/features/portal/auto-pay/AutoPaySettings.tsx
 *
 * Client-facing UI for managing saved payment methods
 * and auto-pay preferences. Displays saved cards, allows
 * setting a default, deleting methods, and toggling auto-pay.
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  CreditCard,
  Shield,
  Trash2,
  Check,
  Star,
  Plus,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { StatusBadge } from '@react/components/portal/StatusBadge';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { useFadeIn } from '@react/hooks/useGsap';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import { createLogger } from '@/utils/logger';
import type { PortalViewProps } from '../types';

const logger = createLogger('AutoPaySettings');

// ============================================
// TYPES
// ============================================

interface SavedPaymentMethod {
  id: number;
  clientId: number;
  stripePaymentMethodId: string;
  type: string;
  brand: string | null;
  lastFour: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: string;
}

interface AutoPayStatus {
  enabled: boolean;
  defaultMethod: SavedPaymentMethod | null;
  methodCount: number;
}

export interface AutoPaySettingsProps extends PortalViewProps {}

// ============================================
// CONSTANTS
// ============================================

const BRAND_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay'
};

// ============================================
// HELPERS
// ============================================

function getBrandLabel(brand: string | null): string {
  if (!brand) return 'Card';
  return BRAND_LABELS[brand.toLowerCase()] ?? brand;
}

function formatExpiration(month: number | null, year: number | null): string {
  if (month === null || year === null) return '--';
  const paddedMonth = String(month).padStart(2, '0');
  const shortYear = String(year).slice(-2);
  return `${paddedMonth}/${shortYear}`;
}

// ============================================
// PAYMENT METHOD CARD
// ============================================

interface PaymentMethodCardProps {
  method: SavedPaymentMethod;
  onSetDefault: (method: SavedPaymentMethod) => void;
  onDelete: (method: SavedPaymentMethod) => void;
  isSettingDefault: boolean;
}

function PaymentMethodCard({
  method,
  onSetDefault,
  onDelete,
  isSettingDefault
}: PaymentMethodCardProps) {
  return (
    <div className="portal-card-inner">
      <div className="portal-card-header-row">
        <div className="cell-with-icon">
          <CreditCard className="icon-sm section-icon" />
          <div className="cell-content">
            <div className="cell-with-icon">
              <span className="font-semibold">
                {getBrandLabel(method.brand)}
              </span>
              <span className="text-muted">
                ending in {method.lastFour ?? '----'}
              </span>
              {method.isDefault && (
                <StatusBadge status="active" size="sm">Default</StatusBadge>
              )}
            </div>
            <span className="text-muted text-sm">
              Expires {formatExpiration(method.expMonth, method.expYear)}
            </span>
          </div>
        </div>

        <div className="action-group">
          {!method.isDefault && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => onSetDefault(method)}
              disabled={isSettingDefault}
              title="Set as default payment method"
            >
              <Star className="icon-xs" />
              Set Default
            </button>
          )}
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => onDelete(method)}
            title="Remove payment method"
          >
            <Trash2 className="icon-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// AUTO-PAY TOGGLE SECTION
// ============================================

interface AutoPayToggleProps {
  autoPayStatus: AutoPayStatus | null;
  defaultMethod: SavedPaymentMethod | null;
  hasPaymentMethods: boolean;
  isToggling: boolean;
  onToggle: () => void;
}

function AutoPayToggle({
  autoPayStatus,
  defaultMethod,
  hasPaymentMethods,
  isToggling,
  onToggle
}: AutoPayToggleProps) {
  const isEnabled = autoPayStatus?.enabled ?? false;
  const ToggleIcon = isEnabled ? ToggleRight : ToggleLeft;

  return (
    <div className="portal-card">
      <div className="portal-card-header">
        <div className="cell-with-icon">
          <Shield className="icon-sm section-icon" />
          <span>Auto-Pay</span>
        </div>
        <StatusBadge status={isEnabled ? 'active' : 'inactive'} size="sm">
          {isEnabled ? 'Active' : 'Inactive'}
        </StatusBadge>
      </div>

      <div className="portal-card-body">
        <p className="text-muted form-helper-text">
          When enabled, due invoices will be automatically charged to your default payment method.
        </p>

        {!hasPaymentMethods ? (
          <p className="text-warning text-sm">
            A payment method must be added before enabling auto-pay.
          </p>
        ) : (
          <>
            <button
              type="button"
              className={isEnabled ? 'btn-secondary' : 'btn-primary'}
              onClick={onToggle}
              disabled={isToggling}
            >
              <ToggleIcon className="icon-sm" />
              {isToggling ? 'Updating...' : isEnabled ? 'Disable Auto-Pay' : 'Enable Auto-Pay'}
            </button>

            {isEnabled && defaultMethod && (
              <div className="portal-card-inner status-info-row">
                <Check className="icon-xs text-success" />
                <span className="text-sm">
                  Charges will be made to {getBrandLabel(defaultMethod.brand)} ending in {defaultMethod.lastFour ?? '----'}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AutoPaySettings({ getAuthToken, showNotification }: AutoPaySettingsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // --- Data fetching ---
  const {
    data: methodsData,
    isLoading: methodsLoading,
    error: methodsError,
    refetch: refetchMethods,
    portalFetch
  } = usePortalData<{ methods: SavedPaymentMethod[] }>({
    getAuthToken,
    url: API_ENDPOINTS.PAYMENTS_METHODS,
    transform: (raw) => raw as { methods: SavedPaymentMethod[] }
  });

  const {
    data: autoPayData,
    isLoading: autoPayLoading,
    error: autoPayError,
    refetch: refetchAutoPay
  } = usePortalData<AutoPayStatus>({
    getAuthToken,
    url: API_ENDPOINTS.PAYMENTS_AUTO_PAY,
    transform: (raw) => raw as AutoPayStatus
  });

  const methods = useMemo(() => methodsData?.methods ?? [], [methodsData]);
  const defaultMethod = useMemo(
    () => methods.find((m) => m.isDefault) ?? null,
    [methods]
  );

  // --- Mutation state ---
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const deleteDialog = useConfirmDialog();
  const [deleteTarget, setDeleteTarget] = useState<SavedPaymentMethod | null>(null);

  // --- Handlers ---

  const handleSetDefault = useCallback(async (method: SavedPaymentMethod) => {
    setIsSettingDefault(true);
    try {
      await portalFetch(buildEndpoint.paymentMethodDefault(method.id), {
        method: 'PUT'
      });
      showNotification?.('Default payment method updated', 'success');
      refetchMethods();
      refetchAutoPay();
    } catch (err) {
      logger.error('Error setting default payment method:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to update default payment method'),
        'error'
      );
    } finally {
      setIsSettingDefault(false);
    }
  }, [portalFetch, showNotification, refetchMethods, refetchAutoPay]);

  const handleDeleteClick = useCallback((method: SavedPaymentMethod) => {
    setDeleteTarget(method);
    deleteDialog.open();
  }, [deleteDialog]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteDialog.confirm(async () => {
      await portalFetch(buildEndpoint.paymentMethod(deleteTarget.id), {
        method: 'DELETE'
      });
      showNotification?.('Payment method removed', 'success');
      setDeleteTarget(null);
      refetchMethods();
      refetchAutoPay();
    });
  }, [deleteTarget, deleteDialog, portalFetch, showNotification, refetchMethods, refetchAutoPay]);

  const handleToggleAutoPay = useCallback(async () => {
    const currentlyEnabled = autoPayData?.enabled ?? false;
    setIsToggling(true);
    try {
      await portalFetch(API_ENDPOINTS.PAYMENTS_AUTO_PAY, {
        method: 'PUT',
        body: { enabled: !currentlyEnabled }
      });
      showNotification?.(
        currentlyEnabled ? 'Auto-pay disabled' : 'Auto-pay enabled',
        'success'
      );
      refetchAutoPay();
    } catch (err) {
      logger.error('Error toggling auto-pay:', err);
      showNotification?.(
        formatErrorMessage(err, 'Failed to update auto-pay setting'),
        'error'
      );
    } finally {
      setIsToggling(false);
    }
  }, [autoPayData, portalFetch, showNotification, refetchAutoPay]);

  const handleRefetch = useCallback(() => {
    refetchMethods();
    refetchAutoPay();
  }, [refetchMethods, refetchAutoPay]);

  // --- Loading / Error ---

  const isLoading = methodsLoading || autoPayLoading;
  const error = methodsError || autoPayError;

  if (isLoading) {
    return (
      <div ref={containerRef}>
        <LoadingState message="Loading payment settings..." />
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef}>
        <ErrorState message={error} onRetry={handleRefetch} />
      </div>
    );
  }

  // --- Render ---

  return (
    <div ref={containerRef} className="portal-section-stack">
      {/* Section 1: Saved Payment Methods */}
      <div>
        <div className="section-header">
          <h2 className="section-title">
            <CreditCard className="icon-sm section-icon" />
            Payment Methods
          </h2>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled
            title="Contact us to add a payment method"
          >
            <Plus className="icon-xs" />
            Add Payment Method
          </button>
        </div>

        {methods.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="icon-lg" />}
            message="No payment methods saved yet. Contact us to add a payment method."
          />
        ) : (
          <div className="card-list">
            {methods.map((method) => (
              <PaymentMethodCard
                key={method.id}
                method={method}
                onSetDefault={handleSetDefault}
                onDelete={handleDeleteClick}
                isSettingDefault={isSettingDefault}
              />
            ))}
          </div>
        )}

        <p className="form-helper-text text-muted">
          To add a new payment method, please contact us directly.
        </p>
      </div>

      {/* Section 2: Auto-Pay */}
      <AutoPayToggle
        autoPayStatus={autoPayData}
        defaultMethod={defaultMethod}
        hasPaymentMethods={methods.length > 0}
        isToggling={isToggling}
        onToggle={handleToggleAutoPay}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Remove Payment Method"
        description={
          deleteTarget
            ? `Are you sure you want to remove the ${getBrandLabel(deleteTarget.brand)} card ending in ${deleteTarget.lastFour ?? '----'}? This action cannot be undone.`
            : 'Are you sure you want to remove this payment method?'
        }
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
