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
      receiptNumber: 'RCP-2026-0001',
      invoiceNumber: 'INV-202603-000001',
      paymentDate: 'March 17, 2026',
      paymentMethod: 'Credit Card (Stripe)',
      paymentReference: 'ch_3PqR7x2eZvKYlo2C',
      amount: 4000,
      clientName: 'Emily Gold',
      clientEmail: 'offerings@hedgewitchhorticulture.com',
      clientCompany: 'Hedgewitch Horticulture LLC',
      clientPhone: '(508) 555-0123',
      clientAddress: '24 Crescent Heights\nFitchburg, MA 01420',
      projectName: 'Hedgewitch Horticulture — Business Website'
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
        const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
        const { drawPdfDocumentHeader, PAGE_MARGINS } = await import('../server/utils/pdf-utils.js');

        const pdfDoc = await PDFDocument.create();
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let page = pdfDoc.addPage([612, 792]);
        const { width, height } = page.getSize();
        let y = height - 43;

        y = await drawPdfDocumentHeader({
          page, pdfDoc,
          fonts: { regular: helvetica, bold: helveticaBold },
          startY: y,
          leftMargin: PAGE_MARGINS.left,
          rightMargin: width - PAGE_MARGINS.right,
          title: 'CONTRACT'
        });
        y -= 20;

        const plainContent = contractContent.replace(/<[^>]+>/g, '');
        const lines = plainContent.split('\n');
        for (const line of lines) {
          if (y < 60) {
            page = pdfDoc.addPage([612, 792]);
            y = page.getSize().height - 50;
          }
          if (line.trim()) {
            const text = line.trim().slice(0, 90);
            page.drawText(text, {
              x: PAGE_MARGINS.left, y,
              size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1)
            });
          }
          y -= 14;
        }

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

  // 6. Intake PDF (standalone with dummy data — uses pdf-lib directly)
  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const { drawPdfDocumentHeader, PAGE_MARGINS } = await import('../server/utils/pdf-utils.js');

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle('Client Intake — Hedgewitch Horticulture');
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const left = PAGE_MARGINS.left;
    const right = width - PAGE_MARGINS.right;
    let y = height - 43;

    y = await drawPdfDocumentHeader({
      page, pdfDoc,
      fonts: { regular: helvetica, bold: helveticaBold },
      startY: y, leftMargin: left, rightMargin: right,
      title: 'INTAKE'
    });
    y -= 20;

    // Helper to draw a field
    const drawField = (label: string, value: string) => {
      if (y < 70) {
        page = pdfDoc.addPage([612, 792]);
        y = page.getSize().height - 50;
      }
      page.drawText(label, { x: left, y, size: 9, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
      page.drawText(value, { x: left, y, size: 10, font: helvetica, color: rgb(0.1, 0.1, 0.1) });
      y -= 20;
    };

    const drawSection = (title: string) => {
      if (y < 100) {
        page = pdfDoc.addPage([612, 792]);
        y = page.getSize().height - 50;
      }
      y -= 10;
      page.drawLine({ start: { x: left, y: y + 5 }, end: { x: right, y: y + 5 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      page.drawText(title.toUpperCase(), { x: left, y: y - 10, size: 11, font: helveticaBold, color: rgb(0.15, 0.15, 0.15) });
      y -= 30;
    };

    // Client Info
    drawSection('Client Information');
    drawField('Name', 'Emily Gold & Abigail Wolf');
    drawField('Company', 'Hedgewitch Horticulture LLC');
    drawField('Email', 'offerings@hedgewitchhorticulture.com');
    drawField('Phone', '(508) 555-0123');

    // Project Details
    drawSection('Project Details');
    drawField('Project Type', 'Business Website');
    drawField('Budget', '$2,000 - $6,500 (with flexibility for May/June)');
    drawField('Timeline', '1 month (target launch March 1, 2026)');
    drawField('Current Website', 'hedgewitchhorticulture.com (Squarespace)');
    drawField('Description', 'Website redesign for sustainable garden design company. Currently on Squarespace but hitting template limitations. Want earthy/witchy aesthetic with custom animations.');

    // Design Preferences
    drawSection('Design Preferences');
    drawField('Design Level', 'Custom — unique to brand, handcrafted feel');
    drawField('Brand Assets', 'Logo (needs simplified variant for mobile), brand colors');
    drawField('Inspiration', 'Earthy/witchy aesthetic, NOT pristine/white/minimal. Want it to feel like nature.');
    drawField('Content Status', 'Have some content, need help organizing photos (in Google Cloud)');

    // Features
    drawSection('Desired Features');
    drawField('Features', 'Contact form, Blog, Photo gallery, Newsletter signup, Social media integration');
    drawField('Integrations', 'Google Analytics replacement (custom), Newsletter service');
    drawField('Pages Needed', '8-12 pages: Home, About, Services (Meadows, Edibles), Gallery, Resources, FAQ, Blog, Contact');

    // Technical
    drawSection('Technical Details');
    drawField('Tech Comfort', 'Comfortable — can handle basic updates with a guide');
    drawField('Hosting Preference', 'Free hosting (Netlify/Vercel) — no monthly platform fees');
    drawField('Constraints', 'Emily unavailable Feb 12-22. Abby works Mon/Tues only.');
    drawField('How Found Us', 'Referral from a friend');

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
