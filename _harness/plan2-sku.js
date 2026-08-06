/**
 * PLAN-2 4.12 — the Industries product-code check.
 *
 * Before: admin/content.php parsed `"SKU | Display name"` lines into
 * {sku,label} objects and validated the SKU against NOTHING, while its own help
 * text promised "the SKU must match a real product so the link works". A typo
 * shipped a card linking to a product page that does not exist, and Rick got a
 * green success banner.
 *
 * After (owner decision, WHATS_LEFT §3 2026-08-06): the save still goes
 * through — adding the card before the product is legitimate — but an amber
 * warning names the offending code and the industry it is in.
 *
 * This suite is expected to FAIL against the pre-fix content.php. Run it
 * against an un-synced mirror to see that, then re-sync and run it again.
 *
 * Needs the mirror on :8123. Restores data/content.json from pristine.
 *
 * Usage: node _harness/plan2-sku.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const DIR = path.join(__dirname, 'site/data');
const MIRROR_CONTENT = path.join(DIR, 'content.json');
const PRISTINE_CONTENT = path.join(__dirname, 'pristine/content.json');
const PRISTINE_PRODUCTS = path.join(__dirname, 'pristine/products-all.json');

const BOGUS = 'ZZBOGUS999';
// A marker typed into an unrelated field, to prove the rest of the form
// survives the warning path — the B1 assertion shape.
const MARKER = 'B1MARKER' + process.pid;

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

function restore() {
  fs.copyFileSync(PRISTINE_CONTENT, MIRROR_CONTENT);
  for (const f of fs.readdirSync(DIR)) {
    if (/^content\.backup\./.test(f)) fs.unlinkSync(path.join(DIR, f));
  }
}

(async () => {
  const products = JSON.parse(fs.readFileSync(PRISTINE_PRODUCTS, 'utf8'));
  const realSku = (products.products || products)[0].sku;

  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="password"]', PW);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    note(!/auth\.php/.test(page.url()), 'signed in');

    // ── case 1: a bogus product code ────────────────────────────────────────
    await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });

    const prodSel = 'textarea[name="industryDetail[0][products]"]';
    const nameSel = 'input[name="industryDetail[0][name]"]';
    const ta = await page.$(prodSel);
    if (!ta) { note(false, 'industryDetail[0][products] textarea exists', `${prodSel} not found`); throw new Error('no field'); }

    const original = await ta.inputValue();
    const industryName = await (await page.$(nameSel)).inputValue();
    await ta.fill(original.trimEnd() + `\n${BOGUS} | Bogus Product`);

    // Type into an unrelated field: it must survive the warning path intact.
    const heroSel = 'input[name="copy[hero][headlineLine1]"]';
    await page.fill(heroSel, MARKER);

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.click('button:has-text("Save Content")'),
    ]);

    const body = await page.innerText('body');
    // Scope every warning assertion to the .warn-list element itself. Matching
    // on the whole page body passes vacuously: the industry name also appears
    // in the form field below, so a body-wide includes() "passed" against the
    // pre-fix code that emitted no warning at all.
    const warnEl = await page.$('.warn-list');
    const warnText = warnEl ? await warnEl.innerText() : '';

    note(page.url().includes('saved=1'),
      'the save still goes through (warn, not block)', `landed at ${page.url()}`);

    note(Boolean(warnEl) && /Check these product codes/i.test(warnText),
      'an unmatched code produces a visible warning block',
      warnEl ? 'block present but heading missing' : 'no .warn-list element on the page');

    note(warnText.includes(BOGUS),
      `the warning names the offending code (${BOGUS})`,
      `warning text: ${JSON.stringify(warnText.slice(0, 200))}`);

    note(industryName !== '' && warnText.includes(industryName),
      `the warning names the industry it is in ("${industryName}")`,
      `warning text: ${JSON.stringify(warnText.slice(0, 200))}`);

    note(!warnText.includes('undefined') && !/Array/.test(warnText),
      'the warning text is well-formed (no "undefined" / "Array")');

    // The save really happened — this is the warn-not-block assertion.
    const afterBogus = JSON.parse(fs.readFileSync(MIRROR_CONTENT, 'utf8'));
    const savedProducts = (afterBogus.industryDetail?.[0]?.products || []).map((p) => p.sku);
    note(savedProducts.includes(BOGUS),
      'content.json was written despite the warning', `saved SKUs: ${savedProducts.join(', ')}`);

    note(afterBogus.copy?.hero?.headlineLine1 === MARKER,
      'unrelated typing on the same page survived the warning path',
      `hero.headlineLine1 = ${JSON.stringify(afterBogus.copy?.hero?.headlineLine1)}`);

    // ── case 2: the warning is one-shot, not sticky ──────────────────────────
    await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });
    const reloaded = await page.innerText('body');
    note(!/Check these product codes/i.test(reloaded),
      'the warning does not persist on a plain reload (one-shot flash)');

    // ── case 3: a real product code produces no warning ──────────────────────
    restore();
    await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });
    const ta2 = await page.$(prodSel);
    const orig2 = await ta2.inputValue();
    await ta2.fill(orig2.trimEnd() + `\n${realSku} | Real Product`);

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.click('button:has-text("Save Content")'),
    ]);
    const body2 = await page.innerText('body');

    note(page.url().includes('saved=1') && /Content saved/i.test(body2),
      `a valid code (${realSku}) saves cleanly with the green banner`);
    note(!/Check these product codes/i.test(body2),
      `a valid code (${realSku}) produces no warning`);

    // ── case 3b: a combined-label reference must NOT warn ────────────────────
    // The shipped content.json carries "IP44A2 & IP45A3" against a catalog SKU
    // of "IP44A2-IP45A3". Both normalize to IP44A2IP45A3 and the link works, so
    // an exact-match check here would warn about 5 links that are fine — the
    // regression this case exists to catch. (config.php product_reference_resolves)
    restore();
    await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.click('button:has-text("Save Content")'),
    ]);
    const untouched = await page.innerText('body');
    note(!/Check these product codes/i.test(untouched),
      'saving the shipped content unchanged produces NO warning (combined-label SKUs resolve)',
      'the 18 shipped industry references all resolve — see _harness/deadlinks.js');

    // ── case 4: an empty product line is not flagged ─────────────────────────
    restore();
    await page.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });
    const ta3 = await page.$(prodSel);
    await ta3.fill((await ta3.inputValue()).trimEnd() + '\n\n   \n');
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.click('button:has-text("Save Content")'),
    ]);
    note(!/Check these product codes/i.test(await page.innerText('body')),
      'blank lines in the product box are not flagged as bad codes');
  } catch (e) {
    note(false, 'suite ran without throwing', e.message);
  } finally {
    await browser.close();
    restore();
    note(fs.readFileSync(MIRROR_CONTENT).equals(fs.readFileSync(PRISTINE_CONTENT)),
      'mirror content.json restored from pristine');
  }

  const failing = results.filter((r) => !r.ok).length;
  console.log(`\nplan2-sku ${results.length - failing}/${results.length}`);
  process.exit(failing === 0 ? 0 : 1);
})();
