/**
 * WHATS_LEFT §1at — the admin half of audit10cd.js (A10-024, 030, 031, 033,
 * 034, 039, 040, 041, 049, 050). Signs in on the sweep mirror and only VIEWS
 * pages; nothing is saved. Run through `node _harness/audit10cd.js admin`.
 */
const fs = require('fs');
const path = require('path');

const ADMIN = path.join(__dirname, '..', 'admin');
const read = (f) => fs.readFileSync(path.join(ADMIN, f), 'utf8');

const lum = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function adminArms(browser, { note, BASE }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/admin/auth.php');
  await page.fill('input[name=password]', 'audit-pass-123');
  await Promise.all([page.waitForNavigation(), page.press('input[name=password]', 'Enter')]);

  // ── A10-024 — the spec-row Label placeholder fits at 390
  {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
    const p = await m.newPage();
    await p.goto(BASE + '/admin/add.php', { waitUntil: 'networkidle' });
    const cut = await p.evaluate(() => [...document.querySelectorAll('.ste-lab')].filter((el) => el.getBoundingClientRect().width > 0).map((el) => {
      const cs = getComputedStyle(el);
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const s = document.createElement('span');
      s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px';
      s.style.font = cs.font; s.textContent = el.placeholder;
      document.body.appendChild(s); const w = s.getBoundingClientRect().width; s.remove();
      return Math.max(0, w - avail);
    }));
    note(cut.length > 0 && cut.every((c) => c <= 1), 'A10-024: the spec-row Label placeholder fits its field at 390', JSON.stringify(cut.map((c) => +c.toFixed(1))));
    await m.close();
  }

  // ── A10-030 — admin error text meets AA (static: the shared rule in admin_head())
  {
    const m = /\.error-list\s*\{[^}]*background:\s*(#[0-9a-f]{6})[^}]*color:\s*(#[0-9a-f]{6})/i.exec(read('config.php'));
    const ratio = m ? cr(m[2], m[1]) : 0;
    note(ratio >= 4.5, `A10-030: .error-list text is at least 4.5:1 on its background (${ratio.toFixed(2)}:1)`);
  }

  // ── A10-031 / A10-033 / A10-034 — Help
  {
    await page.goto(BASE + '/admin/help.php', { waitUntil: 'networkidle' });
    const box = await page.evaluate(() => { const b = document.querySelector('.credentials-box'); return b ? b.innerText : null; });
    note(box === null || /https?:\/\/|\/admin\//.test(box), 'A10-031: Help\'s "Admin dashboard address" box shows the address (or is gone)', JSON.stringify(box));
    const help = read('help.php');
    note(!/>Del<\/text>/.test(help), 'A10-033: Help\'s diagram labels the button "Delete", as the catalog does');
    note(!/reading a value you were told it shouldn't/.test(help), 'A10-034: the last "Getting more help" bullet is a whole sentence');
  }

  // ── A10-039 — Page Content's accessible names say "&", not "&amp;"
  {
    const html = await (await page.goto(BASE + '/admin/content.php')).text();
    const n = (html.match(/&amp;amp;/g) || []).length;
    note(n === 0, `A10-039: no double-escaped "&amp;amp;" in Page Content (was 96 accessible names)`, `${n} found`);
  }

  // ── A10-040 / A10-041 — Business Details preview and hint
  {
    await page.goto(BASE + '/admin/settings.php', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const foot = await page.evaluate(() => { const f = document.querySelector('.sp-foot'); return f ? f.textContent.trim() : ''; });
    note(/^© \d{4}–\d{4} .+\. All rights reserved\.$/.test(foot), 'A10-040: the Business Details preview copyright line has the site footer\'s shape', JSON.stringify(foot));
    note(!/\(tel:\)/.test(read('settings.php')), 'A10-041: the dial-number hint is in plain words (no "(tel:)")');
  }

  // ── A10-049 — admin buttons use the page font, on every page that has them
  {
    const off = [];
    for (const u of ['/admin/', '/admin/settings.php', '/admin/content.php', '/admin/inquiries.php', '/admin/audit-log.php', '/admin/backups.php', '/admin/add.php', '/admin/help.php', '/admin/site-images.php', '/admin/marketing-pdfs.php']) {
      await page.goto(BASE + u, { waitUntil: 'networkidle' });
      const f = await page.evaluate(() => {
        const body = getComputedStyle(document.body).fontFamily;
        const o = [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0 && getComputedStyle(b).fontFamily !== body);
        return { n: o.length, sample: o[0] && `${o[0].className || o[0].tagName} → ${getComputedStyle(o[0]).fontFamily}` };
      });
      if (f.n) off.push(`${u} ${f.n} (${f.sample})`);
    }
    note(off.length === 0, 'A10-049: every visible admin button uses the page font', off.join(' | '));
  }

  // ── A10-050 — no admin text left in #9ca3af (2.30–2.54:1)
  {
    const pages = ['/admin/', '/admin/settings.php', '/admin/content.php', '/admin/inquiries.php', '/admin/audit-log.php', '/admin/backups.php', '/admin/help.php', '/admin/add.php', '/admin/password.php'];
    const bad = [];
    for (const u of pages) {
      await page.goto(BASE + u, { waitUntil: 'networkidle' });
      const hits = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.closest('svg')) continue;
          let own = false;
          for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) own = true;
          if (!own || !el.getClientRects().length) continue;
          if (getComputedStyle(el).color === 'rgb(156, 163, 175)') out.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} "${el.textContent.trim().slice(0, 20)}"`);
        }
        return [...new Set(out)];
      });
      if (hits.length) bad.push(`${u}: ${hits.slice(0, 4).join(', ')}${hits.length > 4 ? ` +${hits.length - 4}` : ''}`);
    }
    note(bad.length === 0, 'A10-050: no admin text renders in #9ca3af (was 2.30–2.54:1)', bad.join(' | '));
  }
  await ctx.close();
}

module.exports = { adminArms };
