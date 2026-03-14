/**
 * ContractSignModal
 * Modal for in-portal contract signing with PDF preview,
 * signature canvas, and terms agreement.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { FileSignature, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { PortalModal } from '@react/components/portal/PortalModal';
import { SignatureCanvas, type SignatureMode } from '@react/components/SignatureCanvas';
import { usePortalFetch } from '@react/hooks/usePortalFetch';
import { usePortalAuth } from '@react/hooks/usePortalAuth';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { PortalContract } from './types';

// ============================================
// CONSTANTS
// ============================================

const CONTRACT_PDF_IFRAME_HEIGHT = 420;

// ============================================
// TYPES
// ============================================

type SigningState = 'idle' | 'submitting' | 'success' | 'error';

interface ContractSignModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Close callback */
  onOpenChange: (open: boolean) => void;
  /** The contract to sign */
  contract: PortalContract;
  /** Auth token getter */
  getAuthToken?: () => string | null;
  /** Called after successful signing */
  onSigned: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function ContractSignModal({
  open,
  onOpenChange,
  contract,
  getAuthToken,
  onSigned
}: ContractSignModalProps) {
  const { user } = usePortalAuth();
  const { portalFetch } = usePortalFetch({ getAuthToken });

  // Form state
  const [signerName, setSignerName] = useState(
    (user && 'contactName' in user ? user.contactName : '') || ''
  );
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('draw');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Submission state
  const [signingState, setSigningState] = useState<SigningState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const pdfUrl = contract.projectId
    ? `/api/projects/${contract.projectId}/contract/pdf`
    : null;

  const canSubmit =
    signingState === 'idle' &&
    signerName.trim().length > 0 &&
    signatureData !== null &&
    agreedToTerms;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setSigningState('submitting');
    setErrorMessage('');

    try {
      await portalFetch(`${API_ENDPOINTS.CONTRACTS}/sign`, {
        method: 'POST',
        body: {
          contractId: contract.id,
          signerName: signerName.trim(),
          signatureData,
          agreedToTerms
        }
      });

      setSigningState('success');
      // Give user a moment to see success state, then close and refresh
      setTimeout(() => {
        onOpenChange(false);
        onSigned();
      }, 1500);
    } catch (err) {
      setSigningState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to sign contract. Please try again.'
      );
    }
  }, [canSubmit, portalFetch, contract.id, signerName, signatureData, agreedToTerms, onOpenChange, onSigned]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setSigningState('idle');
      setErrorMessage('');
      setAgreedToTerms(false);
      setSignatureData(null);
      setSignatureMode('draw');
      setSignerName(
        (user && 'contactName' in user ? user.contactName : '') || ''
      );
    }
  }, [open, user]);

  return (
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title="Sign Contract"
      icon={<FileSignature />}
      size="lg"
      onSubmit={handleSubmit}
      footer={
        signingState === 'success' ? null : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onOpenChange(false)}
              disabled={signingState === 'submitting'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!canSubmit}
            >
              {signingState === 'submitting' ? (
                <>
                  <Loader2 className="animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <FileSignature />
                  Sign Contract
                </>
              )}
            </button>
          </div>
        )
      }
    >
      {/* Success state */}
      {signingState === 'success' && (
        <div className="flex flex-col items-center gap-4 my-4">
          <CheckCircle2 className="text-success icon-decorative" />
          <p className="text-lg text-center">Contract signed successfully!</p>
        </div>
      )}

      {/* Main form content */}
      {signingState !== 'success' && (
        <>
          {/* Error message */}
          {errorMessage && (
            <div className="form-error-banner mb-4">
              <AlertCircle />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* PDF Preview */}
          {pdfUrl && (
            <div className="mb-4">
              <label className="form-label mb-2">Contract Preview</label>
              <iframe
                src={pdfUrl}
                title="Contract PDF Preview"
                className="signature-contract-preview"
                style={{ height: `${CONTRACT_PDF_IFRAME_HEIGHT}px` }}
              />
            </div>
          )}

          {/* Signer name */}
          <div className="form-field mb-4">
            <label className="form-label" htmlFor="signer-name-input">
              Your Full Legal Name
            </label>
            <input
              id="signer-name-input"
              type="text"
              className="form-input"
              placeholder="Enter your full name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              required
            />
          </div>

          {/* Signature */}
          <div className="form-field mb-4">
            <label className="form-label">Your Signature</label>
            <SignatureCanvas
              onSignatureChange={setSignatureData}
              mode={signatureMode}
              onModeChange={setSignatureMode}
            />
          </div>

          {/* Terms checkbox */}
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="agree-terms-input"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              required
            />
            <label htmlFor="agree-terms-input" className="text-sm">
              I have read and agree to the terms outlined in the contract above. I understand
              that by signing, I am entering into a legally binding agreement.
            </label>
          </div>
        </>
      )}
    </PortalModal>
  );
}
