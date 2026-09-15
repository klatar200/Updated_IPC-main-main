/**
 * A-9.P5a-4, A-9.P5a-8 (the half the data settles) and A-9.P4-10 — catalog text.
 *
 * Written BEFORE the edits and watched failing. These are `data/` changes,
 * which PLAN-11 §7.3 put on the owner's side; they are made here on Keagan's
 * explicit instruction, and only where the defect is unambiguous or the catalog
 * itself names the majority form. What is deliberately NOT changed is asserted
 * too, so a later pass cannot quietly "finish the job" on the three that need a
 * decision.
 *
 * STEP 0 recorded the site as NOT LIVE, so `data/` has not yet become live
 * customer state: the runbook is on branch B (first deploy), where `data/` is
 * uploaded from the repo. After the first deploy these same edits would be
 * admin work, never a file change.
 *
 * Usage: node _harness/audit9-catalog-text.js       (no server, no browser)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products-all.json'), 'utf8'));
const Q = String.fromCharCode(34);

const results = [];
let group = '';
const sec = (s) => { group = s; console.log(`\n${s}`); };
const ok = (cond, what, detail = '') => {
  results.push({ group, ok: !!cond, what, detail });
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${what}${cond || !detail ? '' : '\n         → ' + detail}`);
};
const blob = (p) => JSON.stringify(p);
const carrying = (re) => products.filter((p) => re.test(blob(p))).map((p) => p.sku);
const badgeUses = (s) => products.filter((p) => (p.badges || []).includes(s)).map((p) => p.sku);

// ── A-9.P5a-4 — the six misspellings ───────────────────────────────────────
sec('A-9.P5a-4  the six misspellings are gone, and the words they should be are present');
for (const [wrong, right] of [
  [/agressive/i, 'aggressive'],
  [/apperance/i, 'appearance'],
  [/availble/i, 'available'],
  [/transparant/i, 'transparent'],
  [/Semrigid/i, 'Semi-Rigid'],
]) {
  const hits = carrying(wrong);
  ok(hits.length === 0, `no record still carries /${wrong.source}/`, `on: ${JSON.stringify(hits)}`);
}
// The corrections landed rather than the words merely being deleted.
for (const [word, n] of [['aggressive', 1], ['appearance', 1], ['available', 1], ['transparent', 2]]) {
  const hits = carrying(new RegExp(word, 'i'));
  ok(hits.length >= n, `"${word}" is present on at least ${n} record(s)`, `on: ${JSON.stringify(hits)}`);
}

// ── A-9.P5a-8 — only where the catalog itself names a majority ─────────────
sec('A-9.P5a-8  the three badge families the data settles are one form each');
{
  const semi = [...new Set(products.flatMap((p) => (p.badges || []).filter((b) => /semi|semrigid/i.test(b))))];
  ok(semi.length === 1 && semi[0] === 'Semi-Rigid',
    'the semi-rigid badge has one spelling, the 2-of-3 majority form',
    `forms: ${JSON.stringify(semi)}`);

  const env = [...new Set(products.flatMap((p) => (p.badges || []).filter((b) => /environmental protect/i.test(b))))];
  ok(env.length === 1 && env[0] === 'Environmental Protection',
    'the environmental-protection badge has one spelling, matching the Title Case badge row',
    `forms: ${JSON.stringify(env)}`);

  const shrink = [...new Set(products.flatMap((p) => (p.badges || []).filter((b) => /low shrink temp/i.test(b))))];
  ok(shrink.length === 1 && shrink[0] === 'Low Shrink Temperature',
    'the low-shrink-temperature badge has one spelling, the 4-of-5 majority form',
    `forms: ${JSON.stringify(shrink)}`);
}

sec('A-9.P5a-8  the three that need a DECISION are deliberately untouched');
{
  // 1-vs-1, no majority: picking a winner is a wording choice, not a fix.
  ok(badgeUses('Low Temperature Flexibility').length === 1 && badgeUses('Low-Temperature Flexibility').length === 1,
    'Low Temperature / Low-Temperature Flexibility: still one product each, still owed a decision',
    `${JSON.stringify(badgeUses('Low Temperature Flexibility'))} vs ${JSON.stringify(badgeUses('Low-Temperature Flexibility'))}`);
  ok(badgeUses('125°C Rated').length === 1 && badgeUses('Rated 125°C').length === 1,
    '125°C Rated / Rated 125°C: still one product each, still owed a decision',
    `${JSON.stringify(badgeUses('125°C Rated'))} vs ${JSON.stringify(badgeUses('Rated 125°C'))}`);
  // Blocked by A-9.P5a-5's own ordering: A-9.P4-3 decides which mark this names.
  const ul = carrying(/U\/L CSA MIL-Spec/);
  ok(ul.length === 2,
    'U/L CSA MIL-Spec.: untouched — A-9.P5a-5 must follow A-9.P4-3, which is undecided',
    `on: ${JSON.stringify(ul)}`);
}

// ── A-9.P4-10 — the inch mark, on the three SKUs the re-measurement kept ────
sec('A-9.P4-10  one unit inside a spec-table size column');
{
  const isGauge = (v) => /^#?\d{1,2}$/.test(v);
  const isHdr = (v) => /[A-Za-z]{3,}/.test(v);
  const isFrac = (v) => /\d\s*\/\s*\d/.test(v);
  const isDec = (v) => /^\.\d+$|^\d+\.\d+$/.test(v);
  const mixed = [];
  let markedTotal = 0, bareTotal = 0;
  for (const p of products) {
    const t = p.specTable2;
    if (!t || !Array.isArray(t.rows) || !t.rows.length) continue;
    const col0 = t.rows.map((r) => String(Array.isArray(r) ? (r[0] ?? '') : '').trim()).filter(Boolean);
    const cells = col0.filter((v) => !isHdr(v) && (v.includes(Q) || (!isGauge(v) && (isFrac(v) || isDec(v)))));
    if (!cells.length) continue;
    const mk = cells.filter((v) => v.includes(Q)), bare = cells.filter((v) => !v.includes(Q));
    markedTotal += mk.length; bareTotal += bare.length;
    if (mk.length && bare.length) mixed.push(`${p.sku}: ${mk.length} marked / ${bare.length} bare ${JSON.stringify(bare)}`);
  }
  ok(mixed.length === 0,
    'no spec-table size column mixes marked and bare inch values',
    mixed.join(' | '));
  ok(bareTotal === 0,
    `every inch-denominated cell in those columns carries the mark (${markedTotal} marked, ${bareTotal} bare)`,
    '');
}

// ── the guard rails: nothing else moved ────────────────────────────────────
sec('nothing else in the catalog moved');
{
  ok(products.length === 42, `still 42 records`, String(products.length));
  const skus = products.map((p) => p.sku);
  ok(new Set(skus).size === 42, 'still 42 distinct SKUs', '');
  ok(products.every((p) => p.pdfUrl), 'every record still carries a pdfUrl', '');
  ok(products.every((p) => p.photoUrl), 'every record still carries a photoUrl', '');
  const badgeCount = products.reduce((n, p) => n + (p.badges || []).length, 0);
  ok(badgeCount === 158, `the badge count is unchanged at 158 (renames only, no adds or drops)`, String(badgeCount));
}

const pass = results.filter((r) => r.ok).length;
console.log(`\naudit9-catalog-text ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
