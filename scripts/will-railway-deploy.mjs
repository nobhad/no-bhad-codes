/**
 * Will pushing this trigger a Railway deploy?
 *
 * Railway matches the files changed in a push against `build.watchPatterns` in
 * railway.json. The decision is binary: if any changed file matches, the service
 * redeploys and runs the whole build command; if none match, no deployment is
 * created at all and the running container keeps its current image.
 *
 * There is no partial build — "frontend-only" means Railway does nothing, which
 * is the saving. That is only safe because the server no longer reads anything
 * out of dist/ at runtime (see docs/HOSTING_COST_INVESTIGATION.md).
 *
 * Usage:
 *   node scripts/will-railway-deploy.mjs              # vs origin/main
 *   node scripts/will-railway-deploy.mjs main~3       # vs an arbitrary ref
 *   node scripts/will-railway-deploy.mjs abc123~1..abc123   # one commit
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const base = process.argv[2] || 'origin/main';

/**
 * Translate a Railway watch pattern into a regex.
 * Supports the two forms the config uses: `**` spanning directories, and `*`
 * within a single path segment. Anchored, so `server/**` cannot match
 * `my-server/foo`.
 */
function toRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i++;
        if (pattern[i + 1] === '/') i++; // `server/**/x` and `server/**` both work
      } else {
        out += '[^/]*';
      }
    } else if ('.+^${}()|[]\\/?'.includes(ch)) {
      out += '\\' + ch;
    } else {
      out += ch;
    }
  }
  return new RegExp('^' + out + '$');
}

let patterns;
try {
  patterns = JSON.parse(readFileSync('railway.json', 'utf8')).build?.watchPatterns;
} catch {
  console.error('Could not read railway.json');
  process.exit(2);
}

if (!patterns?.length) {
  console.log('No watchPatterns set — Railway deploys on EVERY push.');
  process.exit(0);
}

let changed;
try {
  // An argument containing `..` is already a range; anything else is a base ref.
  const range = base.includes('..') ? base : `${base}..HEAD`;
  changed = execSync(`git diff --name-only ${range}`, { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
} catch {
  console.error(`Could not diff against "${base}". Fetch it, or pass a ref that exists.`);
  process.exit(2);
}

if (!changed.length) {
  console.log(`No changes vs ${base}.`);
  process.exit(0);
}

const regexes = patterns.map((p) => [p, toRegExp(p)]);
const triggers = [];
const ignored = [];
for (const file of changed) {
  const hit = regexes.find(([, re]) => re.test(file));
  (hit ? triggers : ignored).push(hit ? `${file}  (matches "${hit[0]}")` : file);
}

console.log(`\nChanged in ${base.includes('..') ? base : `${base}..HEAD`}: ${changed.length} file(s)\n`);

if (triggers.length) {
  console.log(`  RAILWAY WILL DEPLOY — ${triggers.length} file(s) match a watch pattern:\n`);
  for (const t of triggers.slice(0, 15)) console.log(`    ${t}`);
  if (triggers.length > 15) console.log(`    … and ${triggers.length - 15} more`);
  console.log(`\n  It will run: npm run build && npm run build:server, then restart.`);
} else {
  console.log('  RAILWAY WILL NOT DEPLOY — no changed file matches a watch pattern.');
  console.log('  Vercel still rebuilds and serves the frontend; the API keeps running as-is.');
}

console.log(`\n  ${ignored.length} file(s) do not trigger a deploy.`);
if (ignored.length && process.env.VERBOSE) {
  for (const f of ignored) console.log(`    ${f}`);
}
console.log();
