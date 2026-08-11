/**
 * AUDIT-10 pass-3 — targeted re-measurement + issue screenshots for the leads
 * the sweep and the screenshot review turned up. Every lead is measured TWICE
 * (two independent navigations) so it can carry CONFIRMED.
 *
 * Usage: node _harness/audit10-p3evidence.js [lead ...]
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

async function ctxFor(browser, vpName) {
  const ctx = await browser.newContext({ viewport: VP[vpName] });
  const page = await ctx.newPage();
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', PASS);
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
  }
  return { ctx, page };
}

// ---------------------------------------------------------------- leads ----

const LEADS = {
  // The product-catalog action column: table has min-width:980px, width:100%
  // and overflow:hidden, inside a .table-wrap that only scrolls when the table
  // is wider than the wrap. At >=1232px of wrap the wrap does NOT scroll, so
  // whatever sticks out past the table's content box is clipped for good.
  async actioncol(page, vpName) {
    await page.goto(BASE + '/admin/index.php', { waitUntil: 'networkidle' });
    return page.evaluate(() => {
      const t = document.querySelector('table');
      const wrap = t.closest('.table-wrap');
      const tr = t.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const cells = [...t.querySelectorAll('tbody tr')].slice(0, 3).map((row) => {
        const last = row.lastElementChild;
        const lr = last.getBoundingClientRect();
        const btns = [...last.querySelectorAll('a.btn, button')].map((b) => {
          const br = b.getBoundingClientRect();
          return {
            text: b.textContent.trim(),
            left: Math.round(br.left), right: Math.round(br.right),
            visibleRight: Math.round(Math.min(br.right, tr.left + t.clientWidth)),
            clippedPx: Math.round(Math.max(0, br.right - (tr.left + t.clientWidth))),
          };
        });
        return { cellLeft: Math.round(lr.left), cellRight: Math.round(lr.right), btns };
      });
      const headers = [...t.querySelectorAll('thead th')].map((th) => {
        const r = th.getBoundingClientRect();
        return { text: th.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
      });
      return {
        tableLeft: Math.round(tr.left), tableWidth: Math.round(tr.width),
        tableClientWidth: t.clientWidth, tableScrollWidth: t.scrollWidth,
        tableOverflowX: getComputedStyle(t).overflowX,
        tableMinWidth: getComputedStyle(t).minWidth,
        wrapClientWidth: wrap.clientWidth, wrapScrollWidth: wrap.scrollWidth,
        wrapCanScroll: wrap.scrollWidth > wrap.clientWidth,
        viewport: document.documentElement.clientWidth,
        headers, cells,
      };
    });
  },

  // help.php at 390: unwrapped reference tables force the whole document wide.
  async helpwidth(page) {
    await page.goto(BASE + '/admin/help.php', { waitUntil: 'networkidle' });
    return page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const widest = [...document.querySelectorAll('table.field-ref, pre, code')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { el: el.tagName.toLowerCase() + (el.className ? '.' + el.className : ''), w: Math.round(r.width), right: Math.round(r.right), text: el.textContent.trim().slice(0, 50) };
        })
        .filter((x) => x.right > vw + 1)
        .sort((a, b) => b.w - a.w).slice(0, 8);
      const content = document.querySelector('.help-content');
      const p = document.querySelector('.help-section p');
      const pr = p.getBoundingClientRect();
      return {
        vw,
        docScrollWidth: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth - vw,
        helpContentWidth: Math.round(content.getBoundingClientRect().width),
        firstParagraphRight: Math.round(pr.right),
        firstParagraphOffscreenPx: Math.round(pr.right - vw),
        firstParagraphText: p.textContent.trim().slice(0, 80),
        widest,
      };
    });
  },

  // edit.php at 390: what actually sets the form's min-width.
  async editwidth(page) {
    await page.goto(BASE + '/admin/edit.php?sku=CC', { waitUntil: 'networkidle' });
    return page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out = [];
      for (const el of document.querySelectorAll('main *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1) {
          const id = el.id ? '#' + el.id : '';
          const nm = el.getAttribute('name') ? '[name=' + el.getAttribute('name') + ']' : '';
          const cls = el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
          out.push({
            el: el.tagName.toLowerCase() + id + nm + cls,
            left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
            children: el.children.length,
            gridCols: getComputedStyle(el).gridTemplateColumns,
            minW: getComputedStyle(el).minWidth,
          });
        }
      }
      // Deepest offenders first: those with no offending children are the cause.
      const offenders = out.filter((o) => o.children === 0 || o.w <= 520);
      return {
        vw,
        docScrollWidth: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth - vw,
        count: out.length,
        widest: out.sort((a, b) => b.w - a.w).slice(0, 10),
        leaves: offenders.slice(0, 12),
      };
    });
  },

  // add.php / audit-log.php label association.
  async labels(page) {
    const res = {};
    for (const url of ['/admin/add.php', '/admin/edit.php?sku=CC', '/admin/audit-log.php', '/admin/settings.php', '/admin/content.php', '/admin/password.php', '/admin/backups.php', '/admin/inquiries.php']) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      res[url] = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('input, select, textarea')].filter((el) => el.type !== 'hidden');
        return controls.map((el) => {
          const r = el.getBoundingClientRect();
          // The visible text immediately preceding the control, which is what
          // a person reads as its label whether or not it is a <label>.
          let prev = el.previousElementSibling;
          let par = el.parentElement;
          let near = '';
          if (prev && prev.textContent.trim()) near = prev.textContent.trim().slice(0, 40);
          else if (par) {
            const lab = par.querySelector('label');
            if (lab) near = lab.textContent.trim().slice(0, 40);
          }
          return {
            name: el.name || null,
            id: el.id || null,
            type: el.type,
            labelCount: el.labels ? el.labels.length : 0,
            labelText: el.labels && el.labels[0] ? el.labels[0].textContent.trim().slice(0, 40) : null,
            ariaLabel: el.getAttribute('aria-label'),
            nearbyText: near,
            visible: r.width > 0 && r.height > 0,
          };
        }).filter((c) => c.labelCount === 0 && !c.ariaLabel && c.type !== 'submit' && c.type !== 'button');
      });
    }
    return res;
  },
};

// ------------------------------------------------------------- shooting ----

async function shoot(page, selector, file, pad = 12) {
  const el = await page.$(selector);
  if (!el) return null;
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const box = await el.boundingBox();
  if (!box) return null;
  const vw = page.viewportSize().width;
  const vh = page.viewportSize().height;
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: Math.min(vw - Math.max(0, box.x - pad), box.width + pad * 2),
    height: Math.min(vh - Math.max(0, box.y - pad), box.height + pad * 2),
  };
  await page.screenshot({ path: file, clip });
  return file;
}

(async () => {
  const want = process.argv.slice(2);
  const browser = await launch();
  const results = {};

  const run = async (name, vpName, fn) => {
    if (want.length && !want.includes(name)) return;
    const key = `${name}@${vpName}`;
    const a = await (async () => { const { ctx, page } = await ctxFor(browser, vpName); const r = await fn(page, vpName); await ctx.close(); return r; })();
    const b = await (async () => { const { ctx, page } = await ctxFor(browser, vpName); const r = await fn(page, vpName); await ctx.close(); return r; })();
    results[key] = { run1: a, run2: b, identical: JSON.stringify(a) === JSON.stringify(b) };
    console.log(`\n### ${key}  identical=${results[key].identical}`);
    console.log(JSON.stringify(a, null, 1).slice(0, 4000));
  };

  await run('actioncol', 'desktop-1440', LEADS.actioncol);
  await run('actioncol', 'tablet-1024', LEADS.actioncol);
  await run('helpwidth', 'mobile-390', LEADS.helpwidth);
  await run('editwidth', 'mobile-390', LEADS.editwidth);
  await run('labels', 'desktop-1440', LEADS.labels);

  fs.writeFileSync(path.join(__dirname, 'out', 'audit10', 'p3evidence.json'), JSON.stringify(results, null, 1));
  await browser.close();
  console.log('\nreport -> _harness/out/audit10/p3evidence.json');
})();

module.exports = { LEADS, ctxFor, shoot, BASE, PASS, VP };
