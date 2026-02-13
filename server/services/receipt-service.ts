/**
 * ===============================================
 * RECEIPT SERVICE
 * ===============================================
 * @file server/services/receipt-service.ts
 *
 * Handles receipt generation, storage, and retrieval.
 * Generates PDF receipts for payments using pdf-lib.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getDatabase } from '../database/init.js';
import { BUSINESS_INFO, getPdfLogoBytes } from '../config/business.js';
import { getUploadsSubdir, getRelativePath, sanitizeFilename } from '../config/uploads.js';
import { PAGE_MARGINS } from '../utils/pdf-utils.js';

// ============================================
// TYPES
// ============================================

export interface Receipt {
  id: number;
  receiptNumber: string;
  invoiceId: number;
  paymentId: number | null;
  amount: number;
  fileId: number | null;
  createdAt: string;
  // Joined fields
  invoiceNumber?: string;
  clientName?: string;
  clientEmail?: string;
  projectName?: string;
}

interface ReceiptRow {
  id: number;
  receipt_number: string;
  invoice_id: number;
  payment_id: number | null;
  amount: number | string;
  file_id: number | null;
  created_at: string;
  invoice_number?: string;
  client_name?: string;
  client_email?: string;
  project_name?: string;
}

export interface ReceiptPdfData {
  receiptNumber: string;
  invoiceNumber: string;
  paymentDate: string;
  paymentMethod: string;
  paymentReference?: string;
  amount: number;
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  projectName?: string;
}

// ============================================
// RECEIPT PDF GENERATION
// ============================================

/**
 * Generate a receipt PDF using pdf-lib
 * Follows the invoice PDF pattern for consistent branding
 */
export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  pdfDoc.setTitle(`Receipt ${data.receiptNumber}`);
  pdfDoc.setAuthor(BUSINESS_INFO.name);
  pdfDoc.setSubject('Payment Receipt');
  pdfDoc.setCreator('NoBhadCodes');

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const { width, height } = page.getSize();

  const leftMargin = PAGE_MARGINS.left;
  const rightMargin = width - PAGE_MARGINS.right;
  let y = height - 43;

  // === HEADER ===
  const logoHeight = 100;
  const titleText = 'RECEIPT';
  page.drawText(titleText, {
    x: leftMargin,
    y: y - 20,
    size: 28,
    font: helveticaBold,
    color: rgb(0.15, 0.15, 0.15)
  });

  let textStartX = rightMargin - 180;
  const logoBytes = getPdfLogoBytes();
  if (logoBytes) {
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    const logoX = rightMargin - logoWidth - 150;
    page.drawImage(logoImage, {
      x: logoX,
      y: y - logoHeight + 10,
      width: logoWidth,
      height: logoHeight
    });
    textStartX = logoX + logoWidth + 18;
  }

  page.drawText(BUSINESS_INFO.name, { x: textStartX, y: y - 11, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(BUSINESS_INFO.owner, { x: textStartX, y: y - 34, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(BUSINESS_INFO.tagline, { x: textStartX, y: y - 54, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(BUSINESS_INFO.email, { x: textStartX, y: y - 70, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(BUSINESS_INFO.website, { x: textStartX, y: y - 86, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

  y -= 120;

  // Divider
  page.drawLine({
    start: { x: leftMargin, y },
    end: { x: rightMargin, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  y -= 30;

  // === PAYMENT CONFIRMATION ===
  page.drawText('PAYMENT RECEIVED', {
    x: leftMargin,
    y,
    size: 16,
    font: helveticaBold,
    color: rgb(0.13, 0.55, 0.13)
  });
  y -= 30;

  // === CLIENT INFO ===
  page.drawText('RECEIVED FROM:', { x: leftMargin, y, size: 11, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;
  page.drawText(data.clientName, { x: leftMargin, y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
  y -= 12;
  if (data.clientCompany) {
    page.drawText(data.clientCompany, { x: leftMargin, y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 12;
  }
  page.drawText(data.clientEmail, { x: leftMargin, y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  y -= 30;

  // === RECEIPT DETAILS BOX ===
  const boxTop = y;
  const boxHeight = 140;
  page.drawRectangle({
    x: leftMargin,
    y: y - boxHeight,
    width: rightMargin - leftMargin,
    height: boxHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1
  });

  // Box header
  page.drawRectangle({
    x: leftMargin,
    y: y - 25,
    width: rightMargin - leftMargin,
    height: 25,
    color: rgb(0.95, 0.95, 0.95)
  });
  page.drawText('PAYMENT DETAILS', { x: leftMargin + 10, y: y - 17, size: 11, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });

  y -= 45;

  // Detail rows
  const drawDetailRow = (label: string, value: string) => {
    page.drawText(label, { x: leftMargin + 10, y, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(value, { x: leftMargin + 150, y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 18;
  };

  drawDetailRow('Receipt Number:', data.receiptNumber);
  drawDetailRow('Invoice Number:', data.invoiceNumber);
  drawDetailRow('Payment Date:', data.paymentDate);
  drawDetailRow('Payment Method:', data.paymentMethod);
  if (data.paymentReference) {
    drawDetailRow('Reference:', data.paymentReference);
  }
  if (data.projectName) {
    drawDetailRow('Project:', data.projectName);
  }

  y = boxTop - boxHeight - 30;

  // === AMOUNT PAID ===
  page.drawLine({
    start: { x: leftMargin, y: y + 15 },
    end: { x: rightMargin, y: y + 15 },
    thickness: 2,
    color: rgb(0.13, 0.55, 0.13)
  });

  page.drawText('AMOUNT PAID:', { x: leftMargin, y, size: 14, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  const amountText = `$${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const amountWidth = helveticaBold.widthOfTextAtSize(amountText, 18);
  page.drawText(amountText, { x: rightMargin - amountWidth, y, size: 18, font: helveticaBold, color: rgb(0.13, 0.55, 0.13) });

  y -= 50;

  // === THANK YOU ===
  const thankYouText = 'Thank you for your payment!';
  const thankYouWidth = helvetica.widthOfTextAtSize(thankYouText, 12);
  page.drawText(thankYouText, {
    x: (width - thankYouWidth) / 2,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3)
  });

  // === FOOTER ===
  page.drawLine({
    start: { x: leftMargin, y: 72 },
    end: { x: rightMargin, y: 72 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8)
  });

  const footerText = `${BUSINESS_INFO.name} • ${BUSINESS_INFO.owner} • ${BUSINESS_INFO.email} • ${BUSINESS_INFO.website}`;
  const footerWidth = helvetica.widthOfTextAtSize(footerText, 7);
  page.drawText(footerText, {
    x: (width - footerWidth) / 2,
    y: 54,
    size: 7,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5)
  });

  const legalText = 'This receipt confirms payment received. Please retain for your records.';
  const legalWidth = helvetica.widthOfTextAtSize(legalText, 7);
  page.drawText(legalText, {
    x: (width - legalWidth) / 2,
    y: 40,
    size: 7,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5)
  });

  return await pdfDoc.save();
}

// ============================================
// RECEIPT SERVICE CLASS
// ============================================

class ReceiptService {
  /**
   * Generate next receipt number
   */
  private async generateReceiptNumber(): Promise<string> {
    const db = getDatabase();
    const year = new Date().getFullYear();
    const prefix = `RCP-${year}-`;

    const result = await db.get(
      `SELECT receipt_number FROM receipts
       WHERE receipt_number LIKE ?
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let sequence = 1;
    if (result && result.receipt_number) {
      const match = String(result.receipt_number).match(/RCP-\d{4}-(\d+)/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Transform database row to Receipt object
   */
  private transformRow(row: ReceiptRow): Receipt {
    return {
      id: row.id,
      receiptNumber: row.receipt_number,
      invoiceId: row.invoice_id,
      paymentId: row.payment_id,
      amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount,
      fileId: row.file_id,
      createdAt: row.created_at,
      invoiceNumber: row.invoice_number,
      clientName: row.client_name,
      clientEmail: row.client_email,
      projectName: row.project_name
    };
  }

  /**
   * Create a receipt and generate PDF
   */
  async createReceipt(
    invoiceId: number,
    paymentId: number | null,
    amount: number,
    paymentData: {
      paymentMethod: string;
      paymentReference?: string;
      paymentDate?: string;
    }
  ): Promise<Receipt> {
    const db = getDatabase();

    // Get invoice and client info
    const invoiceRow = await db.get(
      `SELECT i.invoice_number, i.project_id,
              c.contact_name as client_name, c.email as client_email, c.company_name,
              p.project_name
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.id = ?`,
      [invoiceId]
    );

    if (!invoiceRow) {
      throw new Error('Invoice not found');
    }

    const receiptNumber = await this.generateReceiptNumber();
    const paymentDate = paymentData.paymentDate || new Date().toISOString().split('T')[0];

    // Generate PDF
    const pdfData: ReceiptPdfData = {
      receiptNumber,
      invoiceNumber: String(invoiceRow.invoice_number || `INV-${invoiceId}`),
      paymentDate: new Date(paymentDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      paymentMethod: paymentData.paymentMethod,
      paymentReference: paymentData.paymentReference,
      amount,
      clientName: String(invoiceRow.client_name || 'Client'),
      clientEmail: String(invoiceRow.client_email || ''),
      clientCompany: invoiceRow.company_name ? String(invoiceRow.company_name) : undefined,
      projectName: invoiceRow.project_name ? String(invoiceRow.project_name) : undefined
    };

    const pdfBytes = await generateReceiptPdf(pdfData);

    // Save PDF to files system
    let fileId: number | null = null;
    const projectId = invoiceRow.project_id as number | null;

    if (projectId) {
      try {
        // Ensure receipts directory exists
        const receiptsDir = getUploadsSubdir('receipts');
        const filename = sanitizeFilename(`${receiptNumber}.pdf`);
        const filePath = join(receiptsDir, filename);

        // Write PDF to disk
        writeFileSync(filePath, Buffer.from(pdfBytes));

        // Create file record in database
        const relativePath = getRelativePath('receipts', filename);

        // Get or create Documents folder for the project
        let folderId: number | null = null;
        const folderRow = (await db.get(
          'SELECT id FROM file_folders WHERE project_id = ? AND name = \'Documents\'',
          [projectId as number]
        )) as { id: number } | null;

        if (folderRow) {
          folderId = folderRow.id as number;
        } else {
          // Create Documents folder if it doesn't exist
          const folderResult = await db.run(
            `INSERT INTO file_folders (project_id, name, description, icon, color)
             VALUES (?, 'Documents', 'Project documents and receipts', 'file-text', '#6366F1')`,
            [projectId as number]
          );
          folderId = folderResult.lastID || null;
        }

        // Insert file record
        const fileResult = await db.run(
          `INSERT INTO files (
            project_id, filename, original_filename, file_path, file_type,
            file_size, mime_type, uploaded_by, folder_id, category, description
          ) VALUES (?, ?, ?, ?, 'pdf', ?, 'application/pdf', 'system', ?, 'document', ?)`,
          [
            projectId as number,
            filename,
            `${receiptNumber}.pdf`,
            relativePath,
            pdfBytes.length,
            folderId,
            `Payment receipt for invoice ${String(invoiceRow.invoice_number || '')}`
          ]
        );
        fileId = fileResult.lastID || null;
      } catch (error) {
        console.error('[ReceiptService] Failed to save receipt PDF:', error);
        // Continue without file - receipt record still created
      }
    }

    // Insert receipt record
    const result = await db.run(
      `INSERT INTO receipts (receipt_number, invoice_id, payment_id, amount, file_id)
       VALUES (?, ?, ?, ?, ?)`,
      [receiptNumber, invoiceId, paymentId, amount, fileId]
    );

    return this.getReceiptById(result.lastID!);
  }

  /**
   * Get a receipt by ID
   */
  async getReceiptById(id: number): Promise<Receipt> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT r.*, i.invoice_number,
              c.contact_name as client_name, c.email as client_email,
              p.project_name
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id
       JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE r.id = ?`,
      [id]
    );

    if (!row) {
      throw new Error('Receipt not found');
    }

    return this.transformRow(row as unknown as ReceiptRow);
  }

  /**
   * Get a receipt by receipt number
   */
  async getReceiptByNumber(receiptNumber: string): Promise<Receipt> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT r.*, i.invoice_number,
              c.contact_name as client_name, c.email as client_email,
              p.project_name
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id
       JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE r.receipt_number = ?`,
      [receiptNumber]
    );

    if (!row) {
      throw new Error('Receipt not found');
    }

    return this.transformRow(row as unknown as ReceiptRow);
  }

  /**
   * Get all receipts for an invoice
   */
  async getReceiptsByInvoice(invoiceId: number): Promise<Receipt[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT r.*, i.invoice_number,
              c.contact_name as client_name, c.email as client_email,
              p.project_name
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id
       JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE r.invoice_id = ?
       ORDER BY r.created_at DESC`,
      [invoiceId]
    );

    return rows.map((row) => this.transformRow(row as unknown as ReceiptRow));
  }

  /**
   * Get all receipts for a client
   */
  async getReceiptsByClient(clientId: number): Promise<Receipt[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT r.*, i.invoice_number,
              c.contact_name as client_name, c.email as client_email,
              p.project_name
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id
       JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.client_id = ?
       ORDER BY r.created_at DESC`,
      [clientId]
    );

    return rows.map((row) => this.transformRow(row as unknown as ReceiptRow));
  }

  /**
   * Get receipt PDF bytes for download
   */
  async getReceiptPdf(receiptId: number): Promise<{ pdfBytes: Uint8Array; filename: string }> {
    const db = getDatabase();

    // Get receipt with all related info
    const row = await db.get(
      `SELECT r.*, i.invoice_number, i.project_id,
              c.contact_name as client_name, c.email as client_email, c.company_name,
              p.project_name,
              ip.payment_method, ip.payment_reference, ip.payment_date
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id
       JOIN clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN invoice_payments ip ON r.payment_id = ip.id
       WHERE r.id = ?`,
      [receiptId]
    ) as Record<string, unknown> | null;

    if (!row) {
      throw new Error('Receipt not found');
    }

    // Regenerate PDF (in case original file is missing)
    const paymentDateStr = row.payment_date || row.created_at;
    const pdfData: ReceiptPdfData = {
      receiptNumber: String(row.receipt_number),
      invoiceNumber: String(row.invoice_number || `INV-${row.invoice_id}`),
      paymentDate: new Date(paymentDateStr as string).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      paymentMethod: String(row.payment_method || 'Unknown'),
      paymentReference: row.payment_reference ? String(row.payment_reference) : undefined,
      amount: typeof row.amount === 'string' ? parseFloat(row.amount) : (row.amount as number),
      clientName: String(row.client_name || 'Client'),
      clientEmail: String(row.client_email || ''),
      clientCompany: row.company_name ? String(row.company_name) : undefined,
      projectName: row.project_name ? String(row.project_name) : undefined
    };

    const pdfBytes = await generateReceiptPdf(pdfData);
    const filename = `${row.receipt_number}.pdf`;

    return { pdfBytes, filename };
  }
}

// Export singleton instance
export const receiptService = new ReceiptService();
