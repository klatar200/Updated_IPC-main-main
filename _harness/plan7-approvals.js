/**
 * PLAN-7 item 2 — approvals become a field.
 *
 * Measured 2026-08-07 before any code: certifications live in free text, as
 * **112 distinct badge strings across 42 products**, ~20 of which carry an
 * approval in 20 different spellings ("U/L CSA", "U/L CSA MIL-Spec.",
 * "U/L CSA and MIL-SPEC", "U/L, MIL-Spec.", "UL & CSA Approved", …). Nothing
 * could count them, filter them, or list them.
 *
 * Worse, the badge field UNDERSTATES the catalogue. Read the whole record —
 * badges plus specificationsSummary plus description plus specTable1 — and:
 *
 *     UL VW-1        1 badge  vs  11 products
 *     MIL-SPEC       5        vs  12
 *     FDA            2        vs   6
 *     ≥1 approval   23        vs  30
 *
 * A buyer filtering for MIL-SPEC would have seen 5 products where 12 qualify.
 *
 * ── The two things this suite exists to hold ────────────────────────────────
 *
 * 1. **An explicit empty list must stay empty.** `approvals` is read by
 *    PRESENCE (`Array.isArray`), never truthiness. A product whose owner
 *    unticked every box has `approvals: []`, and that means "no approvals" —
 *    re-deriving from prose there would resurrect exactly what he removed.
 *    This is invariant 3's lesson (`mergeContent` treats an empty array as a
 *    deletion) applied to a new field, and the first draft of this feature had
 *    the bug: `Array.isArray(p.approvals) && p.approvals.length`.
 *
 * 2. **The migration is progressive, not a bulk rewrite.** data/products-all.json
 *    is server-owned in production, so a 30-product edit made here would not
 *    travel. The field materialises when the owner saves a product; until then
 *    the site derives. Both states must render the same page, and both are
 *    asserted below.
 *
 * Reads only, except the admin round-trip, which writes to the MIRROR's
 * catalogue and restores it from pristine at the end with a cmp proof.
 * Needs the mirror on :8123.
 *
 * Usage: node _harness/plan7-approvals.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PRISTINE = path.join(__dirname, 'pristine', 'products-all.json');
const MIRROR = path.join(__dirname, 'site', 'data', 'products-all.json');
const products = JSON.parse(fs.readFileSync(PRISTINE, 'utf8'));

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const login = async (page) => {
  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  if (await page.$('input[name="password"]')) {
    await page.fill('input[name="password"]', 'audit-pass-123');
    await page.evaluate(() =>
      document.querySelector('input[name="password"]').closest('form').requestSubmit());
    await page.waitForLoadState('networkidle');
  }
};

(async () => {
  const browser = await launch();
  let restored = false;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    const page = await ctx.newPage();

    // ── the vocabulary is one list, and both languages agree on it ───────────
    // Compared behaviourally (the derived set per product), not by diffing
    // regex source across two languages — contrastparity.js exists because two
    // implementations of the same maths had already drifted once.
    let phpDerived = null, phpErr = '';
    try {
      phpDerived = JSON.parse(execFileSync('php', [path.join(__dirname, 'approvaldump.php')], {
        encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
      }));
    } catch (e) {
      phpErr = String(e.stderr || e.message).split('\n')[0];
    }

    await page.goto(`${BASE}/datasheets`, { waitUntil: 'networkidle' });
    const jsDerived = await page.evaluate(() => window.__ipcApprovals || null);

    if (!phpDerived || !jsDerived) {
      note(false, 'PHP and JS derive the same approvals for all 42 products',
        phpErr || `php=${phpDerived ? 'ok' : 'missing'} js=${jsDerived ? 'ok' : 'missing (window.__ipcApprovals not exposed)'}`);
    } else {
      const skus = [...new Set([...Object.keys(phpDerived), ...Object.keys(jsDerived)])];
      const drift = skus.filter((s) =>
        (phpDerived[s] || []).join('|') !== (jsDerived[s] || []).join('|'));
      note(drift.length === 0 && skus.length === products.length,
        `PHP and JS derive the same approvals for all ${skus.length} products`,
        drift.slice(0, 6).map((s) =>
          `${s}: php[${(phpDerived[s] || []).join(',')}] js[${(jsDerived[s] || []).join(',')}]`).join('\n         '));
    }

    // ── the measured coverage, pinned so it cannot quietly shrink ────────────
    const covered = jsDerived
      ? Object.values(jsDerived).filter((a) => a.length).length
      : -1;
    note(covered === 30,
      `30 of ${products.length} products derive at least one approval (badges alone showed 23)`,
      `got ${covered}`);

    const milspec = jsDerived
      ? Object.values(jsDerived).filter((a) => a.includes('MIL-SPEC')).length : -1;
    const vw1 = jsDerived
      ? Object.values(jsDerived).filter((a) => a.includes('UL VW-1')).length : -1;
    note(milspec === 12 && vw1 === 11,
      `the hidden ones surface: MIL-SPEC ${milspec} (badges said 5), UL VW-1 ${vw1} (badges said 1)`,
      `MIL-SPEC ${milspec}, UL VW-1 ${vw1}`);

    // ── "Ultra Clear" and "Encapsulating" both contain "ul" ─────────────────
    // Run the deriver against the bare strings. The first version of this
    // check asked "does any product with an Encapsulating badge derive a UL
    // approval", and IP42MW carries "Encapsulating" AND a real "U/L Approved"
    // — so it flagged a correct derivation. Test the boundary, not a proxy.
    const boundary = await page.evaluate(() => {
      if (!window.__ipcDeriveApprovals) return null;
      const run = (badge) => window.__ipcDeriveApprovals({ badges: [badge] });
      return {
        ultraClear: run("Ultra Clear"),
        encapsulating: run("Encapsulating"),
        realUL: run("U/L Recognized"),
      };
    });
    note(!!boundary && boundary.ultraClear.length === 0 && boundary.encapsulating.length === 0
      && boundary.realUL.join() === 'UL Recognized',
      'word boundaries hold: "Ultra Clear" and "Encapsulating" derive nothing, "U/L Recognized" derives one',
      !boundary ? 'deriver not exposed' :
        `Ultra Clear[${boundary.ultraClear}] Encapsulating[${boundary.encapsulating}] realUL[${boundary.realUL}]`);

    // ── the public filter ────────────────────────────────────────────────────
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const chips = await page.$$('[data-ipc-approval]');
    note(chips.length >= 10,
      `the Product Index offers ${chips.length} approval filter chips`,
      `${chips.length} chips`);

    const rowCount = () => page.evaluate(() =>
      document.querySelectorAll('[data-ipc-product-row]').length);
    let all = 0, one = -1, two = -1, chipErr = '';
    try {
      all = await rowCount();
      await page.click('[data-ipc-approval="MIL-SPEC"]', { timeout: 3000 });
      await page.waitForTimeout(200);
      one = await rowCount();
      await page.click('[data-ipc-approval="CSA"]', { timeout: 3000 });
      await page.waitForTimeout(200);
      two = await rowCount();
    } catch (e) {
      chipErr = String(e.message || e).split('\n')[0];
    }
    note(!chipErr && all > one && one > 0 && two > 0 && two < one,
      `chips intersect: all ${all} → MIL-SPEC ${one} → +CSA ${two}`,
      chipErr || `all ${all}, MIL-SPEC ${one}, +CSA ${two} (expected each to narrow)`);

    // ── admin round-trip, and the invariant-3 case ───────────────────────────
    const target = 'IP33PO';   // derives MIL-SPEC, USP Class VI, UL VW-1
    await login(page);
    await page.goto(`${BASE}/admin/edit.php?sku=${target}`, { waitUntil: 'networkidle' });
    const boxes = await page.$$('input[name="approvals[]"]');
    const preTicked = await page.evaluate(() =>
      [...document.querySelectorAll('input[name="approvals[]"]:checked')].map((i) => i.value));
    note(boxes.length >= 10 && preTicked.length === 3,
      `the editor pre-ticks ${target} from its existing text: ${preTicked.join(', ')}`,
      `${boxes.length} boxes, ${preTicked.length} ticked: ${preTicked.join(', ')}`);

    // Untick EVERYTHING and save. This is the invariant-3 case.
    try {
      await page.evaluate(() => {
        document.querySelectorAll('input[name="approvals[]"]:checked').forEach((i) => { i.checked = false; });
        document.querySelector('[name="orig_sig"]').closest('form').requestSubmit();
      });
      // waitForLoadState resolves against the CURRENT document and can return
      // before requestSubmit's navigation has even started — that raced the
      // 302 and read the catalogue back before PHP had written it. Wait for
      // the redirect target instead.
      await page.waitForURL(/index\.php/, { timeout: 8000 });
    } catch (_) { /* the assertions below report it */ }

    const saved = JSON.parse(fs.readFileSync(MIRROR, 'utf8'));
    const row = (Array.isArray(saved) ? saved : saved.products).find((p) => p.sku === target) || {};
    note(Array.isArray(row.approvals) && row.approvals.length === 0,
      `unticking every box stores an explicit empty list, not a missing key`,
      `stored: ${JSON.stringify(row.approvals)}`);

    const badgesKept = (row.badges || []).length;
    note(badgesKept > 0 && row.name && row.partType,
      `the free-text badges and every other field survive the save (${badgesKept} badges)`,
      `badges ${badgesKept}, name ${JSON.stringify(row.name)}`);

    // …and the public side must now show ZERO for that product, not re-derive.
    await page.goto(`${BASE}/products?productId=${encodeURIComponent(target)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const shown = await page.evaluate(() =>
      [...document.querySelectorAll('[data-ipc-approval-mark]')].map((e) => e.textContent.trim()));
    note(shown.length === 0,
      `${target} now paints NO approvals — an empty list is a deletion, not "unset"`,
      `still showing: ${shown.join(', ')}`);

    // ── restore ──────────────────────────────────────────────────────────────
    fs.copyFileSync(PRISTINE, MIRROR);
    restored = true;
    const same = fs.readFileSync(PRISTINE).equals(fs.readFileSync(MIRROR));
    note(same, 'mirror catalogue restored from pristine, byte-identical');
  } finally {
    if (!restored) { try { fs.copyFileSync(PRISTINE, MIRROR); } catch (_) {} }
    await browser.close();
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nplan7-approvals: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
})();
