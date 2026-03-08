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
      <h4 className="status-section-title">Stripe</h4>
      {stripeStatus ? (
        <div className="stats-grid">
          <div className="portal-card">
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="icon-lg text-muted" />
                <span className="font-semibold">Stripe Payment Gateway</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
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
                  <div className="flex justify-between">
                    <span className="text-muted">Account</span>
                    <span>{stripeStatus.accountId}</span>
                  </div>
                )}
                {stripeStatus.mode && (
                  <div className="flex justify-between">
                    <span className="text-muted">Mode</span>
                    <span className="status-badge">{stripeStatus.mode}</span>
                  </div>
                )}
                <div className="flex justify-between">
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
