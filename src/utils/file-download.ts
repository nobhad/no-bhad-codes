/**
 * ===============================================
 * FILE DOWNLOAD UTILITIES
 * ===============================================
 * @file src/utils/file-download.ts
 *
 * Shared file download functionality for both admin and client portals.
 * Consolidates duplicate download logic from multiple modules.
 */

import { showToast } from './toast-notifications';
import { createLogger } from './logger';

const logger = createLogger('FileDownload');

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Download a file from a URL
 */
export async function downloadFromUrl(
  url: string,
  filename: string,
  options?: RequestInit
): Promise<void> {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      ...options
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();
    downloadBlob(blob, filename);
  } catch (error) {
    logger.error('[FileDownload] Download error:', error);
    throw error;
  }
}

/**
 * Download an invoice PDF
 */
export async function downloadInvoicePdf(
  invoiceId: number,
  invoiceNumber: string
): Promise<void> {
  const filename = `invoice-${invoiceNumber}.pdf`;

  try {
    await downloadFromUrl(`/api/invoices/${invoiceId}/pdf`, filename);
    showToast('Invoice downloaded successfully', 'success');
  } catch (error) {
    logger.error('[FileDownload] Invoice download error:', error);
    showToast('Failed to download invoice', 'error');
    throw error;
  }
}

/**
 * Download a receipt PDF
 */
export async function downloadReceiptPdf(
  paymentId: number,
  invoiceNumber: string
): Promise<void> {
  const filename = `receipt-${invoiceNumber}.pdf`;

  try {
    await downloadFromUrl(`/api/invoices/payments/${paymentId}/receipt`, filename);
    showToast('Receipt downloaded successfully', 'success');
  } catch (error) {
    logger.error('[FileDownload] Receipt download error:', error);
    showToast('Failed to download receipt', 'error');
    throw error;
  }
}

/**
 * Download a file from the files system
 */
export async function downloadFile(
  fileId: number,
  filename: string
): Promise<void> {
  try {
    await downloadFromUrl(`/api/files/${fileId}/download`, filename);
  } catch (error) {
    logger.error('[FileDownload] File download error:', error);
    showToast('Failed to download file', 'error');
    throw error;
  }
}

/**
 * Preview a file in a new tab
 */
export function previewFile(fileId: number): void {
  window.open(`/api/files/${fileId}/preview`, '_blank');
}

/**
 * Download a document from document requests
 */
export async function downloadDocument(
  documentId: number,
  filename: string
): Promise<void> {
  try {
    await downloadFromUrl(`/api/document-requests/files/${documentId}/download`, filename);
  } catch (error) {
    logger.error('[FileDownload] Document download error:', error);
    showToast('Failed to download document', 'error');
    throw error;
  }
}
