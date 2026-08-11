/**
 * AUDIT-10 pass-3 — owner journeys A-D (pass file steps 3.3-3.6).
 *
 * SAFETY: everything runs against the MIRROR on :8123. After every journey that
 * writes, _harness/site/data/*.json is restored from _harness/pristine/ and the
 * restore is cmp-verified (byte-identical) before the next journey starts. The
 * repo's own data/ is never touched.
 *
 * Forbidden by the pass file and NOT performed here: password change, backup
 * restore, product delete, anything against :8124/:8125.
 *
 * Usage: node _harness/audit10-p3journeys.js [A] [B] [C] [D]
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const ROOT = path.join(__dirname, '..');
const PRISTINE = path.join(__dirname, 'pristine');
const MIRROR_DATA = path.join(__dirname, 'site', 'data');
const OUT = path.join(__dirname, 'out', 'audit10');
const SHOTS = path.join(OUT, 'journeys');
fs.mkdirSync(SHOTS, { recursive: true });

const FILES = ['content.json', 'site-info.json', 'products-all.json'];

function mirrorState() {
  const o = {};
  for (const f of FILES) {
    const p = path.join(MIRROR_DATA, f);
    o[f] = fs.existsSync(p) ? { bytes: fs.statSync(p).size, sha: require('crypto').createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12) } : null;
  }
  return o;
}
function pristineState() {
  const o = {};
  for (const f of FILES) {
    const p = path.join(PRISTINE, f);
    o[f] = { bytes: fs.statSync(p).size, sha: require('crypto').createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12) };
  }
  return o;
}
function restoreMirror(tag) {
  for (const f of FILES) fs.copyFileSync(path.join(PRISTINE, f), path.join(MIRROR_DATA, f));
  const m = mirrorState(), p = pristineState();
  const ok = FILES.every((f) => m[f] && m[f].sha === p[f].sha && m[f].bytes === p[f].bytes);
  console.log(`  [restore ${tag}] byte-identical to pristine: ${ok}  ` + FILES.map((f) => `${f}=${m[f].sha}/${p[f].sha}`).join(' '));
  return ok;
}

async function signIn(browser, vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
  }
  return { ctx, page };
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false });

// Anything a banner/alert region says, with where it sits and what it looks like.
const BANNERS = () => {
  const out = [];
  for (const el of document.querySelectorAll('[class*=alert], [class*=flash], [class*=error], [class*=success], [role=alert], .empty')) {
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    const cs = getComputedStyle(el);
    out.push({
      el: el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/).join('.'),
      text: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 300),
      topInDoc: Math.round(r.top + window.scrollY),
      topInViewport: Math.round(r.top),
      aboveTheFold: r.top >= 0 && r.top < window.innerHeight,
      height: Math.round(r.height),
      color: cs.color, background: cs.backgroundColor, borderColor: cs.borderColor,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight,
    });
  }
  return out;
};

const JOURNEYS = {
  // ---------------------------------------------------------------- A ----
  // Content edit round-trip: change one heading, save, verify the green banner,
  // the change on the public site, and the Site Images prefill (PLAN-9 item 1).
  async A(browser) {
    const res = { name: 'A — content edit round-trip', steps: [] };
    const { ctx, page } = await signIn(browser);

    await page.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
    await shot(page, 'A1-content-before');

    // The Site Images block: PLAN-9 says the admin prefills it even though the
    // shipped content.json has no copy.siteImages, and the first save materialises it.
    const prefill = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('input[name*="siteImages"], input[name*="images"]')) {
        out.push({ name: el.name, value: el.value, placeholder: el.getAttribute('placeholder') });
      }
      return out;
    });
    res.steps.push({ step: 'A0 site-images prefill on load', count: prefill.length, sample: prefill.slice(0, 8) });

    const target = 'copy[hero][headlineLine1]';
    const before = await page.inputValue(`[name="${target}"]`);
    const NEW = 'AUDIT10 PASS3 HEADLINE PROBE';
    await page.fill(`[name="${target}"]`, NEW);

    // Does the focused field end up hidden behind the sticky save bar?
    const focusOcclusion = await page.evaluate((sel) => {
      const el = document.querySelector(`[name="${sel}"]`);
      el.focus();
      el.scrollIntoView({ block: 'center' });
      const bar = document.querySelector('.save-bar');
      const r = el.getBoundingClientRect(), br = bar.getBoundingClientRect();
      const ov = Math.min(r.bottom, br.bottom) - Math.max(r.top, br.top);
      return { fieldTop: Math.round(r.top), barTop: Math.round(br.top), overlapPx: Math.round(Math.max(0, ov)) };
    }, target);
    res.steps.push({ step: 'A0b focused-field vs sticky save bar', ...focusOcclusion });

    res.steps.push({ step: 'A1 typed', field: target, before: before.slice(0, 60), after: NEW });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
      page.click('.save-bar button[type=submit], .save-bar input[type=submit], button:has-text("Save Content")'),
    ]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await shot(page, 'A2-content-after-save');
    const banners = await page.evaluate(BANNERS);
    res.steps.push({ step: 'A2 save banners', banners });

    const persisted = await page.inputValue(`[name="${target}"]`);
    res.steps.push({ step: 'A3 value persisted in the form', value: persisted, ok: persisted === NEW });

    // Did the save materialise copy.siteImages, as PLAN-9 item 1 says it should?
    const cj = JSON.parse(fs.readFileSync(path.join(MIRROR_DATA, 'content.json'), 'utf8'));
    res.steps.push({
      step: 'A4 content.json after save',
      heroLine1: cj?.copy?.hero?.headlineLine1,
      hasSiteImages: !!(cj?.copy?.siteImages),
      siteImagesKeys: cj?.copy?.siteImages ? Object.keys(cj.copy.siteImages) : null,
      siteImagesValues: cj?.copy?.siteImages || null,
    });

    // The public site.
    const pub = await ctx.newPage();
    await pub.goto(BASE + '/?_=' + Date.now(), { waitUntil: 'networkidle' });
    await pub.waitForTimeout(1200);
    const onSite = await pub.evaluate((needle) => ({
      found: document.body.innerText.includes(needle),
      h1: (document.querySelector('h1') || {}).textContent || null,
    }), NEW);
    await pub.screenshot({ path: path.join(SHOTS, 'A3-public-home.png'), fullPage: false });
    res.steps.push({ step: 'A5 public site reflects the edit', ...onSite });
    await pub.close();

    // Backups + audit log should now exist.
    await page.goto(BASE + '/admin/backups.php', { waitUntil: 'networkidle' });
    await shot(page, 'A4-backups-after-save');
    res.steps.push({ step: 'A6 backups page', text: await page.evaluate(() => document.querySelector('main').innerText.replace(/\s+/g, ' ').slice(0, 400)) });

    await page.goto(BASE + '/admin/audit-log.php', { waitUntil: 'networkidle' });
    await shot(page, 'A5-auditlog-after-save');
    res.steps.push({
      step: 'A7 audit log page',
      rows: await page.evaluate(() => document.querySelectorAll('tbody tr').length),
      banners: await page.evaluate(BANNERS),
      text: await page.evaluate(() => document.querySelector('main').innerText.replace(/\s+/g, ' ').slice(0, 300)),
    });

    await ctx.close();
    res.mirrorRestored = restoreMirror('after A');
    return res;
  },

  // ---------------------------------------------------------------- B ----
  // Validation display on settings.php.
  async B(browser) {
    const res = { name: 'B — validation display', steps: [] };
    const { ctx, page } = await signIn(browser);
    await page.goto(BASE + '/admin/settings.php', { waitUntil: 'networkidle' });

    const fields = await page.evaluate(() => [...document.querySelectorAll('input[type=text], input[type=email], input[type=color]')].map((e) => e.name).slice(0, 40));
    res.steps.push({ step: 'B0 field names', fields });

    // --- B-a: the path Rick actually takes. #company_name carries `required`,
    // so clearing it and pressing Save is stopped by the browser, not the server.
    // The subject is what that stop LOOKS like: is the field scrolled into view,
    // does focus land on it, is it hidden behind anything.
    await page.fill('#company_name', '');
    await page.click('main button[type=submit].btn-primary');
    await page.waitForTimeout(600);
    await shot(page, 'B0-native-required');
    res.steps.push({
      step: 'B-a native required-field stop',
      navigated: page.url().includes('settings.php'),
      state: await page.evaluate(() => {
        const el = document.querySelector('#company_name');
        const r = el.getBoundingClientRect();
        const focused = document.activeElement === el;
        // What is painted on top of the field's own centre?
        const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
        const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
        const hit = document.elementFromPoint(cx, cy);
        return {
          validity: el.validity.valid,
          validationMessage: el.validationMessage,
          focused,
          topInViewport: Math.round(r.top),
          inViewport: r.top >= 0 && r.bottom <= innerHeight,
          scrollY: Math.round(window.scrollY),
          occludedBy: hit === el ? null : (hit ? hit.tagName.toLowerCase() + '.' + String(hit.className).split(/\s+/)[0] : null),
        };
      }),
      siteInfoChangedByThisAttempt: mirrorState()['site-info.json'].sha !== pristineState()['site-info.json'].sha,
    });

    // --- B-b: the SERVER validation block. Restore the required field, then post
    // values that only the server rejects: a malformed e-mail, a schemeless social
    // URL, and an invalid colour pushed into the colour input (browsers coerce it;
    // we record what actually posts).
    const posted = await page.evaluate(() => {
      const out = {};
      const nm = document.querySelector('#company_name');
      nm.value = 'Insulation Products Corporation';
      out.company_name = nm.value;
      const em = [...document.querySelectorAll('input')].find((e) => /email/i.test(e.name || ''));
      if (em) { em.value = 'not-an-email'; out[em.name] = em.value; }
      const col = document.querySelector('#theme_primary');
      if (col) { col.value = 'zzzzzz'; out.theme_primary_afterCoercion = col.value; }
      const soc = [...document.querySelectorAll('input')].filter((e) => /linkedin|facebook|social|twitter|youtube|instagram/i.test(e.name || ''));
      if (soc.length) { soc[0].value = 'www.example.com'; out[soc[0].name] = soc[0].value; }
      return out;
    });
    res.steps.push({ step: 'B1 values pushed into the form', posted });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
      page.click('main button[type=submit].btn-primary'),
    ]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await shot(page, 'B1-settings-errors');

    const banners = await page.evaluate(BANNERS);
    res.steps.push({ step: 'B2 error rendering', banners });

    res.steps.push({
      step: 'B3 focus + field state after a rejected save',
      activeElement: await page.evaluate(() => {
        const a = document.activeElement;
        return a ? a.tagName.toLowerCase() + (a.name ? '[' + a.name + ']' : '') : null;
      }),
      firstErrorTopInViewport: banners.length ? banners[0].topInViewport : null,
      repopulated: await page.evaluate(() => {
        const nm = document.querySelector('input[name="company_name"]') || document.querySelector('#company_name');
        const em = [...document.querySelectorAll('input')].find((e) => /email/i.test(e.name || ''));
        return { company_name: nm ? nm.value : null, email: em ? em.value : null };
      }),
      // was the file written despite the errors?
      siteInfoChanged: (() => {
        const m = mirrorState(), p = pristineState();
        return m['site-info.json'].sha !== p['site-info.json'].sha;
      })(),
    });

    await ctx.close();
    res.mirrorRestored = restoreMirror('after B');
    return res;
  },

  // ---------------------------------------------------------------- C ----
  // Two-tab optimistic-concurrency banner on content.php.
  async C(browser) {
    const res = { name: 'C — two-tab conflict banner', steps: [] };
    const { ctx, page } = await signIn(browser);
    const tab2 = await ctx.newPage();

    await page.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
    await tab2.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
    res.steps.push({ step: 'C0 both tabs open on content.php' });

    await page.fill('[name="copy[hero][headlineLine1]"]', 'TAB ONE WINS');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
      page.click('.save-bar button[type=submit], button:has-text("Save Content")'),
    ]);
    res.steps.push({ step: 'C1 tab 1 saved', banners: await page.evaluate(BANNERS) });

    await tab2.fill('[name="copy[hero][headlineLine1]"]', 'TAB TWO LATER');
    await Promise.all([
      tab2.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
      tab2.click('.save-bar button[type=submit], button:has-text("Save Content")'),
    ]);
    await tab2.evaluate(() => window.scrollTo(0, 0));
    await tab2.waitForTimeout(250);
    await tab2.screenshot({ path: path.join(SHOTS, 'C1-conflict-banner.png'), fullPage: false });

    const banners = await tab2.evaluate(BANNERS);
    res.steps.push({ step: 'C2 tab 2 save — the message under test', banners });
    res.steps.push({
      step: 'C3 what the file holds afterwards',
      heroLine1: JSON.parse(fs.readFileSync(path.join(MIRROR_DATA, 'content.json'), 'utf8'))?.copy?.hero?.headlineLine1,
      tab2FieldValue: await tab2.inputValue('[name="copy[hero][headlineLine1]"]'),
    });

    await ctx.close();
    res.mirrorRestored = restoreMirror('after C');
    return res;
  },

  // ---------------------------------------------------------------- D ----
  // Upload refusal display: right extension, wrong bytes.
  async D(browser) {
    const res = { name: 'D — upload refusal display', steps: [] };
    const { ctx, page } = await signIn(browser);

    const uploadsDir = path.join(__dirname, 'site', 'uploads', 'images');
    const beforeFiles = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];

    // Reach the upload page the way Rick does: from the product edit page.
    await page.goto(BASE + '/admin/edit.php?sku=CC', { waitUntil: 'networkidle' });
    const link = await page.$('a[href*="upload-image.php"]');
    res.steps.push({ step: 'D0 upload link present on edit.php', found: !!link, href: link ? await link.getAttribute('href') : null });
    if (link) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), link.click()]);
    } else {
      await page.goto(BASE + '/admin/upload-image.php?sku=CC', { waitUntil: 'networkidle' });
    }
    await shot(page, 'D1-upload-page');

    // A .jpg that is not a JPEG.
    const fake = path.join(require('os').tmpdir(), 'audit10-not-really.jpg');
    fs.writeFileSync(fake, 'this is plain text pretending to be a JPEG, for AUDIT-10 pass-3\n'.repeat(20));

    const input = await page.$('input[type=file]');
    res.steps.push({ step: 'D1 file input present', found: !!input, accept: input ? await input.getAttribute('accept') : null });
    await input.setInputFiles(fake);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
      page.click('form[enctype="multipart/form-data"] button[type=submit]'),
    ]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, 'D2-upload-refusal.png'), fullPage: false });

    const banners = await page.evaluate(BANNERS);
    res.steps.push({
      step: 'D2 refusal rendering',
      banners,
      landedOn: page.url().replace(BASE, ''),
      hasMain: await page.evaluate(() => !!document.querySelector('main')),
      bodyText: await page.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 500)),
    });

    const afterFiles = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    res.steps.push({
      step: 'D3 nothing landed on disk',
      before: beforeFiles, after: afterFiles,
      newFiles: afterFiles.filter((f) => !beforeFiles.includes(f)),
      productsChanged: mirrorState()['products-all.json'].sha !== pristineState()['products-all.json'].sha,
    });
    fs.unlinkSync(fake);

    await ctx.close();
    res.mirrorRestored = restoreMirror('after D');
    return res;
  },
};

(async () => {
  const want = process.argv.slice(2).filter((a) => /^[ABCD]$/.test(a));
  const list = want.length ? want : ['A', 'B', 'C', 'D'];
  console.log('pristine:', JSON.stringify(pristineState()));
  console.log('mirror  :', JSON.stringify(mirrorState()));
  const browser = await launch();
  const all = {};
  for (const j of list) {
    console.log(`\n######## JOURNEY ${j} ########`);
    try {
      all[j] = await JOURNEYS[j](browser);
    } catch (e) {
      all[j] = { name: j, error: String(e).slice(0, 500) };
      console.log('  ERROR', all[j].error);
      restoreMirror('after failed ' + j);
    }
    console.log(JSON.stringify(all[j], null, 1).slice(0, 6000));
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'p3journeys.json'), JSON.stringify(all, null, 1));
  console.log('\nfinal mirror :', JSON.stringify(mirrorState()));
  console.log('final pristine:', JSON.stringify(pristineState()));
  console.log('report -> _harness/out/audit10/p3journeys.json');
})();
