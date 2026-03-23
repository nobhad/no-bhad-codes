/**
 * ===============================================
 * PDF PREVIEW
 * ===============================================
 * @file src/react/components/portal/PDFPreview.tsx
 *
 * Renders an iframe inside a container div with consistent
 * sizing. Intended for use inside PortalModal for previewing
 * invoices, contracts, and other PDF documents.
 */

import * as React from 'react';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_HEIGHT = '70vh';
const MIN_HEIGHT = '200px';

// ============================================
// COMPONENT
// ============================================

export interface PDFPreviewProps {
  /** URL of the PDF to display */
  url: string;
  /** Accessible title for the iframe */
  title?: string;
  /** Height of the iframe (default: '70vh') */
  height?: string;
}

/**
 * Renders an iframe-based PDF preview with consistent sizing.
 */
export function PDFPreview({
  url,
  title = 'PDF Preview',
  height = DEFAULT_HEIGHT
}: PDFPreviewProps) {
  return (
    <div style={{ minHeight: MIN_HEIGHT }}>
      <iframe
        src={url}
        title={title}
        style={{ width: '100%', height, border: 'none' }}
      />
    </div>
  );
}
