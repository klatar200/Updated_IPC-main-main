/**
 * Audit 9 — acceptance suite for the admin vocabulary, typography and case
 * findings, plus the admin half of the structure pass.
 *
 * Written BEFORE the fixes and watched failing against unfixed code
 * (GUARDRAILS §4.4); the "before" run is at
 * _harness/out/audit9/C/admin-text-BEFORE.txt.
 *
 *   b2-08  rule 2 — one name for the product, one spelling of "color", one of
 *          "catalog", one of folder/directory, one of "data sheet", and an
 *          hours fallback that matches the default it falls back FROM
 *   b2-09  rule 3 — one quote glyph and one ellipsis glyph per surface
 *   b2-10  rule 4 — the admin's button labels are Title Case, including the
 *          "+ Add …" family that had five sentence-case members on one screen
 *   p6-4   each top-level page's <h1> is the nav label you clicked
 *
 * Source-level on purpose: every instance is a literal in a PHP or JS file, so
 * reading the source is exact where a rendered census has to be sampled. The
 * rendered counterpart is _harness/out/audit9/P5b/admin-rendered-text.json,
 * which is what the finding was measured on.
 *
 * Usage: node _harness/audit9-admin-text.js       (no server needed)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'audit9', 'C');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const ADMIN_PHP = fs.readdirSync(path.join(ROOT, 'admin'))
  .filter((f) => f.endsWith('.php')).map((f) => 'admin/' + f);
const ADMIN_JS = fs.readdirSync(path.join(ROOT, 'admin'))
  .filter((f) => f.endsWith('.js')).map((f) => 'admin/' + f);

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};
// Every match of `re` across the admin, as "file:line: text".
const hits = (files, re) => {
  const out = [];
  for (const f of files) {
    read(f).split('\n').forEach((l, i) => {
      const m = l.match(re);
      if (m) out.push(`${f}:${i + 1}: ${m[0]}`);
    });
  }
  return out;
};

// ── p6-4 — <h1> equals the nav label ───────────────────────────────────────
// nav.php's nine top-level entries, in order, as href → label.
const navSrc = read('admin/nav.php');
const navPairs = [];
for (const m of navSrc.matchAll(/<a href="([a-z-]+\.php)"([\s\S]*?)<\/a>/g)) {
  // The class attribute is written by an inline `<?= … ?>`, so the tag cannot
  // be closed by matching `[^>]*>`. Drop every PHP block first, then everything
  // up to and including the first `>` that survives — that is the open tag.
  const label = m[2]
    .replace(/<\?php[\s\S]*?\?>/g, '')
    .replace(/<\?=[\s\S]*?\?>/g, '')
    .replace(/^[\s\S]*?>/, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  if (label) navPairs.push({ file: m[1], label });
}
const h1Of = (file) => {
  const m = read('admin/' + file).match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? m[1].replace(/<\?=[\s\S]*?\?>/g, '').replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : null;
};
// "+ Add Product" in the nav is "+ " plus the label; the leading affordance is
// not part of the name, so it is stripped on both sides before comparing.
const bare = (s) => String(s || '').replace(/^\+\s*/, '').trim().toLowerCase();
const h1Drift = [];
for (const { file, label } of navPairs) {
  const h1 = h1Of(file);
  if (h1 === null) continue;
  if (bare(h1) !== bare(label)) h1Drift.push(`${file}: nav "${label}" vs h1 "${h1}"`);
}
note(navPairs.length >= 9, `p6-4: nav.php parsed (${navPairs.length} top-level entries)`,
  JSON.stringify(navPairs.map((p) => p.label)));
note(h1Drift.length === 0,
  `p6-4: every top-level page's <h1> is the nav label you clicked`,
  h1Drift.join(' | '));

// ── b2-08 (a) — one name for the product ───────────────────────────────────
const subOf = (f) => {
  const m = read(f).match(/class="logo-sub">([^<]*)</);
  return m ? m[1].trim() : null;
};
note(subOf('admin/auth.php') === subOf('admin/nav.php'),
  'b2-08a: the signed-out and signed-in logo sub-lines are the same name',
  JSON.stringify({ auth: subOf('admin/auth.php'), nav: subOf('admin/nav.php') }));
const authTitle = (read('admin/auth.php').match(/<title>([^<]*)<\/title>/) || [])[1] || '';
note(/Sign In/.test(authTitle) && !/Login/.test(authTitle),
  'b2-08a: the sign-in screen\'s <title> says "Sign In", like its own heading and button',
  JSON.stringify(authTitle));
// "log in" about THIS product. FTP and file-manager logins are a different
// system and are correct as written, so they are excluded by name.
const logIn = hits(ADMIN_PHP, /(?<!FTP |file-manager )\blog in\b/i)
  .filter((h) => !/FTP|file-manager/.test(h));
note(logIn.length === 0, 'b2-08a: the admin says "sign in", not "log in"', logIn.join(' | '));

// ── b2-08 (b,c,e,f) — spelling and one word per concept ────────────────────
note(hits(ADMIN_PHP.concat(ADMIN_JS), /colour/i).length === 0,
  'b2-08b: no British "colour" left in the admin',
  hits(ADMIN_PHP.concat(ADMIN_JS), /colour/i).join(' | '));
note(hits(ADMIN_PHP.concat(ADMIN_JS), /catalogue/i).length === 0,
  'b2-08c: no British "catalogue" left in the admin',
  hits(ADMIN_PHP.concat(ADMIN_JS), /catalogue/i).join(' | '));
const up = read('admin/upload-pdf.php');
note(!(/\/pdfs\/ folder/.test(up) && /\/pdfs\/ directory/.test(up)),
  'b2-08e: upload-pdf.php calls /pdfs/ one thing, not both a folder and a directory',
  JSON.stringify({ folder: /\/pdfs\/ folder/.test(up), directory: /\/pdfs\/ directory/.test(up) }));
const sheetOutliers = hits(ADMIN_PHP.concat(ADMIN_JS), /\bdata-sheets?\b|\bspec sheets?\b/i);
note(sheetOutliers.length === 0,
  'b2-08f: no "data-sheet" or "spec sheet" outliers left',
  sheetOutliers.join(' | '));
// The admin quotes the public site's button by name. When that button is
// renamed the quote is a false statement, which is how it drifted before.
const publicLabel = (read('src/App.jsx').match(/\n\s*Request Datasheet\n/) ? 'Request Datasheet' : null);
// The stale names are the ones the product page used to render: the PDF button
// was "Download PDF" and its no-file counterpart "Request Data Sheet". The
// admin's OWN vocabulary for the concept is still "data sheet" (its measured
// majority, 35 of 38) — "Data Sheet" as a column heading or a card title is
// correct and is deliberately not matched here.
const staleQuotes = hits(ADMIN_PHP.concat(ADMIN_JS), /"Download PDF|Request Data Sheet|spec-sheet/);
note(!!publicLabel && staleQuotes.length === 0,
  'b2-08f: the admin quotes the public buttons under the names the site actually renders',
  JSON.stringify({ publicLabel, stale: staleQuotes }));

// ── b2-08 (g) — the hours fallback matches the default it replaces ─────────
const siteDefaultHours = (read('src/App.jsx').match(/hours: \{ text: "([^"]+)"/) || [])[1] || '';
const phpFallback = (read('public/contact.php').match(/\?\?\s*''\)\s*!==\s*''[\s\S]{0,120}?:\s*'([^']*Fri[^']*)'/) || [])[1] || '';
note(!!siteDefaultHours && phpFallback === siteDefaultHours,
  'b2-08g: contact.php\'s hours fallback is byte-identical to the site default it stands in for',
  JSON.stringify({ php: phpFallback, js: siteDefaultHours }));

// ── b2-09 — one quote glyph, one ellipsis glyph ───────────────────────────
const curly = hits(ADMIN_PHP.concat(ADMIN_JS), /[“”‘’]/);
note(curly.length === 0,
  'b2-09a: the admin uses one quote glyph — the straight one its largest page already uses',
  `${curly.length} left: ` + curly.slice(0, 4).join(' | '));
// "..." used as an ellipsis: in a placeholder, a label or prose. A literal
// "https://..." in a placeholder is the same control type as "Filter by SKU…".
const dots = hits(ADMIN_PHP.concat(ADMIN_JS), /[A-Za-z/][.]{3}(?![.])/);
note(dots.length === 0,
  'b2-09b: the admin uses one ellipsis glyph',
  `${dots.length} left: ` + dots.slice(0, 4).join(' | '));

// ── b2-10 — Title Case buttons ────────────────────────────────────────────
const MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from',
  'in', 'into', 'of', 'on', 'or', 'the', 'to', 'up', 'via', 'with']);
const isTitleCase = (s) => {
  const w = s.replace(/^[+\s]+/, '').split(/\s+/).filter(Boolean);
  return w.slice(1).every((x) => MINOR.has(x.toLowerCase()) || !/^[a-z]/.test(x));
};
// Every button label the admin declares, from the source rather than a render:
// <button>…</button> in PHP, and the JS builder's textContent / innerHTML.
const labels = new Set();
for (const f of ADMIN_PHP) {
  for (const m of read(f).matchAll(/<button[^>]*>([^<]{2,60})<\/button>/g)) {
    const t = m[1].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (t && /[A-Za-z]/.test(t) && !/<\?/.test(t)) labels.add(t);
  }
}
for (const f of ADMIN_JS) {
  const s = read(f);
  // Only textContent assigned to something named like a button — the builder
  // also writes an empty-state sentence ("No size chart for this product
  // yet.") that way, and a sentence is not a label.
  for (const m of s.matchAll(/\w*[Bb]tn\w*\.textContent = "([^"]{2,60})"/g)) labels.add(m[1].trim());
  for (const m of s.matchAll(/<button[^>]*>([^<'"]{2,60})<\/button>/g)) labels.add(m[1].trim());
}
// $COPY_GROUPS' addLabel values become "+ Add <label>" buttons at render time.
for (const m of read('admin/content.php').matchAll(/'addLabel'\s*=>\s*'([^']+)'/g)) {
  labels.add('+ Add ' + m[1]);
}
const sentence = [...labels].filter((b) => /\s/.test(b) && !isTitleCase(b));
note(labels.size >= 30, `b2-10: button census read ${labels.size} distinct labels`, '');
note(sentence.length === 0,
  'b2-10: every multi-word admin button label is Title Case',
  `${sentence.length} sentence-case: ` + JSON.stringify(sentence));

const pass = results.filter((x) => x.ok).length;
console.log(`\naudit9-admin-text ${pass}/${results.length}`);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'admin-text.json'), JSON.stringify(results, null, 2));
process.exit(pass === results.length ? 0 : 1);
