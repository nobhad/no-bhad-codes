#!/usr/bin/env node
/**
 * Generates the design system documentation page from the token files themselves.
 * The docs are never hand-maintained: tokens/*.css is the single source of truth,
 * and this script is the only thing that writes docs/index.html.
 *
 *   node scripts/build-design-system-docs.mjs
 *
 * Output: public/design-system/index.html → https://nobhad.codes/design-system
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS_DIR = join(ROOT, 'src/design-system/tokens');
// Written into public/ so Vercel copies it to the deploy root verbatim.
// With cleanUrls enabled this serves at https://nobhad.codes/design-system
const OUT_DIR = join(ROOT, 'public');
const OUT_FILE = 'design-system.html';

const FILE_ORDER = [
  'colors.css', 'typography.css', 'spacing.css', 'dimensions.css',
  'borders.css', 'shadows.css', 'animations.css', 'z-index.css',
  'buttons.css', 'breakpoints.css', 'portal-theme.css',
];
const FILE_BLURB = {
  'colors.css': 'Primitive palette and the semantic tokens layered on top of it. Primitives name a colour; semantics name a job.',
  'typography.css': 'Fluid type scale built on clamp(), plus the three font families the site runs on.',
  'spacing.css': 'The spacing rhythm. Fluid values scale with the viewport.',
  'dimensions.css': 'Fixed measurements for components and layout containers.',
  'borders.css': 'Border widths and radii.',
  'shadows.css': 'Elevation. Each shadow names the surface it belongs to.',
  'animations.css': 'Durations, easing curves, and motion distances.',
  'z-index.css': 'The stacking order, named rather than numbered at the call site.',
  'buttons.css': 'Button-specific measurements, kept apart so button work does not disturb global dimensions.',
  'breakpoints.css': 'Named breakpoints and custom media queries.',
  'portal-theme.css': 'The portal surface theme. Deliberately imported unlayered so it beats every layered style.',
};

/* ---------- parse ---------- */
function parseFile(text) {
  const out = [];
  let group = null;
  // Join continuation lines: font stacks and clamp() values wrap across several lines,
  // so a declaration is only complete once we have seen its semicolon.
  const src = text.split('\n');
  const lines = [];
  for (let i = 0; i < src.length; i++) {
    let line = src[i];
    if (/^\s*--[a-zA-Z0-9-]+\s*:/.test(line) && !line.includes(';')) {
      while (i + 1 < src.length && !line.includes(';')) line += ' ' + src[++i].trim();
    }
    lines.push(line);
  }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (/^\/?\*+\s*=+\s*\*?\/?$/.test(line) || /^\*\s*=+$/.test(line)) continue;
    const banner = line.match(/^\*\s+([A-Z][A-Z0-9 \-&/(),.']{3,})$/);
    if (banner) { group = banner[1].trim(); continue; }
    const inline = line.match(/^\/\*\s*(.+?)\s*\*\/$/);
    if (inline && !line.includes('--') && inline[1].length < 90) { group = inline[1].trim(); continue; }
    const decl = raw.match(/^\s*(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?/);
    if (decl) {
      out.push({ name: decl[1], value: decl[2].trim().replace(/\s+/g, ' '), note: decl[3] || '', group: group || 'Tokens' });
    }
  }
  return out;
}

const files = readdirSync(TOKENS_DIR).filter(f => f.endsWith('.css') && f !== 'index.css');
files.sort((a, b) => {
  const ia = FILE_ORDER.indexOf(a), ib = FILE_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

const parsed = files.map(f => ({ file: f, tokens: parseFile(readFileSync(join(TOKENS_DIR, f), 'utf8')) }));

/* ---------- resolve var() aliases so semantic tokens can render a real swatch ---------- */
const lookup = new Map();
for (const { tokens } of parsed) for (const t of tokens) if (!lookup.has(t.name)) lookup.set(t.name, t.value);
function resolve(value, depth = 0) {
  if (depth > 6) return value;
  const m = value.match(/^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (!m) return value;
  const target = lookup.get(m[1]);
  if (target) return resolve(target, depth + 1);
  return m[2] ? resolve(m[2].trim(), depth + 1) : value;
}

const isColor = v => /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|rgba|hsl|hsla)\(/i.test(v);
const isRgbTriplet = v => /^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(v);
const isShadow = v => /\d+(px|rem)/.test(v) && /(rgba?\(|#[0-9a-f]{3,8})/i.test(v) && /\s/.test(v);
const isLength = v => /^(clamp\(|calc\(|-?[\d.]+(px|rem|em|vw|vh|ch|%)$)/.test(v);
const isDuration = v => /^[\d.]+m?s$/.test(v);
const isFont = v => /,/.test(v) && /(serif|sans-serif|monospace|system-ui|ui-monospace)/.test(v);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const totals = { files: parsed.length, tokens: parsed.reduce((n, p) => n + p.tokens.length, 0) };
const unique = new Set(); for (const { tokens } of parsed) for (const t of tokens) unique.add(t.name);

/* ---------- render ---------- */
function renderToken(t) {
  const resolved = resolve(t.value);
  let preview = '';
  if (isColor(resolved)) {
    preview = '<span class="sw" style="background:' + esc(resolved) + '"></span>';
  } else if (isRgbTriplet(resolved)) {
    preview = '<span class="sw" style="background:rgb(' + esc(resolved) + ')"></span>';
  } else if (isShadow(resolved)) {
    preview = '<span class="sw sw-shadow" style="box-shadow:' + esc(resolved) + '"></span>';
  } else if (isFont(resolved)) {
    preview = '<span class="sw-type" style="font-family:' + esc(resolved) + '">Ag</span>';
  } else if (isLength(resolved) && !/^calc/.test(resolved)) {
    preview = '<span class="sw-bar" style="width:' + esc(resolved) + '"></span>';
  } else if (isDuration(resolved)) {
    preview = '<span class="sw-dur">' + esc(resolved) + '</span>';
  }
  const alias = t.value !== resolved && /^var\(/.test(t.value)
    ? '<span class="alias">→ ' + esc(resolved) + '</span>' : '';
  return '<tr><td class="c-prev">' + preview + '</td>' +
    '<td class="c-name"><code>' + esc(t.name) + '</code></td>' +
    '<td class="c-val"><code>' + esc(t.value) + '</code>' + alias + '</td>' +
    '<td class="c-note">' + esc(t.note) + '</td></tr>';
}

function renderFile(p) {
  const id = p.file.replace('.css', '');
  const groups = [];
  for (const t of p.tokens) {
    if (!groups.length || groups[groups.length - 1].name !== t.group) groups.push({ name: t.group, items: [] });
    groups[groups.length - 1].items.push(t);
  }
  return '<section class="file" id="' + id + '">' +
    '<header class="file-head"><h2>' + esc(id.replace(/-/g, ' ')) + '</h2>' +
    '<p class="blurb">' + esc(FILE_BLURB[p.file] || '') + '</p>' +
    '<p class="count"><span>' + p.tokens.length + '</span> tokens · <code>' + esc(p.file) + '</code></p></header>' +
    groups.map(g =>
      '<div class="group"><h3>' + esc(g.name) + '</h3>' +
      '<div class="tw"><table>' + g.items.map(renderToken).join('') + '</table></div></div>'
    ).join('') + '</section>';
}

const nav = parsed.map(p => {
  const id = p.file.replace('.css', '');
  return '<a href="#' + id + '">' + esc(id.replace(/-/g, ' ')) + '<span>' + p.tokens.length + '</span></a>';
}).join('');

const LAYERS = ['reset', 'tokens', 'base', 'components', 'layouts', 'pages', 'states', 'responsive', 'utilities'];

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>No Bhad Codes Design System</title>
<script>
  // Same theme bootstrap the site uses, so this page opens in whatever
  // theme the visitor last chose rather than its own default.
  (function () {
    try {
      var saved = localStorage.getItem('theme');
      var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', saved || (systemDark ? 'dark' : 'light'));
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
</script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Acme&family=Cormorant+Garamond:wght@400;600;700&family=Inconsolata:wght@400;500;700&display=swap">
<style>
:root{
  --ds-crimson:#dc2626; --ds-emerald:#10b981;
  --ds-ink:#171717; --ds-ink-2:#404040; --ds-muted:#737373;
  --ds-paper:#f5f5f5; --ds-surface:#ffffff; --ds-line:#e0e0e0; --ds-line-soft:#ededed;
  --ds-serif:"Cormorant Garamond",Georgia,Cambria,serif;
  --ds-mono:"Inconsolata",ui-monospace,"Cascadia Code",Menlo,monospace;
  --ds-display:"Acme",var(--ds-serif),sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ds-crimson:#f87171; --ds-emerald:#34d399;
  --ds-ink:#f4f4f4; --ds-ink-2:#c0c0c0; --ds-muted:#a0a0a0;
  --ds-paper:#0a0a0a; --ds-surface:#1a1a1a; --ds-line:#2a2a2a; --ds-line-soft:#242424;
}}
:root[data-theme="dark"]{
  --ds-crimson:#f87171; --ds-emerald:#34d399;
  --ds-ink:#f4f4f4; --ds-ink-2:#c0c0c0; --ds-muted:#a0a0a0;
  --ds-paper:#0a0a0a; --ds-surface:#1a1a1a; --ds-line:#2a2a2a; --ds-line-soft:#242424;
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--ds-paper);color:var(--ds-ink);font-family:var(--ds-mono);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}
a{color:inherit}
code{font-family:var(--ds-mono);font-size:.86em}

/* masthead */
.mast{border-bottom:1px solid var(--ds-line);background:var(--ds-surface)}
.mast-in{display:flex;flex-direction:column;gap:28px;padding:56px 24px 40px;max-width:1180px;margin:0 auto}
.brand{font-family:var(--ds-display);font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:var(--ds-crimson)}
h1{font-family:var(--ds-serif);font-weight:700;font-size:clamp(2.6rem,1.8rem+3vw,4.2rem);line-height:1.02;margin:0;text-wrap:balance;letter-spacing:-.01em}
.lede{font-size:16px;color:var(--ds-ink-2);max-width:62ch;margin:0}
.stats{display:flex;flex-wrap:wrap;gap:0;border:1px solid var(--ds-line);border-radius:2px;overflow:hidden}
.stat{flex:1 1 150px;padding:16px 20px;border-right:1px solid var(--ds-line)}
.stat:last-child{border-right:0}
.stat b{display:block;font-family:var(--ds-serif);font-size:2.1rem;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;color:var(--ds-crimson)}
.stat span{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ds-muted)}

/* architecture */
.arch{padding:52px 0;border-bottom:1px solid var(--ds-line)}
.arch h2,.file-head h2{font-family:var(--ds-serif);font-weight:700;letter-spacing:-.01em}
.arch h2{font-size:1.9rem;margin:0 0 8px}
.arch p{color:var(--ds-ink-2);max-width:70ch}
.layers{display:flex;flex-direction:column;gap:3px;margin:26px 0 0;counter-reset:l}
.layer{display:flex;align-items:center;gap:14px;padding:9px 16px;background:var(--ds-surface);border:1px solid var(--ds-line);border-radius:2px;font-size:13.5px}
.layer::before{counter-increment:l;content:counter(l);font-variant-numeric:tabular-nums;color:var(--ds-muted);font-size:11px;min-width:16px}
.layer.tk{border-color:var(--ds-crimson);box-shadow:inset 3px 0 0 var(--ds-crimson)}
.layer em{margin-left:auto;font-style:normal;color:var(--ds-muted);font-size:12px}
.pull{margin:26px 0 0;padding:18px 22px;border-left:2px solid var(--ds-crimson);background:var(--ds-surface);font-size:14px;color:var(--ds-ink-2)}
.pull b{color:var(--ds-ink);font-weight:500}

/* nav */
.nav{position:sticky;top:0;z-index:10;background:var(--ds-paper);border-bottom:1px solid var(--ds-line)}
.nav-in{display:flex;gap:2px;overflow-x:auto;padding:10px 24px;max-width:1180px;margin:0 auto}
.nav a{flex:0 0 auto;display:flex;align-items:baseline;gap:6px;padding:5px 11px;border-radius:2px;text-decoration:none;font-size:12.5px;color:var(--ds-ink-2);white-space:nowrap;text-transform:capitalize}
.nav a:hover,.nav a:focus-visible{background:var(--ds-surface);color:var(--ds-ink)}
.nav a span{font-size:10.5px;color:var(--ds-muted);font-variant-numeric:tabular-nums}

/* files */
.file{padding:52px 0;border-bottom:1px solid var(--ds-line);scroll-margin-top:52px}
.file-head h2{font-size:1.85rem;margin:0 0 6px;text-transform:capitalize}
.blurb{margin:0;color:var(--ds-ink-2);max-width:68ch}
.count{margin:10px 0 0;font-size:12px;color:var(--ds-muted)}
.count span{color:var(--ds-crimson);font-weight:700;font-variant-numeric:tabular-nums}
.group{margin-top:32px}
.group h3{font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ds-muted);margin:0 0 10px;font-weight:500}
.tw{overflow-x:auto;border:1px solid var(--ds-line);border-radius:2px;background:var(--ds-surface)}
table{width:100%;border-collapse:collapse;font-size:13px}
tr{border-bottom:1px solid var(--ds-line-soft)}
tr:last-child{border-bottom:0}
td{padding:7px 12px;vertical-align:middle}
.c-prev{width:56px}
.c-name{white-space:nowrap}
.c-name code{color:var(--ds-ink)}
.c-val code{color:var(--ds-ink-2)}
.c-note{color:var(--ds-muted);font-size:12px;max-width:30ch}
.alias{display:block;color:var(--ds-muted);font-size:11.5px}
.sw{display:block;width:32px;height:20px;border-radius:2px;border:1px solid var(--ds-line)}
.sw-shadow{background:var(--ds-surface)}
.sw-type{font-size:17px;color:var(--ds-ink)}
.sw-bar{display:block;height:8px;max-width:100%;background:var(--ds-crimson);border-radius:1px;min-width:2px}
.sw-dur{font-size:11px;color:var(--ds-muted);font-variant-numeric:tabular-nums}

/* Site chrome — header from src/styles/components/nav-base.css, footer from
   src/styles/components/footer.css, so this page wears the same frame as
   every other page. Values are copied because this file is generated
   standalone and cannot import the hashed site bundle. */
:root{--nbc-nav:#333333;--nbc-accent:#dc2626;--nbc-shadow:rgba(0,0,0,.2);--nbc-pad:clamp(1rem,4vw,2rem)}
:root[data-theme="dark"]{--nbc-nav:#fafafa;--nbc-shadow:rgba(0,0,0,1)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--nbc-nav:#fafafa;--nbc-shadow:rgba(0,0,0,1)}}
.site-header{position:sticky;top:0;left:0;right:0;width:100%;z-index:20;background:var(--ds-paper);font-family:var(--ds-display);padding:0;padding-top:env(safe-area-inset-top,0)}
.site-header-in{padding:0 var(--nbc-pad)}
.site-nav-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;width:100%;min-height:40px;flex-wrap:nowrap}
.site-brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--nbc-nav);font-weight:600;font-size:20px;text-shadow:0 2px 4px var(--nbc-shadow);text-transform:uppercase;white-space:nowrap;flex-shrink:0;transition:color .3s ease}
.site-brand:hover,.site-brand:active{color:var(--nbc-accent)}
.site-nav-right{display:flex;align-items:center;gap:16px;flex-shrink:0;white-space:nowrap}
.site-icon,.site-menu{display:flex;align-items:center;gap:12px;background:none;border:none;cursor:pointer;padding:8px 0;min-height:40px;color:var(--nbc-nav);text-transform:uppercase;flex-shrink:0;font-family:inherit;font-size:inherit;line-height:inherit;text-decoration:none;text-shadow:0 2px 4px var(--nbc-shadow);transition:color .3s ease}
.site-icon:hover,.site-menu:hover{color:var(--nbc-accent)}
.site-icon{justify-content:center;width:40px;height:40px;border-radius:9999px;padding:0}
.site-icon svg{width:20px;height:20px}
.site-menu{font-size:20px;font-weight:600}
.site-menu svg{width:16px;height:16px}
:root[data-theme="light"] .site-icon .icon-sun{display:none}
:root[data-theme="dark"] .site-icon .icon-moon{display:none}
.site-footer{display:flex;align-items:center;justify-content:flex-end;height:40px;padding:0 2rem;font-size:clamp(.875rem,.825rem + .25vw,1rem);color:var(--ds-ink);text-align:right}
.site-footer p{margin:0}

footer.docs-note{padding:44px 0 24px;color:var(--ds-muted);font-size:12.5px}
footer.docs-note b{color:var(--ds-ink);font-weight:500}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
:focus-visible{outline:2px solid var(--ds-crimson);outline-offset:2px}
</style>

<header class="site-header"><div class="site-header-in">
  <nav class="site-nav-row">
    <a class="site-brand" href="/" aria-label="No Bhad Codes home">No Bhad Codes</a>
    <div class="site-nav-right">
      <a class="site-icon" href="/#/portal" aria-label="Client Portal Login">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/></svg>
      </a>
      <button type="button" class="site-icon" id="ds-theme-toggle" aria-label="Toggle dark/light theme">
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"/></svg>
      </button>
      <a class="site-menu" href="/" aria-label="Back to the site">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M7.33333 16L7.33333 0L8.66667 0L8.66667 16L7.33333 16Z" fill="currentColor"/><path d="M16 8.66667L0 8.66667L0 7.33333L16 7.33333L16 8.66667Z" fill="currentColor"/></svg>
        Menu
      </a>
    </div>
  </nav>
</div></header>

<header class="mast"><div class="mast-in">
  <div class="brand">No Bhad Codes</div>
  <h1>The design system<br>behind nobhad.codes</h1>
  <p class="lede">Every colour, measurement, and duration on the site is a named token. Nothing is hardcoded in a component stylesheet, and this page is generated from the token files themselves &mdash; so it cannot drift from what actually ships.</p>
  <div class="stats">
    <div class="stat"><b>${unique.size}</b><span>unique tokens</span></div>
    <div class="stat"><b>${totals.files}</b><span>token files</span></div>
    <div class="stat"><b>${LAYERS.length}</b><span>cascade layers</span></div>
    <div class="stat"><b>3</b><span>themed surfaces</span></div>
  </div>
</div></header>

<div class="wrap"><section class="arch">
  <h2>Cascade architecture</h2>
  <p>Specificity fights are a design system's most common failure. This one declares its layer order once, up front, so where a rule sits is a decision rather than an accident of selector weight.</p>
  <div class="layers">
    ${LAYERS.map(l => '<div class="layer' + (l === 'tokens' ? ' tk' : '') + '"><code>' + l + '</code>' + (l === 'tokens' ? '<em>the source of truth below</em>' : '') + '</div>').join('\n    ')}
  </div>
  <p class="pull"><b>One deliberate exception.</b> <code>portal-theme.css</code> is not imported into the tokens layer. It is imported unlayered by the admin and client bundles, because unlayered styles beat every layered style &mdash; which is exactly what a surface theme needs to do. Three surfaces (main site, admin portal, client portal) draw on one token foundation, and the portal theme wins on the two that need it.</p>
</section></div>

<nav class="nav"><div class="nav-in">${nav}</div></nav>

<div class="wrap">
${parsed.map(renderFile).join('\n')}
<footer class="docs-note">This page is generated from <b>src/design-system/tokens/*.css</b> at build time &mdash; the token files are the single source of truth, and nothing here is written by hand. Hand-maintained documentation of a token layer is wrong within a month.</footer>
</div>

<footer class="site-footer">
  <p>&copy; <span id="ds-year"></span> Made &amp; Designed by No Bhad Codes. All rights reserved.</p>
</footer>

<script>
  document.getElementById('ds-year').textContent = new Date().getFullYear();
  document.getElementById('ds-theme-toggle').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
</script>`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, OUT_FILE), html);
console.log('design system docs → public/' + OUT_FILE + '  (serves at /design-system)');
console.log('  ' + unique.size + ' unique tokens across ' + totals.files + ' files (' + totals.tokens + ' declarations)');
