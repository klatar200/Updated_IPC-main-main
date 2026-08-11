/**
 * AUDIT-10 pass-4 step 4.3 — the unique-word list.
 *
 * No aspell/hunspell and no /usr/share/dict on this box (checked), so the pass
 * file's fallback applies: emit the unique word list and read it IN FULL.
 * This script produces that list; the reading is the audit.
 *
 * Splits on non-letters but keeps word-internal hyphens and apostrophes, so
 * "heat-shrinkable" and "Underwriters'" stay whole. Pure-numeric and
 * alphanumeric part-number tokens (IP38FE, 94V-2, E129478) are separated into
 * their own bucket so the prose vocabulary is small enough to read.
 *
 * Usage:
 *   node _harness/audit10-words.js            # prose vocabulary, one per line
 *   node _harness/audit10-words.js --where X  # every place word X renders
 *   node _harness/audit10-words.js --codes    # the part-number/code bucket
 *   node _harness/audit10-words.js --site     # only words the SITE emits
 *                                             # (excludes text present in
 *                                             #  data/*.json — owner content)
 */
const fs = require('fs');
const path = require('path');

const STATE = path.join(__dirname, '..', 'plans', 'audit10', 'state');
const DUMP = JSON.parse(fs.readFileSync(path.join(STATE, 'textdump.json'), 'utf8'));

/* Owner-typed content is server-owned and out of scope for spelling. Build a
   haystack of everything the three JSON files carry so a word that appears
   ONLY there can be labelled as his data rather than the site's copy. */
const OWNER = ['products-all.json', 'site-info.json', 'content.json']
  .map((f) => {
    const p = path.join(__dirname, 'pristine', f);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  }).join('\n').toLowerCase();

const WORD = /[\p{L}][\p{L}’'’-]*/gu;

const prose = new Map();   // word -> {count, urls:Set, kinds:Set}
const codes = new Map();

for (const [url, entries] of Object.entries(DUMP)) {
  for (const e of entries) {
    if (e.kind === 'link-href') continue;
    if (e.kind === 'noscript') continue;         // handled by audit10-facts.js
    for (const m of e.text.matchAll(WORD)) {
      const raw = m[0].replace(/^[-'’]+|[-'’]+$/g, '');
      if (!raw) continue;
      // a token glued to digits in the ORIGINAL text is a code, not a word
      const i = m.index;
      const before = e.text[i - 1] || '';
      const after = e.text[i + m[0].length] || '';
      const isCode = /[0-9]/.test(before) || /[0-9]/.test(after);
      const bucket = isCode ? codes : prose;
      const key = raw;
      if (!bucket.has(key)) bucket.set(key, { count: 0, urls: new Set(), kinds: new Set(), samples: [] });
      const rec = bucket.get(key);
      rec.count++;
      rec.urls.add(url.replace(/^\/products\?productId=.*/, '/products?productId=<42>'));
      rec.kinds.add(e.kind);
      if (rec.samples.length < 3) rec.samples.push(url + ' :: ' + e.text.trim().slice(0, 150));
    }
  }
}

const args = process.argv.slice(2);
const where = args.indexOf('--where') >= 0 ? args[args.indexOf('--where') + 1] : null;
const siteOnly = args.includes('--site');
const wantCodes = args.includes('--codes');

if (where) {
  const rec = prose.get(where) || codes.get(where);
  if (!rec) { console.log('not in dump:', where); process.exit(0); }
  console.log(`${where}: ${rec.count} occurrences, kinds=${[...rec.kinds].join(',')}`);
  for (const [url, entries] of Object.entries(DUMP)) {
    for (const e of entries) {
      if (e.kind === 'link-href') continue;
      if (new RegExp('(?<![\\p{L}])' + where.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'u').test(e.text)) {
        console.log(`  ${url} [${e.kind}] ${JSON.stringify(e.text.trim().slice(0, 220))}`);
        console.log(`      ${e.path}`);
      }
    }
  }
  process.exit(0);
}

const bucket = wantCodes ? codes : prose;
let list = [...bucket.entries()];
if (siteOnly) list = list.filter(([w]) => !OWNER.includes(w.toLowerCase()));
list.sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()));

console.log(`# ${wantCodes ? 'code' : 'prose'} tokens: ${list.length} unique${siteOnly ? ' (site-emitted only)' : ''}`);
for (const [w, rec] of list) {
  const owner = OWNER.includes(w.toLowerCase()) ? ' [also-in-owner-data]' : '';
  console.log(`${w}\t${rec.count}\t${rec.urls.size}url${owner}`);
}
