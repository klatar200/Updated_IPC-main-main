/**
 * Claims re-audit (2026-09-15) — provenance. For every claim in the register,
 * did the LAST LIVE SITE say it too?
 *
 * Keagan's question: "even if the evidence is just what the last live site at
 * insulationproducts.com had — we need to re-evaluate each claim". This is that
 * evidence, mechanised.
 *
 * It matters because the two cases are different problems:
 *   INHERITED  — the claim was on the customer's own site before this project
 *                existed. It still needs a source, but the source is IPC's, the
 *                claim is years old, and removing it is a business decision.
 *   INTRODUCED — this project put it on the page. Nobody at IPC ever said it.
 *                That is POST-9.1's class, and it is the class this pass exists
 *                to find the rest of.
 *
 * Corpus: `_harness/out/claims/live/index-live.js`, the minified bundle served
 * at `http://www.insulationproducts.com/site/` on 2026-09-15, uploaded
 * 2026-09-04. It is a predecessor of this app, not a build of this repo
 * (`audit-runs/live-triage-2026-09-15.md` §5) — which is exactly what makes it
 * usable as an independent witness.
 *
 * Matching is deliberately generous: a claim counts as INHERITED if its text
 * appears in the live bundle after whitespace and punctuation normalisation, or
 * if a >=24-character distinctive run of it does. A generous matcher biases
 * toward calling things inherited, i.e. toward NOT raising a finding — the safe
 * direction for a register whose false positives cost Keagan time.
 *
 * Usage: node _harness/claims-provenance.js   (needs _harness/out/claims/register.tsv)
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out', 'claims');
const LIVE = path.join(OUT, 'live', 'index-live.js');
if (!fs.existsSync(LIVE)) {
  console.error(`missing ${LIVE} — capture it first (read-only GET of /site/assets/index-*.js)`);
  process.exit(2);
}

const norm = (s) => String(s)
  .replace(/\\u00a0| /g, ' ')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

const liveRaw = fs.readFileSync(LIVE, 'utf8');
// The bundle stores these as JS string literals with \u escapes; decode the
// common ones so an em dash in content.json can match an em dash in the bundle.
const live = norm(liveRaw.replace(/\\u([0-9a-fA-F]{4})/g,
  (_, h) => String.fromCharCode(parseInt(h, 16))));

const rows = fs.readFileSync(path.join(OUT, 'register.tsv'), 'utf8')
  .split('\n').slice(1).filter(Boolean)
  .map((l) => { const [file, line, instances, pointer, text] = l.split('\t'); return { file, line, instances, pointer, text }; });

function provenance(text) {
  const t = norm(text);
  if (t.length < 4) return 'SHORT';
  if (live.includes(t)) return 'INHERITED';
  // A long claim may have been lightly reworded. Look for a distinctive run.
  if (t.length >= 40) {
    for (let i = 0; i + 24 <= t.length; i += 8) {
      if (live.includes(t.slice(i, i + 24))) return 'INHERITED-PARTIAL';
    }
  }
  return 'INTRODUCED';
}

const tally = {};
const out = rows.map((r) => {
  const p = provenance(r.text);
  tally[p] = (tally[p] || 0) + 1;
  return { ...r, provenance: p };
});

fs.writeFileSync(path.join(OUT, 'provenance.tsv'),
  ['file\tline\tinstances\tprovenance\tpointer\ttext',
    ...out.map((r) => [r.file, r.line, r.instances, r.provenance, r.pointer,
      r.text].join('\t'))].join('\n'));

console.log(`${rows.length} register rows against the live bundle\n`);
Object.entries(tally).sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));

// The list that matters: claims this project introduced, in the two data files
// and the HTML shell — i.e. what a visitor reads, not what App.jsx defaults to.
console.log('\nINTRODUCED, in data/*.json and index.html:');
out.filter((r) => r.provenance === 'INTRODUCED'
    && /^(data\/|index\.html)/.test(r.file))
  .forEach((r) => console.log(`  ${r.file}:${r.line}  ${r.pointer || ''}\n      ${r.text.slice(0, 160)}`));
console.log(`\n-> ${path.join(OUT, 'provenance.tsv')}`);
