/**
 * 2026-08-09 audit probe — §7B: admin journeys as Rick would drive them.
 *
 *  J1  sign in, edit a hero heading, Save, verify the green banner AND the
 *      saved JSON, then put the original value back the same way.
 *  J2  two tabs: open Page Content twice, save tab A, then save tab B —
 *      the conflict page must appear and tab B's typed value must still be
 *      in the field (nothing typed is lost).
 *  J3  browser Back immediately after a successful save — must not show a
 *      resubmission error page or a second save.
 *  J4  upload a fake image (text bytes named .png) through upload-image.php —
 *      must be refused with a message, and no file may land in uploads/.
 *
 * Leaves the mirror's content.json byte-identical to how it started.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const SITE = path.join(__dirname, 'site');
const CONTENT = path.join(SITE, 'data', 'content.json');

const results = [];
const note = (ok, what, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       -> ' + detail}`);
};

async function signIn(page) {
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
  }
}

(async () => {
  const before = fs.readFileSync(CONTENT, 'utf8');
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  ctx.on('dialog', (d) => d.accept());
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await signIn(page);

  // ── J1: edit, save, verify, restore ────────────────────────────────────
  await page.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  const SEL = 'input[name="copy\\[hero\\]\\[headlineLine1\\]"]';
  const orig = await page.inputValue(SEL);
  const probeVal = 'AUDIT-PROBE ' + orig;
  await page.fill(SEL, probeVal);
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]:has-text("Save")')]);
  const savedBanner = await page.locator('.alert-success').count();
  const savedJson = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  note(savedBanner > 0 && savedJson.copy.hero.headlineLine1 === probeVal,
    'J1 save lands: green banner and the value reaches content.json',
    `banner=${savedBanner} json=${JSON.stringify(savedJson.copy && savedJson.copy.hero && savedJson.copy.hero.headlineLine1)}`);

  // ── J3: Back right after the save (PRG — should re-show ?saved=1 page, not a resubmit) ──
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  const backUrl = page.url();
  const backBody = await page.evaluate(() => document.body.innerText.slice(0, 300));
  const resubmit = /confirm form resubmission|ERR_CACHE_MISS/i.test(backBody);
  note(!resubmit, 'J3 Back after save does not land on a resubmission error', `url=${backUrl} body=${backBody.slice(0, 80)}`);

  // restore the original value through the same form
  await page.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  await page.fill(SEL, orig);
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]:has-text("Save")')]);

  // ── J2: two-tab conflict ───────────────────────────────────────────────
  const tabA = await ctx.newPage();
  tabA.on('dialog', (d) => d.accept());
  const tabB = await ctx.newPage();
  tabB.on('dialog', (d) => d.accept());
  await tabA.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  await tabB.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  await tabA.fill(SEL, orig + ' (tab A)');
  await Promise.all([tabA.waitForNavigation(), tabA.click('button[type="submit"]:has-text("Save")')]);
  await tabB.fill(SEL, orig + ' (tab B)');
  await Promise.all([tabB.waitForNavigation(), tabB.click('button[type="submit"]:has-text("Save")')]);
  const bBody = await tabB.evaluate(() => document.body.innerText);
  const conflictShown = /changed by another session|another browser tab/i.test(bBody);
  const bValue = await tabB.inputValue(SEL);
  const jsonAfterB = JSON.parse(fs.readFileSync(CONTENT, 'utf8')).copy.hero.headlineLine1;
  note(conflictShown, 'J2 conflict banner appears on the second tab', bBody.slice(0, 200));
  note(bValue === orig + ' (tab B)', 'J2 tab B still holds what was typed', `field=${bValue}`);
  note(jsonAfterB === orig + ' (tab A)', 'J2 tab A version is what is on disk', `disk=${jsonAfterB}`);
  // second save from tab B should now go through (carrying the fresh signature)
  await Promise.all([tabB.waitForNavigation(), tabB.click('button[type="submit"]:has-text("Save")')]);
  const jsonAfterB2 = JSON.parse(fs.readFileSync(CONTENT, 'utf8')).copy.hero.headlineLine1;
  note(jsonAfterB2 === orig + ' (tab B)', 'J2 pressing Save again on the conflict page saves tab B version', `disk=${jsonAfterB2}`);
  // restore
  await tabB.fill(SEL, orig);
  await Promise.all([tabB.waitForNavigation(), tabB.click('button[type="submit"]:has-text("Save")')]);
  await tabA.close(); await tabB.close();

  // ── J4: fake png upload ────────────────────────────────────────────────
  const fake = path.join(__dirname, 'out', 'aud9-fake.png');
  fs.mkdirSync(path.dirname(fake), { recursive: true });
  fs.writeFileSync(fake, 'this is not a png at all, just text bytes\n');
  const upDir = path.join(SITE, 'uploads', 'images');
  const lsUploads = () => (fs.existsSync(upDir) ? fs.readdirSync(upDir).filter((f) => !f.startsWith('.')).sort() : []);
  const uploadsBefore = lsUploads();
  await page.goto(BASE + '/admin/upload-image.php?sku=CC', { waitUntil: 'domcontentloaded' });
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    note(false, 'J4 found a file input on upload-image.php', 'no input[type=file]');
  } else {
    await fileInput.setInputFiles(fake);
    const submit = await page.$('button[type="submit"], input[type="submit"]');
    if (submit) await Promise.all([page.waitForNavigation().catch(() => {}), submit.click()]);
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    const uploadsAfter = lsUploads();
    const landed = uploadsAfter.filter((f) => !uploadsBefore.includes(f));
    note(landed.length === 0, 'J4 fake .png is refused and nothing lands in uploads/images', `new files: ${landed.join(',')} | page says: ${body.match(/[^\n]*(not|invalid|fail|refus|image)[^\n]*/i) || 'nothing matched'}`);
  }

  const after = fs.readFileSync(CONTENT, 'utf8');
  note(after === before, 'mirror content.json byte-identical after the journeys', `len ${before.length} -> ${after.length}`);
  await ctx.close();
  await browser.close();
  console.log(`aud9-admin: ${results.filter(Boolean).length}/${results.length}`);
})();
