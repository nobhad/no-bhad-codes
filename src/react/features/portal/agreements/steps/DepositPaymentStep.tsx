/**
 * Deposit payment step — embeds StripePaymentForm.
 */

import * as React from 'react';
import { Check } from 'lucide-react';
import { StripePaymentForm } from '../../payments/StripePaymentForm';

interface DepositPaymentStepProps {
  entityId: number;
  entityData?: Record<string, unknown>;
  onComplete: () => void;
  getAuthToken?: () => string | null;
}

export const DepositPaymentStep = React.memo(({
  entityId,
  entityData,
  onComplete,
  getAuthToken
}: DepositPaymentStepProps) => {
  const status = entityData?.status as string | undefined;
  const isPaid = status === 'paid';

  if (isPaid) {
    return (
      <div className="agreement-step-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--app-color-success)' }}>
          <Check size={20} />
          <span>Payment received</span>
        </div>
      </div>
    );
  }

  const totalAmount = Number(entityData?.total_amount) || 0;
  const amountCents = Math.round(totalAmount * 100);
  const invoiceNumber = entityData?.invoice_number as string | undefined;

  return (
    <div className="agreement-step-content">
      <h3>Pay Deposit</h3>
      {invoiceNumber && (
        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Invoice #{invoiceNumber}
        </p>
      )}

      <StripePaymentForm
        invoiceId={entityId}
        amountCents={amountCents}
        onSuccess={onComplete}
        getAuthToken={getAuthToken}
      />
    </div>
  );
});
