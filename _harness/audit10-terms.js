/**
 * AUDIT-10 pass-4 step 4.4 — casing and terminology consistency.
 *
 *  (a) heading case per component class — every <h1>, every eyebrow, every
 *      card title grouped by the JSX line that renders it (DOM path with
 *      nth-of-type stripped), then classified Title Case / Sentence case /
 *      ALL CAPS. Mixed classification inside one class is the finding.
 *  (b) canonical spellings — competing renderings of the same term.
 *  (c) SKU casing on the rendered page vs the value in products-all.json.
 *      Rendering drift only; the data itself is server-owned.
 *
 * Usage: node _harness/audit10-terms.js
 */
const fs = require('fs');
const path = require('path');

const STATE = path.join(__dirname, '..', 'plans', 'audit10', 'state');
const DUMP = JSON.parse(fs.readFileSync(path.join(STATE, 'textdump.json'), 'utf8'));
const PRODUCTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8'));

const collapse = (u) => u.replace(/^\/products\?productId=.*/, '/products?productId=<42>');

/* ---------- (a) heading case per component class ---------- */
const SMALL = new Set(['a', 'an', 'and', 'the', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'is']);
function caseClass(s) {
  const t = s.trim().replace(/[—–·✕↑↓→↗▼▲✓+]/g, ' ').trim();
  const words = t.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (!words.length) return null;
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length > 2 && letters === letters.toUpperCase()) return 'ALL CAPS';
  if (words.length === 1) return /^\p{Lu}/u.test(words[0]) ? 'Cap' : 'lower';
  const significant = words.filter((w, i) => i === 0 || !SMALL.has(w.toLowerCase()));
  const capped = significant.filter((w) => /^[\p{Lu}0-9"'(]/u.test(w)).length;
  if (capped === significant.length) return 'Title Case';
  if (/^\p{Lu}/u.test(words[0])) return 'Sentence case';
  return 'lower';
}

const classes = new Map();
for (const [url, entries] of Object.entries(DUMP)) {
  for (const e of entries) {
    if (e.kind !== 'text') continue;
    const t = e.text.trim();
    if (!t || t.length > 70) continue;
    if (!/\p{L}/u.test(t)) continue;
    const key = collapse(url) + ' :: ' + e.path.replace(/:nth-of-type\(\d+\)/g, '');
    if (!classes.has(key)) classes.set(key, []);
    classes.get(key).push(t);
  }
}
console.log('### (a) heading/label case drift inside one component class (>=3 instances)');
let drifts = 0;
for (const [k, texts] of classes) {
  if (texts.length < 3) continue;
  const tally = new Map();
  for (const t of texts) {
    const c = caseClass(t);
    if (!c) continue;
    if (!tally.has(c)) tally.set(c, []);
    tally.get(c).push(t);
  }
  if (tally.size < 2) continue;
  /* one-word entries are unclassifiable between Title and Sentence — ignore a
     class whose only disagreement is Cap vs Title Case */
  const kinds = [...tally.keys()].filter((c) => c !== 'Cap');
  if (kinds.length < 2) continue;
  drifts++;
  console.log(`  ${k}   (${texts.length} instances)`);
  for (const [c, list] of tally) {
    console.log(`      ${c} x${list.length}: ${list.slice(0, 5).map((s) => JSON.stringify(s)).join(', ')}${list.length > 5 ? ' …' : ''}`);
  }
}
if (!drifts) console.log('  none');
console.log('');

/* ---------- (b) canonical spellings ---------- */
const TERMS = [
  ['data sheet',   /\bdata[\s-]?sheets?\b/gi],
  ['email',        /\be[\s-]?mails?\b/gi],
  ['set up',       /\bset[\s-]?ups?\b/gi],
  ['sign in',      /\b(?:sign|log)[\s-]?(?:in|out)s?\b/gi],
  ['website',      /\bweb[\s-]?sites?\b/gi],
  ['heat shrink',  /\bheat[\s-]?shrink(?:able)?\b/gi],
  ['catalog',      /\bcatalog(?:ue)?s?\b/gi],
  ['part number',  /\b(?:part[\s-]?(?:number|id|no\.?)|sku)s?\b/gi],
  ['cut to length',/\bcut[\s-]?to[\s-]?length\b/gi],
  ['hot stamp',    /\bhot[\s-]?stamp(?:ing|ed)?\b/gi],
  ['spec grade',   /\bspec(?:ification)?[\s-]?grade\b/gi],
  ['MIL-SPEC',     /\bmil[\s-]?spec\b/gi],
  ['same day',     /\bsame[\s-]?day\b/gi],
  ['drop down',    /\bdrop[\s-]?downs?\b/gi],
  ['back up',      /\bback[\s-]?ups?\b/gi],
  ['on-line',      /\bon[\s-]?line\b/gi],
  ['UL / U/L',     /\bU\/?L\b(?!\s*[a-z])/g],
];
console.log('### (b) canonical-spelling drift');
for (const [name, re] of TERMS) {
  const variants = new Map();
  for (const [url, entries] of Object.entries(DUMP)) {
    for (const e of entries) {
      if (e.kind === 'link-href') continue;
      for (const m of e.text.matchAll(re)) {
        const s = m[0];
        if (!variants.has(s)) variants.set(s, new Set());
        variants.get(s).add(collapse(url));
      }
    }
  }
  if (variants.size < 2) { console.log(`  ${name}: ${variants.size} rendering — consistent`); continue; }
  console.log(`  ${name}: ${variants.size} renderings`);
  for (const [s, u] of [...variants].sort((a, b) => b[1].size - a[1].size)) {
    console.log(`      ${JSON.stringify(s)}  on ${u.size} url(s)${u.size <= 4 ? ': ' + [...u].join(', ') : ''}`);
  }
}
console.log('');

/* ---------- (c) SKU casing: rendered vs products-all.json ---------- */
console.log('### (c) SKU rendering vs products-all.json');
const skus = PRODUCTS.map((p) => String(p.sku || p.id || '')).filter(Boolean);
const bad = [];
for (const [url, entries] of Object.entries(DUMP)) {
  for (const e of entries) {
    if (e.kind === 'link-href') continue;
    for (const sku of skus) {
      if (!sku || sku.length < 3) continue;
      const re = new RegExp('(?<![A-Za-z0-9-])' + sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9-])', 'gi');
      for (const m of e.text.matchAll(re)) {
        if (m[0] !== sku) bad.push({ url: collapse(url), kind: e.kind, canonical: sku, rendered: m[0], ctx: e.text.trim().slice(0, 90) });
      }
    }
  }
}
const seen = new Set();
console.log(`  ${bad.length} rendering(s) whose case differs from the data value`);
for (const b of bad) {
  const k = b.canonical + '|' + b.rendered + '|' + b.url;
  if (seen.has(k)) continue; seen.add(k);
  console.log(`      data=${JSON.stringify(b.canonical)} rendered=${JSON.stringify(b.rendered)}  ${b.url} [${b.kind}]  ${JSON.stringify(b.ctx)}`);
}
