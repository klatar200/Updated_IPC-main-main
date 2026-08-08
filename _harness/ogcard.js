/**
 * PLAN-8 A4 — build public/images/og-card.jpg at 1200x630.
 *
 * One-shot generator, run by hand, output committed. It is not part of the
 * build: `sharp` is an `npm i --no-save` tool here (GUARDRAILS 2 — no new
 * dependency), the same way _harness/imgopt.js works, and a build step that
 * needs a package the repo does not depend on is a build that breaks on a
 * fresh clone.
 *
 * The card is drawn from what the brand already has — the navy, the accent
 * cyan, the wordmark and one line of the homepage proposition — rather than
 * inventing artwork. No photography exists to use (audit C37).
 *
 *   npm i --no-save sharp
 *   node _harness/ogcard.js
 */
const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp is not installed. Run:  npm i --no-save sharp');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'images', 'og-card.jpg');

const W = 1200;
const H = 630;
const NAVY = '#0a2240';
const NAVY_2 = '#0a2a52';
const ACCENT = '#00bef2';

// Escape the few characters that are not legal as XML text.
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const COMPANY = 'Insulation Products Corporation';
const LINE = 'Heat Shrink Tubing, Sleeving &amp; Adhesives';
const PROPS = ['Spec-grade stocking distributor since 1974', 'ISO 9001 registered', 'Ships same day'];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="${NAVY_2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- accent rule, echoing the site's header treatment -->
  <rect x="80" y="150" width="96" height="8" fill="${ACCENT}"/>

  <text x="80" y="128" font-family="Helvetica, Arial, sans-serif" font-size="26"
        font-weight="700" letter-spacing="6" fill="${ACCENT}">IPC</text>

  <text x="80" y="248" font-family="Helvetica, Arial, sans-serif" font-size="60"
        font-weight="800" fill="#ffffff">${x(COMPANY)}</text>

  <text x="80" y="318" font-family="Helvetica, Arial, sans-serif" font-size="36"
        font-weight="600" fill="#e2e8f0">${LINE}</text>

  ${PROPS.map(
    (p, i) => `<text x="80" y="${420 + i * 46}" font-family="Helvetica, Arial, sans-serif"
        font-size="26" fill="#b8c6d9">&#183; ${x(p)}</text>`
  ).join('\n  ')}

  <text x="80" y="580" font-family="Helvetica, Arial, sans-serif" font-size="24"
        font-weight="600" fill="${ACCENT}">insulationproducts.com</text>
</svg>`;

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // mozjpeg at q82: the file-weight discipline PLAN-5's 4.32 set is 300 KB, and
  // a flat-colour card lands far under it.
  await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toFile(OUT);
  const st = fs.statSync(OUT);
  const meta = await sharp(OUT).metadata();
  console.log(`wrote ${OUT}`);
  console.log(`  ${meta.width}x${meta.height}, ${st.size} bytes (${(st.size / 1024).toFixed(1)} KiB)`);
  if (meta.width !== W || meta.height !== H) { console.error('WRONG SIZE'); process.exit(1); }
  if (st.size > 300 * 1024) { console.error('OVER 300 KiB'); process.exit(1); }
})();
