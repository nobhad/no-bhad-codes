/**
 * ===============================================
 * PDF GENERATION TESTS
 * ===============================================
 * @file tests/unit/services/pdf-generation.test.ts
 *
 * Unit tests for PDF generation services.
 * Tests: Invoice, Receipt, Questionnaire, and Proposal PDFs
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock pdf-lib
const mockPdfDoc = {
  setTitle: vi.fn(),
  setAuthor: vi.fn(),
  setSubject: vi.fn(),
  setCreator: vi.fn(),
  setProducer: vi.fn(),
  setKeywords: vi.fn(),
  addPage: vi.fn().mockReturnValue({
    getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
    drawText: vi.fn(),
    drawLine: vi.fn(),
    drawRectangle: vi.fn(),
    drawImage: vi.fn()
  }),
  embedFont: vi.fn().mockResolvedValue({
    widthOfTextAtSize: vi.fn().mockReturnValue(100),
    heightAtSize: vi.fn().mockReturnValue(12)
  }),
  embedPng: vi.fn().mockResolvedValue({
    width: 200,
    height: 100,
    scale: vi.fn().mockReturnValue({ width: 100, height: 50 })
  }),
  getPages: vi.fn().mockReturnValue([]),
  save: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])) // %PDF
};

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: vi.fn().mockResolvedValue(mockPdfDoc)
  },
  StandardFonts: {
    Helvetica: 'Helvetica',
    HelveticaBold: 'Helvetica-Bold'
  },
  rgb: vi.fn().mockReturnValue({ type: 'RGB', red: 0, green: 0, blue: 0 })
}));

// Mock database
const mockDb = vi.hoisted(() => ({
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn()
}));

vi.mock('../../../server/database/init', () => ({
  getDatabase: () => mockDb
}));

// Mock business config
vi.mock('../../../server/config/business', () => ({
  BUSINESS_INFO: {
    name: 'Test Business',
    owner: 'Test Owner',
    tagline: 'Test Tagline',
    email: 'test@example.com',
    website: 'https://example.com',
    zelleEmail: 'zelle@example.com',
    venmoHandle: '@testvenmo'
  },
  getPdfLogoBytes: vi.fn().mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47])) // PNG header
}));

// Mock uploads config
vi.mock('../../../server/config/uploads', () => ({
  getUploadsSubdir: vi.fn().mockReturnValue('/uploads/test'),
  getRelativePath: vi.fn().mockReturnValue('test/file.pdf'),
  sanitizeFilename: vi.fn().mockImplementation((name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_'))
}));

// Mock fs - support both default and named imports
const mockFs = {
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('test')),
  createWriteStream: vi.fn().mockReturnValue({
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn()
  }),
  appendFileSync: vi.fn(),
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('test')),
    access: vi.fn().mockResolvedValue(undefined)
  }
};

vi.mock('fs', () => ({
  default: mockFs,
  ...mockFs
}));

// Mock user service
vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(1)
  }
}));

// Mock logger to avoid fs dependency issues
vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock path module
vi.mock('path', () => ({
  default: {
    join: vi.fn().mockImplementation((...args: string[]) => args.join('/')),
    dirname: vi.fn().mockImplementation((p: string) => p.split('/').slice(0, -1).join('/')),
    basename: vi.fn().mockImplementation((p: string) => p.split('/').pop())
  },
  join: vi.fn().mockImplementation((...args: string[]) => args.join('/')),
  dirname: vi.fn().mockImplementation((p: string) => p.split('/').slice(0, -1).join('/')),
  basename: vi.fn().mockImplementation((p: string) => p.split('/').pop())
}));

describe('PDF Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.run.mockReset();
    mockDb.get.mockReset();
    mockDb.all.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Invoice PDF Tests
  // ============================================

  describe('Invoice PDF', () => {
    it('generates a valid PDF with required fields', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'INV-2026-001',
        issuedDate: '2026-02-12',
        dueDate: '2026-03-12',
        clientName: 'John Doe',
        clientEmail: 'john@example.com',
        lineItems: [
          { description: 'Web Development', quantity: 10, rate: 150, amount: 1500 }
        ],
        subtotal: 1500,
        total: 1500
      };

      const pdfBytes = await generateInvoicePdf(invoiceData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(0);
      expect(mockPdfDoc.setTitle).toHaveBeenCalledWith('Invoice INV-2026-001');
      expect(mockPdfDoc.addPage).toHaveBeenCalled();
    });

    it('includes client company and address when provided', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'INV-2026-002',
        issuedDate: '2026-02-12',
        clientName: 'Jane Smith',
        clientCompany: 'Acme Corp',
        clientEmail: 'jane@acme.com',
        clientAddress: '123 Main St',
        clientCityStateZip: 'New York, NY 10001',
        lineItems: [
          { description: 'Design Services', quantity: 5, rate: 200, amount: 1000 }
        ],
        subtotal: 1000,
        total: 1000
      };

      const pdfBytes = await generateInvoicePdf(invoiceData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('handles multiple line items', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'INV-2026-003',
        issuedDate: '2026-02-12',
        clientName: 'Test Client',
        clientEmail: 'test@example.com',
        lineItems: [
          { description: 'Design', quantity: 1, rate: 500, amount: 500 },
          { description: 'Development', quantity: 10, rate: 100, amount: 1000 },
          { description: 'Testing', quantity: 5, rate: 50, amount: 250 },
          { description: 'Deployment', quantity: 1, rate: 200, amount: 200 }
        ],
        subtotal: 1950,
        total: 1950
      };

      const pdfBytes = await generateInvoicePdf(invoiceData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('calculates with tax and discount', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'INV-2026-004',
        issuedDate: '2026-02-12',
        clientName: 'Client With Tax',
        clientEmail: 'tax@example.com',
        lineItems: [
          { description: 'Services', quantity: 1, rate: 1000, amount: 1000 }
        ],
        subtotal: 1000,
        tax: 80, // 8% tax
        discount: 100,
        total: 980
      };

      const pdfBytes = await generateInvoicePdf(invoiceData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('includes deposit credit information', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'INV-2026-005',
        issuedDate: '2026-02-12',
        clientName: 'Deposit Client',
        clientEmail: 'deposit@example.com',
        lineItems: [
          { description: 'Final Payment', quantity: 1, rate: 5000, amount: 5000 }
        ],
        subtotal: 5000,
        credits: [
          { depositInvoiceNumber: 'INV-2026-001', amount: 1500 }
        ],
        totalCredits: 1500,
        total: 3500
      };

      const pdfBytes = await generateInvoicePdf(invoiceData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('handles deposit invoice type', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'DEP-2026-001',
        issuedDate: '2026-02-12',
        clientName: 'Deposit Payer',
        clientEmail: 'payer@example.com',
        lineItems: [
          { description: '30% Deposit - Web Project', quantity: 1, rate: 1500, amount: 1500 }
        ],
        subtotal: 1500,
        total: 1500,
        isDeposit: true,
        depositPercentage: 30
      };

      const pdfBytes = await generateInvoicePdf(invoiceData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('includes notes and terms', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'INV-2026-006',
        issuedDate: '2026-02-12',
        clientName: 'Notes Client',
        clientEmail: 'notes@example.com',
        lineItems: [
          { description: 'Consulting', quantity: 2, rate: 250, amount: 500 }
        ],
        subtotal: 500,
        total: 500,
        notes: 'Thank you for your business!',
        terms: 'Payment due within 30 days. Late payments subject to 1.5% monthly interest.'
      };

      const pdfBytes = await generateInvoicePdf(invoiceData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('handles line items with details', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'INV-2026-007',
        issuedDate: '2026-02-12',
        clientName: 'Detailed Client',
        clientEmail: 'detailed@example.com',
        lineItems: [
          {
            description: 'Website Development',
            quantity: 1,
            rate: 5000,
            amount: 5000,
            details: [
              'Homepage design and development',
              'About page',
              'Contact form with validation',
              'Mobile responsive layout'
            ]
          }
        ],
        subtotal: 5000,
        total: 5000
      };

      const pdfBytes = await generateInvoicePdf(invoiceData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });
  });

  // ============================================
  // Receipt PDF Tests
  // ============================================

  describe('Receipt PDF', () => {
    it('generates a valid receipt PDF', async () => {
      const { generateReceiptPdf } = await import('../../../server/services/receipt-service');

      const receiptData = {
        receiptNumber: 'REC-2026-001',
        invoiceNumber: 'INV-2026-001',
        paymentDate: '2026-02-12',
        paymentMethod: 'Credit Card',
        amount: 1500,
        clientName: 'John Doe',
        clientEmail: 'john@example.com'
      };

      const pdfBytes = await generateReceiptPdf(receiptData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(0);
      expect(mockPdfDoc.setTitle).toHaveBeenCalledWith('Receipt REC-2026-001');
      expect(mockPdfDoc.setSubject).toHaveBeenCalledWith('Payment Receipt');
    });

    it('includes payment reference when provided', async () => {
      const { generateReceiptPdf } = await import('../../../server/services/receipt-service');

      const receiptData = {
        receiptNumber: 'REC-2026-002',
        invoiceNumber: 'INV-2026-002',
        paymentDate: '2026-02-12',
        paymentMethod: 'Bank Transfer',
        paymentReference: 'TXN-123456789',
        amount: 2500,
        clientName: 'Jane Smith',
        clientEmail: 'jane@example.com'
      };

      const pdfBytes = await generateReceiptPdf(receiptData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('includes client company and project name', async () => {
      const { generateReceiptPdf } = await import('../../../server/services/receipt-service');

      const receiptData = {
        receiptNumber: 'REC-2026-003',
        invoiceNumber: 'INV-2026-003',
        paymentDate: '2026-02-12',
        paymentMethod: 'Zelle',
        amount: 3000,
        clientName: 'Bob Wilson',
        clientEmail: 'bob@company.com',
        clientCompany: 'Wilson Industries',
        projectName: 'E-commerce Platform'
      };

      const pdfBytes = await generateReceiptPdf(receiptData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('handles different payment methods', async () => {
      const { generateReceiptPdf } = await import('../../../server/services/receipt-service');

      const paymentMethods = ['Credit Card', 'Debit Card', 'Bank Transfer', 'Zelle', 'Venmo', 'Check', 'Cash'];

      for (const method of paymentMethods) {
        const receiptData = {
          receiptNumber: `REC-${method.replace(/\s/g, '')}`,
          invoiceNumber: 'INV-TEST',
          paymentDate: '2026-02-12',
          paymentMethod: method,
          amount: 100,
          clientName: 'Test Client',
          clientEmail: 'test@example.com'
        };

        const pdfBytes = await generateReceiptPdf(receiptData);
        expect(pdfBytes).toBeInstanceOf(Uint8Array);
      }
    });

    it('formats currency amounts correctly', async () => {
      const { generateReceiptPdf } = await import('../../../server/services/receipt-service');

      const receiptData = {
        receiptNumber: 'REC-2026-004',
        invoiceNumber: 'INV-2026-004',
        paymentDate: '2026-02-12',
        paymentMethod: 'Credit Card',
        amount: 12345.67,
        clientName: 'Currency Client',
        clientEmail: 'currency@example.com'
      };

      const pdfBytes = await generateReceiptPdf(receiptData);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });
  });

  // ============================================
  // Questionnaire PDF Tests
  // ============================================

  describe('Questionnaire PDF', () => {
    // Helper to setup mock for two sequential db.get calls (response then questionnaire)
    const setupQuestionnaireMocks = (responseData: object, questionnaireData: object) => {
      mockDb.get
        .mockResolvedValueOnce(responseData)   // First call: getResponse
        .mockResolvedValueOnce(questionnaireData);  // Second call: getQuestionnaire
    };

    const baseQuestionnaire = {
      id: 1,
      name: 'Project Discovery',
      description: 'Initial project questionnaire',
      is_active: 1,
      display_order: 1,
      questions: JSON.stringify([
        { id: 'q1', type: 'text', question: 'What is your business name?' },
        { id: 'q2', type: 'textarea', question: 'Describe your project goals.' },
        { id: 'q3', type: 'multiselect', question: 'Which features do you need?', options: ['Option A', 'Option B', 'Option C'] }
      ])
    };

    const baseResponse = {
      id: 1,
      questionnaire_id: 1,
      client_id: 1,
      project_id: 1,
      answers: JSON.stringify({
        q1: 'Answer to question 1',
        q2: 'Answer to question 2',
        q3: ['Option A', 'Option B']
      }),
      status: 'completed',
      completed_at: '2026-02-12T10:00:00Z',
      questionnaire_name: 'Project Discovery',
      questionnaire_description: 'Initial project questionnaire',
      client_name: 'Test Client',
      project_name: 'Test Project'
    };

    it('generates a valid questionnaire PDF', async () => {
      setupQuestionnaireMocks(baseResponse, baseQuestionnaire);

      const { questionnaireService } = await import('../../../server/services/questionnaire-service');

      const pdfBytes = await questionnaireService.generateQuestionnairePdf(1);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(0);
    });

    it('handles questionnaire not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const { questionnaireService } = await import('../../../server/services/questionnaire-service');

      await expect(questionnaireService.generateQuestionnairePdf(999)).rejects.toThrow();
    });

    it('handles empty answers gracefully', async () => {
      const emptyResponse = {
        ...baseResponse,
        id: 2,
        answers: JSON.stringify({}),
        questionnaire_name: 'Empty Questionnaire',
        client_name: 'Empty Client'
      };
      const emptyQuestionnaire = {
        ...baseQuestionnaire,
        name: 'Empty Questionnaire',
        questions: JSON.stringify([
          { id: 'q1', type: 'text', question: 'Unanswered question?' }
        ])
      };
      setupQuestionnaireMocks(emptyResponse, emptyQuestionnaire);

      const { questionnaireService } = await import('../../../server/services/questionnaire-service');

      const pdfBytes = await questionnaireService.generateQuestionnairePdf(2);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('handles multiselect answers as arrays', async () => {
      const multiselectResponse = {
        ...baseResponse,
        id: 3,
        answers: JSON.stringify({
          features: ['Feature 1', 'Feature 2', 'Feature 3']
        }),
        questionnaire_name: 'Feature Selection',
        client_name: 'Feature Client'
      };
      const multiselectQuestionnaire = {
        ...baseQuestionnaire,
        name: 'Feature Selection',
        questions: JSON.stringify([
          { id: 'features', type: 'multiselect', question: 'Select features', options: ['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4'] }
        ])
      };
      setupQuestionnaireMocks(multiselectResponse, multiselectQuestionnaire);

      const { questionnaireService } = await import('../../../server/services/questionnaire-service');

      const pdfBytes = await questionnaireService.generateQuestionnairePdf(3);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });

    it('handles long text answers with wrapping', async () => {
      const longAnswer = 'This is a very long answer that should wrap across multiple lines in the PDF. '.repeat(20);

      const longResponse = {
        ...baseResponse,
        id: 4,
        answers: JSON.stringify({
          description: longAnswer
        }),
        questionnaire_name: 'Long Answer Test',
        client_name: 'Long Client'
      };
      const longQuestionnaire = {
        ...baseQuestionnaire,
        name: 'Long Answer Test',
        questions: JSON.stringify([
          { id: 'description', type: 'textarea', question: 'Provide a detailed description' }
        ])
      };
      setupQuestionnaireMocks(longResponse, longQuestionnaire);

      const { questionnaireService } = await import('../../../server/services/questionnaire-service');

      const pdfBytes = await questionnaireService.generateQuestionnairePdf(4);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
    });
  });

  // ============================================
  // PDF Utility Tests
  // ============================================

  describe('PDF Utilities', () => {
    it('creates PDF with correct metadata', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'META-001',
        issuedDate: '2026-02-12',
        clientName: 'Metadata Test',
        clientEmail: 'meta@example.com',
        lineItems: [{ description: 'Test', quantity: 1, rate: 100, amount: 100 }],
        subtotal: 100,
        total: 100
      };

      await generateInvoicePdf(invoiceData);

      expect(mockPdfDoc.setTitle).toHaveBeenCalled();
      expect(mockPdfDoc.setAuthor).toHaveBeenCalledWith('Test Business');
      expect(mockPdfDoc.setCreator).toHaveBeenCalledWith('NoBhadCodes');
    });

    it('embeds logo in PDF', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'LOGO-001',
        issuedDate: '2026-02-12',
        clientName: 'Logo Test',
        clientEmail: 'logo@example.com',
        lineItems: [{ description: 'Test', quantity: 1, rate: 100, amount: 100 }],
        subtotal: 100,
        total: 100
      };

      await generateInvoicePdf(invoiceData);

      // Logo embedding happens through embedPng
      expect(mockPdfDoc.embedPng).toHaveBeenCalled();
    });

    it('uses standard fonts', async () => {
      const { generateInvoicePdf } = await import('../../../server/routes/invoices/pdf');

      const invoiceData = {
        invoiceNumber: 'FONT-001',
        issuedDate: '2026-02-12',
        clientName: 'Font Test',
        clientEmail: 'font@example.com',
        lineItems: [{ description: 'Test', quantity: 1, rate: 100, amount: 100 }],
        subtotal: 100,
        total: 100
      };

      await generateInvoicePdf(invoiceData);

      // Should embed both Helvetica and HelveticaBold
      expect(mockPdfDoc.embedFont).toHaveBeenCalledTimes(2);
    });
  });
});
