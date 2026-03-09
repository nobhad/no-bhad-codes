import * as React from 'react';
import { useCallback } from 'react';
import { Copy } from 'lucide-react';

interface CopyEmailButtonProps {
  email: string;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * CopyEmailButton
 * Inline copy-to-clipboard button for email addresses.
 * Matches the canonical pattern from LeadDetailPanel:
 *   <span className="meta-value meta-value-with-copy">
 *     {email}
 *     <CopyEmailButton email={email} showNotification={showNotification} />
 *   </span>
 */
export function CopyEmailButton({ email, showNotification }: CopyEmailButtonProps) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(email).then(() => {
      showNotification?.('Email copied to clipboard', 'info');
    });
  }, [email, showNotification]);

  return (
    <button
      type="button"
      className="copy-email-btn"
      onClick={handleCopy}
      title="Copy email"
      aria-label="Copy email"
    >
      <Copy className="icon-xs" />
    </button>
  );
}
