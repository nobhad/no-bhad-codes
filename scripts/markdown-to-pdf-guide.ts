/**
 * Markdown -> Branded PDF Converter, LONG-DOCUMENT variant
 *
 * Usage:
 *   npx tsx scripts/markdown-to-pdf-guide.ts <input.md> [output.pdf] [--title "TITLE"]
 *   npx tsx scripts/markdown-to-pdf-guide.ts <input-dir> <output-dir>
 *
 * Sibling of scripts/markdown-to-pdf.ts, which is tuned for CONTRACTS: one
 * branded header on page 1, and page breaks only at explicit
 * `<!-- pagebreak -->` markers. That is exactly wrong for a multi-page guide,
 * so this file differs in four ways:
 *
 *   1. THE BRANDED HEADER IS DRAWN ON EVERY PAGE, not just the first.
 *   2. Page breaks are automatic — content flows and paginates on its own.
 *   3. PAGINATION IS SENTENCE-AWARE. A page never breaks mid-sentence: the
 *      break is pulled back to the nearest sentence boundary, and short blocks
 *      (a bullet, a two-line paragraph) are kept whole. See emitFlow().
 *   4. Markdown a prose guide actually uses is supported: fenced code blocks,
 *      blockquotes, ordered lists, nested bullets, and tables that break across
 *      pages carrying their header row with them.
 *
 * Everything else — fonts (Inconsolata), logo resolution, footer, page
 * numbering, palette — is the house style shared with the contract generator.
 *
 * Paths for the logo and fonts resolve from process.cwd(), so run this from
 * the no-bhad-codes repo root regardless of where the markdown lives.
 */

import {
  PDFDocument, PDFFont, PDFPage, PDFForm, PDFRef, PDFName, PDFArray,
  PDFString, PDFHexString, rgb, RGB
} from 'pdf-lib';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { getRegularFontBytes, getBoldFontBytes, registerFontkit } from '../server/utils/pdf-utils.js';

const BUSINESS_INFO = {
  name: process.env.BUSINESS_NAME || 'No Bhad Codes',
  owner: process.env.BUSINESS_OWNER || 'Noelle Bhaduri',
  email: process.env.BUSINESS_EMAIL || 'nobhaduri@gmail.com',
  website: process.env.BUSINESS_WEBSITE || 'nobhad.codes'
};

// ── Page geometry ──────────────────────────────────────────────────────────
const PAGE_WIDTH = 612;   // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 54;        // 0.75in, matches every other generator
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;

/** Header block height. Content on every page starts below this. */
const HEADER_HEIGHT = 120;
const LOGO_HEIGHT = 100;

/** Footer rule sits at 72; the lowest a line of body text may go. */
const CONTENT_BOTTOM = 88;

// ── Type scale ─────────────────────────────────────────────────────────────
const SIZE_TITLE = 22;
/** Floor for the shrink-to-fit title; below this it wraps instead. */
const TITLE_MIN_SIZE = 13;
const SIZE_H2 = 13;
const SIZE_H3 = 10.5;
const SIZE_H4 = 9.5;
const SIZE_BODY = 9;
const SIZE_TABLE = 8;
const SIZE_CODE = 8;
const SIZE_FOOT = 7;
const SIZE_TOC = 9.5;

/** Vertical step between contents rows. */
const TOC_LINE_HEIGHT = 17;

const LINE_HEIGHT = 12;
const CODE_LINE_HEIGHT = 10;

/**
 * A block this short is never split. A bullet or a two-line paragraph left
 * with one orphan line on the previous page reads worse than a slightly short
 * page does.
 */
const KEEP_TOGETHER_LINES = 3;

// ── Palette (mirrors server/config/pdf-styles.ts: black on white) ──────────
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.78, 0.78, 0.78);
const CODE_BG = rgb(0.955, 0.955, 0.955);

/** Map the typography these docs use onto the ASCII the embedded font has. */
function toAscii(text: string): string {
  return text
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/↔/g, '<->')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/§/g, 'Section ')
    .replace(/[✓✔]/g, '[x]')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/÷/g, '/')
    .replace(/×/g, 'x')
    .replace(/[·•]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '');
}

function stripMarkdownFormatting(text: string): string {
  return toAscii(text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
  // No trim: this runs per inline segment, and the space before a **bold** run
  // lives at the end of the plain segment preceding it.
}

/** Collapse images and links to their label text. The no-href fallback. */
function stripLinks(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

/**
 * GitHub-style heading slug, so a `[label](#anchor)` written for the markdown
 * resolves to the same heading here. Deliberately computed from the raw text
 * BEFORE toAscii(), which folds em-dashes and would shift the slug.
 */
function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Split a line into link and non-link runs. Images collapse to their alt text
 * first, so an image inside a link label cannot produce a nested match.
 */
function splitLinks(raw: string): { text: string; href?: string }[] {
  const flat = raw.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  const out: { text: string; href?: string }[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat)) !== null) {
    if (m.index > last) out.push({ text: flat.slice(last, m.index) });
    out.push({ text: m[1], href: m[2].trim() });
    last = re.lastIndex;
  }
  if (last < flat.length) out.push({ text: flat.slice(last) });
  return out.length ? out : [{ text: flat }];
}

/**
 * Rewrite a markdown href for a PDF that sits beside its siblings.
 * `./USER_GUIDE.md` -> `USER_GUIDE.pdf`, because the guides are converted as a
 * set into one directory. `#anchor` is left alone; it resolves to an internal
 * jump once every heading has been seen.
 */
function normaliseHref(href: string): string {
  if (href.startsWith('#')) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  const rel = href.replace(/^\.\//, '');
  if (/\.md(#.*)?$/i.test(rel)) return rel.replace(/\.md(?=#|$)/i, '.pdf');
  return href;
}

// ── Sentence detection ─────────────────────────────────────────────────────
// Only used to choose page breaks, so a false negative costs nothing worse
// than the break we would have taken anyway.

const ABBREVIATIONS = new Set([
  'e.g.', 'i.e.', 'etc.', 'vs.', 'cf.', 'approx.', 'no.',
  'mr.', 'mrs.', 'ms.', 'dr.', 'st.', 'inc.', 'ltd.'
]);

function endsSentence(word: string, next: string | undefined): boolean {
  const w = word.replace(/[)\]}"'`*]+$/, '');
  if (!/[.?!]$/.test(w)) return false;
  if (ABBREVIATIONS.has(w.toLowerCase())) return false;
  if (/^\d+(\.\d+)*\.$/.test(w)) return false;   // 18.20.8. / version-ish
  if (/^[A-Za-z]\.$/.test(w)) return false;      // an initial
  if (next === undefined) return true;
  // A real sentence start: capital, digit, or an opening mark.
  return /^[A-Z0-9"'`(\[]/.test(next);
}

/** Title for the header block: an explicit --title, else the first H1, else the filename. */
function deriveTitle(lines: string[], inputPath: string, override?: string): string {
  if (override) return override.toUpperCase();
  for (const l of lines) {
    if (l.trim().startsWith('# ')) return stripMarkdownFormatting(l.trim().slice(2)).toUpperCase();
  }
  return basename(inputPath).replace(/\.md$/i, '').replace(/[-_]/g, ' ').toUpperCase();
}

function resolveLogoPath(): string {
  const candidates = [
    join(process.cwd(), 'public/images/avatar_pdf.png'),
    join(process.cwd(), 'public/images/pdf-header-logo.png'),
    join(process.cwd(), 'public/images/avatar_small-1.png')
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return '';
}

type Seg = { text: string; bold: boolean; href?: string };

/**
 * Split a line into bold / regular runs, honouring **markers**, and carry any
 * link target down with each run. Links are split FIRST so a bold run inside a
 * link label keeps the href.
 */
function parseInlineBold(input: string): Seg[] {
  const segs: Seg[] = [];
  for (const piece of splitLinks(input)) {
    const href = piece.href ? normaliseHref(piece.href) : undefined;
    const re = /\*\*([^*]+)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(piece.text)) !== null) {
      if (m.index > last) segs.push({ text: piece.text.slice(last, m.index), bold: false, href });
      segs.push({ text: m[1], bold: true, href });
      last = re.lastIndex;
    }
    if (last < piece.text.length) segs.push({ text: piece.text.slice(last), bold: false, href });
  }
  return segs.length ? segs : [{ text: stripLinks(input), bold: false }];
}

/** Does this line open a new block, rather than continue the one above it? */
function opensBlock(line: string): boolean {
  const t = line.trim();
  if (t === '') return true;
  return /^#{1,6}\s/.test(t)
    || t.startsWith('```')
    || t.startsWith('>')
    || t.startsWith('|')
    || t.startsWith('<!--')
    || /^(-{3,}|\*{3,}|_{3,})$/.test(t)
    || /^[-*]\s/.test(t)
    || /^\d+\.\s/.test(t);
}

/**
 * Soft-wrapped source is one logical block. Returns the joined text and the
 * index of the last line consumed, so paragraphs and list items reflow to the
 * full column width instead of inheriting the markdown's 80-column wrap.
 */
function joinBlock(lines: string[], start: number): { text: string; end: number } {
  let text = lines[start].trim();
  let i = start;
  while (i + 1 < lines.length && !opensBlock(lines[i + 1])) {
    i++;
    text += ` ${lines[i].trim()}`;
  }
  return { text, end: i };
}

/** Markdown indent depth -> a stable indent step, tolerant of 2/3/4-space nesting. */
function indentSteps(spaces: number): number {
  if (spaces <= 0) return 0;
  if (spaces <= 3) return 1;
  if (spaces <= 7) return 2;
  return 3;
}

// A token is one run of same-weight text; a unit is one or more tokens glued
// together with no space between them (`**Publish changes**.` is one unit, so
// the period can never wrap onto its own line).
type Tok = { text: string; bold: boolean; glue: boolean; href?: string };
type Unit = { toks: Tok[]; width: number; sentence: number };
type FlowLine = { units: Unit[]; first: number; last: number };

async function convert(inputPath: string, outputPath: string, titleOverride?: string): Promise<void> {
  const markdown = readFileSync(inputPath, 'utf-8');
  const lines = markdown.split('\n');

  const pdfDoc = await PDFDocument.create();
  registerFontkit(pdfDoc);
  const regular = await pdfDoc.embedFont(getRegularFontBytes());
  const bold = await pdfDoc.embedFont(getBoldFontBytes());
  const form: PDFForm = pdfDoc.getForm();

  const documentTitle = deriveTitle(lines, inputPath, titleOverride);
  pdfDoc.setTitle(`${documentTitle} — ${BUSINESS_INFO.name}`);
  pdfDoc.setAuthor(BUSINESS_INFO.owner);

  const logoPath = resolveLogoPath();
  const logoImage = logoPath ? await pdfDoc.embedPng(readFileSync(logoPath)) : null;

  let page!: PDFPage;
  let y = 0;
  /** Y of the first content line on the current page — "are we at the top?". */
  let pageTopY = 0;
  let checkboxCount = 0;

  // ── Navigation state ─────────────────────────────────────────────────────
  // Headings are recorded as they are drawn, holding a reference to the PDFPage
  // object rather than a page NUMBER: contents pages get inserted at the front
  // afterwards, and an index captured now would be wrong by the time it is
  // printed. Resolving through getPages().indexOf() at the end sidesteps it.
  type Heading = { level: number; label: string; slug: string; page: PDFPage; y: number };
  const headings: Heading[] = [];

  type LinkRect = { page: PDFPage; href: string; x: number; y: number; w: number; h: number };
  const linkRects: LinkRect[] = [];

  /**
   * The branded header. THIS RUNS FOR EVERY PAGE — the whole reason this file
   * exists separately from markdown-to-pdf.ts.
   */
  function drawHeader(p: PDFPage): number {
    let top = PAGE_HEIGHT - MARGIN;

    let textStartX = RIGHT_EDGE - 180;
    let logoX = RIGHT_EDGE - 150;
    if (logoImage) {
      const logoWidth = (logoImage.width / logoImage.height) * LOGO_HEIGHT;
      logoX = RIGHT_EDGE - logoWidth - 150;
      p.drawImage(logoImage, { x: logoX, y: top - LOGO_HEIGHT + 10, width: logoWidth, height: LOGO_HEIGHT });
      textStartX = logoX + logoWidth + 18;
    }

    // Fit the title in the gutter left of the logo: shrink first, then wrap to
    // two lines. Unchecked, a long title ("CLIENT TO-DO - HAND-OFF CHECKLIST")
    // runs straight under the artwork.
    const titleRoom = logoX - 14 - MARGIN;
    let titleSize = SIZE_TITLE;
    while (titleSize > TITLE_MIN_SIZE && bold.widthOfTextAtSize(documentTitle, titleSize) > titleRoom) {
      titleSize -= 0.5;
    }
    const titleLines: string[] = [];
    if (bold.widthOfTextAtSize(documentTitle, titleSize) <= titleRoom) {
      titleLines.push(documentTitle);
    } else {
      let line = '';
      for (const word of documentTitle.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (bold.widthOfTextAtSize(test, titleSize) > titleRoom && line) {
          titleLines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) titleLines.push(line);
    }
    titleLines.forEach((ln, idx) => {
      p.drawText(ln, { x: MARGIN, y: top - 18 - idx * (titleSize + 4), size: titleSize, font: bold, color: BLACK });
    });

    // Business info, right of the logo. Offsets, sizes and the muted treatment
    // match the header in scripts/markdown-to-pdf.ts — one house header, drawn
    // here on every page rather than only the first.
    p.drawText(BUSINESS_INFO.name, { x: textStartX, y: top - 11, size: 15, font: bold, color: BLACK });
    p.drawText(BUSINESS_INFO.owner, { x: textStartX, y: top - 34, size: 10, font: regular, color: BLACK });
    p.drawText(BUSINESS_INFO.email, { x: textStartX, y: top - 54, size: 9, font: regular, color: MUTED });
    p.drawText(BUSINESS_INFO.website, { x: textStartX, y: top - 70, size: 9, font: regular, color: MUTED });

    top -= HEADER_HEIGHT;
    p.drawLine({ start: { x: MARGIN, y: top }, end: { x: RIGHT_EDGE, y: top }, thickness: 1, color: BLACK });
    return top - 21;
  }

  function newPage(): void {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = drawHeader(page);
    pageTopY = y;
  }

  const atPageTop = (): boolean => Math.abs(y - pageTopY) < 0.5;

  /** Break to a fresh page when `need` points of vertical space are not left. */
  function ensure(need: number): void {
    if (y - need < CONTENT_BOTTOM) newPage();
  }

  function draw(text: string, x: number, yPos: number, font: PDFFont, size: number, color: RGB = BLACK): void {
    if (!text) return;
    page.drawText(text, { x, y: yPos, size, font, color });
  }

  // ── Flow engine ──────────────────────────────────────────────────────────

  function buildUnits(segs: Seg[], size: number): Unit[] {
    const toks: Tok[] = [];
    let pendingSpace = false;
    for (const seg of segs) {
      const clean = stripMarkdownFormatting(seg.text);
      if (!clean) continue;
      for (const part of clean.split(/(\s+)/)) {
        if (part === '') continue;
        if (/^\s+$/.test(part)) { pendingSpace = true; continue; }
        toks.push({ text: part, bold: seg.bold, glue: !pendingSpace && toks.length > 0, href: seg.href });
        pendingSpace = false;
      }
    }

    const units: Unit[] = [];
    for (const tok of toks) {
      if (tok.glue && units.length) units[units.length - 1].toks.push(tok);
      else units.push({ toks: [tok], width: 0, sentence: 0 });
    }

    const textOf = (u: Unit): string => u.toks.map((t) => t.text).join('');
    let sentence = 0;
    units.forEach((u, idx) => {
      u.width = u.toks.reduce((sum, t) => sum + (t.bold ? bold : regular).widthOfTextAtSize(t.text, size), 0);
      u.sentence = sentence;
      if (endsSentence(textOf(u), units[idx + 1] ? textOf(units[idx + 1]) : undefined)) sentence++;
    });
    return units;
  }

  function wrapUnits(units: Unit[], maxWidth: number, size: number): FlowLine[] {
    const space = regular.widthOfTextAtSize(' ', size);
    const out: FlowLine[] = [];
    let cur: Unit[] = [];
    let width = 0;
    const flush = (): void => {
      if (cur.length) out.push({ units: cur, first: cur[0].sentence, last: cur[cur.length - 1].sentence });
      cur = [];
      width = 0;
    };
    for (const u of units) {
      const add = cur.length ? space + u.width : u.width;
      if (cur.length && width + add > maxWidth) {
        flush();
        cur = [u];
        width = u.width;
      } else {
        cur.push(u);
        width += add;
      }
    }
    flush();
    return out;
  }

  function layoutFlow(segs: Seg[], maxWidth: number, size: number): FlowLine[] {
    return wrapUnits(buildUnits(segs, size), maxWidth, size);
  }

  function drawRange(src: FlowLine[], from: number, to: number, x0: number, size: number, lead: number, color: RGB): void {
    const space = regular.widthOfTextAtSize(' ', size);
    for (let k = from; k < to; k++) {
      let x = x0;
      src[k].units.forEach((u, idx) => {
        if (idx > 0) x += space;
        for (const tok of u.toks) {
          const font = tok.bold ? bold : regular;
          const w = font.widthOfTextAtSize(tok.text, size);
          draw(tok.text, x, y, font, size, color);
          if (tok.href) {
            page.drawLine({
              start: { x, y: y - 1.6 }, end: { x: x + w, y: y - 1.6 },
              thickness: 0.4, color
            });
            linkRects.push({ page, href: tok.href, x, y: y - 3, w, h: size + 4 });
          }
          x += w;
        }
      });
      y -= lead;
    }
  }

  const linesThatFit = (lead: number): number => Math.floor((y - CONTENT_BOTTOM) / lead);

  /**
   * Place wrapped lines, breaking pages only where a sentence ends.
   *
   * The greedy break point is `fit` lines down. We walk BACK from there to the
   * last boundary where no sentence straddles the gap, and break there instead.
   * If no such boundary exists in what is left of this page, the whole run is
   * pushed to a fresh page; only a sentence genuinely taller than one page
   * (which these documents do not contain) falls through to a hard split.
   */
  function emitFlow(src: FlowLine[], x0: number, size: number, lead: number, color: RGB = BLACK, keepTogether = KEEP_TOGETHER_LINES): void {
    let i = 0;
    while (i < src.length) {
      let fit = linesThatFit(lead);
      const remaining = src.length - i;
      if (fit < 1 || (remaining <= keepTogether && fit < remaining)) {
        newPage();
        fit = linesThatFit(lead);
      }
      if (fit >= remaining) {
        drawRange(src, i, src.length, x0, size, lead, color);
        return;
      }

      let cut = -1;
      for (let k = i + fit; k > i; k--) {
        if (src[k - 1].last < src[k].first) { cut = k; break; }
      }
      if (cut === -1) {
        if (!atPageTop()) { newPage(); continue; }
        cut = i + fit;   // one sentence taller than a page: unavoidable
      }

      drawRange(src, i, cut, x0, size, lead, color);
      i = cut;
      newPage();
    }
  }

  function drawFlow(segs: Seg[], x0: number, maxWidth: number, size: number, lead = LINE_HEIGHT, color: RGB = BLACK): void {
    emitFlow(layoutFlow(segs, maxWidth, size), x0, size, lead, color);
  }

  /**
   * Page-break BEFORE a list marker is drawn if the item would not fit, so the
   * bullet or checkbox never ends up stranded at the foot of a page with its
   * text overleaf.
   */
  function reserveLines(count: number, lead: number, keepTogether = KEEP_TOGETHER_LINES): void {
    const fit = linesThatFit(lead);
    if (fit < 1 || (count <= keepTogether && fit < count)) newPage();
  }

  // ── Tables ───────────────────────────────────────────────────────────────
  function columnWidths(data: string[][]): number[] {
    const cols = data[0].length;
    const max = new Array<number>(cols).fill(0);
    for (const row of data) {
      row.forEach((cell, i) => {
        const w = bold.widthOfTextAtSize(stripMarkdownFormatting(cell), SIZE_TABLE) + 12;
        if (w > max[i]) max[i] = w;
      });
    }
    const total = max.reduce((a, b) => a + b, 0);
    if (total <= CONTENT_WIDTH) {
      const widths = [...max];
      widths[0] += CONTENT_WIDTH - total;
      return widths;
    }
    // Overflowing: let the first column absorb the squeeze, scale the rest.
    const others = max.slice(1).reduce((a, b) => a + b, 0);
    const first = Math.max(CONTENT_WIDTH - others, CONTENT_WIDTH * 0.28);
    const scale = (CONTENT_WIDTH - first) / (others || 1);
    return [first, ...max.slice(1).map((w) => w * scale)];
  }

  /** Wrap a cell to the lines that fit its column. */
  function wrapCell(text: string, width: number, font: PDFFont): string[] {
    const words = stripMarkdownFormatting(text).split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, SIZE_TABLE) > width - 10 && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out.length ? out : [''];
  }

  function renderTable(data: string[][]): void {
    if (!data.length) return;
    const widths = columnWidths(data);
    const header = data[0];

    const drawRow = (row: string[], isHeader: boolean): void => {
      const cells = row.map((c, i) => wrapCell(c, widths[i], isHeader ? bold : regular));
      const rowHeight = Math.max(...cells.map((c) => c.length)) * LINE_HEIGHT - 2 + 8;

      // A row must not be split; break first, and repeat the header on the new page.
      if (y - rowHeight < CONTENT_BOTTOM) {
        newPage();
        if (!isHeader) drawRow(header, true);
      }

      const rowTop = y;
      if (isHeader) {
        page.drawRectangle({
          x: MARGIN, y: rowTop - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: rgb(0.16, 0.16, 0.16)
        });
      } else {
        page.drawLine({
          start: { x: MARGIN, y: rowTop - rowHeight },
          end: { x: RIGHT_EDGE, y: rowTop - rowHeight },
          thickness: 0.4, color: RULE
        });
      }

      let x = MARGIN;
      cells.forEach((cellLines, i) => {
        const isBoldCell = isHeader || row[i].includes('**');
        const font = isBoldCell ? bold : regular;
        const color = isHeader ? WHITE : BLACK;
        cellLines.forEach((ln, li) => {
          draw(ln, x + 6, rowTop - 10 - li * (LINE_HEIGHT - 2), font, SIZE_TABLE, color);
        });
        x += widths[i];
      });

      y = rowTop - rowHeight;
    };

    // Never leave a header row alone at the foot of a page.
    ensure(72);
    data.forEach((row, i) => drawRow(row, i === 0));
    y -= 10;
  }

  // ── Walk the markdown ────────────────────────────────────────────────────
  newPage();

  let table: string[][] = [];
  const flushTable = (): void => {
    if (table.length) {
      renderTable(table);
      table = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();

    // Fenced code block — collect verbatim, render in a tinted box.
    if (t.startsWith('```')) {
      flushTable();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i]);
        i++;
      }
      while (body.length && body[body.length - 1].trim() === '') body.pop();
      if (!body.length) continue;

      // Keep the block whole when it can be: a listing split across a page
      // break is as hard to read as a split sentence.
      const blockHeight = body.length * CODE_LINE_HEIGHT + 12;
      if (y - blockHeight < CONTENT_BOTTOM && blockHeight <= pageTopY - CONTENT_BOTTOM) newPage();

      y -= 4;
      for (const codeLine of body) {
        ensure(CODE_LINE_HEIGHT + 6);
        page.drawRectangle({
          x: MARGIN, y: y - 3, width: CONTENT_WIDTH, height: CODE_LINE_HEIGHT, color: CODE_BG
        });
        // Truncate rather than wrap: a wrapped code line reads worse than a clipped one.
        let text = toAscii(codeLine.replace(/\t/g, '  '));
        while (regular.widthOfTextAtSize(text, SIZE_CODE) > CONTENT_WIDTH - 16 && text.length > 4) {
          text = text.slice(0, -1);
        }
        draw(text, MARGIN + 8, y, regular, SIZE_CODE);
        y -= CODE_LINE_HEIGHT;
      }
      y -= 8;
      continue;
    }

    if (t === '') {
      flushTable();
      y -= 3;
      continue;
    }

    if (t === '<!-- pagebreak -->') {
      flushTable();
      newPage();
      continue;
    }

    // Table row
    if (t.startsWith('|') && t.endsWith('|')) {
      const cells = t.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) continue; // separator row
      table.push(cells);
      continue;
    }
    flushTable();

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      ensure(16);
      y -= 4;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT_EDGE, y }, thickness: 0.5, color: RULE });
      y -= 12;
      continue;
    }

    // H1 — already the header title, never repeated in the body
    if (t.startsWith('# ')) continue;

    // Headings reserve room for themselves plus the first lines under them, so
    // a heading is never the last thing on a page.
    if (t.startsWith('## ')) {
      ensure(LINE_HEIGHT * 4 + 30);
      y -= 12;
      const joined = joinBlock(lines, i);
      i = joined.end;
      const label = stripMarkdownFormatting(joined.text.slice(3));
      headings.push({ level: 2, label, slug: slugify(joined.text.slice(3)), page, y });
      draw(label.toUpperCase(), MARGIN, y, bold, SIZE_H2);
      y -= 5;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT_EDGE, y }, thickness: 0.75, color: BLACK });
      y -= 13;
      continue;
    }

    if (t.startsWith('### ')) {
      ensure(LINE_HEIGHT * 3 + 24);
      y -= 9;
      const joined = joinBlock(lines, i);
      i = joined.end;
      const label = stripMarkdownFormatting(joined.text.slice(4));
      headings.push({ level: 3, label, slug: slugify(joined.text.slice(4)), page, y });
      draw(label.toUpperCase(), MARGIN, y, bold, SIZE_H3);
      y -= SIZE_H3 + 5;
      continue;
    }

    if (t.startsWith('#### ')) {
      ensure(LINE_HEIGHT * 3 + 20);
      y -= 7;
      const joined = joinBlock(lines, i);
      i = joined.end;
      draw(stripMarkdownFormatting(joined.text.slice(5)), MARGIN, y, bold, SIZE_H4);
      y -= SIZE_H4 + 4;
      continue;
    }

    // Blockquote — left bar, indented, muted
    if (t.startsWith('> ')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      i--;
      const text = quote.join(' ').trim();
      if (!text) continue;

      const quoteLines = layoutFlow(parseInlineBold(text), CONTENT_WIDTH - 20, SIZE_BODY);
      // Callouts are short and self-contained; splitting one is never worth it.
      reserveLines(quoteLines.length, LINE_HEIGHT, quoteLines.length);
      y -= 5;
      const barTop = y + 8;
      const startPage = page;
      emitFlow(quoteLines, MARGIN + 16, SIZE_BODY, LINE_HEIGHT);
      if (page === startPage) {
        page.drawLine({
          start: { x: MARGIN + 4, y: barTop }, end: { x: MARGIN + 4, y: y + 8 },
          thickness: 2, color: RULE
        });
      }
      y -= 5;
      continue;
    }

    const indent = raw.search(/\S/);
    const indentPx = indentSteps(indent) * 18;

    // A list item's soft-wrapped continuation lines belong to the item.
    const block = joinBlock(lines, i);
    const blockText = block.text;

    // Checkbox item
    const cbMatch = blockText.match(/^[-*]\s+\[( |x|X)\]\s+([\s\S]*)$/);
    if (cbMatch) {
      i = block.end;
      const gutter = 14;
      const body = layoutFlow(parseInlineBold(cbMatch[2]), CONTENT_WIDTH - indentPx - gutter, SIZE_BODY);
      reserveLines(body.length, LINE_HEIGHT);

      const checked = cbMatch[1].toLowerCase() === 'x';
      checkboxCount++;
      const box = form.createCheckBox(`check_${checkboxCount}`);
      box.addToPage(page, {
        x: MARGIN + indentPx, y: y - 1, width: 8, height: 8,
        borderWidth: 0.75, borderColor: BLACK, backgroundColor: WHITE
      });
      if (checked) box.check();
      emitFlow(body, MARGIN + indentPx + gutter, SIZE_BODY, LINE_HEIGHT);
      continue;
    }

    // Ordered list
    const olMatch = blockText.match(/^(\d+)\.\s+([\s\S]*)$/);
    if (olMatch) {
      i = block.end;
      const marker = `${olMatch[1]}.`;
      const gutter = regular.widthOfTextAtSize(`${marker}  `, SIZE_BODY);
      const body = layoutFlow(parseInlineBold(olMatch[2]), CONTENT_WIDTH - indentPx - gutter, SIZE_BODY);
      reserveLines(body.length, LINE_HEIGHT);
      draw(marker, MARGIN + indentPx, y, regular, SIZE_BODY);
      emitFlow(body, MARGIN + indentPx + gutter, SIZE_BODY, LINE_HEIGHT);
      continue;
    }

    // Bullet
    if (/^[-*]\s+/.test(blockText)) {
      i = block.end;
      const gutter = regular.widthOfTextAtSize('-  ', SIZE_BODY);
      const body = layoutFlow(parseInlineBold(blockText.replace(/^[-*]\s+/, '')), CONTENT_WIDTH - indentPx - gutter, SIZE_BODY);
      reserveLines(body.length, LINE_HEIGHT);
      draw('-', MARGIN + indentPx, y, regular, SIZE_BODY);
      emitFlow(body, MARGIN + indentPx + gutter, SIZE_BODY, LINE_HEIGHT);
      continue;
    }

    i = block.end;

    // Whole-line italic note
    if (/^\*[^*][\s\S]*[^*]\*$/.test(blockText)) {
      y -= 3;
      drawFlow(parseInlineBold(blockText.slice(1, -1)), MARGIN, CONTENT_WIDTH, SIZE_FOOT + 0.5, LINE_HEIGHT - 2, MUTED);
      y -= 3;
      continue;
    }

    // Paragraph
    drawFlow(parseInlineBold(blockText), MARGIN, CONTENT_WIDTH, SIZE_BODY);
    y -= 3;
  }

  flushTable();

  // ── Contents, links, bookmarks ───────────────────────────────────────────

  /** Where a jump lands: slightly above the heading, so it is not flush to the edge. */
  const destFor = (h: Heading): unknown =>
    pdfDoc.context.obj([h.page.ref, 'XYZ', MARGIN - 8, Math.min(PAGE_HEIGHT, h.y + SIZE_H2 + 18), null]);

  /**
   * Append an annotation. Checkbox widgets have already put an /Annots array on
   * some pages, so this appends rather than assigning over the top of them.
   */
  // pdf-lib's obj() overloads reject a literal assembled with conditional
  // spreads — it falls through to the array signature. This pins the shape.
  type ObjInput = Parameters<typeof pdfDoc.context.obj>[0];
  const obj = (v: object): ReturnType<typeof pdfDoc.context.obj> => pdfDoc.context.obj(v as ObjInput);

  function addAnnot(p: PDFPage, dict: object): void {
    const ref = pdfDoc.context.register(obj(dict));
    const key = PDFName.of('Annots');
    const existing = p.node.lookupMaybe(key, PDFArray);
    if (existing) existing.push(ref);
    else p.node.set(key, pdfDoc.context.obj([ref]));
  }

  const sections = headings.filter((h) => h.level === 2);

  if (sections.length > 1) {
    const tocTop = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT - 21;
    const firstRows = Math.floor((tocTop - 23 - CONTENT_BOTTOM) / TOC_LINE_HEIGHT);
    const laterRows = Math.floor((tocTop - CONTENT_BOTTOM) / TOC_LINE_HEIGHT);

    let tocPageCount = 1;
    for (let placed = firstRows; placed < sections.length; placed += laterRows) tocPageCount++;

    // Insert at the front, in order, BEFORE resolving any page number: the
    // numbers below come from getPages().indexOf(), so they count these pages.
    const tocPages: PDFPage[] = [];
    for (let n = 0; n < tocPageCount; n++) tocPages.push(pdfDoc.insertPage(n, [PAGE_WIDTH, PAGE_HEIGHT]));

    const ellipsis = regular.widthOfTextAtSize('...', SIZE_TOC);
    let idx = 0;

    tocPages.forEach((tp, n) => {
      let ty = drawHeader(tp);
      if (n === 0) {
        tp.drawText('CONTENTS', { x: MARGIN, y: ty, size: SIZE_H2, font: bold, color: BLACK });
        ty -= 5;
        tp.drawLine({ start: { x: MARGIN, y: ty }, end: { x: RIGHT_EDGE, y: ty }, thickness: 0.75, color: BLACK });
        ty -= 18;
      }

      const rows = n === 0 ? firstRows : laterRows;
      for (let r = 0; r < rows && idx < sections.length; r++, idx++) {
        const h = sections[idx];
        const num = String(pdfDoc.getPages().indexOf(h.page) + 1);
        const numWidth = regular.widthOfTextAtSize(num, SIZE_TOC);
        const room = CONTENT_WIDTH - numWidth - 24;

        let label = h.label;
        if (regular.widthOfTextAtSize(label, SIZE_TOC) > room) {
          while (label.length > 4 && regular.widthOfTextAtSize(label, SIZE_TOC) > room - ellipsis) {
            label = label.slice(0, -1);
          }
          label = `${label.trimEnd()}...`;
        }
        const labelWidth = regular.widthOfTextAtSize(label, SIZE_TOC);

        tp.drawText(label, { x: MARGIN, y: ty, size: SIZE_TOC, font: regular, color: BLACK });

        const dotFrom = MARGIN + labelWidth + 5;
        const dotTo = RIGHT_EDGE - numWidth - 5;
        const dotWidth = regular.widthOfTextAtSize('.', SIZE_TOC);
        const dots = Math.floor((dotTo - dotFrom) / dotWidth);
        if (dots > 0) {
          tp.drawText('.'.repeat(dots), { x: dotFrom, y: ty, size: SIZE_TOC, font: regular, color: RULE });
        }
        tp.drawText(num, { x: RIGHT_EDGE - numWidth, y: ty, size: SIZE_TOC, font: regular, color: BLACK });

        // The whole row is the hit area, dot leader included.
        addAnnot(tp, {
          Type: 'Annot', Subtype: 'Link', Border: [0, 0, 0],
          Rect: [MARGIN - 4, ty - 4, RIGHT_EDGE + 4, ty + SIZE_TOC + 2],
          Dest: destFor(h)
        });
        ty -= TOC_LINE_HEIGHT;
      }
    });
  }

  // Inline links. A `#anchor` becomes an internal jump when the heading exists;
  // a stale one stays underlined text rather than becoming a dead click target.
  const bySlug = new Map(headings.map((h) => [h.slug, h]));
  for (const lr of linkRects) {
    const rect = [lr.x - 1, lr.y, lr.x + lr.w + 1, lr.y + lr.h];
    if (lr.href.startsWith('#')) {
      const target = bySlug.get(lr.href.slice(1));
      if (target) {
        addAnnot(lr.page, { Type: 'Annot', Subtype: 'Link', Border: [0, 0, 0], Rect: rect, Dest: destFor(target) });
      }
      continue;
    }
    addAnnot(lr.page, {
      Type: 'Annot', Subtype: 'Link', Border: [0, 0, 0], Rect: rect,
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(lr.href) }
    });
  }

  // Reader sidebar outline: H2s at the top level, H3s collapsed underneath.
  // pdf-lib has no outline API, so the dictionary tree is built by hand.
  if (headings.length) {
    const tree: { h: Heading; kids: Heading[] }[] = [];
    for (const h of headings) {
      if (h.level === 2 || !tree.length) tree.push({ h, kids: [] });
      else tree[tree.length - 1].kids.push(h);
    }

    const outlinesRef: PDFRef = pdfDoc.context.nextRef();
    const nodeRefs: PDFRef[] = tree.map(() => pdfDoc.context.nextRef());

    tree.forEach((node, n) => {
      const kidRefs: PDFRef[] = node.kids.map(() => pdfDoc.context.nextRef());

      node.kids.forEach((kid, k) => {
        pdfDoc.context.assign(kidRefs[k], obj({
          Title: PDFHexString.fromText(kid.label),
          Parent: nodeRefs[n],
          Dest: destFor(kid),
          ...(k > 0 ? { Prev: kidRefs[k - 1] } : {}),
          ...(k < kidRefs.length - 1 ? { Next: kidRefs[k + 1] } : {})
        }));
      });

      pdfDoc.context.assign(nodeRefs[n], obj({
        Title: PDFHexString.fromText(node.h.label),
        Parent: outlinesRef,
        Dest: destFor(node.h),
        ...(n > 0 ? { Prev: nodeRefs[n - 1] } : {}),
        ...(n < nodeRefs.length - 1 ? { Next: nodeRefs[n + 1] } : {}),
        // Negative Count = start collapsed. A 40-entry tree sprung open is noise.
        ...(kidRefs.length ? { First: kidRefs[0], Last: kidRefs[kidRefs.length - 1], Count: -kidRefs.length } : {})
      }));
    });

    pdfDoc.context.assign(outlinesRef, obj({
      Type: 'Outlines',
      First: nodeRefs[0],
      Last: nodeRefs[nodeRefs.length - 1],
      Count: tree.length
    }));
    pdfDoc.catalog.set(PDFName.of('Outlines'), outlinesRef);
    pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
  }

  // ── Footer + page numbers on every page ──────────────────────────────────
  const pages = pdfDoc.getPages();
  const footerText = `${BUSINESS_INFO.name} • ${BUSINESS_INFO.owner} • ${BUSINESS_INFO.email} • ${BUSINESS_INFO.website}`;
  const footerWidth = regular.widthOfTextAtSize(footerText, SIZE_FOOT);
  pages.forEach((p, idx) => {
    p.drawLine({ start: { x: MARGIN, y: 72 }, end: { x: RIGHT_EDGE, y: 72 }, thickness: 1, color: BLACK });
    p.drawText(footerText, {
      x: (PAGE_WIDTH - footerWidth) / 2, y: 56, size: SIZE_FOOT, font: regular, color: MUTED
    });
    const num = `Page ${idx + 1} of ${pages.length}`;
    p.drawText(num, {
      x: RIGHT_EDGE - regular.widthOfTextAtSize(num, SIZE_FOOT), y: 42,
      size: SIZE_FOOT, font: regular, color: MUTED
    });
  });

  writeFileSync(outputPath, await pdfDoc.save());
  console.log(`  ${basename(outputPath).padEnd(34)} ${pages.length} pages`);
}

// ── CLI ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let title: string | undefined;
  const titleIdx = argv.indexOf('--title');
  if (titleIdx !== -1) {
    title = argv[titleIdx + 1];
    argv.splice(titleIdx, 2);
  }

  if (!argv.length) {
    console.log('Usage: npx tsx scripts/markdown-to-pdf-guide.ts <input.md|dir> [output.pdf|dir] [--title "TITLE"]');
    process.exit(1);
  }

  const input = argv[0];
  if (!existsSync(input)) {
    console.error(`Input not found: ${input}`);
    process.exit(1);
  }

  if (statSync(input).isDirectory()) {
    const outDir = argv[1] || input;
    mkdirSync(outDir, { recursive: true });
    const files = readdirSync(input).filter((f) => f.toLowerCase().endsWith('.md')).sort();
    console.log(`Converting ${files.length} file(s) -> ${outDir}\n`);
    for (const f of files) {
      await convert(join(input, f), join(outDir, f.replace(/\.md$/i, '.pdf')));
    }
    console.log('\nDone.');
    return;
  }

  const output = argv[1] || input.replace(/\.md$/i, '.pdf');
  await convert(input, output, title);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
