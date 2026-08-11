/**
 * PLAN-10 items 9 + 10 / AUDIT-10 A10-028 + A10-029 — the Help page must not
 * teach Rick something the dashboard does not do, or a spec shape that cannot
 * be right.
 *
 * A10-028 — box 2 of "The four-step sequence, visually" reads
 *   Edit / Paste in a / Photo URL
 * while numbered step 2 directly beneath it reads "Click Photo on the product
 * you just created and upload a picture from your computer ... The Add form
 * has no photo field". The same page says of the Photo URL field itself: "You
 * normally never type in this box." The diagram is the thing people read, and
 * it sends a non-technical owner off to find an image host.
 *
 * A10-029 — the worked size chart splits "Expanded Diameter" into Min | Max
 * and then prints a Max that is exactly HALF the Min on all three rows. The
 * numbers are right; the header is wrong. The catalog settles it: real
 * products use two sibling columns, Expanded Diameter and Recovered Diameter.
 *
 * READ THE SVG, NOT innerText. Inline <svg><text> is NOT in innerText, and
 * pass-7's first attempt at the A10-028 check reported this real finding as
 * "does not reproduce" because of exactly that. Every diagram assertion below
 * goes through svg.querySelectorAll('text') and textContent.
 *
 * The Min/Max check is deliberately conditional on the HEADER: a column that
 * is smaller than its neighbour is only wrong when something claims the pair
 * is a minimum and a maximum. Recovered < Expanded is correct physics and must
 * keep passing.
 *
 * Usage: node _harness/plan10-help.js        (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'plan10');
fs.mkdirSync(OUT, { recursive: true });

const VP = {
  'mobile-390': { width: 390, height: 844 },
  'tablet-834': { width: 834, height: 1112 },
  'tablet-1024': { width: 1024, height: 768 },
  'desktop-1440': { width: 1440, height: 900 },
};

const MEASURE = `(() => {
  // ── the diagram ────────────────────────────────────────────────────────
  const svgs = [...document.querySelectorAll('svg')];
  const diagram = svgs.find((s) => /four steps|Add Product/i.test(s.getAttribute('aria-label') || ''))
    || svgs.find((s) => [...s.querySelectorAll('text')].some((t) => /Add Product/i.test(t.textContent || '')));
  let diag = null;
  if (diagram) {
    const texts = [...diagram.querySelectorAll('text')].map((t) => (t.textContent || '').trim());
    // Group the box labels by their x anchor: each box's strings share an x.
    const byX = {};
    for (const t of diagram.querySelectorAll('text')) {
      const x = Math.round(parseFloat(t.getAttribute('x') || '0'));
      (byX[x] = byX[x] || []).push((t.textContent || '').trim());
    }
    diag = {
      ariaLabel: diagram.getAttribute('aria-label') || '',
      texts,
      boxes: Object.entries(byX).map(([x, v]) => ({ x: +x, text: v.join(' ') })).sort((a, b) => a.x - b.x),
      textCount: texts.length,
    };
  }

  // ── numbered step 2 of the same section ────────────────────────────────
  const steps = [...document.querySelectorAll('ol.steps')]
    .map((ol) => [...ol.children].map((li) => (li.textContent || '').replace(/\\s+/g, ' ').trim()))
    .find((arr) => arr.some((s) => /Add Product form/i.test(s)));

  // ── the "before you start" list ────────────────────────────────────────
  const beforeYouStart = [...document.querySelectorAll('.callout')]
    .map((c) => (c.textContent || '').replace(/\\s+/g, ' ').trim())
    .find((s) => /Before you start, have these ready/i.test(s)) || '';

  // ── every field-ref table, with its header structure ───────────────────
  const tables = [...document.querySelectorAll('table.field-ref')].map((t, i) => {
    const rows = [...t.querySelectorAll('tr')];
    const headerCells = rows.flatMap((r) => [...r.querySelectorAll('th')]).map((th) => ({
      text: (th.textContent || '').replace(/\\s+/g, ' ').trim(),
      colspan: parseInt(th.getAttribute('colspan') || '1', 10),
      rowspan: parseInt(th.getAttribute('rowspan') || '1', 10),
    }));
    const dataRows = rows.filter((r) => r.querySelector('td'))
      .map((r) => [...r.querySelectorAll('td')].map((td) => (td.textContent || '').trim()));
    return { i, headerCells, headerRowCount: rows.filter((r) => r.querySelector('th')).length, dataRows };
  });

  // ── the sub-column explanation row, wherever it lives ──────────────────
  let subColExplain = '';
  for (const t of document.querySelectorAll('table.field-ref tr')) {
    const c = [...t.children];
    if (c.length >= 2 && /Split into sub-columns/i.test(c[0].textContent || '')) {
      subColExplain = (c[1].textContent || '').replace(/\\s+/g, ' ').trim();
    }
  }

  return {
    diag, steps, beforeYouStart, tables, subColExplain,
    phpNotice: /(<b>|\\b)(Warning|Notice|Fatal error|Parse error|Deprecated)\\b/.test(document.body.innerHTML),
  };
})()`;

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `\n         <- ${detail}` : ''}`);
}

async function signIn(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  return page;
}

const num = (s) => {
  const m = String(s).match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
};

(async () => {
  const browser = await launch();
  const data = {};
  const consoleErrors = {};
  for (const vp of Object.keys(VP)) {
    const ctx = await browser.newContext({ viewport: VP[vp] });
    const page = await signIn(ctx);
    consoleErrors[vp] = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors[vp].push(m.text().slice(0, 120)); });
    page.on('pageerror', (e) => consoleErrors[vp].push('pageerror: ' + String(e).slice(0, 120)));
    await page.goto(`${BASE}/admin/help.php`, { waitUntil: 'networkidle' });
    await page.waitForSelector('table.field-ref', { state: 'attached' });
    await page.waitForTimeout(250);
    data[vp] = await page.evaluate(MEASURE);
    await ctx.close();
    process.stdout.write(`  · ${vp.padEnd(14)} ${data[vp].tables.length} tables, ` +
      `diagram ${data[vp].diag ? data[vp].diag.textCount + ' <text> nodes' : 'NOT FOUND'}\n`);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'help.json'), JSON.stringify({ data, consoleErrors }, null, 2));

  const d = data['desktop-1440'];

  // ═══════════════════════════════ item 9 — A10-028, the diagram ═════════
  console.log('\nitem 9 · A10-028 — the four-step diagram');

  note(!!d.diag && d.diag.textCount > 0,
    `the diagram is read as SVG <text> nodes, not innerText (${d.diag ? d.diag.textCount : 0} nodes)`,
    'pass-7 reported this finding as "does not reproduce" by using innerText, which omits inline SVG text');

  const allText = (d.diag ? d.diag.texts : []).join(' ');
  note(!/Photo URL/i.test(allText) && !/Paste in/i.test(allText),
    `no "Photo URL" or "Paste in" string survives in the diagram — ${JSON.stringify(allText.slice(0, 120))}`,
    'box 2 still teaches the abandoned hosted-URL workflow');

  // Box 2 is the one whose number circle is "2"; located by x-order, not index.
  const boxes = (d.diag ? d.diag.boxes : []).filter((b) => b.text.length > 2 && !/^[1-4]$/.test(b.text) && !/^→$/.test(b.text));
  const box2 = boxes[1];
  note(!!box2 && /upload|computer|photo/i.test(box2.text) && !/URL/i.test(box2.text),
    `box 2 describes uploading from the computer — ${JSON.stringify(box2 ? box2.text : null)}`,
    'the diagram must agree with numbered step 2 beneath it');

  const step2 = (d.steps || [])[1] || '';
  note(/upload a picture from your computer/i.test(step2),
    `numbered step 2 still describes uploading from the computer (unchanged) — ${JSON.stringify(step2.slice(0, 80))}`);

  note(!!box2 && !!step2 && /upload/i.test(box2.text) && /upload/i.test(step2),
    'the diagram and numbered step 2 now agree — both say upload');

  note(!!d.diag && !/Photo URL|Paste/i.test(d.diag.ariaLabel),
    `the SVG aria-label does not name the abandoned workflow — ${JSON.stringify(d.diag ? d.diag.ariaLabel : null)}`);

  note(!!d.diag && d.diag.ariaLabel.toLowerCase().includes('photo'),
    `the SVG aria-label matches the rendered boxes — ${JSON.stringify(d.diag ? d.diag.ariaLabel : null)}`,
    'the accessible name must name what box 2 now says');

  note(!/hosted link/i.test(d.beforeYouStart),
    `the "Before you start" list no longer asks for a hosted link — ${JSON.stringify(d.beforeYouStart.slice(0, 150))}`,
    'third instance of the same stale assumption');

  // ═══════════════════════════════ item 10 — A10-029, the size chart ═════
  console.log('\nitem 10 · A10-029 — the worked size chart');

  // The example chart is the one with an Expanded Diameter header.
  const chart = d.tables.find((t) => t.headerCells.some((h) => /Expanded/i.test(h.text)));
  note(!!chart, 'the worked size-chart example is on the page');

  if (chart) {
    note(chart.headerRowCount === 1,
      `it renders ONE flat header row, no colspan/rowspan sub-header (${chart.headerRowCount} header row(s))`,
      'the Min | Max split is what made the numbers read as a contradiction');
    const spanned = chart.headerCells.filter((h) => h.colspan > 1 || h.rowspan > 1);
    note(spanned.length === 0,
      `no header cell carries a colspan or rowspan (${spanned.length})`,
      spanned.map((h) => `${h.text} colspan=${h.colspan} rowspan=${h.rowspan}`).join(', '));

    const heads = chart.headerCells.map((h) => h.text);
    note(!heads.some((h) => /^Min$/i.test(h)) && !heads.some((h) => /^Max$/i.test(h)),
      `no Min / Max sub-header remains (${JSON.stringify(heads)})`);
    note(heads.some((h) => /Expanded Diameter/i.test(h)) && heads.some((h) => /Recovered Diameter/i.test(h)),
      `the headers use the catalog's own vocabulary — Expanded Diameter and Recovered Diameter (${JSON.stringify(heads)})`,
      'products-all.json uses these two as sibling columns on IP29CG, IP33PO, IP33TW, IP34SR and others');

    // Acceptance 3 — the three data rows are byte-identical to the audit's.
    const EXPECTED = [
      ['3/4"', '0.750"', '0.375"', '0.020"'],
      ['1"', '1.000"', '0.500"', '0.024"'],
      ['1-1/2"', '1.500"', '0.750"', '0.030"'],
    ];
    const got = chart.dataRows;
    note(JSON.stringify(got) === JSON.stringify(EXPECTED),
      `all three data rows are byte-identical to before — the numbers were always right (${got.length} rows)`,
      `expected ${JSON.stringify(EXPECTED)}\n            got      ${JSON.stringify(got)}`);

    // The real assertion: col3 < col2 is only a defect UNDER a Min/Max claim.
    const claimsMinMax = heads.some((h) => /^Min$/i.test(h)) && heads.some((h) => /^Max$/i.test(h));
    const inverted = got.filter((r) => r.length >= 3 && num(r[2]) < num(r[1]));
    note(!claimsMinMax,
      `0 rows print a "Max" below its "Min" — the pair is no longer labelled as a minimum and a maximum ` +
      `(${inverted.length} rows still have column 3 < column 2, which is correct for recovered vs expanded)`,
      'the header still claims Min | Max');
  }

  // The sub-column feature is real and must keep its explanation — but the
  // explanation must stop using Min/Max as its worked example.
  note(!!d.subColExplain, 'the "Split into sub-columns" explanation is still on the page (the feature is real — 16 spans in the catalog use it)');
  note(!!d.subColExplain && !/\bMin\b/i.test(d.subColExplain) && !/\bMax\b/i.test(d.subColExplain),
    `its worked example is no longer Min/Max — ${JSON.stringify(d.subColExplain.slice(0, 130))}`,
    'it taught the same shape the chart above it got wrong');

  // ═══════════════════════════════ both — the page still renders ═════════
  console.log('\nitems 9 + 10 · the page renders clean');
  for (const vp of Object.keys(VP)) {
    note(!data[vp].phpNotice, `${vp}: no PHP notice/warning in the rendered HTML`);
    note(consoleErrors[vp].length === 0,
      `${vp}: no console errors (${consoleErrors[vp].length})`,
      consoleErrors[vp].slice(0, 2).join(' | '));
    note(!!data[vp].diag && data[vp].diag.textCount === (d.diag ? d.diag.textCount : -1),
      `${vp}: the diagram renders the same ${d.diag ? d.diag.textCount : '?'} <text> nodes`);
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-help ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'help.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
