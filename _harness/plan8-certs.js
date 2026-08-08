/**
 * PLAN-8 A1 + C32 — one derivation of a product's certifications, not two.
 *
 * A1. `extractComplianceBadges()` collapsed EVERY UL mention — `U/L`,
 * `UL File`, `UL Subject`, `UL Recognized`, `224`, `VW-1` — onto the single
 * label "UL Listed" for the page-header chip row, while the "Approvals &
 * Certifications" block below it went through `APPROVALS`, which separates
 * Recognized / Listed / Approved correctly. Measured 2026-08-08: 18 of 42
 * product pages printed a header UL category their own approvals data does not
 * claim. On IP63ES the two sat within 200px of each other, one saying
 * "UL Listed" and the other "UL Recognized".
 *
 * UL Listed, UL Recognized and UL Approved are distinct UL categories with
 * different scopes. IPC sells into aerospace, medical and automotive; this is a
 * compliance claim on a document a purchasing engineer may rely on, not a
 * wording slip.
 *
 * The rule this asserts is SUBSET, not equality: every UL category printed in
 * the header must also be claimed by the approvals block. Equality would be the
 * wrong test — it would fail a page that legitimately shows a category only in
 * the approvals block. Subset catches all three shapes the audit found:
 *   header "UL Listed" vs approvals "UL Recognized"   (6 products)
 *   header "UL Listed" vs approvals "UL Approved"     (3 products)
 *   header "UL Listed" vs approvals VW-1 only         (9 products)
 *
 * C32. Three overlapping blocks became two. Every string in a product's
 * `badges` must still appear in exactly one of them — collapsing the blocks
 * must not silently drop a badge the owner typed.
 *
 * Usage:  node _harness/plan8-certs.js          (needs :8123)
 *         node _harness/plan8-certs.js --report (per-product table, no verdict)
 */

const path = require('path');
const fs = require('fs');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-certs');
const REPORT = process.argv.includes('--report');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

/** The three mutually-exclusive UL categories. VW-1 and UL-94 are not
 *  categories — they are flammability ratings and may coexist with any of
 *  these, so they are deliberately not in this set. */
const UL_CATEGORIES = ['UL Listed', 'UL Recognized', 'UL Approved'];

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/**
 * Read the three certification blocks out of the rendered page.
 *
 * Located by their heading TEXT rather than by class: the classes are Tailwind
 * utilities shared with a dozen other rows, and the audit's own method note
 * applies here — a source-shaped selector attributes the wrong element.
 *
 * `[data-ipc-approval-mark]` alone is not enough to find the approvals block:
 * the same attribute is on the small monospace list that `ApprovalMarks`
 * renders on every related-product card further down the page, so an unscoped
 * query picks up four neighbouring products' approvals as if they were this
 * one's. Scope to the heading's own container first.
 */
const READ_BLOCKS = () => {
  const byHeading = (label) => {
    const head = [...document.querySelectorAll('div')].find(
      (d) => d.textContent.trim() === label && d.children.length === 0
    );
    return head && head.parentElement ? head.parentElement : null;
  };

  const textsIn = (root, sel) =>
    root ? [...root.querySelectorAll(sel)].map((s) => s.textContent.trim()).filter(Boolean) : [];

  const headerRoot = byHeading('Certifications & Standards');
  const approvalsRoot = byHeading('Approvals & Certifications');
  const featuresRoot = byHeading('Product Features');

  return {
    headerPresent: !!headerRoot,
    header: textsIn(headerRoot, 'span'),
    approvals: textsIn(approvalsRoot, 'span[data-ipc-approval-mark]'),
    features: textsIn(featuresRoot, 'span'),
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const rows = [];

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    for (const p of products) {
      await page.goto(`${BASE}/products?productId=${encodeURIComponent(p.id)}`, {
        waitUntil: 'networkidle',
      });
      const b = await page.evaluate(READ_BLOCKS);

      const ulIn = (list) => UL_CATEGORIES.filter((c) => list.includes(c));
      const headerUL = ulIn(b.header);
      const approvalUL = ulIn(b.approvals);
      const invented = headerUL.filter((c) => !approvalUL.includes(c));

      rows.push({
        id: p.id,
        sku: p.sku || '',
        headerPresent: b.headerPresent,
        header: b.header,
        approvals: b.approvals,
        features: b.features,
        headerUL,
        approvalUL,
        invented,
        badges: Array.isArray(p.badges) ? p.badges : [],
        storedApprovals: Array.isArray(p.approvals) ? p.approvals : null,
      });
    }

    await ctx.close();
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'certs.json'), JSON.stringify(rows, null, 2));

  if (REPORT) {
    console.log('\nproduct                         header UL          approvals UL');
    for (const r of rows) {
      if (!r.invented.length) continue;
      console.log(
        `${r.id.slice(0, 30).padEnd(31)} ${r.headerUL.join(',').padEnd(18)} ${r.approvalUL.join(',') || '(none)'}`
      );
    }
    console.log(`\n${rows.filter((r) => r.invented.length).length} of ${rows.length} disagree`);
    return;
  }

  // ── A1 ────────────────────────────────────────────────────────────────────
  const disagreeing = rows.filter((r) => r.invented.length);
  note(
    disagreeing.length === 0,
    `no product page prints a UL category its approvals data does not claim (0 of ${rows.length})`,
    disagreeing
      .map((r) => `${r.id}: header ${JSON.stringify(r.headerUL)} vs approvals ${JSON.stringify(r.approvalUL)}`)
      .join('\n         ')
  );

  const twoCats = rows.filter((r) => {
    const union = new Set([...r.headerUL, ...r.approvalUL]);
    return union.size > 1;
  });
  note(
    twoCats.length === 0,
    `no product page prints two different UL categories at once (0 of ${rows.length})`,
    twoCats.map((r) => `${r.id}: ${[...new Set([...r.headerUL, ...r.approvalUL])].join(' + ')}`).join('\n         ')
  );

  // ── C32 — every badge survives the collapse ───────────────────────────────
  //
  // A badge is ABSORBED when it stops appearing verbatim in Product Features
  // because the approvals block already states it — the owner writes
  // "U/L RECOGNIZED", "Mil-Spec." and "U/L VW-1", none of which equals its
  // normalised approval name, so exact-string matching would call every one of
  // those a lost badge.
  //
  // Absorption is only legitimate if the badge really does name a standard.
  // The risk this guards is an over-matching regex swallowing a genuine
  // feature — "Ultra Clear" and "Encapsulating" both contain the letters "ul",
  // and that is a real trap this catalog has (see the APPROVALS comment in
  // App.jsx). So an absorbed badge must carry a standards token under \b
  // anchors. This list is deliberately a COARSER, independent implementation
  // rather than a copy of APPROVALS: a copy would re-create the very
  // two-derivations problem A1 exists to remove.
  const STANDARD_TOKEN =
    // \b(?:US)?FDA\b, not \bFDA\b: IP53MP's badge is "USFDA Compliant" and
    // there is no word boundary inside "USFDA", so the narrower form reported
    // a correctly-absorbed standard as a vanished feature. Caught on the first
    // post-fix run — the test was wrong, not the page.
    /\bU\/?L\b|\bCSA\b|\bMIL[\s-]?(SPEC|I|R|DTL)\b|\bM23053\b|\bAMS\b|\bRoHS\b|\b(?:US)?FDA\b|\bUSP\b|\bISO\b|\bVW-?1\b|\bUL-?94\b/i;

  const lost = [];
  const duplicated = [];
  const absorbed = [];
  for (const r of rows) {
    for (const badge of r.badges) {
      const needle = badge.trim().toLowerCase();
      const inFeatures = r.features.some((f) => f.trim().toLowerCase() === needle);
      const inApprovals = r.approvals.some((a) => a.trim().toLowerCase() === needle);
      if (inFeatures && inApprovals) duplicated.push(`${r.id}: "${badge}"`);
      if (inFeatures) continue;

      // Not in Features. Legitimate only if it names a standard AND the
      // approvals block actually printed something.
      if (!STANDARD_TOKEN.test(badge)) {
        lost.push(`${r.id}: "${badge}" — vanished and is not a standard`);
      } else if (r.approvals.length === 0) {
        lost.push(`${r.id}: "${badge}" — a standard, but the approvals block is empty`);
      } else {
        absorbed.push(`${r.id}: "${badge}" -> ${r.approvals.join(', ')}`);
      }
    }
  }
  note(lost.length === 0,
    'no badge the owner typed vanished: each is in Features, or names a standard the approvals block states',
    lost.join('\n         '));
  note(duplicated.length === 0,
    'no badge string is printed in BOTH the approvals and the features block',
    duplicated.join('\n         '));
  fs.writeFileSync(path.join(OUT, 'absorbed.txt'), absorbed.join('\n') + '\n');
  console.log(`     (${absorbed.length} badge strings absorbed into the approvals block — ${path.join(OUT, 'absorbed.txt')})`);

  // ── the stored-field rule (invariant 3 applied to `approvals`) ────────────
  const stored = rows.filter((r) => r.storedApprovals !== null);
  const emptyStored = stored.filter((r) => r.storedApprovals.length === 0);
  note(
    emptyStored.every((r) => r.approvals.length === 0),
    emptyStored.length
      ? `a product storing approvals: [] shows none — checked ${emptyStored.length}`
      : 'no product in the catalog stores approvals: [] (nothing to check here; ' +
        'plan7-approvals.js covers the stored-field path)',
    emptyStored.filter((r) => r.approvals.length).map((r) => r.id).join(', ')
  );

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan8-certs ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'certs.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
