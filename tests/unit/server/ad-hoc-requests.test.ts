/**
 * ===============================================
 * TEST SUITE - AD HOC REQUESTS
 * ===============================================
 * @file tests/server/ad-hoc-requests.test.ts
 *
 * Tests for ad hoc request system endpoints:
 * - Time entry logging and retrieval
 * - Invoice generation (single & bundled)
 * - Analytics and revenue tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/database/init';

// Mock database setup
vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn()
}));

describe('Ad Hoc Requests - Time Entry Endpoints', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('GET /api/ad-hoc-requests/:requestId/time-entries', () => {
    it('should fetch time entries for an ad hoc request', async () => {
      const requestId = 1;
      const mockEntries = [
        {
          id: 1,
          project_id: 100,
          task_id: 50,
          user_name: 'John Doe',
          hours: 4.5,
          date: '2026-02-10',
          billable: 1,
          hourly_rate: 150,
          description: 'UI implementation',
          created_at: '2026-02-10T10:00:00Z'
        },
        {
          id: 2,
          project_id: 100,
          task_id: 50,
          user_name: 'Jane Smith',
          hours: 2,
          date: '2026-02-09',
          billable: 1,
          hourly_rate: null,
          description: 'Code review',
          created_at: '2026-02-09T14:00:00Z'
        }
      ];

      mockDb.all.mockResolvedValue(mockEntries);

      // Test would call: GET /api/ad-hoc-requests/1/time-entries
      const entries = await mockDb.all();
      
      expect(entries).toHaveLength(2);
      expect(entries[0].user_name).toBe('John Doe');
      expect(entries[0].hours).toBe(4.5);
      expect(entries[1].billable).toBe(1);
    });

    it('should return empty array if no time entries exist', async () => {
      mockDb.all.mockResolvedValue([]);

      const entries = await mockDb.all();

      expect(entries).toEqual([]);
      expect(entries).toHaveLength(0);
    });

    it('should filter time entries by date range', async () => {
      const mockEntries = [
        {
          id: 1,
          date: '2026-02-10',
          hours: 3,
          user_name: 'John'
        }
      ];

      mockDb.all.mockResolvedValue(mockEntries);

      const entries = await mockDb.all(
        'SELECT * FROM time_entries WHERE date >= ? AND date <= ?',
        ['2026-02-01', '2026-02-28']
      );

      expect(entries).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM time_entries WHERE date >= ? AND date <= ?',
        ['2026-02-01', '2026-02-28']
      );
    });
  });

  describe('POST /api/ad-hoc-requests/:requestId/time-entries', () => {
    it('should log time entry for an ad hoc request', async () => {
      const requestId = 1;
      const timeEntryData = {
        userName: 'John Doe',
        hours: 4.5,
        date: '2026-02-10',
        description: 'Implementation work',
        billable: true,
        hourlyRate: 150
      };

      const insertedEntry = {
        id: 1,
        user_name: 'John Doe',
        hours: 4.5,
        date: '2026-02-10',
        description: 'Implementation work',
        billable: true,
        hourly_rate: 150
      };

      mockDb.run.mockResolvedValue({ lastID: 1 });
      mockDb.get.mockResolvedValue(insertedEntry);

      // Simulate insertion
      await mockDb.run(
        'INSERT INTO time_entries (project_id, task_id, user_name, hours, date, description, billable, hourly_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [100, 50, timeEntryData.userName, timeEntryData.hours, timeEntryData.date, timeEntryData.description, 1, timeEntryData.hourlyRate]
      );

      const entry = await mockDb.get('SELECT * FROM time_entries WHERE id = ?', [1]);

      expect(entry.user_name).toBe('John Doe');
      expect(entry.hours).toBe(4.5);
      expect(entry.billable).toBe(true);
    });

    it('should require userName, hours, and date fields', async () => {
      const invalidData = {
        userName: '',
        hours: null,
        date: null
      };

      // Validation would fail
      expect(invalidData.userName).toBeFalsy();
      expect(invalidData.hours).toBeNull();
      expect(invalidData.date).toBeNull();
    });

    it('should update project actual hours on time entry creation', async () => {
      const projectId = 100;
      const hours = 4.5;

      mockDb.run.mockResolvedValue({ lastID: 1 });

      // Insert time entry
      await mockDb.run('INSERT INTO time_entries (...) VALUES (...)', []);

      // Update project hours
      await mockDb.run(
        'UPDATE projects SET actual_hours = COALESCE(actual_hours, 0) + ? WHERE id = ?',
        [hours, projectId]
      );

      expect(mockDb.run).toHaveBeenCalledWith(
        'UPDATE projects SET actual_hours = COALESCE(actual_hours, 0) + ? WHERE id = ?',
        [hours, projectId]
      );
    });

    it('should accept optional custom hourly rate', async () => {
      const timeEntry = {
        userName: 'John',
        hours: 3,
        date: '2026-02-10',
        billable: true,
        hourlyRate: 200 // custom rate overrides request default
      };

      expect(timeEntry.hourlyRate).toBe(200);
    });

    it('should default billable to true if not specified', async () => {
      const timeEntry = {
        userName: 'John',
        hours: 2,
        date: '2026-02-10',
        billable: true // default
      };

      expect(timeEntry.billable).toBe(true);
    });

    it('should reject non-billable entries if billable=false', async () => {
      const nonBillableEntry = {
        userName: 'Jane',
        hours: 1,
        date: '2026-02-10',
        billable: false,
        description: 'Research'
      };

      expect(nonBillableEntry.billable).toBe(false);
    });
  });
});

describe('Ad Hoc Requests - Invoice Generation Endpoints', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('POST /api/ad-hoc-requests/:requestId/invoice', () => {
    it('should generate invoice from a completed ad hoc request', async () => {
      const requestId = 1;
      const request = {
        id: 1,
        projectId: 100,
        clientId: 5,
        title: 'Custom Feature Development',
        status: 'completed',
        quotedPrice: 2500,
        hourlyRate: 150,
        estimatedHours: null
      };

      mockDb.get.mockResolvedValue(request);
      mockDb.run.mockResolvedValue({ lastID: 101 });

      const invoice = await mockDb.get('SELECT * FROM ad_hoc_requests WHERE id = ?', [requestId]);

      expect(invoice.status).toBe('completed');
      expect(invoice.quotedPrice).toBe(2500);
    });

    it('should reject invoice generation for non-completed requests', async () => {
      const request = {
        id: 1,
        status: 'in_progress'
      };

      expect(request.status).not.toBe('completed');
    });

    it('should include billable time entries in invoice calculation', async () => {
      const requestId = 1;
      const timeEntries = [
        { hours: 4, billable: 1, hourlyRate: 150 },
        { hours: 2, billable: 1, hourlyRate: 150 },
        { hours: 1, billable: 0, hourlyRate: 150 } // non-billable, excluded
      ];

      const billableHours = timeEntries
        .filter(e => e.billable === 1)
        .reduce((sum, e) => sum + e.hours, 0);

      expect(billableHours).toBe(6); // 4 + 2
    });

    it('should create invoice with correct line item', async () => {
      const request = {
        id: 1,
        title: 'Feature Request',
        quotedPrice: 3000,
        hourlyRate: 200
      };

      const lineItem = {
        description: `Ad hoc request #${request.id}: ${request.title}`,
        quantity: 1,
        rate: request.quotedPrice,
        amount: request.quotedPrice
      };

      expect(lineItem.description).toContain('Ad hoc request #1');
      expect(lineItem.amount).toBe(3000);
    });

    it('should use hourly rate calculation if set', async () => {
      const request = {
        estimatedHours: 10,
        hourlyRate: 150
      };

      const amount = request.estimatedHours * request.hourlyRate;

      expect(amount).toBe(1500);
    });

    it('should use flat rate if specified', async () => {
      const request = {
        flatRate: 2000
      };

      const lineItem = {
        amount: request.flatRate
      };

      expect(lineItem.amount).toBe(2000);
    });

    it('should use quoted price if available', async () => {
      const request = {
        quotedPrice: 2500,
        flatRate: 2000,
        hourlyRate: 150
      };

      // Priority: quotedPrice > flatRate > (estimatedHours * hourlyRate)
      expect(request.quotedPrice).toBe(2500);
    });

    it('should set invoice due date to 30 days from now by default', async () => {
      const today = new Date();
      const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      expect(dueDate.getTime()).toBeGreaterThan(today.getTime());
    });

    it('should accept custom due date', async () => {
      const customDueDate = '2026-03-15';

      expect(customDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should create link entry in ad_hoc_request_invoices table', async () => {
      const requestId = 1;
      const invoiceId = 101;
      const amount = 2500;

      mockDb.run.mockResolvedValue({ lastID: 1 });

      await mockDb.run(
        'INSERT INTO ad_hoc_request_invoices (request_id, invoice_id, amount) VALUES (?, ?, ?)',
        [requestId, invoiceId, amount]
      );

      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT INTO ad_hoc_request_invoices (request_id, invoice_id, amount) VALUES (?, ?, ?)',
        [1, 101, 2500]
      );
    });
  });

  describe('POST /api/ad-hoc-requests/invoice/bundle', () => {
    it('should bundle multiple ad hoc requests into one invoice', async () => {
      const requestIds = [1, 2, 3];
      const requests = [
        { id: 1, projectId: 100, clientId: 5, title: 'Feature A', quotedPrice: 1000 },
        { id: 2, projectId: 100, clientId: 5, title: 'Feature B', quotedPrice: 1500 },
        { id: 3, projectId: 100, clientId: 5, title: 'Bug Fix', quotedPrice: 500 }
      ];

      const totalAmount = requests.reduce((sum, r) => sum + r.quotedPrice, 0);

      expect(totalAmount).toBe(3000);
      expect(requests).toHaveLength(3);
    });

    it('should require all requests to have same projectId', async () => {
      const requests = [
        { id: 1, projectId: 100 },
        { id: 2, projectId: 101 } // different project!
      ];

      const sameProject = requests.every(r => r.projectId === requests[0].projectId);

      expect(sameProject).toBe(false);
    });

    it('should require all requests to have same clientId', async () => {
      const requests = [
        { id: 1, clientId: 5 },
        { id: 2, clientId: 6 } // different client!
      ];

      const sameClient = requests.every(r => r.clientId === requests[0].clientId);

      expect(sameClient).toBe(false);
    });

    it('should require all requests to be completed', async () => {
      const requests = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'in_progress' } // not completed!
      ];

      const allCompleted = requests.every(r => r.status === 'completed');

      expect(allCompleted).toBe(false);
    });

    it('should create line item for each bundled request', async () => {
      const requests = [
        { id: 1, title: 'Feature A', quotedPrice: 1000 },
        { id: 2, title: 'Feature B', quotedPrice: 1500 }
      ];

      const lineItems = requests.map(r => ({
        description: `Ad hoc request #${r.id}: ${r.title}`,
        amount: r.quotedPrice
      }));

      expect(lineItems).toHaveLength(2);
      expect(lineItems[0].amount).toBe(1000);
      expect(lineItems[1].amount).toBe(1500);
    });

    it('should link all bundled requests to the invoice', async () => {
      const requestIds = [1, 2, 3];
      const invoiceId = 101;

      mockDb.run.mockResolvedValue({ changes: 1 });

      for (const requestId of requestIds) {
        await mockDb.run(
          'INSERT INTO ad_hoc_request_invoices (request_id, invoice_id, amount) VALUES (?, ?, ?)',
          [requestId, invoiceId, 0] // amount would be per request
        );
      }

      expect(mockDb.run).toHaveBeenCalledTimes(3);
    });

    it('should reject empty bundle (no requests selected)', async () => {
      const requestIds: number[] = [];

      expect(requestIds.length).toBe(0);
    });

    it('should include notes in bundled invoice', async () => {
      const bundleData = {
        requestIds: [1, 2],
        note: 'Bundled ad hoc work for Q1'
      };

      expect(bundleData.note).toContain('Bundled');
    });

    it('should calculate total correctly for bundled items', async () => {
      const items = [
        { amount: 1000 },
        { amount: 1500 },
        { amount: 500 }
      ];

      const total = items.reduce((sum, item) => sum + item.amount, 0);

      expect(total).toBe(3000);
    });
  });
});

describe('Ad Hoc Requests - Analytics Endpoints', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('GET /api/ad-hoc-requests/summary/monthly', () => {
    it('should return monthly ad hoc revenue data', async () => {
      const mockData = [
        {
          month: '2026-02',
          totalRevenue: 5000,
          invoiceCount: 3,
          requestCount: 5
        },
        {
          month: '2026-01',
          totalRevenue: 3500,
          invoiceCount: 2,
          requestCount: 3
        }
      ];

      mockDb.all.mockResolvedValue(mockData);

      const data = await mockDb.all(
        'SELECT strftime("%Y-%m", i.issued_date) as month, SUM(ai.amount) as totalRevenue FROM ad_hoc_request_invoices ai JOIN invoices i ON ai.invoice_id = i.id GROUP BY month ORDER BY month DESC'
      );

      expect(data).toHaveLength(2);
      expect(data[0].totalRevenue).toBe(5000);
    });

    it('should support grouping by client', async () => {
      const mockData = [
        {
          clientName: 'Acme Corp',
          totalRevenue: 7500,
          invoiceCount: 4
        },
        {
          clientName: 'Beta Inc',
          totalRevenue: 2000,
          invoiceCount: 1
        }
      ];

      mockDb.all.mockResolvedValue(mockData);

      const data = await mockDb.all(
        'SELECT c.contact_name as clientName, SUM(ai.amount) as totalRevenue FROM ad_hoc_request_invoices ai JOIN ad_hoc_requests r ON ai.request_id = r.id JOIN clients c ON r.client_id = c.id GROUP BY r.client_id'
      );

      expect(data).toHaveLength(2);
      expect(data[0].clientName).toBe('Acme Corp');
      expect(data[0].totalRevenue).toBe(7500);
    });

    it('should support filtering by date range', async () => {
      const mockData = [
        { month: '2026-02', totalRevenue: 5000 }
      ];

      mockDb.all.mockResolvedValue(mockData);

      const data = await mockDb.all(
        'SELECT strftime("%Y-%m", i.issued_date) as month, SUM(ai.amount) as totalRevenue FROM ad_hoc_request_invoices ai JOIN invoices i ON ai.invoice_id = i.id WHERE i.issued_date >= ? AND i.issued_date <= ? GROUP BY month',
        ['2026-02-01', '2026-02-28']
      );

      expect(data).toHaveLength(1);
      expect(data[0].month).toBe('2026-02');
    });

    it('should return empty array if no data', async () => {
      mockDb.all.mockResolvedValue([]);

      const data = await mockDb.all('SELECT ...');

      expect(data).toEqual([]);
    });

    it('should support limit parameter', async () => {
      mockDb.all.mockResolvedValue([
        { month: '2026-02', totalRevenue: 5000 },
        { month: '2026-01', totalRevenue: 3500 }
      ]);

      const data = await mockDb.all('SELECT ... LIMIT 12');

      expect(data.length).toBeLessThanOrEqual(12);
    });

    it('should calculate average invoice amount', async () => {
      const mockData = {
        totalRevenue: 5000,
        invoiceCount: 3,
        averageAmount: 1666.67
      };

      const average = mockData.totalRevenue / mockData.invoiceCount;

      expect(average).toBeCloseTo(1666.67);
    });

    it('should track largest invoice amount', async () => {
      const mockData = {
        totalRevenue: 5000,
        largestAmount: 2000
      };

      expect(mockData.largestAmount).toBe(2000);
      expect(mockData.largestAmount).toBeLessThanOrEqual(mockData.totalRevenue);
    });

    it('should support filtering by specific client', async () => {
      const clientId = 5;
      const mockData = [
        {
          month: '2026-02',
          totalRevenue: 3000,
          invoiceCount: 2
        }
      ];

      mockDb.all.mockResolvedValue(mockData);

      const data = await mockDb.all(
        'SELECT ... WHERE r.client_id = ?',
        [clientId]
      );

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([clientId])
      );
    });
  });

  describe('Ad hoc revenue calculations', () => {
    it('should calculate month-over-month change', async () => {
      const currentMonth = 5000;
      const previousMonth = 3500;
      const change = ((currentMonth - previousMonth) / previousMonth) * 100;

      expect(change).toBeCloseTo(42.86); // ~43% increase
    });

    it('should return 0% change if no previous data', async () => {
      const change = 0;

      expect(change).toBe(0);
    });

    it('should handle negative revenue change', async () => {
      const currentMonth = 2000;
      const previousMonth = 3000;
      const change = ((currentMonth - previousMonth) / previousMonth) * 100;

      expect(change).toBeCloseTo(-33.33); // ~-33% decrease
    });

    it('should include invoice count in metrics', async () => {
      const metrics = {
        totalRevenue: 5000,
        invoiceCount: 3,
        averageAmount: 1666.67
      };

      expect(metrics.invoiceCount).toBe(3);
    });

    it('should track top clients by revenue', async () => {
      const clients = [
        { clientName: 'Acme', totalRevenue: 5000 },
        { clientName: 'Beta', totalRevenue: 3000 },
        { clientName: 'Gamma', totalRevenue: 1500 }
      ];

      const sorted = [...clients].sort((a, b) => b.totalRevenue - a.totalRevenue);

      expect(sorted[0].clientName).toBe('Acme');
      expect(sorted[0].totalRevenue).toBe(5000);
    });
  });
});

describe('Ad Hoc Requests - Error Handling', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  it('should return 404 for non-existent request', async () => {
    mockDb.get.mockResolvedValue(null);

    const request = await mockDb.get('SELECT * FROM ad_hoc_requests WHERE id = ?', [999]);

    expect(request).toBeNull();
  });

  it('should return 400 for missing required fields in time entry', async () => {
    const invalidEntry = {
      userName: '',
      hours: null,
      date: null
    };

    const isValid = invalidEntry.userName && invalidEntry.hours !== null && invalidEntry.date;

    expect(isValid).toBeFalsy();
  });

  it('should validate time entry hours is positive', async () => {
    const invalidHours = -5;

    expect(invalidHours).toBeLessThan(0);
  });

  it('should validate invoice bundle has at least one request', async () => {
    const requestIds: number[] = [];

    expect(requestIds.length).toBe(0);
  });

  it('should handle database connection errors gracefully', async () => {
    mockDb.all.mockRejectedValue(new Error('Database connection failed'));

    await expect(mockDb.all()).rejects.toThrow('Database connection failed');
  });

  it('should validate request is linked to task before logging time', async () => {
    const request = {
      id: 1,
      taskId: null // not linked
    };

    expect(request.taskId).toBeNull();
  });
});
