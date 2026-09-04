/**
 * Design system contract, checked against the RESOLVED BUNDLE.
 *
 * tokens.test.ts guards the token files themselves: their names, their literal
 * values, and that nothing inside `src/design-system/tokens` reads a token that
 * directory does not declare. That is necessary but not sufficient, because a
 * stylesheet does not consume tokens from a directory — it consumes them from
 * whichever bundle happens to `@import` it. A file can therefore be perfectly
 * correct on its own and still be broken in one of the three surfaces, and no
 * existing test can see it. That is the gap this file closes: it walks the
 * `@import` graph of each real bundle and asks whether every `var()` inside it
 * resolves against the definitions that same bundle actually ships.
 *
 * It also disagrees with its sibling on one point, deliberately. tokens.test.ts
 * skips any `var()` that carries a fallback, on the reasoning that a fallback
 * still renders. It does render — with the wrong value, forever, silently, and
 * that is strictly harder to notice than a missing one. `--text-rgb` is the
 * worked example: `base/reset.css` asked for
 * `rgba(var(--text-rgb, 25, 25, 25), 0.7)`, the property was never defined
 * anywhere in the repository, so every theme got the hardcoded near-black
 * fallback and the "theme-aware scrollbar" above it was a comment describing
 * something that had never happened. In dark mode the thumb sat at 1.48:1
 * against the page. A bare `var()` at least drops the declaration loudly enough
 * that someone eventually looks. So both are reported here, split by severity:
 *
 *   DROPPED  - no fallback. The whole declaration is discarded by the parser.
 *   FALLBACK - the fallback is load-bearing by accident, which nobody intended.
 *
 * DROPPED is asserted empty. It was 11 when this file was written — all on the
 * public site, and 7 of them one root cause: bundles/foundation.css imported
 * two portal stylesheets whose tokens are defined only under
 * body[data-page="admin"|"client"] in portal-theme.css, so the site rendered
 * toasts with no width bounds and form selects with `appearance: none` and no
 * caret drawn in place of the one it removed. Those are fixed, so the list is a
 * hard gate now: any new one fails the build outright, with no snapshot to
 * update around it.
 *
 * The other two lists are still snapshots, because neither is empty yet. That
 * makes them a ratchet: a new gap fails the build, and so does fixing one
 * without recording it, so they can only shrink. Same workflow as the sibling
 * file — run `vitest -u`, then read the diff. The diff is the review.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize, relative } from 'node:path';

const ROOT = process.cwd();

/** The three bundles that are actually served. See vite.config.ts rollupOptions.input. */
const BUNDLE_ENTRIES = {
  site: 'src/styles/bundles/site.css',
  client: 'src/styles/bundles/client.css',
  admin: 'src/styles/bundles/admin.css'
} as const;
type BundleName = keyof typeof BUNDLE_ENTRIES;

/**
 * Properties supplied by a third-party at runtime, which therefore have no
 * declaration in our CSS and never will. Prefix-matched.
 */
const EXTERNAL_PREFIXES = [
  '--radix-' // Radix UI writes these onto the trigger/content elements itself.
];

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Resolve a bundle to the ordered list of files it pulls in.
 *
 * Depth-first and in source order, so the result matches what the browser sees.
 * A file is visited once: CSS `@import` de-duplicates, and cycles would
 * otherwise hang this.
 */
function resolveGraph(entry: string): string[] {
  const seen: string[] = [];
  const stack = [entry];
  while (stack.length) {
    const file = normalize(stack.shift() as string);
    if (seen.includes(file) || !existsSync(file)) continue;
    seen.push(file);
    const deps = [...stripComments(readFileSync(file, 'utf8')).matchAll(/@import\s+["']([^"']+)["']/g)].map(
      (m) => normalize(join(dirname(file), m[1]))
    );
    stack.unshift(...deps);
  }
  return seen;
}

/**
 * Custom properties written from TypeScript at runtime.
 *
 * Discovered rather than listed, so adding a `setProperty` call does not
 * require also remembering to update an allowlist here. Only `setProperty` is
 * matched: it is the one form that unambiguously *defines* a property, whereas
 * a bare string literal naming one could just as easily be a read.
 *
 * TWO shapes, because one was not enough. Matching only a literal argument
 * meant that naming the property first — which is what you do the moment two
 * call sites share it —
 *
 *     const BANNER_HEIGHT_VAR = '--consent-banner-height';
 *     el.style.setProperty(BANNER_HEIGHT_VAR, `${h}px`);
 *
 * read as no definition at all, and the property was reported as living on its
 * fallback in every bundle that used it. The rule silently punished the tidier
 * of the two ways to write the same thing. So a file-local `const NAME =
 * '--prop'` is resolved back through `setProperty(NAME, …)`.
 *
 * File-local and one level deep on purpose. Following an imported constant
 * would mean resolving modules, and a property whose name is assembled at
 * runtime cannot be found by reading the source at all — at which point the
 * honest answer is a comment in the stylesheet, not more regex.
 */
function runtimeDefinedProps(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        if (!/node_modules|\.git/.test(p)) walk(p);
      } else if (/\.tsx?$/.test(entry)) {
        const text = readFileSync(p, 'utf8');

        // setProperty('--foo', …)
        for (const m of text.matchAll(/setProperty\(\s*[`'"](--[A-Za-z0-9_-]+)/g)) {
          found.add(m[1]);
        }

        // const FOO = '--foo'  →  setProperty(FOO, …)
        const named = new Map<string, string>();
        for (const m of text.matchAll(
          /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*[`'"](--[A-Za-z0-9_-]+)[`'"]/g
        )) {
          named.set(m[1], m[2]);
        }
        for (const m of text.matchAll(/setProperty\(\s*([A-Za-z_$][\w$]*)\s*,/g)) {
          const prop = named.get(m[1]);
          if (prop) found.add(prop);
        }
      }
    }
  };
  walk(join(ROOT, 'src'));
  return found;
}

const RUNTIME_PROPS = runtimeDefinedProps();
const isExternal = (prop: string) => EXTERNAL_PREFIXES.some((p) => prop.startsWith(p));

const GRAPHS = Object.fromEntries(
  Object.entries(BUNDLE_ENTRIES).map(([name, entry]) => [name, resolveGraph(entry)])
) as Record<BundleName, string[]>;

/** Every custom property this set of files declares. */
function definitionsIn(files: string[]): Set<string> {
  const defs = new Set<string>();
  for (const f of files) {
    for (const m of stripComments(readFileSync(f, 'utf8')).matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) defs.add(m[1]);
  }
  return defs;
}

type Gap = { prop: string; dropped: boolean; file: string };

/** Every var() read in this bundle that the bundle itself cannot satisfy. */
function gapsIn(bundle: BundleName): Gap[] {
  const files = GRAPHS[bundle];
  const defined = definitionsIn(files);
  const firstSeen = new Map<string, Gap>();
  for (const f of files) {
    for (const m of stripComments(readFileSync(f, 'utf8')).matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*(,?)/g)) {
      const prop = m[1];
      if (defined.has(prop) || RUNTIME_PROPS.has(prop) || isExternal(prop)) continue;
      if (!firstSeen.has(prop)) {
        firstSeen.set(prop, { prop, dropped: m[2] !== ',', file: relative(ROOT, f) });
      }
    }
  }
  return [...firstSeen.values()];
}

const ALL_GAPS = Object.fromEntries(
  (Object.keys(BUNDLE_ENTRIES) as BundleName[]).map((b) => [b, gapsIn(b)])
) as Record<BundleName, Gap[]>;

const format = (b: BundleName, g: Gap) => `${b}: ${g.prop} (${g.file})`;
const collect = (dropped: boolean) =>
  (Object.keys(BUNDLE_ENTRIES) as BundleName[])
    .flatMap((b) => ALL_GAPS[b].filter((g) => g.dropped === dropped).map((g) => format(b, g)))
    .sort();

/**
 * Single-class rules, e.g. `.mt-4 { ... }`.
 *
 * Deliberately only the simplest shape: one class, no combinator, no compound.
 * Those are the selectors that read as a shared vocabulary — a utility someone
 * types from memory expecting it to mean one thing — so they are the ones where
 * two different meanings actually hurt. Anything more specific is a considered
 * override and is none of this test's business.
 */
function singleClassRules(file: string): { sel: string; body: string }[] {
  const text = stripComments(readFileSync(file, 'utf8'));
  const out: { sel: string; body: string }[] = [];
  for (const m of text.matchAll(/(?:^|[{}])\s*(\.[-A-Za-z0-9_]+)\s*\{([^{}]*)\}/g)) {
    const body = m[2]
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .sort()
      .join('; ');
    if (body) out.push({ sel: m[1], body });
  }
  return out;
}

const bundlesContaining = (file: string): BundleName[] =>
  (Object.keys(BUNDLE_ENTRIES) as BundleName[]).filter((b) =>
    GRAPHS[b].some((f) => relative(ROOT, f) === file)
  );

/**
 * Selectors that resolve to different declarations depending on which surface
 * you are on.
 *
 * Only reported when the competing definitions live in bundle sets that never
 * overlap. Two definitions inside one bundle are just the cascade, and the
 * layer order decides them; two definitions in bundles that never meet are a
 * name meaning two different things, which no cascade can adjudicate and no
 * reader can predict.
 */
function ambiguousSelectors(): string[] {
  const bySel = new Map<string, Map<string, Set<string>>>();
  for (const b of Object.keys(BUNDLE_ENTRIES) as BundleName[]) {
    for (const f of GRAPHS[b]) {
      const rel = relative(ROOT, f);
      for (const { sel, body } of singleClassRules(f)) {
        if (!bySel.has(sel)) bySel.set(sel, new Map());
        const variants = bySel.get(sel) as Map<string, Set<string>>;
        if (!variants.has(body)) variants.set(body, new Set());
        (variants.get(body) as Set<string>).add(rel);
      }
    }
  }

  const rows: string[] = [];
  for (const [sel, variants] of bySel) {
    if (variants.size < 2) continue;
    const groups = [...variants].map(([, files]) => ({
      files: [...files].sort(),
      bundles: new Set([...files].flatMap(bundlesContaining))
    }));
    const disjoint = groups.every((a, i) =>
      groups.every((b, j) => i === j || [...a.bundles].every((x) => !b.bundles.has(x)))
    );
    if (!disjoint) continue;
    const detail = groups
      .map((g) => `[${[...g.bundles].sort().join('+')}] ${g.files[0]}`)
      .sort()
      .join('  vs  ');
    rows.push(`${sel} — ${detail}`);
  }
  return rows.sort();
}

describe('css bundle contract', () => {
  it('resolves every bundle to a non-trivial graph', () => {
    // Guards the walker itself. If an @import syntax change ever made this
    // resolve to nothing, every check below would pass by vacuum.
    for (const b of Object.keys(BUNDLE_ENTRIES) as BundleName[]) {
      expect(GRAPHS[b].length, `${b} graph`).toBeGreaterThan(20);
      expect(definitionsIn(GRAPHS[b]).size, `${b} definitions`).toBeGreaterThan(100);
    }
  });

  it('never ships a var() whose declaration the browser DROPS', () => {
    // No fallback and no definition: the parser discards the whole declaration,
    // so the property silently reverts to its inherited or initial value. This
    // is at zero and stays there — give the token a home in the shared layer,
    // or stop importing the stylesheet into a bundle that cannot feed it.
    expect(collect(true)).toEqual([]);
  });

  it('lists every var() silently living on its fallback', () => {
    // Defined nowhere in the bundle, so the fallback is not a fallback — it is
    // the value, and it cannot respond to theme, breakpoint or surface.
    // This is the --text-rgb failure mode.
    expect(collect(false)).toMatchSnapshot();
  });

  it('lists every class that means different things on different surfaces', () => {
    // `.mt-4` is the worked example: base/utilities.css counts in 8px steps
    // (.mt-3 -> --space-3, 24px) while portal-layout.css counts in Tailwind's
    // 4px steps (.mt-4 -> --space-2, 16px). Neither is wrong; both being
    // spelled `.mt-4` is. They collide only in a reader's head today, because
    // no page loads both files — which is exactly why nothing catches it.
    expect(ambiguousSelectors()).toMatchSnapshot();
  });
});
