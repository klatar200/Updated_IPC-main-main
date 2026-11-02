/**
 * Claims re-audit (2026-09-15) — pull every candidate factual claim out of the
 * whole publishable surface, with a file:line for each.
 *
 * Why an instrument rather than reading the files: the claim surface is four
 * files and ~1,900 string leaves, and the failure mode of reading it by hand is
 * the one POST-9.1 already caught — a number nobody could source, sitting in
 * plain sight for a year because every reader assumed a previous reader had
 * checked it. A grep that reports its own denominator cannot skip a row.
 *
 * What counts as a CANDIDATE here is deliberately wide: any string carrying a
 * digit, or one of the certification/capability words a buyer would treat as an
 * attestation. Narrow it and the register inherits the assumption that made
 * POST-9.1 possible. Curation happens afterwards, in the register, in writing.
 *
 * Line numbers come from the RAW text, not from the parsed object — a JSON
 * pointer is not a citation Rick or a compliance reader can open.
 *
 * Usage: node _harness/claims-extract.js  [> _harness/out/claims/register.tsv]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'claims');
fs.mkdirSync(OUT, { recursive: true });

// Words that make a string an attestation even with no digit in it. Every one
// of these is something a purchasing or quality person can ask for a document
// to back.
const KEYWORDS = /\b(ISO|RoHS|UL|CSA|MIL[- ]?SPEC|MIL[- ]?I|AMS|FDA|REACH|PPAP|IMDS|ITAR|JIT|certified|certification|registered|compliant|compliance|recognized|listed|approved|accredited|audited|made in usa|domestic|same[- ]day|next[- ]day|in stock|stocking|minimum order|lead time|warrant|guarantee|ISO 9001)\b/i;
const HASDIGIT = /\d/;

// CSS, Tailwind class lists, gradients, transitions and selectors. They carry
// digits and therefore pass HASDIGIT, and they are 90% of `App.jsx`'s string
// literals. A register they drown is a register nobody reads to the end.
const CSSFUNC = /\b(rgba?|var|calc|linear-gradient|radial-gradient|translate[XY]?|rotate|scale|clamp|url|cubic-bezier|blur|drop-shadow)\s*\(/;
const CSSUNIT = /\d\s*(px|rem|em|vw|vh|vmin|vmax|ch|deg|ms|fr)\b/;
function isStyle(s) {
  if (CSSFUNC.test(s) || CSSUNIT.test(s)) return true;
  if (/^\d+(\.\d+)?s(,|$| )/.test(s)) return true;                     // "0.2s, opacity 0.2s"
  const toks = s.split(/\s+/).filter(Boolean);
  if (toks.length < 2) return false;
  // Tailwind/utility soup: most tokens are hyphenated or variant-prefixed and
  // none of them is a sentence word.
  const util = toks.filter((t) => /^[a-z0-9]+([-:/][a-z0-9.[\]%-]+)+$/i.test(t)).length;
  return util / toks.length >= 0.6;
}

// A cursor, not a search. The first cut looked each value up with
// `lines.find(includes(...))`, which put `stats[1].value` ("42") on line 0 and
// `industryDetail[0].certs[2]` ("RoHS") on line 6 — short values collide with
// every other occurrence in the file, and a citation pointing at the wrong line
// is worse than no citation. JSON preserves document order and the walk below
// is in document order, so a forward-only cursor cannot mismatch.
function lineIndex(raw) {
  let pos = 0;
  return (needle) => {
    if (needle === null || needle === undefined) return 0;
    const enc = JSON.stringify(String(needle));       // exact, with quotes and escapes
    let i = raw.indexOf(enc, pos);
    if (i < 0) i = raw.indexOf(enc);                  // fall back to a global find
    if (i < 0) return 0;
    pos = i + enc.length;
    let line = 1;
    for (let j = 0; j < i; j++) if (raw.charCodeAt(j) === 10) line++;
    return line;
  };
}

const rows = [];
let scanned = 0;

function walkJson(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const at = lineIndex(raw);
  const obj = JSON.parse(raw);
  (function walk(node, pointer) {
    if (node === null || typeof node !== 'object') {
      // Advance the cursor on EVERY leaf, not just the ones that are kept —
      // otherwise a skipped leaf holding the same text as the next claim
      // (`"RoHS"` occurs 9 times) steals its line number.
      const line = at(node);
      if (typeof node !== 'string') return;
      scanned++;
      if (HASDIGIT.test(node) || KEYWORDS.test(node)) rows.push({ file, line, pointer, text: node });
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${pointer}[${i}]`));
    if (node && typeof node === 'object') {
      return Object.entries(node).forEach(([k, v]) => walk(v, pointer ? `${pointer}.${k}` : k));
    }
  })(obj, '');
}

// index.html and contact.php carry claims as markup/PHP, not as JSON leaves, so
// they are scanned line-wise. App.jsx is scanned the same way: its hardcoded
// COPY/SITE defaults are what renders when site-data/*.json is missing a key, which
// is exactly the state a fresh deploy is in for one request.
function walkText(file, opts = {}) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  raw.split('\n').forEach((l, i) => {
    const t = l.trim();
    if (!t || t.length < 8) return;
    scanned++;
    if (opts.skip && opts.skip.test(t)) return;
    if (HASDIGIT.test(t) || KEYWORDS.test(t)) {
      rows.push({ file, line: i + 1, pointer: '', text: t.slice(0, 400) });
    }
  });
}

walkJson('site-data/site-info.json');
walkJson('site-data/content.json');
walkText('index.html');
walkText('public/contact.php', { skip: /^(\/\/|\*|\/\*|#)/ });
// App.jsx: only the lines that are visible copy or a default, not every line
// with a digit in it (13k lines of JSX would drown the register).
{
  const raw = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');
  raw.split('\n').forEach((l, i) => {
    scanned++;
    const m = l.match(/"([^"]{12,300})"|'([^']{12,300})'|`([^`]{12,300})`/g);
    if (!m) return;
    for (const lit of m) {
      const s = lit.slice(1, -1);
      if (!/[a-z]/i.test(s)) continue;
      if (/^[\w.\-/#(){}[\]:;,%\s]*$/.test(s) && !/ [a-z]/i.test(s)) continue; // class lists, paths
      if (!(HASDIGIT.test(s) || KEYWORDS.test(s))) continue;
      if (/^(https?:|\/|#|[a-z-]+:)/.test(s) && !/\s/.test(s)) continue; // bare URLs/selectors
      if (isStyle(s)) continue;
      rows.push({ file: 'src/App.jsx', line: i + 1, pointer: '', text: s });
    }
  });
}

// De-duplicate identical text within a file — a repeated string is one claim
// with several instances, and the register says so rather than listing it twice.
const seen = new Map();
for (const r of rows) {
  const k = `${r.file}\u0000${r.text}`;
  if (seen.has(k)) { seen.get(k).instances.push(r.line); continue; }
  seen.set(k, { ...r, instances: [r.line] });
}
const uniq = [...seen.values()];

const tsv = ['file\tline\tinstances\tpointer\ttext',
  ...uniq.map((r) => [r.file, r.line, r.instances.length, r.pointer,
    r.text.replace(/\s+/g, ' ')].join('\t'))].join('\n');
fs.writeFileSync(path.join(OUT, 'register.tsv'), tsv);

const byFile = {};
uniq.forEach((r) => { byFile[r.file] = (byFile[r.file] || 0) + 1; });
console.log(`scanned ${scanned} strings/lines`);
console.log(`candidates: ${uniq.length} unique (${rows.length} instances)`);
Object.entries(byFile).forEach(([f, n]) => console.log(`  ${String(n).padStart(4)}  ${f}`));
console.log(`-> ${path.join(OUT, 'register.tsv')}`);
