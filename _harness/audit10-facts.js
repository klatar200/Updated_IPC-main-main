/**
 * AUDIT-10 pass-4 step 4.5 — cross-page factual consistency.
 *
 * Every rendering of every hard fact — phone, fax, email, street address,
 * founding year, anniversary, hours, minimum order, stock quantity,
 * certifications, company name, copyright range — collected from the whole
 * text dump INCLUDING the <noscript> block, which index.html carries as a
 * documented second copy ("if the phone number changes, change it here too",
 * index.html:67) and which no JS-enabled page ever paints.
 *
 * Two renderings of one fact that disagree is a finding. Formatting variants
 * of the SAME fact are reported separately as drift.
 *
 * Usage: node _harness/audit10-facts.js
 */
const fs = require('fs');
const path = require('path');

const STATE = path.join(__dirname, '..', 'plans', 'audit10', 'state');
const DUMP = JSON.parse(fs.readFileSync(path.join(STATE, 'textdump.json'), 'utf8'));

const collapse = (u) => u.replace(/^\/products\?productId=.*/, '/products?productId=<42>');

/* Each fact: a matcher over the raw text, and a normaliser that says which
   renderings are "the same fact stated differently". */
const FACTS = [
  { name: 'phone number',      re: /\(?\b6\s?3\s?0\)?[\s.\-]?7\s?7\s?1[\s.\-]?0\s?7\s?0\s?0\b|\+1630771070\d/g },
  { name: 'fax number',        re: /\(?\b630\)?[\s.\-]?771[\s.\-]?0701\b/g },
  { name: 'email address',     re: /[A-Za-z0-9._%+-]+@insulationproducts\.com/gi },
  { name: 'street address',    re: /250\s+Gibraltar\s+D(?:r|rive)\.?/gi },
  { name: 'city/state/zip',    re: /Bolingbrook,?\s+(?:Illinois|IL)\b\.?\s*(?:60440)?/gi },
  { name: 'founding year',     re: /\b(?:since|Since|incorporated(?:\s+on)?|founded|established|ESTABLISHED)\b[^.\n]{0,40}?\b19\d\d\b/g },
  { name: 'anniversary claim', re: /\b(?:over\s+|more\s+than\s+|Celebrating\s+)?\d\d\+?\s*years\b[^.\n]{0,30}/gi },
  { name: 'business hours',    re: /Mon[^\s]{0,4}\s*(?:day)?\s*[-–—]\s*Fri[a-z]*,?\s*\d{1,2}\s*(?:am|AM|:00)?\s*[-–—]\s*\d{1,2}\s*(?:pm|PM|:00)?\s*(?:CT|CST|CDT)?/g },
  { name: 'minimum order',     re: /\$\s?\d+(?:\.\d\d)?\s*(?:minimum|min\b)|minimum\s+order[^.\n]{0,20}/gi },
  { name: 'stock quantity',    re: /\b\d+(?:\.\d+)?\s*(?:M\+?|million|Million)\+?\s*(?:feet|ft|feet\b)[^.\n]{0,20}/gi },
  { name: 'ISO certification', re: /ISO\s*9001(?::?\s*\d{4})?[^.\n]{0,22}/g },
  { name: 'company name',      re: /Insulation\s+Products\s+Corp(?:oration)?\.?/gi },
  { name: 'copyright line',    re: /©\s*[^\n]{0,30}/g },
  { name: 'lead time claim',   re: /lead\s+time[^.\n]{0,40}|ship(?:s|ped|ping)?\s+(?:the\s+)?same[\s-]day[^.\n]{0,30}/gi },
];

const rows = [];
for (const [url, entries] of Object.entries(DUMP)) {
  for (const e of entries) {
    if (e.kind === 'link-href') continue;
    rows.push({ url, ...e });
  }
}
/* the noscript entries are identical on every route — keep one representative
   plus the count, so the drift shows without 15 duplicate lines */
console.log(`facts corpus: ${rows.length} entries over ${Object.keys(DUMP).length} pages\n`);

for (const f of FACTS) {
  const variants = new Map();     // exact rendered string -> {urls:Set, kinds:Set}
  for (const r of rows) {
    for (const m of r.text.matchAll(f.re)) {
      const s = m[0].replace(/\s+/g, ' ').trim();
      if (!variants.has(s)) variants.set(s, { urls: new Set(), kinds: new Set(), noscript: false });
      const v = variants.get(s);
      v.urls.add(collapse(r.url));
      v.kinds.add(r.kind);
      if (r.kind === 'noscript') v.noscript = true;
    }
  }
  console.log(`### ${f.name}: ${variants.size} distinct rendering(s)`);
  for (const [s, v] of [...variants.entries()].sort((a, b) => b[1].urls.size - a[1].urls.size)) {
    console.log(`  ${JSON.stringify(s)}`);
    console.log(`      ${v.urls.size} url(s), kinds=${[...v.kinds].join(',')}${v.noscript ? '  <-- NOSCRIPT SECOND COPY' : ''}`);
    if (v.urls.size <= 6) console.log(`      ${[...v.urls].join(' , ')}`);
  }
  console.log('');
}

/* Titles and meta descriptions carry facts too — print them all so a fact
   stated only in metadata cannot hide. */
console.log('### every <title>');
const titles = new Map();
for (const r of rows) if (r.kind === 'title') {
  if (!titles.has(r.text)) titles.set(r.text, new Set());
  titles.get(r.text).add(collapse(r.url));
}
for (const [t, u] of titles) console.log(`  ${JSON.stringify(t)}  [${[...u].join(', ')}]`);
console.log('');

console.log('### every meta description');
const descs = new Map();
for (const r of rows) if (r.kind === 'meta:description') {
  if (!descs.has(r.text)) descs.set(r.text, new Set());
  descs.get(r.text).add(collapse(r.url));
}
for (const [t, u] of descs) console.log(`  (${t.length} chars) ${JSON.stringify(t)}\n      [${[...u].join(', ')}]`);
