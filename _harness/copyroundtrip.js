/**
 * NB-copy round-trip: prove a "matched" key is not merely matched on paper.
 *
 * copydrift.js compares the two DECLARATIONS. That is a static claim. This
 * drives the real path end to end against the mirror:
 *
 *   admin/content.php form  ->  POST  ->  data/content.json  ->  mergeContent()
 *   ->  rendered DOM on the public page
 *
 * If any link in that chain were broken, copydrift's "96 matched" would be
 * worthless — which is exactly the NB-copy failure mode: a green "Content
 * saved" over an edit that never renders.
 *
 * Needs the mirror on :8123. Restores data/content.json from _harness/pristine
 * afterwards and verifies byte-identity with the caller.
 *
 * Usage: node _harness/copyroundtrip.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const MIRROR_CONTENT = path.join(__dirname, 'site/data/content.json');
const PRISTINE_CONTENT = path.join(__dirname, 'pristine/content.json');

// A marker unique to this run, so a stale value can never look like a pass.
const STAMP = 'RT' + process.pid;

// Four keys across four groups, each rendering on a page we can load.
const CASES = [
  { group: 'hero',          key: 'headlineLine1', page: '/',        value: `Round-trip hero ${STAMP}` },
  { group: 'homeMarkets',   key: 'title',         page: '/',        value: `Round-trip markets ${STAMP}` },
  { group: 'contactHeader', key: 'title',         page: '/contact', value: `Round-trip contact ${STAMP}` },
  { group: 'nav',           key: 'quoteButton',   page: '/',        value: `RT Quote ${STAMP}` },
];

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    // ── sign in ─────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="password"]', PW);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    note(!/auth\.php/.test(page.url()), 'signed in to the mirror admin', `still at ${page.url()}`);

    // ── edit the four fields ────────────────────────────────────────────────
    await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });

    for (const c of CASES) {
      const sel = `[name="copy[${c.group}][${c.key}]"]`;
      const el = await page.$(sel);
      if (!el) { note(false, `field ${c.group}.${c.key} exists in the form`, `${sel} not found`); continue; }
      await el.fill(c.value);
      note(true, `filled ${c.group}.${c.key}`);
    }

    // ── save ────────────────────────────────────────────────────────────────
    // Target the Save button by its text, NOT `button[type="submit"]`: nav.php
    // renders the Sign Out form's submit button earlier in the DOM, so the
    // generic selector logs you out and the whole test fails as a false
    // negative. (Cost one debugging round.)
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.click('button:has-text("Save Content")'),
    ]);

    const savedBanner = page.url().includes('saved=1');
    note(savedBanner, 'save reported success (redirect to ?saved=1)', `landed at ${page.url()}`);

    // ── the file on disk actually holds the values ───────────────────────────
    const written = JSON.parse(fs.readFileSync(MIRROR_CONTENT, 'utf8'));
    for (const c of CASES) {
      const got = written?.copy?.[c.group]?.[c.key];
      note(got === c.value, `content.json holds ${c.group}.${c.key}`, `got ${JSON.stringify(got)}`);
    }

    // ── and the public page RENDERS them ────────────────────────────────────
    // This is the half NB-copy is really about: a key can be written to disk
    // and still never reach the DOM, because mergeContent only reads keys that
    // exist in COPY_DEFAULTS.
    const pages = [...new Set(CASES.map((c) => c.page))];
    const bodyByPage = {};
    for (const p of pages) {
      const t = await ctx.newPage();
      await t.goto(BASE + p, { waitUntil: 'networkidle' });
      bodyByPage[p] = await t.innerText('body');
      await t.close();
    }
    for (const c of CASES) {
      const rendered = bodyByPage[c.page].includes(c.value);
      note(rendered, `${c.page} renders ${c.group}.${c.key}`, `"${c.value}" not in the DOM text`);
    }
  } catch (e) {
    note(false, 'round-trip completed without throwing', e.message);
  } finally {
    await browser.close();
    // ── restore the mirror, always ──────────────────────────────────────────
    fs.copyFileSync(PRISTINE_CONTENT, MIRROR_CONTENT);
    const same = fs.readFileSync(MIRROR_CONTENT).equals(fs.readFileSync(PRISTINE_CONTENT));
    note(same, 'mirror content.json restored from pristine');
    // Backups that save_content() wrote during the test are harness litter.
    for (const f of fs.readdirSync(path.dirname(MIRROR_CONTENT))) {
      if (/^content\.backup\./.test(f)) fs.unlinkSync(path.join(path.dirname(MIRROR_CONTENT), f));
    }
  }

  const failing = results.filter((r) => !r.ok).length;
  console.log(`\ncopyroundtrip ${results.length - failing}/${results.length}`);
  process.exit(failing === 0 ? 0 : 1);
})();
