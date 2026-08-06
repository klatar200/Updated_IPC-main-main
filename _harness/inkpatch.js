/**
 * 4.23 — replace the hardcoded white foreground with the right ink variable at
 * every brand-colored call site in src/App.jsx.
 *
 * Doing this by hand across ~30 inline style objects is how you miss three and
 * ship a half-fix. This walks brace-balanced `style={{ … }}` objects, decides
 * which brand surface each one sits on, and rewrites only the `color:` inside
 * those. It prints every change for review and refuses to touch anything it is
 * not sure about.
 *
 *   solid var(--brand-primary)          -> var(--brand-primary-ink)
 *   solid var(--brand-dark)             -> var(--brand-dark-ink)
 *   gradient primary -> accent-2        -> var(--brand-header-ink)
 *   inside .ipc-page-header             -> var(--brand-header-ink)
 *
 * DELIBERATELY NOT TOUCHED: the hero (its gradient sits under a
 * rgba(20,20,20,0.72) scrim, so white is correct at any brand color) and any
 * transparent/outline control.
 *
 * Usage: node _harness/inkpatch.js [--write]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/App.jsx');
let src = fs.readFileSync(FILE, 'utf8');

const WHITE = /color:\s*"#(?:fff|ffffff)"/i;
const HERO_SCRIM = /rgba\(20,\s*20,\s*20/;

function surfaceOf(body) {
  if (HERO_SCRIM.test(body)) return null;                       // hero: leave white
  if (/background:\s*"linear-gradient\([^"]*var\(--brand-primary\)[^"]*var\(--brand-accent-2\)/.test(body)) {
    return 'header';
  }
  if (/background(?:Color)?:\s*"var\(--brand-primary\)"/.test(body)) return 'primary';
  if (/background(?:Color)?:\s*"var\(--brand-dark\)"/.test(body)) return 'dark';
  // Conditional backgrounds like `isLast ? "var(--brand-primary)" : …`
  if (/background(?:Color)?:[^,}]*\?\s*"var\(--brand-primary\)"/.test(body)) return 'primary';
  return null;
}

const INK = {
  primary: 'var(--brand-primary-ink)',
  dark: 'var(--brand-dark-ink)',
  header: 'var(--brand-header-ink)',
};

// ── pass 1: style objects that carry their own brand background ─────────────
const edits = [];
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
  const surface = surfaceOf(body);
  if (!surface) continue;
  edits.push({ start: m.index, end: end + 1, body, surface });
}

// ── pass 2: bare `style={{ color: "#ffffff" }}` inside .ipc-page-header ─────
// The gradient is on the parent div, so these objects carry no background of
// their own. Anchor on the enclosing className="ipc-page-header" block.
const headerBlocks = [];
{
  const hre = /className="ipc-page-header"/g;
  let h;
  while ((h = hre.exec(src))) {
    // The header block is short; bound the search to the next 2500 chars, which
    // covers the eyebrow/title/intro group without spilling into the page body.
    headerBlocks.push([h.index, Math.min(src.length, h.index + 2500)]);
  }
}
const inHeader = (i) => headerBlocks.some(([a, b]) => i >= a && i <= b);

const re2 = /style=\{\{\s*color:\s*"#(?:fff|ffffff)"\s*\}\}/gi;
let m2;
while ((m2 = re2.exec(src))) {
  if (!inHeader(m2.index)) continue;
  if (edits.some((e) => m2.index >= e.start && m2.index < e.end)) continue;
  edits.push({
    start: m2.index,
    end: m2.index + m2[0].length,
    body: m2[0],
    surface: 'header',
  });
}

edits.sort((a, b) => a.start - b.start);

console.log(`${edits.length} brand-colored call sites with a hardcoded white foreground\n`);
let out = '';
let cursor = 0;
for (const e of edits) {
  const line = src.slice(0, e.start).split('\n').length;
  const replaced = e.body.replace(WHITE, `color: "${INK[e.surface]}"`);
  console.log(`  App.jsx:${String(line).padEnd(6)} ${e.surface.padEnd(8)} -> ${INK[e.surface]}`);
  out += src.slice(cursor, e.start) + replaced;
  cursor = e.end;
}
out += src.slice(cursor);

if (process.argv.includes('--write')) {
  fs.writeFileSync(FILE, out);
  console.log(`\nwrote ${edits.length} replacements to src/App.jsx`);
} else {
  console.log('\ndry run — pass --write to apply');
}
