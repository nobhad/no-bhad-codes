/**
 * Contract sign step — reuses the existing ContractSignModal pattern.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { FileSignature, Check } from 'lucide-react';
import { ContractSignModal } from '../../contracts/ContractSignModal';
import type { PortalContract } from '../../contracts/types';

interface ContractSignStepProps {
  entityId: number;
  entityData?: Record<string, unknown>;
  onComplete: () => void;
  getAuthToken?: () => string | null;
}

export const ContractSignStep = React.memo(({
  entityId,
  entityData,
  onComplete,
  getAuthToken
}: ContractSignStepProps) => {
  const [showSignModal, setShowSignModal] = useState(false);

  const status = entityData?.status as string | undefined;
  const isSigned = status === 'signed' || entityData?.signed_at != null;

  const handleSigned = useCallback(() => {
    setShowSignModal(false);
    onComplete();
  }, [onComplete]);

  if (isSigned) {
    return (
      <div className="agreement-step-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--app-color-success)' }}>
          <Check size={20} />
          <span>Contract signed</span>
        </div>
      </div>
    );
  }

  // Build a minimal PortalContract object for the modal
  const contractForModal: PortalContract = {
    id: entityId,
    projectId: null,
    projectName: null,
    status: status || 'sent',
    signedAt: null,
    createdAt: (entityData?.created_at as string) || new Date().toISOString(),
    expiresAt: null
  };

  return (
    <div className="agreement-step-content">
      <h3>Sign Your Contract</h3>
      <p className="text-muted">Please review and sign the project contract to proceed.</p>

      <button
        className="btn-primary"
        onClick={() => setShowSignModal(true)}
        style={{ marginTop: '0.5rem' }}
      >
        <FileSignature size={16} /> Review & Sign
      </button>

      {showSignModal && (
        <ContractSignModal
          open={showSignModal}
          onOpenChange={setShowSignModal}
          contract={contractForModal}
          getAuthToken={getAuthToken}
          onSigned={handleSigned}
        />
      )}
    </div>
  );
});
