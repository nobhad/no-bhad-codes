/**
 * ===============================================
 * PAYMENT SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/payment-service.test.ts
 *
 * Unit tests for invoice payment processing service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvoicePaymentService } from '../../../server/services/invoice/payment-service';

// Mock receipt service
vi.mock('../../../server/services/receipt-service', () => ({
  receiptService: {
    createReceipt: vi.fn().mockResolvedValue({
      id: 1,
      receiptNumber: 'REC-001'
    })
  }
}));

describe('InvoicePaymentService', () => {
  let service: InvoicePaymentService;
  let mockDb: {
    run: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    all: ReturnType<typeof vi.fn>;
  };
  let mockGetInvoiceById: ReturnType<typeof vi.fn>;
  let mockUpdateInvoiceStatus: ReturnType<typeof vi.fn>;

  const createMockInvoice = (overrides = {}) => ({
    id: 1,
    invoiceNumber: 'INV-001',
    projectId: 1,
    clientId: 1,
    status: 'sent' as const,
    amountTotal: 1000,
    amountPaid: 0,
    dueDate: '2026-03-01',
    issueDate: '2026-02-01',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    ...overrides
  });

  beforeEach(() => {
    mockDb = {
      run: vi.fn().mockResolvedValue({ lastID: 1 }),
      get: vi.fn(),
      all: vi.fn().mockResolvedValue([])
    };

    mockGetInvoiceById = vi.fn();
    mockUpdateInvoiceStatus = vi.fn();

    service = new InvoicePaymentService(mockDb, {
      getInvoiceById: mockGetInvoiceById,
      updateInvoiceStatus: mockUpdateInvoiceStatus
    });
  });

  describe('markInvoiceAsPaid', () => {
    it('marks invoice as paid with payment data', async () => {
      const paidInvoice = createMockInvoice({ status: 'paid', amountPaid: 1000 });
      mockUpdateInvoiceStatus.mockResolvedValue(paidInvoice);

      const result = await service.markInvoiceAsPaid(1, {
        amountPaid: 1000,
        paymentMethod: 'credit_card',
        paymentReference: 'ch_123'
      });

      expect(mockUpdateInvoiceStatus).toHaveBeenCalledWith(
        1,
        'paid',
        expect.objectContaining({
          amountPaid: 1000,
          paymentMethod: 'credit_card',
          paymentReference: 'ch_123',
          paidDate: expect.any(String)
        })
      );
      expect(result.status).toBe('paid');
    });

    it('includes current date as paid date', async () => {
      const paidInvoice = createMockInvoice({ status: 'paid' });
      mockUpdateInvoiceStatus.mockResolvedValue(paidInvoice);

      await service.markInvoiceAsPaid(1, {
        amountPaid: 1000,
        paymentMethod: 'bank_transfer'
      });

      const call = mockUpdateInvoiceStatus.mock.calls[0];
      const paymentData = call[2];
      expect(paymentData.paidDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('recordPayment', () => {
    it('records full payment and marks invoice as paid', async () => {
      const invoice = createMockInvoice({ amountTotal: 500, amountPaid: 0 });
      mockGetInvoiceById.mockResolvedValue(invoice);
      mockGetInvoiceById.mockResolvedValueOnce(invoice);
      mockGetInvoiceById.mockResolvedValue(createMockInvoice({ status: 'paid', amountPaid: 500 }));

      const result = await service.recordPayment(1, 500, 'credit_card', 'ref_123');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET'),
        expect.arrayContaining([500, 'paid', 'credit_card', 'ref_123'])
      );
      expect(result.status).toBe('paid');
    });

    it('records partial payment and sets status to partial', async () => {
      const invoice = createMockInvoice({ amountTotal: 1000, amountPaid: 0 });
      mockGetInvoiceById.mockResolvedValue(invoice);
      mockGetInvoiceById.mockResolvedValueOnce(invoice);
      mockGetInvoiceById.mockResolvedValue(createMockInvoice({ status: 'partial', amountPaid: 300 }));

      const result = await service.recordPayment(1, 300, 'credit_card');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET'),
        expect.arrayContaining([300, 'partial', 'credit_card'])
      );
      expect(result.status).toBe('partial');
    });

    it('adds to existing partial payment', async () => {
      const invoice = createMockInvoice({ amountTotal: 1000, amountPaid: 300, status: 'partial' });
      mockGetInvoiceById.mockResolvedValue(invoice);
      mockGetInvoiceById.mockResolvedValueOnce(invoice);
      mockGetInvoiceById.mockResolvedValue(createMockInvoice({ status: 'paid', amountPaid: 1000 }));

      await service.recordPayment(1, 700, 'credit_card');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET'),
        expect.arrayContaining([1000, 'paid']) // 300 + 700 = 1000
      );
    });

    it('throws error for already paid invoice', async () => {
      const invoice = createMockInvoice({ status: 'paid', amountPaid: 1000 });
      mockGetInvoiceById.mockResolvedValue(invoice);

      await expect(service.recordPayment(1, 100, 'credit_card'))
        .rejects.toThrow('Invoice is already fully paid');
    });

    it('throws error for cancelled invoice', async () => {
      const invoice = createMockInvoice({ status: 'cancelled' });
      mockGetInvoiceById.mockResolvedValue(invoice);

      await expect(service.recordPayment(1, 100, 'credit_card'))
        .rejects.toThrow('Cannot record payment on a cancelled invoice');
    });

    it('throws error for zero or negative payment', async () => {
      const invoice = createMockInvoice();
      mockGetInvoiceById.mockResolvedValue(invoice);

      await expect(service.recordPayment(1, 0, 'credit_card'))
        .rejects.toThrow('Payment amount must be greater than zero');

      await expect(service.recordPayment(1, -100, 'credit_card'))
        .rejects.toThrow('Payment amount must be greater than zero');
    });

    it('skips pending reminders when fully paid', async () => {
      const invoice = createMockInvoice({ amountTotal: 500, amountPaid: 0 });
      mockGetInvoiceById.mockResolvedValue(invoice);
      mockGetInvoiceById.mockResolvedValueOnce(invoice);
      mockGetInvoiceById.mockResolvedValue(createMockInvoice({ status: 'paid' }));

      await service.recordPayment(1, 500, 'credit_card');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoice_reminders'),
        ['skipped', 1, 'pending']
      );
    });

    it('handles small remaining amounts as fully paid (floating point tolerance)', async () => {
      const invoice = createMockInvoice({ amountTotal: 100.00, amountPaid: 99.995 });
      mockGetInvoiceById.mockResolvedValue(invoice);
      mockGetInvoiceById.mockResolvedValueOnce(invoice);
      mockGetInvoiceById.mockResolvedValue(createMockInvoice({ status: 'paid' }));

      await service.recordPayment(1, 0.01, 'credit_card');

      // Should be marked as paid due to <= 0.01 tolerance
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET'),
        expect.arrayContaining(['paid'])
      );
    });
  });

  describe('recordPaymentWithHistory', () => {
    it('records payment and creates history entry', async () => {
      const invoice = createMockInvoice({ amountTotal: 500, amountPaid: 0 });
      mockGetInvoiceById.mockResolvedValue(invoice);
      mockGetInvoiceById.mockResolvedValueOnce(invoice);
      mockGetInvoiceById.mockResolvedValue(createMockInvoice({ status: 'paid', amountPaid: 500 }));

      const result = await service.recordPaymentWithHistory(
        1, 500, 'credit_card', 'ref_123', 'Payment for services'
      );

      expect(result.invoice).toBeDefined();
      expect(result.payment).toBeDefined();
      expect(result.payment.amount).toBe(500);
      expect(result.payment.paymentMethod).toBe('credit_card');
      expect(result.payment.paymentReference).toBe('ref_123');
      expect(result.payment.notes).toBe('Payment for services');
    });

    it('inserts payment history record into database', async () => {
      const invoice = createMockInvoice({ amountTotal: 500, amountPaid: 0 });
      mockGetInvoiceById.mockResolvedValue(invoice);
      mockGetInvoiceById.mockResolvedValueOnce(invoice);
      mockGetInvoiceById.mockResolvedValue(createMockInvoice({ status: 'paid' }));

      await service.recordPaymentWithHistory(1, 500, 'bank_transfer', 'wire_456');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoice_payments'),
        expect.arrayContaining([1, 500, 'bank_transfer', 'wire_456'])
      );
    });

    it('auto-generates receipt for payment', async () => {
      const { receiptService } = await import('../../../server/services/receipt-service');
      const invoice = createMockInvoice({ amountTotal: 500, amountPaid: 0 });
      mockGetInvoiceById.mockResolvedValue(invoice);
      mockGetInvoiceById.mockResolvedValueOnce(invoice);
      mockGetInvoiceById.mockResolvedValue(createMockInvoice({ status: 'paid' }));

      const result = await service.recordPaymentWithHistory(1, 500, 'credit_card');

      expect(receiptService.createReceipt).toHaveBeenCalledWith(
        1, // invoiceId
        1, // paymentId (from lastID)
        500, // amount
        expect.objectContaining({
          paymentMethod: 'credit_card'
        })
      );
      expect(result.receipt).toBeDefined();
      expect(result.receipt?.receiptNumber).toBe('REC-001');
    });

    it('continues even if receipt generation fails', async () => {
      const { receiptService } = await import('../../../server/services/receipt-service');
      (receiptService.createReceipt as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Receipt generation failed')
      );

      const invoice = createMockInvoice({ amountTotal: 500, amountPaid: 0 });
      mockGetInvoiceById.mockResolvedValue(invoice);
      mockGetInvoiceById.mockResolvedValueOnce(invoice);
      mockGetInvoiceById.mockResolvedValue(createMockInvoice({ status: 'paid' }));

      const result = await service.recordPaymentWithHistory(1, 500, 'credit_card');

      // Should not throw, payment should still be recorded
      expect(result.invoice).toBeDefined();
      expect(result.payment).toBeDefined();
      expect(result.receipt).toBeUndefined();
    });
  });

  describe('getPaymentHistory', () => {
    it('returns empty array when no payments exist', async () => {
      mockDb.all.mockResolvedValue([]);

      const result = await service.getPaymentHistory(1);

      expect(result).toEqual([]);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM invoice_payments'),
        [1]
      );
    });

    it('returns formatted payment history', async () => {
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          invoice_id: 1,
          amount: '500.00',
          payment_method: 'credit_card',
          payment_reference: 'ref_123',
          payment_date: '2026-02-01',
          notes: 'First payment',
          created_at: '2026-02-01T10:00:00Z'
        },
        {
          id: 2,
          invoice_id: 1,
          amount: 300,
          payment_method: 'bank_transfer',
          payment_reference: null,
          payment_date: '2026-02-15',
          notes: null,
          created_at: '2026-02-15T10:00:00Z'
        }
      ]);

      const result = await service.getPaymentHistory(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        invoiceId: 1,
        amount: 500, // String converted to number
        paymentMethod: 'credit_card',
        paymentReference: 'ref_123',
        paymentDate: '2026-02-01',
        notes: 'First payment',
        createdAt: '2026-02-01T10:00:00Z'
      });
      expect(result[1].amount).toBe(300); // Already a number
    });

    it('handles string amounts correctly', async () => {
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          invoice_id: 1,
          amount: '123.45',
          payment_method: 'credit_card',
          payment_reference: null,
          payment_date: '2026-02-01',
          notes: null,
          created_at: '2026-02-01T10:00:00Z'
        }
      ]);

      const result = await service.getPaymentHistory(1);

      expect(result[0].amount).toBe(123.45);
      expect(typeof result[0].amount).toBe('number');
    });
  });

  describe('getAllPayments', () => {
    it('returns all payments without date filter', async () => {
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          invoice_id: 1,
          amount: 500,
          payment_method: 'credit_card',
          payment_reference: 'ref_1',
          payment_date: '2026-01-15',
          notes: null,
          created_at: '2026-01-15T10:00:00Z'
        },
        {
          id: 2,
          invoice_id: 2,
          amount: 750,
          payment_method: 'bank_transfer',
          payment_reference: 'ref_2',
          payment_date: '2026-02-01',
          notes: 'Monthly payment',
          created_at: '2026-02-01T10:00:00Z'
        }
      ]);

      const result = await service.getAllPayments();

      expect(result).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM invoice_payments'),
        []
      );
    });

    it('filters by date range', async () => {
      mockDb.all.mockResolvedValue([]);

      await service.getAllPayments('2026-01-01', '2026-01-31');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('payment_date >= ?'),
        ['2026-01-01', '2026-01-31']
      );
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('payment_date <= ?'),
        ['2026-01-01', '2026-01-31']
      );
    });

    it('filters by start date only', async () => {
      mockDb.all.mockResolvedValue([]);

      await service.getAllPayments('2026-01-01');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('payment_date >= ?'),
        ['2026-01-01']
      );
    });

    it('filters by end date only', async () => {
      mockDb.all.mockResolvedValue([]);

      await service.getAllPayments(undefined, '2026-01-31');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('payment_date <= ?'),
        ['2026-01-31']
      );
    });

    it('orders results by payment_date DESC', async () => {
      mockDb.all.mockResolvedValue([]);

      await service.getAllPayments();

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY payment_date DESC'),
        expect.any(Array)
      );
    });
  });
});
