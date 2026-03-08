/**
 * ===============================================
 * UNIT TESTS - PROJECT REPORT SERVICE
 * ===============================================
 * @file tests/unit/services/project-report-service.test.ts
 *
 * Tests for project report service including:
 * - fetchProjectReportData - all data-fetching branches
 * - generateProjectReportPdf - PDF generation
 * - Formatting helpers (via observable output)
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

// Mock pdf-lib with minimal working stubs
vi.mock('pdf-lib', () => {
  const mockPage = {
    drawText: vi.fn(),
    drawLine: vi.fn(),
    drawImage: vi.fn()
  };
  const mockPdfDoc = {
    addPage: vi.fn(() => mockPage),
    getPages: vi.fn(() => [mockPage]),
    embedStandardFont: vi.fn().mockResolvedValue({ widthOfTextAtSize: vi.fn(() => 50) }),
    embedFont: vi.fn().mockResolvedValue({ widthOfTextAtSize: vi.fn(() => 50) }),
    embedPng: vi.fn().mockResolvedValue({ width: 100, height: 50 }),
    setTitle: vi.fn(),
    setAuthor: vi.fn(),
    setSubject: vi.fn(),
    setCreator: vi.fn(),
    setCreationDate: vi.fn(),
    save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
  };

  return {
    PDFDocument: {
      create: vi.fn().mockResolvedValue(mockPdfDoc)
    },
    StandardFonts: {
      Helvetica: 'Helvetica',
      HelveticaBold: 'Helvetica-Bold'
    },
    rgb: vi.fn((r: number, g: number, b: number) => ({ r, g, b }))
  };
});

// Mock business config
vi.mock('../../../server/config/business', () => ({
  BUSINESS_INFO: {
    name: 'Test Business',
    owner: 'Test Owner',
    contact: 'Test Contact',
    tagline: 'Test Tagline',
    email: 'test@test.com',
    website: 'test.com',
    venmoHandle: '@test',
    zelleEmail: 'test@test.com',
    paypalEmail: 'test@test.com'
  },
  getPdfLogoBytes: vi.fn(() => null)
}));

// Mock pdf-utils
vi.mock('../../../server/utils/pdf-utils', () => ({
  createPdfContext: vi.fn().mockResolvedValue({
    pdfDoc: {
      addPage: vi.fn(() => ({
        drawText: vi.fn(),
        drawLine: vi.fn(),
        drawImage: vi.fn()
      })),
      embedPng: vi.fn().mockResolvedValue({ width: 100, height: 50 })
    },
    currentPage: {
      drawText: vi.fn(),
      drawLine: vi.fn(),
      drawImage: vi.fn()
    },
    fonts: {
      regular: { widthOfTextAtSize: vi.fn(() => 50) },
      bold: { widthOfTextAtSize: vi.fn(() => 60) }
    },
    y: 700,
    height: 792,
    leftMargin: 50,
    rightMargin: 545,
    topMargin: 50,
    bottomMargin: 50,
    pageWidth: 595,
    pageHeight: 842
  }),
  drawWrappedText: vi.fn(),
  ensureSpace: vi.fn(),
  addPageNumbers: vi.fn().mockResolvedValue(undefined),
  setPdfMetadata: vi.fn()
}));

import {
  fetchProjectReportData,
  generateProjectReportPdf
} from '../../../server/services/project-report-service';

// ============================================
// SHARED FIXTURES
// ============================================

const mockProjectRow = {
  id: 42,
  name: 'Redesign Website',
  status: 'active',
  priority: 'high',
  created_at: '2026-01-01T00:00:00Z',
  start_date: '2026-01-15T00:00:00Z',
  deadline: '2026-06-30T00:00:00Z',
  completed_date: null,
  description: 'Full redesign of the company website',
  project_type: 'web',
  budget: 5000,
  client_name: 'Acme Corp',
  client_email: 'acme@example.com',
  client_company: 'Acme Inc'
};

const mockMilestones = [
  {
    title: 'Discovery',
    description: 'Initial discovery phase',
    due_date: '2026-02-01T00:00:00Z',
    is_completed: 1,
    completed_date: '2026-01-31T00:00:00Z'
  },
  {
    title: 'Design',
    description: null,
    due_date: '2026-03-01T00:00:00Z',
    is_completed: 0,
    completed_date: null
  }
];

const mockTimeEntries = [
  { description: 'Initial planning session', hours: 2.5, date: '2026-01-20' },
  { description: 'Client call', hours: 1.0, date: '2026-01-22' }
];

const mockDeliverables = [
  { name: 'Wireframes', status: 'approved', submitted_at: '2026-02-10', approved_at: '2026-02-12' },
  { name: 'Final Designs', status: 'pending', submitted_at: null, approved_at: null }
];

const mockInvoices = [
  { invoice_number: 'INV-001', total_amount: 2500, status: 'paid', due_date: '2026-02-15' },
  { invoice_number: 'INV-002', total_amount: 2500, status: 'sent', due_date: '2026-04-15' }
];

// ============================================
// TESTS: fetchProjectReportData
// ============================================

describe('fetchProjectReportData', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  it('returns null when project does not exist', async () => {
    mockDb.get.mockResolvedValueOnce(undefined); // project query returns nothing

    const result = await fetchProjectReportData(99);

    expect(result).toBeNull();
  });

  it('returns full structured report data when project exists', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockProjectRow) // project + client
      .mockResolvedValueOnce({ total: 3.5 }) // total hours
      .mockResolvedValueOnce({ total_invoiced: 5000, total_paid: 2500 }); // financial summary

    mockDb.all
      .mockResolvedValueOnce(mockMilestones) // milestones
      .mockResolvedValueOnce(mockTimeEntries) // time entries
      .mockResolvedValueOnce(mockDeliverables) // deliverables
      .mockResolvedValueOnce(mockInvoices); // invoices

    const result = await fetchProjectReportData(42);

    expect(result).not.toBeNull();
    expect(result!.project.id).toBe(42);
    expect(result!.project.name).toBe('Redesign Website');
    expect(result!.project.status).toBe('active');
    expect(result!.project.budget).toBe(5000);
  });

  it('maps client data correctly', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockProjectRow)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ total_invoiced: 0, total_paid: 0 });
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await fetchProjectReportData(42);

    expect(result!.client.name).toBe('Acme Corp');
    expect(result!.client.email).toBe('acme@example.com');
    expect(result!.client.company).toBe('Acme Inc');
  });

  it('uses "Unknown Client" when client_name is missing', async () => {
    const projectWithNoClient = { ...mockProjectRow, client_name: null, client_email: null };
    mockDb.get
      .mockResolvedValueOnce(projectWithNoClient)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ total_invoiced: 0, total_paid: 0 });
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await fetchProjectReportData(42);

    expect(result!.client.name).toBe('Unknown Client');
    expect(result!.client.email).toBe('');
  });

  it('maps milestones with is_completed converted to boolean', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockProjectRow)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ total_invoiced: 0, total_paid: 0 });
    mockDb.all
      .mockResolvedValueOnce(mockMilestones)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await fetchProjectReportData(42);

    expect(result!.milestones).toHaveLength(2);
    expect(result!.milestones[0].isCompleted).toBe(true); // is_completed = 1
    expect(result!.milestones[1].isCompleted).toBe(false); // is_completed = 0
    expect(result!.milestones[0].title).toBe('Discovery');
  });

  it('maps time tracking entries correctly', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockProjectRow)
      .mockResolvedValueOnce({ total: 3.5 })
      .mockResolvedValueOnce({ total_invoiced: 0, total_paid: 0 });
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockTimeEntries)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await fetchProjectReportData(42);

    expect(result!.timeTracking.totalHours).toBe(3.5);
    expect(result!.timeTracking.entries).toHaveLength(2);
    expect(result!.timeTracking.entries[0].description).toBe('Initial planning session');
    expect(result!.timeTracking.entries[0].hours).toBe(2.5);
  });

  it('defaults totalHours to 0 when no time entries exist', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockProjectRow)
      .mockResolvedValueOnce(undefined) // no total row
      .mockResolvedValueOnce({ total_invoiced: 0, total_paid: 0 });
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await fetchProjectReportData(42);

    expect(result!.timeTracking.totalHours).toBe(0);
  });

  it('maps deliverables correctly', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockProjectRow)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ total_invoiced: 0, total_paid: 0 });
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockDeliverables)
      .mockResolvedValueOnce([]);

    const result = await fetchProjectReportData(42);

    expect(result!.deliverables).toHaveLength(2);
    expect(result!.deliverables[0].name).toBe('Wireframes');
    expect(result!.deliverables[0].status).toBe('approved');
    expect(result!.deliverables[1].submittedAt).toBeNull();
  });

  it('calculates outstanding balance correctly', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockProjectRow)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ total_invoiced: 5000, total_paid: 2500 });
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockInvoices);

    const result = await fetchProjectReportData(42);

    expect(result!.financial.totalInvoiced).toBe(5000);
    expect(result!.financial.totalPaid).toBe(2500);
    expect(result!.financial.outstanding).toBe(2500);
    expect(result!.financial.invoices).toHaveLength(2);
  });

  it('defaults financial totals to 0 when no invoices exist', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockProjectRow)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce(undefined); // no financial summary
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await fetchProjectReportData(42);

    expect(result!.financial.totalInvoiced).toBe(0);
    expect(result!.financial.totalPaid).toBe(0);
    expect(result!.financial.outstanding).toBe(0);
    expect(result!.financial.invoices).toHaveLength(0);
  });

  it('maps invoice data correctly', async () => {
    mockDb.get
      .mockResolvedValueOnce(mockProjectRow)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ total_invoiced: 2500, total_paid: 2500 });
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockInvoices);

    const result = await fetchProjectReportData(42);

    expect(result!.financial.invoices[0].invoiceNumber).toBe('INV-001');
    expect(result!.financial.invoices[0].amount).toBe(2500);
    expect(result!.financial.invoices[0].status).toBe('paid');
    expect(result!.financial.invoices[0].dueDate).toBe('2026-02-15');
  });

  it('handles projects with null optional fields', async () => {
    const minimalProject = {
      ...mockProjectRow,
      start_date: null,
      deadline: null,
      completed_date: null,
      description: null,
      project_type: null,
      budget: null
    };
    mockDb.get
      .mockResolvedValueOnce(minimalProject)
      .mockResolvedValueOnce({ total: 0 })
      .mockResolvedValueOnce({ total_invoiced: 0, total_paid: 0 });
    mockDb.all
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await fetchProjectReportData(42);

    expect(result!.project.startDate).toBeNull();
    expect(result!.project.deadline).toBeNull();
    expect(result!.project.description).toBeNull();
    expect(result!.project.budget).toBeNull();
  });
});

// ============================================
// TESTS: generateProjectReportPdf
// ============================================

describe('generateProjectReportPdf', () => {
  const baseReportData = {
    project: {
      id: 1,
      name: 'Test Project',
      status: 'active',
      priority: 'high',
      createdAt: '2026-01-01T00:00:00Z',
      startDate: '2026-01-15T00:00:00Z',
      deadline: '2026-06-30T00:00:00Z',
      completedDate: null,
      description: 'A test project description',
      projectType: 'web',
      budget: 10000
    },
    client: {
      name: 'Test Client',
      email: 'client@test.com',
      company: 'Test Co'
    },
    milestones: [],
    timeTracking: { totalHours: 0, entries: [] },
    deliverables: [],
    financial: {
      totalInvoiced: 0,
      totalPaid: 0,
      outstanding: 0,
      invoices: []
    }
  };

  it('returns a Uint8Array for a minimal project', async () => {
    const result = await generateProjectReportPdf(baseReportData);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('generates PDF when milestones are present', async () => {
    const dataWithMilestones = {
      ...baseReportData,
      milestones: [
        {
          title: 'Phase 1',
          description: 'First phase',
          dueDate: '2026-02-01T00:00:00Z',
          isCompleted: true,
          completedDate: '2026-01-31T00:00:00Z'
        },
        {
          title: 'Phase 2',
          description: null,
          dueDate: null,
          isCompleted: false,
          completedDate: null
        }
      ]
    };

    const result = await generateProjectReportPdf(dataWithMilestones);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('generates PDF when deliverables are present', async () => {
    const dataWithDeliverables = {
      ...baseReportData,
      deliverables: [
        { name: 'Wireframes', status: 'approved', submittedAt: '2026-02-01', approvedAt: '2026-02-05' },
        { name: 'Mockups', status: 'rejected', submittedAt: '2026-02-10', approvedAt: null },
        { name: 'Final', status: 'pending', submittedAt: null, approvedAt: null }
      ]
    };

    const result = await generateProjectReportPdf(dataWithDeliverables);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('generates PDF when time tracking entries are present', async () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      description: `Work session ${i + 1}`,
      hours: 2,
      date: `2026-01-${String(i + 1).padStart(2, '0')}`
    }));

    const dataWithTime = {
      ...baseReportData,
      timeTracking: { totalHours: 24, entries }
    };

    const result = await generateProjectReportPdf(dataWithTime);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('generates PDF when financial data is present', async () => {
    const dataWithFinancial = {
      ...baseReportData,
      financial: {
        totalInvoiced: 5000,
        totalPaid: 2500,
        outstanding: 2500,
        invoices: [
          { invoiceNumber: 'INV-001', amount: 2500, status: 'paid', dueDate: '2026-02-15' },
          { invoiceNumber: 'INV-002', amount: 2500, status: 'overdue', dueDate: '2026-04-15' }
        ]
      }
    };

    const result = await generateProjectReportPdf(dataWithFinancial);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('generates PDF when client has no company', async () => {
    const dataNoCompany = {
      ...baseReportData,
      client: { name: 'Solo Client', email: 'solo@test.com', company: null }
    };

    const result = await generateProjectReportPdf(dataNoCompany);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('generates PDF when project has no description', async () => {
    const dataNoDesc = {
      ...baseReportData,
      project: { ...baseReportData.project, description: null }
    };

    const result = await generateProjectReportPdf(dataNoDesc);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
