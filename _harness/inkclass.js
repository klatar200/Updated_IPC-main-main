/**
 * Swap `text-white` for the correct ink utility class at each site, using the
 * surface MEASURED by _harness/whitesurfaces.js rather than inferred.
 *
 *   header   $50-minimum banner, product-detail H2, the five industry H2s,
 *            the "View Product" hint, the services lead-time strip
 *   dark     sidebar "N products", PPAP strip, "Need something not listed?",
 *            "Ready to place an order", "FOR FASTEST RESPONSE"
 *   primary  the two Submit buttons (their background is declared AFTER the
 *            className in the same element, which is exactly what the source
 *            scan got wrong)
 *
 * LEFT ALONE:
 *   3296  "Still have questions?" — sits on a hardcoded #141414, measured as
 *         NOT A BRAND SURFACE, so white is correct and an ink would render
 *         #141414 on #141414
 *   8466  `hover:text-white` — a hover state on a transparent control
 *
 * Usage: node _harness/inkclass.js [--write]
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/App.jsx');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');

const MAP = [
  { line: 2341, ink: 'ipc-ink-header', what: '"$50 minimum order" banner' },
  { line: 2889, ink: 'ipc-ink-dark', what: '"FOR FASTEST RESPONSE, INCLUDE:"' },
  { line: 3747, ink: 'ipc-ink-dark', what: '"Need something not listed?"' },
  { line: 4066, ink: 'ipc-ink-primary', what: 'Submit Quote Request button' },
  { line: 4214, ink: 'ipc-ink-primary', what: 'Send Message button' },
  { line: 5520, ink: 'ipc-ink-dark', what: 'sidebar "N products"' },
  { line: 5884, ink: 'ipc-ink-header', what: 'product-detail H2' },
  { line: 6785, ink: 'ipc-ink-header', what: '"View Product" hint' },
  { line: 7781, ink: 'ipc-ink-header', what: 'industry section H2' },
  { line: 7968, ink: 'ipc-ink-dark', what: '"PPAP & IMDS Documentation"' },
  { line: 8286, ink: 'ipc-ink-header', what: 'services lead-time strip' },
  { line: 8436, ink: 'ipc-ink-dark', what: '"Ready to place an order"' },
];

let changed = 0;
const problems = [];

for (const t of MAP) {
  const i = t.line - 1;
  if (!lines[i] || !/\btext-white\b/.test(lines[i])) {
    problems.push(`line ${t.line} (${t.what}) no longer contains text-white`);
    continue;
  }
  if (/hover:text-white/.test(lines[i]) && !/(^|\s)text-white/.test(lines[i].replace('hover:text-white', ''))) {
    problems.push(`line ${t.line} is a hover-only site — skipped`);
    continue;
  }
  lines[i] = lines[i].replace(/(^|[\s"])text-white\b/, `$1${t.ink}`);
  console.log(`  App.jsx:${String(t.line).padEnd(6)} ${t.ink.padEnd(16)} ${t.what}`);
  changed++;
}

if (problems.length) console.error('\n' + problems.join('\n'));
console.log(`\n${changed}/${MAP.length} swapped`);

if (process.argv.includes('--write')) {
  fs.writeFileSync(FILE, lines.join('\n'));
  console.log('written to src/App.jsx');
} else {
  console.log('dry run — pass --write to apply');
}
process.exit(problems.length ? 1 : 0);
