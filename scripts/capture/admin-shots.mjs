import { chromium } from '/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/node_modules/playwright/index.mjs';
const SP = process.env.SP;
const PAGES = [
  ['01-dashboard', '/admin'], ['02-posts', '/admin/posts'], ['03-content', '/admin/content'],
  ['04-gallery', '/admin/gallery'], ['05-messages', '/admin/messages'],
  ['06-analytics', '/admin/analytics'], ['07-settings', '/admin/settings']
];
const ctx = await chromium.launchPersistentContext(SP + '/hw-profile', {
  headless: true, channel: 'chrome', viewport: { width: 1440, height: 900 }
});
const page = ctx.pages()[0] || (await ctx.newPage());

// This server has no Netlify Functions behind it, so every data call fails and
// each screen paints an error card instead of its layout. Answer them with
// empty-but-valid payloads: the point of these frames is the structure of the
// CMS, not the studio's live content.
// This server has no Netlify Functions behind it, so every data call fails
// and each screen paints an error card instead of its layout. Answer them
// with a well-formed payload carrying placeholder rows: these frames are
// meant to show the CMS's structure, and the dashboard only renders its
// tables when hasData is true and submissions is populated — an empty
// payload short-circuits it to a setup notice.
const now = Date.now();
const sub = (id, formName, name, email, days, data) => ({
  id, formName, name, email,
  date: new Date(now - days * 864e5).toLocaleDateString(),
  timeAgo: days === 0 ? 'today' : `${days}d ago`,
  createdAtMs: now - days * 864e5,
  data
});
const STUB = {
  hasData: true,
  siteName: 'hedgewitch-horticulture',
  siteUrl: 'https://hedgewitchhorticulture.com',
  lastPublished: '2 days ago',
  totalSubmissions: 4,
  formCounts: [
    { name: 'contact', label: 'Contact form', count: 3 },
    { name: 'careers', label: 'Job application', count: 1 }
  ],
  submissions: [
    sub('1', 'contact', 'Sample Visitor', 'visitor@example.com', 0, { service: 'Garden design', message: 'Placeholder enquiry text.' }),
    sub('2', 'contact', 'Sample Visitor', 'visitor@example.com', 1, { service: 'Maintenance', message: 'Placeholder enquiry text.' }),
    sub('3', 'contact', 'Sample Visitor', 'visitor@example.com', 3, { service: 'Coaching', message: 'Placeholder enquiry text.' }),
    sub('4', 'careers', 'Sample Applicant', 'applicant@example.com', 5, { position: 'Seasonal gardener' })
  ],
  deploys: [
    { id: 'd1', state: 'ready', title: 'Publish from admin', date: '', timeAgo: '2d ago', duration: '48s', branch: 'main', context: 'production', url: '#' },
    { id: 'd2', state: 'ready', title: 'Update gallery', date: '', timeAgo: '6d ago', duration: '51s', branch: 'main', context: 'production', url: '#' }
  ]
};
await page.route('**/.netlify/functions/**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB) })
);
for (const [name, path] of PAGES) {
  await page.goto('http://localhost:3000' + path, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  // The admin builds itself client-side after the identity check; anything
  // under ~6s photographs an empty shell.
  await page.waitForTimeout(7500);
  // Transient toasts are the state of one moment, not the design of the page.
  const state = await page.evaluate(() => {
    document
      .querySelectorAll('[class*="toast"], [class*="Toast"], [role="alert"], [class*="notice"], [class*="banner"]')
      .forEach((el) => el.remove());
    window.scrollTo(0, 0);
    const txt = document.body.innerText;
    return {
      signedOut: /signed out|sign in again/i.test(txt),
      cards: document.querySelectorAll('[class*="card"], [class*="panel"], table, form, [class*="tile"]').length,
      chars: txt.trim().length
    };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SP}/admin-frames/${name}.png` });
  console.log(`${name.padEnd(14)} cards=${String(state.cards).padStart(3)} text=${String(state.chars).padStart(5)} ${state.signedOut ? '** SIGNED OUT **' : 'ok'}`);
}

// "Report a bug" is a dialog on every admin page rather than a route of its
// own, so it has to be opened to be photographed.
await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(7500);
await page.locator('[data-bug-report-open]').first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1500);
const dialogOpen = await page.evaluate(() => {
  const d = document.querySelector('[data-bug-report-dialog]');
  return !!d && d.hasAttribute('open');
});
await page.screenshot({ path: `${SP}/admin-frames/08-report-a-bug.png` });
console.log(`08-report-bug  dialog=${dialogOpen ? 'open' : 'NOT OPEN'}`);
await ctx.close();
