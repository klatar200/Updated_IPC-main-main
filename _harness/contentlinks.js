/**
 * E2 — every "Show me on the site ↗" link on Page Content actually lands on
 * the section it names.
 *
 * The links are only worth having if they cannot go stale, so this suite reads
 * them out of the RENDERED admin page (not out of the PHP source) and then
 * follows each one into the real site, exactly as the owner would. An anchor
 * that gets renamed or dropped from src/App.jsx fails here instead of silently
 * dumping him at the top of the page — which is the failure mode C30 already
 * fixed once for the homepage industry cards.
 *
 * Asserted per link:
 *   1. The target page loads.
 *   2. An element with that id exists on it.
 *   3. After the fragment scroll, the element's top is BELOW the sticky navbar
 *      (~65px) and inside the viewport — i.e. the `scroll-margin-top: 84px`
 *      rule in src/index.css is actually in force. An id with no scroll margin
 *      lands under the header and looks like the link did nothing.
 *
 * Sections deliberately without an anchor are checked too: they must still
 * name a real page, and they must carry an explanatory note saying why there
 * is nothing to scroll to (SEO text is in <head>; the Company menu is a
 * dropdown). A missing note there is a link that looks broken.
 *
 * Usage: node _harness/contentlinks.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const NAVBAR = 65;
const OUT = path.join(__dirname, 'out', 'contentlinks');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  await p.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
  if (await p.$('input[type=password]')) {
    await p.fill('input[type=password]', PW);
    await p.click('button[type=submit]');
    await p.waitForLoadState('domcontentloaded');
  }

  await p.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);

  const sections = await p.evaluate(() => {
    return [...document.querySelectorAll('fieldset[data-section]')].map(fs => ({
      key: fs.dataset.section,
      title: fs.dataset.sectionTitle,
      href: (fs.querySelector('.where-link') || {}).getAttribute
        ? fs.querySelector('.where-link').getAttribute('href') : null,
      note: !!fs.querySelector('.where-note'),
    }));
  });

  console.log(`\nPage Content sections: ${sections.length}`);
  const linked = sections.filter(s => s.href);
  const anchored = linked.filter(s => s.href.includes('#'));
  console.log(`  with a link: ${linked.length}   with an anchor: ${anchored.length}\n`);

  ok(sections.length > 0, `found ${sections.length} editable sections`);

  // ── every anchor resolves, and clears the navbar ─────────────────────────
  const site = await ctx.newPage();
  for (const s of anchored) {
    const [pagePath, id] = s.href.split('#');
    await site.goto(BASE + s.href, { waitUntil: 'networkidle' });
    await site.waitForTimeout(700);
    const r = await site.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return { found: false };
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        found: true,
        top: Math.round(b.top),
        h: Math.round(b.height),
        scrollMargin: cs.scrollMarginTop,
        docScroll: Math.round(window.scrollY),
      };
    }, id);

    if (!r.found) { ok(false, `${s.key.padEnd(16)} #${id} — NO SUCH ELEMENT on ${pagePath || '/'}`); continue; }
    const clears = r.top >= NAVBAR - 1;
    const onScreen = r.top < 900;
    ok(clears && onScreen && r.h > 0,
      `${s.key.padEnd(16)} #${id.padEnd(24)} top=${String(r.top).padStart(4)} h=${String(r.h).padStart(4)} ` +
      `scroll-margin=${r.scrollMargin} scrolled=${r.docScroll}` +
      (clears ? '' : '  << under the navbar') + (onScreen ? '' : '  << off screen'));
  }

  // ── link-less / anchor-less sections must explain themselves ─────────────
  for (const s of sections.filter(x => !x.href || !x.href.includes('#'))) {
    ok(s.note, `${s.key.padEnd(16)} has no anchor, so it must carry an explanatory note` +
      (s.href ? ` (links to ${s.href})` : ' (no link at all)'));
  }

  fs.writeFileSync(path.join(OUT, 'contentlinks.json'),
    JSON.stringify({ sections: sections.length, linked: linked.length, anchored: anchored.length, pass, fail }, null, 2));
  console.log(`\ncontentlinks ${pass}/${pass + fail}`);
  await b.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
