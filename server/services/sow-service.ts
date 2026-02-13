/**
 * ===============================================
 * STATEMENT OF WORK (SOW) SERVICE
 * ===============================================
 * @file server/services/sow-service.ts
 *
 * Generates Statement of Work PDF documents from proposal data.
 * SOW includes: scope, deliverables, timeline, terms, and pricing.
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { getDatabase } from '../database/init.js';
import { BUSINESS_INFO, getPdfLogoBytes, CONTRACT_TERMS } from '../config/business.js';
import {
  createPdfContext,
  drawWrappedText,
  ensureSpace,
  addPageNumbers,
  setPdfMetadata,
  type PdfPageContext
} from '../utils/pdf-utils.js';

// ============================================
// TYPES
// ============================================

interface SowData {
  project: {
    id: number;
    name: string;
    projectType: string;
    description: string | null;
    startDate: string | null;
    deadline: string | null;
  };
  client: {
    name: string;
    email: string;
    company: string | null;
  };
  proposal: {
    id: number;
    selectedTier: string;
    tierName: string;
    basePrice: number;
    finalPrice: number;
    maintenanceOption: string | null;
    createdAt: string;
    features: Array<{
      name: string;
      price: number;
      isIncluded: boolean;
      isAddon: boolean;
    }>;
  };
  milestones: Array<{
    title: string;
    description: string | null;
    dueDate: string | null;
  }>;
}

// ============================================
// DATA FETCHING
// ============================================

/**
 * Fetch all data needed for a Statement of Work
 */
export async function fetchSowData(projectId: number): Promise<SowData | null> {
  const db = await getDatabase();

  // Fetch project with client info
  const project = await db.get(`
    SELECT
      p.id, p.name, p.project_type, p.description,
      p.start_date, p.deadline,
      c.name as client_name, c.email as client_email, c.company as client_company
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ?
  `, [projectId]) as unknown as {
    id: number;
    name: string;
    project_type: string;
    description: string | null;
    start_date: string | null;
    deadline: string | null;
    client_name: string;
    client_email: string;
    client_company: string | null;
  } | undefined;

  if (!project) return null;

  // Fetch proposal
  const proposal = await db.get(`
    SELECT
      id, selected_tier, base_price, final_price,
      maintenance_option, created_at
    FROM proposals
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `, [projectId]) as unknown as {
    id: number;
    selected_tier: string;
    base_price: number;
    final_price: number;
    maintenance_option: string | null;
    created_at: string;
  } | undefined;

  if (!proposal) return null;

  // Fetch proposal features
  const featuresRaw = await db.all(`
    SELECT feature_name, feature_price, is_included_in_tier, is_addon
    FROM proposal_features
    WHERE proposal_id = ?
    ORDER BY is_addon ASC, feature_name ASC
  `, [proposal.id]);
  const features = featuresRaw as unknown as Array<{
    feature_name: string;
    feature_price: number;
    is_included_in_tier: number;
    is_addon: number;
  }>;

  // Fetch milestones
  const milestonesRaw = await db.all(`
    SELECT title, description, due_date
    FROM milestones
    WHERE project_id = ?
    ORDER BY due_date ASC, created_at ASC
  `, [projectId]);
  const milestones = milestonesRaw as unknown as Array<{
    title: string;
    description: string | null;
    due_date: string | null;
  }>;

  return {
    project: {
      id: project.id,
      name: project.name,
      projectType: project.project_type || 'web-app',
      description: project.description,
      startDate: project.start_date,
      deadline: project.deadline
    },
    client: {
      name: project.client_name || 'Client',
      email: project.client_email || '',
      company: project.client_company
    },
    proposal: {
      id: proposal.id,
      selectedTier: proposal.selected_tier,
      tierName: getTierName(proposal.selected_tier),
      basePrice: proposal.base_price,
      finalPrice: proposal.final_price,
      maintenanceOption: proposal.maintenance_option,
      createdAt: proposal.created_at,
      features: features.map(f => ({
        name: f.feature_name,
        price: f.feature_price,
        isIncluded: f.is_included_in_tier === 1,
        isAddon: f.is_addon === 1
      }))
    },
    milestones: milestones.map(m => ({
      title: m.title,
      description: m.description,
      dueDate: m.due_date
    }))
  };
}

// ============================================
// PDF GENERATION
// ============================================

/**
 * Generate a Statement of Work PDF
 */
export async function generateSowPdf(data: SowData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  setPdfMetadata(pdfDoc, {
    title: `Statement of Work - ${data.project.name}`,
    author: BUSINESS_INFO.name,
    subject: 'Statement of Work',
    creator: 'NoBhadCodes',
    creationDate: new Date()
  });

  const ctx = await createPdfContext(pdfDoc);

  // Draw header on new pages
  const onNewPage = (pageCtx: PdfPageContext) => {
    drawPageHeader(pageCtx, data.project.name);
  };

  // === HEADER ===
  await drawSowHeader(ctx, data);

  // === PARTIES ===
  ctx.y -= 25;
  drawSectionTitle(ctx, '1. PARTIES');
  drawParties(ctx, data);

  // === PROJECT SCOPE ===
  ctx.y -= 20;
  ensureSpace(ctx, 100, onNewPage);
  drawSectionTitle(ctx, '2. PROJECT SCOPE');
  drawProjectScope(ctx, data, onNewPage);

  // === DELIVERABLES ===
  ctx.y -= 20;
  ensureSpace(ctx, 100, onNewPage);
  drawSectionTitle(ctx, '3. DELIVERABLES');
  drawDeliverables(ctx, data, onNewPage);

  // === TIMELINE ===
  if (data.milestones.length > 0) {
    ctx.y -= 20;
    ensureSpace(ctx, 100, onNewPage);
    drawSectionTitle(ctx, '4. TIMELINE & MILESTONES');
    drawTimeline(ctx, data, onNewPage);
  }

  // === PRICING ===
  ctx.y -= 20;
  ensureSpace(ctx, 150, onNewPage);
  drawSectionTitle(ctx, '5. PRICING & PAYMENT');
  drawPricing(ctx, data, onNewPage);

  // === TERMS ===
  ctx.y -= 20;
  ensureSpace(ctx, 100, onNewPage);
  drawSectionTitle(ctx, '6. TERMS & CONDITIONS');
  drawTerms(ctx, onNewPage);

  // Add page numbers
  await addPageNumbers(pdfDoc);

  return pdfDoc.save();
}

// ============================================
// PDF DRAWING HELPERS
// ============================================

function drawPageHeader(ctx: PdfPageContext, projectName: string): void {
  ctx.currentPage.drawText(`Statement of Work: ${projectName}`, {
    x: ctx.leftMargin,
    y: ctx.height - 30,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.5, 0.5, 0.5)
  });
  ctx.y = ctx.height - ctx.topMargin - 20;
}

async function drawSowHeader(ctx: PdfPageContext, data: SowData): Promise<void> {
  const { currentPage, leftMargin, fonts, y: startY } = ctx;
  let y = startY;

  // Logo
  const logoBytes = getPdfLogoBytes();
  if (logoBytes) {
    const logoImage = await ctx.pdfDoc.embedPng(logoBytes);
    const logoHeight = 50;
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    currentPage.drawImage(logoImage, {
      x: ctx.rightMargin - logoWidth,
      y: y - logoHeight + 5,
      width: logoWidth,
      height: logoHeight
    });
  }

  // Title
  currentPage.drawText('STATEMENT OF WORK', {
    x: leftMargin,
    y,
    size: 22,
    font: fonts.bold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 28;

  // Project name
  currentPage.drawText(data.project.name, {
    x: leftMargin,
    y,
    size: 14,
    font: fonts.bold,
    color: rgb(0.2, 0.2, 0.2)
  });
  y -= 20;

  // Date
  currentPage.drawText(`Date: ${formatDate(new Date().toISOString())}`, {
    x: leftMargin,
    y,
    size: 10,
    font: fonts.regular,
    color: rgb(0.4, 0.4, 0.4)
  });
  y -= 15;

  // Divider
  currentPage.drawLine({
    start: { x: leftMargin, y },
    end: { x: ctx.rightMargin, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  });

  ctx.y = y - 10;
}

function drawSectionTitle(ctx: PdfPageContext, title: string): void {
  ctx.currentPage.drawText(title, {
    x: ctx.leftMargin,
    y: ctx.y,
    size: 12,
    font: ctx.fonts.bold,
    color: rgb(0.15, 0.15, 0.15)
  });
  ctx.y -= 5;

  // Underline
  ctx.currentPage.drawLine({
    start: { x: ctx.leftMargin, y: ctx.y },
    end: { x: ctx.leftMargin + 200, y: ctx.y },
    thickness: 2,
    color: rgb(0.5, 0.99, 0.04) // Brand green
  });
  ctx.y -= 15;
}

function drawParties(ctx: PdfPageContext, data: SowData): void {
  const lineHeight = 14;

  // Provider
  ctx.currentPage.drawText('Service Provider:', {
    x: ctx.leftMargin,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.bold,
    color: rgb(0.3, 0.3, 0.3)
  });
  ctx.y -= lineHeight;

  ctx.currentPage.drawText(BUSINESS_INFO.name, {
    x: ctx.leftMargin + 20,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.1, 0.1, 0.1)
  });
  ctx.y -= lineHeight;

  ctx.currentPage.drawText(BUSINESS_INFO.email, {
    x: ctx.leftMargin + 20,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.3, 0.3, 0.3)
  });
  ctx.y -= lineHeight + 8;

  // Client
  ctx.currentPage.drawText('Client:', {
    x: ctx.leftMargin,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.bold,
    color: rgb(0.3, 0.3, 0.3)
  });
  ctx.y -= lineHeight;

  ctx.currentPage.drawText(data.client.name, {
    x: ctx.leftMargin + 20,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.1, 0.1, 0.1)
  });
  ctx.y -= lineHeight;

  if (data.client.company) {
    ctx.currentPage.drawText(data.client.company, {
      x: ctx.leftMargin + 20,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.y -= lineHeight;
  }

  ctx.currentPage.drawText(data.client.email, {
    x: ctx.leftMargin + 20,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.3, 0.3, 0.3)
  });
  ctx.y -= lineHeight;
}

function drawProjectScope(ctx: PdfPageContext, data: SowData, onNewPage: (ctx: PdfPageContext) => void): void {
  const lineHeight = 14;

  // Project type
  ctx.currentPage.drawText(`Project Type: ${formatProjectType(data.project.projectType)}`, {
    x: ctx.leftMargin,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.1, 0.1, 0.1)
  });
  ctx.y -= lineHeight;

  ctx.currentPage.drawText(`Package: ${data.proposal.tierName}`, {
    x: ctx.leftMargin,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.1, 0.1, 0.1)
  });
  ctx.y -= lineHeight + 8;

  // Description
  if (data.project.description) {
    ctx.currentPage.drawText('Project Description:', {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.y -= lineHeight;

    drawWrappedText(ctx, data.project.description, {
      fontSize: 10,
      color: rgb(0.2, 0.2, 0.2),
      lineHeight: 14,
      onNewPage
    });
  }
}

function drawDeliverables(ctx: PdfPageContext, data: SowData, onNewPage: (ctx: PdfPageContext) => void): void {
  // Included features
  const includedFeatures = data.proposal.features.filter(f => f.isIncluded && !f.isAddon);
  const addons = data.proposal.features.filter(f => f.isAddon);

  if (includedFeatures.length > 0) {
    ctx.currentPage.drawText('Included in Package:', {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.y -= 14;

    for (const feature of includedFeatures) {
      ensureSpace(ctx, 16, onNewPage);
      ctx.currentPage.drawText(`- ${feature.name}`, {
        x: ctx.leftMargin + 10,
        y: ctx.y,
        size: 10,
        font: ctx.fonts.regular,
        color: rgb(0.1, 0.1, 0.1)
      });
      ctx.y -= 14;
    }
  }

  if (addons.length > 0) {
    ctx.y -= 8;
    ctx.currentPage.drawText('Additional Features:', {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.y -= 14;

    for (const feature of addons) {
      ensureSpace(ctx, 16, onNewPage);
      ctx.currentPage.drawText(`- ${feature.name}`, {
        x: ctx.leftMargin + 10,
        y: ctx.y,
        size: 10,
        font: ctx.fonts.regular,
        color: rgb(0.1, 0.1, 0.1)
      });

      ctx.currentPage.drawText(`+${formatCurrency(feature.price)}`, {
        x: ctx.rightMargin - 60,
        y: ctx.y,
        size: 10,
        font: ctx.fonts.regular,
        color: rgb(0.4, 0.4, 0.4)
      });
      ctx.y -= 14;
    }
  }
}

function drawTimeline(ctx: PdfPageContext, data: SowData, onNewPage: (ctx: PdfPageContext) => void): void {
  // Project dates
  if (data.project.startDate) {
    ctx.currentPage.drawText(`Start Date: ${formatDate(data.project.startDate)}`, {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.1, 0.1, 0.1)
    });
    ctx.y -= 14;
  }

  if (data.project.deadline) {
    ctx.currentPage.drawText(`Target Completion: ${formatDate(data.project.deadline)}`, {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.1, 0.1, 0.1)
    });
    ctx.y -= 20;
  }

  // Milestones
  if (data.milestones.length > 0) {
    ctx.currentPage.drawText('Milestones:', {
      x: ctx.leftMargin,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.bold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.y -= 14;

    for (let i = 0; i < data.milestones.length; i++) {
      const milestone = data.milestones[i];
      ensureSpace(ctx, 30, onNewPage);

      ctx.currentPage.drawText(`${i + 1}. ${milestone.title}`, {
        x: ctx.leftMargin + 10,
        y: ctx.y,
        size: 10,
        font: ctx.fonts.bold,
        color: rgb(0.1, 0.1, 0.1)
      });

      if (milestone.dueDate) {
        ctx.currentPage.drawText(formatDate(milestone.dueDate), {
          x: ctx.rightMargin - 80,
          y: ctx.y,
          size: 9,
          font: ctx.fonts.regular,
          color: rgb(0.5, 0.5, 0.5)
        });
      }
      ctx.y -= 14;

      if (milestone.description) {
        drawWrappedText(ctx, milestone.description, {
          x: ctx.leftMargin + 20,
          fontSize: 9,
          color: rgb(0.3, 0.3, 0.3),
          lineHeight: 12,
          maxWidth: ctx.contentWidth - 20,
          onNewPage
        });
        ctx.y -= 4;
      }
    }
  }
}

function drawPricing(ctx: PdfPageContext, data: SowData, onNewPage: (ctx: PdfPageContext) => void): void {
  const lineHeight = 16;
  const labelX = ctx.leftMargin;
  const valueX = ctx.leftMargin + 180;

  // Base price
  ctx.currentPage.drawText('Base Package Price:', {
    x: labelX,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.3, 0.3, 0.3)
  });
  ctx.currentPage.drawText(formatCurrency(data.proposal.basePrice), {
    x: valueX,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.regular,
    color: rgb(0.1, 0.1, 0.1)
  });
  ctx.y -= lineHeight;

  // Addons total
  const addonsTotal = data.proposal.features
    .filter(f => f.isAddon)
    .reduce((sum, f) => sum + f.price, 0);

  if (addonsTotal > 0) {
    ctx.currentPage.drawText('Additional Features:', {
      x: labelX,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.currentPage.drawText(formatCurrency(addonsTotal), {
      x: valueX,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.1, 0.1, 0.1)
    });
    ctx.y -= lineHeight;
  }

  // Maintenance
  if (data.proposal.maintenanceOption && data.proposal.maintenanceOption !== 'diy') {
    ctx.currentPage.drawText('Maintenance Plan:', {
      x: labelX,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.currentPage.drawText(formatMaintenanceOption(data.proposal.maintenanceOption), {
      x: valueX,
      y: ctx.y,
      size: 10,
      font: ctx.fonts.regular,
      color: rgb(0.1, 0.1, 0.1)
    });
    ctx.y -= lineHeight;
  }

  // Divider
  ctx.y -= 5;
  ctx.currentPage.drawLine({
    start: { x: labelX, y: ctx.y },
    end: { x: valueX + 80, y: ctx.y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  ctx.y -= lineHeight;

  // Total
  ctx.currentPage.drawText('TOTAL:', {
    x: labelX,
    y: ctx.y,
    size: 12,
    font: ctx.fonts.bold,
    color: rgb(0.1, 0.1, 0.1)
  });
  ctx.currentPage.drawText(formatCurrency(data.proposal.finalPrice), {
    x: valueX,
    y: ctx.y,
    size: 12,
    font: ctx.fonts.bold,
    color: rgb(0.1, 0.1, 0.1)
  });
  ctx.y -= lineHeight + 10;

  // Payment terms
  ensureSpace(ctx, 50, onNewPage);
  ctx.currentPage.drawText('Payment Terms:', {
    x: ctx.leftMargin,
    y: ctx.y,
    size: 10,
    font: ctx.fonts.bold,
    color: rgb(0.3, 0.3, 0.3)
  });
  ctx.y -= 14;

  const paymentTerms = [
    '- 50% deposit required before work begins',
    '- 25% due at midpoint milestone',
    '- 25% due upon project completion'
  ];

  for (const term of paymentTerms) {
    ctx.currentPage.drawText(term, {
      x: ctx.leftMargin + 10,
      y: ctx.y,
      size: 9,
      font: ctx.fonts.regular,
      color: rgb(0.2, 0.2, 0.2)
    });
    ctx.y -= 12;
  }
}

function drawTerms(ctx: PdfPageContext, onNewPage: (ctx: PdfPageContext) => void): void {
  // CONTRACT_TERMS is an array of strings, or use default structured terms
  const termsStrings = CONTRACT_TERMS && CONTRACT_TERMS.length > 0 ? CONTRACT_TERMS : [];
  const structuredTerms = getDefaultTerms();

  if (termsStrings.length > 0) {
    // Use string-based terms from config
    for (const term of termsStrings.slice(0, 5)) {
      ensureSpace(ctx, 30, onNewPage);
      drawWrappedText(ctx, term, {
        fontSize: 9,
        color: rgb(0.3, 0.3, 0.3),
        lineHeight: 11,
        onNewPage
      });
      ctx.y -= 8;
    }
  } else {
    // Use structured default terms
    for (const term of structuredTerms.slice(0, 5)) {
      ensureSpace(ctx, 40, onNewPage);

      ctx.currentPage.drawText(`${term.title}:`, {
        x: ctx.leftMargin,
        y: ctx.y,
        size: 10,
        font: ctx.fonts.bold,
        color: rgb(0.3, 0.3, 0.3)
      });
      ctx.y -= 12;

      drawWrappedText(ctx, term.content, {
        fontSize: 9,
        color: rgb(0.3, 0.3, 0.3),
        lineHeight: 11,
        onNewPage
      });
      ctx.y -= 8;
    }
  }
}

// ============================================
// FORMATTING HELPERS
// ============================================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBD';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'TBD';
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function getTierName(tier: string): string {
  const names: Record<string, string> = {
    good: 'Good Package',
    better: 'Better Package',
    best: 'Best Package'
  };
  return names[tier] || tier;
}

function formatProjectType(type: string): string {
  const names: Record<string, string> = {
    'simple-site': 'Simple Website',
    'business-site': 'Business Website',
    'portfolio': 'Portfolio',
    'e-commerce': 'E-Commerce',
    'ecommerce': 'E-Commerce',
    'web-app': 'Web Application',
    'browser-extension': 'Browser Extension',
    'other': 'Other'
  };
  return names[type] || type;
}

function formatMaintenanceOption(option: string): string {
  const names: Record<string, string> = {
    diy: 'DIY (No Maintenance)',
    essential: 'Essential',
    standard: 'Standard',
    premium: 'Premium'
  };
  return names[option] || option;
}

function getDefaultTerms(): Array<{ title: string; content: string }> {
  return [
    {
      title: 'Intellectual Property',
      content: 'Upon full payment, all intellectual property rights for deliverables transfer to the client.'
    },
    {
      title: 'Revisions',
      content: 'Two rounds of revisions are included per deliverable. Additional revisions will be billed at the hourly rate.'
    },
    {
      title: 'Confidentiality',
      content: 'Both parties agree to keep confidential information private and not disclose to third parties.'
    },
    {
      title: 'Cancellation',
      content: 'Either party may cancel with 14 days written notice. Fees for completed work are non-refundable.'
    },
    {
      title: 'Liability',
      content: 'Liability is limited to the total project value. Neither party is liable for indirect damages.'
    }
  ];
}
