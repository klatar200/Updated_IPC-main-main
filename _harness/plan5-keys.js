/**
 * PLAN-5 4.27 — duplicate React keys reachable from the admin.
 *
 * Keys were derived from owner-editable text: `key={link.label}`,
 * `key={f.title}`, `key={m.year}`, `key={svc.title}`, `key={item.question}`,
 * … so two footer links both named "Contact", or two milestones in the same
 * year, produced two identical React keys. React documents that as
 * **unsupported** — "Non-unique keys may cause children to be duplicated
 * and/or omitted — the behavior is unsupported and could change in a future
 * version."
 *
 * WHAT THIS SUITE MEASURED, and where the plan's evidence did not reproduce:
 * the shipped production bundle does NOT drop a row today (probe-keys.js /
 * probe-keys2.js: both "Contact" links render with the right hrefs, both
 * milestones render, both industry cards render, the FAQ open/closed state
 * lands on the row that was clicked). What IS real and measurable is the
 * console error — 24 of them across the nine routes before the fix — and the
 * fact that the app is relying on unspecified behaviour to render the owner's
 * data correctly. So the load-bearing assertion here is Phase A, and it is
 * measured on a DEVELOPMENT React bundle because production strips the message
 * (see _harness/vite.devreact.js).
 *
 * They are console.**error**, not console.warn — that was the open question in
 * the plan. A zero-console-errors sweep would catch them on a dev bundle and
 * cannot catch them on the shipped one.
 *
 * Phases:
 *   A  dev-React bundle, adversarial content.json, nine routes + 3 product
 *      pages: ZERO duplicate-key console errors.
 *   B  production bundle: both duplicate rows render, with the right hrefs,
 *      and the second one navigates to its own page.
 *   C  admin round-trip: reorder two rows that share a label in
 *      admin/content.php, save, and confirm the PUBLIC order matches. This is
 *      the check that catches a bad index-based key.
 *
 * Writes the MIRROR's data/content.json only (_harness/site/data/). The repo's
 * data/ is never touched; the suite restores the mirror from pristine/ and
 * rebuilds the production bundle on the way out.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan5-keys.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const MIRROR_DATA = path.join(__dirname, 'site', 'data');
const PRISTINE = path.join(__dirname, 'pristine');
const SITE = path.join(__dirname, 'site');
const DEVDIST = path.join(__dirname, 'devdist');

const ROUTES = ['/', '/products', '/industries', '/services', '/about', '/faq', '/contact', '/privacy', '/dashboard'];
const PRODUCT_PAGES = ['/products?productId=IP52EC', '/products?productId=CC', '/products?productId=IP75AD'];

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const sh = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

/**
 * A content.json that collides EVERY owner-editable key 4.27 names, in the way
 * Rick can actually produce from admin/content.php: the same label typed twice.
 */
function adversarialContent() {
  const doc = JSON.parse(fs.readFileSync(path.join(PRISTINE, 'content.json'), 'utf8'));
  const dup = (arr, patch = {}) => [...arr, { ...arr[0], ...patch }];

  // The named incident: two footer links called "Contact", pointing at
  // different pages. Placed adjacent so a positional key is genuinely tested.
  doc.footerLinks = [
    { label: 'Contact', page: 'contact' },
    { label: 'Contact', page: 'about' },
    ...doc.footerLinks.filter((l) => l.label !== 'Contact'),
  ];
  doc.milestones = dup(doc.milestones, { label: 'A second event in the same year' });
  doc.services = dup(doc.services, { desc: 'A second service with the same title' });
  doc.features = dup(doc.features, { description: 'A second feature with the same title' });
  doc.certs = dup(doc.certs);
  doc.stats = dup(doc.stats);
  doc.markets = dup(doc.markets);
  doc.capabilities = dup(doc.capabilities);
  doc.heroProofPoints = dup(doc.heroProofPoints);
  doc.privacySections = dup(doc.privacySections);
  doc.contactTips = dup(doc.contactTips);
  doc.companyNav = dup(doc.companyNav, { label: 'Same destination, different label' });
  doc.faq = dup(doc.faq, { answer: 'A second answer to the very same question.' });
  doc.industryDetail = dup(doc.industryDetail, { subhead: 'A second card with the same name' });
  // The repeated one-per-line text fields, which collide the most easily.
  doc.industryDetail = doc.industryDetail.map((ind) => ({
    ...ind,
    useCases: [...(ind.useCases || []), (ind.useCases || [''])[0]],
    certs: [...(ind.certs || []), (ind.certs || [''])[0]],
    products: [...(ind.products || []), (ind.products || [{}])[0]],
  }));
  doc.services = doc.services.map((s) => ({ ...s, details: [...(s.details || []), (s.details || [''])[0]] }));
  return doc;
}

function writeMirrorContent(doc) {
  fs.writeFileSync(path.join(MIRROR_DATA, 'content.json'), JSON.stringify(doc, null, 2));
}

function restoreMirrorData() {
  for (const f of ['content.json', 'site-info.json', 'products-all.json']) {
    fs.copyFileSync(path.join(PRISTINE, f), path.join(MIRROR_DATA, f));
  }
}

function installBundle(fromDir) {
  fs.rmSync(path.join(SITE, 'assets'), { recursive: true, force: true });
  fs.cpSync(fromDir, SITE, { recursive: true });
}

// ── Phase B / C helpers ──────────────────────────────────────────────────────

async function footerLinkList(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('footer a')]
      .map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') }))
      .filter((a) => a.href && a.href.startsWith('/'))
  );
}

async function signIn(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  return page;
}

(async () => {
  const browser = await launch();
  let devBuilt = false;

  try {
    restoreMirrorData();
    writeMirrorContent(adversarialContent());

    // ── Phase B — behaviour on the bundle that actually ships ───────────────
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

      const links = await footerLinkList(page);
      const contacts = links.filter((l) => l.text === 'Contact');
      note(contacts.length === 2,
        `B: two footer links both named "Contact" both render (${contacts.length} found)`,
        JSON.stringify(links));
      note(contacts.some((l) => l.href === '/contact') && contacts.some((l) => l.href === '/about'),
        'B: the two "Contact" links keep their own destinations (/contact and /about)',
        JSON.stringify(contacts));

      // …and the second one really navigates there, not to the first one's page.
      const second = await page.evaluateHandle(() =>
        [...document.querySelectorAll('footer a')].filter(
          (a) => a.textContent.trim() === 'Contact' && a.getAttribute('href') === '/about'
        )[0]
      );
      await second.asElement().click();
      await page.waitForTimeout(500);
      const landed = page.url().replace(BASE, '');
      note(landed === '/about', `B: clicking the second "Contact" lands on /about (got "${landed}")`);

      await page.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
      const doc = JSON.parse(fs.readFileSync(path.join(MIRROR_DATA, 'content.json'), 'utf8'));
      // Match the year badges against the VALUES IN THE FILE, not a 4-digit
      // regex. The shipped milestones are "1980s"/"1990s"/"2000s"/"2010s" as
      // well as "1974"/"2024", and the first draft of this check used
      // /^(19|20)\d\d$/ — it reported 3 of 7 rendered and looked exactly like
      // the dropped-row defect this item is about. The code was fine; the
      // assertion was wrong.
      const wanted = doc.milestones.map((m) => m.year);
      const years = await page.evaluate(
        (ws) =>
          [...document.querySelectorAll('body *')]
            .filter((e) => e.children.length === 0 && ws.includes(e.textContent.trim()))
            .map((e) => e.textContent.trim()),
        wanted
      );
      note(years.length === doc.milestones.length,
        `B: two milestones in the same year both render (${doc.milestones.length} rows, ${years.length} rendered)`,
        JSON.stringify(years));

      await page.goto(`${BASE}/services`, { waitUntil: 'networkidle' });
      const svcTitles = await page.$$eval('h3', (hs) => hs.map((h) => h.textContent.trim()));
      const dupTitle = doc.services[0].title;
      note(svcTitles.filter((t) => t === dupTitle).length === 2,
        `B: two services titled "${dupTitle}" both render`,
        JSON.stringify(svcTitles));

      await page.close();
    }

    // ── Phase C — reorder in the admin, order must match on the public site ─
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await signIn(ctx);
      await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });

      const sectionSel = 'fieldset[data-section="footerLinks"]';
      const before = await page.$$eval(`${sectionSel} .content-row`, (rows) =>
        rows.map((r) => ({
          label: r.querySelector('input[type=text]').value,
          page: r.querySelector('select').value,
        }))
      );
      note(before.length >= 2 && before[0].label === 'Contact' && before[1].label === 'Contact',
        'C: the editor shows the two colliding rows in the stored order',
        JSON.stringify(before.slice(0, 3)));

      // Move row 2 above row 1 with the editor's own ↓/↑ control.
      await page.click(`${sectionSel} .content-row:nth-of-type(1) [data-action="down"]`);
      await page.waitForTimeout(150);
      const after = await page.$$eval(`${sectionSel} .content-row`, (rows) =>
        rows.map((r) => ({
          label: r.querySelector('input[type=text]').value,
          page: r.querySelector('select').value,
        }))
      );
      note(after[0].page === before[1].page && after[1].page === before[0].page,
        'C: the reorder control swapped the two same-label rows in the form',
        `${JSON.stringify(before.slice(0, 2))} -> ${JSON.stringify(after.slice(0, 2))}`);

      // Anchor on the target form, NOT a bare button[type=submit] — nav.php
      // renders a Sign Out form above this one.
      await page.click('form:has(input[name="orig_sig"]) button[type="submit"]');
      await page.waitForLoadState('domcontentloaded');

      const saved = JSON.parse(fs.readFileSync(path.join(MIRROR_DATA, 'content.json'), 'utf8'));
      note(saved.footerLinks[0].page === after[0].page && saved.footerLinks[1].page === after[1].page,
        'C: the saved content.json carries the new order',
        JSON.stringify(saved.footerLinks.slice(0, 2)));

      const pub = await ctx.newPage();
      await pub.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      const pubLinks = (await footerLinkList(pub)).filter((l) => l.text === 'Contact');
      note(pubLinks.length === 2 &&
           pubLinks[0].href === '/' + saved.footerLinks[0].page &&
           pubLinks[1].href === '/' + saved.footerLinks[1].page,
        'C: the PUBLIC footer order matches the reordered content.json',
        `rendered ${JSON.stringify(pubLinks)} vs stored ${JSON.stringify(saved.footerLinks.slice(0, 2))}`);

      await ctx.close();
    }

    // ── Phase A — zero duplicate-key console errors, on a dev React bundle ──
    {
      console.log('    (building a development-React bundle — see _harness/vite.devreact.js)');
      sh('npx', ['vite', 'build', '--config', '_harness/vite.devreact.js', '--outDir', '_harness/devdist', '--emptyOutDir']);
      devBuilt = true;
      installBundle(DEVDIST);
      // The reorder above rewrote the mirror's content.json; put the full
      // adversarial set back so every collision is exercised.
      writeMirrorContent(adversarialContent());

      const byType = {};
      const samples = [];
      for (const r of [...ROUTES, ...PRODUCT_PAGES]) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        page.on('console', (m) => {
          const t = m.text();
          if (!/same key|unique "key"/i.test(t)) return;
          byType[m.type()] = (byType[m.type()] || 0) + 1;
          if (samples.length < 6) samples.push(`[${r}] ${m.type()}: ${t.split('\n')[0].slice(0, 120)}`);
        });
        await page.goto(BASE + r, { waitUntil: 'networkidle' });
        await page.waitForTimeout(350);
        await page.close();
      }
      const total = Object.values(byType).reduce((a, b) => a + b, 0);
      note(total === 0,
        `A: zero React duplicate-key console messages across ${ROUTES.length} routes + ${PRODUCT_PAGES.length} product pages`,
        `${total} seen ${JSON.stringify(byType)}\n         ${samples.join('\n         ')}`);
      note(true, `A: (recorded) React emits these as console.ERROR, not console.warn — ` +
                 `a zero-console-errors sweep catches them on a dev bundle and never on the shipped one`);
    }
  } finally {
    // Put the mirror back the way the rest of the harness expects it.
    restoreMirrorData();
    if (devBuilt) {
      sh('npm', ['run', 'build']);
      installBundle(path.join(ROOT, 'dist'));
      fs.rmSync(DEVDIST, { recursive: true, force: true });
    }
    await browser.close();
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5-keys: ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})();
