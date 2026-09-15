/**
 * Claims re-audit (2026-09-15) — what the DATASHEETS evidence.
 *
 * `claims-catalog.js` counts a claim's support in the catalog JSON, which is
 * marketing copy someone typed. The datasheets in `pdfs/` are the documents a
 * customer's quality department actually asks for, and they are the closest
 * thing to a primary source this repository holds. "Full RoHS Compliant Product
 * Line" backed by 2 of 42 JSON records is a much weaker statement than the same
 * claim backed by 2 of 42 DATASHEETS, and until this ran there was no way to
 * tell the two apart.
 *
 * The extractor is crude on purpose — inflate every Flate stream, pull the
 * literal strings out of the text operators — because the alternative is a
 * dependency, and PLAN-11 §10.3 rule 7 keeps this offline. Crude means it can
 * MISS text: a datasheet whose text is a scanned image, or is encoded through a
 * font subset with a non-identity CMap, comes back short or empty. So every run
 * prints its own coverage, and a zero-yield file is reported as
 * [NOT-MEASURED] rather than counted as an absence. An absence that might be
 * the tool's fault is not evidence.
 *
 * Usage: node _harness/claims-pdfs.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const PDFDIR = path.join(ROOT, 'pdfs');

function extract(file) {
  const s = fs.readFileSync(file).toString('latin1');
  const chunks = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    if (end < 0) continue;
    let inf;
    try { inf = zlib.inflateSync(Buffer.from(s.slice(start, end), 'latin1')).toString('latin1'); }
    catch (e) { continue; }
    if (!/\b(Tj|TJ)\b/.test(inf)) continue;          // not a content stream
    const lit = [...inf.matchAll(/\((?:[^()\\]|\\.)*\)/g)].map((x) => x[0].slice(1, -1));
    if (lit.length) chunks.push(lit.join(''));
  }
  return chunks.join(' ')
    .replace(/\\([0-9]{1,3})/g, ' ')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const files = fs.readdirSync(PDFDIR).filter((f) => /\.pdf$/i.test(f)).sort();
const docs = files.map((f) => ({ f, text: extract(path.join(PDFDIR, f)) }));
const empty = docs.filter((d) => d.text.length < 200);

console.log(`${files.length} datasheets in pdfs/`);
console.log(`  text recovered from ${docs.length - empty.length}`);
if (empty.length) {
  console.log(`  [NOT-MEASURED] ${empty.length} yielded <200 chars — not counted as absences:`);
  empty.forEach((d) => console.log(`      ${d.f} (${d.text.length} chars)`));
}

const CLAIMS = [
  ['RoHS', /\bRoHS\b/i],
  ['UL / U/L / CUL', /\bU\/?L\b|\bCUL\b|Underwriters/i],
  ['CSA', /\bCSA\b/],
  ['MIL-SPEC / MIL-I / MIL-DTL', /\bMIL[- ]?(SPEC|I|R|DTL|C|W)\b/i],
  ['AMS', /\bAMS\b/],
  ['FDA / 21 CFR', /\bFDA\b|21\s*CFR/i],
  ['USP Class VI', /\bUSP\b|Class\s*VI/i],
  ['ISO 10993', /ISO\s*10993/i],
  ['ASTM', /\bASTM\b/],
  ['NEMA', /\bNEMA\b/],
  ['QPL', /\bQPL\b/],
  ['Made in USA / domestic origin', /made in (the )?usa|u\.?s\.?a\.? made|domestic(ally)? (made|produced)/i],
  ['imported / non-US origin', /\bimported\b|made in (?!the usa)(china|mexico|taiwan|korea|japan|germany)/i],
  ['ISO 9001', /ISO\s*9001/i],
  ['REACH', /\bREACH\b/],
];

const measured = docs.filter((d) => d.text.length >= 200);
console.log(`\nsupport among the ${measured.length} datasheets text was recovered from:\n`);
for (const [label, re] of CLAIMS) {
  const hits = measured.filter((d) => re.test(d.text));
  console.log(`  ${label.padEnd(30)} ${String(hits.length).padStart(2)}/${measured.length}   ` +
    (hits.length === 0 ? '(none)'
      : hits.slice(0, 5).map((d) => d.f.replace(/\.pdf$/i, '')).join(', ')
        + (hits.length > 5 ? ` +${hits.length - 5}` : '')));
}

fs.mkdirSync(path.join(__dirname, 'out', 'claims'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', 'claims', 'pdf-text.json'),
  JSON.stringify(docs.map((d) => ({ file: d.f, chars: d.text.length, text: d.text })), null, 1));
console.log(`\n-> ${path.join(__dirname, 'out', 'claims', 'pdf-text.json')}`);
