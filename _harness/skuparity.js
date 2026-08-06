/**
 * The PHP and JS product-reference resolvers must agree.
 *
 * admin/config.php's product_reference_resolves() mirrors src/App.jsx's
 * three-tier lookup (exact -> normalizeSku -> skuSegmentMatch). A comment
 * saying "these must agree" is not enforcement; this is. If the React matcher
 * gains a tier and the PHP one does not, 4.12 starts warning about links that
 * work — which is the failure mode the exact-match version already had.
 *
 * Usage: node _harness/skuparity.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ── the JS side, read out of src/App.jsx rather than copied ────────────────
// Copying would let the two drift silently, which is the very thing under test.
const appJsx = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');
function extract(name) {
  const start = appJsx.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (start < 0) throw new Error(`${name}() not found in src/App.jsx`);
  const open = appJsx.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < appJsx.length; i++) {
    if (appJsx[i] === '{') depth++;
    else if (appJsx[i] === '}') { depth--; if (depth === 0) return appJsx.slice(start, i + 1); }
  }
  throw new Error(`${name}() unbalanced`);
}
// eslint-disable-next-line no-eval
const { normalizeSku, skuSegmentMatch } = eval(
  `(() => { ${extract('normalizeSku')} ${extract('skuSegmentMatch')} return { normalizeSku, skuSegmentMatch }; })()`
);

const productsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine/products-all.json'), 'utf8'));
const products = productsRaw.products || productsRaw;

/** src/App.jsx:6181-6188. */
function jsResolves(needle) {
  if (String(needle).trim() === '') return false;
  return Boolean(
    products.find((p) => p.id === needle || p.sku === needle) ||
    products.find((p) => normalizeSku(p.sku) === normalizeSku(needle)) ||
    products.find((p) => skuSegmentMatch(p.sku, needle) || skuSegmentMatch(p.id, needle))
  );
}

// ── the needles ─────────────────────────────────────────────────────────────
const content = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine/content.json'), 'utf8'));
const fromData = [];
for (const row of content.industryDetail || []) {
  for (const p of row.products || []) if (p.sku) fromData.push(String(p.sku));
}

const synthetic = [
  'CC', 'cc', ' CC ', 'IP33PO', 'ip33po',
  'IP44A2 & IP45A3', 'IP44A2-IP45A3', 'IP44A2/IP45A3', 'IP44A2',
  'IP71NS - IP72PS - IP73PP', 'IP72PS',
  'IP41NE / IP43VT', 'IP43VT',
  'ZZBOGUS999', 'TOTALLYBOGUSXYZ', '', '   ', 'IP', '999',
];
const needles = [...new Set([...fromData, ...synthetic])];

// ── the PHP side ────────────────────────────────────────────────────────────
const php = spawnSync('php', [path.join(__dirname, 'skuparity.php'), ...needles], { encoding: 'utf8' });
if (php.status !== 0) {
  console.error('skuparity: PHP side failed\n' + (php.stderr || ''));
  process.exit(2);
}
const phpVerdicts = php.stdout.trim().split('\n').map((l) => l.trim() === '1');

if (phpVerdicts.length !== needles.length) {
  console.error(`skuparity: PHP returned ${phpVerdicts.length} verdicts for ${needles.length} needles`);
  process.exit(2);
}

let bad = 0;
for (let i = 0; i < needles.length; i++) {
  const jsV = jsResolves(needles[i]);
  const phpV = phpVerdicts[i];
  if (jsV !== phpV) {
    bad++;
    console.log(`FAIL ${JSON.stringify(needles[i]).padEnd(30)} js=${jsV} php=${phpV}`);
  }
}

// A parity suite where both sides answer the same way to everything proves
// nothing about the tiers. Assert the needles actually exercise both verdicts.
const trues = needles.filter(jsResolves).length;
const falses = needles.length - trues;
if (trues === 0 || falses === 0) {
  console.log(`FAIL the needle set is degenerate (${trues} resolve, ${falses} do not)`);
  bad++;
} else {
  console.log(`ok   needle set is non-degenerate: ${trues} resolve, ${falses} do not`);
}

console.log(`\nskuparity ${needles.length + 1 - bad}/${needles.length + 1} (${needles.length} needles)`);
process.exit(bad === 0 ? 0 : 1);
