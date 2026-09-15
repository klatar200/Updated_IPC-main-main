/**
 * Claims re-audit (2026-09-15) — what the catalog itself can evidence.
 *
 * A site-wide claim ("Full RoHS Compliant Product Line", "UL · CSA · MIL-SPEC ·
 * AMS Rated Products") is checkable against the one body of product data IPC
 * publishes: `data/products-all.json`. That is not proof the claim is false —
 * a datasheet can carry a certification the catalog copy never mentions — but
 * it is the only independent number available offline, and a whole-line claim
 * backed by 4 of 42 records is a different conversation from one backed by 42.
 *
 * So every count below is reported as SUPPORT, not as truth, and the register
 * says which is which. The search covers every string in the record: badges,
 * caption, description, specificationsSummary, operatingTemp, pdfLabel and
 * every cell of both spec tables — a certification named only in a spec row
 * still counts.
 *
 * Usage: node _harness/claims-catalog.js
 */
const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'data', 'products-all.json'), 'utf8'));

function textOf(p) {
  const out = [];
  (function walk(n) {
    if (n === null || n === undefined) return;
    if (typeof n === 'string') { out.push(n); return; }
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n === 'object') return Object.values(n).forEach(walk);
    out.push(String(n));
  })(p);
  return out.join('  ');
}

const BLOBS = products.map((p) => ({ sku: p.sku, blob: textOf(p), p }));

// Each row is a published claim and the pattern that would evidence it in a
// product record. Patterns are deliberately loose (U/L, UL, CUL; MIL-SPEC,
// MIL-I, MIL-R, MIL-DTL) — a loose pattern over-counts support, which biases
// against raising a finding.
const CLAIMS = [
  ['RoHS — "Full RoHS Compliant Product Line" (TRUST-2, CERT-2)', /\bRoHS\b/i],
  ['UL — "UL · CSA · MIL-SPEC · AMS Rated Products" (TRUST-3, CERT-4)', /\b(U\/?L|CUL)\b/],
  ['CSA — same claim', /\bCSA\b/i],
  ['MIL-SPEC — same claim', /\bMIL[- ]?(SPEC|I|R|DTL|C|W)\b/i],
  ['AMS — same claim', /\bAMS[- ]?\d|\bAMS\b/],
  ['FDA — ABOUT-4 "FDA-compliant"', /\bFDA\b|21\s*CFR/i],
  ['USP Class VI — IND medical', /\bUSP\b|Class\s*VI/i],
  ['ISO 10993 — IND medical', /ISO\s*10993/i],
  ['ASTM — IND electrical', /\bASTM\b/i],
  ['NEMA — IND electrical', /\bNEMA\b/i],
  ['QPL — IND aerospace "M23053/8 QPL Available"', /\bQPL\b/i],
  ['Ford LP — IND automotive "Ford LP Approved Variants"', /\bFord\b/i],
  ['Made in USA — TRUST-7, CERT-3', /made in (the )?usa|u\.?s\.?a\.? made|domestic/i],
  ['Imported / non-US origin (the counter-evidence)', /\bimported\b|\bchina\b|made in (?!the )(?!usa)[a-z]/i],
  ['UL 224 VW-1 — IND automotive', /224|VW[- ]?1/i],
  ['MIL-I-23053 — IND aerospace', /23053/],
  ['MIL-I-3190 — IND electrical', /3190/],
  ['AMS-3632 / AMS-3653 — IND aerospace', /3632|3653/],
  ['1200°F — markets[3] "Fiberglass sleeving rated up to 1200°F in stock"', /1200\s*°?\s*F/i],
];

console.log(`catalog: ${products.length} records\n`);
console.log('claim'.padEnd(58) + 'support  SKUs');
for (const [label, re] of CLAIMS) {
  const hits = BLOBS.filter((b) => re.test(b.blob)).map((b) => b.sku);
  console.log(`${label.slice(0, 56).padEnd(58)}${String(hits.length).padStart(2)}/42   ` +
    (hits.length === 0 ? '(none)' : hits.slice(0, 6).join(', ') + (hits.length > 6 ? ` +${hits.length - 6}` : '')));
}

// STAT-2's two halves, counted exactly.
const withPdf = products.filter((p) => p.pdfUrl && String(p.pdfUrl).trim() !== '');
const withPhoto = products.filter((p) => p.photoUrl && !/placehold\.co/.test(p.photoUrl));
const partNumbers = new Set();
for (const p of products) {
  if (/^(VALUE-ADDED|VT-1100)$/.test(p.sku)) { partNumbers.add(p.sku); continue; }
  String(p.sku).split(/[-/&]/).map((t) => t.trim()).filter(Boolean).forEach((t) => partNumbers.add(t));
}
const types = {};
products.forEach((p) => { types[p.partType || '(none)'] = (types[p.partType || '(none)'] || 0) + 1; });

console.log(`\nSTAT-2 "42 Products Stocked / Datasheet published for every one"`);
console.log(`  catalog records            ${products.length}`);
console.log(`  distinct part numbers      ${partNumbers.size}`);
console.log(`  records with a pdfUrl      ${withPdf.length}/42` +
  (withPdf.length === products.length ? '  (the "datasheet for every one" half holds)' : ''));
console.log(`  records with a real photo  ${withPhoto.length}/42`);
console.log(`  partType spread            ${Object.entries(types).map(([k, v]) => `${k} ${v}`).join(', ')}`);

console.log(`\nSTAT-1 "50+ Years in Business / Founded July 1, 1974"`);
const years = new Date().getFullYear() - 1974;
console.log(`  ${years} years as of ${new Date().getFullYear()} — "50+" holds, and holds until 2034`);
