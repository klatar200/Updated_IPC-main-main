/**
 * What do the derived brand variables actually resolve to, per palette?
 *
 * The claim behind brand-color-as-foreground is that the adjustment is a NO-OP
 * for a palette that already passes, so the shipped site looks unchanged. That
 * claim has to be checked, not asserted — if a shipped color is itself below
 * the threshold, the variant WILL move it and the default design changes.
 *
 * Usage: node _harness/derived.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const BASE_SITE_INFO = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine/site-info.json'), 'utf8'));

const PALETTES = {
  'shipped navy': { primaryColor: '#005DA3', darkColor: '#0D2D52', accentColor: '#00BEF2', accent2Color: '#119EC8' },
  'pale yellow': { primaryColor: '#FFE600', darkColor: '#FFF3A0', accentColor: '#FFF7C0', accent2Color: '#FFF7C0' },
};

const VARS = [
  '--brand-primary', '--brand-primary-text',
  '--brand-accent-2', '--brand-accent-text', '--brand-accent-on-dark', '--brand-accent-on-footer',
  '--brand-accent', '--brand-accent1-on-dark',
  '--brand-primary-ink', '--brand-dark-ink', '--brand-header-ink',
];

(async () => {
  const browser = await launch();
  for (const [name, palette] of Object.entries(PALETTES)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const info = JSON.parse(JSON.stringify(BASE_SITE_INFO));
    info.theme = { ...(info.theme || {}), ...palette };
    await page.route('**/site-info.json*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(info) }));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);

    const vals = await page.evaluate((names) => {
      const cs = getComputedStyle(document.documentElement);
      const out = {};
      for (const n of names) out[n] = cs.getPropertyValue(n).trim();
      return out;
    }, VARS);

    console.log(`\n── ${name}`);
    const pairs = [
      ['--brand-primary', '--brand-primary-text'],
      ['--brand-accent-2', '--brand-accent-text'],
      ['--brand-accent-2', '--brand-accent-on-dark'],
      ['--brand-accent-2', '--brand-accent-on-footer'],
      ['--brand-accent', '--brand-accent1-on-dark'],
    ];
    for (const [src, derived] of pairs) {
      const a = vals[src], b = vals[derived];
      const same = a.toLowerCase() === b.toLowerCase();
      console.log(`   ${derived.padEnd(26)} ${b.padEnd(10)} ${same ? '= unchanged (no-op)' : `<- MOVED from ${a}`}`);
    }
    await ctx.close();
  }
  await browser.close();
})();
