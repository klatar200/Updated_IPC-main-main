/**
 * ADM-8 + NEW-V2-3 (audit 2026-09-27) — the hardcoded business claims are
 * editable in Page Content → Company Claims (WHATS_LEFT §1ao).
 *
 * Eleven claims used to be literals in src/App.jsx with no admin screen: three
 * About fact rows, the Industries PPAP panel (heading + text), the Services
 * "Rush service" line, the Contact email card's reply time, the footer's two
 * sentences, and the brand / manufacturer every product page gives search
 * engines in its JSON-LD. The risks, and the arm that holds each:
 *
 *   pair      content.php's `default` entries == COPY_DEFAULTS.claims, and
 *             every key is in COPY_CLEARABLE. A missing default makes the first
 *             save write "" (eleven deletions — plan9-firstsave's defect); a
 *             key outside COPY_CLEARABLE makes a cleared claim re-seed itself.
 *   literals  the old hardcoded JSX is gone, so there is one copy of each
 *   default   with no `claims` key stored (the shipped file), every page renders
 *             exactly what it rendered before, footer and JSON-LD included
 *   firstsave the admin prefills the defaults, and a save that changes nothing
 *             else stores them — not blanks
 *   edit      typed values render in all seven places; a third-party
 *             manufacturer loses IPC's URL
 *   clear     emptied values REMOVE: rows, the panel, the sub-line, the
 *             sentences, the JSON-LD keys — and stay empty on reload
 *   body      a cleared panel text keeps the heading
 *
 * Own `php -S` on :8746 over the mirror (npm run build && sh _harness/sync.sh
 * first). Restores the mirror's content.json from _harness/pristine/.
 *
 *   node _harness/claims.js
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(__dirname, 'site');
const CONTENT = path.join(SITE, 'data', 'content.json');
const PRISTINE = path.join(__dirname, 'pristine', 'content.json');
const PORT = 8746;   // was 8732 until 2026-10-05, which lowsE-apache also uses for HTTPS
const BASE = `http://127.0.0.1:${PORT}`;
const PASS = 'audit-pass-123';
const PRODUCT = '/products?productId=IP38FE';

const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

// ── the two declarations ────────────────────────────────────────────────────
const app = fs.readFileSync(path.join(ROOT, 'src', 'App.jsx'), 'utf8');
function copyDefaults() {
  const open = app.indexOf('{', app.indexOf('const COPY_DEFAULTS = {'));
  let depth = 0;
  for (let i = open; i < app.length; i++) {
    const c = app[i];
    if (c === '/' && app[i + 1] === '/') { i = app.indexOf('\n', i); continue; }
    if (c === '/' && app[i + 1] === '*') { i = app.indexOf('*/', i + 2) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') { for (i++; app[i] !== c; i++) if (app[i] === '\\') i++; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return eval('(' + app.slice(open, i + 1) + ')');
  }
  throw new Error('COPY_DEFAULTS unbalanced');
}
const JS = copyDefaults().claims || {};
const dump = spawnSync('php', [path.join(__dirname, 'dump-copy-groups.php')], { encoding: 'utf8' });
const PHP = Object.fromEntries(JSON.parse(dump.stdout).filter((f) => f.group === 'claims').map((f) => [f.key, f.default]));
const CLEARABLE = new RegExp(/const COPY_CLEARABLE = \/(.*)\/;/.exec(app)[1]);
const KEYS = Object.keys(JS);
const minOrder = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'site-info.json'), 'utf8')).stats.minimumOrder;

/** Everything the seven surfaces show, read from the rendered site. */
async function surfaces(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const go = async (route) => {
    await page.goto(BASE + route + (route.includes('?') ? '&' : '?') + '_=' + Date.now(), { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
  };
  const out = {};
  await go('/about');
  out.aboutRows = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.space-y-3 > div')]
    .map((d) => [...d.querySelectorAll('span')].map((s) => s.textContent.trim()))
    .filter((p) => p.length === 2)));
  out.footer = await page.evaluate(() => (document.querySelector('footer p.leading-relaxed') || {}).textContent || null);
  await go('/industries');
  out.ppap = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Contact Sales'
      && a.parentElement && a.parentElement.style.background.includes('--brand-dark'));
    if (!link) return null;
    const box = link.parentElement;
    return { title: box.querySelector('.ipc-ink-dark').textContent.trim(), body: (box.querySelector('p') || {}).textContent || null };
  });
  await go('/services');
  out.services = await page.evaluate(() => {
    // The innermost element holding the banner sentence (the page body holds it too).
    const hits = [...document.querySelectorAll('div')].filter((d) => /All fabrication services listed below\./.test(d.textContent));
    const el = hits.sort((x, y) => x.textContent.length - y.textContent.length)[0];
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  await go('/contact');
  out.emailSub = await page.evaluate(() => {
    // The card whose title row reads "Email": title, info, then the sub-line.
    const title = [...document.querySelectorAll('.uppercase.tracking-wide')].find((d) => d.textContent.trim() === 'Email');
    if (!title) return null;
    const rows = [...title.parentElement.children];
    return rows.length > 2 ? rows[2].textContent.trim() : '';
  });
  await go(PRODUCT);
  await page.waitForSelector('#product-ld', { state: 'attached', timeout: 8000 }).catch(() => {});
  out.ld = await page.evaluate(() => { const s = document.getElementById('product-ld'); return s ? JSON.parse(s.textContent) : null; });
  await ctx.close();
  return out;
}

async function admin(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
  }
  await page.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  const read = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[name^="copy[claims]"]')]
    .map((i) => [i.name.replace(/^copy\[claims\]\[(.*)\]$/, '$1'), i.value])));
  const fill = async (vals) => { for (const [k, v] of Object.entries(vals)) await page.fill(`[name="copy\\[claims\\]\\[${k}\\]"]`, v); };
  const save = async () => {
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]:has-text("Save")')]);
    return (await page.locator('.alert-success, .alert-info').first().textContent().catch(() => '')).trim();
  };
  return { ctx, page, read, fill, save };
}
const stored = () => (JSON.parse(fs.readFileSync(CONTENT, 'utf8')).copy || {}).claims;
const footerText = (...parts) => parts.filter(Boolean).join(' ');

(async () => {
  // ── pair ──
  note(KEYS.length === 11 && JSON.stringify(PHP) === JSON.stringify(JS),
    'pair: content.php defaults equal COPY_DEFAULTS.claims (11 keys, same order, byte-identical)',
    `php ${JSON.stringify(PHP)}\n       js  ${JSON.stringify(JS)}`);
  note(KEYS.every((k) => CLEARABLE.test(k)), 'pair: every claims key is in COPY_CLEARABLE (a clear stays cleared)',
    KEYS.filter((k) => !CLEARABLE.test(k)).join(', '));

  // ── literals ──
  const OLD = ['value: "Privately Held"', 'value: "≤ 1 week"', 'value: "Available on request"',
    'sub: "Typical reply: same day"', 'Rush service available —\n', 'PPAP &amp; IMDS Documentation Available',
    'A spec-grade stocking distributor of heat-shrinkable &amp;', '"name": "Insulation Products Corporation", "url"'];
  const left = OLD.filter((s) => app.includes(s));
  note(left.length === 0, 'literals: none of the eight old hardcoded claims is left in App.jsx', left.join(' | '));

  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`claims: port ${PORT} is already in use`); process.exit(2);
  }
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  const browser = await launch();
  try {
    // FIXTURE, 2026-10-05 (WHATS_LEFT §1ap, DI-8): data/content.json now SHIPS
    // with copy.claims, as the admin writes it. The claims-free file this suite
    // protects is what a site deployed before §1ao holds, so build it —
    // pristine minus the key — the way plan9-firstsave builds its pre-3a file.
    {
      const pre = JSON.parse(fs.readFileSync(PRISTINE, 'utf8'));
      delete pre.copy.claims;
      fs.writeFileSync(CONTENT, JSON.stringify(pre, null, 2));
    }
    await new Promise((r) => setTimeout(r, 700));
    note(stored() === undefined, 'default: a content.json from before Company Claims has no claims key');

    // ── default ──
    let s = await surfaces(browser);
    note(s.aboutRows.Structure === 'Privately Held' && s.aboutRows['Custom Lead Time'] === '≤ 1 week'
      && s.aboutRows['PPAP / IMDS'] === 'Available on request', 'default: the three About rows read as before', JSON.stringify(s.aboutRows));
    note(s.ppap && s.ppap.title === JS.industriesPpapTitleClaim && s.ppap.body.replace(/\s+/g, ' ').trim() === JS.industriesPpapBodyClaim,
      'default: the Industries PPAP panel reads as before', JSON.stringify(s.ppap));
    note(s.services && s.services.endsWith('All fabrication services listed below. Rush service available — contact sales for details.'),
      'default: the Services banner keeps its rush line', JSON.stringify(s.services));
    note(s.emailSub === 'Typical reply: same day', 'default: the Contact email card keeps "Typical reply: same day"', JSON.stringify(s.emailSub));
    const oldFooter = `A spec-grade stocking distributor of heat-shrinkable & extruded tubing, electrical sleeving, and industrial adhesives. ${minOrder} minimum order. Quick, accurate, courteous service — the customer is always number one.`;
    note(s.footer && s.footer.replace(/\s+/g, ' ').trim() === oldFooter, 'default: the footer description is the same sentence as before', JSON.stringify(s.footer));
    note(s.ld && JSON.stringify(s.ld.brand) === JSON.stringify({ '@type': 'Brand', name: 'Insulation Products Corporation' })
      && JSON.stringify(s.ld.manufacturer) === JSON.stringify({ '@type': 'Organization', name: 'Insulation Products Corporation', url: 'https://www.insulationproducts.com' }),
      'default: product JSON-LD brand and manufacturer are byte-identical to before', JSON.stringify(s.ld && { b: s.ld.brand, m: s.ld.manufacturer }));

    // ── firstsave ──
    let a = await admin(browser);
    note(JSON.stringify(await a.read()) === JSON.stringify(JS), 'firstsave: Page Content prefills Company Claims with the defaults, not blanks');
    const SEL = 'input[name="copy\\[hero\\]\\[headlineLine1\\]"]';
    await a.page.fill(SEL, (await a.page.inputValue(SEL)) + ' ');
    const b1 = await a.save();
    note(/saved/i.test(b1) && JSON.stringify(stored()) === JSON.stringify(JS),
      'firstsave: an unrelated save stores the eleven defaults — no claim deleted', `${b1} → ${JSON.stringify(stored())}`);

    // ── edit ──
    const EDIT = {
      aboutStructureClaim: 'Family Owned', aboutLeadTimeClaim: '2 weeks', aboutPpapClaim: 'By arrangement',
      industriesPpapTitleClaim: 'Automotive Paperwork', industriesPpapBodyClaim: 'Ask sales about PPAP.',
      servicesRushClaim: 'Expedite on request.', contactEmailReplyClaim: 'Reply within one business day',
      footerDescriptionClaim: 'A stocking distributor.', footerServiceClaim: 'Thanks for your business.',
      productBrandClaim: 'Acme Brand', productManufacturerClaim: 'Acme Corp',
    };
    await a.fill(EDIT);
    await a.save();
    s = await surfaces(browser);
    note(s.aboutRows.Structure === 'Family Owned' && s.aboutRows['Custom Lead Time'] === '2 weeks' && s.aboutRows['PPAP / IMDS'] === 'By arrangement',
      'edit: the About rows show the typed values', JSON.stringify(s.aboutRows));
    note(s.ppap && s.ppap.title === 'Automotive Paperwork' && s.ppap.body.trim() === 'Ask sales about PPAP.', 'edit: the Industries panel shows the typed heading and text', JSON.stringify(s.ppap));
    note(s.services && s.services.endsWith('All fabrication services listed below. Expedite on request.'), 'edit: the Services banner shows the typed line', JSON.stringify(s.services));
    note(s.emailSub === 'Reply within one business day', 'edit: the Contact email card shows the typed reply time', JSON.stringify(s.emailSub));
    note(s.footer && s.footer.trim() === footerText('A stocking distributor.', `${minOrder} minimum order.`, 'Thanks for your business.'),
      'edit: the footer shows both typed sentences around the minimum order', JSON.stringify(s.footer));
    note(s.ld && s.ld.brand && s.ld.brand.name === 'Acme Brand' && s.ld.manufacturer && s.ld.manufacturer.name === 'Acme Corp' && !('url' in s.ld.manufacturer),
      'edit: JSON-LD carries the typed brand and manufacturer, and a third-party manufacturer does not get IPC\'s URL', JSON.stringify(s.ld && { b: s.ld.brand, m: s.ld.manufacturer }));

    // ── body ──
    await a.fill({ industriesPpapBodyClaim: '' });
    await a.save();
    s = await surfaces(browser);
    note(s.ppap && s.ppap.title === 'Automotive Paperwork' && s.ppap.body === null, 'body: a cleared panel text keeps the heading and drops the sentence', JSON.stringify(s.ppap));

    // ── clear ──
    await a.fill(Object.fromEntries(KEYS.map((k) => [k, ''])));
    await a.save();
    note(KEYS.every((k) => stored()[k] === ''), 'clear: content.json stores eleven deliberate blanks');
    s = await surfaces(browser);
    note(!('Structure' in s.aboutRows) && !('Custom Lead Time' in s.aboutRows) && !('PPAP / IMDS' in s.aboutRows) && 'Founded' in s.aboutRows,
      'clear: the three About rows are gone, the others stay', JSON.stringify(Object.keys(s.aboutRows)));
    note(s.ppap === null, 'clear: the Industries PPAP panel is gone, with its Contact Sales button', JSON.stringify(s.ppap));
    note(s.services && s.services.endsWith('All fabrication services listed below.'), 'clear: the Services banner has no rush line', JSON.stringify(s.services));
    note(s.emailSub === '', 'clear: the Contact email card has no reply-time line', JSON.stringify(s.emailSub));
    note(s.footer && s.footer.trim() === `${minOrder} minimum order.`, 'clear: the footer keeps only the minimum order, no stray spaces', JSON.stringify(s.footer));
    note(s.ld && !('brand' in s.ld) && !('manufacturer' in s.ld) && s.ld.name, 'clear: JSON-LD omits brand and manufacturer, and is otherwise intact',
      JSON.stringify(s.ld));
    await a.ctx.close();
    a = await admin(browser);
    const reread = await a.read();
    note(KEYS.length === Object.keys(reread).length && Object.values(reread).every((v) => v === ''),
      'clear: reopening Page Content shows the fields still empty — nothing re-seeded');
    await a.ctx.close();
  } finally {
    await browser.close();
    srv.kill();
    fs.copyFileSync(PRISTINE, CONTENT);
  }
  const bad = results.filter((x) => !x.ok).length;
  console.log(`\nclaims ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
