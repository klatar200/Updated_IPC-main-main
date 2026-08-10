/**
 * AUDIT-10 pass-3 — second evidence round: confirm-or-refute the leads the
 * screenshot reviewers raised, and cut the issue screenshots.
 *
 * Every lead is measured TWICE from separate browser contexts (guardrails
 * "twice_means_twice") and the two runs are diffed.
 *
 * Usage: node _harness/audit10-p3issues.js
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

// sRGB relative luminance + WCAG contrast, alpha-composited over a backdrop.
const CONTRAST_FN = `
function _parse(c){const m=c.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const p=m[1].split(',').map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};}
function _over(fg,bg){return {r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a),a:1};}
function _lum(c){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);}
function _ratio(fg,bg){const L1=_lum(fg),L2=_lum(bg);const a=Math.max(L1,L2),b=Math.min(L1,L2);return Math.round(((a+0.05)/(b+0.05))*100)/100;}
`;

const LEADS = {
  // Is the dashboard health banner clean now that the mirror has uploads/images?
  async health(page) {
    await page.goto(BASE + '/admin/index.php', { waitUntil: 'networkidle' });
    return page.evaluate(() => {
      const el = document.querySelector('.alert-error');
      return { present: !!el, text: el ? el.innerText.replace(/\s+/g, ' ').slice(0, 400) : null };
    });
  },

  // The admin nav overflows its 60px header at 390. What is off-screen, what is
  // painted outside the blue bar, and what contrast does that leave?
  async nav390(page) {
    await page.goto(BASE + '/admin/index.php', { waitUntil: 'networkidle' });
    return page.evaluate(new Function(CONTRAST_FN + `
      const h = document.querySelector('.ipc-admin-header');
      const hr = h.getBoundingClientRect();
      const hb = getComputedStyle(h).backgroundColor;
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const nav = h.querySelector('nav');
      const nr = nav.getBoundingClientRect();
      const items = [...nav.querySelectorAll('a, button')].map(el => {
        const r = el.getBoundingClientRect();
        const col = _parse(getComputedStyle(el).color);
        const onBar = r.top >= hr.top && r.bottom <= hr.bottom;
        const backdrop = _parse(onBar ? hb : bodyBg);
        const clippedTopPx = Math.max(0, hr.top - r.top);
        const belowBarPx = Math.max(0, r.bottom - hr.bottom);
        return {
          text: el.textContent.trim(),
          top: Math.round(r.top), bottom: Math.round(r.bottom),
          h: Math.round(r.height), w: Math.round(r.width),
          aboveViewportPx: Math.round(Math.max(0, -r.top)),
          clippedTopPx: Math.round(clippedTopPx),
          belowBarPx: Math.round(belowBarPx),
          color: getComputedStyle(el).color,
          backdrop: onBar ? hb : bodyBg,
          contrast: _ratio(_over(col, backdrop), backdrop),
        };
      });
      return {
        headerTop: Math.round(hr.top), headerBottom: Math.round(hr.bottom), headerHeight: Math.round(hr.height),
        headerOverflow: getComputedStyle(h).overflow,
        navTop: Math.round(nr.top), navBottom: Math.round(nr.bottom), navHeight: Math.round(nr.height),
        navOverflowsHeaderBy: Math.round(nr.bottom - hr.bottom),
        navStartsAboveHeaderBy: Math.round(hr.top - nr.top),
        headerBg: hb, bodyBg,
        items,
      };
    `));
  },

  // add.php spec-row: the Label input at small widths.
  async addspec(page) {
    await page.goto(BASE + '/admin/add.php', { waitUntil: 'networkidle' });
    return page.evaluate(() => {
      const rows = [...document.querySelectorAll('.ste-row, [class*=ste-]')].slice(0, 0);
      const labs = [...document.querySelectorAll('input.ste-lab, input.ste-in')];
      const out = labs.slice(0, 4).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el: el.className, placeholder: el.getAttribute('placeholder'),
          w: Math.round(r.width), h: Math.round(r.height),
          // how much of the placeholder is actually visible
          scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
        };
      });
      // measure the rendered width the placeholder WANTS
      const probe = document.createElement('span');
      const src = labs[0];
      if (src) {
        const cs = getComputedStyle(src);
        probe.style.cssText = `position:absolute;left:-9999px;white-space:pre;font:${cs.font};letter-spacing:${cs.letterSpacing}`;
        probe.textContent = src.getAttribute('placeholder') || '';
        document.body.appendChild(probe);
      }
      const need = probe.parentNode ? Math.round(probe.getBoundingClientRect().width) : null;
      if (probe.parentNode) probe.remove();
      return { vw: document.documentElement.clientWidth, inputs: out, placeholderNeedsPx: need, rows: rows.length };
    });
  },

  // content.php: the save bar — is it fixed/sticky, and does it sit over a field?
  async savebar(page) {
    await page.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 12000));
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const bars = [...document.querySelectorAll('body *')].filter((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return (cs.position === 'fixed' || cs.position === 'sticky') && r.height > 0 && r.width > 0;
      }).map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
          position: cs.position, top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height),
          bg: cs.backgroundColor, zIndex: cs.zIndex, text: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 60),
        };
      });
      // Which form controls are underneath the bar right now?
      const covered = [];
      for (const bar of bars) {
        for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
          const r = el.getBoundingClientRect();
          if (r.height === 0) continue;
          const ov = Math.min(r.bottom, bar.bottom) - Math.max(r.top, bar.top);
          if (ov > 2) covered.push({ bar: bar.el, control: el.name || el.id, overlapPx: Math.round(ov) });
        }
      }
      const body = getComputedStyle(document.body);
      const form = document.querySelector('form');
      const lastControls = form ? [...form.querySelectorAll('button, input[type=submit]')].slice(-4).map((b) => ({ t: (b.textContent || b.value || '').trim().slice(0, 30), type: b.type })) : [];
      return {
        scrollY: Math.round(window.scrollY),
        bars,
        coveredCount: covered.length,
        covered: covered.slice(0, 8),
        bodyPaddingBottom: body.paddingBottom,
        formLastControls: lastControls,
        saveButtonsOnPage: [...document.querySelectorAll('button, input[type=submit]')]
          .filter((b) => /save/i.test((b.textContent || b.value || '')))
          .map((b) => {
            const r = b.getBoundingClientRect();
            const cs = getComputedStyle(b.closest('[style*=fixed], .sticky') || b);
            return { text: (b.textContent || b.value).trim(), top: Math.round(r.top + window.scrollY), position: getComputedStyle(b.parentElement).position };
          }),
      };
    });
  },

  // Textareas whose height is not a whole number of lines -> permanent half row.
  async halfline(page) {
    await page.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
    return page.evaluate(() => {
      const out = [];
      for (const t of document.querySelectorAll('textarea')) {
        const cs = getComputedStyle(t);
        const lh = parseFloat(cs.lineHeight);
        const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const inner = t.clientHeight - pad;
        if (!lh || !isFinite(lh)) continue;
        const lines = inner / lh;
        out.push({
          name: t.name, clientHeight: t.clientHeight, lineHeight: lh, padding: pad,
          innerHeight: Math.round(inner * 10) / 10, lines: Math.round(lines * 100) / 100,
          fractionalPx: Math.round((inner % lh) * 10) / 10,
          rowsAttr: t.getAttribute('rows'),
          contentLines: Math.round((t.scrollHeight - pad) / lh * 100) / 100,
        });
      }
      const frac = out.filter((o) => o.fractionalPx > 2 && o.fractionalPx < o.lineHeight - 2);
      return { total: out.length, fractionalCount: frac.length, sample: frac.slice(0, 6), allSample: out.slice(0, 3) };
    });
  },

  // edit.php live preview at desktop — reviewer said it stops at "Specifications:".
  async preview(page) {
    await page.goto(BASE + '/admin/edit.php?sku=CC', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    return page.evaluate(() => {
      const pp = document.querySelector('[class*=pp-], #product-preview, .preview, [id*=preview]');
      const host = pp ? (pp.closest('aside, .card, div[class*=preview]') || pp) : null;
      if (!host) return { found: false };
      const r = host.getBoundingClientRect();
      const cs = getComputedStyle(host);
      const tables = [...host.querySelectorAll('table')].map((t) => ({ rows: t.querySelectorAll('tr').length, h: Math.round(t.getBoundingClientRect().height) }));
      return {
        found: true,
        el: host.tagName.toLowerCase() + (host.className ? '.' + String(host.className).trim().split(/\s+/).slice(0, 3).join('.') : ''),
        height: Math.round(r.height), scrollHeight: host.scrollHeight, clientHeight: host.clientHeight,
        overflowY: cs.overflowY, maxHeight: cs.maxHeight,
        hiddenPx: Math.max(0, host.scrollHeight - host.clientHeight),
        tables,
        text: host.innerText.replace(/\s+/g, ' ').slice(0, 300),
      };
    });
  },

  // audit-log.php empty state: both messages at once, with no filter applied.
  async emptylog(page) {
    await page.goto(BASE + '/admin/audit-log.php', { waitUntil: 'networkidle' });
    return page.evaluate(() => ({
      url: location.href,
      queryString: location.search,
      alert: document.querySelector('.alert') ? document.querySelector('.alert').innerText.replace(/\s+/g, ' ').trim() : null,
      empty: document.querySelector('.empty') ? document.querySelector('.empty').innerText.replace(/\s+/g, ' ').trim() : null,
      filterInputValue: document.querySelector('input[name=sku]') ? document.querySelector('input[name=sku]').value : null,
      filterSelectValue: document.querySelector('select[name=action]') ? document.querySelector('select[name=action]').value : null,
      clearLinkPresent: !!document.querySelector('a.reset'),
    }));
  },
};

const PLAN = [
  ['health', 'desktop-1440'],
  ['nav390', 'mobile-390'],
  ['addspec', 'mobile-390'],
  ['addspec', 'tablet-1024'],
  ['savebar', 'desktop-1440'],
  ['halfline', 'desktop-1440'],
  ['preview', 'desktop-1440'],
  ['emptylog', 'desktop-1440'],
];

(async () => {
  const browser = await launch();
  const results = {};
  for (const [name, vpName] of PLAN) {
    const one = async () => {
      const { ctx, page } = await signedIn(browser, vpName);
      const r = await LEADS[name](page, vpName);
      await ctx.close();
      return r;
    };
    const a = await one();
    const b = await one();
    const key = `${name}@${vpName}`;
    results[key] = { run1: a, run2: b, identical: JSON.stringify(a) === JSON.stringify(b) };
    console.log(`\n### ${key}  identical=${results[key].identical}`);
    console.log(JSON.stringify(a, null, 1).slice(0, 3500));
  }
  fs.writeFileSync(path.join(__dirname, 'out', 'audit10', 'p3issues.json'), JSON.stringify(results, null, 1));
  await browser.close();
  console.log('\nreport -> _harness/out/audit10/p3issues.json');
})();
