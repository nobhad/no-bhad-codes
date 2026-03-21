/**
 * Generate sample PDFs for review
 * Run: npx tsx scripts/generate-sample-pdfs.ts
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { generateReceiptPdf } from '../server/services/receipt-service.js';

const DESKTOP = '/Users/noellebhaduri/Desktop';

async function main() {
  console.log('Generating sample PDFs...\n');

  // 1. Receipt PDF (standalone — no DB needed)
  try {
    const pdfBytes = await generateReceiptPdf({
      receiptNumber: 'REC-202603-HH001',
      invoiceNumber: 'INV-202603-HH001',
      datePaid: 'March 8, 2026',
      dateGenerated: 'March 17, 2026',
      paymentMethod: 'Check',
      paymentReference: '1230',
      paymentLabel: 'Payment 1 of 3',
      amount: 1125,
      clientName: 'Emily Gold',
      clientEmail: 'offerings@hedgewitchhorticulture.com',
      clientCompany: 'Hedgewitch Horticulture LLC',
      clientPhone: '(508) 555-0123',
      clientAddress: '24 Crescent Heights\nFitchburg, MA 01420',
      projectName: 'Custom Website Development (Better Tier)',
      lineItems: [
        { description: 'Custom Website Development (Better Tier)', amount: 4000 },
        { description: 'Deposit Payment (40%)', amount: -2875 }
      ]
    });
    writeFileSync(join(DESKTOP, 'SAMPLE-receipt.pdf'), Buffer.from(pdfBytes));
    console.log('✓ Receipt PDF → ~/Desktop/SAMPLE-receipt.pdf');
  } catch (e) {
    console.error('✗ Receipt failed:', (e as Error).message);
  }

  // DB-dependent PDFs
  try {
    const { initializeDatabase, getDatabase } = await import('../server/database/init.js');
    await initializeDatabase();
    const db = getDatabase();

    const project = await db.get(
      'SELECT id, project_name FROM projects WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1'
    ) as { id: number; project_name: string } | undefined;

    if (!project) {
      console.log('⊘ No projects in database');
      process.exit(0);
    }
    console.log(`Using project: ${project.project_name} (ID: ${project.id})\n`);

    // 2. Project Report PDF
    try {
      const { fetchProjectReportData, generateProjectReportPdf } =
        await import('../server/services/project-report-service.js');
      const reportData = await fetchProjectReportData(project.id);
      if (reportData) {
        const pdfBytes = await generateProjectReportPdf(reportData);
        writeFileSync(join(DESKTOP, 'SAMPLE-project-report.pdf'), Buffer.from(pdfBytes));
        console.log('✓ Project Report PDF → ~/Desktop/SAMPLE-project-report.pdf');
      } else {
        console.log('⊘ No report data for this project');
      }
    } catch (e) {
      console.error('✗ Project Report failed:', (e as Error).message);
    }

    // 3. SOW PDF — use DB data or fall back to dummy
    try {
      const { fetchSowData, generateSowPdf } =
        await import('../server/services/sow-service.js');
      let sowData = await fetchSowData(project.id);
      if (!sowData) {
        // Dummy data for preview
        sowData = {
          project: {
            id: 7,
            name: 'Hedgewitch Horticulture — Business Website',
            projectType: 'business-site',
            description: 'Custom website redesign for sustainable garden design company. Migrating from Squarespace to a fully custom site with GSAP animations, CMS, blog, and custom analytics.',
            startDate: '2026-03-01',
            deadline: '2026-04-15'
          },
          client: {
            name: 'Emily Gold',
            email: 'offerings@hedgewitchhorticulture.com',
            company: 'Hedgewitch Horticulture LLC'
          },
          proposal: {
            id: 1,
            selectedTier: 'better',
            tierName: 'Custom',
            basePrice: 4000,
            finalPrice: 4000,
            maintenanceOption: 'essential',
            createdAt: '2026-02-15',
            features: [
              { name: 'Responsive Design', price: 0, isIncluded: true, isAddon: false },
              { name: 'Mobile Optimization', price: 0, isIncluded: true, isAddon: false },
              { name: 'Custom GSAP Scroll Animations', price: 0, isIncluded: true, isAddon: false },
              { name: 'Simple Content Management', price: 0, isIncluded: true, isAddon: false },
              { name: 'Blog with Scheduling & Categories', price: 0, isIncluded: true, isAddon: false },
              { name: 'Enhanced SEO (Schema Markup)', price: 0, isIncluded: true, isAddon: false },
              { name: 'Custom Analytics Dashboard', price: 0, isIncluded: true, isAddon: false },
              { name: 'Free Hosting (Netlify)', price: 0, isIncluded: true, isAddon: false },
              { name: 'Full Source Code Ownership', price: 0, isIncluded: true, isAddon: false },
              { name: '30-Day Post-Launch Support', price: 0, isIncluded: true, isAddon: false }
            ]
          },
          milestones: [
            { title: 'Discovery & Planning', description: 'Requirements gathering, content strategy, SEO keyword research', dueDate: '2026-03-08' },
            { title: 'Design', description: 'Custom design with brand integration and design revisions', dueDate: '2026-03-18' },
            { title: 'Development', description: 'Full build with GSAP animations, CMS, blog, and integrations', dueDate: '2026-04-01' },
            { title: 'Content & SEO', description: 'Content population, SEO optimization, analytics setup', dueDate: '2026-04-08' },
            { title: 'Testing & Launch', description: 'QA testing, client training, and production deployment', dueDate: '2026-04-15' }
          ]
        };
      }
      const pdfBytes = await generateSowPdf(sowData);
      writeFileSync(join(DESKTOP, 'SAMPLE-sow.pdf'), Buffer.from(pdfBytes));
      console.log('✓ SOW PDF → ~/Desktop/SAMPLE-sow.pdf');
    } catch (e) {
      console.error('✗ SOW failed:', (e as Error).message);
    }

    // 4. Invoice PDF
    try {
      const { invoiceService } = await import('../server/services/invoice-service.js');
      const { generateInvoicePdf } = await import('../server/routes/invoices/pdf.js');

      const invoiceRow = await db.get(
        'SELECT id FROM invoices WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1'
      ) as { id: number } | undefined;

      if (invoiceRow) {
        const inv = await invoiceService.getInvoiceById(invoiceRow.id);
        if (inv) {
          const lineItems = inv.lineItems || await invoiceService.getLineItems(invoiceRow.id);
          const pdfBytes = await generateInvoicePdf({
            invoiceNumber: inv.invoiceNumber || 'INV-SAMPLE',
            issuedDate: inv.issueDate || new Date().toISOString().split('T')[0],
            dueDate: inv.dueDate || undefined,
            clientName: inv.clientName || 'Client',
            clientEmail: inv.clientEmail || '',
            clientCompany: inv.clientCompany || undefined,
            lineItems: (lineItems || []).map((li: { description?: string; quantity?: number; unitPrice?: number; amount?: number }) => ({
              description: li.description || '',
              quantity: li.quantity || 1,
              rate: li.unitPrice || 0,
              amount: li.amount || 0
            })),
            subtotal: inv.subtotal || inv.amount || 0,
            total: inv.amount || 0,
            notes: inv.notes || undefined
          });
          writeFileSync(join(DESKTOP, 'SAMPLE-invoice.pdf'), Buffer.from(pdfBytes));
          console.log('✓ Invoice PDF → ~/Desktop/SAMPLE-invoice.pdf');
        }
      } else {
        console.log('⊘ No invoices in database');
      }
    } catch (e) {
      console.error('✗ Invoice failed:', (e as Error).message);
    }

    // 5. Contract PDF — use DB data or fall back to dummy
    try {
      let contractContent: string;
      let contractProject = 'Hedgewitch Horticulture — Business Website';
      let contractClient = 'Emily Gold';

      const contractRow = await db.get(
        `SELECT c.id, c.content, p.project_name,
                COALESCE(cl.billing_name, cl.contact_name) as client_name,
                COALESCE(cl.billing_company, cl.company_name) as company_name
         FROM contracts c
         LEFT JOIN projects p ON c.project_id = p.id
         LEFT JOIN clients cl ON c.client_id = cl.id
         WHERE c.deleted_at IS NULL AND c.content IS NOT NULL
         ORDER BY c.id DESC LIMIT 1`
      ) as Record<string, unknown> | undefined;

      if (contractRow?.content) {
        contractContent = String(contractRow.content);
        contractProject = String(contractRow.project_name || contractProject);
        contractClient = String(contractRow.client_name || contractClient);
      } else {
        // Dummy contract content for preview
        contractContent = `WEB DEVELOPMENT AGREEMENT

This Agreement is entered into as of March 1, 2026 between:

No Bhad Codes ("Developer")
Noelle Bhaduri
nobhaduri@gmail.com
nobhad.codes

AND

Hedgewitch Horticulture LLC ("Client")
Emily Gold & Abigail Wolf
offerings@hedgewitchhorticulture.com
24 Crescent Heights, Fitchburg, MA 01420


1. SCOPE OF WORK

Developer agrees to design and develop a custom business website for Client, including:
- Fully custom responsive design (no templates)
- Custom GSAP scroll animations
- Simple content management system
- Blog with scheduling, categories, and tags
- Enhanced SEO with schema markup
- Custom analytics dashboard
- Free hosting setup (Netlify)

Project Type: Business Website (Better Tier)
Timeline: 4-5 weeks from project start


2. COMPENSATION

Total Project Fee: $4,000.00

Payment Schedule:
- Deposit (40%): $1,600.00 due upon signing
- Midpoint (30%): $1,200.00 due at design approval
- Final (30%): $1,200.00 due at project launch

Optional Maintenance: $50/month or $500/year (Essential Care)


3. TIMELINE

Project Start: March 1, 2026
Estimated Completion: April 15, 2026

Milestones:
- Discovery & Planning: March 8, 2026
- Design: March 18, 2026
- Development: April 1, 2026
- Content & SEO: April 8, 2026
- Testing & Launch: April 15, 2026


4. DELIVERABLES

Upon completion, Client will receive:
- Custom responsive website (5-8 pages)
- Full source code ownership
- User guide document
- 45-minute training session
- 30-day post-launch bug fix support


5. REVISIONS

This agreement includes 1 round of design revisions. Additional revision rounds are available at $75/hour.


6. INTELLECTUAL PROPERTY

Upon full payment, Client receives complete ownership of all custom code, design assets, and content created for this project. Developer retains the right to display the work in their portfolio.


7. CONFIDENTIALITY

Both parties agree to keep confidential any proprietary information shared during the project.


8. TERMINATION

Either party may terminate this agreement with 14 days written notice. Client is responsible for payment of all work completed up to the termination date.


9. LIMITATION OF LIABILITY

Developer's total liability under this agreement shall not exceed the total project fee of $4,000.00.


10. ACCEPTANCE

By signing below, both parties agree to the terms outlined in this agreement.



_______________________________          _______________________________
Emily Gold                                Noelle Bhaduri
Hedgewitch Horticulture LLC               No Bhad Codes
Date: _______________                     Date: _______________`;
      }

      {
        const { PDFDocument } = await import('pdf-lib');
        const {
          drawPdfDocumentHeader, drawTwoColumnInfo, drawPdfFooter,
          drawWrappedText, drawSectionLabel, ensureSpace, addPageNumbers, PAGE_MARGINS,
          getRegularFontBytes, getBoldFontBytes, registerFontkit
        } = await import('../server/utils/pdf-utils.js');
        const { PDF_COLORS, PDF_TYPOGRAPHY, PDF_SPACING } = await import('../server/config/pdf-styles.js');

        const pdfDoc = await PDFDocument.create();
        registerFontkit(pdfDoc);
        const helvetica = await pdfDoc.embedFont(getRegularFontBytes());
        const helveticaBold = await pdfDoc.embedFont(getBoldFontBytes());
        const fonts = { regular: helvetica, bold: helveticaBold };

        const page = pdfDoc.addPage([612, 792]);
        const { width, height } = page.getSize();
        const leftMargin = PAGE_MARGINS.left;
        const rightMargin = width - PAGE_MARGINS.right;
        const contentWidth = rightMargin - leftMargin;

        const ctx = {
          pdfDoc, currentPage: page, pageNumber: 1,
          y: height - 43, width: 612, height: 792,
          leftMargin, rightMargin,
          topMargin: PAGE_MARGINS.top, bottomMargin: PAGE_MARGINS.bottom,
          contentWidth, fonts
        };

        const onNewPage = (nextCtx: typeof ctx) => { nextCtx.y = nextCtx.height - nextCtx.topMargin - 20; };

        // Header
        ctx.y = await drawPdfDocumentHeader({
          page, pdfDoc, fonts, startY: ctx.y, leftMargin, rightMargin, title: 'CONTRACT'
        });

        // Bill To two-column info
        ctx.y = drawTwoColumnInfo(page, {
          leftMargin, rightMargin, width: 612, y: ctx.y, fonts,
          left: {
            label: 'BILL TO:',
            lines: [
              { text: 'Hedgewitch Horticulture LLC', bold: true },
              { text: 'Emily Gold & Abigail Wolf' },
              { text: 'offerings@hedgewitchhorticulture.com' },
              { text: '24 Crescent Heights, Fitchburg, MA 01420' }
            ]
          },
          right: {
            pairs: [
              { label: 'DATE:', value: 'March 1, 2026' },
              { label: 'PACKAGE:', value: 'Better' },
              { label: 'TOTAL:', value: '$4,000.00' },
              { label: 'START:', value: 'March 1, 2026' },
              { label: 'LAUNCH:', value: 'April 15, 2026' }
            ]
          }
        });

        // HR separating detail section from content (no table header follows)
        ctx.currentPage.drawLine({
          start: { x: leftMargin, y: ctx.y + 10 },
          end: { x: rightMargin, y: ctx.y + 10 },
          thickness: PDF_SPACING.underlineThickness,
          color: PDF_COLORS.black
        });

        // === PARTIES — three columns: Developer | AND | Client ===
        const partiesY = ctx.y;
        const colWidth = (contentWidth - 40) / 2; // two equal columns with 40px AND column
        const andX = leftMargin + colWidth;
        const clientX = leftMargin + colWidth + 40;
        const bodySize = PDF_TYPOGRAPHY.bodySize;
        const lh = PDF_SPACING.lineHeight;

        // Intro line
        ctx.currentPage.drawText('This Agreement is entered into as of March 1, 2026 between:', {
          x: leftMargin, y: ctx.y, size: bodySize, font: helvetica, color: PDF_COLORS.black
        });
        ctx.y -= lh * 2;

        // Developer column (left)
        const devLines = [
          { text: 'No Bhad Codes ("Developer")', bold: true },
          { text: 'Noelle Bhaduri', bold: false },
          { text: 'nobhaduri@gmail.com', bold: false },
          { text: 'nobhad.codes', bold: false }
        ];
        let devY = ctx.y;
        for (const line of devLines) {
          ctx.currentPage.drawText(line.text, {
            x: leftMargin, y: devY, size: bodySize,
            font: line.bold ? helveticaBold : helvetica, color: PDF_COLORS.black
          });
          devY -= lh;
        }

        // AND column (center)
        const andY = ctx.y - lh; // vertically centered-ish
        ctx.currentPage.drawText('AND', {
          x: andX + 8, y: andY, size: bodySize, font: helveticaBold, color: PDF_COLORS.black
        });

        // Client column (right)
        const clientLines = [
          { text: 'Hedgewitch Horticulture LLC ("Client")', bold: true },
          { text: 'Emily Gold & Abigail Wolf', bold: false },
          { text: 'offerings@hedgewitchhorticulture.com', bold: false },
          { text: '24 Crescent Heights, Fitchburg, MA 01420', bold: false }
        ];
        let cliY = ctx.y;
        for (const line of clientLines) {
          ctx.currentPage.drawText(line.text, {
            x: clientX, y: cliY, size: bodySize,
            font: line.bold ? helveticaBold : helvetica, color: PDF_COLORS.black
          });
          cliY -= lh;
        }

        ctx.y = Math.min(devY, cliY) - lh;

        // Contract content body — skip the parties block (already rendered above)
        const plainContent = contractContent.replace(/<[^>]+>/g, '');
        const allLines = plainContent.split('\n');
        // Find where "1. SCOPE OF WORK" starts and render from there
        const scopeIndex = allLines.findIndex(l => l.trim().startsWith('1. SCOPE'));
        const contentLines = scopeIndex >= 0 ? allLines.slice(scopeIndex) : allLines;

        for (const rawLine of contentLines) {
          const trimmed = rawLine.trim();
          if (!trimmed) { ctx.y -= 10; continue; }

          let text = trimmed;
          let font = helvetica;
          let fontSize: number = PDF_TYPOGRAPHY.bodySize;
          const BULLET_INDENT = 12;
          let indent = 0;

          if (/^[-*]\s+/.test(text)) { indent = BULLET_INDENT; text = text.replace(/^[-*]\s+/, ''); }
          const isTitle = /^[A-Z][A-Z\s]{3,}$/.test(text);
          const isSection = /^\d+\.\s+/.test(text);
          if (isTitle) { font = helveticaBold; fontSize = 14; }
          else if (isSection) { font = helveticaBold; fontSize = 12; }

          drawWrappedText(ctx, text, { x: leftMargin + indent, fontSize, font, maxWidth: contentWidth - indent, onNewPage });
          ctx.y -= isTitle || isSection ? 6 : 2;
        }

        // Signatures
        ctx.y -= PDF_SPACING.sectionSpacing;
        ensureSpace(ctx, 120, onNewPage);
        ctx.y = drawSectionLabel(ctx.currentPage, 'SIGNATURES', { x: leftMargin, y: ctx.y, font: helveticaBold });

        const sigLineY = ctx.y - 30;
        const sigWidth = 200;
        const rightCol = 612 / 2 + PDF_SPACING.rightColumnOffset;

        ctx.currentPage.drawText('CLIENT:', { x: leftMargin, y: ctx.y, size: PDF_TYPOGRAPHY.bodySize, font: helveticaBold, color: PDF_COLORS.black });
        ctx.currentPage.drawLine({ start: { x: leftMargin, y: sigLineY }, end: { x: leftMargin + sigWidth, y: sigLineY }, thickness: PDF_SPACING.dividerThickness, color: PDF_COLORS.black });
        ctx.currentPage.drawText('Emily Gold', { x: leftMargin, y: sigLineY - 15, size: PDF_TYPOGRAPHY.bodySize, font: helvetica, color: PDF_COLORS.black });
        ctx.currentPage.drawText('Date: _______________', { x: leftMargin, y: sigLineY - 30, size: PDF_TYPOGRAPHY.bodySize, font: helvetica, color: PDF_COLORS.black });

        ctx.currentPage.drawText('SERVICE PROVIDER:', { x: rightCol, y: ctx.y, size: PDF_TYPOGRAPHY.bodySize, font: helveticaBold, color: PDF_COLORS.black });
        ctx.currentPage.drawLine({ start: { x: rightCol, y: sigLineY }, end: { x: rightCol + sigWidth, y: sigLineY }, thickness: PDF_SPACING.dividerThickness, color: PDF_COLORS.black });
        ctx.currentPage.drawText('Noelle Bhaduri', { x: rightCol, y: sigLineY - 15, size: PDF_TYPOGRAPHY.bodySize, font: helvetica, color: PDF_COLORS.black });
        ctx.currentPage.drawText('Date: _______________', { x: rightCol, y: sigLineY - 30, size: PDF_TYPOGRAPHY.bodySize, font: helvetica, color: PDF_COLORS.black });

        // Footer + page numbers
        for (const footerPage of pdfDoc.getPages()) {
          drawPdfFooter(footerPage, { leftMargin, rightMargin, width: 612, fonts, thankYouText: 'Thank you for your business!' });
        }
        await addPageNumbers(pdfDoc);

        const pdfBytes = await pdfDoc.save();
        writeFileSync(join(DESKTOP, 'SAMPLE-contract.pdf'), Buffer.from(pdfBytes));
        console.log('✓ Contract PDF → ~/Desktop/SAMPLE-contract.pdf');
      }
    } catch (e) {
      console.error('✗ Contract failed:', (e as Error).message);
    }

  } catch (e) {
    console.error('✗ DB init failed:', (e as Error).message);
  }

  // 6. Intake PDF (standalone with dummy data — uses shared layout helpers)
  try {
    const { PDFDocument } = await import('pdf-lib');
    const {
      drawPdfDocumentHeader, drawTwoColumnInfo, drawSectionLabel,
      drawLabelValue, drawPdfFooter, addPageNumbers, PAGE_MARGINS,
      getRegularFontBytes: getRegular, getBoldFontBytes: getBold,
      registerFontkit: regFontkit
    } = await import('../server/utils/pdf-utils.js');
    const { PDF_COLORS, PDF_TYPOGRAPHY, PDF_SPACING } = await import('../server/config/pdf-styles.js');

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle('Client Intake — Hedgewitch Horticulture');
    regFontkit(pdfDoc);
    const helvetica = await pdfDoc.embedFont(getRegular());
    const helveticaBold = await pdfDoc.embedFont(getBold());
    const fonts = { regular: helvetica, bold: helveticaBold };

    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const left = PAGE_MARGINS.left;
    const right = width - PAGE_MARGINS.right;
    const labelWidth = 120;
    let y = height - 43;

    // Header
    y = await drawPdfDocumentHeader({
      page, pdfDoc, fonts, startY: y, leftMargin: left, rightMargin: right, title: 'INTAKE'
    });

    // Two-column info
    y = drawTwoColumnInfo(page, {
      leftMargin: left, rightMargin: right, width: 612, y, fonts,
      left: {
        label: 'PREPARED FOR:',
        lines: [
          { text: 'Hedgewitch Horticulture LLC', bold: true },
          { text: 'Emily Gold & Abigail Wolf' },
          { text: 'offerings@hedgewitchhorticulture.com' },
          { text: '(508) 555-0123' }
        ]
      },
      right: {
        pairs: [
          { label: 'PROJECT TYPE:', value: 'Business Website' },
          { label: 'BUDGET:', value: '$2,000 - $6,500' },
          { label: 'TIMELINE:', value: '1 Month' },
          { label: 'DATE:', value: 'March 17, 2026' }
        ]
      }
    });

    // HR separating detail section from content (no table header follows)
    page.drawLine({
      start: { x: left, y: y + 10 },
      end: { x: right, y: y + 10 },
      thickness: PDF_SPACING.underlineThickness,
      color: PDF_COLORS.black
    });

    // Project Details
    y -= PDF_SPACING.sectionSpacing;
    y = drawSectionLabel(page, 'PROJECT DETAILS', { x: left, y, font: helveticaBold });
    y = drawLabelValue(page, 'PROJECT NAME:', 'Hedgewitch Horticulture Website', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    y = drawLabelValue(page, 'CURRENT SITE:', 'hedgewitchhorticulture.com (Squarespace)', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    y = drawLabelValue(page, 'TARGET AUDIENCE:', 'Homeowners, garden enthusiasts', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    y = drawLabelValue(page, 'DESCRIPTION:', '', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    const descText = 'Website redesign for sustainable garden design company. Currently on Squarespace but hitting template limitations. Want earthy/witchy aesthetic with custom animations.';
    const descWords = descText.split(' ');
    let descLine = '';
    for (const word of descWords) {
      const test = descLine + (descLine ? ' ' : '') + word;
      if (helvetica.widthOfTextAtSize(test, PDF_TYPOGRAPHY.bodySize) > right - left && descLine) {
        page.drawText(descLine, { x: left, y, size: PDF_TYPOGRAPHY.bodySize, font: helvetica, color: PDF_COLORS.black });
        y -= PDF_SPACING.lineHeight;
        descLine = word;
      } else { descLine = test; }
    }
    if (descLine) { page.drawText(descLine, { x: left, y, size: PDF_TYPOGRAPHY.bodySize, font: helvetica, color: PDF_COLORS.black }); y -= PDF_SPACING.lineHeight; }

    // Design Preferences
    y -= PDF_SPACING.sectionSpacing;
    y = drawSectionLabel(page, 'DESIGN PREFERENCES', { x: left, y, font: helveticaBold });
    y = drawLabelValue(page, 'DESIGN LEVEL:', 'Custom — unique to brand, handcrafted feel', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    y = drawLabelValue(page, 'BRAND ASSETS:', 'Logo, brand colors', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    y = drawLabelValue(page, 'INSPIRATION:', 'Earthy/witchy aesthetic, nature feel', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    y = drawLabelValue(page, 'CONTENT STATUS:', 'Have some content, need help organizing', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });

    // Technical Details
    y -= PDF_SPACING.sectionSpacing;
    y = drawSectionLabel(page, 'TECHNICAL DETAILS', { x: left, y, font: helveticaBold });
    y = drawLabelValue(page, 'TECH COMFORT:', 'Comfortable — can handle basic updates', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    y = drawLabelValue(page, 'HOSTING:', 'Free hosting (Netlify/Vercel)', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    y = drawLabelValue(page, 'CONSTRAINTS:', 'Emily unavailable Feb 12-22', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });
    y = drawLabelValue(page, 'HOW FOUND US:', 'Referral from a friend', { x: left, y, labelFont: helveticaBold, valueFont: helvetica, labelWidth });

    // Footer + page numbers
    drawPdfFooter(page, { leftMargin: left, rightMargin: right, width: 612, fonts, thankYouText: 'Thank you for your business!' });
    await addPageNumbers(pdfDoc);

    const pdfBytes = await pdfDoc.save();
    writeFileSync(join(DESKTOP, 'SAMPLE-intake.pdf'), Buffer.from(pdfBytes));
    console.log('✓ Intake PDF → ~/Desktop/SAMPLE-intake.pdf');
  } catch (e) {
    console.error('✗ Intake failed:', (e as Error).message);
  }

  console.log('\nDone!');
  process.exit(0);
}

main();
