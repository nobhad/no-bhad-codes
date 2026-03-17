/**
 * ===============================================
 * RECEIPT SERVICE
 * ===============================================
 * @file server/services/receipt-service.ts
 *
 * Handles receipt generation, storage, and retrieval.
 * Generates PDF receipts for payments using pdf-lib.
 */

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { getDatabase } from '../database/init.js';
import { getFloat } from '../database/row-helpers.js';
import { BUSINESS_INFO } from '../config/business.js';
import { PDF_COLORS, PDF_TYPOGRAPHY } from '../config/pdf-styles.js';
import { getUploadsSubdir, getRelativePath, sanitizeFilename } from '../config/uploads.js';
import { PAGE_MARGINS, drawPdfDocumentHeader, drawPdfFooter } from '../utils/pdf-utils.js';
import { logger } from './logger.js';

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
  clientPhone?: string;
  clientAddress?: string; // Pre-formatted address string
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
  y = await drawPdfDocumentHeader({
    page,
    pdfDoc,
    fonts: { regular: helvetica, bold: helveticaBold },
    startY: y,
    leftMargin,
    rightMargin,
    title: 'RECEIPT'
  });
  // === PAYMENT RECEIVED — section label with underline ===
  const paymentReceivedLabel = 'PAYMENT RECEIVED';
  page.drawText(paymentReceivedLabel, {
    x: leftMargin,
    y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  const paymentReceivedW = helveticaBold.widthOfTextAtSize(paymentReceivedLabel, PDF_TYPOGRAPHY.bodySize);
  page.drawLine({
    start: { x: leftMargin, y: y - 4 },
    end: { x: leftMargin + paymentReceivedW, y: y - 4 },
    thickness: 0.5,
    color: PDF_COLORS.black
  });
  y -= 20;

  // === CLIENT INFO — section label with underline ===
  const receivedFromLabel = 'RECEIVED FROM:';
  page.drawText(receivedFromLabel, {
    x: leftMargin,
    y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  const receivedFromW = helveticaBold.widthOfTextAtSize(receivedFromLabel, PDF_TYPOGRAPHY.bodySize);
  page.drawLine({
    start: { x: leftMargin, y: y - 4 },
    end: { x: leftMargin + receivedFromW, y: y - 4 },
    thickness: 0.5,
    color: PDF_COLORS.black
  });
  y -= 20;

  page.drawText(data.clientName, {
    x: leftMargin,
    y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  y -= 12;
  if (data.clientCompany) {
    page.drawText(data.clientCompany, {
      x: leftMargin,
      y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    y -= 12;
  }
  page.drawText(data.clientEmail, {
    x: leftMargin,
    y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helvetica,
    color: PDF_COLORS.black
  });
  y -= 12;
  if (data.clientPhone) {
    page.drawText(data.clientPhone, {
      x: leftMargin,
      y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    y -= 12;
  }
  if (data.clientAddress) {
    const addressLines = data.clientAddress.split('\n');
    for (const line of addressLines) {
      page.drawText(line, {
        x: leftMargin,
        y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: helvetica,
        color: PDF_COLORS.black
      });
      y -= 12;
    }
  }
  y -= 18;

  // === PAYMENT DETAILS — table header bar (matches invoice table header) ===
  page.drawRectangle({
    x: leftMargin,
    y: y - 2,
    width: rightMargin - leftMargin,
    height: 18,
    color: PDF_COLORS.tableHeaderBg
  });
  page.drawText('PAYMENT DETAILS', {
    x: leftMargin + 7,
    y: y + 4,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.tableHeaderText
  });
  y -= 22;

  // Detail rows — label bold, value regular, 14px line height
  const detailValueX = leftMargin + 150;
  const drawDetailRow = (label: string, value: string) => {
    page.drawText(label, {
      x: leftMargin + 7,
      y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    page.drawText(value, {
      x: detailValueX,
      y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    y -= 14;
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

  y -= 24;

  // === AMOUNT PAID — right-aligned label:value (matches invoice totals pattern) ===
  const totalsX = rightMargin - 144;

  page.drawLine({
    start: { x: totalsX - 14, y: y + 18 },
    end: { x: rightMargin, y: y + 18 },
    thickness: 2,
    color: PDF_COLORS.divider
  });

  page.drawText('AMOUNT PAID:', {
    x: totalsX,
    y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  const amountText = `$${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const amountWidth = helveticaBold.widthOfTextAtSize(amountText, PDF_TYPOGRAPHY.bodySize);
  page.drawText(amountText, {
    x: rightMargin - amountWidth,
    y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });

  // === FOOTER — shared pattern (HR + thank you + business info) ===
  drawPdfFooter(page, {
    leftMargin,
    rightMargin,
    width,
    fonts: { regular: helvetica, bold: helveticaBold },
    thankYouText: 'Thank you for your payment!'
  });

  return await pdfDoc.save();
}

// ============================================
// RECEIPT SERVICE CLASS
// ============================================

class ReceiptService {
  /**
   * Generate next receipt number with collision-safe retry loop
   */
  private async generateReceiptNumber(): Promise<string> {
    const db = getDatabase();
    const year = new Date().getFullYear();
    const prefix = `RCP-${year}-`;
    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
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

      // Add random offset on retry to avoid repeated collisions
      if (attempt > 0) {
        sequence += attempt;
      }

      const receiptNumber = `${prefix}${String(sequence).padStart(4, '0')}`;

      // Check if this number already exists before returning
      const existing = await db.get(
        'SELECT 1 FROM receipts WHERE receipt_number = ?',
        [receiptNumber]
      );

      if (!existing) {
        return receiptNumber;
      }

      logger.warn(`[ReceiptService] Receipt number collision on ${receiptNumber}, retrying (attempt ${attempt + 1})`);
    }

    // Final fallback: use timestamp-based unique number
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${timestamp}`;
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
      amount: getFloat(row as unknown as Record<string, unknown>, 'amount'),
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
              COALESCE(c.billing_name, c.contact_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email,
              COALESCE(c.billing_company, c.company_name) as company_name,
              COALESCE(c.billing_phone, c.phone) as client_phone,
              c.billing_address, c.billing_address2,
              c.billing_city, c.billing_state, c.billing_zip, c.billing_country,
              p.project_name
       FROM invoices i
       JOIN clients c ON i.client_id = c.id AND c.deleted_at IS NULL
       LEFT JOIN projects p ON i.project_id = p.id AND p.deleted_at IS NULL
       WHERE i.id = ? AND i.deleted_at IS NULL`,
      [invoiceId]
    );

    if (!invoiceRow) {
      throw new Error('Invoice not found');
    }

    const receiptNumber = await this.generateReceiptNumber();
    const paymentDate = paymentData.paymentDate || new Date().toISOString().split('T')[0];

    // Build formatted billing address
    const addressParts: string[] = [];
    if (invoiceRow.billing_address) addressParts.push(String(invoiceRow.billing_address));
    if (invoiceRow.billing_address2) addressParts.push(String(invoiceRow.billing_address2));
    const cityStateZip = [
      invoiceRow.billing_city,
      invoiceRow.billing_state,
      invoiceRow.billing_zip
    ].filter(Boolean).join(', ');
    if (cityStateZip) addressParts.push(cityStateZip);
    if (invoiceRow.billing_country && String(invoiceRow.billing_country) !== 'US' && String(invoiceRow.billing_country) !== 'United States') {
      addressParts.push(String(invoiceRow.billing_country));
    }
    const formattedAddress = addressParts.length > 0 ? addressParts.join('\n') : undefined;

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
      clientPhone: invoiceRow.client_phone ? String(invoiceRow.client_phone) : undefined,
      clientAddress: formattedAddress,
      projectName: invoiceRow.project_name ? String(invoiceRow.project_name) : undefined
    };

    const pdfBytes = await generateReceiptPdf(pdfData);

    // Run DB operations in a transaction: folder, file record, receipt record
    const projectId = invoiceRow.project_id as number | null;
    const filename = sanitizeFilename(`${receiptNumber}.pdf`);
    const relativePath = projectId ? getRelativePath('receipts', filename) : null;

    const { receiptId, fileId } = await db.transaction(async (ctx) => {
      let txFileId: number | null = null;

      if (projectId && relativePath) {
        // Get or create Documents folder for the project
        const folderRow = (await ctx.get(
          'SELECT id FROM file_folders WHERE project_id = ? AND name = \'Documents\'',
          [projectId as number]
        )) as { id: number } | undefined;

        let folderId: number | null = null;
        if (folderRow) {
          folderId = folderRow.id as number;
        } else {
          const folderResult = await ctx.run(
            `INSERT INTO file_folders (project_id, name, description, icon, color)
             VALUES (?, 'Documents', 'Project documents and receipts', 'file-text', '#6366F1')`,
            [projectId as number]
          );
          folderId = folderResult.lastID || null;
        }

        // Insert file record
        const fileResult = await ctx.run(
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
        txFileId = fileResult.lastID || null;
      }

      // Insert receipt record
      const receiptResult = await ctx.run(
        `INSERT INTO receipts (receipt_number, invoice_id, payment_id, amount, file_id)
         VALUES (?, ?, ?, ?, ?)`,
        [receiptNumber, invoiceId, paymentId, amount, txFileId]
      );

      return { receiptId: receiptResult.lastID!, fileId: txFileId };
    });

    // Write PDF to disk AFTER transaction succeeds (non-critical — DB records are the source of truth)
    if (projectId && fileId) {
      try {
        const receiptsDir = getUploadsSubdir('receipts');
        const filePath = join(receiptsDir, filename);
        await writeFile(filePath, Buffer.from(pdfBytes));
      } catch (diskError) {
        logger.error('[ReceiptService] Failed to write receipt PDF to disk (DB records saved):', {
          error: diskError instanceof Error ? diskError : undefined
        });
      }
    }

    // Send receipt email notification (non-critical)
    if (pdfData.clientEmail) {
      try {
        const { emailService } = await import('./email-service.js');
        await emailService.sendEmail({
          to: pdfData.clientEmail,
          subject: `Payment Receipt ${receiptNumber} - ${BUSINESS_INFO.name}`,
          text: `Thank you for your payment of $${amount.toFixed(2)}.\n\nReceipt Number: ${receiptNumber}\nInvoice: ${pdfData.invoiceNumber}\nDate: ${pdfData.paymentDate}\nMethod: ${pdfData.paymentMethod}\n\nThis receipt confirms your payment has been received. Please retain for your records.\n\n${BUSINESS_INFO.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Payment Receipt</h2>
              <p>Thank you for your payment of <strong>$${amount.toFixed(2)}</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Receipt Number</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${receiptNumber}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Invoice</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${pdfData.invoiceNumber}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Payment Date</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${pdfData.paymentDate}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Payment Method</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${pdfData.paymentMethod}</td></tr>
                ${pdfData.projectName ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Project</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${pdfData.projectName}</td></tr>` : ''}
              </table>
              <p style="color: #666; font-size: 14px;">This receipt confirms your payment has been received. You can view and download your receipt from the client portal.</p>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">${BUSINESS_INFO.name} &bull; ${BUSINESS_INFO.email}</p>
            </div>
          `
        });
      } catch (emailError) {
        logger.error('[ReceiptService] Failed to send receipt email notification:', {
          error: emailError instanceof Error ? emailError : undefined
        });
        // Non-critical — don't fail receipt creation
      }
    }

    return this.getReceiptById(receiptId);
  }

  /**
   * Get a receipt by ID
   */
  async getReceiptById(id: number): Promise<Receipt> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT r.*, i.invoice_number,
              COALESCE(c.billing_name, c.contact_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email,
              p.project_name
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id AND i.deleted_at IS NULL
       JOIN clients c ON i.client_id = c.id AND c.deleted_at IS NULL
       LEFT JOIN projects p ON i.project_id = p.id AND p.deleted_at IS NULL
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
              COALESCE(c.billing_name, c.contact_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email,
              p.project_name
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id AND i.deleted_at IS NULL
       JOIN clients c ON i.client_id = c.id AND c.deleted_at IS NULL
       LEFT JOIN projects p ON i.project_id = p.id AND p.deleted_at IS NULL
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
              COALESCE(c.billing_name, c.contact_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email,
              p.project_name
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id AND i.deleted_at IS NULL
       JOIN clients c ON i.client_id = c.id AND c.deleted_at IS NULL
       LEFT JOIN projects p ON i.project_id = p.id AND p.deleted_at IS NULL
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
              COALESCE(c.billing_name, c.contact_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email,
              p.project_name
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id AND i.deleted_at IS NULL
       JOIN clients c ON i.client_id = c.id AND c.deleted_at IS NULL
       LEFT JOIN projects p ON i.project_id = p.id AND p.deleted_at IS NULL
       WHERE i.client_id = ?
       ORDER BY r.created_at DESC`,
      [clientId]
    );

    return rows.map((row) => this.transformRow(row as unknown as ReceiptRow));
  }

  /**
   * Get all receipts with joined info (admin use)
   */
  async getAllReceipts(): Promise<Receipt[]> {
    const db = getDatabase();
    const ALL_RECEIPTS_LIMIT = 100;
    const rows = await db.all(
      `SELECT r.*, i.invoice_number,
              COALESCE(c.billing_name, c.contact_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email,
              p.project_name
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id AND i.deleted_at IS NULL
       JOIN clients c ON i.client_id = c.id AND c.deleted_at IS NULL
       LEFT JOIN projects p ON i.project_id = p.id AND p.deleted_at IS NULL
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [ALL_RECEIPTS_LIMIT]
    );

    return rows.map((row) => this.transformRow(row as unknown as ReceiptRow));
  }

  /**
   * Check if a client can access a specific receipt
   */
  async canClientAccessReceipt(clientId: number, receiptId: number): Promise<boolean> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT 1 FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id AND i.deleted_at IS NULL
       WHERE r.id = ? AND i.client_id = ?`,
      [receiptId, clientId]
    );
    return !!row;
  }

  /**
   * Check if a client can access receipts for a specific invoice
   */
  async canClientAccessInvoiceReceipts(clientId: number, invoiceId: number): Promise<boolean> {
    const db = getDatabase();
    const row = await db.get(
      'SELECT 1 FROM invoices WHERE id = ? AND client_id = ? AND deleted_at IS NULL',
      [invoiceId, clientId]
    );
    return !!row;
  }

  /**
   * Get receipt PDF bytes for download
   */
  async getReceiptPdf(receiptId: number): Promise<{ pdfBytes: Uint8Array; filename: string }> {
    const db = getDatabase();

    // Get receipt with all related info
    const row = (await db.get(
      `SELECT r.*, i.invoice_number, i.project_id,
              COALESCE(c.billing_name, c.contact_name) as client_name,
              COALESCE(c.billing_email, c.email) as client_email,
              COALESCE(c.billing_company, c.company_name) as company_name,
              COALESCE(c.billing_phone, c.phone) as client_phone,
              c.billing_address, c.billing_address2,
              c.billing_city, c.billing_state, c.billing_zip, c.billing_country,
              p.project_name,
              ip.payment_method, ip.payment_reference, ip.payment_date
       FROM receipts r
       JOIN invoices i ON r.invoice_id = i.id AND i.deleted_at IS NULL
       JOIN clients c ON i.client_id = c.id AND c.deleted_at IS NULL
       LEFT JOIN projects p ON i.project_id = p.id AND p.deleted_at IS NULL
       LEFT JOIN invoice_payments ip ON r.payment_id = ip.id
       WHERE r.id = ?`,
      [receiptId]
    )) as Record<string, unknown> | null;

    if (!row) {
      throw new Error('Receipt not found');
    }

    // Regenerate PDF (in case original file is missing)
    const paymentDateStr = row.payment_date || row.created_at;

    // Build address
    const addressParts: string[] = [];
    if (row.billing_address) addressParts.push(String(row.billing_address));
    if (row.billing_address2) addressParts.push(String(row.billing_address2));
    const cityStateZip = [row.billing_city, row.billing_state, row.billing_zip].filter(Boolean).join(', ');
    if (cityStateZip) addressParts.push(cityStateZip);
    if (row.billing_country && String(row.billing_country) !== 'US' && String(row.billing_country) !== 'United States') {
      addressParts.push(String(row.billing_country));
    }

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
      amount: getFloat(row as unknown as Record<string, unknown>, 'amount'),
      clientName: String(row.client_name || 'Client'),
      clientEmail: String(row.client_email || ''),
      clientCompany: row.company_name ? String(row.company_name) : undefined,
      clientPhone: row.client_phone ? String(row.client_phone) : undefined,
      clientAddress: addressParts.length > 0 ? addressParts.join('\n') : undefined,
      projectName: row.project_name ? String(row.project_name) : undefined
    };

    const pdfBytes = await generateReceiptPdf(pdfData);
    const filename = `${row.receipt_number}.pdf`;

    return { pdfBytes, filename };
  }
}

// Export singleton instance
export const receiptService = new ReceiptService();
