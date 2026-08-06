/**
 * Classify every translucent-white foreground in src/App.jsx by the brand
 * surface it sits on.
 *
 * These are the de-emphasised text colors — nav links, banner sub-lines,
 * dropdown captions. 4.23 fixed the SOLID whites; these are the same defect at
 * lower opacity, and the pale-yellow screenshot shows them going invisible.
 *
 * Surfaces that are NOT owner-controlled (the hero, whose gradient sits under
 * an rgba(20,20,20,0.72) scrim, and the footer's hardcoded #0a2240) must keep
 * their white and are reported separately.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');

const MARKERS = [
  { re: /style=\{\{\s*background:\s*\n?\s*"linear-gradient\(135deg, rgba\(20,20,20/g, surface: 'hero-scrim' },
  { re: /<footer style=\{\{ background: "#0a2240"/g, surface: 'footer-fixed' },
  { re: /background:\s*"linear-gradient\(135deg, var\(--brand-primary\) 0%, var\(--brand-accent-2\) 100%\)"/g, surface: 'header' },
  { re: /className="ipc-page-header"/g, surface: 'header' },
  { re: /background(?:Color)?:\s*"var\(--brand-dark\)"/g, surface: 'dark' },
  { re: /background(?:Color)?:\s*"var\(--brand-primary\)"/g, surface: 'primary' },
  { re: /background:\s*active\s*\?\s*"var\(--brand-primary\)"/g, surface: 'primary' },
];

const anchors = [];
for (const mk of MARKERS) {
  const re = new RegExp(mk.re.source, 'g');
  let m;
  while ((m = re.exec(src))) anchors.push({ at: m.index, surface: mk.surface });
}
anchors.sort((a, b) => a.at - b.at);

function surfaceBefore(i) {
  let best = null;
  for (const a of anchors) { if (a.at > i) break; best = a; }
  return best && i - best.at < 4000 ? best.surface : '(unclassified)';
}

const re = /color:\s*("?)rgba\(255,\s*255,\s*255,\s*([0-9.]+)\)\1/g;
const groups = {};
let m;
while ((m = re.exec(src))) {
  const line = src.slice(0, m.index).split('\n').length;
  const s = surfaceBefore(m.index);
  (groups[s] ||= []).push({ line, alpha: m[2] });
}

let total = 0;
for (const k of Object.keys(groups)) {
  console.log(`── ${k}  (${groups[k].length})`);
  console.log('   lines: ' + groups[k].map((g) => `${g.line}@${g.alpha}`).join(', '));
  total += groups[k].length;
  console.log('');
}
console.log(`total ${total}`);
