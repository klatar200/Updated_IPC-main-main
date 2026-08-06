/**
 * 4.23 — the contrast math exists in THREE places and they must all agree:
 *
 *   admin/config.php        ipc_contrast_ratio / ipc_ink_for   (the admin's warning)
 *   admin/contrast-guard.js ratio / inkFor                     (the live readout)
 *   src/App.jsx             contrastRatio / inkFor             (what the site ships)
 *
 * If they drift, the admin promises a number the site does not deliver — the
 * owner is told "readable" and visitors get white-on-white. A comment saying
 * "these must agree" is not enforcement; this is.
 *
 * Usage: node _harness/contrastparity.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

/** Pull named function declarations out of a source file and evaluate them. */
function loadFns(relPath, names, extraPrelude = '') {
  const src = fs.readFileSync(path.join(root, relPath), 'utf8');
  const bodies = names.map((name) => {
    const start = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
    if (start < 0) throw new Error(`${name}() not found in ${relPath}`);
    const open = src.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error(`${name}() unbalanced in ${relPath}`);
  });
  // eslint-disable-next-line no-eval
  return eval(`(() => { ${extraPrelude} ${bodies.join('\n')} return { ${names.join(', ')} }; })()`);
}

// src/App.jsx — needs its INK_* constants in scope.
const app = loadFns(
  'src/App.jsx',
  ['parseHexColor', 'relativeLuminance', 'contrastRatio', 'inkFor'],
  'const INK_DARK = "#141414"; const INK_LIGHT = "#ffffff";'
);

// admin/contrast-guard.js — its helpers are named differently.
const guard = loadFns(
  'admin/contrast-guard.js',
  ['parseHex', 'luminance', 'ratio', 'worst', 'inkFor'],
  'var INK_DARK = "#141414"; var INK_LIGHT = "#ffffff";'
);

// A spread of colors: the shipped palette, the plan's pale example, pure
// extremes, mid-greys either side of the AA boundary, and 3-digit hex.
const COLORS = [
  '#005da3', '#0d2d52', '#00bef2', '#119ec8', '#141414', '#ffffff',
  '#FFE600', '#ffff00', '#fefefe', '#000000', '#777777', '#767676',
  '#808080', '#7f7f7f', '#e0e0e0', '#333333', '#abc', '#FFF',
  '#c0392b', '#2ecc71', '#8e44ad', '#f39c12', '#1abc9c',
];

const php = spawnSync('php', [path.join(__dirname, 'contrastparity.php'), ...COLORS], { encoding: 'utf8' });
if (php.status !== 0) {
  console.error('contrastparity: PHP side failed\n' + (php.stderr || ''));
  process.exit(2);
}
const phpRows = php.stdout.trim().split('\n').map((l) => {
  const [r, ink] = l.split('|');
  return { ratio: parseFloat(r), ink: ink.trim() };
});

let bad = 0;
const EPS = 1e-6;

for (let i = 0; i < COLORS.length; i++) {
  const c = COLORS[i];

  const appInk = app.inkFor(c);
  const appRatio = app.contrastRatio(appInk, c);

  const guardInk = guard.inkFor([c]);
  const guardRatio = guard.worst(guardInk, [c]);

  const p = phpRows[i];

  const inkAgree = appInk.toLowerCase() === guardInk.toLowerCase()
    && appInk.toLowerCase() === p.ink.toLowerCase();
  const ratioAgree = Math.abs(appRatio - guardRatio) < EPS && Math.abs(appRatio - p.ratio) < EPS;

  if (!inkAgree || !ratioAgree) {
    bad++;
    console.log(`FAIL ${c}`);
    console.log(`       App.jsx        ink=${appInk}  ratio=${appRatio.toFixed(6)}`);
    console.log(`       contrast-guard ink=${guardInk}  ratio=${guardRatio.toFixed(6)}`);
    console.log(`       config.php     ink=${p.ink}  ratio=${p.ratio.toFixed(6)}`);
  }
}

// Known-good anchors: if all three agreed on a WRONG value the loop above would
// still pass, so pin a few ratios to the WCAG reference numbers.
const ANCHORS = [
  { a: '#000000', b: '#ffffff', expect: 21 },
  { a: '#ffffff', b: '#ffffff', expect: 1 },
  { a: '#777777', b: '#ffffff', expect: 4.478 },   // just under AA
  { a: '#767676', b: '#ffffff', expect: 4.541 },   // the classic "just passes" grey
];
for (const an of ANCHORS) {
  const got = app.contrastRatio(an.a, an.b);
  const ok = Math.abs(got - an.expect) < 0.01;
  if (!ok) { bad++; console.log(`FAIL anchor ${an.a} on ${an.b}: expected ~${an.expect}, got ${got.toFixed(3)}`); }
  else console.log(`ok   anchor ${an.a} on ${an.b} = ${got.toFixed(3)}:1`);
}

// The color set must exercise BOTH ink choices, or parity is vacuous.
const darkInk = COLORS.filter((c) => app.inkFor(c) === '#141414').length;
const lightInk = COLORS.length - darkInk;
if (!darkInk || !lightInk) {
  console.log(`FAIL the color set is degenerate (${lightInk} white-ink, ${darkInk} dark-ink)`);
  bad++;
} else {
  console.log(`ok   color set exercises both inks: ${lightInk} white, ${darkInk} dark`);
}

const total = COLORS.length + ANCHORS.length + 1;
console.log(`\ncontrastparity ${total - bad}/${total} (${COLORS.length} colors × 3 implementations)`);
process.exit(bad === 0 ? 0 : 1);
