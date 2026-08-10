/**
 * AUDIT-10 pass-4 step 4.2 — mechanical character-class scans over the dump.
 *
 * Reads plans/audit10/state/textdump.json and runs, as code rather than by
 * eye: (a) encoding artifacts, (b) whitespace, (c) punctuation pairing,
 * (d) dash/quote inventory, (e) repeated words, (f) sentence-terminal drift
 * within one component class.
 *
 * Prints a report; writes nothing. Every hit it prints is a LEAD — the pass
 * confirms each one in the rendered page before it can become a finding.
 *
 * Usage: node _harness/audit10-copyscan.js [section]
 */
const fs = require('fs');
const path = require('path');

const DUMP = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'plans', 'audit10', 'state', 'textdump.json'), 'utf8'));

const only = process.argv[2];
const section = (n) => !only || only === n;

/* Product pages share one template; collapse them so a template-level nit
   is reported once with a count instead of 42 times. */
const PRODUCT_RE = /^\/products\?productId=/;
const collapse = (url) => (PRODUCT_RE.test(url) ? '/products?productId=<42>' : url);

const rows = [];
for (const [url, entries] of Object.entries(DUMP)) {
  for (const e of entries) rows.push({ url, ...e });
}
const textish = rows.filter((r) => r.kind === 'text');
console.log(`corpus: ${Object.keys(DUMP).length} pages, ${rows.length} entries, ${textish.length} text nodes\n`);

/* Group identical (text,kind,path) across product pages so output stays readable. */
function report(name, hits, sample = 40) {
  const groups = new Map();
  for (const h of hits) {
    const key = JSON.stringify([h.why, h.text, h.kind, h.path]);
    if (!groups.has(key)) groups.set(key, { ...h, urls: new Set() });
    groups.get(key).urls.add(collapse(h.url));
  }
  console.log(`### ${name}: ${hits.length} hits, ${groups.size} distinct`);
  let i = 0;
  for (const g of groups.values()) {
    if (i++ >= sample) { console.log(`   … ${groups.size - sample} more distinct`); break; }
    const urls = [...g.urls];
    console.log(`  [${g.why}] ${JSON.stringify(g.text.length > 180 ? g.text.slice(0, 180) + '…' : g.text)}`);
    console.log(`      kind=${g.kind} path=${g.path}`);
    console.log(`      on ${urls.length} url(s): ${urls.slice(0, 4).join(' , ')}${urls.length > 4 ? ' …' : ''}`);
  }
  console.log('');
}

/* ---------- (a) encoding artifacts ---------- */
if (section('a')) {
  const MOJI = [
    ['Ã', /Ã[-¿–—“”’©®]/],
    ['â€', /â€/],
    ['Â', /Â[^\s]/],
    ['U+FFFD', /�/],
    ['ï»¿/BOM', /﻿/],
    ['literal entity', /&(amp|quot|#0?39|apos|lt|gt|nbsp|copy|mdash|ndash|rsquo|ldquo|rdquo|#x[0-9a-fA-F]+|#\d+);/],
  ];
  const hits = [];
  for (const r of rows) {
    if (r.kind === 'link-href') continue; // hrefs legitimately carry & and %XX
    for (const [why, re] of MOJI) if (re.test(r.text)) hits.push({ ...r, why });
  }
  report('(a) encoding artifacts', hits);

  /* full non-ASCII inventory — so nothing exotic hides */
  const chars = new Map();
  for (const r of rows) {
    if (r.kind === 'link-href') continue;
    for (const ch of r.text) {
      const cp = ch.codePointAt(0);
      if (cp > 126) chars.set(ch, (chars.get(ch) || 0) + 1);
    }
  }
  console.log('### (a2) non-ASCII character inventory');
  for (const [ch, n] of [...chars.entries()].sort((a, b) => b[1] - a[1])) {
    const cp = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    console.log(`  U+${cp}  ${JSON.stringify(ch)}  x${n}`);
  }
  console.log('');
}

/* ---------- (b) whitespace ---------- */
if (section('b')) {
  const hits = [];
  for (const r of rows) {
    if (r.kind === 'link-href') continue;
    const t = r.text;
    // Double space INSIDE a sentence (not indentation): letter/punct, 2+ spaces, letter.
    if (/[\p{L}\p{N},.;:!?)\]"']  +[\p{L}\p{N}("']/u.test(t.replace(/\n/g, '\n')) &&
        !/\n/.test(t)) hits.push({ ...r, why: 'double-space-in-sentence' });
    // Space before terminal/clause punctuation.
    if (/\S[  ]+[,.;:!?%](?=\s|$)/.test(t)) hits.push({ ...r, why: 'space-before-punctuation' });
    // Non-breaking space used as an ordinary word space.
    if (/ /.test(t)) hits.push({ ...r, why: 'nbsp-in-copy' });
    // Tab or newline inside what renders as one line (kinds that never wrap markup).
    if ((r.kind !== 'text' && r.kind !== 'noscript' && !r.kind.startsWith('control:')) && /[\t\n]/.test(t)) {
      hits.push({ ...r, why: 'whitespace-in-attribute' });
    }
    // Attribute copy with leading/trailing space (renders verbatim in placeholders/labels).
    if ((r.kind === 'placeholder' || r.kind === 'alt' || r.kind === 'aria-label' || r.kind === 'title-attr') &&
        t !== t.trim() && t.trim() !== '') hits.push({ ...r, why: 'attribute-untrimmed' });
  }
  report('(b) whitespace', hits, 60);
}

/* ---------- (c) punctuation pairing ---------- */
if (section('c')) {
  const hits = [];
  /* Pair per RENDERED BLOCK, not per raw text node: React splits one sentence
     into many nodes, so a per-node check would fire on every interpolation. */
  const blocks = new Map();
  for (const r of rows) {
    if (r.kind !== 'text') continue;
    // the nearest block-ish ancestor path: drop the last inline segment
    const key = r.url + '||' + r.path.replace(/>(span|a|strong|em|b|i|code|small|sup|sub)(:nth-of-type\(\d+\))?$/, '');
    if (!blocks.has(key)) blocks.set(key, { url: r.url, path: key.split('||')[1], kind: 'block', text: '' });
    blocks.get(key).text += r.text;
  }
  for (const b of blocks.values()) {
    /* Inch marks are the dominant false positive in a heat-shrink catalogue
       (3/8", .004", 1.725"). Strip a double quote that directly follows a
       digit before counting pairs — it is a unit, not an opening quote. */
    const t = b.text.replace(/(?<=[0-9])"/g, '');
    const count = (re) => (t.match(re) || []).length;
    const checks = [
      ['unbalanced-paren', count(/\(/g) !== count(/\)/g)],
      ['unbalanced-bracket', count(/\[/g) !== count(/\]/g)],
      ['unbalanced-brace', count(/\{/g) !== count(/\}/g)],
      ['odd-straight-double-quote', count(/"/g) % 2 === 1],
      ['unbalanced-curly-double', count(/“/g) !== count(/”/g)],
      ['unbalanced-curly-single', false], // apostrophes make this meaningless
    ];
    for (const [why, bad] of checks) if (bad) hits.push({ ...b, why });
  }
  report('(c) punctuation pairing (per rendered block)', hits, 60);
}

/* ---------- (d) dash / quote inventory ---------- */
if (section('d')) {
  const tally = {};
  const bump = (k, r) => { (tally[k] = tally[k] || []).push(r); };
  for (const r of rows) {
    if (r.kind === 'link-href') continue;
    const t = r.text;
    if (/'/.test(t)) bump("straight-apostrophe '", r);
    if (/’/.test(t)) bump('curly-apostrophe ’', r);
    if (/"/.test(t)) bump('straight-double-quote "', r);
    if (/[“”]/.test(t)) bump('curly-double-quote “”', r);
    if (/—/.test(t)) bump('em-dash —', r);
    if (/–/.test(t)) bump('en-dash –', r);
    if (/\p{L} - \p{L}/u.test(t)) bump('hyphen-as-dash " - "', r);
    if (/\p{L} -- ?\p{L}/u.test(t)) bump('double-hyphen "--"', r);
    if (/\.\.\./.test(t)) bump('three-dot ellipsis "..."', r);
    if (/…/.test(t)) bump('ellipsis char …', r);
  }
  console.log('### (d) dash/quote inventory (DRIFT is the finding, not the style)');
  for (const [k, v] of Object.entries(tally)) {
    const urls = new Set(v.map((r) => collapse(r.url)));
    console.log(`  ${k}: ${v.length} entries on ${urls.size} url(s)`);
    for (const r of v.slice(0, 8)) {
      console.log(`      ${collapse(r.url)} :: ${JSON.stringify(r.text.slice(0, 120))} [${r.kind}]`);
    }
    if (v.length > 8) console.log(`      … ${v.length - 8} more`);
  }
  console.log('');
}

/* ---------- (e) repeated words ---------- */
if (section('e')) {
  const hits = [];
  for (const r of rows) {
    if (r.kind === 'link-href') continue;
    const m = r.text.match(/\b(\p{L}{2,})\s+\1\b/giu);
    if (m) hits.push({ ...r, why: 'repeated-word:' + m.join('|') });
  }
  /* also across adjacent text nodes inside one block */
  report('(e) repeated words', hits, 40);
}

/* ---------- (f) sentence-terminal drift within a component class ---------- */
if (section('f')) {
  /* component class = (url-family, DOM path with all nth-of-type stripped),
     i.e. every card blurb rendered by the same JSX line. */
  const classes = new Map();
  for (const r of rows) {
    if (r.kind !== 'text') continue;
    const t = r.text.trim();
    if (t.length < 25) continue;                 // fragments, not sentences
    if (!/\p{L}/u.test(t)) continue;
    const cls = collapse(r.url) + ' :: ' + r.path.replace(/:nth-of-type\(\d+\)/g, '');
    if (!classes.has(cls)) classes.set(cls, []);
    classes.get(cls).push(t);
  }
  console.log('### (f) sentence-terminal drift within one component class');
  let n = 0;
  for (const [cls, texts] of classes) {
    if (texts.length < 3) continue;
    const withDot = texts.filter((t) => /[.!?]$/.test(t)).length;
    if (withDot === 0 || withDot === texts.length) continue;
    n++;
    console.log(`  ${cls}`);
    console.log(`      ${withDot}/${texts.length} end with terminal punctuation`);
    for (const t of texts.slice(0, 8)) console.log(`      ${/[.!?]$/.test(t) ? '.' : ' '} ${JSON.stringify(t.slice(0, 110))}`);
    if (texts.length > 8) console.log(`      … ${texts.length - 8} more`);
  }
  if (!n) console.log('  none — every multi-instance component class is internally consistent');
  console.log('');
}
