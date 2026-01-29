/**
 * ===============================================
 * INVOICE GENERATOR SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/invoice-generator.test.ts
 *
 * Unit tests for invoice generator service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateInvoice, IntakeData } from '../../../server/services/invoice-generator';

describe('Invoice Generator Service', () => {
  let mockIntakeData: IntakeData;

  beforeEach(() => {
    mockIntakeData = {
      company: 'Test Company',
      projectType: 'business-site',
      projectDescription: 'A test project',
      timeline: '1-3-months',
      budget: '5000-10000',
    };
  });

  describe('generateInvoice', () => {
    it('should generate invoice with base pricing', async () => {
      const invoice = await generateInvoice(mockIntakeData, 1, 1);

      expect(invoice).toBeDefined();
      expect(invoice.projectId).toBe(1);
      expect(invoice.clientId).toBe(1);
      expect(invoice.status).toBe('draft');
      expect(invoice.lineItems.length).toBeGreaterThan(0);
      expect(invoice.lineItems[0].type).toBe('base');
      expect(invoice.lineItems[0].unitPrice).toBe(4000); // business-site base price
      expect(invoice.total).toBeGreaterThan(0);
    });

    it('should generate invoice number in correct format', async () => {
      const invoice = await generateInvoice(mockIntakeData, 1, 1);

      expect(invoice.invoiceNumber).toMatch(/^INV-\d{6}-\d{3}$/);
    });

    it('should include issue date and due date', async () => {
      const invoice = await generateInvoice(mockIntakeData, 1, 1);

      expect(invoice.issueDate).toBeDefined();
      expect(invoice.dueDate).toBeDefined();
      expect(invoice.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(invoice.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should calculate subtotal correctly', async () => {
      const invoice = await generateInvoice(mockIntakeData, 1, 1);

      const calculatedSubtotal = invoice.lineItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );
      expect(invoice.subtotal).toBe(calculatedSubtotal);
    });

    it('should calculate total correctly', async () => {
      const invoice = await generateInvoice(mockIntakeData, 1, 1);

      expect(invoice.total).toBe(invoice.subtotal + invoice.taxAmount);
    });

    it('should generate payment terms', async () => {
      const invoice = await generateInvoice(mockIntakeData, 1, 1);

      expect(invoice.paymentTerms.length).toBeGreaterThan(0);
      expect(invoice.paymentTerms[0]).toHaveProperty('phase');
      expect(invoice.paymentTerms[0]).toHaveProperty('amount');
      expect(invoice.paymentTerms[0]).toHaveProperty('percentage');
      expect(invoice.paymentTerms[0]).toHaveProperty('dueInDays');
    });

    it('should include invoice notes', async () => {
      const invoice = await generateInvoice(mockIntakeData, 1, 1);

      expect(invoice.notes.length).toBeGreaterThan(0);
      expect(invoice.notes[0]).toContain('Test Company');
    });

    it('should include terms and conditions', async () => {
      const invoice = await generateInvoice(mockIntakeData, 1, 1);

      expect(invoice.termsAndConditions.length).toBeGreaterThan(0);
    });

    it('should handle different project types', async () => {
      const types = ['simple-site', 'portfolio', 'e-commerce', 'web-app', 'browser-extension', 'other'];

      for (const type of types) {
        const intakeData = { ...mockIntakeData, projectType: type };
        const invoice = await generateInvoice(intakeData, 1, 1);

        expect(invoice.lineItems[0].unitPrice).toBeGreaterThan(0);
      }
    });

    it('should use default pricing for unknown project type', async () => {
      const intakeData = { ...mockIntakeData, projectType: 'unknown-type' };
      const invoice = await generateInvoice(intakeData, 1, 1);

      expect(invoice.lineItems[0].unitPrice).toBe(3000); // 'other' default price
    });

    it('should handle features as array', async () => {
      const intakeData = {
        ...mockIntakeData,
        features: ['contact-form', 'analytics', 'blog'],
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const featureItems = invoice.lineItems.filter((item) => item.type === 'feature');
      expect(featureItems.length).toBe(3);
    });

    it('should handle features as string', async () => {
      const intakeData = {
        ...mockIntakeData,
        features: 'contact-form',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const featureItems = invoice.lineItems.filter((item) => item.type === 'feature');
      expect(featureItems.length).toBe(1);
    });

    it('should handle addons as array', async () => {
      const intakeData = {
        ...mockIntakeData,
        addons: ['seo-setup', 'copywriting'],
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const addonItems = invoice.lineItems.filter((item) => item.type === 'addon');
      expect(addonItems.length).toBe(2);
    });

    it('should handle addons as string', async () => {
      const intakeData = {
        ...mockIntakeData,
        addons: 'seo-setup',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const addonItems = invoice.lineItems.filter((item) => item.type === 'addon');
      expect(addonItems.length).toBe(1);
    });

    it('should add design complexity adjustment for full-design', async () => {
      const intakeData = {
        ...mockIntakeData,
        designLevel: 'full-design',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const designAdjustment = adjustments.find((item) =>
        item.description.includes('Custom Design')
      );
      expect(designAdjustment).toBeDefined();
      expect(designAdjustment?.totalPrice).toBe(1500);
    });

    it('should add design complexity adjustment for partial-design', async () => {
      const intakeData = {
        ...mockIntakeData,
        designLevel: 'partial-design',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const designAdjustment = adjustments.find((item) =>
        item.description.includes('Design Consultation')
      );
      expect(designAdjustment).toBeDefined();
      expect(designAdjustment?.totalPrice).toBe(500);
    });

    it('should add content creation adjustment for need-help', async () => {
      const intakeData = {
        ...mockIntakeData,
        contentStatus: 'need-help',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const contentAdjustment = adjustments.find((item) =>
        item.description.includes('Content Creation')
      );
      expect(contentAdjustment).toBeDefined();
      expect(contentAdjustment?.totalPrice).toBe(1200);
    });

    it('should add content optimization adjustment for partial content', async () => {
      const intakeData = {
        ...mockIntakeData,
        contentStatus: 'partial',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const contentAdjustment = adjustments.find((item) =>
        item.description.includes('Content Optimization')
      );
      expect(contentAdjustment).toBeDefined();
      expect(contentAdjustment?.totalPrice).toBe(600);
    });

    it('should add integration adjustment for multiple integrations', async () => {
      const intakeData = {
        ...mockIntakeData,
        integrations: 'stripe,mailchimp,analytics',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const integrationAdjustment = adjustments.find((item) =>
        item.description.includes('Third-party Integrations')
      );
      expect(integrationAdjustment).toBeDefined();
      expect(integrationAdjustment?.quantity).toBe(3);
      expect(integrationAdjustment?.totalPrice).toBe(3 * 400);
    });

    it('should cap integration adjustment at 5', async () => {
      const intakeData = {
        ...mockIntakeData,
        integrations: 'api1,api2,api3,api4,api5,api6,api7',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const integrationAdjustment = adjustments.find((item) =>
        item.description.includes('Third-party Integrations')
      );
      expect(integrationAdjustment?.quantity).toBe(5);
      expect(integrationAdjustment?.totalPrice).toBe(5 * 400);
    });

    it('should not add integration adjustment for none', async () => {
      const intakeData = {
        ...mockIntakeData,
        integrations: 'none',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const integrationAdjustment = adjustments.find((item) =>
        item.description.includes('Third-party Integrations')
      );
      expect(integrationAdjustment).toBeUndefined();
    });

    it('should add page adjustment for 11-20 pages', async () => {
      const intakeData = {
        ...mockIntakeData,
        pages: '11-20',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const pageAdjustment = adjustments.find((item) =>
        item.description.includes('11-20 pages')
      );
      expect(pageAdjustment).toBeDefined();
      expect(pageAdjustment?.totalPrice).toBe(800);
    });

    it('should add page adjustment for 20+ pages', async () => {
      const intakeData = {
        ...mockIntakeData,
        pages: '20-plus',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const pageAdjustment = adjustments.find((item) =>
        item.description.includes('20+ pages')
      );
      expect(pageAdjustment).toBeDefined();
      expect(pageAdjustment?.totalPrice).toBe(1500);
    });

    it('should add rush delivery fee for asap timeline', async () => {
      const intakeData = {
        ...mockIntakeData,
        timeline: 'asap',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      const rushAdjustment = adjustments.find((item) =>
        item.description.includes('Rush Delivery')
      );
      expect(rushAdjustment).toBeDefined();
      expect(rushAdjustment?.isPercentage).toBe(true);
      expect(rushAdjustment?.percentage).toBe(0.5);
    });

    it('should generate 2 payment terms for small projects (<3000)', async () => {
      const intakeData = {
        ...mockIntakeData,
        projectType: 'simple-site', // Base price 1500
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      expect(invoice.paymentTerms.length).toBe(2);
      expect(invoice.paymentTerms[0].percentage).toBe(50);
      expect(invoice.paymentTerms[1].percentage).toBe(50);
    });

    it('should generate 3 payment terms for medium projects (3000-10000)', async () => {
      const intakeData = {
        ...mockIntakeData,
        projectType: 'business-site', // Base price 4000
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      expect(invoice.paymentTerms.length).toBe(3);
      expect(invoice.paymentTerms[0].percentage).toBe(40);
      expect(invoice.paymentTerms[1].percentage).toBe(40);
      expect(invoice.paymentTerms[2].percentage).toBe(20);
    });

    it('should generate 4 payment terms for large projects (>=10000)', async () => {
      const intakeData = {
        ...mockIntakeData,
        projectType: 'web-app', // Base price 15000
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      expect(invoice.paymentTerms.length).toBe(4);
      expect(invoice.paymentTerms.every((term) => term.percentage === 25)).toBe(true);
    });

    it('should calculate payment term amounts correctly', async () => {
      const intakeData = {
        ...mockIntakeData,
        projectType: 'business-site',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const totalFromTerms = invoice.paymentTerms.reduce((sum, term) => sum + term.amount, 0);
      expect(totalFromTerms).toBeCloseTo(invoice.total, 2);
    });

    it('should include rush delivery note for asap timeline', async () => {
      const intakeData = {
        ...mockIntakeData,
        timeline: 'asap',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const rushNote = invoice.notes.find((note) => note.includes('Rush delivery'));
      expect(rushNote).toBeDefined();
    });

    it('should include content creation note for need-help content status', async () => {
      const intakeData = {
        ...mockIntakeData,
        contentStatus: 'need-help',
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const contentNote = invoice.notes.find((note) => note.includes('Content creation'));
      expect(contentNote).toBeDefined();
    });

    it('should assign sequential IDs to line items', async () => {
      const intakeData = {
        ...mockIntakeData,
        features: ['contact-form', 'analytics'],
        addons: ['seo-setup'],
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      const ids = invoice.lineItems.map((item) => item.id).filter((id) => id !== undefined);
      expect(ids.length).toBeGreaterThan(0);
      // Check that IDs are sequential starting from 1
      for (let i = 0; i < ids.length; i++) {
        expect(ids[i]).toBe(i + 1);
      }
    });

    it('should handle empty features and addons', async () => {
      const intakeData = {
        ...mockIntakeData,
        features: [],
        addons: [],
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      expect(invoice.lineItems.length).toBeGreaterThan(0); // Should have at least base item
      const featureItems = invoice.lineItems.filter((item) => item.type === 'feature');
      const addonItems = invoice.lineItems.filter((item) => item.type === 'addon');
      expect(featureItems.length).toBe(0);
      expect(addonItems.length).toBe(0);
    });

    it('should handle undefined features and addons', async () => {
      const intakeData = {
        ...mockIntakeData,
        features: undefined,
        addons: undefined,
      };
      const invoice = await generateInvoice(intakeData, 1, 1);

      expect(invoice.lineItems.length).toBeGreaterThan(0);
    });

    it('should set tax rate to 0', async () => {
      const invoice = await generateInvoice(mockIntakeData, 1, 1);

      expect(invoice.taxRate).toBe(0);
      expect(invoice.taxAmount).toBe(0);
    });

    it('should set createdAt timestamp', async () => {
      const before = new Date().toISOString();
      const invoice = await generateInvoice(mockIntakeData, 1, 1);
      const after = new Date().toISOString();

      expect(invoice.createdAt).toBeDefined();
      expect(invoice.createdAt >= before).toBe(true);
      expect(invoice.createdAt <= after).toBe(true);
    });

    it('should handle complex project with all adjustments', async () => {
      const intakeData: IntakeData = {
        company: 'Complex Company',
        projectType: 'e-commerce',
        projectDescription: 'Complex e-commerce site',
        timeline: 'asap',
        budget: '20000+',
        features: ['shopping-cart', 'payment-processing', 'user-accounts'],
        addons: ['seo-setup', 'copywriting'],
        designLevel: 'full-design',
        contentStatus: 'need-help',
        integrations: 'stripe,mailchimp,analytics,shopify',
        pages: '20-plus',
      };

      const invoice = await generateInvoice(intakeData, 1, 1);

      expect(invoice.total).toBeGreaterThan(8000); // Base ecommerce price
      expect(invoice.lineItems.length).toBeGreaterThan(5); // Base + features + addons + adjustments
      
      const featureItems = invoice.lineItems.filter((item) => item.type === 'feature');
      expect(featureItems.length).toBe(3);

      const addonItems = invoice.lineItems.filter((item) => item.type === 'addon');
      expect(addonItems.length).toBe(2);

      const adjustments = invoice.lineItems.filter((item) => item.type === 'adjustment');
      expect(adjustments.length).toBeGreaterThan(0);
    });
  });
});
