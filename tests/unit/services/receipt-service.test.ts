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
  PAGE_MARGINS: { left: 50, right: 50, top: 50, bottom: 50 }
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
  receipt_number: 'RCP-2026-0001',
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
      receiptNumber: 'RCP-2026-0001',
      invoiceNumber: 'INV-0010',
      paymentDate: 'January 15, 2026',
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
      receiptNumber: 'RCP-2026-0002',
      invoiceNumber: 'INV-0011',
      paymentDate: 'February 1, 2026',
      paymentMethod: 'Zelle',
      paymentReference: 'ref-abc',
      amount: 250,
      clientName: 'Bob Jones',
      clientEmail: 'bob@example.com',
      clientCompany: 'Jones LLC',
      projectName: 'Side Project'
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
      receiptNumber: 'RCP-2026-0001',
      invoiceId: 10,
      amount: 1500,
      clientName: 'Alice Smith'
    });
  });

  it('throws when receipt not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(receiptService.getReceiptById(999)).rejects.toThrow('Receipt not found');
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

    const result = await receiptService.getReceiptByNumber('RCP-2026-0001');

    expect(result).toMatchObject({ receiptNumber: 'RCP-2026-0001' });
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('WHERE r.receipt_number = ?'),
      ['RCP-2026-0001']
    );
  });

  it('throws when receipt number not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(receiptService.getReceiptByNumber('RCP-9999-9999')).rejects.toThrow('Receipt not found');
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

    const result = await receiptService.getReceiptPdf(1);

    expect(result).toHaveProperty('pdfBytes');
    expect(result).toHaveProperty('filename');
    expect(result.filename).toBe('RCP-2026-0001.pdf');
    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
  });

  it('throws when receipt not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    await expect(receiptService.getReceiptPdf(999)).rejects.toThrow('Receipt not found');
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

    const result = await receiptService.getReceiptPdf(1);

    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
  });
});

describe('ReceiptService - createReceipt', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('throws when invoice not found', async () => {
    // First db.get is for invoice lookup
    mockDb.get.mockResolvedValueOnce(null);

    await expect(
      receiptService.createReceipt(999, null, 100, { paymentMethod: 'Venmo' })
    ).rejects.toThrow('Invoice not found');
  });

  it('creates a receipt without a project (skips file creation)', async () => {
    // Invoice lookup
    mockDb.get.mockResolvedValueOnce(mockInvoiceRow);
    // generateReceiptNumber: get last receipt number
    mockDb.get.mockResolvedValueOnce(null);
    // Insert receipt record
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    // getReceiptById: final return
    mockDb.get.mockResolvedValueOnce(mockReceiptRow);

    const result = await receiptService.createReceipt(10, 5, 1500, {
      paymentMethod: 'Venmo',
      paymentDate: '2026-01-15'
    });

    expect(result).toMatchObject({ receiptNumber: 'RCP-2026-0001' });
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO receipts'),
      expect.arrayContaining(['RCP-2026-0001', 10, 5, 1500])
    );
  });

  it('generates sequential receipt numbers', async () => {
    // Invoice lookup
    mockDb.get.mockResolvedValueOnce(mockInvoiceRow);
    // Last receipt number returns existing
    mockDb.get.mockResolvedValueOnce({ receipt_number: 'RCP-2026-0003' });
    // Insert receipt
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });
    // getReceiptById
    mockDb.get.mockResolvedValueOnce({ ...mockReceiptRow, receipt_number: 'RCP-2026-0004' });

    const result = await receiptService.createReceipt(10, null, 500, { paymentMethod: 'Zelle' });

    expect(result.receiptNumber).toBe('RCP-2026-0004');
    const insertArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(insertArgs[0]).toBe('RCP-2026-0004');
  });

  it('creates a receipt with a project and saves PDF file', async () => {
    const invoiceWithProject = { ...mockInvoiceRow, project_id: 7, project_name: 'My Project' };
    // Invoice lookup
    mockDb.get.mockResolvedValueOnce(invoiceWithProject);
    // generateReceiptNumber last receipt
    mockDb.get.mockResolvedValueOnce(null);
    // Folder lookup (Documents)
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

  it('continues without file when file save fails', async () => {
    const invoiceWithProject = { ...mockInvoiceRow, project_id: 7 };
    // Invoice lookup
    mockDb.get.mockResolvedValueOnce(invoiceWithProject);
    // generateReceiptNumber
    mockDb.get.mockResolvedValueOnce(null);
    // Folder lookup - throw to simulate file system error
    mockDb.get.mockRejectedValueOnce(new Error('DB error'));
    // Insert receipt (still proceeds)
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    // getReceiptById
    mockDb.get.mockResolvedValueOnce(mockReceiptRow);

    const result = await receiptService.createReceipt(10, null, 1500, { paymentMethod: 'Venmo' });

    expect(result).toBeDefined();
  });
});
