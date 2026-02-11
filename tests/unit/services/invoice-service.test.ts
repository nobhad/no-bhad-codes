/**
 * ===============================================
 * INVOICE SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/invoice-service.test.ts
 *
 * Unit tests for invoice service helpers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn()
}));

vi.mock('../../../server/database/init', () => ({
  getDatabase: () => mockDb
}));

import { InvoiceService, Invoice } from '../../../server/services/invoice-service';

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
      lineItems: []
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
      lineItems: []
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
      lateFeeType: 'flat'
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
      lateFeeType: 'percentage'
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
      lateFeeType: 'daily_percentage'
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
      created_at: '2024-07-01'
    });

    const result = await service.scheduleInvoice({
      projectId: 1,
      clientId: 2,
      scheduledDate: '2024-07-15',
      lineItems,
      notes: 'Follow up',
      terms: 'Net 30'
    });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO scheduled_invoices'),
      [
        1,
        2,
        '2024-07-15',
        'date',
        null,
        JSON.stringify(lineItems),
        'Follow up',
        'Net 30'
      ]
    );
    expect(result).toMatchObject({
      id: 7,
      projectId: 1,
      clientId: 2,
      scheduledDate: '2024-07-15',
      triggerType: 'date',
      lineItems,
      status: 'pending'
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
        line_items: JSON.stringify([{ description: 'Phase 1', quantity: 1, rate: 300, amount: 300 }]),
        notes: null,
        terms: null,
        status: 'pending',
        generated_invoice_id: null,
        created_at: '2024-07-20'
      }
    ]);

    const result = await service.getScheduledInvoices(9);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('AND project_id = ?'),
      [9]
    );
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
        line_items: JSON.stringify([{ description: 'Phase 2', quantity: 1, rate: 800, amount: 800 }]),
        notes: 'Auto',
        terms: 'Net 15',
        status: 'pending',
        generated_invoice_id: null,
        created_at: '2024-06-20'
      }
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
      lineItems: []
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
      created_at: '2024-01-10'
    });

    const result = await service.createRecurringInvoice({
      projectId: 2,
      clientId: 3,
      frequency: 'monthly',
      dayOfMonth: 31,
      lineItems,
      notes: 'Monthly',
      terms: 'Net 10',
      startDate: '2024-01-10'
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
      created_at: '2024-07-01'
    });

    const result = await service.createRecurringInvoice({
      projectId: 3,
      clientId: 4,
      frequency: 'weekly',
      dayOfWeek: 5,
      lineItems,
      notes: 'Weekly',
      startDate: '2024-07-01'
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
        created_at: '2024-06-01'
      }
    ]);

    const result = await service.getRecurringInvoices(7);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE project_id = ?'),
      [7]
    );
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
      created_at: '2024-01-10'
    });

    const result = await service.updateRecurringInvoice(6, {
      frequency: 'weekly',
      dayOfWeek: 2,
      lineItems,
      notes: 'Updated',
      terms: 'Net 20'
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
      created_at: '2024-01-20'
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
        line_items: JSON.stringify([{ description: 'Maintenance', quantity: 1, rate: 150, amount: 150 }]),
        notes: 'Recurring',
        terms: 'Net 10',
        start_date: '2024-01-15',
        end_date: null,
        next_generation_date: '2024-07-15',
        last_generated_at: null,
        is_active: 1,
        created_at: '2024-01-15'
      }
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
      lineItems: []
    } as Invoice);

    const count = await service.processRecurringInvoices();

    expect(count).toBe(1);
    expect(mockDb.run).toHaveBeenCalledWith(
      'UPDATE recurring_invoices SET last_generated_at = CURRENT_TIMESTAMP, next_generation_date = ? WHERE id = ?',
      ['2024-08-16', 12]
    );

    createInvoiceSpy.mockRestore();
  });
});
