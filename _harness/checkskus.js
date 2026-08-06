/**
 * One-shot audit: do the industry product codes already in data/content.json
 * match the catalog in data/products-all.json?
 *
 * Written because plan2-sku.js's "a valid code produces no warning" case
 * failed AFTER the 4.12 fix landed — the suspicion being that the warning was
 * correct and the shipped data already carries unmatched codes.
 */
const fs = require('fs');
const path = require('path');

const raw = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));
const content = raw('pristine/content.json');
const productsRaw = raw('pristine/products-all.json');
const products = productsRaw.products || productsRaw;

const catalog = new Set(products.map((p) => String(p.sku || '').trim()).filter(Boolean));
console.log(`catalog: ${catalog.size} SKUs`);

let total = 0;
const bad = [];
for (const row of content.industryDetail || []) {
  for (const p of row.products || []) {
    const sku = String(p.sku || '').trim();
    if (!sku) continue;
    total++;
    if (!catalog.has(sku)) bad.push({ industry: row.name, sku, label: p.label });
  }
}

console.log(`industry product references: ${total}`);
console.log(`unmatched: ${bad.length}\n`);
for (const b of bad) {
  console.log(`  ${String(b.industry).padEnd(24)} ${String(b.sku).padEnd(16)} "${b.label}"`);
}
