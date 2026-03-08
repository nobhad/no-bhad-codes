/**
 * ===============================================
 * UNIT TESTS - SOW SERVICE
 * ===============================================
 * @file tests/unit/services/sow-service.test.ts
 *
 * Tests for the Statement of Work service including:
 * - fetchSowData: project, proposal, features, milestones fetching
 * - fetchSowData: null returns when project/proposal not found
 * - generateSowPdf: PDF generation orchestration
 * - Formatting helpers tested indirectly through fetchSowData results
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mock dependencies before imports.
// IMPORTANT: vi.mock factories are hoisted to the top of the file by Vitest.
// Variables defined outside the factory cannot be referenced inside it.
// All mock state that needs resetting must be accessed via the mocked module.
// ============================================

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn()
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock pdf-lib — PDFDocument.create returns a fresh mock doc each test via beforeEach reset
vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: vi.fn()
  },
  rgb: vi.fn().mockReturnValue({ r: 0, g: 0, b: 0 }),
  StandardFonts: {
    Helvetica: 'Helvetica',
    HelveticaBold: 'Helvetica-Bold'
  }
}));

// Mock business config
vi.mock('../../../server/config/business', () => ({
  BUSINESS_INFO: {
    name: 'No Bhad Codes',
    email: 'hello@nobhadcodes.com',
    owner: 'Noelle',
    contact: 'Noelle',
    tagline: 'Code with purpose'
  },
  getPdfLogoBytes: vi.fn().mockReturnValue(null),
  CONTRACT_TERMS: []
}));

// Mock pdf-utils — createPdfContext is set up in beforeEach with a fresh ctx each test
vi.mock('../../../server/utils/pdf-utils', () => ({
  createPdfContext: vi.fn(),
  drawWrappedText: vi.fn(),
  ensureSpace: vi.fn(),
  addPageNumbers: vi.fn().mockResolvedValue(undefined),
  setPdfMetadata: vi.fn()
}));

// Import service and mocked modules after all vi.mock calls
import { fetchSowData, generateSowPdf } from '../../../server/services/sow-service';
import { getDatabase } from '../../../server/database/init';
import { PDFDocument } from 'pdf-lib';
import { createPdfContext, addPageNumbers, setPdfMetadata } from '../../../server/utils/pdf-utils';

// ============================================
// FIXTURES
// ============================================

const mockProjectRow = {
  id: 1,
  name: 'Acme Portal',
  project_type: 'web-app',
  description: 'A great web app',
  start_date: '2026-01-01',
  deadline: '2026-06-01',
  client_name: 'John Doe',
  client_email: 'john@acme.com',
  client_company: 'Acme Corp'
};

const mockProposalRow = {
  id: 10,
  selected_tier: 'better',
  base_price: 5000,
  final_price: 6200,
  maintenance_option: 'standard',
  created_at: '2026-01-01T00:00:00Z'
};

const mockFeatureRows = [
  { feature_name: 'Auth', feature_price: 0, is_included_in_tier: 1, is_addon: 0 },
  { feature_name: 'Dark Mode', feature_price: 500, is_included_in_tier: 0, is_addon: 1 }
];

const mockMilestoneRows = [
  { title: 'Design', description: 'Finalize wireframes', due_date: '2026-02-01' },
  { title: 'Development', description: null, due_date: '2026-04-01' }
];

// ============================================
// HELPERS
// ============================================

/** Create a fresh page mock */
function makePage() {
  return {
    drawText: vi.fn(),
    drawLine: vi.fn(),
    drawImage: vi.fn()
  };
}

/** Create a fresh db mock and wire getDatabase to return it */
function makeDb() {
  const db = { get: vi.fn(), all: vi.fn(), run: vi.fn() };
  vi.mocked(getDatabase).mockReturnValue(db as never);
  return db;
}

/** Create a fresh pdf doc mock and wire PDFDocument.create to return it */
function makePdfDoc(page = makePage()) {
  const doc = {
    addPage: vi.fn().mockReturnValue(page),
    embedPng: vi.fn().mockResolvedValue({ width: 100, height: 50 }),
    setTitle: vi.fn(),
    setAuthor: vi.fn(),
    setSubject: vi.fn(),
    setCreator: vi.fn(),
    setCreationDate: vi.fn(),
    save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    getPageCount: vi.fn().mockReturnValue(1),
    getPage: vi.fn().mockReturnValue(page)
  };
  vi.mocked(PDFDocument.create).mockResolvedValue(doc as never);
  return { doc, page };
}

/** Create a fresh ctx mock and wire createPdfContext to return it */
function makeCtx(page = makePage()) {
  const ctx = {
    currentPage: page,
    pdfDoc: {},
    leftMargin: 50,
    rightMargin: 550,
    topMargin: 50,
    contentWidth: 500,
    height: 792,
    y: 700,
    fonts: { regular: {}, bold: {} }
  };
  vi.mocked(createPdfContext).mockResolvedValue(ctx as never);
  return { ctx, page };
}

// ============================================
// TESTS - fetchSowData
// ============================================

describe('SowService - fetchSowData', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
  });

  it('returns null when project is not found', async () => {
    db.get.mockResolvedValueOnce(undefined);

    const result = await fetchSowData(999);

    expect(result).toBeNull();
    expect(db.get).toHaveBeenCalledTimes(1);
  });

  it('returns null when proposal is not found', async () => {
    db.get.mockResolvedValueOnce(mockProjectRow);
    db.get.mockResolvedValueOnce(undefined);

    const result = await fetchSowData(1);

    expect(result).toBeNull();
  });

  it('returns complete SowData when project, proposal, features, and milestones exist', async () => {
    db.get.mockResolvedValueOnce(mockProjectRow);
    db.get.mockResolvedValueOnce(mockProposalRow);
    db.all.mockResolvedValueOnce(mockFeatureRows);
    db.all.mockResolvedValueOnce(mockMilestoneRows);

    const result = await fetchSowData(1);

    expect(result).not.toBeNull();

    // Project fields
    expect(result!.project.id).toBe(1);
    expect(result!.project.name).toBe('Acme Portal');
    expect(result!.project.projectType).toBe('web-app');
    expect(result!.project.description).toBe('A great web app');
    expect(result!.project.startDate).toBe('2026-01-01');
    expect(result!.project.deadline).toBe('2026-06-01');

    // Client fields
    expect(result!.client.name).toBe('John Doe');
    expect(result!.client.email).toBe('john@acme.com');
    expect(result!.client.company).toBe('Acme Corp');

    // Proposal fields
    expect(result!.proposal.id).toBe(10);
    expect(result!.proposal.selectedTier).toBe('better');
    expect(result!.proposal.tierName).toBe('Better Package');
    expect(result!.proposal.basePrice).toBe(5000);
    expect(result!.proposal.finalPrice).toBe(6200);
    expect(result!.proposal.maintenanceOption).toBe('standard');

    // Features mapping
    expect(result!.proposal.features).toHaveLength(2);
    expect(result!.proposal.features[0]).toMatchObject({
      name: 'Auth',
      price: 0,
      isIncluded: true,
      isAddon: false
    });
    expect(result!.proposal.features[1]).toMatchObject({
      name: 'Dark Mode',
      price: 500,
      isIncluded: false,
      isAddon: true
    });

    // Milestones mapping
    expect(result!.milestones).toHaveLength(2);
    expect(result!.milestones[0]).toMatchObject({
      title: 'Design',
      description: 'Finalize wireframes',
      dueDate: '2026-02-01'
    });
    expect(result!.milestones[1]).toMatchObject({
      title: 'Development',
      description: null,
      dueDate: '2026-04-01'
    });
  });

  it('defaults projectType to web-app when project_type is null', async () => {
    db.get.mockResolvedValueOnce({ ...mockProjectRow, project_type: null });
    db.get.mockResolvedValueOnce(mockProposalRow);
    db.all.mockResolvedValueOnce([]);
    db.all.mockResolvedValueOnce([]);

    const result = await fetchSowData(1);

    expect(result!.project.projectType).toBe('web-app');
  });

  it('defaults client name to "Client" and email to empty string when null', async () => {
    db.get.mockResolvedValueOnce({ ...mockProjectRow, client_name: null, client_email: null });
    db.get.mockResolvedValueOnce(mockProposalRow);
    db.all.mockResolvedValueOnce([]);
    db.all.mockResolvedValueOnce([]);

    const result = await fetchSowData(1);

    expect(result!.client.name).toBe('Client');
    expect(result!.client.email).toBe('');
  });

  it('handles project with no features and no milestones', async () => {
    db.get.mockResolvedValueOnce(mockProjectRow);
    db.get.mockResolvedValueOnce(mockProposalRow);
    db.all.mockResolvedValueOnce([]);
    db.all.mockResolvedValueOnce([]);

    const result = await fetchSowData(1);

    expect(result!.proposal.features).toHaveLength(0);
    expect(result!.milestones).toHaveLength(0);
  });

  it('queries proposal_features with proposal id and milestones with project id', async () => {
    db.get.mockResolvedValueOnce(mockProjectRow);
    db.get.mockResolvedValueOnce(mockProposalRow);
    db.all.mockResolvedValueOnce([]);
    db.all.mockResolvedValueOnce([]);

    await fetchSowData(1);

    const [featuresQuery, featuresParams] = db.all.mock.calls[0];
    expect(featuresQuery).toContain('proposal_features');
    expect(featuresParams).toEqual([10]); // proposal id

    const [milestonesQuery, milestonesParams] = db.all.mock.calls[1];
    expect(milestonesQuery).toContain('milestones');
    expect(milestonesParams).toEqual([1]); // project id
  });

  it('maps tier names: good, better, best, and unknown fallback', async () => {
    const tierMappings = [
      { tier: 'good', expected: 'Good Package' },
      { tier: 'better', expected: 'Better Package' },
      { tier: 'best', expected: 'Best Package' },
      { tier: 'custom_tier', expected: 'custom_tier' }
    ];

    for (const { tier, expected } of tierMappings) {
      db.get.mockResolvedValueOnce(mockProjectRow);
      db.get.mockResolvedValueOnce({ ...mockProposalRow, selected_tier: tier });
      db.all.mockResolvedValueOnce([]);
      db.all.mockResolvedValueOnce([]);

      const result = await fetchSowData(1);

      expect(result!.proposal.tierName).toBe(expected);
    }
  });

  it('correctly maps is_included_in_tier and is_addon flags from integer to boolean', async () => {
    const featureRows = [
      { feature_name: 'A', feature_price: 100, is_included_in_tier: 1, is_addon: 0 },
      { feature_name: 'B', feature_price: 200, is_included_in_tier: 0, is_addon: 1 },
      { feature_name: 'C', feature_price: 0, is_included_in_tier: 0, is_addon: 0 }
    ];

    db.get.mockResolvedValueOnce(mockProjectRow);
    db.get.mockResolvedValueOnce(mockProposalRow);
    db.all.mockResolvedValueOnce(featureRows);
    db.all.mockResolvedValueOnce([]);

    const result = await fetchSowData(1);

    expect(result!.proposal.features[0].isIncluded).toBe(true);
    expect(result!.proposal.features[0].isAddon).toBe(false);
    expect(result!.proposal.features[1].isIncluded).toBe(false);
    expect(result!.proposal.features[1].isAddon).toBe(true);
    expect(result!.proposal.features[2].isIncluded).toBe(false);
    expect(result!.proposal.features[2].isAddon).toBe(false);
  });
});

// ============================================
// TESTS - generateSowPdf
// ============================================

describe('SowService - generateSowPdf', () => {
  const buildSowData = (overrides: Record<string, unknown> = {}) => ({
    project: {
      id: 1,
      name: 'Test Project',
      projectType: 'web-app',
      description: 'A test project description',
      startDate: '2026-01-01',
      deadline: '2026-06-01'
    },
    client: {
      name: 'Test Client',
      email: 'client@test.com',
      company: 'Test Corp'
    },
    proposal: {
      id: 10,
      selectedTier: 'better',
      tierName: 'Better Package',
      basePrice: 5000,
      finalPrice: 6200,
      maintenanceOption: 'standard',
      createdAt: '2026-01-01T00:00:00Z',
      features: [
        { name: 'Auth', price: 0, isIncluded: true, isAddon: false },
        { name: 'Dark Mode', price: 500, isIncluded: false, isAddon: true }
      ]
    },
    milestones: [
      { title: 'Design', description: 'Wireframes', dueDate: '2026-02-01' },
      { title: 'Dev', description: null, dueDate: '2026-04-01' }
    ],
    ...overrides
  });

  let page: ReturnType<typeof makePage>;

  beforeEach(() => {
    page = makePage();
    makePdfDoc(page);
    makeCtx(page);
  });

  it('generates a PDF and returns Uint8Array', async () => {
    const result = await generateSowPdf(buildSowData() as never);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('calls setPdfMetadata with project name in title', async () => {
    await generateSowPdf(buildSowData() as never);

    expect(setPdfMetadata).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: 'Statement of Work - Test Project' })
    );
  });

  it('calls addPageNumbers on the pdf document', async () => {
    await generateSowPdf(buildSowData() as never);

    expect(addPageNumbers).toHaveBeenCalledOnce();
  });

  it('draws STATEMENT OF WORK header text', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).toContain('STATEMENT OF WORK');
    expect(textCalls).toContain('Test Project');
  });

  it('draws all required section titles', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).toContain('1. PARTIES');
    expect(textCalls).toContain('2. PROJECT SCOPE');
    expect(textCalls).toContain('3. DELIVERABLES');
    expect(textCalls).toContain('5. PRICING & PAYMENT');
    expect(textCalls).toContain('6. TERMS & CONDITIONS');
  });

  it('draws timeline section when milestones exist', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).toContain('4. TIMELINE & MILESTONES');
  });

  it('skips timeline section when milestones array is empty', async () => {
    await generateSowPdf(buildSowData({ milestones: [] }) as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).not.toContain('4. TIMELINE & MILESTONES');
  });

  it('draws client company when present', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).toContain('Test Corp');
  });

  it('does not crash when client company is null', async () => {
    const data = buildSowData({ client: { name: 'Solo Client', email: 'solo@test.com', company: null } });

    const result = await generateSowPdf(data as never);

    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('draws payment terms section', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).toContain('Payment Terms:');
    expect(textCalls).toContain('- 50% deposit required before work begins');
  });

  it('draws start date when startDate is present', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls.some((t: string) => t.includes('Start Date:'))).toBe(true);
  });

  it('skips start date line when startDate is null', async () => {
    const data = buildSowData({
      project: { id: 1, name: 'No Start', projectType: 'web-app', description: null, startDate: null, deadline: '2026-06-01' }
    });

    await generateSowPdf(data as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls.some((t: string) => t.includes('Start Date:'))).toBe(false);
  });

  it('draws target completion when deadline is present', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls.some((t: string) => t.includes('Target Completion:'))).toBe(true);
  });

  it('skips deadline line when deadline is null', async () => {
    const data = buildSowData({
      project: { id: 1, name: 'No Deadline', projectType: 'web-app', description: null, startDate: '2026-01-01', deadline: null }
    });

    await generateSowPdf(data as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls.some((t: string) => t.includes('Target Completion:'))).toBe(false);
  });

  it('includes maintenance plan line when option is not diy', async () => {
    const data = buildSowData({
      proposal: {
        id: 10, selectedTier: 'better', tierName: 'Better Package',
        basePrice: 5000, finalPrice: 5500, maintenanceOption: 'essential',
        createdAt: '2026-01-01T00:00:00Z', features: []
      }
    });

    await generateSowPdf(data as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).toContain('Maintenance Plan:');
  });

  it('skips maintenance plan line when option is diy', async () => {
    const data = buildSowData({
      proposal: {
        id: 10, selectedTier: 'good', tierName: 'Good Package',
        basePrice: 3000, finalPrice: 3000, maintenanceOption: 'diy',
        createdAt: '2026-01-01T00:00:00Z', features: []
      }
    });

    await generateSowPdf(data as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).not.toContain('Maintenance Plan:');
  });

  it('skips maintenance plan line when option is null', async () => {
    const data = buildSowData({
      proposal: {
        id: 10, selectedTier: 'good', tierName: 'Good Package',
        basePrice: 3000, finalPrice: 3000, maintenanceOption: null,
        createdAt: '2026-01-01T00:00:00Z', features: []
      }
    });

    await generateSowPdf(data as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).not.toContain('Maintenance Plan:');
  });

  it('draws included features section when includedFeatures exist', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).toContain('Included in Package:');
  });

  it('skips included features section when no included features', async () => {
    const data = buildSowData({
      proposal: {
        id: 10, selectedTier: 'best', tierName: 'Best Package',
        basePrice: 8000, finalPrice: 9000, maintenanceOption: 'premium',
        createdAt: '2026-01-01T00:00:00Z',
        features: [{ name: 'Custom Widget', price: 1000, isIncluded: false, isAddon: true }]
      }
    });

    await generateSowPdf(data as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).not.toContain('Included in Package:');
  });

  it('draws additional features section when addons exist', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).toContain('Additional Features:');
  });

  it('skips additional features section when no addons', async () => {
    const data = buildSowData({
      proposal: {
        id: 10, selectedTier: 'good', tierName: 'Good Package',
        basePrice: 3000, finalPrice: 3000, maintenanceOption: null,
        createdAt: '2026-01-01T00:00:00Z',
        features: [{ name: 'Basic Pages', price: 0, isIncluded: true, isAddon: false }]
      }
    });

    await generateSowPdf(data as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls).not.toContain('Additional Features:');
  });

  it('draws milestone title in timeline', async () => {
    await generateSowPdf(buildSowData() as never);

    const textCalls = page.drawText.mock.calls.map(([text]: [string]) => text);
    expect(textCalls.some((t: string) => t.includes('Design'))).toBe(true);
  });

  it('does not crash when project has no description', async () => {
    const data = buildSowData({
      project: { id: 1, name: 'No Desc', projectType: 'portfolio', description: null, startDate: null, deadline: null }
    });

    const result = await generateSowPdf(data as never);

    expect(result).toBeInstanceOf(Uint8Array);
  });
});
