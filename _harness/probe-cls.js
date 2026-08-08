/**
 * One-shot: is the product photo's box reserved before the image loads, and
 * can the CLS probe in plan8-chrome.js report a non-zero number at all?
 *
 * A layout-shift observer that always reads 0.0000 is indistinguishable from
 * a page that never shifts, so this samples the element directly AND runs a
 * deliberately-shifting control.
 */
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';

const PROBE = `
  window.__ipcCLS = 0; window.__ipcShifts = 0; window.__ipcSources = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__ipcShifts++;
      if (e.hadRecentInput) continue;
      window.__ipcCLS += e.value;
      // WHICH node moved. Without this a CLS number tells you a page shifted
      // and nothing about what to fix — and it is how you find out the shift
      // you are chasing belongs to a different element entirely.
      for (const s of (e.sources || [])) {
        const n = s.node;
        window.__ipcSources.push({
          value: +e.value.toFixed(4),
          tag: n ? n.tagName : null,
          cls: n && typeof n.className === 'string' ? n.className.slice(0, 48) : null,
          id: n ? n.id : null,
          text: n ? (n.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 44) : null,
          from: s.previousRect ? Math.round(s.previousRect.top) + 'x' + Math.round(s.previousRect.height) : null,
          to: s.currentRect ? Math.round(s.currentRect.top) + 'x' + Math.round(s.currentRect.height) : null,
        });
      }
    }
  }).observe({ type: 'layout-shift', buffered: true });
`;

async function run(browser, width, url, control) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(PROBE);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  // 500 kbps, not 60. At 60 the 350 kB bundle never finishes and the app never
  // mounts, so every sample reads null and the control shift lands on an empty
  // body — a probe that reports 0.0000 for a page that does not exist.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: 500 * 1024 / 8, uploadThroughput: 500 * 1024 / 8,
  });

  const samples = [];
  await page.goto(url, { waitUntil: 'load' });
  for (const t of [300, 800, 1500, 3000, 6000]) {
    await page.waitForTimeout(t - (samples.length ? [300, 800, 1500, 3000, 6000][samples.length - 1] : 0));
    samples.push(await page.evaluate(() => {
      const i = [...document.querySelectorAll('img')].find((x) => /\/images\/products\//.test(x.currentSrc || x.src));
      const panel = [...document.querySelectorAll('div')].find((d) => /COMING SOON/i.test(d.textContent) && d.children.length < 5);
      const box = i ? i.getBoundingClientRect() : (panel ? panel.getBoundingClientRect() : null);
      return {
        h: box ? Math.round(box.height) : null,
        complete: i ? i.complete : null,
        natural: i ? `${i.naturalWidth}x${i.naturalHeight}` : null,
        cls: +window.__ipcCLS.toFixed(4),
        shifts: window.__ipcShifts,
        sources: window.__ipcSources,
        docH: document.documentElement.scrollHeight,
      };
    }));
  }

  if (control) {
    // Force a shift the observer must see, to prove it is wired up. Inserted
    // above <main>'s existing content so there is something to push down —
    // prepending to an empty body shifts nothing and proves nothing.
    await page.evaluate(() => {
      const host = document.querySelector('main') || document.body;
      const d = document.createElement('div');
      d.style.height = '400px';
      d.style.background = 'red';
      host.insertBefore(d, host.firstChild);
    });
    await page.waitForTimeout(600);
    samples.push({ control: true, cls: +(await page.evaluate(() => window.__ipcCLS)).toFixed(4),
                   shifts: await page.evaluate(() => window.__ipcShifts) });
  }
  await ctx.close();
  return samples;
}

(async () => {
  const browser = await launch();
  try {
    for (const [label, width, id, control] of [
      ['real photo @1440', 1440, 'CC', false],
      ['fallback @1440', 1440, 'IP13SP', false],
      ['fallback @390', 390, 'IP13SP', false],
    ]) {
      console.log('='.repeat(70));
      console.log(label);
      const s = await run(browser, width, `${BASE}/products?productId=${encodeURIComponent(id)}`, control);
      for (const x of s) console.log('  ' + JSON.stringify(x));
    }
  } finally {
    await browser.close();
  }
})();
