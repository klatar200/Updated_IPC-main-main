/**
 * Do the unmatched industry product references resolve to a real product?
 *
 * Evidence for the WHATS_LEFT §2 entry. Runs src/App.jsx's OWN lookup chain
 * (exact id/sku, then normalizeSku, then skuSegmentMatch) against the catalog,
 * rather than guessing at rendered error copy — the product page renders the
 * same shell either way, so a DOM heuristic could not tell the two apart.
 *
 * The two helpers below are copied verbatim from src/App.jsx:6155-6172. If the
 * originals change this file is stale — it is a one-shot audit, not a suite.
 */
const fs = require('fs');
const path = require('path');

function normalizeSku(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function skuSegmentMatch(sku, needle) {
  const n = normalizeSku(needle);
  if (!n) return false;
  return String(sku || '')
    .split(/[-\/,]/)
    .map(normalizeSku)
    .filter(Boolean)
    .includes(n);
}

const raw = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));
const content = raw('pristine/content.json');
const productsRaw = raw('pristine/products-all.json');
const products = productsRaw.products || productsRaw;

/** src/App.jsx:6181-6188, the selected-product lookup. */
function resolve(selectedId) {
  return (
    products.find((p) => p.id === selectedId || p.sku === selectedId) ||
    products.find((p) => normalizeSku(p.sku) === normalizeSku(selectedId)) ||
    products.find((p) => skuSegmentMatch(p.sku, selectedId) || skuSegmentMatch(p.id, selectedId)) ||
    null
  );
}

const refs = [];
for (const row of content.industryDetail || []) {
  for (const p of row.products || []) {
    const sku = String(p.sku || '').trim();
    if (sku) refs.push({ industry: row.name, sku, label: p.label });
  }
}

console.log(`${refs.length} industry product references, catalog of ${products.length}\n`);
let dead = 0;
for (const r of refs) {
  const hit = resolve(r.sku);
  if (!hit) dead++;
  console.log(`  ${hit ? 'ok   ' : 'DEAD '} ${r.sku.padEnd(26)} ${hit ? '-> ' + hit.sku : '-> nothing in the catalog'}`);
}
console.log(`\n${dead} of ${refs.length} resolve to nothing`);
