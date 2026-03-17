/**
 * ===============================================
 * STATEMENT OF WORK (SOW) SERVICE
 * ===============================================
 * @file server/services/sow-service.ts
 *
 * Generates Statement of Work PDF documents from proposal data.
 * SOW includes: scope, deliverables, timeline, terms, and pricing.
 */

import { PDFDocument } from 'pdf-lib';
import { getDatabase } from '../database/init.js';
import { BUSINESS_INFO, CONTRACT_TERMS } from '../config/business.js';
import { PDF_COLORS, PDF_TYPOGRAPHY, PDF_SPACING } from '../config/pdf-styles.js';
import {
  createPdfContext,
  drawPdfDocumentHeader,
  drawPdfFooter,
  drawWrappedText,
  ensureSpace,
  addPageNumbers,
  setPdfMetadata,
  drawTwoColumnInfo,
  drawSectionLabel,
  drawLabelValue,
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
  const project = (await db.get(
    `
    SELECT
      p.id, p.project_name as name, p.project_type, p.description,
      p.start_date, p.estimated_end_date as deadline,
      COALESCE(c.billing_name, c.contact_name) as client_name,
      COALESCE(c.billing_email, c.email) as client_email,
      COALESCE(c.billing_company, c.company_name) as client_company
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ? AND p.deleted_at IS NULL
  `,
    [projectId]
  )) as unknown as
    | {
        id: number;
        name: string;
        project_type: string;
        description: string | null;
        start_date: string | null;
        deadline: string | null;
        client_name: string;
        client_email: string;
        client_company: string | null;
      }
    | undefined;

  if (!project) return null;

  // Fetch proposal
  const proposal = (await db.get(
    `
    SELECT
      id, selected_tier, base_price, final_price,
      maintenance_option, created_at
    FROM proposal_requests
    WHERE project_id = ? AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [projectId]
  )) as unknown as
    | {
        id: number;
        selected_tier: string;
        base_price: number;
        final_price: number;
        maintenance_option: string | null;
        created_at: string;
      }
    | undefined;

  if (!proposal) return null;

  // Fetch proposal features
  const featuresRaw = await db.all(
    `
    SELECT feature_name, feature_price, is_included_in_tier, is_addon
    FROM proposal_features
    WHERE proposal_id = ?
    ORDER BY is_addon ASC, feature_name ASC
  `,
    [proposal.id]
  );
  const features = featuresRaw as unknown as Array<{
    feature_name: string;
    feature_price: number;
    is_included_in_tier: number;
    is_addon: number;
  }>;

  // Fetch milestones
  const milestonesRaw = await db.all(
    `
    SELECT title, description, due_date
    FROM milestones
    WHERE project_id = ?
    ORDER BY due_date ASC, created_at ASC
  `,
    [projectId]
  );
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
      features: features.map((f) => ({
        name: f.feature_name,
        price: f.feature_price,
        isIncluded: f.is_included_in_tier === 1,
        isAddon: f.is_addon === 1
      }))
    },
    milestones: milestones.map((m) => ({
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
  const { leftMargin, rightMargin, fonts } = ctx;
  const lineHeight = PDF_SPACING.lineHeight;

  // Continuation header on new pages
  const onNewPage = (pageCtx: PdfPageContext) => {
    pageCtx.currentPage.drawText(`Statement of Work: ${data.project.name} (continued)`, {
      x: pageCtx.leftMargin,
      y: pageCtx.height - 30,
      size: PDF_TYPOGRAPHY.bodySize,
      font: pageCtx.fonts.regular,
      color: PDF_COLORS.black
    });
    pageCtx.y = pageCtx.height - pageCtx.topMargin - 20;
  };

  // === HEADER ===
  ctx.y = await drawPdfDocumentHeader({
    page: ctx.currentPage,
    pdfDoc,
    fonts,
    startY: ctx.y,
    leftMargin,
    rightMargin,
    title: 'STATEMENT OF WORK'
  });

  // === TWO-COLUMN INFO: PREPARED FOR / PROJECT DETAILS ===
  const leftLines: Array<{ text: string; bold?: boolean }> = [];
  if (data.client.company) {
    leftLines.push({ text: data.client.company, bold: true });
    leftLines.push({ text: data.client.name });
  } else {
    leftLines.push({ text: data.client.name, bold: true });
  }
  leftLines.push({ text: data.client.email });

  const rightPairs: Array<{ label: string; value: string }> = [
    { label: 'PROJECT TYPE:', value: formatProjectType(data.project.projectType) },
    { label: 'PACKAGE:', value: data.proposal.tierName },
    { label: 'DATE:', value: formatDate(data.proposal.createdAt) }
  ];
  if (data.project.startDate) {
    rightPairs.push({ label: 'START:', value: formatDate(data.project.startDate) });
  }
  if (data.project.deadline) {
    rightPairs.push({ label: 'DEADLINE:', value: formatDate(data.project.deadline) });
  }

  ctx.y = drawTwoColumnInfo(ctx.currentPage, {
    leftMargin,
    rightMargin,
    width: ctx.width,
    y: ctx.y,
    fonts,
    left: { label: 'PREPARED FOR:', lines: leftLines },
    right: { pairs: rightPairs }
  });

  // === SCOPE OF WORK ===
  ctx.y -= PDF_SPACING.sectionSpacing;
  ensureSpace(ctx, 100, onNewPage);
  ctx.y = drawSectionLabel(ctx.currentPage, 'SCOPE OF WORK', {
    x: leftMargin, y: ctx.y, font: fonts.bold
  });

  if (data.project.description) {
    drawWrappedText(ctx, data.project.description, {
      fontSize: PDF_TYPOGRAPHY.bodySize,
      color: PDF_COLORS.black,
      lineHeight,
      onNewPage
    });
  }

  // === DELIVERABLES ===
  ctx.y -= PDF_SPACING.sectionSpacing;
  ensureSpace(ctx, 100, onNewPage);
  ctx.y = drawSectionLabel(ctx.currentPage, 'DELIVERABLES', {
    x: leftMargin, y: ctx.y, font: fonts.bold
  });

  const includedFeatures = data.proposal.features.filter((f) => f.isIncluded && !f.isAddon);
  const addons = data.proposal.features.filter((f) => f.isAddon);

  if (includedFeatures.length > 0) {
    ctx.y = drawLabelValue(ctx.currentPage, 'INCLUDED IN PACKAGE:', '', {
      x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular
    });
    for (const feature of includedFeatures) {
      ensureSpace(ctx, 16, onNewPage);
      ctx.currentPage.drawText(`- ${feature.name}`, {
        x: leftMargin + PDF_SPACING.indent,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });
      ctx.y -= lineHeight;
    }
  }

  if (addons.length > 0) {
    ctx.y -= 8;
    ctx.y = drawLabelValue(ctx.currentPage, 'ADDITIONAL FEATURES:', '', {
      x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular
    });
    for (const feature of addons) {
      ensureSpace(ctx, 16, onNewPage);
      ctx.currentPage.drawText(`- ${feature.name}`, {
        x: leftMargin + PDF_SPACING.indent,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });
      const priceText = `+${formatCurrency(feature.price)}`;
      const priceW = fonts.regular.widthOfTextAtSize(priceText, PDF_TYPOGRAPHY.bodySize);
      ctx.currentPage.drawText(priceText, {
        x: rightMargin - priceW,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.regular,
        color: PDF_COLORS.black
      });
      ctx.y -= lineHeight;
    }
  }

  // === TIMELINE ===
  if (data.milestones.length > 0) {
    ctx.y -= PDF_SPACING.sectionSpacing;
    ensureSpace(ctx, 100, onNewPage);
    ctx.y = drawSectionLabel(ctx.currentPage, 'TIMELINE & MILESTONES', {
      x: leftMargin, y: ctx.y, font: fonts.bold
    });

    if (data.project.startDate) {
      ctx.y = drawLabelValue(ctx.currentPage, 'START DATE:', formatDate(data.project.startDate), {
        x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular
      });
    }
    if (data.project.deadline) {
      ctx.y = drawLabelValue(ctx.currentPage, 'TARGET COMPLETION:', formatDate(data.project.deadline), {
        x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular
      });
    }
    ctx.y -= 8;

    for (let i = 0; i < data.milestones.length; i++) {
      const milestone = data.milestones[i];
      ensureSpace(ctx, 30, onNewPage);

      ctx.currentPage.drawText(`${i + 1}. ${milestone.title}`, {
        x: leftMargin + PDF_SPACING.indent,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: fonts.bold,
        color: PDF_COLORS.black
      });

      if (milestone.dueDate) {
        const dueDateText = formatDate(milestone.dueDate);
        const dueDateW = fonts.regular.widthOfTextAtSize(dueDateText, PDF_TYPOGRAPHY.bodySize);
        ctx.currentPage.drawText(dueDateText, {
          x: rightMargin - dueDateW,
          y: ctx.y,
          size: PDF_TYPOGRAPHY.bodySize,
          font: fonts.regular,
          color: PDF_COLORS.black
        });
      }
      ctx.y -= lineHeight;

      if (milestone.description) {
        drawWrappedText(ctx, milestone.description, {
          x: leftMargin + PDF_SPACING.indentDouble,
          fontSize: PDF_TYPOGRAPHY.bodySize,
          color: PDF_COLORS.black,
          lineHeight,
          maxWidth: ctx.contentWidth - PDF_SPACING.indentDouble,
          onNewPage
        });
        ctx.y -= 4;
      }
    }
  }

  // === PRICING ===
  ctx.y -= PDF_SPACING.sectionSpacing;
  ensureSpace(ctx, 150, onNewPage);
  ctx.y = drawSectionLabel(ctx.currentPage, 'PRICING & PAYMENT', {
    x: leftMargin, y: ctx.y, font: fonts.bold
  });

  const labelWidth = 120;

  ctx.y = drawLabelValue(ctx.currentPage, 'BASE PACKAGE:', formatCurrency(data.proposal.basePrice), {
    x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
  });

  const addonsTotal = data.proposal.features
    .filter((f) => f.isAddon)
    .reduce((sum, f) => sum + f.price, 0);

  if (addonsTotal > 0) {
    ctx.y = drawLabelValue(ctx.currentPage, 'ADD-ONS:', formatCurrency(addonsTotal), {
      x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
    });
  }

  if (data.proposal.maintenanceOption && data.proposal.maintenanceOption !== 'diy') {
    ctx.y = drawLabelValue(ctx.currentPage, 'MAINTENANCE:', formatMaintenanceOption(data.proposal.maintenanceOption), {
      x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular, labelWidth
    });
  }

  // Totals divider + total (matching invoice pattern)
  const totalsX = rightMargin - 144;
  ctx.y -= 10;
  ctx.currentPage.drawLine({
    start: { x: totalsX - 14, y: ctx.y + 18 },
    end: { x: rightMargin, y: ctx.y + 18 },
    thickness: PDF_SPACING.underlineThickness,
    color: PDF_COLORS.divider
  });

  ctx.currentPage.drawText('TOTAL:', {
    x: totalsX,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: fonts.bold,
    color: PDF_COLORS.black
  });
  const totalText = formatCurrency(data.proposal.finalPrice);
  const totalW = fonts.bold.widthOfTextAtSize(totalText, PDF_TYPOGRAPHY.bodySize);
  ctx.currentPage.drawText(totalText, {
    x: rightMargin - totalW,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: fonts.bold,
    color: PDF_COLORS.black
  });
  ctx.y -= 30;

  // Payment terms
  ensureSpace(ctx, 60, onNewPage);
  ctx.y = drawSectionLabel(ctx.currentPage, 'PAYMENT TERMS', {
    x: leftMargin, y: ctx.y, font: fonts.bold
  });

  const paymentTerms = [
    '- 50% deposit required before work begins',
    '- 25% due at midpoint milestone',
    '- 25% due upon project completion'
  ];
  for (const term of paymentTerms) {
    ctx.currentPage.drawText(term, {
      x: leftMargin + PDF_SPACING.indent,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: fonts.regular,
      color: PDF_COLORS.black
    });
    ctx.y -= lineHeight;
  }

  // === TERMS & CONDITIONS ===
  ctx.y -= PDF_SPACING.sectionSpacing;
  ensureSpace(ctx, 100, onNewPage);
  ctx.y = drawSectionLabel(ctx.currentPage, 'TERMS & CONDITIONS', {
    x: leftMargin, y: ctx.y, font: fonts.bold
  });

  const termsStrings = CONTRACT_TERMS && CONTRACT_TERMS.length > 0 ? CONTRACT_TERMS : [];
  const structuredTerms = getDefaultTerms();

  if (termsStrings.length > 0) {
    for (const term of termsStrings.slice(0, 5)) {
      ensureSpace(ctx, 30, onNewPage);
      drawWrappedText(ctx, term, {
        fontSize: PDF_TYPOGRAPHY.bodySize,
        color: PDF_COLORS.black,
        lineHeight,
        onNewPage
      });
      ctx.y -= 8;
    }
  } else {
    for (const term of structuredTerms.slice(0, 5)) {
      ensureSpace(ctx, 40, onNewPage);
      ctx.y = drawLabelValue(ctx.currentPage, `${term.title.toUpperCase()}:`, '', {
        x: leftMargin, y: ctx.y, labelFont: fonts.bold, valueFont: fonts.regular
      });
      drawWrappedText(ctx, term.content, {
        fontSize: PDF_TYPOGRAPHY.bodySize,
        color: PDF_COLORS.black,
        lineHeight,
        onNewPage
      });
      ctx.y -= 8;
    }
  }

  // === FOOTER — on all pages ===
  for (const footerPage of pdfDoc.getPages()) {
    drawPdfFooter(footerPage, {
      leftMargin,
      rightMargin,
      width: ctx.width,
      fonts,
      thankYouText: 'Thank you for your business!'
    });
  }

  await addPageNumbers(pdfDoc);

  return pdfDoc.save();
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
    portfolio: 'Portfolio',
    'e-commerce': 'E-Commerce',
    ecommerce: 'E-Commerce',
    'web-app': 'Web Application',
    'browser-extension': 'Browser Extension',
    other: 'Other'
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
      content:
        'Upon full payment, all intellectual property rights for deliverables transfer to the client.'
    },
    {
      title: 'Revisions',
      content:
        'Two rounds of revisions are included per deliverable. Additional revisions will be billed at the hourly rate.'
    },
    {
      title: 'Confidentiality',
      content:
        'Both parties agree to keep confidential information private and not disclose to third parties.'
    },
    {
      title: 'Cancellation',
      content:
        'Either party may cancel with 14 days written notice. Fees for completed work are non-refundable.'
    },
    {
      title: 'Liability',
      content:
        'Liability is limited to the total project value. Neither party is liable for indirect damages.'
    }
  ];
}
