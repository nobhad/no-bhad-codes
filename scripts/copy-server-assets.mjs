/**
 * Copy the server's non-TypeScript runtime files into the compiled output.
 *
 * `tsc` emits only .js for .ts inputs, so everything the server reads from disk
 * at runtime is silently absent from dist/: the EJS views (every rendered page,
 * including the 404), the .sql migrations (the server refuses to boot without
 * them), and the email templates. The failure is quiet rather than loud — a
 * missing view makes res.render fail and the route falls through to its JSON
 * fallback — so it has to be handled here rather than noticed later.
 *
 * Databases are deliberately excluded: they are runtime state and live on the
 * mounted volume, not in the build.
 */
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist', 'server', 'server');

// Anything that is not source and not runtime state.
const SKIP_EXT = new Set(['.ts', '.db', '.sqlite', '.sqlite3', '.db-shm', '.db-wal']);
const SKIP_NAME = new Set(['.DS_Store']);

const DIRS = ['views', 'database/migrations', 'templates', 'config'];

let copied = 0;
for (const rel of DIRS) {
  const from = path.join(ROOT, 'server', rel);
  if (!existsSync(from)) {
    console.warn(`[copy-server-assets] skipped missing ${rel}`);
    continue;
  }
  const to = path.join(OUT, rel);
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      if (SKIP_NAME.has(base)) return false;
      const ext = path.extname(src);
      if (SKIP_EXT.has(ext)) return false;
      copied++;
      return true;
    }
  });
  console.log(`[copy-server-assets] ${rel}`);
}
console.log(`[copy-server-assets] copied ${copied} entries into dist/server/server`);
