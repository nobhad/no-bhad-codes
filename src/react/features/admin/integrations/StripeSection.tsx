/**
 * Stripe Integration Section
 * @file src/react/features/admin/integrations/StripeSection.tsx
 */

import * as React from 'react';
import { CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { formatDate, type StripeStatus } from './types';

interface StripeSectionProps {
  stripeStatus: StripeStatus | null;
}

export function StripeSection({ stripeStatus }: StripeSectionProps) {
  return (
    <div className="status-section">
      <div className="data-table-header"><h3><span className="title-full">Stripe</span></h3></div>
      {stripeStatus ? (
        <div className="stats-grid">
          <div className="portal-card">
            <div className="stat-card">
              <div className="portal-card-header">
                <div className="portal-card-title-group">
                  <CreditCard className="icon-lg text-muted" />
                  <span className="font-semibold">Stripe Payment Gateway</span>
                </div>
              </div>
              <div className="portal-card-detail-list">
                <div className="portal-card-detail-row">
                  <span className="text-muted">Connected</span>
                  <span>
                    {stripeStatus.connected ? (
                      <CheckCircle className="icon-sm text-status-success" />
                    ) : (
                      <XCircle className="icon-sm text-status-danger" />
                    )}
                  </span>
                </div>
                {stripeStatus.accountId && (
                  <div className="portal-card-detail-row">
                    <span className="text-muted">Account</span>
                    <span>{stripeStatus.accountId}</span>
                  </div>
                )}
                {stripeStatus.mode && (
                  <div className="portal-card-detail-row">
                    <span className="text-muted">Mode</span>
                    <span className="status-badge">{stripeStatus.mode}</span>
                  </div>
                )}
                <div className="portal-card-detail-row">
                  <span className="text-muted">Last Charge</span>
                  <span>{formatDate(stripeStatus.lastCharge)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="status-empty">
          <CreditCard className="icon-lg text-muted" />
          <span>Stripe status unavailable.</span>
        </div>
      )}
    </div>
  );
}
