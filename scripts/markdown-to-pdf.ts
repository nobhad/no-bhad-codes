/**
 * Markdown to Branded PDF Converter (using pdf-lib)
 *
 * Converts markdown proposals/documents to PDFs with branded header
 * Uses pdf-lib for better form field performance
 *
 * Usage: npx ts-node scripts/markdown-to-pdf.ts <input.md> [output.pdf]
 *
 * ============================================================
 * CONTRACT PAGE STRUCTURE CONVENTION
 * ============================================================
 * All contracts MUST follow this page breakdown:
 *
 * PAGE 1: Header + Bill-To + Scope of Work
 *   - Branded header (logo, business info)
 *   - <!-- bill-to --> block (client info left, contract details right)
 *   - Scope of Work (features, technical details, deliverables)
 *   - Annual Maintenance Plan (if applicable)
 *
 * PAGE 2: Pricing + Payment + Timeline  (<!-- pagebreak --> before ## Pricing)
 *   - Pricing table
 *   - Payment Schedule table
 *   - Payment methods + check disclaimer
 *   - Timeline table
 *
 * PAGE 3: Terms & Conditions + Signatures  (<!-- pagebreak --> before ## Terms & Conditions)
 *   - Terms & Conditions (Ownership, Revisions, Content, Cancellation, Delays)
 *   - Agreement section with signature lines
 *
 * HEADING HIERARCHY:
 *   H2 (##)  = Section headings — 13pt bold uppercase (SCOPE OF WORK, PRICING, etc.)
 *   H3 (###) = Sub-headings — 10pt bold uppercase (CUSTOM WEBSITE DEVELOPMENT, OWNERSHIP, etc.)
 *
 * SPECIAL BLOCKS:
 *   <!-- bill-to --> ... <!-- /bill-to -->   Two-column client/details layout
 *   <!-- totals --> ... <!-- /totals -->     Right-aligned subtotal/total section
 *   <!-- pagebreak -->                       Force new page
 *
 * FOOTER: All pages include branded footer + "Page X of Y"
 * ============================================================
 */

import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getRegularFontBytes, getBoldFontBytes, registerFontkit } from '../server/utils/pdf-utils.js';

// Business info - matches server/config/business.ts defaults
const BUSINESS_INFO = {
  name: process.env.BUSINESS_NAME || 'No Bhad Codes',
  owner: process.env.BUSINESS_OWNER || 'Noelle Bhaduri',
  contact: process.env.BUSINESS_CONTACT || 'Noelle Bhaduri',
  tagline: process.env.BUSINESS_TAGLINE || 'Web Development & Design',
  email: process.env.BUSINESS_EMAIL || 'nobhaduri@gmail.com',
  website: process.env.BUSINESS_WEBSITE || 'nobhad.codes'
};

// Page settings — matches standard PDF margins (server/config/pdf-styles.ts)
const PAGE_WIDTH = 612; // Letter size
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 54; // Standard 0.75in margins (matches all other PDF generators)
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// Font sizes
const _FONT_SIZE_H1 = 18;
const FONT_SIZE_H2 = 13;
const FONT_SIZE_H3 = 10;
const FONT_SIZE_H4 = 10;
const FONT_SIZE_BODY = 9;
const FONT_SIZE_SMALL = 8;

// Line heights - very tight spacing
const LINE_HEIGHT = 11;

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/'/g, '\'')
    .replace(/'/g, '\'')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/✓/g, '[CHECK]')
    .replace(/✔/g, '[CHECK]')
    .replace(/[^\x20-\x7E]/g, ''); // Remove remaining non-ASCII/non-printable characters
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

  // Register fontkit and embed Inconsolata
  registerFontkit(pdfDoc);
  const helvetica = await pdfDoc.embedFont(getRegularFontBytes());
  const helveticaBold = await pdfDoc.embedFont(getBoldFontBytes());
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
  const drawText = (
    text: string,
    x: number,
    yPos: number,
    options: {
      font?: PDFFont;
      size?: number;
      color?: { r: number; g: number; b: number };
      maxWidth?: number;
    } = {}
  ) => {
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

  /**
   * Parse text into segments with bold/regular runs.
   * Handles both **explicit bold** markdown and label patterns (Text:).
   * A "label" is word(s) ending with : at the START of a string,
   * e.g. "Payment Schedule:" or "Deposit (40%):".
   */
  type TextSegment = { text: string; bold: boolean };

  const parseInlineBold = (raw: string): TextSegment[] => {
    const segments: TextSegment[] = [];

    // First pass: split on **bold** markers
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = boldRegex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: raw.slice(lastIndex, match.index), bold: false });
      }
      segments.push({ text: match[1], bold: true });
      lastIndex = boldRegex.lastIndex;
    }

    if (lastIndex < raw.length) {
      segments.push({ text: raw.slice(lastIndex), bold: false });
    }

    // If no explicit bold found, check for label pattern at start
    // Matches: "SomeLabel:" or "Some Label (40%):" at beginning of text
    if (segments.length === 1 && !segments[0].bold) {
      const labelMatch = raw.match(/^([A-Za-z][A-Za-z0-9 ()/%,.'&-]*:)\s*/);
      if (labelMatch) {
        const labelText = labelMatch[1];
        const rest = raw.slice(labelMatch[0].length);
        const result: TextSegment[] = [{ text: labelText, bold: true }];
        if (rest) result.push({ text: ` ${  rest}`, bold: false });
        return result;
      }
    }

    return segments.length > 0 ? segments : [{ text: raw, bold: false }];
  };

  /**
   * Draw text with inline bold segments on one line.
   * Returns the total width drawn.
   */
  const drawInlineBoldText = (
    segments: TextSegment[],
    startX: number,
    yPos: number,
    size: number
  ): number => {
    let x = startX;
    for (const seg of segments) {
      const font = seg.bold ? helveticaBold : helvetica;
      const cleanText = seg.bold ? seg.text : stripMarkdownFormatting(seg.text);
      if (!cleanText) continue;
      drawText(cleanText, x, yPos, { font, size });
      x += font.widthOfTextAtSize(cleanText, size);
    }
    return x - startX;
  };

  // Helper to calculate smart column widths based on content
  const calculateColumnWidths = (data: string[][]): number[] => {
    const numCols = data[0].length;

    // Measure the max content width for each column
    const maxWidths: number[] = new Array(numCols).fill(0);
    for (const row of data) {
      row.forEach((cell, colIndex) => {
        const text = stripMarkdownFormatting(cell);
        const font = helveticaBold; // Use bold for max width estimate
        const textWidth = font.widthOfTextAtSize(text, FONT_SIZE_SMALL) + 10; // padding
        if (textWidth > maxWidths[colIndex]) {
          maxWidths[colIndex] = textWidth;
        }
      });
    }

    const totalNeeded = maxWidths.reduce((sum, w) => sum + w, 0);

    if (totalNeeded <= CONTENT_WIDTH) {
      // Everything fits — give leftover space to the first column
      const leftover = CONTENT_WIDTH - totalNeeded;
      const widths = [...maxWidths];
      widths[0] += leftover;
      return widths;
    }

    // Content exceeds available width — give first column the remaining space
    // after sizing other columns to their content
    const otherColsWidth = maxWidths.slice(1).reduce((sum, w) => sum + w, 0);
    const firstColWidth = Math.max(CONTENT_WIDTH - otherColsWidth, CONTENT_WIDTH * 0.3);
    const scale = (CONTENT_WIDTH - firstColWidth) / (otherColsWidth || 1);
    const widths = [firstColWidth, ...maxWidths.slice(1).map(w => w * scale)];
    return widths;
  };

  // Helper to render table
  const renderTable = () => {
    if (tableData.length === 0) return;

    const numCols = tableData[0].length;
    const colWidths = calculateColumnWidths(tableData);
    const rowHeight = 20;
    const tableHeight = tableData.length * rowHeight;

    // Check if table fits
    if (y - tableHeight < PAGE_MARGIN + 20) {
      addNewPage();
    }

    const startX = PAGE_MARGIN;
    const startY = y;

    // Draw cells
    tableData.forEach((row, rowIndex) => {
      const rowY = startY - rowIndex * rowHeight;

      let cellX = startX;
      row.forEach((cell, colIndex) => {
        const colWidth = colWidths[colIndex] || (CONTENT_WIDTH / numCols);
        const cellContent = stripMarkdownFormatting(cell);

        // Header row: dark background, white text
        if (rowIndex === 0) {
          page.drawRectangle({
            x: cellX,
            y: rowY - rowHeight,
            width: colWidth,
            height: rowHeight,
            color: rgb(0.2, 0.2, 0.2)
          });
        }

        // Cell text
        if (isCheckmark(cell)) {
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
          if (cellContent.trim() === '-') {
            const dashWidth = helvetica.widthOfTextAtSize('-', FONT_SIZE_SMALL);
            drawText('-', cellX + (colWidth - dashWidth) / 2, rowY - rowHeight + 6, {
              font: helvetica,
              size: FONT_SIZE_SMALL,
              color: rowIndex === 0 ? { r: 1, g: 1, b: 1 } : { r: 0, g: 0, b: 0 }
            });
          }
        } else {
          const isHeader = rowIndex === 0;
          const isBoldCell = cell.includes('**');
          const font = (isHeader || isBoldCell) ? helveticaBold : helvetica;
          const textColor = isHeader ? { r: 1, g: 1, b: 1 } : { r: 0, g: 0, b: 0 };
          const maxTextWidth = colWidth - 10;

          // Truncate only if truly necessary
          let displayText = cellContent;
          while (font.widthOfTextAtSize(displayText, FONT_SIZE_SMALL) > maxTextWidth && displayText.length > 3) {
            displayText = displayText.substring(0, displayText.length - 1);
          }

          if (colIndex > 0) {
            // Right-align currency, center others
            const textWidth = font.widthOfTextAtSize(displayText, FONT_SIZE_SMALL);
            const isCurrency = displayText.startsWith('$');
            if (isCurrency) {
              drawText(displayText, cellX + colWidth - textWidth - 5, rowY - rowHeight + 6, {
                font,
                size: FONT_SIZE_SMALL,
                color: textColor
              });
            } else {
              drawText(displayText, cellX + (colWidth - textWidth) / 2, rowY - rowHeight + 6, {
                font,
                size: FONT_SIZE_SMALL,
                color: textColor
              });
            }
          } else {
            drawText(displayText, cellX + 6, rowY - rowHeight + 6, {
              font,
              size: FONT_SIZE_SMALL,
              color: textColor
            });
          }
        }

        cellX += colWidth;
      });
    });

    y = startY - tableHeight - 8;
    tableData = [];
    inTable = false;
  };

  // === HEADER - BRANDED LAYOUT (matches invoice style) ===
  // Extract document title from first H1 line
  let documentTitle = 'DOCUMENT';
  for (const l of lines) {
    if (l.trim().startsWith('# ')) {
      documentTitle = stripMarkdownFormatting(l.trim().slice(2)).toUpperCase();
      break;
    }
  }

  // Draw document title (large, top-left)
  const titleFontSize = 28;
  drawText(documentTitle, PAGE_MARGIN, y - 20, {
    font: helveticaBold,
    size: titleFontSize
  });

  // Logo + business info (right side)
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

  const logoHeight = 100;
  const rightMargin = PAGE_WIDTH - PAGE_MARGIN;
  let textStartX = rightMargin - 180;

  if (logoPath) {
    const logoBytes = readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    const logoX = rightMargin - logoWidth - 150;
    page.drawImage(logoImage, {
      x: logoX,
      y: y - logoHeight + 10,
      width: logoWidth,
      height: logoHeight
    });
    textStartX = logoX + logoWidth + 18;
  }

  // Business info (right of logo)
  drawText(BUSINESS_INFO.name, textStartX, y - 11, {
    font: helveticaBold,
    size: 15
  });
  drawText(BUSINESS_INFO.owner, textStartX, y - 34, {
    size: 10
  });
  drawText(BUSINESS_INFO.email, textStartX, y - 54, {
    size: 9,
    color: { r: 0.4, g: 0.4, b: 0.4 }
  });
  drawText(BUSINESS_INFO.website, textStartX, y - 70, {
    size: 9,
    color: { r: 0.4, g: 0.4, b: 0.4 }
  });

  y -= 120;

  // Divider line
  page.drawLine({
    start: { x: PAGE_MARGIN, y },
    end: { x: rightMargin, y },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
  y -= 21;

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

    // Totals block (right-aligned subtotal/total section)
    if (trimmed === '<!-- totals -->') {
      if (inTable) renderTable();
      const totalsLines: string[] = [];
      i++;
      while (i < lines.length) {
        const blockLine = lines[i].trim();
        if (blockLine === '<!-- /totals -->') break;
        if (blockLine !== '') totalsLines.push(blockLine);
        i++;
      }

      const rightEdge = PAGE_WIDTH - PAGE_MARGIN;
      const totalsWidth = 200;
      const totalsX = rightEdge - totalsWidth;

      for (const tLine of totalsLines) {
        const labelMatch = tLine.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
        if (labelMatch) {
          const label = labelMatch[1];
          const value = stripMarkdownFormatting(labelMatch[2]);
          const isTotal = label.toUpperCase() === 'TOTAL';

          if (isTotal) {
            // Thick line above TOTAL
            page.drawLine({
              start: { x: totalsX, y: y + 4 },
              end: { x: rightEdge, y: y + 4 },
              thickness: 1.5,
              color: rgb(0, 0, 0)
            });
            y -= 12;

            // TOTAL label + value — same size, bold
            const totalSize = 11;
            drawText(`${label}:`, totalsX, y, {
              font: helveticaBold,
              size: totalSize
            });
            const valueWidth = helveticaBold.widthOfTextAtSize(value, totalSize);
            drawText(value, rightEdge - valueWidth, y, {
              font: helveticaBold,
              size: totalSize
            });
            y -= totalSize + 6;
          } else {
            // Thin line above subtotal
            page.drawLine({
              start: { x: totalsX, y: y + 4 },
              end: { x: rightEdge, y: y + 4 },
              thickness: 0.5,
              color: rgb(0.6, 0.6, 0.6)
            });
            y -= 8;

            // Regular subtotal line
            drawText(`${label}:`, totalsX, y, {
              font: helvetica,
              size: FONT_SIZE_BODY,
              color: { r: 0.3, g: 0.3, b: 0.3 }
            });
            const valueWidth = helvetica.widthOfTextAtSize(value, FONT_SIZE_BODY);
            drawText(value, rightEdge - valueWidth, y, {
              size: FONT_SIZE_BODY
            });
            y -= LINE_HEIGHT + 2;
          }
        } else {
          // "Amount Due (USD)" — small right-aligned text
          const stripped = stripMarkdownFormatting(tLine);
          const textWidth = helvetica.widthOfTextAtSize(stripped, 7);
          drawText(stripped, rightEdge - textWidth, y, {
            size: 7,
            color: { r: 0.5, g: 0.5, b: 0.5 }
          });
          y -= 14;
        }
      }

      y -= 8;
      continue;
    }

    // Two-column bill-to + details block
    if (trimmed === '<!-- bill-to -->') {
      const billToLines: string[] = [];
      const detailLines: { label: string; value: string }[] = [];
      let inDetails = false;
      i++;

      // Collect bill-to and details lines
      while (i < lines.length) {
        const blockLine = lines[i].trim();
        if (blockLine === '<!-- /bill-to -->') break;
        if (blockLine === '<!-- details -->') {
          inDetails = true;
          i++;
          continue;
        }
        if (blockLine === '') { i++; continue; }

        if (inDetails) {
          const labelMatch = blockLine.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
          if (labelMatch) {
            detailLines.push({ label: `${labelMatch[1]  }:`, value: labelMatch[2] });
          }
        } else {
          billToLines.push(blockLine);
        }
        i++;
      }

      // Render BILL TO label
      const detailsX = PAGE_WIDTH / 2 + 36;
      drawText('BILL TO:', PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_H2 });
      y -= 14;

      // Save Y for details column (render at same height)
      const billToStartY = y;

      // Render bill-to lines on left
      for (const btLine of billToLines) {
        const stripped = stripMarkdownFormatting(btLine);
        const isBold = btLine.startsWith('**') && btLine.endsWith('**');
        drawText(stripped, PAGE_MARGIN, y, {
          font: isBold ? helveticaBold : helvetica,
          size: isBold ? 10 : FONT_SIZE_BODY
        });
        y -= LINE_HEIGHT;
      }

      // Render details on right side at same starting Y
      let detailY = billToStartY;
      for (const detail of detailLines) {
        drawText(detail.label, detailsX, detailY, {
          font: helveticaBold,
          size: 9,
          color: { r: 0.3, g: 0.3, b: 0.3 }
        });
        // Right-align the value
        const valueWidth = helvetica.widthOfTextAtSize(detail.value, 9);
        const rightEdge = PAGE_WIDTH - PAGE_MARGIN;
        drawText(detail.value, rightEdge - valueWidth, detailY, { size: 9 });
        detailY -= 14;
      }

      // Use the lower of the two columns
      y = Math.min(y, detailY) - 12;

      // Draw divider below
      page.drawLine({
        start: { x: PAGE_MARGIN, y: y + 4 },
        end: { x: PAGE_WIDTH - PAGE_MARGIN, y: y + 4 },
        thickness: 1,
        color: rgb(0, 0, 0)
      });
      y -= 8;

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
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) {
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

    // H1 - skip, already rendered in header
    if (trimmed.startsWith('# ')) {
      continue;
    }

    // H2
    if (trimmed.startsWith('## ')) {
      checkPageBreak(28);
      y -= 6; // Space above heading
      const text = stripMarkdownFormatting(trimmed.slice(3)).toUpperCase();
      drawText(text, PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_H2 });
      y -= FONT_SIZE_H2 + 2; // Less space below
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      checkPageBreak(25);
      y -= 6; // Space above heading
      const text = stripMarkdownFormatting(trimmed.slice(4)).toUpperCase();
      drawText(text, PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_H3 });
      y -= FONT_SIZE_H3; // Minimal space below
      continue;
    }

    // H4
    if (trimmed.startsWith('#### ')) {
      checkPageBreak(22);
      const text = stripMarkdownFormatting(trimmed.slice(5));
      // More padding for special headings
      if (
        text.toLowerCase().startsWith('everything in') ||
        text.toLowerCase().includes('what\'s included')
      ) {
        y -= 12;
      } else {
        y -= 2; // Very tight subsection spacing
      }
      drawText(text, PAGE_MARGIN, y, { font: helveticaBold, size: FONT_SIZE_H4 });
      y -= FONT_SIZE_H4; // Minimal space below
      continue;
    }

    // Checkbox
    if (
      trimmed.startsWith('- [x] ') ||
      trimmed.startsWith('- [X] ') ||
      trimmed.startsWith('- [ ] ')
    ) {
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

    // Bullet point — with inline bold for labels (e.g. "Milestones: ...")
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      checkPageBreak(15);
      const rawContent = trimmed.slice(2);
      const indent = line.search(/\S/);
      const indentPx = Math.min(indent * 4, 30);
      const bulletX = PAGE_MARGIN + 10 + indentPx;
      const textX = PAGE_MARGIN + 20 + indentPx;
      const maxWidth = CONTENT_WIDTH - 28 - indentPx;

      drawText('•', bulletX, y, { size: FONT_SIZE_BODY });

      const segments = parseInlineBold(rawContent);
      const hasBold = segments.some(s => s.bold);

      if (hasBold) {
        // Render with inline bold segments — word wrap manually
        const allText = segments.map(s => s.bold ? s.text : stripMarkdownFormatting(s.text)).join('');
        const totalWidth = helvetica.widthOfTextAtSize(allText, FONT_SIZE_BODY);

        if (totalWidth <= maxWidth) {
          // Fits on one line
          drawInlineBoldText(segments, textX, y, FONT_SIZE_BODY);
        } else {
          // Needs wrapping — render bold label on first line, rest wraps
          let x = textX;
          for (const seg of segments) {
            const font = seg.bold ? helveticaBold : helvetica;
            const cleanText = seg.bold ? seg.text : stripMarkdownFormatting(seg.text);
            if (!cleanText) continue;

            const words = cleanText.split(' ');
            for (const word of words) {
              const wordText = x > textX ? ` ${word}` : word;
              const wordWidth = font.widthOfTextAtSize(wordText, FONT_SIZE_BODY);

              if (x + wordWidth > PAGE_MARGIN + CONTENT_WIDTH && x > textX) {
                y -= LINE_HEIGHT;
                checkPageBreak(15);
                x = PAGE_MARGIN;
                drawText(word, x, y, { font, size: FONT_SIZE_BODY });
                x += font.widthOfTextAtSize(word, FONT_SIZE_BODY);
              } else {
                drawText(wordText, x, y, { font, size: FONT_SIZE_BODY });
                x += wordWidth;
              }
            }
          }
        }
      } else {
        // No bold — render as before
        const content = stripMarkdownFormatting(rawContent);
        drawText(content, textX, y, {
          size: FONT_SIZE_BODY,
          maxWidth
        });
      }

      y -= LINE_HEIGHT;
      continue;
    }

    // Italic note (starts with * and ends with *)
    if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
      checkPageBreak(15);
      y -= 4;
      const noteText = stripMarkdownFormatting(trimmed.slice(1, -1));
      drawText(noteText, PAGE_MARGIN, y, {
        size: 7,
        color: { r: 0.5, g: 0.5, b: 0.5 }
      });
      y -= 10;
      continue;
    }

    // Regular paragraph — with inline bold for labels
    checkPageBreak(15);
    const segments = parseInlineBold(trimmed);
    const hasBoldSegments = segments.some(s => s.bold);

    if (hasBoldSegments) {
      // Render with inline bold segments and word wrapping
      let x = PAGE_MARGIN;
      for (const seg of segments) {
        const font = seg.bold ? helveticaBold : helvetica;
        const cleanText = seg.bold ? seg.text : stripMarkdownFormatting(seg.text);
        if (!cleanText) continue;

        const words = cleanText.split(' ');
        for (const word of words) {
          const wordText = x > PAGE_MARGIN ? ` ${word}` : word;
          const wordWidth = font.widthOfTextAtSize(wordText, FONT_SIZE_BODY);

          if (x + wordWidth > PAGE_MARGIN + CONTENT_WIDTH && x > PAGE_MARGIN) {
            y -= LINE_HEIGHT;
            checkPageBreak(15);
            x = PAGE_MARGIN;
            drawText(word, x, y, { font, size: FONT_SIZE_BODY });
            x += font.widthOfTextAtSize(word, FONT_SIZE_BODY);
          } else {
            drawText(wordText, x, y, { font, size: FONT_SIZE_BODY });
            x += wordWidth;
          }
        }
      }
      y -= LINE_HEIGHT;
    } else {
      const text = stripMarkdownFormatting(trimmed);
      if (text) {
        // Simple word wrap (no bold)
        const words = text.split(' ');
        let currentLine = '';
        const maxWidth = CONTENT_WIDTH;

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = helvetica.widthOfTextAtSize(testLine, FONT_SIZE_BODY);

          if (testWidth > maxWidth && currentLine) {
            drawText(currentLine, PAGE_MARGIN, y, { size: FONT_SIZE_BODY });
            y -= LINE_HEIGHT;
            checkPageBreak(15);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          drawText(currentLine, PAGE_MARGIN, y, { size: FONT_SIZE_BODY });
          y -= LINE_HEIGHT;
        }
      }
    }
  }

  // Render any remaining table
  if (inTable) {
    renderTable();
  }

  // Add footer to all pages
  const allPages = pdfDoc.getPages();
  const totalPages = allPages.length;
  const footerText = `${BUSINESS_INFO.name} \u2022 ${BUSINESS_INFO.owner} \u2022 ${BUSINESS_INFO.email} \u2022 ${BUSINESS_INFO.website}`;
  for (let pageIdx = 0; pageIdx < allPages.length; pageIdx++) {
    const p = allPages[pageIdx];
    // Footer divider line
    p.drawLine({
      start: { x: PAGE_MARGIN, y: 72 },
      end: { x: PAGE_WIDTH - PAGE_MARGIN, y: 72 },
      thickness: 1,
      color: rgb(0, 0, 0)
    });
    // Footer text centered
    const footerWidth = helvetica.widthOfTextAtSize(footerText, 7);
    p.drawText(footerText, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: 56,
      size: 7,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5)
    });
    // Page number right-aligned
    const pageNumText = `Page ${pageIdx + 1} of ${totalPages}`;
    const pageNumWidth = helvetica.widthOfTextAtSize(pageNumText, 7);
    p.drawText(pageNumText, {
      x: PAGE_WIDTH - PAGE_MARGIN - pageNumWidth,
      y: 42,
      size: 7,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5)
    });
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
