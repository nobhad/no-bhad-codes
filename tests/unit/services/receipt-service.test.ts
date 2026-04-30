/**
 * ===============================================
 * UNIT TESTS - RECEIPT SERVICE
 * ===============================================
 * @file tests/unit/services/receipt-service.test.ts
 *
 * Tests for receipt service including:
 * - Receipt creation and PDF generation
 * - Receipt retrieval by ID and number
 * - Receipt listing by invoice and client
 * - Receipt PDF download data
 * - Error handling for missing records
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../server/database/row-helpers', () => ({
  getFloat: vi.fn((row: Record<string, unknown>, key: string) => Number(row[key]) || 0)
}));

vi.mock('../../../server/config/business', () => ({
  BUSINESS_INFO: {
    name: 'No Bhad Codes',
    owner: 'Noelle Bhaduri',
    tagline: 'Web Development & Design',
    email: 'test@example.com',
    website: 'nobhad.codes'
  },
  getPdfLogoBytes: vi.fn(() => null)
}));

vi.mock('../../../server/config/uploads', () => ({
  getUploadsSubdir: vi.fn(() => '/tmp/receipts'),
  getRelativePath: vi.fn((subdir: string, filename: string) => `${subdir}/${filename}`),
  sanitizeFilename: vi.fn((name: string) => name)
}));

vi.mock('../../../server/utils/pdf-utils', () => ({
  PAGE_MARGINS: { left: 50, right: 50, top: 50, bottom: 50 },
  drawPdfDocumentHeader: vi.fn().mockResolvedValue(700),
  drawPdfFooter: vi.fn(),
  drawTwoColumnInfo: vi.fn().mockReturnValue(600),
  // Custom-font path: receipt-service registers fontkit and embeds
  // bytes for regular + bold so the rendered PDF gets the same brand
  // font as everywhere else.
  getRegularFontBytes: vi.fn().mockReturnValue(Buffer.from([])),
  getBoldFontBytes: vi.fn().mockReturnValue(Buffer.from([])),
  registerFontkit: vi.fn()
}));

vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn()
  },
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn()
}));

// Mock pdf-lib so PDF generation does not require a real PDF engine in tests
vi.mock('pdf-lib', () => {
  const mockFont = {
    widthOfTextAtSize: vi.fn(() => 100)
  };
  const mockPage = {
    getSize: vi.fn(() => ({ width: 612, height: 792 })),
    drawText: vi.fn(),
    drawLine: vi.fn(),
    drawRectangle: vi.fn(),
    drawImage: vi.fn()
  };
  const mockPdfDoc = {
    setTitle: vi.fn(),
    setAuthor: vi.fn(),
    setSubject: vi.fn(),
    setCreator: vi.fn(),
    embedFont: vi.fn(() => Promise.resolve(mockFont)),
    embedPng: vi.fn(() => Promise.resolve({ width: 100, height: 50 })),
    addPage: vi.fn(() => mockPage),
    save: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3])))
  };
  return {
    PDFDocument: { create: vi.fn(() => Promise.resolve(mockPdfDoc)) },
    StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold' },
    rgb: vi.fn(() => ({ r: 0, g: 0, b: 0 }))
  };
});

// Import after mocks
import { receiptService, generateReceiptPdf } from '../../../server/services/receipt-service';
import type { ReceiptPdfData } from '../../../server/services/receipt-service';

const mockReceiptRow = {
  id: 1,
  receipt_number: 'REC-202601-XX001',
  invoice_id: 10,
  payment_id: 5,
  amount: 1500,
  file_id: null,
  created_at: '2026-01-15T00:00:00Z',
  invoice_number: 'INV-0010',
  client_name: 'Alice Smith',
  client_email: 'alice@example.com',
  project_name: 'My Project'
};

const mockInvoiceRow = {
  invoice_number: 'INV-0010',
  project_id: null,
  client_name: 'Alice Smith',
  client_email: 'alice@example.com',
  company_name: null,
  project_name: null
};

describe('generateReceiptPdf (standalone export)', () => {
  it('generates a PDF and returns Uint8Array', async () => {
    const data: ReceiptPdfData = {
      receiptNumber: 'REC-202601-XX001',
      invoiceNumber: 'INV-0010',
      datePaid: 'January 15, 2026',
      dateGenerated: 'January 15, 2026',
      paymentMethod: 'Venmo',
      amount: 1500,
      clientName: 'Alice Smith',
      clientEmail: 'alice@example.com'
    };

    const result = await generateReceiptPdf(data);

    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('handles optional fields like paymentReference and projectName', async () => {
    const data: ReceiptPdfData = {
      receiptNumber: 'REC-202601-XX002',
      invoiceNumber: 'INV-0011',
      datePaid: 'February 1, 2026',
      dateGenerated: 'February 1, 2026',
      paymentMethod: 'Zelle',
      paymentReference: 'ref-abc',
      paymentLabel: 'Payment 1 of 2',
      amount: 250,
      clientName: 'Bob Jones',
      clientEmail: 'bob@example.com',
      clientCompany: 'Jones LLC',
      projectName: 'Side Project',
      lineItems: [
        { description: 'Web Development', amount: 500 },
        { description: 'Deposit Credit', amount: -250 }
      ]
    };

    const result = await generateReceiptPdf(data);

    expect(result).toBeInstanceOf(Uint8Array);
  });
});

describe('ReceiptService - getReceiptById', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns a receipt for a valid id', async () => {
    mockDb.get.mockResolvedValueOnce(mockReceiptRow);

    const result = await receiptService.getReceiptById(1);

    expect(result).toMatchObject({
      id: 1,
      receiptNumber: 'REC-202601-XX001',
      invoiceId: 10,
      amount: 1500,
      clientName: 'Alice Smith'
    });
  });

  it('throws when receipt not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(receiptService.getReceiptById(999)).rejects.toThrow(/receipt not found/i);
  });
});

describe('ReceiptService - getReceiptByNumber', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns a receipt for a valid receipt number', async () => {
    mockDb.get.mockResolvedValueOnce(mockReceiptRow);

    const result = await receiptService.getReceiptByNumber('REC-202601-XX001');

    expect(result).toMatchObject({ receiptNumber: 'REC-202601-XX001' });
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('WHERE r.receipt_number = ?'),
      ['REC-202601-XX001']
    );
  });

  it('throws when receipt number not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(receiptService.getReceiptByNumber('RCP-9999-9999')).rejects.toThrow(/receipt not found/i);
  });
});

describe('ReceiptService - getReceiptsByInvoice', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns all receipts for an invoice', async () => {
    mockDb.all.mockResolvedValueOnce([mockReceiptRow]);

    const result = await receiptService.getReceiptsByInvoice(10);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ invoiceId: 10 });
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE r.invoice_id = ?'),
      [10]
    );
  });

  it('returns empty array when no receipts exist', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const result = await receiptService.getReceiptsByInvoice(10);

    expect(result).toHaveLength(0);
  });
});

describe('ReceiptService - getReceiptsByClient', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns all receipts for a client', async () => {
    mockDb.all.mockResolvedValueOnce([mockReceiptRow]);

    const result = await receiptService.getReceiptsByClient(3);

    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE i.client_id = ?'),
      [3]
    );
  });

  it('returns empty array when client has no receipts', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const result = await receiptService.getReceiptsByClient(99);

    expect(result).toHaveLength(0);
  });
});

describe('ReceiptService - getReceiptPdf', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('generates and returns PDF bytes and filename', async () => {
    mockDb.get.mockResolvedValueOnce({
      ...mockReceiptRow,
      invoice_number: 'INV-0010',
      invoice_id: 10,
      company_name: null,
      project_name: null,
      payment_method: 'Venmo',
      payment_reference: null,
      payment_date: '2026-01-15'
    });
    // getReceiptPdf also pulls invoice line items for the receipt body.
    mockDb.all.mockResolvedValueOnce([]);

    const result = await receiptService.getReceiptPdf(1);

    expect(result).toHaveProperty('pdfBytes');
    expect(result).toHaveProperty('filename');
    expect(result.filename).toBe('REC-202601-XX001.pdf');
    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
  });

  it('throws when receipt not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(receiptService.getReceiptPdf(999)).rejects.toThrow(/receipt not found/i);
  });

  it('handles missing payment_date by falling back to created_at', async () => {
    mockDb.get.mockResolvedValueOnce({
      ...mockReceiptRow,
      invoice_number: 'INV-0010',
      invoice_id: 10,
      company_name: null,
      project_name: null,
      payment_method: null,
      payment_reference: null,
      payment_date: null
    });
    mockDb.all.mockResolvedValueOnce([]);

    const result = await receiptService.getReceiptPdf(1);

    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
  });
});

describe('ReceiptService - createReceipt', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    mockDb.transaction.mockReset();
    // createReceipt fetches invoice line items via db.all to embed
    // them in the PDF body. Default to no items unless a test
    // overrides — keeps the per-test mock chains terse.
    mockDb.all.mockResolvedValue([]);
    // The insert path moved into db.transaction(cb => ...) and
    // destructures { receiptId, fileId } from its return. Run the cb
    // with ctx === db so the per-test get/run mocks still record
    // calls, then return whatever the cb produced (or a sane default).
    mockDb.transaction.mockImplementation(async (cb: (ctx: typeof mockDb) => Promise<unknown>) => {
      const result = await cb(mockDb);
      return result ?? { receiptId: 1, fileId: null };
    });
    // Lock time so generateReceiptNumber's prefix is deterministic.
    // Existing assertions compare against REC-202601-XX… so January is
    // the simplest target.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when invoice not found', async () => {
    // First db.get is for invoice lookup
    mockDb.get.mockResolvedValueOnce(null);

    await expect(
      receiptService.createReceipt(999, null, 100, { paymentMethod: 'Venmo' })
    ).rejects.toThrow(/invoice not found/i);
  });

  it('creates a receipt without a project (skips file creation)', async () => {
    // Invoice lookup
    mockDb.get.mockResolvedValueOnce(mockInvoiceRow);
    // generateReceiptNumber: SELECT last receipt for prefix
    mockDb.get.mockResolvedValueOnce(null);
    // generateReceiptNumber: SELECT 1 to verify the new number is unique
    mockDb.get.mockResolvedValueOnce(null);
    // Payment count for "Payment X of Y" label
    mockDb.get.mockResolvedValueOnce({ total: 1 });
    // Insert receipt record (inside transaction)
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    // getReceiptById: final return
    mockDb.get.mockResolvedValueOnce(mockReceiptRow);

    const result = await receiptService.createReceipt(10, 5, 1500, {
      paymentMethod: 'Venmo',
      paymentDate: '2026-01-15'
    });

    expect(result).toMatchObject({ receiptNumber: 'REC-202601-XX001' });
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO receipts'),
      expect.arrayContaining(['REC-202601-XX001', 10, 5, 1500])
    );
  });

  it('generates sequential receipt numbers', async () => {
    // Invoice lookup
    mockDb.get.mockResolvedValueOnce(mockInvoiceRow);
    // generateReceiptNumber: last receipt for prefix
    mockDb.get.mockResolvedValueOnce({ receipt_number: 'REC-202601-XX003' });
    // generateReceiptNumber: uniqueness check
    mockDb.get.mockResolvedValueOnce(null);
    // Payment count for "Payment X of Y" label
    mockDb.get.mockResolvedValueOnce({ total: 1 });
    // Insert receipt
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });
    // getReceiptById
    mockDb.get.mockResolvedValueOnce({ ...mockReceiptRow, receipt_number: 'REC-202601-XX004' });

    const result = await receiptService.createReceipt(10, null, 500, { paymentMethod: 'Zelle' });

    expect(result.receiptNumber).toBe('REC-202601-XX004');
    const insertArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(insertArgs[0]).toBe('REC-202601-XX004');
  });

  it('creates a receipt with a project and saves PDF file', async () => {
    const invoiceWithProject = { ...mockInvoiceRow, project_id: 7, project_name: 'My Project' };
    // Invoice lookup
    mockDb.get.mockResolvedValueOnce(invoiceWithProject);
    // generateReceiptNumber: last receipt for prefix
    mockDb.get.mockResolvedValueOnce(null);
    // generateReceiptNumber: uniqueness check
    mockDb.get.mockResolvedValueOnce(null);
    // Payment count for "Payment X of Y" label
    mockDb.get.mockResolvedValueOnce({ total: 1 });
    // Folder lookup (Documents) — inside transaction
    mockDb.get.mockResolvedValueOnce({ id: 10 });
    // Insert file record
    mockDb.run.mockResolvedValueOnce({ lastID: 20 });
    // Insert receipt record
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    // getReceiptById
    mockDb.get.mockResolvedValueOnce(mockReceiptRow);

    const result = await receiptService.createReceipt(10, 5, 1500, { paymentMethod: 'Venmo' });

    expect(result).toBeDefined();
  });

  it('rolls back the receipt insert if the file/folder write fails inside the transaction', async () => {
    // The folder lookup, file insert, and receipt insert are now
    // wrapped in a single db.transaction. A folder-lookup failure
    // must abort the receipt write — anything else would leak a
    // receipt row pointing at a file that never existed. (PDF
    // disk write happens after commit and is the only step that
    // is allowed to fail non-fatally; that's a separate concern.)
    const invoiceWithProject = { ...mockInvoiceRow, project_id: 7 };
    mockDb.get.mockResolvedValueOnce(invoiceWithProject);
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.get.mockResolvedValueOnce({ total: 1 });
    // Folder lookup inside the transaction throws.
    mockDb.get.mockRejectedValueOnce(new Error('DB error'));

    await expect(
      receiptService.createReceipt(10, 5, 1500, { paymentMethod: 'Venmo' })
    ).rejects.toThrow(/DB error/);
  });
});
