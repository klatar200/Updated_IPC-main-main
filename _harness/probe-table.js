/**
 * One-shot: why does the Action cell still clip its button under
 * table-layout: fixed, and which description cells are still tall?
 */
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });

  const r = await page.evaluate(() => {
    const table = document.querySelector('table');
    const firstRow = table.querySelector('tbody tr');
    const cells = [...firstRow.querySelectorAll('td')].map((td, i) => ({
      i,
      w: Math.round(td.getBoundingClientRect().width),
      scrollW: td.scrollWidth,
      pad: getComputedStyle(td).padding,
    }));
    const btn = firstRow.querySelector('td:last-child a, td:last-child button');
    const lastTd = firstRow.querySelector('td:last-child');
    const heads = [...table.querySelectorAll('thead th')].map((th) => ({
      label: th.textContent.trim().split(' ')[0],
      w: Math.round(th.getBoundingClientRect().width),
    }));
    // Tallest rows and what is in their description cell.
    const rows = [...table.querySelectorAll('tbody tr')]
      .map((tr) => ({
        h: Math.round(tr.getBoundingClientRect().height),
        name: tr.querySelector('td') ? tr.querySelector('td').textContent.trim().slice(0, 28) : '',
        descLen: tr.querySelectorAll('td')[3]
          ? tr.querySelectorAll('td')[3].textContent.trim().length : 0,
        specLen: tr.querySelectorAll('td')[5]
          ? tr.querySelectorAll('td')[5].textContent.trim().length : 0,
      }))
      .sort((a, b) => b.h - a.h)
      .slice(0, 6);
    // Per-cell heights of the tallest row — which column is driving it?
    const tallestTr = [...table.querySelectorAll('tbody tr')]
      .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    const tallestCells = [...tallestTr.querySelectorAll('td')].map((td, i) => ({
      i,
      h: Math.round(td.getBoundingClientRect().height),
      inner: Math.round((td.firstElementChild || td).getBoundingClientRect().height),
      text: td.textContent.trim().slice(0, 50),
    }));
    return {
      tallestCells,
      heads,
      cells,
      btnW: btn ? Math.round(btn.getBoundingClientRect().width) : null,
      btnScrollW: btn ? btn.scrollWidth : null,
      btnRight: btn ? Math.round(btn.getBoundingClientRect().right) : null,
      lastTdRight: lastTd ? Math.round(lastTd.getBoundingClientRect().right) : null,
      lastTdW: lastTd ? Math.round(lastTd.getBoundingClientRect().width) : null,
      tableRight: Math.round(table.getBoundingClientRect().right),
      tallest: rows,
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})();
