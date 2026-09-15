/**
 * A-9.P4-5 — the Product Index's Temp column must sort by temperature.
 *
 * Written BEFORE the fix and watched failing: the shipped comparator is
 * `localeCompare` on the raw string for every column, so ascending put
 * "-100°F to 500°F" first and "Up to 90°C" last, and the seven empty values
 * sorted to the top.
 *
 * Driven through the real table on the mirror rather than by calling the
 * comparator, because what the finding is about is the order a buyer sees.
 *
 * Needs the mirror on :8123. Usage: node _harness/audit9-tempsort.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = process.env.IPC_BASE || 'http://127.0.0.1:8123';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'audit9', 'C');
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products-all.json'), 'utf8'));

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

// The expected key, derived here independently of the implementation: every
// number in the string that carries a degree unit, converted to °C, maximum.
// If the fix and this disagree, one of them is wrong and the run says so.
const expectedCeiling = (raw) => {
  const s = String(raw || '');
  let max = null;
  for (const m of s.matchAll(/([+-]?\d+(?:\.\d+)?)\s*°?\s*([CF])\b/gi)) {
    const n = parseFloat(m[1]);
    const c = m[2].toUpperCase() === 'F' ? (n - 32) * 5 / 9 : n;
    if (max === null || c > max) max = c;
  }
  return max;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // The table renders a Part ID column and a Temp column; read both so a row
  // can be tied back to its record.
  const readRows = () => page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return null;
    const head = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    const iTemp = head.findIndex((h) => /^temp/i.test(h));
    const iId = head.findIndex((h) => /part id/i.test(h));
    if (iTemp < 0 || iId < 0) return null;
    return [...table.querySelectorAll('tbody tr')].map((tr) => {
      const td = tr.querySelectorAll('td');
      return { id: (td[iId] || {}).textContent?.trim(), temp: (td[iTemp] || {}).textContent?.trim() };
    });
  });

  const clickTemp = async () => {
    const th = page.locator('thead th', { hasText: /^Temp/ }).first();
    await th.click();
    await page.waitForTimeout(350);
  };

  const before = await readRows();
  note(Array.isArray(before) && before.length >= 40,
    `the Product Index table renders (${before ? before.length : 0} rows)`,
    JSON.stringify((before || []).slice(0, 2)));

  await clickTemp();
  const asc = await readRows();
  await clickTemp();
  const desc = await readRows();

  const keyed = (rows) => rows.map((r) => {
    const rec = products.find((p) => (p.sku || '').replace(/\s/g, '') === (r.id || '').replace(/\s/g, ''));
    return { ...r, c: expectedCeiling(rec ? rec.operatingTemp : r.temp === '—' ? '' : r.temp) };
  });

  const a = keyed(asc || []), d = keyed(desc || []);
  const withVal = (rows) => rows.filter((r) => r.c !== null);
  const blanks = (rows) => rows.filter((r) => r.c === null);

  // 1. ascending really ascends
  const aVals = withVal(a).map((r) => r.c);
  const aBad = aVals.findIndex((v, i) => i > 0 && v < aVals[i - 1]);
  note(aVals.length > 0 && aBad === -1,
    `ascending orders the ${aVals.length} rated products coolest ceiling first`,
    aBad === -1 ? '' : `row ${aBad} breaks it: ${withVal(a)[aBad - 1].id} ${Math.round(aVals[aBad - 1])}°C then ${withVal(a)[aBad].id} ${Math.round(aVals[aBad])}°C`);

  // 2. descending is its reverse
  const dVals = withVal(d).map((r) => r.c);
  const dBad = dVals.findIndex((v, i) => i > 0 && v > dVals[i - 1]);
  note(dVals.length > 0 && dBad === -1,
    'descending orders them hottest ceiling first',
    dBad === -1 ? '' : `row ${dBad} breaks it: ${withVal(d)[dBad - 1].id} ${Math.round(dVals[dBad - 1])}°C then ${withVal(d)[dBad].id} ${Math.round(dVals[dBad])}°C`);

  // 3. the unrated rows sort LAST in both directions — an empty cell is not a
  //    temperature of zero, and it is not the coolest part in the catalog.
  const lastN = (rows, n) => rows.slice(rows.length - n);
  const nBlank = blanks(a).length;
  note(nBlank > 0 && lastN(a, nBlank).every((r) => r.c === null),
    `the ${nBlank} products with no rating sort last ascending`,
    JSON.stringify(a.map((r) => (r.c === null ? r.id : null)).filter(Boolean)));
  note(nBlank > 0 && lastN(d, nBlank).every((r) => r.c === null),
    `the ${nBlank} products with no rating sort last descending too`,
    JSON.stringify(d.map((r) => (r.c === null ? r.id : null)).filter(Boolean)));

  // 4. the named worked example from the record, stated as a consequence a
  //    buyer would notice rather than as an index
  const pos = (rows, id) => rows.findIndex((r) => (r.id || '').replace(/\s/g, '') === id.replace(/\s/g, ''));
  const hot = 'IP64FS-IP65VC-IP66AC-IP67SC', cool = 'IP46MD';
  note(pos(a, hot) > pos(a, cool),
    `ascending puts ${cool} (90°C) before ${hot} (1200°F)`,
    `${cool} at ${pos(a, cool)}, ${hot} at ${pos(a, hot)}`);

  fs.writeFileSync(path.join(OUT, 'tempsort.json'),
    JSON.stringify({ asc: a, desc: d }, null, 2));
  await ctx.close();
  await browser.close();

  const pass = results.filter((x) => x.ok).length;
  console.log(`\naudit9-tempsort ${pass}/${results.length}`);
  process.exit(pass === results.length ? 0 : 1);
})();
