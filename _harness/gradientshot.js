/**
 * What the two brand-gradient-mixed-ends strips look like under each candidate
 * treatment, at the shipped navy AND at a pale owner-chosen palette — the case
 * that breaks them.
 *
 * The gradients are inline styles, so the overrides use !important from a
 * stylesheet, which beats a non-important inline declaration.
 *
 * Usage: node _harness/gradientshot.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'gradient');
const INFO = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine/site-info.json'), 'utf8'));

const PALETTES = {
  navy:  { primaryColor: '#005DA3', darkColor: '#0D2D52', accentColor: '#00BEF2', accent2Color: '#119EC8' },
  pale:  { primaryColor: '#FFE600', darkColor: '#FFF3A0', accentColor: '#FFF7C0', accent2Color: '#FFF7C0' },
};

// The industry section header. Targeted by its gradient, which is unique.
const SEL = '[style*="linear-gradient(135deg, #003d7a"]';

const TREATMENTS = {
  // As shipped today: white text across a fixed-dark -> owner gradient.
  'a-current': '',
  // Option A — make the fixed end the owner's own dark, so one ink serves the
  // whole band and the auto-ink logic can actually reach it.
  'b-branddark': `${SEL}{background:linear-gradient(135deg,var(--brand-dark),var(--brand-primary))!important}
                  ${SEL} h2, ${SEL} p{color:var(--brand-dark-ink)!important}`,
  // Option B — stop putting text across a two-owner gradient at all.
  'c-solid': `${SEL}{background:var(--brand-dark)!important}
              ${SEL} h2, ${SEL} p{color:var(--brand-dark-ink)!important}`,
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [pname, palette] of Object.entries(PALETTES)) {
    for (const [tname, css] of Object.entries(TREATMENTS)) {
      const browser = await launch();
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
      const page = await ctx.newPage();
      const info = JSON.parse(JSON.stringify(INFO));
      info.theme = { ...(info.theme || {}), ...palette };
      await page.route('**/site-info.json*', (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(info) }));
      await page.goto(BASE + '/industries', { waitUntil: 'networkidle' });
      if (css) await page.addStyleTag({ content: css });

      await page.waitForTimeout(400);
      const el = await page.$(SEL);
      if (!el) { console.log('MISS', pname, tname); await browser.close(); continue; }
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await el.screenshot({ path: path.join(OUT, `${pname}-${tname}.png`) });
      await browser.close();
    }
  }
  console.log('gradient shots ->', OUT);
})();
