/**
 * Every certification revision this site claims, and where the owner edits it.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `src/App.jsx`'s A2 comment settled the hardcoded defaults and said the rest
 * out loud:
 *
 *     The 2008 revision was withdrawn in September 2018 and the site claimed it
 *     in three places; site-info.json says only "ISO 9001", so the version was
 *     typed into the copy by hand. Writing ":2015" because it is the current
 *     standard would invent a certification claim for a supplier to aerospace,
 *     medical and automotive. The live strings are owner-editable in Page
 *     Content and are on the owner action list pending confirmation from the
 *     registrar.
 *
 * That reasoning is right and this file does not second-guess it: **nothing
 * here rewrites a claim.** What it does is stop the claim being invisible.
 *
 * Two things about the sentence above were incomplete, which is what this
 * check is really for:
 *
 *   1. "in three places" — `data/content.json` carries three `ISO 9001:2008`
 *      strings, and `data/products-all.json` carries three `ISO9001:2000`
 *      strings on the VALUE-ADDED product. **2000 was superseded in 2008.**
 *      No audit before round 8 named those three at all.
 *   2. "owner-editable in Page Content" — the content.json three are. The
 *      products-all.json three are **not**: they are a spec-table row and a
 *      specifications summary, edited under Products → Edit → VALUE-ADDED. An
 *      owner following the action list to the letter fixes Page Content and
 *      ships a live product page still claiming a standard withdrawn in 2008.
 *
 * ── What it asserts ─────────────────────────────────────────────────────────
 *
 * FAIL for any *withdrawn* revision found in the live data. Bare "ISO 9001"
 * with no revision is fine and is what `site-info.json` already says — it is
 * the honest form and the one the owner can change from Business Details.
 *
 * This is a check with a real pass state: it goes green the moment the owner
 * either drops the revisions or confirms the current one with the registrar.
 * Until then it is red on purpose, the same way `brandtext` is red on purpose,
 * and `WHATS_LEFT.md` records it as such.
 *
 * Needs no server.
 *
 * Usage: node _harness/isoclaims.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/**
 * Revisions of ISO 9001 and the date each stopped being current.
 * A claim to a withdrawn revision on a spec-grade supplier's public site is a
 * commercial exposure, not a typo: buyers in aerospace, medical and automotive
 * supply chains check them.
 */
const WITHDRAWN = {
  '2000': 'superseded by ISO 9001:2008 in November 2008',
  '2008': 'withdrawn September 2018, after the ISO 9001:2015 transition closed',
};
const CURRENT = '2015';

/** Where a string in each file is edited, so the report is actionable. */
const EDIT_SCREEN = {
  'data/content.json': 'Admin → Page Content',
  'data/site-info.json': 'Admin → Business Details',
  'data/products-all.json': 'Admin → Products → Edit (that product)',
};

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** Walk any JSON value, yielding [dottedPath, string] for every string leaf. */
function* strings(node, trail = []) {
  if (typeof node === 'string') {
    yield [trail.join('.'), node];
  } else if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* strings(node[i], [...trail, i]);
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) yield* strings(node[k], [...trail, k]);
  }
}

const FILES = ['data/content.json', 'data/site-info.json', 'data/products-all.json'];
// "ISO 9001:2008", "ISO9001:2000", "ISO 9001 : 2015" — and bare "ISO 9001".
const CLAIM = /ISO\s*-?\s*9001\s*[:\s]?\s*(\d{4})?/gi;

const found = [];   // { file, path, revision|null, text }

for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    note(false, `${rel} parses`, String(e.message));
    continue;
  }
  for (const [p, s] of strings(data)) {
    CLAIM.lastIndex = 0;
    let m;
    while ((m = CLAIM.exec(s)) !== null) {
      found.push({
        file: rel,
        path: p,
        revision: m[1] || null,
        text: s.length > 120 ? s.slice(0, 117) + '…' : s,
      });
    }
  }
}

console.log(`\nISO 9001 claims in the live data: ${found.length}\n`);
const byRev = {};
for (const f of found) {
  const k = f.revision || '(no revision — the honest form)';
  (byRev[k] = byRev[k] || []).push(f);
}
for (const k of Object.keys(byRev).sort()) {
  console.log(`  ${String(k).padEnd(34)} ${byRev[k].length}`);
}
console.log('');

// ── The assertion ──────────────────────────────────────────────────────────
for (const rev of Object.keys(WITHDRAWN)) {
  const hits = found.filter((f) => f.revision === rev);
  note(
    hits.length === 0,
    `no claim to the withdrawn ISO 9001:${rev} revision`,
    hits.length
      ? `${hits.length} found — ${WITHDRAWN[rev]}.\n` +
        hits
          .map(
            (h) =>
              `         ${h.file}  ${h.path}\n` +
              `           edit at: ${EDIT_SCREEN[h.file] || '(unknown screen)'}\n` +
              `           text:    ${JSON.stringify(h.text)}`
          )
          .join('\n')
      : ''
  );
}

// A revision that is neither withdrawn nor the current one is a typo, and
// worth telling apart from the two cases above.
const unknown = found.filter(
  (f) => f.revision && !WITHDRAWN[f.revision] && f.revision !== CURRENT
);
note(
  unknown.length === 0,
  'no claim to an ISO 9001 revision that has never existed',
  unknown.length ? unknown.map((h) => `${h.file} ${h.path} → ${h.revision}`).join('; ') : ''
);

// The owner-editable field must stay the honest, unversioned form. If someone
// ever types a revision into Business Details it becomes the one claim that
// propagates everywhere through localizeProse/SITE_DEFAULTS, so it is worth
// its own assertion rather than being folded into the sweep above.
const siteInfoVersioned = found.filter(
  (f) => f.file === 'data/site-info.json' && f.revision
);
note(
  siteInfoVersioned.length === 0,
  'site-info.json still claims a bare "ISO 9001" with no revision',
  siteInfoVersioned.length
    ? `Business Details now carries a revision: ${siteInfoVersioned
        .map((h) => h.revision)
        .join(', ')} — that value reaches every page, so it must be one the registrar has confirmed`
    : ''
);

const pass = results.filter((r) => r.ok).length;
if (pass !== results.length) {
  console.log(
    '\nNOTE: this check does not rewrite a claim, deliberately. Writing a\n' +
      'revision the registrar has not confirmed would invent a certification\n' +
      'for a supplier to aerospace, medical and automotive. Resolving it is an\n' +
      'owner action — see audit-runs/audit8.md.'
  );
}
console.log(`\nisoclaims ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
