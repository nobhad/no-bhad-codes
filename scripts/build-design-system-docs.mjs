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
const OUT_DIR = ROOT;
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
<html lang="en" class="intro-complete intro-finished" data-theme="light" data-initial-page="design-system">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design System — No Bhad Codes</title>
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
<script type="module" src="/src/static-page.ts"></script>
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

/* The site stylesheet now supplies this page's chrome, and its heading
   rules reach the docs body too — uppercasing and centring type this page
   sets deliberately. Unlayered, so these win over the site's layered rules
   without !important. Scoped to the document, never the chrome. */
#main-content h1,#main-content h2,#main-content h3,#main-content p{text-transform:none;text-align:left;letter-spacing:normal}
#main-content h1{font-family:var(--ds-serif);letter-spacing:-.01em}
#main-content h2{font-family:var(--ds-serif);letter-spacing:-.01em}
/* Off-map page: it declares data-active-page, which is how the site lets a
   page scroll for real instead of behaving as a map tile (see the rule in
   components/site-map.css). Nothing here sets a height — main takes the
   viewport from the shared rule and this content is free to be as long as
   it is. */
#main-content{background:var(--ds-paper);color:var(--ds-ink)}
.docs-section{
  /* The measure the case study opens and closes on: the header's height
     plus the tile pad. --map-tile-pad-y resolves to --space-6 at every
     width, so the token is composed directly rather than read through the
     .site-map-scoped variable this page sits outside of. */
  padding-top:calc(var(--header-height) + var(--space-6));
  padding-bottom:calc(var(--header-height) + var(--space-6))}

footer.docs-note{padding:44px 0 24px;color:var(--ds-muted);font-size:12.5px}
footer.docs-note b{color:var(--ds-ink);font-weight:500}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
:focus-visible{outline:2px solid var(--ds-crimson);outline-offset:2px}
</style>

<body data-page="design-system">

    <header class="header">
      <div class="container is--full">
        <nav class="nav-row">
          <a href="/" aria-label="no bhad codes - Go to homepage" class="nav-logo-row">
            no bhad codes
          </a>
          <div class="nav-row__right">
            <!-- CLIENT PORTAL BUTTON -->
            <button class="portal-button" aria-label="Client Portal Login" id="portal-trigger">
              <div class="icon-wrap">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 20a6 6 0 0 0-12 0" />
                  <circle cx="12" cy="10" r="4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
            </button>

            <button id="toggle-theme" class="theme-button" aria-label="Toggle dark/light theme">
              <div class="icon-wrap">
                <svg
                  class="theme-icon sun-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"></circle>
                  <path
                    d="M12 2V4M12 20V22M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                    stroke="currentColor"
                    stroke-width="2"
                  ></path>
                </svg>
                <svg
                  class="theme-icon moon-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z"></path>
                </svg>
              </div>
            </button>
            <!-- aria-label mirrors the visible word ("Menu" / "Close") so the
                 accessible name always contains it (WCAG 2.5.3 Label in Name);
                 navigation.ts swaps it alongside aria-expanded. -->
            <button
              data-menu-toggle=""
              class="menu-button"
              aria-label="Menu"
              aria-expanded="false"
            >
              <div class="icon-wrap">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="100%"
                  viewBox="0 0 16 16"
                  fill="none"
                  class="menu-button-icon"
                  aria-hidden="true"
                >
                  <path
                    d="M7.33333 16L7.33333 -3.2055e-07L8.66667 -3.78832e-07L8.66667 16L7.33333 16Z"
                    fill="currentColor"
                  ></path>
                  <path
                    d="M16 8.66667L-2.62269e-07 8.66667L-3.78832e-07 7.33333L16 7.33333L16 8.66667Z"
                    fill="currentColor"
                  ></path>
                  <path
                    d="M6 7.33333L7.33333 7.33333L7.33333 6C7.33333 6.73637 6.73638 7.33333 6 7.33333Z"
                    fill="currentColor"
                  ></path>
                  <path
                    d="M10 7.33333L8.66667 7.33333L8.66667 6C8.66667 6.73638 9.26362 7.33333 10 7.33333Z"
                    fill="currentColor"
                  ></path>
                  <path
                    d="M6 8.66667L7.33333 8.66667L7.33333 10C7.33333 9.26362 6.73638 8.66667 6 8.66667Z"
                    fill="currentColor"
                  ></path>
                  <path
                    d="M10 8.66667L8.66667 8.66667L8.66667 10C8.66667 9.26362 9.26362 8.66667 10 8.66667Z"
                    fill="currentColor"
                  ></path>
                </svg>
              </div>
              <div class="menu-button-text">
                <p class="p-large">Menu</p>
                <p class="p-large">Close</p>
              </div>
            </button>
          </div>
        </nav>
      </div>
    </header>

<main id="main-content" data-active-page="design-system">
<section class="docs-section">

<header class="mast"><div class="mast-in">
  <h1>One design system,<br>two products</h1>
  <p class="lede">The same token foundation serves <b>nobhad.codes</b>, the public site, and <b>The Backend</b>, the client and admin portal behind it. Every colour, measurement, and duration is a named token; nothing is hardcoded in a component stylesheet. The two do not look alike, and that is the point &mdash; the portal draws on this foundation and then overlays its own surface theme, so a shared vocabulary produces two deliberately different products. This page is generated from the token files themselves, so it cannot drift from what actually ships.</p>
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
  <p class="pull"><b>How the portal looks different.</b> <code>portal-theme.css</code> is not imported into the tokens layer. The admin and client bundles import it unlayered, because unlayered styles beat every layered style &mdash; which is exactly what a surface theme needs to do. That single decision is what lets The Backend read as its own product while still spending the same tokens: three surfaces (main site, admin portal, client portal) on one foundation, with the portal theme winning on the two that need it.</p>
</section></div>

<nav class="nav"><div class="nav-in">${nav}</div></nav>

<div class="wrap">
${parsed.map(renderFile).join('\n')}
<footer class="docs-note">This page is generated from <b>src/design-system/tokens/*.css</b> at build time &mdash; the token files are the single source of truth, and nothing here is written by hand. Hand-maintained documentation of a token layer is wrong within a month.</footer>
</div>

</section>
</main>

    <footer class="footer">
      <!-- Black curtain. Sits below the viewport edge until the active page's
           scroll container reaches its end; FooterCurtainModule drives the
           reveal with GSAP, scrubbed against the last stretch of scroll. -->
      <div class="footer-curtain" data-footer-curtain aria-hidden="true">
        <div class="footer-curtain__inner" data-footer-curtain-inner>
          <div class="footer-curtain__brand">
            <img
              class="footer-curtain__avatar"
              src="/images/avatar.svg"
              alt=""
              width="288"
              height="356"
              loading="lazy"
              decoding="async"
            />
            <p class="footer-curtain__wordmark">no bhad codes</p>
          </div>

          <p class="footer-curtain__copy">
            &copy; <span class="js-copyright-year"></span> Made &amp; Designed by No Bhad Codes. All
            rights reserved.
          </p>
        </div>
      </div>
    </footer>

<script type="module" src="/src/utils/set-copyright-year.ts"></script>

</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, OUT_FILE), html);
console.log('design system docs → ' + OUT_FILE + '  (serves at /design-system)');
console.log('  ' + unique.size + ' unique tokens across ' + totals.files + ' files (' + totals.tokens + ' declarations)');
