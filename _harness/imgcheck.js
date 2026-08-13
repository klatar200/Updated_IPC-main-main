/**
 * Every photoUrl and pdfUrl in data/products-all.json points at a file that
 * really exists — with byte-exact case.
 *
 * Why this suite exists
 * ---------------------
 * A missing asset does not 404 on this site. `public/.htaccess`'s catch-all
 * rewrite only skips rewriting when the request matches an existing file
 * (`!-f`), and Vite's dev server behaves the same way, so a wrong path is
 * answered with index.html and a **200**. The browser gets HTML where it
 * expected a JPEG, fails to decode it, and draws alt text next to a broken-image
 * icon. Nothing in the network stack, no server log and no `res.ok` check can
 * tell that apart from a served image — which is exactly how a bad path reaches
 * production and stays there.
 *
 * Case is the specific hazard. Network Solutions is Linux/Apache and
 * case-sensitive, so `/images/products/ip12ga.jpg` and `.../IP12GA.jpg` are two
 * different files there. The catalog mixes both conventions on purpose —
 * `ip52ec.png` is genuinely lowercase on disk while `IP53MP.png` beside it is
 * genuinely uppercase — so there is no rule to normalise towards and no way to
 * spot a mismatch by reading the JSON. Each path has to be checked against the
 * real filename.
 *
 * Why NOT fs.existsSync
 * ---------------------
 * `fs.existsSync` (and `statSync`, and `open`) delegate to the filesystem, and
 * on Windows and on a default macOS volume that is case-INSENSITIVE. A path
 * whose case is wrong passes there and fails on the Linux server — the suite
 * would go green on the developer's machine for precisely the defect it was
 * written to catch, which is worse than not having it. So every segment is
 * matched against a `readdirSync` listing instead: the listing carries the real
 * bytes of each name, and the comparison is a plain string `===` in JS, where
 * case always matters regardless of the host.
 *
 * Reads `data/` and not `_harness/pristine/`: this checks the catalog the site
 * actually ships, and pristine is a frozen reference seeded once (see sync.sh).
 *
 * Usage:  node _harness/imgcheck.js        (exit 0 = clean, 1 = broken paths)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Cache one readdir per directory. 42 products share a handful of folders.
const listings = new Map();
function listDir(dir) {
  if (!listings.has(dir)) {
    let names = null;
    try {
      names = fs.readdirSync(dir);
    } catch {
      names = null; // directory itself is missing
    }
    listings.set(dir, names);
  }
  return listings.get(dir);
}

/**
 * Walk `relPath` one segment at a time under `rootDir`, requiring each segment
 * to appear in its parent's directory listing with byte-exact case.
 *
 * Returns { ok: true } or { ok: false, failedAt, actual } — `actual` being the
 * case-insensitive near-miss when there is one, which turns "file not found"
 * into "you wrote ip12ga.jpg, the file is IP12GA.jpg".
 */
function resolveExact(rootDir, relPath) {
  const segments = relPath.split('/').filter(Boolean);
  let dir = rootDir;
  for (let i = 0; i < segments.length; i++) {
    const want = segments[i];
    const names = listDir(dir);
    if (names === null) {
      return { ok: false, failedAt: segments.slice(0, i).join('/') || '.', actual: null };
    }
    if (!names.includes(want)) {
      const near = names.find((n) => n.toLowerCase() === want.toLowerCase());
      return { ok: false, failedAt: segments.slice(0, i + 1).join('/'), actual: near || null };
    }
    dir = path.join(dir, want);
  }
  return { ok: true };
}

const productsRaw = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'products-all.json'), 'utf8'),
);
const products = productsRaw.products || productsRaw;

/**
 * Which on-disk tree serves a given URL prefix.
 *
 * `/images/...` is served out of `public/`, which Vite's publicDir copies into
 * dist/ verbatim — so `public/images/products/x.jpg` is what the browser asks
 * for as `/images/products/x.jpg`. `/pdfs/...` is a top-level folder deployed
 * as-is. Anything else (the five placehold.co URLs) is external and skipped:
 * the app refuses to render those anyway.
 */
const MOUNTS = [
  { prefix: '/images/', root: path.join(ROOT, 'public'), label: 'public' },
  { prefix: '/pdfs/', root: ROOT, label: 'repo root' },
];

let checked = 0;
let skipped = 0;
const failures = [];

for (const p of products) {
  const sku = String(p.sku || p.id || '?');
  for (const field of ['photoUrl', 'pdfUrl']) {
    const raw = p[field];
    if (!raw || typeof raw !== 'string') continue;

    // Strip a query string or fragment; neither is part of the filename.
    const url = raw.split(/[?#]/)[0];
    const mount = MOUNTS.find((m) => url.startsWith(m.prefix));
    if (!mount) {
      skipped++;
      continue;
    }

    // %20 and friends are real characters in the filename, not separators.
    let rel;
    try {
      rel = decodeURIComponent(url);
    } catch {
      rel = url;
    }

    checked++;
    const res = resolveExact(mount.root, rel);
    if (!res.ok) {
      failures.push({ sku, field, url: raw, mount: mount.label, ...res });
    }
  }
}

console.log(`products:          ${products.length}`);
console.log(`local asset paths: ${checked}`);
console.log(`external/skipped:  ${skipped}`);
console.log(`broken:            ${failures.length}\n`);

for (const f of failures) {
  console.log(`  ${f.sku.padEnd(18)} ${f.field.padEnd(9)} ${f.url}`);
  console.log(`  ${''.padEnd(18)} ${''.padEnd(9)} not found under ${f.mount}/ at "${f.failedAt}"`);
  if (f.actual) {
    console.log(
      `  ${''.padEnd(18)} ${''.padEnd(9)} CASE MISMATCH — the file on disk is "${f.actual}"`,
    );
  }
  console.log('');
}

if (failures.length) {
  console.log('FAIL: fix the path in data/products-all.json, or rename the file to match.');
  console.log('      Note the site returns 200 + index.html for these, so a browser');
  console.log('      check that only looks at status codes will not show it.');
  process.exit(1);
}

console.log('PASS: every local asset path resolves with byte-exact case.');
