/**
 * AUDIT-10 pass-4 — browser verification of every lead the dump produced.
 *
 * The dump LOCATES; the browser CONFIRMS. Nothing in this pass becomes a
 * finding until it is measured here, at a stated URL and viewport. Run twice
 * (guardrails evidence_standards.twice_means_twice) — each run re-navigates.
 *
 * Usage: node _harness/audit10-copyverify.js
 */
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const VP = { width: 1440, height: 900 };

const out = (label, v) => console.log(`  ${label}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();
  const go = async (u) => { await page.goto(BASE + u, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(300); };

  /* ---- V2 ISO certification contradiction ---- */
  console.log('== V2 ISO certification, every rendering ==');
  for (const u of ['/', '/about', '/products?productId=VALUE-ADDED', '/dashboard']) {
    await go(u);
    const hits = await page.evaluate(() => {
      const res = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (/ISO\s?9001/.test(n.nodeValue)) {
          const el = n.parentElement;
          const r = el.getBoundingClientRect();
          res.push({ text: n.nodeValue.trim().slice(0, 120), tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 });
        }
      }
      return res;
    });
    out(u, hits);
  }

  /* ---- V4 the 300-char meta description ---- */
  console.log('== V4 PageMeta 300-char slice ==');
  await go('/products?productId=' + encodeURIComponent('IP71NS - IP72PS - IP73PP'));
  out('meta description', await page.evaluate(() => {
    const c = document.querySelector('meta[name="description"]').content;
    return { len: c.length, tail: c.slice(-46), endsWithSpace: /\s$/.test(c), terminated: /[.!?]$/.test(c.trim()) };
  }));

  /* ---- V3 mid-word slices, /dashboard ---- */
  console.log('== V3 /dashboard hard character slices ==');
  await go('/dashboard');
  out('desc+spec cells ending in an ellipsis', await page.evaluate(() => {
    const cells = [...document.querySelectorAll('table tbody td')];
    const cut = cells.filter((c) => c.textContent.trim().endsWith('…'));
    const midword = cut.filter((c) => /[\p{L}]…$/u.test(c.textContent.trim()));
    const openParen = cut.filter((c) => {
      const t = c.textContent;
      return (t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length;
    });
    return {
      totalCells: cells.length,
      truncated: cut.length,
      endInMidWord: midword.length,
      unclosedParen: openParen.length,
      samples: midword.slice(0, 4).map((c) => c.textContent.trim().slice(-40)),
      parenSample: openParen.slice(0, 2).map((c) => c.textContent.trim().slice(0, 120)),
    };
  }));

  console.log('== V3b product sidebar + related-product name slices ==');
  await go('/products?productId=IP29CG');
  out('sliced names', await page.evaluate(() => {
    const all = [...document.querySelectorAll('aside a, aside button, main button')];
    const cut = all.filter((a) => /[\p{L}(]…/u.test(a.textContent));
    return {
      scanned: all.length,
      truncated: cut.length,
      samples: cut.slice(0, 6).map((a) => a.textContent.trim().replace(/\s+/g, ' ').slice(0, 70)),
    };
  }));

  /* ---- V5 /contact enquiry vs inquiries on one page ---- */
  console.log('== V5 /contact: enquiry vs inquiries ==');
  await go('/contact');
  out('both renderings', await page.evaluate(() => {
    const res = { enquiry: [], inquir: [] };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue;
      const r = n.parentElement.getBoundingClientRect();
      if (/enquir/i.test(t)) res.enquiry.push({ t: t.trim(), y: Math.round(r.top + window.scrollY), visible: r.height > 0 });
      if (/inquir/i.test(t)) res.inquir.push({ t: t.trim().slice(0, 60), y: Math.round(r.top + window.scrollY), visible: r.height > 0 });
    }
    return res;
  }));

  /* ---- V6 the two not-found messages ---- */
  console.log('== V6 apostrophe drift between the two not-found messages ==');
  for (const u of ['/no-such-page', '/products?productId=NOPE-XYZ-123']) {
    await go(u);
    out(u, await page.evaluate(() => {
      const res = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (/(couldn|doesn|can)['’]t/i.test(n.nodeValue)) {
          const m = n.nodeValue.match(/\w+(['’])t/);
          res.push({ text: n.nodeValue.trim().slice(0, 90), apostrophe: m[1], codepoint: 'U+' + m[1].codePointAt(0).toString(16).toUpperCase().padStart(4, '0') });
        }
      }
      return res;
    }));
  }

  /* ---- V7 homepage: same stat rendered two ways ---- */
  console.log('== V7 homepage repeated stats ==');
  await go('/');
  out('stat renderings', await page.evaluate(() => {
    const res = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue.trim();
      if (/^(25M\+|25 [Mm]illion|\$50|[Ss]ame[- ][Dd]ay|Feet in Stock|feet in stock\.?.*|Minimum Order|minimum order\.?|Shipment Available|Ready to ship today)$/.test(t)) {
        const r = n.parentElement.getBoundingClientRect();
        res.push({ t, y: Math.round(r.top + window.scrollY), visible: r.height > 0 });
      }
    }
    return res;
  }));

  /* ---- V8 Data Sheet / Datasheet ---- */
  console.log('== V8 data-sheet term renderings ==');
  for (const u of ['/datasheets', '/products?productId=IP29CG', '/dashboard']) {
    await go(u);
    out(u, await page.evaluate(() => {
      const seen = new Map();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        for (const m of n.nodeValue.matchAll(/\bdata[\s-]?sheets?\b/gi)) {
          const r = n.parentElement.getBoundingClientRect();
          if (r.height > 0) seen.set(m[0], (seen.get(m[0]) || 0) + 1);
        }
      }
      return Object.fromEntries(seen);
    }));
  }

  /* ---- V11 apparent concatenations ---- */
  console.log('== V11 "MessageGeneral"/"TubingView" — real or a textContent artifact? ==');
  await go('/contact');
  out('/contact CTA buttons', await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => /Send a Message|Request a Quote/.test(b.textContent))
    .map((b) => ({
      textContent: b.textContent.trim().replace(/\s+/g, ' '),
      childRects: [...b.querySelectorAll('*')].filter((c) => c.textContent.trim())
        .map((c) => ({ t: c.textContent.trim().slice(0, 28), top: Math.round(c.getBoundingClientRect().top), display: getComputedStyle(c).display })),
    }))));

  /* ---- V12 noscript vs live facts ---- */
  console.log('== V12 <noscript> second copy vs the live footer ==');
  await go('/');
  out('noscript', await page.evaluate(() => {
    const ns = document.querySelector('noscript');
    const t = ns.textContent.replace(/\s+/g, ' ');
    const grab = (re) => (t.match(re) || [null])[0];
    return {
      phone: grab(/630\.\d{3}\.\d{4}/), fax: grab(/630\.771\.0701/),
      email: grab(/[\w.@]+@insulationproducts\.com/),
      address: grab(/250 Gibraltar[^,]*, [^,]+, \w+ \d+/),
      hours: grab(/Mon.Fri, [^<]*CT/), year: grab(/since \d{4}/),
    };
  }));
  out('live footer', await page.evaluate(() => {
    const t = document.querySelector('footer').textContent.replace(/\s+/g, ' ');
    const grab = (re) => (t.match(re) || [null])[0];
    return {
      phone: grab(/630\.\d{3}\.\d{4}/), fax: grab(/630\.771\.0701/),
      email: grab(/[\w.@]+@insulationproducts\.com/),
      address: grab(/250 Gibraltar[^,]*, [^,]+, \w+ \d+/),
      hours: grab(/Mon.Fri, [^A-Z]*CT/),
    };
  }));
  out('facility alt text', await page.evaluate(() =>
    [...document.querySelectorAll('img[alt*="Gibraltar"]')].map((i) => i.alt)));

  await ctx.close();

  /* ---- admin leads ---- */
  const actx = await browser.newContext({ viewport: VP });
  const apage = await actx.newPage();
  apage.on('dialog', (d) => d.dismiss());
  await apage.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });

  console.log('== V10 login screen: "Login" and "Sign In" on one page ==');
  console.log('  ' + JSON.stringify(await apage.evaluate(() => {
    const res = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue.trim();
      if (/^(Login|Sign In|Sign Out|Log In)$/i.test(t)) {
        const r = n.parentElement.getBoundingClientRect();
        res.push({ t, tag: n.parentElement.tagName, visible: r.height > 0, y: Math.round(r.top) });
      }
    }
    const btn = document.querySelector('button[type=submit], input[type=submit]');
    return { textNodes: res, submitLabel: btn ? (btn.value || btn.textContent).trim() : null, title: document.title, h1: (document.querySelector('h1') || {}).textContent };
  })));

  await apage.fill('input[type="password"]', PASS);
  await Promise.all([apage.waitForNavigation(), apage.click('button[type="submit"], input[type="submit"]')]);

  console.log('== V1 /admin/content.php: literal &amp; in accessible names ==');
  await apage.goto(BASE + '/admin/content.php', { waitUntil: 'networkidle' });
  await apage.waitForTimeout(400);
  console.log('  ' + JSON.stringify(await apage.evaluate(() => {
    const legend = [...document.querySelectorAll('legend')].find((l) => /Products .* Services Cards/.test(l.textContent));
    const label = [...document.querySelectorAll('label')].find((l) => /row 1 of Products/.test(l.textContent));
    const btn = [...document.querySelectorAll('button[aria-label]')].find((b) => /Move row 1 of Products/.test(b.getAttribute('aria-label')));
    const vh = label ? label.querySelector('[data-rowctx]') : null;
    const cs = vh ? getComputedStyle(vh) : null;
    return {
      legendVisibleText: legend ? legend.textContent.trim() : null,
      labelAccessibleName: label ? label.textContent.replace(/\s+/g, ' ').trim() : null,
      buttonAriaLabel: btn ? btn.getAttribute('aria-label') : null,
      rowctxIsVisuallyHidden: cs ? { position: cs.position, clip: cs.clip, w: Math.round(vh.getBoundingClientRect().width), h: Math.round(vh.getBoundingClientRect().height) } : null,
      sectionTitleAttr: (document.querySelector('fieldset[data-section-title*="Services"]') || {}).dataset?.sectionTitle || null,
      literalEntityCount: [...document.querySelectorAll('label span[data-rowctx], button[aria-label]')]
        .filter((e) => /&amp;|&quot;|&#\d+;/.test(e.textContent + (e.getAttribute('aria-label') || ''))).length,
    };
  })));

  console.log('== V9 /admin/add.php: visible "Rows JSON" label ==');
  await apage.goto(BASE + '/admin/add.php', { waitUntil: 'networkidle' });
  await apage.waitForTimeout(500);
  console.log('  ' + JSON.stringify(await apage.evaluate(() => {
    const out = [];
    for (const l of document.querySelectorAll('label, legend, h2, h3')) {
      if (!/JSON/i.test(l.textContent)) continue;
      const r = l.getBoundingClientRect();
      const cs = getComputedStyle(l);
      out.push({ text: l.textContent.trim(), tag: l.tagName, w: Math.round(r.width), h: Math.round(r.height), display: cs.display, visibility: cs.visibility });
    }
    return out;
  })));

  await apage.goto(BASE + '/admin/edit.php?id=CC', { waitUntil: 'networkidle' });
  await apage.waitForTimeout(500);
  console.log('  edit.php: ' + JSON.stringify(await apage.evaluate(() => {
    const out = [];
    for (const l of document.querySelectorAll('label, legend, h2, h3')) {
      if (!/JSON/i.test(l.textContent)) continue;
      const r = l.getBoundingClientRect();
      out.push({ text: l.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  })));

  console.log('== V13 settings.php "Live preview" copyright vs the real footer ==');
  await apage.goto(BASE + '/admin/settings.php', { waitUntil: 'networkidle' });
  await apage.waitForTimeout(600);
  console.log('  ' + JSON.stringify(await apage.evaluate(() => {
    const head = document.querySelector('.preview-head');
    const foot = document.querySelector('#settings-preview .sp-foot');
    const badges = [...document.querySelectorAll('#settings-preview .sp-badge')].map((b) => b.textContent.trim());
    return { panelHeading: head ? head.textContent.trim() : null, previewFooter: foot ? foot.textContent.trim() : null, previewBadges: badges };
  })));

  console.log('== V14 admin copy that assumes developer vocabulary ==');
  for (const u of ['/admin/settings.php', '/admin/content.php', '/admin/index.php']) {
    await apage.goto(BASE + u, { waitUntil: 'networkidle' });
    await apage.waitForTimeout(400);
    console.log('  ' + u + ': ' + JSON.stringify(await apage.evaluate(() => {
      const TERMS = /\b(Schema\.org|tel:|mailto:|4\.5:1|755|max_input_vars|\.user\.ini|JSONL?|MIME|regex|API|UTF-8|octal|chmod)\b/;
      const res = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!TERMS.test(n.nodeValue)) continue;
        const el = n.parentElement;
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        res.push({ text: n.nodeValue.trim().slice(0, 130), tag: el.tagName, cls: (el.className || '').toString().slice(0, 24) });
      }
      return res;
    })));
  }

  await actx.close();

  console.log('== V13b the real site footer copyright ==');
  const fctx = await browser.newContext({ viewport: VP });
  const fpage = await fctx.newPage();
  await fpage.goto(BASE + '/', { waitUntil: 'networkidle' });
  await fpage.waitForTimeout(300);
  console.log('  ' + JSON.stringify(await fpage.evaluate(() => {
    const ps = [...document.querySelectorAll('footer p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim());
    return ps.filter((t) => /©|reserved/.test(t));
  })));
  await fctx.close();

  await browser.close();
})();
