/**
 * brand-ink-translucent — convert every hardcoded white foreground on an
 * owner-controlled brand surface to the matching ink variable.
 *
 *   rgba(255,255,255,α)  ->  rgba(var(--brand-<surface>-ink-rgb), α)
 *   "#ffffff" / "#fff"   ->  var(--brand-<surface>-ink)
 *
 * Surface is resolved by scanning BACKWARDS for the nearest brand-background
 * declaration. That is a heuristic and it will get some sites wrong — which is
 * why `_harness/inkaudit.js` exists: it renders every route under a navy and a
 * pale palette and reports any element that passes on one and fails on the
 * other, so a mis-classification shows up as a measured contrast failure
 * rather than as a silent regression. Patch, audit, correct, repeat.
 *
 * NEVER TOUCHED — these are not owner-controlled and must stay white:
 *   - the hero, whose brand gradient sits under an rgba(20,20,20,0.72) scrim
 *   - the footer, whose background is a hardcoded #0a2240
 *
 * Usage: node _harness/inkpatch3.js [--write]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/App.jsx');
const src = fs.readFileSync(FILE, 'utf8');

// Ordered anchors. The LAST one before a given offset wins.
const MARKERS = [
  { re: /background:\s*\n?\s*"linear-gradient\(135deg, rgba\(20,20,20/g, surface: 'HERO' },
  { re: /<footer style=\{\{ background: "#0a2240"/g, surface: 'FOOTER' },
  { re: /background:\s*"linear-gradient\(135deg, var\(--brand-primary\) 0%, var\(--brand-accent-2\) 100%\)"/g, surface: 'header' },
  { re: /className="ipc-page-header"/g, surface: 'header' },
  { re: /background(?:Color)?:\s*"var\(--brand-dark\)"/g, surface: 'dark' },
  { re: /background:\s*"var\(--brand-dark\)"/g, surface: 'dark' },
  { re: /background(?:Color)?:\s*"var\(--brand-primary\)"/g, surface: 'primary' },
  { re: /background:\s*active\s*\?\s*"var\(--brand-primary\)"/g, surface: 'primary' },
  { re: /background:\s*!mobileFamily\s*\?\s*"var\(--brand-primary\)"/g, surface: 'primary' },
];

const anchors = [];
for (const mk of MARKERS) {
  const re = new RegExp(mk.re.source, 'g');
  let m;
  while ((m = re.exec(src))) anchors.push({ at: m.index, surface: mk.surface });
}
anchors.sort((a, b) => a.at - b.at);

// The Navbar's <header> carries background: "var(--brand-dark)" at its top and
// the whole component — links, both mega-menus, the mobile drawer — sits on it.
// It is far longer than any reasonable proximity window, so it gets an explicit
// span rather than relying on the nearest anchor.
const navbarStart = src.indexOf('background: "var(--brand-dark)"');
const navbarEnd = src.indexOf('function Footer', navbarStart > 0 ? navbarStart : 0);

function surfaceAt(i) {
  if (navbarStart > 0 && i > navbarStart && i < navbarEnd) {
    // Inside the Navbar, but a nested element may set its own brand background
    // (the CTA button is --brand-primary). Respect a nearer anchor.
    let best = null;
    for (const a of anchors) { if (a.at > i) break; best = a; }
    if (best && best.at > navbarStart && i - best.at < 1200) return best.surface;
    return 'dark';
  }
  let best = null;
  for (const a of anchors) { if (a.at > i) break; best = a; }
  if (!best) return null;
  if (i - best.at > 3500) return null;
  return best.surface;
}

const INK = {
  primary: { solid: 'var(--brand-primary-ink)', rgb: 'var(--brand-primary-ink-rgb)' },
  dark: { solid: 'var(--brand-dark-ink)', rgb: 'var(--brand-dark-ink-rgb)' },
  header: { solid: 'var(--brand-header-ink)', rgb: 'var(--brand-header-ink-rgb)' },
};

// color: "rgba(255,255,255,0.6)"  |  color: "#ffffff"  |  ternaries containing them
const TARGET = /"rgba\(255,\s*255,\s*255,\s*([0-9.]+)\)"|"#(?:fff|ffffff)"/gi;

const edits = [];
let m;
while ((m = TARGET.exec(src))) {
  // Only rewrite values that are a `color:` (or the ternary feeding one).
  // Look back a little for the property name.
  const back = src.slice(Math.max(0, m.index - 220), m.index);
  const isColor = /color:\s*(?:[^;{}]*\?\s*)?[^;{}]*$/.test(back) && !/background/.test(back.split(/[,{]/).pop() || '');
  if (!isColor) continue;

  const surface = surfaceAt(m.index);
  if (!surface || surface === 'HERO' || surface === 'FOOTER') continue;

  const alpha = m[1];
  const replacement = alpha !== undefined
    ? `"rgba(${INK[surface].rgb}, ${alpha})"`
    : `"${INK[surface].solid}"`;

  edits.push({ start: m.index, end: m.index + m[0].length, from: m[0], to: replacement, surface });
}

let out = '';
let cursor = 0;
const counts = {};
for (const e of edits) {
  const line = src.slice(0, e.start).split('\n').length;
  counts[e.surface] = (counts[e.surface] || 0) + 1;
  console.log(`  App.jsx:${String(line).padEnd(6)} ${e.surface.padEnd(8)} ${e.from.padEnd(30)} -> ${e.to}`);
  out += src.slice(cursor, e.start) + e.to;
  cursor = e.end;
}
out += src.slice(cursor);

console.log(`\n${edits.length} replacements: ` + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));

if (process.argv.includes('--write')) {
  fs.writeFileSync(FILE, out);
  console.log('written to src/App.jsx');
} else {
  console.log('dry run — pass --write to apply');
}
