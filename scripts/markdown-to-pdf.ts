/**
 * Markdown to Branded PDF Converter (using pdf-lib)
 *
 * Converts markdown proposals/documents to PDFs with branded header
 * Uses pdf-lib for better form field performance
 *
 * Usage: npx ts-node scripts/markdown-to-pdf.ts <input.md> [output.pdf]
 */

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Business info - matches server/config/business.ts defaults
const BUSINESS_INFO = {
  name: process.env.BUSINESS_NAME || 'No Bhad Codes',
  owner: process.env.BUSINESS_OWNER || 'Noelle Bhaduri',
  contact: process.env.BUSINESS_CONTACT || 'Noelle Bhaduri',
  tagline: process.env.BUSINESS_TAGLINE || 'Web Development & Design',
  email: process.env.BUSINESS_EMAIL || 'nobhaduri@gmail.com',
  website: process.env.BUSINESS_WEBSITE || 'nobhad.codes'
};

// Page settings
const PAGE_WIDTH = 612; // Letter size
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 45; // Slightly smaller margins
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2);

// Font sizes
const FONT_SIZE_H1 = 18;
const FONT_SIZE_H2 = 14;
const FONT_SIZE_H3 = 11;
const FONT_SIZE_H4 = 10;
const FONT_SIZE_BODY = 9;
const FONT_SIZE_SMALL = 8;

// Line heights - very tight spacing
const LINE_HEIGHT = 11;
const LINE_HEIGHT_SMALL = 9;

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/🌱/g, '[SPROUT]')
    .replace(/✓/g, '[CHECK]')
    .replace(/✔/g, '[CHECK]')
    .replace(/[^\x00-\x7F\[\]A-Z]/g, (char) => ''); // Remove remaining non-ASCII except brackets and uppercase for markers
}

function isCheckmark(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === '✓' || trimmed === '✔' || trimmed === '[CHECK]';
}

async function convertMarkdownToPdf(inputPath: string, outputPath: string): Promise<void> {
  console.log(`Converting: ${inputPath}`);
  console.log(`Output: ${outputPath}`);

  const markdown = readFileSync(inputPath, 'utf-8');
  const lines = markdown.split('\n');

  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const form = pdfDoc.getForm();

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const zapfDingbats = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);

  // Add first page
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - PAGE_MARGIN;

  // Track state
  let inTable = false;
  let tableData: string[][] = [];
  let checkboxCount = 0;
  let textFieldCount = 0;

  // Helper to add new page
  const addNewPage = (): PDFPage => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - PAGE_MARGIN;
    return page;
  };

  // Helper to check/add new page - DISABLED: only break at explicit <!-- pagebreak -->
  const checkPageBreak = (_neededSpace: number = 40): boolean => {
    // Don't auto-break - only break at explicit <!-- pagebreak --> markers
    return false;
  };

  // Helper to draw text
  const drawText = (text: string, x: number, yPos: number, options: {
    font?: PDFFont;
    size?: number;
    color?: { r: number; g: number; b: number };
    maxWidth?: number;
  } = {}) => {
    const font = options.font || helvetica;
    const size = options.size || FONT_SIZE_BODY;
    const color = options.color || { r: 0, g: 0, b: 0 };

    page.drawText(text, {
      x,
      y: yPos,
      size,
      font,
      color: rgb(color.r, color.g, color.b),
      maxWidth: options.maxWidth
    });
  };

  // Helper to render table
  const renderTable = () => {
    if (tableData.length === 0) return;

    const numCols = tableData[0].length;
    const colWidth = CONTENT_WIDTH / numCols;
    const rowHeight = 18;
    const tableHeight = tableData.length * rowHeight;

    // Check if table fits
    if (y - tableHeight < PAGE_MARGIN + 20) {
      addNewPage();
    }

    const startX = PAGE_MARGIN;
    const startY = y;

    // Draw cells
    tableData.forEach((row, rowIndex) => {
      const rowY = startY - (rowIndex * rowHeight);

      row.forEach((cell, colIndex) => {
        const cellX = startX + (colIndex * colWidth);
        const cellContent = stripMarkdownFormatting(cell);

        // Header row background
        if (rowIndex === 0) {
          page.drawRectangle({
            x: cellX,
            y: rowY - rowHeight,
            width: colWidth,
            height: rowHeight,
            color: rgb(0.94, 0.94, 0.94),
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5
          });
        } else {
          page.drawRectangle({
            x: cellX,
            y: rowY - rowHeight,
            width: colWidth,
            height: rowHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5
          });
        }

        // Cell text - draw checkmark for check cells, center dashes
        if (isCheckmark(cell)) {
          // Draw a checkmark using lines
          const centerX = cellX + colWidth / 2;
          const centerY = rowY - rowHeight / 2;
          page.drawLine({
            start: { x: centerX - 4, y: centerY },
            end: { x: centerX - 1, y: centerY - 3 },
            thickness: 1.5,
            color: rgb(0, 0, 0)
          });
          page.drawLine({
            start: { x: centerX - 1, y: centerY - 3 },
            end: { x: centerX + 5, y: centerY + 4 },
            thickness: 1.5,
            color: rgb(0, 0, 0)
          });
        } else if (cellContent.trim() === '-' || cellContent.trim() === '') {
          // Center dash or empty cell
          if (cellContent.trim() === '-') {
            const dashWidth = helvetica.widthOfTextAtSize('-', FONT_SIZE_SMALL);
            drawText('-', cellX + (colWidth - dashWidth) / 2, rowY - rowHeight + 5, {
              font: helvetica,
              size: FONT_SIZE_SMALL
            });
          }
        } else if (cellContent.includes('[SPROUT]') && sproutImage) {
          // Handle sprout emoji in table cells
          const centerX = cellX + colWidth / 2;
          const centerY = rowY - rowHeight / 2;
          page.drawImage(sproutImage, {
            x: centerX - 6,
            y: centerY - 6,
            width: 12,
            height: 12
          });
        } else {
          // Center content in columns 1+ (GOOD/BETTER/BEST columns), left-align first column
          const font = rowIndex === 0 ? helveticaBold : helvetica;
          const displayText = cellContent.substring(0, 30);
          if (colIndex > 0) {
            // Center the text
            const textWidth = font.widthOfTextAtSize(displayText, FONT_SIZE_SMALL);
            drawText(displayText, cellX + (colWidth - textWidth) / 2, rowY - rowHeight + 5, {
              font,
              size: FONT_SIZE_SMALL
            });
          } else {
            // Left align first column
            drawText(displayText, cellX + 4, rowY - rowHeight + 5, {
              font,
              size: FONT_SIZE_SMALL
            });
          }
        }
      });
    });

    y = startY - tableHeight - 12; // Padding below tables
    tableData = [];
    inTable = false;
  };

  // === LOAD SPROUT IMAGE ===
  const sproutPath = join(process.cwd(), 'public/images/sprout.png');
  let sproutImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (existsSync(sproutPath)) {
    const sproutBytes = readFileSync(sproutPath);
    sproutImage = await pdfDoc.embedPng(sproutBytes);
  }

  // Helper to draw text with sprout support
  const drawTextWithSprout = (text: string, x: number, yPos: number, options: {
    font?: PDFFont;
    size?: number;
  } = {}) => {
    const font = options.font || helvetica;
    const size = options.size || FONT_SIZE_BODY;

    if (text.includes('[SPROUT]') && sproutImage) {
      const parts = text.split('[SPROUT]');
      let currentX = x;
      parts.forEach((part, i) => {
        if (part) {
          page.drawText(part, { x: currentX, y: yPos, size, font, color: rgb(0, 0, 0) });
          currentX += font.widthOfTextAtSize(part, size);
        }
        if (i < parts.length - 1) {
          page.drawImage(sproutImage!, { x: currentX, y: yPos - 2, width: 12, height: 12 });
          currentX += 14;
        }
      });
    } else {
      page.drawText(text.replace('[SPROUT]', ''), { x, y: yPos, size, font, color: rgb(0, 0, 0) });
    }
  };

  // === HEADER WITH LOGO ===
  const logoPaths = [
    join(process.cwd(), 'public/images/avatar_pdf.png'),
    join(process.cwd(), 'public/images/pdf-header-logo.png'),
    join(process.cwd(), 'public/images/avatar_small-1.png')
  ];

  let logoPath = '';
  for (const p of logoPaths) {
    if (existsSync(p)) {
      logoPath = p;
      break;
    }
  }

  if (logoPath) {
    const logoBytes = readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoWidth = 50;
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
    const logoX = (PAGE_WIDTH - logoWidth) / 2;

    page.drawImage(logoImage, {
      x: logoX,
      y: PAGE_HEIGHT - 35 - logoHeight,
      width: logoWidth,
      height: logoHeight
    });
  }

  // Business header
  y = PAGE_HEIGHT - 100;
  const headerText = `${BUSINESS_INFO.name}`;
  const headerWidth = helveticaBold.widthOfTextAtSize(headerText, FONT_SIZE_BODY);
  drawText(headerText, (PAGE_WIDTH - headerWidth) / 2, y, { font: helveticaBold, size: FONT_SIZE_BODY });

  y -= LINE_HEIGHT;
  const subHeaderText = `${BUSINESS_INFO.contact} | ${BUSINESS_INFO.email} | ${BUSINESS_INFO.website}`;
  const subHeaderWidth = helvetica.widthOfTextAtSize(subHeaderText, FONT_SIZE_SMALL);
  drawText(subHeaderText, (PAGE_WIDTH - subHeaderWidth) / 2, y, { size: FONT_SIZE_SMALL });

  y -= 25;

  // Process lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (trimmed === '') {
      if (inTable) renderTable();
      y -= 2; // Minimal empty line spacing
      continue;
    }

    // Page break comment
    if (trimmed === '<!-- pagebreak -->') {
      if (inTable) renderTable();
      addNewPage();
      continue;
    }

    // Horizontal rule - spacing between sections
    if (trimmed === '---') {
      if (inTable) renderTable();
      y -= 12; // Spacing for section separation
      continue;
    }

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) {
        continue;
      }
      inTable = true;
      tableData.push(cells);
      continue;
    }

    // Render table if we hit non-table content
    if (inTable) {
      renderTable();
    }

    // H1
    if (trimmed.startsWith('# ')) {
      checkPageBreak(30);
      y -= 10;
      const text = stripMarkdownFormatting(trimmed.slice(2));
      const textWidth = helveticaBold.widthOfTextAtSize(text, FONT_SIZE_H1);
      drawText(text, (PAGE_WIDTH - textWidth) / 2, y, { font: helveticaBold, size: FONT_SIZE_H1 });
      y -= FONT_SIZE_H1 + 6;
      continue;
    }

    // H2
    if (trimmed.startsWith('## ')) {
      checkPageBreak(28);
      y -= 14; // More space above
      const text = stripMarkdownFormatting(trimmed.slice(3));
      drawText(text, PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_H2 });
      y -= FONT_SIZE_H2 + 2; // Less space below
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      checkPageBreak(25);
      y -= 12; // More space above H3
      const text = stripMarkdownFormatting(trimmed.slice(4));
      drawText(text, PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_H3 });
      y -= FONT_SIZE_H3; // Minimal space below
      continue;
    }

    // H4
    if (trimmed.startsWith('#### ')) {
      checkPageBreak(22);
      const text = stripMarkdownFormatting(trimmed.slice(5));
      // More padding for special headings
      if (text.toLowerCase().startsWith('everything in') || text.toLowerCase().includes("what's included")) {
        y -= 12;
      } else {
        y -= 2; // Very tight subsection spacing
      }
      drawText(text, PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_H4 });
      y -= FONT_SIZE_H4; // Minimal space below
      continue;
    }

    // Checkbox
    if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ') || trimmed.startsWith('- [ ] ')) {
      checkPageBreak(14);
      const checked = trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ');
      const content = stripMarkdownFormatting(trimmed.slice(6));

      // Create checkbox form field
      checkboxCount++;
      const checkbox = form.createCheckBox(`checkbox_${checkboxCount}`);
      checkbox.addToPage(page, {
        x: PAGE_MARGIN + 12,
        y: y - 9,
        width: 9,
        height: 9,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),
        backgroundColor: rgb(1, 1, 1)
      });

      if (checked) {
        checkbox.check();
      }

      // Label text
      drawText(content, PAGE_MARGIN + 26, y - 7, { size: FONT_SIZE_BODY });

      y -= 14; // Tighter checkbox spacing
      continue;
    }

    // Signature line pattern: **Signature:** ____
    const signatureLineMatch = trimmed.match(/^\*\*(Client\s+)?Signature:\*\*\s*_{4,}$/i);
    if (signatureLineMatch) {
      checkPageBreak(25);
      y -= 12; // Space above signature line
      drawText('Signature:', PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_BODY });

      // Draw line aligned with fields - bottom of line at text baseline
      const lineStartX = PAGE_MARGIN + 80;
      const lineEndX = PAGE_MARGIN + 280;
      page.drawLine({
        start: { x: lineStartX, y: y - 2 },
        end: { x: lineEndX, y: y - 2 },
        thickness: 0.5,
        color: rgb(0, 0, 0)
      });

      y -= 28; // More spacing in signature section
      continue;
    }

    // Editable field pattern: **Printed Name:** ____ or **Date:** ____
    const editableFieldMatch = trimmed.match(/^\*\*(Printed Name|Date):\*\*\s*_{4,}$/i);
    if (editableFieldMatch) {
      checkPageBreak(25);
      const label = editableFieldMatch[1];
      drawText(`${label}:`, PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_BODY });

      // Draw underline to look like a line
      const fieldStartX = PAGE_MARGIN + 80;
      const fieldWidth = label.toLowerCase() === 'date' ? 100 : 200;
      page.drawLine({
        start: { x: fieldStartX, y: y - 2 },
        end: { x: fieldStartX + fieldWidth, y: y - 2 },
        thickness: 0.5,
        color: rgb(0, 0, 0)
      });

      // Create invisible text field over the line (no border, no background)
      textFieldCount++;
      const fieldHeight = 14;
      const textField = form.createTextField(`field_${textFieldCount}`);
      textField.addToPage(page, {
        x: fieldStartX,
        y: y - 4,
        width: fieldWidth,
        height: fieldHeight,
        borderWidth: 0
      });

      y -= 28; // More spacing in signature section
      continue;
    }

    // Standalone bold text (section name without colon): **Decisions**
    const standaloneBoldMatch = trimmed.match(/^\*\*([^*:]+)\*\*$/);
    if (standaloneBoldMatch) {
      checkPageBreak(20);
      y -= 14; // More space above section name
      const text = standaloneBoldMatch[1];
      drawText(text, PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_H4 });
      y -= FONT_SIZE_H4 + 2; // Less space below
      continue;
    }

    // Bold label pattern: **Label:** value
    const boldLabelMatch = trimmed.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
    if (boldLabelMatch) {
      checkPageBreak(15);
      const label = boldLabelMatch[1];
      const value = boldLabelMatch[2];

      // More space for labels without values (section headers), tight for labels with values
      // Special cases that need more space
      if (label.toLowerCase().startsWith('domain')) {
        y -= 16; // More space above Domain/Email
      } else if (label.toLowerCase().startsWith('timeline')) {
        y -= 12; // More space above Timeline
      } else if (value) {
        y -= 2; // Tight spacing for consecutive label: value pairs
      } else {
        y -= 16; // More space above section labels
      }

      drawText(`${label}:`, PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_BODY });
      if (value) {
        const labelWidth = helveticaBold.widthOfTextAtSize(`${label}: `, FONT_SIZE_BODY);
        const strippedValue = stripMarkdownFormatting(value);
        const availableWidth = CONTENT_WIDTH - labelWidth;

        // Word wrap long values
        const words = strippedValue.split(' ');
        let currentLine = '';
        let firstLine = true;

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = helvetica.widthOfTextAtSize(testLine, FONT_SIZE_BODY);

          if (testWidth > availableWidth && currentLine) {
            if (firstLine) {
              drawText(currentLine, PAGE_MARGIN + labelWidth, y, { size: FONT_SIZE_BODY });
              firstLine = false;
            } else {
              drawText(currentLine, PAGE_MARGIN, y, { size: FONT_SIZE_BODY });
            }
            y -= LINE_HEIGHT;
            checkPageBreak(15);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          if (firstLine) {
            drawText(currentLine, PAGE_MARGIN + labelWidth, y, { size: FONT_SIZE_BODY });
          } else {
            drawText(currentLine, PAGE_MARGIN, y, { size: FONT_SIZE_BODY });
          }
        }
      }
      y -= LINE_HEIGHT;
      continue;
    }

    // Bullet point
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      checkPageBreak(15);
      const content = stripMarkdownFormatting(trimmed.slice(2));
      const indent = line.search(/\S/);
      const indentPx = Math.min(indent * 4, 30);

      drawText('•', PAGE_MARGIN + 10 + indentPx, y, { size: FONT_SIZE_BODY });
      drawText(content, PAGE_MARGIN + 20 + indentPx, y, { size: FONT_SIZE_BODY, maxWidth: CONTENT_WIDTH - 28 - indentPx });
      y -= LINE_HEIGHT; // Consistent line spacing
      continue;
    }

    // Italic note (starts with * and ends with *)
    if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
      checkPageBreak(15);
      y -= 8; // Padding above italic notes
    }

    // Regular paragraph
    checkPageBreak(15);
    const text = stripMarkdownFormatting(trimmed);
    if (text) {
      // Simple word wrap
      const words = text.split(' ');
      let currentLine = '';
      const maxWidth = CONTENT_WIDTH;

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        // Estimate width (sprout marker takes ~14px)
        const estimatedText = testLine.replace(/\[SPROUT\]/g, '  ');
        const testWidth = helvetica.widthOfTextAtSize(estimatedText, FONT_SIZE_BODY);

        if (testWidth > maxWidth && currentLine) {
          drawTextWithSprout(currentLine, PAGE_MARGIN, y, { size: FONT_SIZE_BODY });
          y -= LINE_HEIGHT;
          checkPageBreak(15);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        drawTextWithSprout(currentLine, PAGE_MARGIN, y, { size: FONT_SIZE_BODY });
        y -= LINE_HEIGHT;
      }
    }
  }

  // Render any remaining table
  if (inTable) {
    renderTable();
  }

  // Save PDF
  const pdfBytes = await pdfDoc.save();
  writeFileSync(outputPath, pdfBytes);
  console.log(`PDF created successfully: ${outputPath}`);
}

// Main
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage: npx ts-node scripts/markdown-to-pdf.ts <input.md> [output.pdf]');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || inputFile.replace(/\.md$/, '.pdf');

if (!existsSync(inputFile)) {
  console.error(`Error: Input file not found: ${inputFile}`);
  process.exit(1);
}

convertMarkdownToPdf(inputFile, outputFile).catch(console.error);
