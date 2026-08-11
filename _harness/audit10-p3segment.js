/**
 * AUDIT-10 pass-3 — segmented capture of the two very tall admin pages.
 *
 * content.php is 42,632 px tall at desktop-1440 and help.php is 19,442 px. A
 * single full-page PNG of either downsamples to the point where a reviewer
 * cannot tell a misaligned label from an aligned one, so pass-3 reviews those
 * two pages in viewport-width x SEG_H slices as well as whole.
 *
 * Output: out/audit10/current/<viewport>/segments/<stem>__segNN.png
 *
 * Usage: node _harness/audit10-p3segment.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const SHOTS = path.join(__dirname, 'out', 'audit10', 'current');
const SEG_H = 2400;

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const TALL = [
  ['/admin/content.php', 'admin_content.php'],
  ['/admin/help.php', 'admin_help.php'],
];

(async () => {
  const browser = await launch();
  const manifest = [];

  for (const vp of VIEWPORTS) {
    const dir = path.join(SHOTS, vp.name, 'segments');
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
    if (await page.$('input[type="password"]')) {
      await page.fill('input[type="password"]', PASS);
      await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
    }

    for (const [url, stem] of TALL) {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(400);
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      const n = Math.ceil(h / SEG_H);
      for (let i = 0; i < n; i++) {
        const y = i * SEG_H;
        const clipH = Math.min(SEG_H, h - y);
        const file = path.join(dir, `${stem}__seg${String(i + 1).padStart(2, '0')}.png`);
        await page.screenshot({
          path: file,
          clip: { x: 0, y, width: vp.width, height: clipH },
          fullPage: true,
        });
        manifest.push({ viewport: vp.name, url, segment: i + 1, yFrom: y, yTo: y + clipH, file });
      }
      console.log(`${vp.name} ${url}: ${h}px -> ${n} segments`);
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(
    path.join(__dirname, 'out', 'audit10', 'p3segments.json'),
    JSON.stringify(manifest, null, 1)
  );
  console.log(`\n${manifest.length} segments written`);
})();
