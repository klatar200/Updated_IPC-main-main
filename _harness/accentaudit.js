/**
 * Where does --brand-accent-text actually land, and what does each site measure
 * at the shipped #119EC8 versus the derived #0d7594?
 *
 * Composites translucent backgrounds over the next opaque ancestor — the first
 * draft of this script did not, and reported a near-white chip as 1.69:1 by
 * treating rgba(17,158,200,0.1) as if it were opaque cyan.
 *
 * For a gradient it scores BOTH stops, because the worse one is what governs.
 *
 * Usage: node _harness/accentaudit.js
 */
const { launch } = require('./browser');
const BASE = 'http://127.0.0.1:8123';
const ROUTES = [['/about','About — service cards'],['/products','Products — page header'],['/dashboard','Product Index — type chips']];

const nums = (s) => (s.match(/[\d.]+/g) || []).map(Number);
const lum = ([r,g,b]) => { const f = (v) => { const x=v/255; return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const cr = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m); return (x+0.05)/(y+0.05); };
const over = (fg, bg) => { const a = fg.length > 3 ? fg[3] : 1; return [0,1,2].map(i => Math.round(fg[i]*a + bg[i]*(1-a))); };

(async () => {
  const browser = await launch();
  for (const [route, label] of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const found = await page.evaluate(() => {
      // Walk up collecting every painted layer until an OPAQUE one is reached.
      function stack(el) {
        const layers = []; let n = el;
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') { layers.push({ g: cs.backgroundImage }); return layers; }
          const c = cs.backgroundColor;
          if (c && !/rgba\(0, 0, 0, 0\)/.test(c)) {
            layers.push({ c });
            if (!/rgba\([^)]*,\s*0?\.\d+\)/.test(c)) return layers;   // opaque: stop
          }
          n = n.parentElement;
        }
        layers.push({ c: 'rgb(255, 255, 255)' });
        return layers;
      }
      const out = [];
      for (const el of document.querySelectorAll('*')) {
        const inline = el.getAttribute && el.getAttribute('style');
        if (!inline || !inline.includes('--brand-accent-text')) continue;
        if (el.tagName === 'TITLE') continue;
        out.push({ text: (el.textContent||'').trim().slice(0,28), fg: getComputedStyle(el).color, layers: stack(el) });
      }
      return out;
    });

    const seen = new Set();
    for (const f of found) {
      const key = f.text + JSON.stringify(f.layers);
      if (seen.has(key)) continue; seen.add(key);
      const fg = nums(f.fg);
      const grad = f.layers.find((l) => l.g);
      let verdict;
      if (grad) {
        const stops = (grad.g.match(/rgb\([^)]*\)/g) || []);
        verdict = stops.map((s) => `${s} = ${cr(fg, nums(s)).toFixed(2)}:1`).join('  |  ');
      } else {
        // composite from the bottom (opaque) layer upward
        let bg = nums(f.layers[f.layers.length - 1].c);
        for (let i = f.layers.length - 2; i >= 0; i--) bg = over(nums(f.layers[i].c), bg);
        verdict = `effective bg rgb(${bg.join(',')}) = ${cr(fg, bg).toFixed(2)}:1`;
      }
      console.log(`${label}\n   "${f.text}"  fg=${f.fg}\n   ${verdict}\n`);
    }
    await ctx.close();
  }
  await browser.close();
})();
