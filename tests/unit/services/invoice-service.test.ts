/**
 * ===============================================
 * INVOICE SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/invoice-service.test.ts
 *
 * Unit tests for invoice service helpers.
 * Covers: late fees, payments, deposits, tax/discounts, search, delete/void
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockDb = vi.hoisted(() => {
  const db = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    transaction: vi.fn(),
  };
  // Transaction passes a context with run method
  db.transaction.mockImplementation(async (fn: (ctx: { run: typeof db.run }) => unknown) =>
    fn({ run: db.run })
  );
  return db;
});

vi.mock('../../../server/database/init', () => ({
  getDatabase: () => mockDb,
}));

vi.mock('../../../server/services/settings-service', () => ({
  settingsService: {
    getBusinessInfo: vi.fn().mockResolvedValue({
      name: 'Test Business',
      contact: 'Test Contact',
      email: 'test@example.com',
      website: 'https://test.com',
    }),
    getPaymentSettings: vi.fn().mockResolvedValue({
      venmoHandle: '@test',
      paypalEmail: 'paypal@test.com',
    }),
  },
}));

import { InvoiceService, Invoice, InvoiceLineItem } from '../../../server/services/invoice-service';

describe('Invoice Service', () => {
  const service = InvoiceService.getInstance();

  beforeEach(() => {
    vi.useFakeTimers();
    mockDb.run.mockReset();
    mockDb.get.mockReset();
    mockDb.all.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 late fee when invoice is not overdue', () => {
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));

    const invoice: Invoice = {
      invoiceNumber: 'INV-TEST-001',
      projectId: 1,
      clientId: 1,
      amountTotal: 1000,
      amountPaid: 0,
      currency: 'USD',
      status: 'sent',
      dueDate: '2026-02-15',
      invoiceType: 'standard',
      lineItems: [],
    };

    expect(service.calculateLateFee(invoice)).toBe(0);
  });

  it('returns 0 late fee when invoice is paid', () => {
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));

    const invoice: Invoice = {
      invoiceNumber: 'INV-TEST-002',
      projectId: 1,
      clientId: 1,
      amountTotal: 1000,
      amountPaid: 1000,
      currency: 'USD',
      status: 'paid',
      dueDate: '2026-02-01',
      invoiceType: 'standard',
      lineItems: [],
    };

    expect(service.calculateLateFee(invoice)).toBe(0);
  });

  it('applies flat late fee for overdue invoice', () => {
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));

    const invoice: Invoice = {
      invoiceNumber: 'INV-TEST-003',
      projectId: 1,
      clientId: 1,
      amountTotal: 1000,
      amountPaid: 0,
      currency: 'USD',
      status: 'sent',
      dueDate: '2026-02-01',
      invoiceType: 'standard',
      lineItems: [],
      lateFeeRate: 25,
      lateFeeType: 'flat',
    };

    expect(service.calculateLateFee(invoice)).toBe(25);
  });

  it('applies percentage late fee for overdue invoice', () => {
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));

    const invoice: Invoice = {
      invoiceNumber: 'INV-TEST-004',
      projectId: 1,
      clientId: 1,
      amountTotal: 1000,
      amountPaid: 200,
      currency: 'USD',
      status: 'sent',
      dueDate: '2026-02-01',
      invoiceType: 'standard',
      lineItems: [],
      lateFeeRate: 10,
      lateFeeType: 'percentage',
    };

    // Outstanding = 800, fee = 10% of 800
    expect(service.calculateLateFee(invoice)).toBe(80);
  });

  it('applies daily percentage late fee for overdue invoice', () => {
    vi.setSystemTime(new Date('2026-02-06T12:00:00Z'));

    const invoice: Invoice = {
      invoiceNumber: 'INV-TEST-005',
      projectId: 1,
      clientId: 1,
      amountTotal: 1000,
      amountPaid: 0,
      currency: 'USD',
      status: 'sent',
      dueDate: '2026-02-01',
      invoiceType: 'standard',
      lineItems: [],
      lateFeeRate: 1,
      lateFeeType: 'daily_percentage',
    };

    // 5 days overdue, 1% per day of 1000
    expect(service.calculateLateFee(invoice)).toBe(50);
  });

  it('schedules an invoice and returns the mapped row', async () => {
    const lineItems = [{ description: 'Design', quantity: 1, rate: 500, amount: 500 }];

    mockDb.run.mockResolvedValue({ lastID: 7 });
    mockDb.get.mockResolvedValue({
      id: 7,
      project_id: 1,
      client_id: 2,
      scheduled_date: '2024-07-15',
      trigger_type: 'date',
      trigger_milestone_id: null,
      line_items: JSON.stringify(lineItems),
      notes: 'Follow up',
      terms: 'Net 30',
      status: 'pending',
      generated_invoice_id: null,
      created_at: '2024-07-01',
    });

    const result = await service.scheduleInvoice({
      projectId: 1,
      clientId: 2,
      scheduledDate: '2024-07-15',
      lineItems,
      notes: 'Follow up',
      terms: 'Net 30',
    });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scheduled_invoices'),
      [1, 2, '2024-07-15', 'date', null, JSON.stringify(lineItems), 'Follow up', 'Net 30']
    );
    expect(result).toMatchObject({
      id: 7,
      projectId: 1,
      clientId: 2,
      scheduledDate: '2024-07-15',
      triggerType: 'date',
      lineItems,
      status: 'pending',
    });
  });

  it('filters scheduled invoices by project', async () => {
    mockDb.all.mockResolvedValue([
      {
        id: 3,
        project_id: 9,
        client_id: 4,
        scheduled_date: '2024-08-01',
        trigger_type: 'date',
        trigger_milestone_id: null,
        line_items: JSON.stringify([
          { description: 'Phase 1', quantity: 1, rate: 300, amount: 300 },
        ]),
        notes: null,
        terms: null,
        status: 'pending',
        generated_invoice_id: null,
        created_at: '2024-07-20',
      },
    ]);

    const result = await service.getScheduledInvoices(9);

    expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('AND project_id = ?'), [9]);
    expect(result[0].projectId).toBe(9);
  });

  it('cancels a scheduled invoice', async () => {
    await service.cancelScheduledInvoice(12);

    expect(mockDb.run).toHaveBeenCalledWith(
      'UPDATE scheduled_invoices SET status = ? WHERE id = ?',
      ['cancelled', 12]
    );
  });

  it('processes scheduled invoices and marks them generated', async () => {
    vi.setSystemTime(new Date('2024-07-20T12:00:00Z'));

    mockDb.all.mockResolvedValue([
      {
        id: 4,
        project_id: 1,
        client_id: 2,
        scheduled_date: '2024-07-01',
        trigger_type: 'date',
        trigger_milestone_id: null,
        line_items: JSON.stringify([
          { description: 'Phase 2', quantity: 1, rate: 800, amount: 800 },
        ]),
        notes: 'Auto',
        terms: 'Net 15',
        status: 'pending',
        generated_invoice_id: null,
        created_at: '2024-06-20',
      },
    ]);

    const createInvoiceSpy = vi.spyOn(service, 'createInvoice').mockResolvedValue({
      id: 44,
      invoiceNumber: 'INV-44',
      projectId: 1,
      clientId: 2,
      amountTotal: 800,
      amountPaid: 0,
      currency: 'USD',
      status: 'draft',
      invoiceType: 'standard',
      lineItems: [],
    } as Invoice);

    const count = await service.processScheduledInvoices();

    expect(count).toBe(1);
    expect(mockDb.run).toHaveBeenCalledWith(
      'UPDATE scheduled_invoices SET status = ?, generated_invoice_id = ? WHERE id = ?',
      ['generated', 44, 4]
    );

    createInvoiceSpy.mockRestore();
  });

  it('creates recurring invoices with computed next date', async () => {
    const lineItems = [{ description: 'Support', quantity: 1, rate: 120, amount: 120 }];

    mockDb.run.mockResolvedValue({ lastID: 5 });
    mockDb.get.mockResolvedValue({
      id: 5,
      project_id: 2,
      client_id: 3,
      frequency: 'monthly',
      day_of_month: 31,
      day_of_week: null,
      line_items: JSON.stringify(lineItems),
      notes: 'Monthly',
      terms: 'Net 10',
      start_date: '2024-01-10',
      end_date: null,
      next_generation_date: '2024-03-01',
      last_generated_at: null,
      is_active: 1,
      created_at: '2024-01-10',
    });

    const result = await service.createRecurringInvoice({
      projectId: 2,
      clientId: 3,
      frequency: 'monthly',
      dayOfMonth: 31,
      lineItems,
      notes: 'Monthly',
      terms: 'Net 10',
      startDate: '2024-01-10',
    });

    const [, params] = mockDb.run.mock.calls[0];

    expect(params[10]).toBe('2024-03-01');
    expect(result.nextGenerationDate).toBe('2024-03-01');
  });

  it('uses the next matching weekday for weekly recurring invoices', async () => {
    const lineItems = [{ description: 'Weekly check-in', quantity: 1, rate: 60, amount: 60 }];

    mockDb.run.mockResolvedValue({ lastID: 9 });
    mockDb.get.mockResolvedValue({
      id: 9,
      project_id: 3,
      client_id: 4,
      frequency: 'weekly',
      day_of_month: null,
      day_of_week: 5,
      line_items: JSON.stringify(lineItems),
      notes: 'Weekly',
      terms: null,
      start_date: '2024-07-01',
      end_date: null,
      next_generation_date: '2024-07-13',
      last_generated_at: null,
      is_active: 1,
      created_at: '2024-07-01',
    });

    const result = await service.createRecurringInvoice({
      projectId: 3,
      clientId: 4,
      frequency: 'weekly',
      dayOfWeek: 5,
      lineItems,
      notes: 'Weekly',
      startDate: '2024-07-01',
    });

    const [, params] = mockDb.run.mock.calls.at(-1)!;

    expect(params[10]).toBe('2024-07-13');
    expect(result.nextGenerationDate).toBe('2024-07-13');
  });

  it('filters recurring invoices by project', async () => {
    mockDb.all.mockResolvedValue([
      {
        id: 11,
        project_id: 7,
        client_id: 4,
        frequency: 'weekly',
        day_of_month: null,
        day_of_week: 1,
        line_items: JSON.stringify([{ description: 'Weekly', quantity: 1, rate: 80, amount: 80 }]),
        notes: null,
        terms: null,
        start_date: '2024-06-01',
        end_date: null,
        next_generation_date: '2024-06-08',
        last_generated_at: null,
        is_active: 1,
        created_at: '2024-06-01',
      },
    ]);

    const result = await service.getRecurringInvoices(7);

    expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('WHERE project_id = ?'), [7]);
    expect(result[0].projectId).toBe(7);
  });

  it('updates recurring invoices with provided fields', async () => {
    const lineItems = [{ description: 'Retainer', quantity: 1, rate: 500, amount: 500 }];

    mockDb.run.mockResolvedValue({});
    mockDb.get.mockResolvedValue({
      id: 6,
      project_id: 2,
      client_id: 3,
      frequency: 'weekly',
      day_of_month: null,
      day_of_week: 2,
      line_items: JSON.stringify(lineItems),
      notes: 'Updated',
      terms: 'Net 20',
      start_date: '2024-01-10',
      end_date: null,
      next_generation_date: '2024-01-17',
      last_generated_at: null,
      is_active: 1,
      created_at: '2024-01-10',
    });

    const result = await service.updateRecurringInvoice(6, {
      frequency: 'weekly',
      dayOfWeek: 2,
      lineItems,
      notes: 'Updated',
      terms: 'Net 20',
    });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE recurring_invoices SET'),
      expect.arrayContaining(['weekly', 2, JSON.stringify(lineItems), 'Updated', 'Net 20', 6])
    );
    expect(result.frequency).toBe('weekly');
  });

  it('resumes recurring invoices and recalculates the next date', async () => {
    vi.setSystemTime(new Date('2024-03-05T12:00:00Z'));

    mockDb.get.mockResolvedValue({
      id: 8,
      project_id: 1,
      client_id: 1,
      frequency: 'monthly',
      day_of_month: 20,
      day_of_week: null,
      line_items: JSON.stringify([{ description: 'Monthly', quantity: 1, rate: 400, amount: 400 }]),
      notes: null,
      terms: null,
      start_date: '2024-01-20',
      end_date: null,
      next_generation_date: '2024-02-20',
      last_generated_at: null,
      is_active: 0,
      created_at: '2024-01-20',
    });

    await service.resumeRecurringInvoice(8);

    expect(mockDb.run).toHaveBeenCalledWith(
      'UPDATE recurring_invoices SET is_active = 1, next_generation_date = ? WHERE id = ?',
      ['2024-04-20', 8]
    );
  });

  it('processes recurring invoices and advances the schedule', async () => {
    vi.setSystemTime(new Date('2024-07-20T12:00:00Z'));

    mockDb.all.mockResolvedValue([
      {
        id: 12,
        project_id: 5,
        client_id: 6,
        frequency: 'monthly',
        day_of_month: 15,
        day_of_week: null,
        line_items: JSON.stringify([
          { description: 'Maintenance', quantity: 1, rate: 150, amount: 150 },
        ]),
        notes: 'Recurring',
        terms: 'Net 10',
        start_date: '2024-01-15',
        end_date: null,
        next_generation_date: '2024-07-15',
        last_generated_at: null,
        is_active: 1,
        created_at: '2024-01-15',
      },
    ]);

    const createInvoiceSpy = vi.spyOn(service, 'createInvoice').mockResolvedValue({
      id: 120,
      invoiceNumber: 'INV-120',
      projectId: 5,
      clientId: 6,
      amountTotal: 150,
      amountPaid: 0,
      currency: 'USD',
      status: 'draft',
      invoiceType: 'standard',
      lineItems: [],
    } as Invoice);

    const count = await service.processRecurringInvoices();

    expect(count).toBe(1);
    // The service uses a batch CASE WHEN update for efficiency
    expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE recurring_invoices'));
    expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('CASE WHEN id = 12 THEN'));

    createInvoiceSpy.mockRestore();
  });

  // ============================================
  // TAX AND DISCOUNT CALCULATIONS
  // ============================================

  describe('calculateInvoiceTotals', () => {
    it('calculates simple subtotal without tax or discount', () => {
      const lineItems: InvoiceLineItem[] = [
        { description: 'Service A', quantity: 1, rate: 500, amount: 500 },
        { description: 'Service B', quantity: 2, rate: 250, amount: 500 },
      ];

      const result = service.calculateInvoiceTotals(lineItems);

      expect(result.subtotal).toBe(1000);
      expect(result.taxAmount).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.total).toBe(1000);
    });

    it('calculates invoice-level percentage tax', () => {
      const lineItems: InvoiceLineItem[] = [
        { description: 'Service', quantity: 1, rate: 1000, amount: 1000 },
      ];

      const result = service.calculateInvoiceTotals(lineItems, 10); // 10% tax

      expect(result.subtotal).toBe(1000);
      expect(result.taxAmount).toBe(100);
      expect(result.total).toBe(1100);
    });

    it('calculates invoice-level percentage discount', () => {
      const lineItems: InvoiceLineItem[] = [
        { description: 'Service', quantity: 1, rate: 1000, amount: 1000 },
      ];

      const result = service.calculateInvoiceTotals(lineItems, 0, 'percentage', 20);

      expect(result.subtotal).toBe(1000);
      expect(result.discountAmount).toBe(200);
      expect(result.total).toBe(800);
    });

    it('calculates invoice-level fixed discount', () => {
      const lineItems: InvoiceLineItem[] = [
        { description: 'Service', quantity: 1, rate: 1000, amount: 1000 },
      ];

      const result = service.calculateInvoiceTotals(lineItems, 0, 'fixed', 150);

      expect(result.subtotal).toBe(1000);
      expect(result.discountAmount).toBe(150);
      expect(result.total).toBe(850);
    });

    it('applies tax on discounted amount', () => {
      const lineItems: InvoiceLineItem[] = [
        { description: 'Service', quantity: 1, rate: 1000, amount: 1000 },
      ];

      // 20% discount, then 10% tax
      const result = service.calculateInvoiceTotals(lineItems, 10, 'percentage', 20);

      expect(result.subtotal).toBe(1000);
      expect(result.discountAmount).toBe(200);
      // Tax on 800 (1000 - 200)
      expect(result.taxAmount).toBe(80);
      expect(result.total).toBe(880);
    });

    it('handles per-line item tax', () => {
      const lineItems: InvoiceLineItem[] = [
        { description: 'Taxable', quantity: 1, rate: 500, amount: 500, taxRate: 10 },
        { description: 'Non-taxable', quantity: 1, rate: 500, amount: 500 },
      ];

      const result = service.calculateInvoiceTotals(lineItems);

      expect(result.subtotal).toBe(1000);
      // Only first item has 10% tax = 50
      expect(result.taxAmount).toBe(50);
      expect(result.total).toBe(1050);
    });

    it('handles per-line item discount', () => {
      const lineItems: InvoiceLineItem[] = [
        {
          description: 'Discounted',
          quantity: 1,
          rate: 500,
          amount: 500,
          discountType: 'percentage',
          discountValue: 20,
        },
        { description: 'Full price', quantity: 1, rate: 500, amount: 500 },
      ];

      const result = service.calculateInvoiceTotals(lineItems);

      expect(result.subtotal).toBe(1000);
      // First item discount = 20% of 500 = 100
      expect(result.discountAmount).toBe(100);
      expect(result.total).toBe(900);
    });

    it('ensures total is never negative', () => {
      const lineItems: InvoiceLineItem[] = [
        { description: 'Service', quantity: 1, rate: 100, amount: 100 },
      ];

      // Discount larger than subtotal
      const result = service.calculateInvoiceTotals(lineItems, 0, 'fixed', 500);

      expect(result.total).toBe(0);
    });

    it('combines per-line and invoice-level tax and discounts', () => {
      const lineItems: InvoiceLineItem[] = [
        { description: 'Item A', quantity: 1, rate: 600, amount: 600, taxRate: 5 },
        {
          description: 'Item B',
          quantity: 1,
          rate: 400,
          amount: 400,
          discountType: 'fixed',
          discountValue: 50,
        },
      ];

      // Invoice-level: 10% discount, 8% tax
      const result = service.calculateInvoiceTotals(lineItems, 8, 'percentage', 10);

      expect(result.subtotal).toBe(1000);
      // Line discount = 50, Invoice discount = 10% of 1000 = 100
      expect(result.discountAmount).toBe(150);
      // Line tax = 5% of 600 = 30
      // Invoice tax = 8% of (1000 - 150) = 8% of 850 = 68
      expect(result.taxAmount).toBe(98);
      // 1000 - 150 + 98 = 948
      expect(result.total).toBe(948);
    });
  });

  // ============================================
  // DELETE / VOID INVOICE
  // ============================================

  describe('deleteOrVoidInvoice', () => {
    it('permanently deletes draft invoices', async () => {
      // Mock getInvoiceById
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        invoice_number: 'INV-001',
        project_id: 1,
        client_id: 1,
        amount_total: 500,
        amount_paid: 0,
        currency: 'USD',
        status: 'draft',
        invoice_type: 'standard',
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      });
      // Mock line items query
      mockDb.all.mockResolvedValueOnce([]);
      // Mock delete operations
      mockDb.run.mockResolvedValue({ changes: 1 });

      const result = await service.deleteOrVoidInvoice(1);

      expect(result.action).toBe('deleted');
      // Verify delete queries were called
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM invoice_reminders WHERE invoice_id = ?',
        [1]
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM invoice_credits WHERE invoice_id = ?',
        [1]
      );
      expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM invoices WHERE id = ?', [1]);
    });

    it('permanently deletes cancelled invoices', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 2,
        invoice_number: 'INV-002',
        project_id: 1,
        client_id: 1,
        amount_total: 500,
        amount_paid: 0,
        currency: 'USD',
        status: 'cancelled',
        invoice_type: 'standard',
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      });
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValue({ changes: 1 });

      const result = await service.deleteOrVoidInvoice(2);

      expect(result.action).toBe('deleted');
    });

    it('voids sent invoices instead of deleting', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 3,
        invoice_number: 'INV-003',
        project_id: 1,
        client_id: 1,
        amount_total: 500,
        amount_paid: 0,
        currency: 'USD',
        status: 'sent',
        invoice_type: 'standard',
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      });
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValue({ changes: 1 });

      const result = await service.deleteOrVoidInvoice(3);

      expect(result.action).toBe('voided');
      // Verify status update
      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['cancelled', 3]
      );
    });

    it('voids partial payment invoices', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 4,
        invoice_number: 'INV-004',
        project_id: 1,
        client_id: 1,
        amount_total: 500,
        amount_paid: 200,
        currency: 'USD',
        status: 'partial',
        invoice_type: 'standard',
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      });
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValue({ changes: 1 });

      const result = await service.deleteOrVoidInvoice(4);

      expect(result.action).toBe('voided');
    });

    it('voids overdue invoices', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 5,
        invoice_number: 'INV-005',
        project_id: 1,
        client_id: 1,
        amount_total: 500,
        amount_paid: 0,
        currency: 'USD',
        status: 'overdue',
        invoice_type: 'standard',
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      });
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValue({ changes: 1 });

      const result = await service.deleteOrVoidInvoice(5);

      expect(result.action).toBe('voided');
    });

    it('throws error for paid invoices', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 6,
        invoice_number: 'INV-006',
        project_id: 1,
        client_id: 1,
        amount_total: 500,
        amount_paid: 500,
        currency: 'USD',
        status: 'paid',
        invoice_type: 'standard',
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      });
      mockDb.all.mockResolvedValueOnce([]);

      await expect(service.deleteOrVoidInvoice(6)).rejects.toThrow(
        'Paid invoices cannot be deleted or voided'
      );
    });

    it('cancels pending reminders when voiding', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 7,
        invoice_number: 'INV-007',
        project_id: 1,
        client_id: 1,
        amount_total: 500,
        amount_paid: 0,
        currency: 'USD',
        status: 'sent',
        invoice_type: 'standard',
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      });
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValue({ changes: 1 });

      await service.deleteOrVoidInvoice(7);

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE invoice_reminders SET status = ? WHERE invoice_id = ? AND status = ?',
        ['skipped', 7, 'pending']
      );
    });
  });

  // ============================================
  // SEARCH INVOICES
  // ============================================

  describe('searchInvoices', () => {
    const mockInvoiceRow = {
      id: 1,
      invoice_number: 'INV-001',
      project_id: 1,
      client_id: 1,
      amount_total: 1000,
      amount_paid: 0,
      currency: 'USD',
      status: 'sent',
      due_date: '2026-03-15',
      issued_date: '2026-02-15',
      invoice_type: 'standard',
      company_name: 'Test Co',
      contact_name: 'Test',
      client_email: 'test@test.com',
      project_name: 'Test Project',
      project_description: 'Desc',
    };

    it('returns all invoices when no filters specified', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all
        .mockResolvedValueOnce([mockInvoiceRow]) // main query
        .mockResolvedValueOnce([]); // line items

      const result = await service.searchInvoices({});

      expect(result.total).toBe(1);
      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0].invoiceNumber).toBe('INV-001');
    });

    it('filters by clientId', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ clientId: 5 });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.client_id = ?'),
        expect.arrayContaining([5])
      );
    });

    it('filters by projectId', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ projectId: 10 });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.project_id = ?'),
        expect.arrayContaining([10])
      );
    });

    it('filters by single status', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ status: 'sent' });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.status = ?'),
        expect.arrayContaining(['sent'])
      );
    });

    it('filters by multiple statuses', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 2 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow, mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ status: ['sent', 'overdue'] });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.status IN (?,?)'),
        expect.arrayContaining(['sent', 'overdue'])
      );
    });

    it('filters by invoice type', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ invoiceType: 'deposit' });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.invoice_type = ?'),
        expect.arrayContaining(['deposit'])
      );
    });

    it('filters by search term in invoice number and notes', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ search: 'INV-001' });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.invoice_number LIKE ?'),
        expect.arrayContaining(['%INV-001%', '%INV-001%'])
      );
    });

    it('filters by date range', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.issued_date >= ?'),
        expect.arrayContaining(['2026-01-01'])
      );
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.issued_date <= ?'),
        expect.arrayContaining(['2026-12-31'])
      );
    });

    it('filters by due date range', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ dueDateFrom: '2026-03-01', dueDateTo: '2026-03-31' });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.due_date >= ?'),
        expect.arrayContaining(['2026-03-01'])
      );
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.due_date <= ?'),
        expect.arrayContaining(['2026-03-31'])
      );
    });

    it('filters by amount range', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 1 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ minAmount: 500, maxAmount: 2000 });

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.amount_total >= ?'),
        expect.arrayContaining([500])
      );
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('i.amount_total <= ?'),
        expect.arrayContaining([2000])
      );
    });

    it('applies pagination', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 50 });
      mockDb.all.mockResolvedValueOnce([mockInvoiceRow]).mockResolvedValueOnce([]);

      await service.searchInvoices({ limit: 10, offset: 20 });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([10, 20])
      );
    });

    it('uses default pagination values', async () => {
      mockDb.get.mockResolvedValueOnce({ total: 100 });
      mockDb.all.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.searchInvoices({});

      // Default limit is 50, offset is 0
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([50, 0])
      );
    });
  });

  // ============================================
  // DEPOSIT AND CREDIT SYSTEM
  // ============================================

  describe('getAvailableDeposits', () => {
    it('returns empty array when no deposits exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.getAvailableDeposits(1);

      expect(result).toEqual([]);
    });

    it('returns deposits with available credit', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 10, invoice_number: 'DEP-001', amount_total: 500, paid_date: '2026-01-15' },
        { id: 11, invoice_number: 'DEP-002', amount_total: 300, paid_date: '2026-02-01' },
      ]);
      // Applied credits for first deposit
      mockDb.get
        .mockResolvedValueOnce({ total_applied: 200 })
        .mockResolvedValueOnce({ total_applied: 0 });

      const result = await service.getAvailableDeposits(5);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        invoiceId: 10,
        invoiceNumber: 'DEP-001',
        totalAmount: 500,
        amountApplied: 200,
        availableAmount: 300,
      });
      expect(result[1]).toMatchObject({
        invoiceId: 11,
        invoiceNumber: 'DEP-002',
        totalAmount: 300,
        amountApplied: 0,
        availableAmount: 300,
      });
    });

    it('excludes fully applied deposits', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 12, invoice_number: 'DEP-003', amount_total: 500, paid_date: '2026-01-15' },
      ]);
      // Fully applied
      mockDb.get.mockResolvedValueOnce({ total_applied: 500 });

      const result = await service.getAvailableDeposits(5);

      expect(result).toHaveLength(0);
    });
  });

  describe('applyDepositCredit', () => {
    const mockDepositInvoice = {
      id: 20,
      invoice_number: 'DEP-010',
      project_id: 1,
      client_id: 1,
      amount_total: 1000,
      amount_paid: 1000,
      currency: 'USD',
      status: 'paid',
      invoice_type: 'deposit',
      deposit_for_project_id: 1,
      company_name: 'Test Co',
      contact_name: 'Test',
      client_email: 'test@test.com',
      project_name: 'Test Project',
      project_description: 'Desc',
    };

    const mockTargetInvoice = {
      id: 30,
      invoice_number: 'INV-030',
      project_id: 1,
      client_id: 1,
      amount_total: 800,
      amount_paid: 0,
      currency: 'USD',
      status: 'sent',
      invoice_type: 'standard',
      company_name: 'Test Co',
      contact_name: 'Test',
      client_email: 'test@test.com',
      project_name: 'Test Project',
      project_description: 'Desc',
    };

    it('applies deposit credit to an invoice', async () => {
      // Mock getInvoiceById for deposit
      mockDb.get.mockResolvedValueOnce(mockDepositInvoice);
      mockDb.all.mockResolvedValueOnce([]); // line items

      // Mock applied credits check
      mockDb.get.mockResolvedValueOnce({ total_applied: 0 });

      // Mock getInvoiceById for target
      mockDb.get.mockResolvedValueOnce(mockTargetInvoice);
      mockDb.all.mockResolvedValueOnce([]); // line items

      // Mock insert and update
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }).mockResolvedValueOnce({ changes: 1 });

      const result = await service.applyDepositCredit(30, 20, 500, 'admin@test.com');

      expect(result).toMatchObject({
        id: 1,
        invoiceId: 30,
        depositInvoiceId: 20,
        depositInvoiceNumber: 'DEP-010',
        amount: 500,
        appliedBy: 'admin@test.com',
      });

      // Verify the credit insert
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoice_credits'),
        [30, 20, 500, 'admin@test.com']
      );

      // Verify the invoice update
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices'),
        [500, 500, 500, 30]
      );
    });

    it('throws error for non-deposit invoices', async () => {
      const nonDepositInvoice = { ...mockDepositInvoice, invoice_type: 'standard' };
      mockDb.get.mockResolvedValueOnce(nonDepositInvoice);
      mockDb.all.mockResolvedValueOnce([]);

      await expect(service.applyDepositCredit(30, 20, 500)).rejects.toThrow(
        'Invalid deposit invoice or deposit not paid'
      );
    });

    it('throws error for unpaid deposit', async () => {
      const unpaidDeposit = { ...mockDepositInvoice, status: 'sent' };
      mockDb.get.mockResolvedValueOnce(unpaidDeposit);
      mockDb.all.mockResolvedValueOnce([]);

      await expect(service.applyDepositCredit(30, 20, 500)).rejects.toThrow(
        'Invalid deposit invoice or deposit not paid'
      );
    });

    it('throws error when insufficient credit available', async () => {
      mockDb.get.mockResolvedValueOnce(mockDepositInvoice);
      mockDb.all.mockResolvedValueOnce([]);
      // Already applied 800 of 1000
      mockDb.get.mockResolvedValueOnce({ total_applied: 800 });

      await expect(service.applyDepositCredit(30, 20, 500)).rejects.toThrow(
        'Insufficient deposit credit. Available: $200.00'
      );
    });

    it('throws error when applying credit to deposit invoice', async () => {
      mockDb.get.mockResolvedValueOnce(mockDepositInvoice);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({ total_applied: 0 });
      // Target is also a deposit
      mockDb.get.mockResolvedValueOnce({ ...mockTargetInvoice, invoice_type: 'deposit' });
      mockDb.all.mockResolvedValueOnce([]);

      await expect(service.applyDepositCredit(30, 20, 500)).rejects.toThrow(
        'Cannot apply credit to a deposit invoice'
      );
    });
  });

  describe('getInvoiceCredits', () => {
    it('returns credits applied to an invoice', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          invoice_id: 30,
          deposit_invoice_id: 20,
          deposit_invoice_number: 'DEP-010',
          amount: 500,
          applied_at: '2026-02-15T10:00:00Z',
          applied_by: 'admin@test.com',
        },
        {
          id: 2,
          invoice_id: 30,
          deposit_invoice_id: 21,
          deposit_invoice_number: 'DEP-011',
          amount: 200,
          applied_at: '2026-02-16T10:00:00Z',
          applied_by: null,
        },
      ]);

      const result = await service.getInvoiceCredits(30);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        invoiceId: 30,
        depositInvoiceId: 20,
        amount: 500,
      });
      expect(result[1].amount).toBe(200);
    });

    it('returns empty array when no credits', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.getInvoiceCredits(99);

      expect(result).toEqual([]);
    });
  });

  describe('getTotalCredits', () => {
    it('returns sum of credits for an invoice', async () => {
      mockDb.get.mockResolvedValueOnce({ total_credits: 700 });

      const result = await service.getTotalCredits(30);

      expect(result).toBe(700);
    });

    it('returns 0 when no credits', async () => {
      mockDb.get.mockResolvedValueOnce({ total_credits: 0 });

      const result = await service.getTotalCredits(99);

      expect(result).toBe(0);
    });

    it('handles null result', async () => {
      mockDb.get.mockResolvedValueOnce({});

      const result = await service.getTotalCredits(99);

      expect(result).toBe(0);
    });
  });

  // ============================================
  // CHECK AND MARK OVERDUE
  // ============================================

  describe('checkAndMarkOverdue', () => {
    it('marks past-due invoices as overdue', async () => {
      vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
      mockDb.run.mockResolvedValueOnce({ changes: 5 });

      const result = await service.checkAndMarkOverdue();

      expect(result).toBe(5);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'overdue'"),
        ['2026-03-01']
      );
    });

    it('returns 0 when no invoices to mark', async () => {
      vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
      mockDb.run.mockResolvedValueOnce({ changes: 0 });

      const result = await service.checkAndMarkOverdue();

      expect(result).toBe(0);
    });
  });

  // ============================================
  // LATE FEE APPLICATION
  // ============================================

  describe('applyLateFee', () => {
    it('applies late fee to overdue invoice', async () => {
      vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));

      const overdueInvoice = {
        id: 40,
        invoice_number: 'INV-040',
        project_id: 1,
        client_id: 1,
        amount_total: 1000,
        amount_paid: 0,
        currency: 'USD',
        status: 'overdue',
        due_date: '2026-03-01',
        invoice_type: 'standard',
        late_fee_rate: 50,
        late_fee_type: 'flat',
        late_fee_applied_at: null,
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      };

      // Initial fetch
      mockDb.get.mockResolvedValueOnce(overdueInvoice);
      mockDb.all.mockResolvedValueOnce([]);
      // Update
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      // Return updated invoice
      mockDb.get.mockResolvedValueOnce({
        ...overdueInvoice,
        late_fee_amount: 50,
        amount_total: 1050,
        late_fee_applied_at: '2026-03-10T12:00:00Z',
      });
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.applyLateFee(40);

      expect(result.amountTotal).toBe(1050);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('late_fee_amount = ?'),
        [50, 1050, 40]
      );
    });

    it('throws error if late fee already applied', async () => {
      const alreadyApplied = {
        id: 41,
        invoice_number: 'INV-041',
        project_id: 1,
        client_id: 1,
        amount_total: 1050,
        amount_paid: 0,
        currency: 'USD',
        status: 'overdue',
        due_date: '2026-03-01',
        invoice_type: 'standard',
        late_fee_rate: 50,
        late_fee_type: 'flat',
        late_fee_applied_at: '2026-03-05T12:00:00Z',
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      };

      mockDb.get.mockResolvedValueOnce(alreadyApplied);
      mockDb.all.mockResolvedValueOnce([]);

      await expect(service.applyLateFee(41)).rejects.toThrow(
        'Late fee has already been applied to this invoice'
      );
    });

    it('throws error if no late fee applicable', async () => {
      vi.setSystemTime(new Date('2026-02-20T12:00:00Z'));

      const notOverdue = {
        id: 42,
        invoice_number: 'INV-042',
        project_id: 1,
        client_id: 1,
        amount_total: 1000,
        amount_paid: 0,
        currency: 'USD',
        status: 'sent',
        due_date: '2026-03-01', // Not overdue yet
        invoice_type: 'standard',
        late_fee_rate: 50,
        late_fee_type: 'flat',
        late_fee_applied_at: null,
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      };

      mockDb.get.mockResolvedValueOnce(notOverdue);
      mockDb.all.mockResolvedValueOnce([]);

      await expect(service.applyLateFee(42)).rejects.toThrow(
        'No late fee applicable for this invoice'
      );
    });
  });

  // ============================================
  // INVOICE UPDATE (only draft)
  // ============================================

  describe('updateInvoice', () => {
    const mockDraftInvoice = {
      id: 50,
      invoice_number: 'INV-050',
      project_id: 1,
      client_id: 1,
      amount_total: 500,
      amount_paid: 0,
      currency: 'USD',
      status: 'draft',
      due_date: '2026-03-15',
      invoice_type: 'standard',
      company_name: 'Test Co',
      contact_name: 'Test',
      client_email: 'test@test.com',
      project_name: 'Test Project',
      project_description: 'Desc',
    };

    it('updates draft invoice with new line items', async () => {
      mockDb.get.mockResolvedValueOnce(mockDraftInvoice);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run
        .mockResolvedValueOnce({ changes: 1 }) // UPDATE invoices
        .mockResolvedValueOnce({ changes: 1 }) // DELETE line items
        .mockResolvedValueOnce({ lastID: 1 }); // INSERT line item

      // Return updated invoice
      mockDb.get.mockResolvedValueOnce({ ...mockDraftInvoice, amount_total: 800 });
      mockDb.all.mockResolvedValueOnce([
        { description: 'New Service', quantity: 1, unit_price: 800, amount: 800 },
      ]);

      const newLineItems = [{ description: 'New Service', quantity: 1, rate: 800, amount: 800 }];

      const result = await service.updateInvoice(50, { lineItems: newLineItems });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices SET'),
        expect.arrayContaining([800, 800, 50])
      );
    });

    it('updates draft invoice notes and terms', async () => {
      mockDb.get.mockResolvedValueOnce(mockDraftInvoice);
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      mockDb.get.mockResolvedValueOnce({ ...mockDraftInvoice, notes: 'New notes' });
      mockDb.all.mockResolvedValueOnce([]);

      await service.updateInvoice(50, { notes: 'New notes', terms: 'New terms' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('notes = ?'),
        expect.arrayContaining(['New notes', 'New terms', 50])
      );
    });

    it('throws error when updating non-draft invoice', async () => {
      const sentInvoice = { ...mockDraftInvoice, status: 'sent' };
      mockDb.get.mockResolvedValueOnce(sentInvoice);
      mockDb.all.mockResolvedValueOnce([]);

      await expect(service.updateInvoice(50, { notes: 'Update' })).rejects.toThrow(
        'Only draft invoices can be edited'
      );
    });

    it('returns unchanged invoice when no updates provided', async () => {
      mockDb.get.mockResolvedValueOnce(mockDraftInvoice);
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.updateInvoice(50, {});

      expect(mockDb.run).not.toHaveBeenCalled();
      expect(result.invoiceNumber).toBe('INV-050');
    });
  });

  // ============================================
  // DUPLICATE INVOICE
  // ============================================

  describe('duplicateInvoice', () => {
    it('creates a draft copy of an existing invoice', async () => {
      vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));

      const originalInvoice = {
        id: 60,
        invoice_number: 'INV-060',
        project_id: 1,
        client_id: 1,
        amount_total: 1000,
        amount_paid: 1000,
        currency: 'USD',
        status: 'paid',
        due_date: '2026-02-15',
        issued_date: '2026-01-15',
        invoice_type: 'standard',
        notes: 'Original notes',
        terms: 'Net 30',
        company_name: 'Test Co',
        contact_name: 'Test',
        client_email: 'test@test.com',
        project_name: 'Test Project',
        project_description: 'Desc',
      };

      // Get original
      mockDb.get.mockResolvedValueOnce(originalInvoice);
      mockDb.all.mockResolvedValueOnce([
        { description: 'Service', quantity: 1, unit_price: 1000, amount: 1000 },
      ]);

      // Insert duplicate
      mockDb.run
        .mockResolvedValueOnce({ lastID: 61 }) // INSERT invoice
        .mockResolvedValueOnce({ changes: 0 }) // DELETE old line items
        .mockResolvedValueOnce({ lastID: 1 }); // INSERT line item

      // Return new invoice
      mockDb.get.mockResolvedValueOnce({
        ...originalInvoice,
        id: 61,
        invoice_number: expect.stringContaining('INV-'),
        status: 'draft',
        amount_paid: 0,
      });
      mockDb.all.mockResolvedValueOnce([]);

      const result = await service.duplicateInvoice(60);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO invoices'),
        expect.arrayContaining([1, 1, 1000, 'USD']) // projectId, clientId, amount, currency
      );
    });
  });
});
