/**
 * One-shot: what differs between data/products-all.json and the seeded
 * _harness/pristine/ copy. Written 2026-08-08 while establishing the PLAN-8
 * baseline, because the mirror was found to be serving a different catalog
 * than data/ and plan5-images was 11/12 as a result.
 */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');

const a = JSON.parse(fs.readFileSync(path.join(R, 'data/products-all.json'), 'utf8'));
const b = JSON.parse(fs.readFileSync(path.join(R, '_harness/pristine/products-all.json'), 'utf8'));

const ka = new Set(), kb = new Set();
a.forEach((p) => Object.keys(p).forEach((k) => ka.add(k)));
b.forEach((p) => Object.keys(p).forEach((k) => kb.add(k)));
console.log('keys only in data/    :', [...ka].filter((k) => !kb.has(k)).join(', ') || '(none)');
console.log('keys only in pristine :', [...kb].filter((k) => !ka.has(k)).join(', ') || '(none)');

const byId = new Map(b.map((p) => [p.id, p]));
const fieldCount = {};
let diff = 0;
for (const p of a) {
  const q = byId.get(p.id);
  if (!q) { console.log('id only in data:', p.id); continue; }
  for (const k of new Set([...Object.keys(p), ...Object.keys(q)])) {
    if (JSON.stringify(p[k]) !== JSON.stringify(q[k])) {
      diff++;
      fieldCount[k] = (fieldCount[k] || 0) + 1;
    }
  }
}
console.log('total differing fields:', diff);
console.log('by field name:', JSON.stringify(fieldCount));
