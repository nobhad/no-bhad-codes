/**
 * Design system token contract.
 *
 * The token files are a public contract: 15+ stylesheets and three surface bundles
 * import them by name. A rename is therefore not a refactor — it is a breaking change
 * that CSS will not report, because an unknown custom property fails silently and the
 * layout simply moves.
 *
 * These tests make that failure loud:
 *   1. A snapshot of every token NAME, so a rename or deletion must be acknowledged.
 *   2. A snapshot of the literal VALUES, so a palette or scale change is deliberate.
 *   3. Structural invariants that keep the architecture honest.
 *
 * When a change is intentional: run `vitest -u`, then read the diff before committing.
 * The diff is the review.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TOKENS_DIR = join(process.cwd(), 'src/design-system/tokens');

/** Files that declare tokens. index.css only re-exports, so it holds none. */
const tokenFiles = readdirSync(TOKENS_DIR)
  .filter((f) => f.endsWith('.css') && f !== 'index.css')
  .sort();

type Token = {
  name: string;
  value: string;
  /** The selector/at-rule chain this declaration sits inside, e.g. `@media (...) > :root`. */
  scope: string;
};

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Block-aware parser. Custom properties are routinely declared more than once per
 * file — once for the light palette and again under a dark-mode media query or a
 * [data-theme] selector. That is the theming mechanism working, not a mistake, so
 * duplicates only matter when they share a scope.
 *
 * Values may also span several lines (the font stacks do), which is why this walks
 * the text rather than reading it line by line.
 */
function parseTokens(css: string): Token[] {
  const text = stripComments(css);
  const tokens: Token[] = [];
  const stack: string[] = [];
  let buf = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      stack.push(buf.trim().replace(/\s+/g, ' '));
      buf = '';
    } else if (ch === '}') {
      stack.pop();
      buf = '';
    } else if (ch === ';') {
      const decl = buf.match(/^\s*(--[a-zA-Z0-9-]+)\s*:\s*([\s\S]+)$/);
      if (decl) {
        tokens.push({
          name: decl[1],
          value: decl[2].trim().replace(/\s+/g, ' '),
          scope: stack.join(' > ') || ':root',
        });
      }
      buf = '';
    } else {
      buf += ch;
    }
  }
  return tokens;
}

const byFile = new Map<string, Token[]>(
  tokenFiles.map((f) => [f, parseTokens(readFileSync(join(TOKENS_DIR, f), 'utf8'))])
);
const allTokens = [...byFile.values()].flat();
const allNames = [...new Set(allTokens.map((t) => t.name))].sort();

describe('design system tokens', () => {
  it('exposes the expected token names', () => {
    // The contract. A diff here means something downstream may have lost its value.
    expect(allNames).toMatchSnapshot();
  });

  it('holds the literal palette and scales steady', () => {
    // Only literal values — aliases are already covered by the name snapshot.
    const literals = [
      ...new Set(
        allTokens
          .filter((t) => !t.value.startsWith('var('))
          .map((t) => `${t.name}: ${t.value}`)
      ),
    ].sort();
    expect(literals).toMatchSnapshot();
  });

  it('keeps every token file accounted for', () => {
    expect(tokenFiles).toMatchSnapshot();
  });

  it('resolves every var() reference to a token that exists', () => {
    const known = new Set(allNames);
    const dangling: string[] = [];
    for (const { name, value } of allTokens) {
      for (const ref of value.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*(,?)/g)) {
        // A var() with a fallback still renders, so only bare references can break.
        if (!known.has(ref[1]) && ref[2] !== ',') dangling.push(`${name} → ${ref[1]}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('declares no token twice within the same scope', () => {
    // Re-declaring a token under a dark-mode query or a [data-theme] selector is how
    // theming works. Re-declaring it twice in the *same* scope is a genuine mistake:
    // the second wins silently and the first is dead code.
    const collisions: string[] = [];
    for (const [file, tokens] of byFile) {
      const seen = new Set<string>();
      for (const { name, scope } of tokens) {
        const key = `${scope}::${name}`;
        if (seen.has(key)) collisions.push(`${file} [${scope}]: ${name}`);
        seen.add(key);
      }
    }
    expect(collisions).toEqual([]);
  });

  it('keeps portal-theme.css out of the tokens index', () => {
    // portal-theme.css is imported UNLAYERED by the admin and client bundles so that it
    // beats every layered style. Importing it here would fold it into @layer tokens and
    // silently break portal theming.
    const index = readFileSync(join(TOKENS_DIR, 'index.css'), 'utf8');
    expect(index).not.toMatch(/@import\s+["']\.\/portal-theme\.css["']/);
  });
});
