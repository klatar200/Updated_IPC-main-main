/**
 * AUDIT-10 pass-4 step 4.1 — the full text census.
 *
 * Walks every page in plans/audit10/routes.json at desktop-1440 and emits
 * EVERY readable character: every visible text node, plus <title>, the meta
 * description, every img[alt], every [aria-label]/[aria-labelledby] text,
 * every [placeholder] / [title] attribute, and the textContent of every
 * button/summary/label/option.  The <noscript> block is captured too — it is
 * the documented second copy of the contact facts (index.html) and a JS-
 * enabled browser never paints it, so nothing else in the harness sees it.
 *
 * Output: plans/audit10/state/textdump.json  — { url: [ {text, path, kind} ] }
 * committed, so later passes and the remediation plan can grep it.
 *
 * `text` is RAW (not trimmed): the whitespace scans in step 4.2 need the
 * leading/trailing spaces exactly as the DOM carries them.
 *
 * Usage: node _harness/audit10-textdump.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, '..', 'plans', 'audit10', 'state', 'textdump.json');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const VIEWPORT = { width: 1440, height: 900 };

const PUBLIC_ROUTES = [
  '/', '/products', '/services', '/industries', '/about',
  '/contact', '/dashboard', '/datasheets', '/faq', '/privacy',
];
const FAMILY_VIEWS = ['Tape', 'Heat Shrink Tubing', 'Adhesive']
  .map((f) => '/dashboard?family=' + encodeURIComponent(f));
const ERROR_STATES = ['/products?productId=NOPE-XYZ-123', '/no-such-page'];
const ADMIN_PAGES = [
  '/admin/index.php', '/admin/content.php', '/admin/settings.php',
  '/admin/add.php', '/admin/edit.php?id=CC', '/admin/backups.php',
  '/admin/password.php', '/admin/inquiries.php', '/admin/audit-log.php',
  '/admin/help.php',
];

/* The in-page extractor. Runs in the browser; returns a flat list. */
const EXTRACT = () => {
  const out = [];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE']);

  const pathOf = (el) => {
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && n.tagName !== 'HTML') {
      let seg = n.tagName.toLowerCase();
      if (n.id) {
        seg += '#' + n.id;
        parts.unshift(seg);
        break;
      }
      const parent = n.parentElement;
      if (parent) {
        const sibs = [...parent.children].filter((c) => c.tagName === n.tagName);
        if (sibs.length > 1) seg += ':nth-of-type(' + (sibs.indexOf(n) + 1) + ')';
      }
      parts.unshift(seg);
      n = n.parentElement;
    }
    return parts.join('>');
  };

  const hiddenAncestor = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hasAttribute('hidden')) return true;
      if (n.getAttribute('aria-hidden') === 'true') return true;
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    }
    return false;
  };

  const push = (kind, text, el) => {
    if (text == null) return;
    out.push({ text: String(text), path: el ? pathOf(el) : '(document)', kind });
  };

  /* 1. document-level metadata */
  push('title', document.title, document.querySelector('title') || document.head);
  for (const m of document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]')) {
    push('meta:' + (m.getAttribute('name') || m.getAttribute('property')), m.getAttribute('content'), m);
  }

  /* 2. the <noscript> second copy (never painted when JS is on) */
  for (const ns of document.querySelectorAll('noscript')) {
    push('noscript', ns.textContent, ns);
  }

  /* 3. every visible text node */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      if (p.tagName === 'NOSCRIPT') return NodeFilter.FILTER_REJECT; // captured above
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (hiddenAncestor(p)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    push('text', n.nodeValue, n.parentElement);
  }

  /* 4. accessible / attribute copy — recorded even when the host is hidden,
        because a screen reader may still reach it and Rick may still hit it. */
  for (const el of document.querySelectorAll('img')) {
    push('alt', el.getAttribute('alt'), el);
  }
  for (const el of document.querySelectorAll('[aria-label]')) {
    push('aria-label', el.getAttribute('aria-label'), el);
  }
  for (const el of document.querySelectorAll('[placeholder]')) {
    push('placeholder', el.getAttribute('placeholder'), el);
  }
  for (const el of document.querySelectorAll('[title]')) {
    push('title-attr', el.getAttribute('title'), el);
  }
  for (const el of document.querySelectorAll('input[value], option')) {
    const v = el.tagName === 'OPTION' ? el.textContent : el.getAttribute('value');
    const t = (el.getAttribute('type') || '').toLowerCase();
    if (el.tagName === 'OPTION' || t === 'submit' || t === 'button') push('control-value', v, el);
  }
  for (const el of document.querySelectorAll('button, summary, label, legend, th, caption')) {
    push('control:' + el.tagName.toLowerCase(), el.textContent, el);
  }
  for (const el of document.querySelectorAll('a[href]')) {
    push('link-href', el.getAttribute('href'), el);
  }
  return out;
};

async function dump(page, url) {
  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 20));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  return page.evaluate(EXTRACT);
}

(async () => {
  const browser = await launch();
  const result = {};

  const publicUrls = [
    ...PUBLIC_ROUTES,
    ...FAMILY_VIEWS,
    ...ERROR_STATES,
    ...products.map((p) => '/products?productId=' + encodeURIComponent(p.id)),
  ];

  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  for (const url of publicUrls) {
    try {
      result[url] = await dump(page, url);
    } catch (e) {
      result[url] = [{ text: 'DUMP-ERROR ' + String(e).slice(0, 200), path: '(error)', kind: 'error' }];
    }
    process.stdout.write('.');
  }
  await ctx.close();
  console.log(' public done');

  /* signed-out login screen */
  const anon = await browser.newContext({ viewport: VIEWPORT });
  const anonPage = await anon.newPage();
  result['/admin/ (signed out)'] = await dump(anonPage, '/admin/');
  await anon.close();

  /* signed-in admin */
  const actx = await browser.newContext({ viewport: VIEWPORT });
  const apage = await actx.newPage();
  apage.on('dialog', (d) => d.dismiss());
  await apage.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await apage.$('input[type="password"]')) {
    await apage.fill('input[type="password"]', PASS);
    await Promise.all([
      apage.waitForNavigation(),
      apage.click('button[type="submit"], input[type="submit"]'),
    ]);
  }
  for (const url of ADMIN_PAGES) {
    try {
      result[url] = await dump(apage, url);
    } catch (e) {
      result[url] = [{ text: 'DUMP-ERROR ' + String(e).slice(0, 200), path: '(error)', kind: 'error' }];
    }
    process.stdout.write('.');
  }
  await actx.close();
  console.log(' admin done');

  await browser.close();

  fs.writeFileSync(OUT, JSON.stringify(result, null, 0) + '\n');
  const pages = Object.keys(result).length;
  const entries = Object.values(result).reduce((a, v) => a + v.length, 0);
  console.log(`textdump: ${pages} pages, ${entries} entries -> ${OUT}`);
  console.log('bytes:', fs.statSync(OUT).size);
})();
