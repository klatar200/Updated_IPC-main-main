/**
 * 4.23 audit: which hardcoded white foregrounds are LEFT in src/App.jsx, and
 * what brand surface is each one sitting on?
 *
 * Unlike the first pass, this resolves the surface by scanning BACKWARDS for
 * the nearest enclosing element that sets a brand background — the page
 * headers, the navbar and the homepage CTA band all put the background on a
 * parent, so an object-local check reports them as "not on brand" and the fix
 * silently misses them.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');
const WHITE = /color:\s*"#(?:fff|ffffff)"/i;

// Nearest preceding brand-background declaration, within a bounded window.
const MARKERS = [
  { re: /rgba\(20,\s*20,\s*20/g, surface: 'hero-scrim (white is correct)' },
  { re: /background:\s*"linear-gradient\(135deg, var\(--brand-primary\) 0%, var\(--brand-accent-2\) 100%\)"/g, surface: 'gradient primary->accent-2' },
  { re: /className="ipc-page-header"/g, surface: 'gradient primary->accent-2' },
  { re: /background(?:Color)?:\s*"var\(--brand-dark\)"/g, surface: 'solid --brand-dark' },
  { re: /background(?:Color)?:\s*"var\(--brand-primary\)"/g, surface: 'solid --brand-primary' },
];

const anchors = [];
for (const mk of MARKERS) {
  let m;
  const re = new RegExp(mk.re.source, 'g');
  while ((m = re.exec(src))) anchors.push({ at: m.index, surface: mk.surface });
}
anchors.sort((a, b) => a.at - b.at);

function surfaceBefore(i) {
  let best = null;
  for (const a of anchors) {
    if (a.at > i) break;
    best = a;
  }
  // Only trust an anchor that is plausibly the same JSX block.
  if (best && i - best.at < 3000) return best.surface;
  return '(no brand background nearby)';
}

const hits = [];
const re = /style=\{\{/g;
let m;
while ((m = re.exec(src))) {
  let depth = 0, end = -1;
  for (let i = m.index + 'style={'.length; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) continue;
  const body = src.slice(m.index, end + 1);
  if (!WHITE.test(body)) continue;
  hits.push({
    line: src.slice(0, m.index).split('\n').length,
    surface: surfaceBefore(m.index),
    snippet: body.replace(/\s+/g, ' ').slice(0, 110),
  });
}

console.log(`hardcoded white foregrounds remaining: ${hits.length}\n`);
const bySurface = {};
for (const h of hits) (bySurface[h.surface] ||= []).push(h);
for (const s of Object.keys(bySurface)) {
  console.log(`── ${s}  (${bySurface[s].length})`);
  for (const h of bySurface[s]) console.log(`   App.jsx:${String(h.line).padEnd(6)} ${h.snippet}`);
  console.log('');
}
