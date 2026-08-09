/**
 * 2026-08-09 audit — END-TO-END reproduction of the photo-clearing save.
 *
 * The live-shipped data/content.json predates PLAN-7 item 3a and has no
 * copy.siteImages key. content.php prefated fields with `?? ''` (line 956) and
 * saves every configured field back (`?? ''`, line 588), so the FIRST save of
 * Page Content — touching any field at all — materializes the five *Photo keys
 * as "". Because .*Photo is COPY_CLEARABLE, mergeContent treats "" as a
 * deliberate deletion: every marketing photograph, and the homepage band
 * SECTION, silently disappear under a green "Saved".
 *
 * Steps: restore pristine -> measure homepage (photos painted) -> sign in,
 * edit ONE heading, Save -> re-measure homepage -> restore pristine.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const CONTENT = path.join(__dirname, 'site', 'data', 'content.json');
const PRISTINE = path.join(__dirname, 'pristine', 'content.json');
const OUT = path.join(__dirname, 'out', 'aud9');

async function homeState(browser, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?_=' + Date.now(), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
  });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({
    siteImgs: [...document.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((s) => /images\/site\//.test(s || '')),
    bandSection: !!document.querySelector('figure img[src*="staff"], figure img[src*="IPC-Building"]'),
  }));
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(400);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `clearrepro-${tag}.png`) });
  await ctx.close();
  return r;
}

(async () => {
  // Step 0 — restore the mirror's content.json from pristine (pre-3a state,
  // same as the file that ships on first deploy: no copy.siteImages key).
  fs.copyFileSync(PRISTINE, CONTENT);
  const hasKey = () => {
    const j = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
    return j.copy && j.copy.siteImages ? JSON.stringify(j.copy.siteImages) : '(absent)';
  };
  console.log('before: siteImages in content.json =', hasKey());

  const browser = await launch();
  const before = await homeState(browser, 'before');
  console.log('before: homepage paints', JSON.stringify(before));

  // Rick's journey: sign in, retype one heading, Save.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
  }
  await page.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  const photoFields = await page.evaluate(() =>
    [...document.querySelectorAll('input[name^="copy[siteImages]"]')].map((i) => ({ name: i.name, value: i.value })));
  console.log('admin shows the five photo fields as:', JSON.stringify(photoFields));
  const SEL = 'input[name="copy\\[hero\\]\\[headlineLine1\\]"]';
  const orig = await page.inputValue(SEL);
  await page.fill(SEL, orig + ' ');   // the smallest realistic edit: a stray space
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]:has-text("Save")')]);
  const banner = await page.locator('.alert-success').textContent().catch(() => null);
  console.log('save banner:', JSON.stringify(banner && banner.trim()));
  await ctx.close();

  console.log('after: siteImages in content.json =', hasKey());
  const after = await homeState(browser, 'after');
  console.log('after: homepage paints', JSON.stringify(after));

  console.log(`VERDICT: photos before=${before.siteImgs.length} after=${after.siteImgs.length}; band before=${before.bandSection} after=${after.bandSection}`);
  await browser.close();

  // leave the mirror in the pristine state it started this script in
  fs.copyFileSync(PRISTINE, CONTENT);
  console.log('mirror content.json restored from pristine; screenshots in _harness/out/aud9/clearrepro-*.png');
})();
