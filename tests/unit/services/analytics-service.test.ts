/**
 * ===============================================
 * UNIT TESTS - ANALYTICS SERVICE
 * ===============================================
 * @file tests/unit/services/analytics-service.test.ts
 *
 * Tests for analytics service including:
 * - Saved reports CRUD
 * - Report schedules CRUD
 * - Dashboard widgets CRUD
 * - KPI snapshots and trends
 * - Metric alerts CRUD and trigger checking
 * - Report data generation (all report types)
 * - Route-compatible wrapper methods
 * - Business intelligence methods
 * - Client insight methods
 * - Operational report methods
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

vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(1),
    getUserIdByEmailOrName: vi.fn().mockResolvedValue(1)
  }
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../server/utils/safe-json', () => ({
  safeJsonParseArray: vi.fn((val: string | null) => {
    if (!val) return [];
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }),
  safeJsonParseObject: vi.fn((val: string | null) => {
    if (!val) return {};
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  })
}));

// Import after mocks
import { analyticsService } from '../../../server/services/analytics-service';

// ============================================
// Shared mock data factories
// ============================================

const makeReportRow = (overrides = {}) => ({
  id: 1,
  name: 'Test Report',
  description: null,
  report_type: 'revenue',
  filters: '{}',
  columns: null,
  sort_by: null,
  sort_order: 'DESC',
  chart_type: null,
  is_favorite: false,
  is_shared: false,
  created_by: 'test@example.com',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeScheduleRow = (overrides = {}) => ({
  id: 1,
  report_id: 1,
  name: 'Weekly Schedule',
  frequency: 'weekly',
  day_of_week: 1,
  day_of_month: null,
  time_of_day: '09:00',
  timezone: 'America/New_York',
  recipients: '[{"email":"test@example.com"}]',
  format: 'pdf',
  include_charts: true,
  last_sent_at: null,
  next_send_at: '2026-01-08T09:00:00Z',
  is_active: true,
  created_by: 'admin@example.com',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeWidgetRow = (overrides = {}) => ({
  id: 1,
  user_email: 'user@example.com',
  widget_type: 'metric',
  title: 'Revenue Widget',
  data_source: 'revenue',
  config: '{}',
  position_x: 0,
  position_y: 0,
  width: 2,
  height: 2,
  refresh_interval: null,
  is_visible: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeAlertRow = (overrides = {}) => ({
  id: 1,
  name: 'High Revenue Alert',
  kpi_type: 'total_revenue',
  condition: 'above',
  threshold_value: 10000,
  notification_emails: '["admin@example.com"]',
  is_active: true,
  last_triggered_at: null,
  trigger_count: 0,
  created_by: 'admin@example.com',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeKPISnapshotRow = (overrides = {}) => ({
  id: 1,
  snapshot_date: '2026-01-01',
  kpi_type: 'total_revenue',
  value: 50000,
  previous_value: 45000,
  change_percent: 11.11,
  metadata: '{}',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides
});

// ============================================
// SAVED REPORTS
// ============================================

describe('AnalyticsService - Saved Reports', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    mockDb.transaction.mockReset();
  });

  describe('createReport', () => {
    it('creates a report and returns the created record', async () => {
      const reportRow = makeReportRow();
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(reportRow);

      const result = await analyticsService.createReport({
        name: 'Test Report',
        report_type: 'revenue',
        created_by: 'test@example.com'
      });

      expect(mockDb.run).toHaveBeenCalledOnce();
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Report');
    });

    it('creates a report with all optional fields', async () => {
      const reportRow = makeReportRow({
        description: 'A description',
        filters: '{"status":"paid"}',
        columns: '["month","revenue"]',
        sort_by: 'month',
        sort_order: 'ASC',
        chart_type: 'bar',
        is_favorite: true,
        is_shared: true
      });
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(reportRow);

      const result = await analyticsService.createReport({
        name: 'Test Report',
        report_type: 'revenue',
        description: 'A description',
        filters: { status: 'paid' },
        columns: ['month', 'revenue'],
        sort_by: 'month',
        sort_order: 'ASC',
        chart_type: 'bar'
      });

      expect(result).toBeDefined();
    });

    it('propagates DB errors', async () => {
      mockDb.run.mockRejectedValueOnce(new Error('DB insert failed'));

      await expect(
        analyticsService.createReport({ name: 'Fail', report_type: 'revenue' })
      ).rejects.toThrow('DB insert failed');
    });
  });

  describe('getReports', () => {
    it('returns all reports when no userEmail provided', async () => {
      const rows = [makeReportRow(), makeReportRow({ id: 2, name: 'Second Report' })];
      mockDb.all.mockResolvedValueOnce(rows);

      const result = await analyticsService.getReports();

      expect(mockDb.all).toHaveBeenCalledOnce();
      expect(result).toHaveLength(2);
    });

    it('filters by userEmail when provided', async () => {
      mockDb.all.mockResolvedValueOnce([makeReportRow()]);

      const result = await analyticsService.getReports('user@example.com');

      expect(result).toHaveLength(1);
      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('created_by');
    });

    it('returns empty array when no reports', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getReports();

      expect(result).toEqual([]);
    });
  });

  describe('getReport', () => {
    it('returns a single report by id', async () => {
      mockDb.get.mockResolvedValueOnce(makeReportRow());

      const result = await analyticsService.getReport(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('throws when report not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(analyticsService.getReport(999)).rejects.toThrow('Report not found');
    });
  });

  describe('updateReport', () => {
    it('updates report fields and returns updated record', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeReportRow({ name: 'Updated Name' }));

      const result = await analyticsService.updateReport(1, { name: 'Updated Name' });

      expect(mockDb.run).toHaveBeenCalledOnce();
      expect(result.name).toBe('Updated Name');
    });

    it('updates multiple fields at once', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeReportRow({
        is_favorite: true,
        is_shared: true,
        sort_order: 'ASC'
      }));

      const result = await analyticsService.updateReport(1, {
        is_favorite: true,
        is_shared: true,
        sort_order: 'ASC',
        filters: { status: 'paid' },
        columns: ['col1', 'col2'],
        chart_type: 'line',
        sort_by: 'created_at',
        description: 'Updated desc'
      });

      expect(result).toBeDefined();
    });

    it('skips DB update when no fields provided', async () => {
      mockDb.get.mockResolvedValueOnce(makeReportRow());

      const result = await analyticsService.updateReport(1, {});

      // run should NOT be called since no updates
      expect(mockDb.run).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('deleteReport', () => {
    it('deletes a report by id', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await analyticsService.deleteReport(1);

      expect(mockDb.run).toHaveBeenCalledOnce();
      const callArg = mockDb.run.mock.calls[0][0] as string;
      expect(callArg).toContain('DELETE');
    });
  });

  describe('toggleFavorite', () => {
    it('toggles favorite from false to true', async () => {
      // First call: getReport to fetch current state
      mockDb.get.mockResolvedValueOnce(makeReportRow({ is_favorite: false }));
      // Second call: after update, getReport again
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeReportRow({ is_favorite: true }));

      const result = await analyticsService.toggleFavorite(1);

      expect(result.is_favorite).toBe(true);
    });

    it('toggles favorite from true to false', async () => {
      mockDb.get.mockResolvedValueOnce(makeReportRow({ is_favorite: true }));
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeReportRow({ is_favorite: false }));

      const result = await analyticsService.toggleFavorite(1);

      expect(result.is_favorite).toBe(false);
    });
  });
});

// ============================================
// REPORT SCHEDULES
// ============================================

describe('AnalyticsService - Report Schedules', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('createSchedule', () => {
    it('creates a schedule with required fields', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeScheduleRow());

      const result = await analyticsService.createSchedule({
        report_id: 1,
        frequency: 'weekly',
        recipients: [{ email: 'test@example.com' }]
      });

      expect(mockDb.run).toHaveBeenCalledOnce();
      expect(result).toBeDefined();
      expect(result.report_id).toBe(1);
    });

    it('creates a daily schedule', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce(makeScheduleRow({ frequency: 'daily', id: 2 }));

      const result = await analyticsService.createSchedule({
        report_id: 1,
        frequency: 'daily',
        recipients: [{ email: 'test@example.com' }]
      });

      expect(result.frequency).toBe('daily');
    });

    it('creates a monthly schedule', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 3 });
      mockDb.get.mockResolvedValueOnce(makeScheduleRow({ frequency: 'monthly', day_of_month: 15, id: 3 }));

      const result = await analyticsService.createSchedule({
        report_id: 1,
        frequency: 'monthly',
        day_of_month: 15,
        recipients: [{ email: 'test@example.com' }]
      });

      expect(result.frequency).toBe('monthly');
    });

    it('creates a quarterly schedule', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 4 });
      mockDb.get.mockResolvedValueOnce(makeScheduleRow({ frequency: 'quarterly', id: 4 }));

      const result = await analyticsService.createSchedule({
        report_id: 1,
        frequency: 'quarterly',
        recipients: [{ email: 'test@example.com' }],
        format: 'csv',
        include_charts: false
      });

      expect(result).toBeDefined();
    });
  });

  describe('getSchedules', () => {
    it('returns all schedules when no reportId provided', async () => {
      mockDb.all.mockResolvedValueOnce([makeScheduleRow(), makeScheduleRow({ id: 2 })]);

      const result = await analyticsService.getSchedules();

      expect(result).toHaveLength(2);
    });

    it('filters by reportId when provided', async () => {
      mockDb.all.mockResolvedValueOnce([makeScheduleRow()]);

      const result = await analyticsService.getSchedules(1);

      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('WHERE report_id = ?');
      expect(result).toHaveLength(1);
    });
  });

  describe('getSchedule', () => {
    it('returns a single schedule', async () => {
      mockDb.get.mockResolvedValueOnce(makeScheduleRow());

      const result = await analyticsService.getSchedule(1);

      expect(result.id).toBe(1);
    });

    it('throws when schedule not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(analyticsService.getSchedule(999)).rejects.toThrow('Schedule not found');
    });
  });

  describe('updateSchedule', () => {
    it('updates schedule fields', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeScheduleRow({ name: 'New Name' }));

      const result = await analyticsService.updateSchedule(1, {
        name: 'New Name',
        frequency: 'monthly',
        day_of_week: 2,
        day_of_month: 10,
        time_of_day: '10:00',
        timezone: 'UTC',
        recipients: [{ email: 'new@example.com' }],
        format: 'csv',
        include_charts: false,
        is_active: false
      });

      expect(result).toBeDefined();
    });

    it('skips DB update when no fields provided', async () => {
      mockDb.get.mockResolvedValueOnce(makeScheduleRow());

      await analyticsService.updateSchedule(1, {});

      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('deleteSchedule', () => {
    it('deletes a schedule by id', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await analyticsService.deleteSchedule(1);

      expect(mockDb.run).toHaveBeenCalledOnce();
    });
  });

  describe('getDueSchedules', () => {
    it('returns active schedules past their next_send_at', async () => {
      mockDb.all.mockResolvedValueOnce([makeScheduleRow(), makeScheduleRow({ id: 2 })]);

      const result = await analyticsService.getDueSchedules();

      expect(result).toHaveLength(2);
    });

    it('returns empty when no due schedules', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getDueSchedules();

      expect(result).toEqual([]);
    });
  });

  describe('markScheduleSent', () => {
    it('updates last_sent_at and calculates next send time', async () => {
      mockDb.get.mockResolvedValueOnce(makeScheduleRow({ frequency: 'weekly', day_of_week: 1 }));
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await analyticsService.markScheduleSent(1);

      expect(mockDb.run).toHaveBeenCalledOnce();
      const callArg = mockDb.run.mock.calls[0][0] as string;
      expect(callArg).toContain('last_sent_at');
    });
  });
});

// ============================================
// DASHBOARD WIDGETS
// ============================================

describe('AnalyticsService - Dashboard Widgets', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getWidgets', () => {
    it('returns visible widgets for a user', async () => {
      mockDb.all.mockResolvedValueOnce([makeWidgetRow(), makeWidgetRow({ id: 2 })]);

      const result = await analyticsService.getWidgets('user@example.com');

      expect(result).toHaveLength(2);
    });

    it('returns empty array when user has no widgets', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getWidgets('nobody@example.com');

      expect(result).toEqual([]);
    });
  });

  describe('createWidget', () => {
    it('creates a widget with required fields', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeWidgetRow());

      const result = await analyticsService.createWidget({
        user_email: 'user@example.com',
        widget_type: 'metric',
        data_source: 'revenue'
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('creates a widget with all optional fields', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce(makeWidgetRow({ id: 2, title: 'My Chart' }));

      const result = await analyticsService.createWidget({
        user_email: 'user@example.com',
        widget_type: 'chart',
        title: 'My Chart',
        data_source: 'projects',
        config: { chartType: 'bar' },
        position_x: 2,
        position_y: 4,
        width: 3,
        height: 2,
        refresh_interval: 300
      });

      expect(result).toBeDefined();
    });
  });

  describe('getWidget', () => {
    it('returns a widget by id', async () => {
      mockDb.get.mockResolvedValueOnce(makeWidgetRow());

      const result = await analyticsService.getWidget(1);

      expect(result.id).toBe(1);
    });

    it('throws when widget not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(analyticsService.getWidget(999)).rejects.toThrow('Widget not found');
    });
  });

  describe('updateWidget', () => {
    it('updates widget fields', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeWidgetRow({ title: 'Updated Title' }));

      const result = await analyticsService.updateWidget(1, {
        title: 'Updated Title',
        config: { key: 'value' },
        position_x: 1,
        position_y: 2,
        width: 4,
        height: 3,
        refresh_interval: 600,
        is_visible: false
      });

      expect(result).toBeDefined();
    });

    it('skips DB update when no fields provided', async () => {
      mockDb.get.mockResolvedValueOnce(makeWidgetRow());

      await analyticsService.updateWidget(1, {});

      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('handles null refresh_interval', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeWidgetRow({ refresh_interval: null }));

      const result = await analyticsService.updateWidget(1, { refresh_interval: null });

      expect(result).toBeDefined();
    });
  });

  describe('deleteWidget', () => {
    it('deletes a widget by id', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await analyticsService.deleteWidget(1);

      expect(mockDb.run).toHaveBeenCalledOnce();
    });
  });

  describe('saveWidgetLayout', () => {
    it('updates positions for multiple widgets', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await analyticsService.saveWidgetLayout('user@example.com', [
        { id: 1, position_x: 0, position_y: 0, width: 2, height: 2 },
        { id: 2, position_x: 2, position_y: 0, width: 2, height: 2 }
      ]);

      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    it('handles empty layout array', async () => {
      await analyticsService.saveWidgetLayout('user@example.com', []);

      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('applyPreset', () => {
    it('clears existing widgets and creates preset widgets', async () => {
      const widgetConfig = JSON.stringify([
        { type: 'metric', title: 'Revenue', data_source: 'revenue', config: {}, x: 0, y: 0, w: 2, h: 2 }
      ]);
      mockDb.get.mockResolvedValueOnce({ id: 1, name: 'Default', widgets: widgetConfig });
      mockDb.run.mockResolvedValueOnce({ changes: 1 }); // delete existing
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // create widget
      mockDb.get.mockResolvedValueOnce(makeWidgetRow());

      const result = await analyticsService.applyPreset('user@example.com', 1);

      expect(result).toHaveLength(1);
    });

    it('throws when preset not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(analyticsService.applyPreset('user@example.com', 999)).rejects.toThrow(
        'Preset not found'
      );
    });
  });

  describe('getPresets', () => {
    it('returns active presets', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 1, name: 'Default', description: null, is_default: true },
        { id: 2, name: 'Sales', description: 'Sales focus', is_default: false }
      ]);

      const result = await analyticsService.getPresets();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Default');
    });
  });
});

// ============================================
// KPI SNAPSHOTS
// ============================================

describe('AnalyticsService - KPI Snapshots', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    mockDb.transaction.mockReset();
  });

  describe('captureSnapshot', () => {
    it('inserts new snapshots when none exist for today', async () => {
      // calculateKPIs DB calls (9 metrics)
      const kpiDbReturns = [
        { total: 50000 },     // total_revenue
        { total: 10000 },     // monthly_revenue
        { count: 25 },        // active_clients
        { count: 10 },        // active_projects
        { total: 75000 },     // pipeline_value
        { count: 5 },         // new_leads_monthly
        { total: 8000 },      // outstanding_invoices
        { count: 2, total: 3000 }, // overdue_invoices
        { won: 8, total_closed: 10 } // conversion_rate
      ];
      kpiDbReturns.forEach((r) => mockDb.get.mockResolvedValueOnce(r));

      // idempotency check - no existing snapshot
      mockDb.get.mockResolvedValueOnce(null);

      // transaction mock - simulate ctx with get and run
      mockDb.transaction.mockImplementationOnce(async (fn: (ctx: typeof mockDb) => Promise<void>) => {
        const ctx = {
          get: vi.fn().mockResolvedValue(null), // no previous value
          run: vi.fn().mockResolvedValue({ changes: 1 })
        };
        await fn(ctx as unknown as typeof mockDb);
      });

      const count = await analyticsService.captureSnapshot();

      expect(count).toBe(9);
    });

    it('updates existing snapshots when one exists for today', async () => {
      // calculateKPIs
      const kpiDbReturns = [
        { total: 50000 }, { total: 10000 }, { count: 25 }, { count: 10 },
        { total: 75000 }, { count: 5 }, { total: 8000 },
        { count: 2, total: 3000 }, { won: 8, total_closed: 10 }
      ];
      kpiDbReturns.forEach((r) => mockDb.get.mockResolvedValueOnce(r));

      // idempotency check - existing snapshot found
      mockDb.get.mockResolvedValueOnce({ id: 5 });

      mockDb.transaction.mockImplementationOnce(async (fn: (ctx: typeof mockDb) => Promise<void>) => {
        const ctx = {
          get: vi.fn().mockResolvedValue({ value: 45000 }),
          run: vi.fn().mockResolvedValue({ changes: 1 })
        };
        await fn(ctx as unknown as typeof mockDb);
      });

      const count = await analyticsService.captureSnapshot();

      expect(count).toBe(9);
    });

    it('handles zero conversion rate when no closed projects', async () => {
      const kpiDbReturns = [
        { total: 0 }, { total: 0 }, { count: 0 }, { count: 0 },
        { total: 0 }, { count: 0 }, { total: 0 },
        { count: 0, total: 0 }, { won: 0, total_closed: 0 }
      ];
      kpiDbReturns.forEach((r) => mockDb.get.mockResolvedValueOnce(r));
      mockDb.get.mockResolvedValueOnce(null);

      mockDb.transaction.mockImplementationOnce(async (fn: (ctx: typeof mockDb) => Promise<void>) => {
        const ctx = {
          get: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ changes: 1 })
        };
        await fn(ctx as unknown as typeof mockDb);
      });

      const count = await analyticsService.captureSnapshot();

      expect(count).toBe(9);
    });
  });

  describe('getKPITrend', () => {
    it('returns trend data for a KPI type', async () => {
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ snapshot_date: '2026-01-01' }),
        makeKPISnapshotRow({ id: 2, snapshot_date: '2026-01-02' })
      ]);

      const result = await analyticsService.getKPITrend('total_revenue');

      expect(result).toHaveLength(2);
    });

    it('filters by date range', async () => {
      mockDb.all.mockResolvedValueOnce([makeKPISnapshotRow()]);

      const result = await analyticsService.getKPITrend('total_revenue', {
        start: '2026-01-01',
        end: '2026-01-31'
      });

      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('snapshot_date >=');
      expect(callArg).toContain('snapshot_date <=');
      expect(result).toHaveLength(1);
    });

    it('handles partial date range (start only)', async () => {
      mockDb.all.mockResolvedValueOnce([makeKPISnapshotRow()]);

      await analyticsService.getKPITrend('total_revenue', { start: '2026-01-01', end: '' });

      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('snapshot_date >=');
    });
  });

  describe('getLatestKPIs', () => {
    it('returns latest snapshot per KPI type', async () => {
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue' }),
        makeKPISnapshotRow({ id: 2, kpi_type: 'active_clients', value: 25 })
      ]);

      const result = await analyticsService.getLatestKPIs();

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no snapshots', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getLatestKPIs();

      expect(result).toEqual([]);
    });
  });
});

// ============================================
// METRIC ALERTS
// ============================================

describe('AnalyticsService - Metric Alerts', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('createAlert', () => {
    it('creates an alert and returns the created record', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeAlertRow());

      const result = await analyticsService.createAlert({
        name: 'High Revenue Alert',
        kpi_type: 'total_revenue',
        condition: 'above',
        threshold_value: 10000,
        notification_emails: ['admin@example.com']
      });

      expect(mockDb.run).toHaveBeenCalledOnce();
      expect(result).toBeDefined();
      expect(result.name).toBe('High Revenue Alert');
    });
  });

  describe('getAlerts', () => {
    it('returns all alerts', async () => {
      mockDb.all.mockResolvedValueOnce([makeAlertRow(), makeAlertRow({ id: 2 })]);

      const result = await analyticsService.getAlerts();

      expect(result).toHaveLength(2);
    });
  });

  describe('getAlert', () => {
    it('returns a single alert', async () => {
      mockDb.get.mockResolvedValueOnce(makeAlertRow());

      const result = await analyticsService.getAlert(1);

      expect(result.id).toBe(1);
    });

    it('throws when alert not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(analyticsService.getAlert(999)).rejects.toThrow('Alert not found');
    });
  });

  describe('updateAlert', () => {
    it('updates all alert fields', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeAlertRow({ name: 'Updated Alert' }));

      const result = await analyticsService.updateAlert(1, {
        name: 'Updated Alert',
        kpi_type: 'monthly_revenue',
        condition: 'below',
        threshold_value: 5000,
        notification_emails: ['new@example.com'],
        is_active: false
      });

      expect(result).toBeDefined();
    });

    it('skips DB update when no fields provided', async () => {
      mockDb.get.mockResolvedValueOnce(makeAlertRow());

      await analyticsService.updateAlert(1, {});

      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('deleteAlert', () => {
    it('deletes an alert by id', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await analyticsService.deleteAlert(1);

      expect(mockDb.run).toHaveBeenCalledOnce();
    });
  });

  describe('checkAlerts', () => {
    it('triggers alert when condition is above and value exceeds threshold', async () => {
      // getAlerts
      mockDb.all.mockResolvedValueOnce([makeAlertRow({ condition: 'above', threshold_value: 9000 })]);
      // getLatestKPIs
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue', value: 10000, change_percent: 5 })
      ]);
      // update trigger count
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      const result = await analyticsService.checkAlerts();

      expect(result).toHaveLength(1);
      expect(result[0].triggered).toBe(true);
    });

    it('does not trigger alert when value below threshold (condition: above)', async () => {
      mockDb.all.mockResolvedValueOnce([makeAlertRow({ condition: 'above', threshold_value: 99999 })]);
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue', value: 1000 })
      ]);

      const result = await analyticsService.checkAlerts();

      expect(result[0].triggered).toBe(false);
    });

    it('triggers alert when condition is below and value is less than threshold', async () => {
      mockDb.all.mockResolvedValueOnce([makeAlertRow({ condition: 'below', threshold_value: 5000 })]);
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue', value: 1000 })
      ]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      const result = await analyticsService.checkAlerts();

      expect(result[0].triggered).toBe(true);
    });

    it('triggers alert when condition is equals and value matches', async () => {
      mockDb.all.mockResolvedValueOnce([makeAlertRow({ condition: 'equals', threshold_value: 50000 })]);
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue', value: 50000 })
      ]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      const result = await analyticsService.checkAlerts();

      expect(result[0].triggered).toBe(true);
    });

    it('triggers alert when condition is change_above', async () => {
      mockDb.all.mockResolvedValueOnce([makeAlertRow({ condition: 'change_above', threshold_value: 10 })]);
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue', value: 50000, change_percent: 15 })
      ]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      const result = await analyticsService.checkAlerts();

      expect(result[0].triggered).toBe(true);
    });

    it('triggers alert when condition is change_below', async () => {
      mockDb.all.mockResolvedValueOnce([makeAlertRow({ condition: 'change_below', threshold_value: 0 })]);
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue', value: 50000, change_percent: -5 })
      ]);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      const result = await analyticsService.checkAlerts();

      expect(result[0].triggered).toBe(true);
    });

    it('skips inactive alerts', async () => {
      mockDb.all.mockResolvedValueOnce([makeAlertRow({ is_active: false })]);
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue', value: 999999 })
      ]);

      const result = await analyticsService.checkAlerts();

      expect(result).toHaveLength(0);
    });

    it('skips alerts with no matching KPI data', async () => {
      mockDb.all.mockResolvedValueOnce([makeAlertRow({ kpi_type: 'nonexistent_kpi' })]);
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue', value: 50000 })
      ]);

      const result = await analyticsService.checkAlerts();

      expect(result).toHaveLength(0);
    });

    it('handles null change_percent for change_above condition', async () => {
      mockDb.all.mockResolvedValueOnce([makeAlertRow({ condition: 'change_above', threshold_value: 5 })]);
      mockDb.all.mockResolvedValueOnce([
        makeKPISnapshotRow({ kpi_type: 'total_revenue', value: 50000, change_percent: null })
      ]);

      const result = await analyticsService.checkAlerts();

      expect(result[0].triggered).toBe(false);
    });
  });
});

// ============================================
// REPORT DATA GENERATION
// ============================================

describe('AnalyticsService - Report Data Generation', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('generateReportData', () => {
    it('generates revenue report', async () => {
      mockDb.all.mockResolvedValueOnce([{ month: '2026-01', total_revenue: 10000, invoice_count: 5, avg_invoice: 2000 }]);
      mockDb.get.mockResolvedValueOnce({ total_revenue: 10000, total_invoices: 5, avg_invoice: 2000 });

      const result = await analyticsService.generateReportData('revenue');

      expect(result.data).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('generates revenue report with date filters', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({});

      const result = await analyticsService.generateReportData('revenue', {
        dateRange: { start: '2026-01-01', end: '2026-01-31' }
      });

      expect(result).toBeDefined();
    });

    it('generates pipeline report', async () => {
      mockDb.all.mockResolvedValueOnce([{ stage_name: 'Discovery', project_count: 3, total_value: 15000, win_probability: 0.2 }]);
      mockDb.get.mockResolvedValueOnce({ total_leads: 10, total_pipeline_value: 50000, won_count: 2 });

      const result = await analyticsService.generateReportData('pipeline');

      expect(result.data).toBeDefined();
    });

    it('generates project report', async () => {
      mockDb.all.mockResolvedValueOnce([{ id: 1, project_name: 'Website Redesign', company_name: 'ACME', status: 'active' }]);
      mockDb.get.mockResolvedValueOnce({ total_projects: 1, active_projects: 1, completed_projects: 0, total_hours: 100 });

      const result = await analyticsService.generateReportData('project');

      expect(result.data).toHaveLength(1);
    });

    it('generates project report with filters', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({});

      const result = await analyticsService.generateReportData('project', {
        status: 'active',
        clientId: 5
      });

      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('p.status = ?');
      expect(callArg).toContain('p.client_id = ?');
      expect(result).toBeDefined();
    });

    it('generates client report', async () => {
      mockDb.all.mockResolvedValueOnce([{ id: 1, company_name: 'ACME', project_count: 3, total_revenue: 30000 }]);
      mockDb.get.mockResolvedValueOnce({ total_clients: 1, active_clients: 1, avg_lifetime_value: 30000 });

      const result = await analyticsService.generateReportData('client');

      expect(result.data).toHaveLength(1);
    });

    it('generates team report', async () => {
      mockDb.all.mockResolvedValueOnce([{ user_name: 'Alice', total_hours: 40, projects_worked: 2, billable_hours: 35 }]);
      mockDb.get.mockResolvedValueOnce({ total_hours: 40, billable_hours: 35, team_members: 1 });

      const result = await analyticsService.generateReportData('team');

      expect(result.data).toHaveLength(1);
    });

    it('generates lead report', async () => {
      mockDb.all.mockResolvedValueOnce([{ id: 1, project_name: 'Lead A', stage_name: 'Proposal', source_name: 'Referral' }]);
      mockDb.get.mockResolvedValueOnce({ total_leads: 1, avg_score: 75, total_value: 10000 });

      const result = await analyticsService.generateReportData('lead');

      expect(result.data).toHaveLength(1);
    });

    it('generates invoice report', async () => {
      mockDb.all.mockResolvedValueOnce([{ id: 1, invoice_number: 'INV-001', company_name: 'ACME', status: 'paid' }]);
      mockDb.get.mockResolvedValueOnce({ total_invoices: 1, total_amount: 5000, paid_amount: 5000, outstanding_amount: 0 });

      const result = await analyticsService.generateReportData('invoice');

      expect(result.data).toHaveLength(1);
    });

    it('generates invoice report with filters', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({});

      await analyticsService.generateReportData('invoice', { status: 'overdue', clientId: 3 });

      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('i.status = ?');
      expect(callArg).toContain('i.client_id = ?');
    });

    it('throws for unknown report type', async () => {
      await expect(
        analyticsService.generateReportData('unknown' as never)
      ).rejects.toThrow('Unknown report type');
    });

    it('handles null summary from revenue DB query', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce(null);

      const result = await analyticsService.generateReportData('revenue');

      expect(result.summary).toEqual({});
    });

    it('propagates errors from revenue report generation', async () => {
      mockDb.all.mockRejectedValueOnce(new Error('DB query failed'));

      await expect(analyticsService.generateReportData('revenue')).rejects.toThrow();
    });
  });
});

// ============================================
// ROUTE-COMPATIBLE WRAPPERS
// ============================================

describe('AnalyticsService - Route-Compatible Wrappers', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('getSavedReports delegates to getReports', async () => {
    mockDb.all.mockResolvedValueOnce([makeReportRow()]);

    const result = await analyticsService.getSavedReports();

    expect(result).toHaveLength(1);
  });

  it('createSavedReport delegates to createReport', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeReportRow());

    const result = await analyticsService.createSavedReport({
      name: 'Test',
      report_type: 'revenue'
    });

    expect(result).toBeDefined();
  });

  it('getSavedReport delegates to getReport', async () => {
    mockDb.get.mockResolvedValueOnce(makeReportRow());

    const result = await analyticsService.getSavedReport(1);

    expect(result.id).toBe(1);
  });

  it('updateSavedReport delegates to updateReport', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    mockDb.get.mockResolvedValueOnce(makeReportRow({ name: 'Updated' }));

    const result = await analyticsService.updateSavedReport(1, { name: 'Updated' });

    expect(result.name).toBe('Updated');
  });

  it('deleteSavedReport delegates to deleteReport', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    await analyticsService.deleteSavedReport(1);

    expect(mockDb.run).toHaveBeenCalledOnce();
  });

  it('toggleReportFavorite delegates to toggleFavorite', async () => {
    mockDb.get.mockResolvedValueOnce(makeReportRow({ is_favorite: false }));
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    mockDb.get.mockResolvedValueOnce(makeReportRow({ is_favorite: true }));

    const result = await analyticsService.toggleReportFavorite(1);

    expect(result.is_favorite).toBe(true);
  });

  it('runReport fetches report and generates data', async () => {
    // getReport
    mockDb.get.mockResolvedValueOnce(makeReportRow({ report_type: 'client', filters: '{}' }));
    // generateClientReport: db.all + db.get
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.get.mockResolvedValueOnce({ total_clients: 0, active_clients: 0, avg_lifetime_value: 0 });

    const result = await analyticsService.runReport(1);

    expect(result.data).toBeDefined();
  });

  it('getReportSchedules delegates to getSchedules', async () => {
    mockDb.all.mockResolvedValueOnce([makeScheduleRow()]);

    const result = await analyticsService.getReportSchedules();

    expect(result).toHaveLength(1);
  });

  it('createReportSchedule delegates to createSchedule', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeScheduleRow());

    const result = await analyticsService.createReportSchedule({
      report_id: 1,
      frequency: 'weekly',
      recipients: [{ email: 'user@example.com' }]
    });

    expect(result).toBeDefined();
  });

  it('updateReportSchedule delegates to updateSchedule', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    mockDb.get.mockResolvedValueOnce(makeScheduleRow({ is_active: false }));

    const result = await analyticsService.updateReportSchedule(1, { is_active: false });

    expect(result).toBeDefined();
  });

  it('deleteReportSchedule delegates to deleteSchedule', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    await analyticsService.deleteReportSchedule(1);

    expect(mockDb.run).toHaveBeenCalledOnce();
  });

  it('processDueSchedules processes all due schedules', async () => {
    // getDueSchedules
    mockDb.all.mockResolvedValueOnce([makeScheduleRow({ id: 1 }), makeScheduleRow({ id: 2 })]);
    // markScheduleSent calls getSchedule (db.get) and db.run for each
    mockDb.get.mockResolvedValueOnce(makeScheduleRow({ id: 1, frequency: 'weekly' }));
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    mockDb.get.mockResolvedValueOnce(makeScheduleRow({ id: 2, frequency: 'daily' }));
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    const result = await analyticsService.processDueSchedules();

    expect(result.processed).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('processDueSchedules collects errors from failed schedules', async () => {
    mockDb.all.mockResolvedValueOnce([makeScheduleRow({ id: 1 })]);
    // markScheduleSent -> getSchedule throws
    mockDb.get.mockRejectedValueOnce(new Error('Schedule fetch failed'));

    const result = await analyticsService.processDueSchedules();

    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Schedule 1');
  });

  it('processDueSchedules handles empty due schedules list', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const result = await analyticsService.processDueSchedules();

    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('getDashboardWidgets delegates to getWidgets', async () => {
    mockDb.all.mockResolvedValueOnce([makeWidgetRow()]);

    const result = await analyticsService.getDashboardWidgets('user@example.com');

    expect(result).toHaveLength(1);
  });

  it('createDashboardWidget delegates to createWidget', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeWidgetRow());

    const result = await analyticsService.createDashboardWidget({
      user_email: 'user@example.com',
      widget_type: 'metric',
      data_source: 'revenue'
    });

    expect(result).toBeDefined();
  });

  it('updateDashboardWidget delegates to updateWidget', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    mockDb.get.mockResolvedValueOnce(makeWidgetRow({ title: 'Updated' }));

    const result = await analyticsService.updateDashboardWidget(1, { title: 'Updated' });

    expect(result.title).toBe('Updated');
  });

  it('deleteDashboardWidget delegates to deleteWidget', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    await analyticsService.deleteDashboardWidget(1);

    expect(mockDb.run).toHaveBeenCalledOnce();
  });

  it('updateWidgetLayout maps layout format and delegates to saveWidgetLayout', async () => {
    mockDb.run.mockResolvedValue({ changes: 1 });

    await analyticsService.updateWidgetLayout('user@example.com', [
      { id: 1, x: 0, y: 0, w: 2, h: 2 },
      { id: 2, x: 2, y: 0, w: 2, h: 2 }
    ]);

    expect(mockDb.run).toHaveBeenCalledTimes(2);
  });

  it('getDashboardPresets delegates to getPresets', async () => {
    mockDb.all.mockResolvedValueOnce([{ id: 1, name: 'Default', description: null, is_default: true }]);

    const result = await analyticsService.getDashboardPresets();

    expect(result).toHaveLength(1);
  });

  it('applyDashboardPreset delegates to applyPreset', async () => {
    const widgetConfig = JSON.stringify([
      { type: 'metric', title: 'Revenue', data_source: 'revenue', config: {}, x: 0, y: 0, w: 2, h: 2 }
    ]);
    mockDb.get.mockResolvedValueOnce({ id: 1, name: 'Default', widgets: widgetConfig });
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeWidgetRow());

    const result = await analyticsService.applyDashboardPreset('user@example.com', 1);

    expect(result).toHaveLength(1);
  });

  it('captureKPISnapshot delegates to captureSnapshot', async () => {
    const kpiReturns = [
      { total: 0 }, { total: 0 }, { count: 0 }, { count: 0 },
      { total: 0 }, { count: 0 }, { total: 0 },
      { count: 0, total: 0 }, { won: 0, total_closed: 0 }
    ];
    kpiReturns.forEach((r) => mockDb.get.mockResolvedValueOnce(r));
    mockDb.get.mockResolvedValueOnce(null);
    mockDb.transaction.mockImplementationOnce(async (fn: (ctx: typeof mockDb) => Promise<void>) => {
      const ctx = { get: vi.fn().mockResolvedValue(null), run: vi.fn().mockResolvedValue({}) };
      await fn(ctx as unknown as typeof mockDb);
    });

    const count = await analyticsService.captureKPISnapshot();

    expect(count).toBe(9);
  });

  it('getMetricAlerts delegates to getAlerts', async () => {
    mockDb.all.mockResolvedValueOnce([makeAlertRow()]);

    const result = await analyticsService.getMetricAlerts();

    expect(result).toHaveLength(1);
  });

  it('createMetricAlert delegates to createAlert', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(makeAlertRow());

    const result = await analyticsService.createMetricAlert({
      name: 'Test Alert',
      kpi_type: 'total_revenue',
      condition: 'above',
      threshold_value: 100,
      notification_emails: ['admin@example.com']
    });

    expect(result).toBeDefined();
  });

  it('updateMetricAlert delegates to updateAlert', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });
    mockDb.get.mockResolvedValueOnce(makeAlertRow({ is_active: false }));

    const result = await analyticsService.updateMetricAlert(1, { is_active: false });

    expect(result).toBeDefined();
  });

  it('deleteMetricAlert delegates to deleteAlert', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    await analyticsService.deleteMetricAlert(1);

    expect(mockDb.run).toHaveBeenCalledOnce();
  });

  it('checkAlertTriggers delegates to checkAlerts', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.all.mockResolvedValueOnce([]);

    const result = await analyticsService.checkAlertTriggers();

    expect(result).toEqual([]);
  });
});

// ============================================
// QUICK ANALYTICS
// ============================================

describe('AnalyticsService - Quick Analytics', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getRevenueAnalytics', () => {
    it('returns revenue report with no days filter', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({ total_revenue: 0 });

      const result = await analyticsService.getRevenueAnalytics();

      expect(result).toBeDefined();
    });

    it('returns revenue report filtered to last N days', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({});

      const result = await analyticsService.getRevenueAnalytics(30);

      expect(result).toBeDefined();
    });

    it('wraps revenue analytics DB errors', async () => {
      mockDb.all.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(analyticsService.getRevenueAnalytics(30)).rejects.toThrow(
        'Revenue analytics generation failed'
      );
    });
  });

  describe('getPipelineAnalytics', () => {
    it('returns pipeline report data', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({ total_leads: 0, total_pipeline_value: 0, won_count: 0 });

      const result = await analyticsService.getPipelineAnalytics();

      expect(result).toBeDefined();
    });
  });

  describe('getProjectAnalytics', () => {
    it('returns project analytics with no days filter', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({ total_projects: 0 });

      const result = await analyticsService.getProjectAnalytics();

      expect(result).toBeDefined();
    });

    it('returns project analytics for last N days', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({});

      const result = await analyticsService.getProjectAnalytics(90);

      expect(result).toBeDefined();
    });
  });

  describe('getClientAnalytics', () => {
    it('returns client analytics', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({ total_clients: 0 });

      const result = await analyticsService.getClientAnalytics();

      expect(result).toBeDefined();
    });
  });

  describe('getTeamAnalytics', () => {
    it('returns team analytics with no days filter', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({ total_hours: 0 });

      const result = await analyticsService.getTeamAnalytics();

      expect(result).toBeDefined();
    });

    it('returns team analytics for last N days', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({});

      const result = await analyticsService.getTeamAnalytics(14);

      expect(result).toBeDefined();
    });
  });

  describe('getReportRuns', () => {
    it('returns all report runs', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 1, report_id: 1, status: 'completed', run_type: 'manual', created_at: '2026-01-01' }
      ]);

      const result = await analyticsService.getReportRuns();

      expect(result).toHaveLength(1);
    });

    it('filters report runs by reportId', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await analyticsService.getReportRuns(5);

      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('WHERE report_id = ?');
    });
  });
});

// ============================================
// BUSINESS INTELLIGENCE
// ============================================

describe('AnalyticsService - Business Intelligence', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getRevenueByPeriod', () => {
    it('returns monthly revenue breakdown', async () => {
      mockDb.all.mockResolvedValueOnce([
        { period: '2026-01', revenue: 10000, invoice_count: 5, average_invoice: 2000 }
      ]);

      const result = await analyticsService.getRevenueByPeriod('month');

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe('2026-01');
      expect(result[0].invoiceCount).toBe(5);
    });

    it('returns quarterly revenue breakdown', async () => {
      mockDb.all.mockResolvedValueOnce([
        { period: '2026-Q1', revenue: 30000, invoice_count: 15, average_invoice: 2000 }
      ]);

      const result = await analyticsService.getRevenueByPeriod('quarter');

      expect(result[0].period).toBe('2026-Q1');
    });

    it('returns yearly revenue breakdown', async () => {
      mockDb.all.mockResolvedValueOnce([
        { period: '2026', revenue: 120000, invoice_count: 60, average_invoice: 2000 }
      ]);

      const result = await analyticsService.getRevenueByPeriod('year');

      expect(result[0].period).toBe('2026');
    });

    it('filters by start and end date', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await analyticsService.getRevenueByPeriod('month', '2026-01-01', '2026-06-30');

      const callArg = mockDb.all.mock.calls[0][0] as string;
      expect(callArg).toContain('paid_at >=');
      expect(callArg).toContain('paid_at <=');
    });

    it('handles null average_invoice', async () => {
      mockDb.all.mockResolvedValueOnce([
        { period: '2026-01', revenue: null, invoice_count: 0, average_invoice: null }
      ]);

      const result = await analyticsService.getRevenueByPeriod('month');

      expect(result[0].revenue).toBe(0);
      expect(result[0].averageInvoice).toBe(0);
    });
  });

  describe('getProjectPipelineValue', () => {
    it('returns pipeline value breakdown by status', async () => {
      mockDb.all.mockResolvedValueOnce([
        { status: 'draft', count: 3, total_value: 15000 },
        { status: 'sent', count: 2, total_value: 10000 }
      ]);

      const result = await analyticsService.getProjectPipelineValue();

      expect(result.totalValue).toBe(25000);
      expect(result.proposalCount).toBe(5);
      expect(result.averageValue).toBe(5000);
      expect(result.byStatus).toHaveLength(2);
    });

    it('handles empty pipeline', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getProjectPipelineValue();

      expect(result.totalValue).toBe(0);
      expect(result.proposalCount).toBe(0);
      expect(result.averageValue).toBe(0);
    });

    it('handles null total_value in results', async () => {
      mockDb.all.mockResolvedValueOnce([
        { status: 'draft', count: 1, total_value: null }
      ]);

      const result = await analyticsService.getProjectPipelineValue();

      expect(result.totalValue).toBe(0);
      expect(result.byStatus[0].value).toBe(0);
    });
  });

  describe('getAcquisitionFunnel', () => {
    it('returns funnel metrics with conversion rates', async () => {
      mockDb.get
        .mockResolvedValueOnce({ count: 100 }) // contacts
        .mockResolvedValueOnce({ count: 60 })  // leads
        .mockResolvedValueOnce({ count: 30 })  // proposals
        .mockResolvedValueOnce({ count: 20 }); // clients

      const result = await analyticsService.getAcquisitionFunnel();

      expect(result.contacts).toBe(100);
      expect(result.leads).toBe(60);
      expect(result.proposals).toBe(30);
      expect(result.clients).toBe(20);
      expect(result.conversionRates.contactToLead).toBeCloseTo(60);
      expect(result.conversionRates.overall).toBeCloseTo(20);
    });

    it('handles zero contacts (avoids division by zero)', async () => {
      mockDb.get
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 0 });

      const result = await analyticsService.getAcquisitionFunnel();

      expect(result.conversionRates.contactToLead).toBe(0);
      expect(result.conversionRates.overall).toBe(0);
    });

    it('filters by date range', async () => {
      mockDb.get
        .mockResolvedValueOnce({ count: 10 })
        .mockResolvedValueOnce({ count: 8 })
        .mockResolvedValueOnce({ count: 5 })
        .mockResolvedValueOnce({ count: 3 });

      const result = await analyticsService.getAcquisitionFunnel('2026-01-01', '2026-03-31');

      expect(result).toBeDefined();
      // Date filter appended to queries
      const firstCallArg = mockDb.get.mock.calls[0][0] as string;
      expect(firstCallArg).toContain('created_at >=');
    });

    it('handles undefined counts from DB', async () => {
      mockDb.get
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await analyticsService.getAcquisitionFunnel();

      expect(result.contacts).toBe(0);
    });
  });

  describe('getProjectStatistics', () => {
    it('returns project statistics with popular types', async () => {
      mockDb.get.mockResolvedValueOnce({ average_value: 5000, average_duration: 30 });
      mockDb.all
        .mockResolvedValueOnce([
          { type: 'website', count: 10, total_value: 50000 },
          { type: 'web-app', count: 5, total_value: 25000 }
        ])
        .mockResolvedValueOnce([
          { status: 'active', count: 8 },
          { status: 'completed', count: 15 }
        ]);

      const result = await analyticsService.getProjectStatistics();

      expect(result.averageValue).toBe(5000);
      expect(result.averageDuration).toBe(30);
      expect(result.popularTypes).toHaveLength(2);
      expect(result.statusBreakdown).toHaveLength(2);
    });

    it('handles null average stats', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.all.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await analyticsService.getProjectStatistics();

      expect(result.averageValue).toBe(0);
      expect(result.averageDuration).toBe(0);
    });

    it('defaults null type to Unknown', async () => {
      mockDb.get.mockResolvedValueOnce({ average_value: 0, average_duration: 0 });
      mockDb.all
        .mockResolvedValueOnce([{ type: null, count: 3, total_value: 0 }])
        .mockResolvedValueOnce([]);

      const result = await analyticsService.getProjectStatistics();

      expect(result.popularTypes[0].type).toBe('Unknown');
    });
  });
});

// ============================================
// CLIENT INSIGHTS
// ============================================

describe('AnalyticsService - Client Insights', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getClientLifetimeValue', () => {
    it('returns client lifetime value data', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          client_id: 1,
          client_name: 'ACME Corp',
          total_revenue: 30000,
          project_count: 3,
          first_project_date: '2025-01-01',
          last_project_date: '2026-01-01'
        }
      ]);

      const result = await analyticsService.getClientLifetimeValue();

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe(1);
      expect(result[0].totalRevenue).toBe(30000);
      expect(result[0].projectCount).toBe(3);
      expect(result[0].lifetimeMonths).toBeGreaterThanOrEqual(1);
    });

    it('handles null project dates gracefully', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          client_id: 2,
          client_name: 'New Client',
          total_revenue: 5000,
          project_count: 1,
          first_project_date: null,
          last_project_date: null
        }
      ]);

      const result = await analyticsService.getClientLifetimeValue();

      expect(result[0].lifetimeMonths).toBe(1); // minimum
    });

    it('uses custom limit', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      await analyticsService.getClientLifetimeValue(5);

      const callArg = mockDb.all.mock.calls[0][1] as number[];
      expect(callArg).toContain(5);
    });
  });

  describe('getClientActivityScores', () => {
    it('returns activity scores with risk levels', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          client_id: 1,
          client_name: 'ACME Corp',
          last_activity: '2026-01-01',
          recent_messages: 5,
          paid_invoices: 10,
          avg_payment_days: -5 // paid early
        }
      ]);

      const result = await analyticsService.getClientActivityScores();

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe(1);
      expect(result[0].score).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(result[0].riskLevel);
    });

    it('assigns high risk when score is low', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          client_id: 2,
          client_name: 'Risky Client',
          last_activity: '2025-01-01',
          recent_messages: 0,
          paid_invoices: 0,
          avg_payment_days: 60 // pays very late
        }
      ]);

      const result = await analyticsService.getClientActivityScores();

      expect(result[0].riskLevel).toBe('high');
    });

    it('assigns low risk when score is high', async () => {
      // Score breakdown: responseScore=12.5, approvalScore=12.5, paymentScore=25 (paid early), engagementScore=25 (5 msgs * 5)
      // Total = 75, which is >= 70 → 'low'
      mockDb.all.mockResolvedValueOnce([
        {
          client_id: 3,
          client_name: 'Great Client',
          last_activity: '2026-01-08',
          recent_messages: 5,      // engagementScore = min(25, 5*5) = 25
          paid_invoices: 10,
          avg_payment_days: -10    // paymentScore = max(0, 25 - max(0, -10*1.5)) = 25
        }
      ]);

      const result = await analyticsService.getClientActivityScores();

      expect(result[0].riskLevel).toBe('low');
    });

    it('handles null avg_payment_days', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          client_id: 4,
          client_name: 'Unknown',
          last_activity: '2026-01-01',
          recent_messages: 0,
          paid_invoices: 0,
          avg_payment_days: null
        }
      ]);

      const result = await analyticsService.getClientActivityScores();

      expect(result[0].factors.paymentSpeed).toBe(13); // Math.round(12.5)
    });
  });

  describe('getUpsellOpportunities', () => {
    it('returns upsell opportunities for clients without maintenance', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          client_id: 1,
          client_name: 'ACME Corp',
          last_contact: '2026-01-01',
          project_types: 'website,branding',
          has_maintenance: 0
        }
      ]);

      const result = await analyticsService.getUpsellOpportunities();

      expect(result).toHaveLength(1);
      expect(result[0].recommendedService).toBe('maintenance');
      expect(result[0].potentialValue).toBe(500);
      expect(result[0].currentServices).toContain('website');
    });

    it('returns empty when all clients have maintenance', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getUpsellOpportunities();

      expect(result).toEqual([]);
    });

    it('handles null project_types', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          client_id: 2,
          client_name: 'New Client',
          last_contact: '2026-01-01',
          project_types: null,
          has_maintenance: 0
        }
      ]);

      const result = await analyticsService.getUpsellOpportunities();

      expect(result[0].currentServices).toEqual([]);
      expect(result[0].recommendedService).toBe('maintenance');
    });
  });
});

// ============================================
// OPERATIONAL REPORTS
// ============================================

describe('AnalyticsService - Operational Reports', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('getOverdueInvoicesReport', () => {
    it('returns overdue invoices with mapped fields', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          invoice_id: 1,
          invoice_number: 'INV-001',
          client_name: 'ACME Corp',
          amount: 5000,
          due_date: '2026-01-01',
          days_overdue: 7,
          reminders_sent: 2
        }
      ]);

      const result = await analyticsService.getOverdueInvoicesReport();

      expect(result).toHaveLength(1);
      expect(result[0].invoiceId).toBe(1);
      expect(result[0].invoiceNumber).toBe('INV-001');
      expect(result[0].daysOverdue).toBe(7);
    });

    it('generates fallback invoice number when missing', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          invoice_id: 42,
          invoice_number: null,
          client_name: 'Client',
          amount: 1000,
          due_date: '2026-01-01',
          days_overdue: 3,
          reminders_sent: 0
        }
      ]);

      const result = await analyticsService.getOverdueInvoicesReport();

      expect(result[0].invoiceNumber).toBe('INV-42');
    });

    it('returns empty when no overdue invoices', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getOverdueInvoicesReport();

      expect(result).toEqual([]);
    });
  });

  describe('getPendingApprovalsReport', () => {
    it('returns pending approvals with mapped fields', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          type: 'deliverable',
          entity_name: 'Homepage Mockup',
          client_name: 'ACME Corp',
          requested_date: '2026-01-01',
          days_waiting: 5,
          reminders_sent: 1
        }
      ]);

      const result = await analyticsService.getPendingApprovalsReport();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].entityName).toBe('Homepage Mockup');
      expect(result[0].daysWaiting).toBe(5);
    });

    it('defaults clientName to Unknown when null', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 2,
          type: 'project',
          entity_name: 'Some Project',
          client_name: null,
          requested_date: '2026-01-01',
          days_waiting: 3,
          reminders_sent: 0
        }
      ]);

      const result = await analyticsService.getPendingApprovalsReport();

      expect(result[0].clientName).toBe('Unknown');
    });

    it('returns empty when no pending approvals', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getPendingApprovalsReport();

      expect(result).toEqual([]);
    });
  });

  describe('getDocumentRequestsStatusReport', () => {
    it('returns status counts and per-client breakdown', async () => {
      mockDb.get.mockResolvedValueOnce({ pending: 5, submitted: 3, approved: 10, overdue: 2 });
      mockDb.all.mockResolvedValueOnce([
        { client_id: 1, client_name: 'ACME Corp', pending: 3, overdue: 1 }
      ]);

      const result = await analyticsService.getDocumentRequestsStatusReport();

      expect(result.pending).toBe(5);
      expect(result.submitted).toBe(3);
      expect(result.approved).toBe(10);
      expect(result.overdue).toBe(2);
      expect(result.byClient).toHaveLength(1);
      expect(result.byClient[0].clientName).toBe('ACME Corp');
    });

    it('handles null status counts from DB', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getDocumentRequestsStatusReport();

      expect(result.pending).toBe(0);
      expect(result.submitted).toBe(0);
      expect(result.approved).toBe(0);
      expect(result.overdue).toBe(0);
    });
  });

  describe('getProjectHealthSummary', () => {
    it('classifies projects as on_track when no issues', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          project_id: 1,
          project_name: 'Healthy Project',
          client_name: 'Good Client',
          status: 'active',
          due_date: '2027-01-01', // future date
          created_at: '2026-01-01',
          completed_tasks: 5,
          total_tasks: 10,
          overdue_tasks: 0,
          overdue_invoices: 0
        }
      ]);

      const result = await analyticsService.getProjectHealthSummary();

      expect(result.onTrack).toBe(1);
      expect(result.atRisk).toBe(0);
      expect(result.overdue).toBe(0);
      expect(result.projects[0].status).toBe('on_track');
    });

    it('classifies projects as at_risk when overdue tasks exist', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          project_id: 2,
          project_name: 'At Risk Project',
          client_name: 'Concerned Client',
          status: 'active',
          due_date: '2027-01-01',
          created_at: '2026-01-01',
          completed_tasks: 2,
          total_tasks: 10,
          overdue_tasks: 3,
          overdue_invoices: 0
        }
      ]);

      const result = await analyticsService.getProjectHealthSummary();

      expect(result.atRisk).toBe(1);
      expect(result.projects[0].issues).toContain('3 overdue task(s)');
    });

    it('classifies projects as at_risk when overdue invoices exist', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          project_id: 3,
          project_name: 'Invoice Risk Project',
          client_name: 'Client',
          status: 'active',
          due_date: '2027-01-01',
          created_at: '2026-01-01',
          completed_tasks: 8,
          total_tasks: 10,
          overdue_tasks: 0,
          overdue_invoices: 2
        }
      ]);

      const result = await analyticsService.getProjectHealthSummary();

      expect(result.atRisk).toBe(1);
      expect(result.projects[0].issues).toContain('2 overdue invoice(s)');
    });

    it('classifies projects as overdue when past due date', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          project_id: 4,
          project_name: 'Overdue Project',
          client_name: 'Late Client',
          status: 'active',
          due_date: '2020-01-01', // past date
          created_at: '2019-01-01',
          completed_tasks: 3,
          total_tasks: 10,
          overdue_tasks: 0,
          overdue_invoices: 0
        }
      ]);

      const result = await analyticsService.getProjectHealthSummary();

      expect(result.overdue).toBe(1);
      expect(result.projects[0].status).toBe('overdue');
      expect(result.projects[0].issues).toContain('Project past due date');
    });

    it('calculates completion percentage correctly', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          project_id: 5,
          project_name: 'Partial Project',
          client_name: 'Client',
          status: 'active',
          due_date: '2027-01-01',
          created_at: '2026-01-01',
          completed_tasks: 7,
          total_tasks: 10,
          overdue_tasks: 0,
          overdue_invoices: 0
        }
      ]);

      const result = await analyticsService.getProjectHealthSummary();

      expect(result.projects[0].completionPercent).toBe(70);
    });

    it('handles project with no tasks (zero division)', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          project_id: 6,
          project_name: 'No Tasks',
          client_name: 'Client',
          status: 'active',
          due_date: '2027-01-01',
          created_at: '2026-01-01',
          completed_tasks: 0,
          total_tasks: 0,
          overdue_tasks: 0,
          overdue_invoices: 0
        }
      ]);

      const result = await analyticsService.getProjectHealthSummary();

      expect(result.projects[0].completionPercent).toBe(0);
    });

    it('handles null due_date', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          project_id: 7,
          project_name: 'No Due Date',
          client_name: 'Client',
          status: 'active',
          due_date: null,
          created_at: '2026-01-01',
          completed_tasks: 0,
          total_tasks: 5,
          overdue_tasks: 0,
          overdue_invoices: 0
        }
      ]);

      const result = await analyticsService.getProjectHealthSummary();

      expect(result.projects[0].dueDate).toBe('');
      expect(result.projects[0].status).toBe('on_track');
    });

    it('returns empty when no active projects', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await analyticsService.getProjectHealthSummary();

      expect(result.onTrack).toBe(0);
      expect(result.atRisk).toBe(0);
      expect(result.overdue).toBe(0);
      expect(result.projects).toEqual([]);
    });

    it('handles multiple projects with mixed health statuses', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          project_id: 1, project_name: 'Good', client_name: 'A',
          status: 'active', due_date: '2027-01-01', created_at: '2026-01-01',
          completed_tasks: 5, total_tasks: 5, overdue_tasks: 0, overdue_invoices: 0
        },
        {
          project_id: 2, project_name: 'Risky', client_name: 'B',
          status: 'active', due_date: '2027-01-01', created_at: '2026-01-01',
          completed_tasks: 2, total_tasks: 10, overdue_tasks: 2, overdue_invoices: 0
        },
        {
          project_id: 3, project_name: 'Late', client_name: 'C',
          status: 'active', due_date: '2020-01-01', created_at: '2019-01-01',
          completed_tasks: 0, total_tasks: 10, overdue_tasks: 0, overdue_invoices: 0
        }
      ]);

      const result = await analyticsService.getProjectHealthSummary();

      expect(result.onTrack).toBe(1);
      expect(result.atRisk).toBe(1);
      expect(result.overdue).toBe(1);
      expect(result.projects).toHaveLength(3);
    });
  });
});
