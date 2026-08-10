/**
 * AUDIT-10 pass-3 — issue screenshots + the last two measurements.
 *
 * Writes _harness/out/audit10/issues/<finding-id>__<viewport>__<slug>.png for
 * every pass-3 finding, and measures the admin error-block contrast (pass file
 * 3.4 names contrast as part of the subject).
 *
 * Usage: node _harness/audit10-p3shots.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const ISSUES = path.join(__dirname, 'out', 'audit10', 'issues');
fs.mkdirSync(ISSUES, { recursive: true });

const VP = {
  'desktop-1440': { width: 1440, height: 900 },
  'tablet-1024': { width: 1024, height: 768 },
  'tablet-834': { width: 834, height: 1112 },
  'mobile-390': { width: 390, height: 844 },
};

async function signedIn(browser, vpName) {
  const ctx = await browser.newContext({ viewport: VP[vpName] });
  const page = await ctx.newPage();
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
  }
  return { ctx, page };
}

// clip a region of the viewport around a selector
async function region(page, sel, file, pad = 16, idx = 0) {
  const box = await page.evaluate(({ sel, idx }) => {
    const els = document.querySelectorAll(sel);
    const el = els[idx];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, { sel, idx });
  if (!box) { console.log('  MISS ' + sel); return null; }
  await page.waitForTimeout(150);
  const b2 = await page.evaluate(({ sel, idx }) => {
    const el = document.querySelectorAll(sel)[idx];
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, { sel, idx });
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  const clip = {
    x: Math.max(0, Math.min(b2.x - pad, vw - 1)),
    y: Math.max(0, Math.min(b2.y - pad, vh - 1)),
    width: Math.max(1, Math.min(b2.width + pad * 2, vw - Math.max(0, b2.x - pad))),
    height: Math.max(1, Math.min(b2.height + pad * 2, vh - Math.max(0, b2.y - pad))),
  };
  await page.screenshot({ path: file, clip });
  console.log('  shot ' + path.basename(file) + '  ' + JSON.stringify(clip).replace(/"/g, ''));
  return file;
}

const CONTRAST = `
function _parse(c){const m=c.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const p=m[1].split(',').map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};}
function _over(fg,bg){return {r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a),a:1};}
function _lum(c){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);}
function _ratio(fg,bg){const L1=_lum(fg),L2=_lum(bg);const a=Math.max(L1,L2),b=Math.min(L1,L2);return Math.round(((a+0.05)/(b+0.05))*100)/100;}
function _bgOf(el){let n=el;while(n&&n!==document.documentElement){const c=_parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0)return c;n=n.parentElement;}return {r:255,g:255,b:255,a:1};}
`;

(async () => {
  const browser = await launch();
  const out = {};

  // ---- 1. the error/flash block contrast (journeys B, C, D land here) ----
  {
    const { ctx, page } = await signedIn(browser, 'desktop-1440');
    await page.goto(BASE + '/admin/settings.php', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const em = document.querySelector('#contact_email'); if (em) em.value = 'not-an-email';
    });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('main button[type=submit].btn-primary'),
    ]);
    out.errorContrast = await page.evaluate(new Function(CONTRAST + `
      const li = document.querySelector('.error-list li') || document.querySelector('.error-list');
      const cs = getComputedStyle(li);
      const fg = _parse(cs.color), bg = _bgOf(li);
      const succ = null;
      return {
        text: li.textContent.trim().slice(0,90),
        color: cs.color, effectiveBackground: 'rgb('+Math.round(bg.r)+', '+Math.round(bg.g)+', '+Math.round(bg.b)+')',
        fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        ratio: _ratio(_over(fg,bg), bg),
        aaNormalText: _ratio(_over(fg,bg), bg) >= 4.5,
        isLargeText: parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight,10) >= 700),
      };
    `));
    console.log('errorContrast', JSON.stringify(out.errorContrast));
    await region(page, '.error-list', path.join(ISSUES, 'A10-JOURNEY-B__desktop-1440__settings-error-block.png'), 20);
    await ctx.close();
  }

  // the success banner, for completeness (journey A)
  {
    const { ctx, page } = await signedIn(browser, 'desktop-1440');
    await page.goto(BASE + '/admin/index.php', { waitUntil: 'networkidle' });
    out.successContrast = await page.evaluate(new Function(CONTRAST + `
      const d = document.createElement('div');
      d.className = 'alert alert-success'; d.textContent = 'probe';
      const m = document.querySelector('main'); m.insertBefore(d, m.firstChild);
      const cs = getComputedStyle(d); const fg = _parse(cs.color), bg = _bgOf(d);
      const r = { color: cs.color, background: cs.backgroundColor, fontSize: cs.fontSize, ratio: _ratio(_over(fg,bg), bg) };
      d.remove(); return r;
    `));
    console.log('successContrast(probe)', JSON.stringify(out.successContrast));
    await ctx.close();
  }

  // ---- 2. issue screenshots ----
  const SHOTS = [
    // A10-020 catalog Delete clipped
    ['desktop-1440', '/admin/index.php', 'tbody tr', 'A10-020__desktop-1440__admin-index-actions-clipped.png', 0, 8],
    ['tablet-1024', '/admin/index.php', 'tbody tr', 'A10-020__tablet-1024__admin-index-actions-clipped.png', 0, 8],
    // A10-021 nav overflow at 390
    ['mobile-390', '/admin/index.php', '.ipc-admin-header', 'A10-021__mobile-390__admin-nav-overflows-header.png', 0, 26],
    // A10-022 help.php horizontal overflow at 390
    ['mobile-390', '/admin/help.php', 'table.field-ref', 'A10-022__mobile-390__help-reference-table-offscreen.png', 0, 8],
    // A10-023 edit.php overflow at 390
    ['mobile-390', '/admin/edit.php?sku=CC', '.card', 'A10-023__mobile-390__edit-form-overflows-viewport.png', 0, 8],
    // A10-024 add.php spec label input
    ['mobile-390', '/admin/add.php', 'input.ste-lab', 'A10-024__mobile-390__add-spec-label-input-91px.png', 0, 24],
    ['tablet-1024', '/admin/add.php', 'input.ste-lab', 'A10-024__tablet-1024__add-spec-label-input-187px.png', 0, 24],
    // A10-025 audit-log contradictory empty state
    ['desktop-1440', '/admin/audit-log.php', 'main', 'A10-025__desktop-1440__auditlog-contradictory-empty-state.png', 0, 8],
    // A10-031 help.php blank credentials rule
    ['desktop-1440', '/admin/help.php', '.credentials-box', 'A10-031__desktop-1440__help-blank-credentials-rule.png', 0, 24],
    // A10-029 help.php size-chart example
    ['desktop-1440', '/admin/help.php', 'table.spec-mock, table', 'A10-029__desktop-1440__help-size-chart-max-below-min.png', 0, 12],
  ];

  for (const [vpName, url, sel, file, idx, pad] of SHOTS) {
    const { ctx, page } = await signedIn(browser, vpName);
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await region(page, sel, path.join(ISSUES, file), pad, idx);
    await ctx.close();
  }

  // A10-026 sticky save bar over a labelled field — needs a scroll position
  for (const vpName of ['desktop-1440', 'tablet-834']) {
    const { ctx, page } = await signedIn(browser, vpName);
    await page.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const h = page.viewportSize().height;
    await page.screenshot({
      path: path.join(ISSUES, `A10-026__${vpName}__content-savebar-covers-fields.png`),
      clip: { x: 0, y: Math.max(0, h - 200), width: page.viewportSize().width, height: 200 },
    });
    console.log('  shot A10-026 ' + vpName);
    await ctx.close();
  }

  // A10-027 audit-log detail wording — needs a save first, then restore.
  {
    const PRISTINE = path.join(__dirname, 'pristine');
    const MDATA = path.join(__dirname, 'site', 'data');
    const { ctx, page } = await signedIn(browser, 'desktop-1440');
    await page.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
    // Edit a PRIVACY POLICY field — nothing to do with the homepage.
    const privSel = await page.evaluate(() => {
      const el = [...document.querySelectorAll('textarea, input')].find((e) => /privacy/i.test(e.name || ''));
      return el ? el.name : null;
    });
    out.auditLogWording = { editedField: privSel };
    if (privSel) {
      const before = await page.inputValue(`[name="${privSel}"]`);
      await page.fill(`[name="${privSel}"]`, before + ' AUDIT10-PROBE');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
        page.click('.save-bar button[type=submit]'),
      ]);
      await page.goto(BASE + '/admin/audit-log.php', { waitUntil: 'networkidle' });
      out.auditLogWording.row = await page.evaluate(() => {
        const tr = document.querySelector('tbody tr');
        return tr ? [...tr.children].map((td) => td.innerText.trim()) : null;
      });
      await region(page, 'tbody tr', path.join(ISSUES, 'A10-027__desktop-1440__auditlog-says-homepage-for-privacy-edit.png'), 12);
    }
    await ctx.close();
    for (const f of ['content.json', 'site-info.json', 'products-all.json']) {
      fs.copyFileSync(path.join(PRISTINE, f), path.join(MDATA, f));
    }
    console.log('  [restore after A10-027 probe] done');
  }

  fs.writeFileSync(path.join(__dirname, 'out', 'audit10', 'p3shots.json'), JSON.stringify(out, null, 1));
  await browser.close();
  console.log('\n' + JSON.stringify(out, null, 1));
})();
