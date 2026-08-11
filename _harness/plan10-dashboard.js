/**
 * PLAN-10 item 2 — /dashboard's Description column must stop being starved,
 * and nothing may paint on top of its neighbour.
 *
 * The defect (AUDIT-10 A10-001 desktop-1440 + A10-002 tablet-1024, cluster
 * `dashboard-fixed-columns`; the same mechanism is the C-severity A10-015 at
 * tablet-834): DASHBOARD_COLS declares a width for five of six columns and the
 * Action column takes 155, so 930px of the table is fixed and Description — the
 * one `width: null` track — takes "whatever is left" under
 * `table-layout: fixed`. That is generous at 1440 (300px) and ruinous below it:
 * 44px at 1024, 0px at 834. `table-layout: fixed` does not clip, so the starved
 * cells simply PAINT OVER the next column: the header renders as DESCRTIEMPON,
 * the first description cell takes 17 line boxes and the document grows to
 * 16,048px. Separately at 1440, the `nowrap` Part ID and Part Type cells escape
 * their own 105/115px tracks and print across their neighbours.
 *
 * What this suite asserts:
 *   1. every viewport — 0 painted-text overlap pairs between adjacent cells
 *   2. every viewport — the Description track is >= 220px
 *   3. 1024 / 834    — no header overlap; first description cell <= 4 line
 *                      boxes; document height < 7,000px
 *   4. 1024 / 834    — the table scrolls INSIDE its card and the page itself
 *                      gains no horizontal scroll
 *   5. desktop-1440  — every column width unchanged from the pre-fix baseline
 *   6. mobile-390    — the card list is unchanged (no table, cards identical
 *                      to the pre-fix baseline within 2px)
 *
 * 5 and 6 are the regression half. AUDIT-10 measured 1440's column geometry and
 * 390's card list as CORRECT; a fix that rescues the tablets by moving them has
 * broken something that worked.
 *
 * FONT. `fc-match system-ui` is DejaVu Sans on these boxes, ~21% wider than
 * Segoe UI, and has produced four false width findings in this repo (the C49
 * class). Every overlap count here is taken twice — as shipped and with the
 * document forced to Liberation Sans, which is metric-compatible with Arial.
 * The audited defect survives that control (30 pairs at 1440, header overprint
 * 71.2px at 1024), so these assertions are structural, not font artifacts.
 *
 * Usage: node _harness/plan10-dashboard.js            (needs :8123)
 *        node _harness/plan10-dashboard.js --save     re-capture the baseline
 *                                                     from an UNMODIFIED tree
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan10');
const BASELINE_FILE = path.join(__dirname, 'plan10-dashboard-baseline.json');
fs.mkdirSync(OUT, { recursive: true });

const SAVE = process.argv.includes('--save');

const VP = {
  'mobile-390': { width: 390, height: 844 },
  'tablet-834': { width: 834, height: 1112 },
  'tablet-1024': { width: 1024, height: 768 },
  'desktop-1440': { width: 1440, height: 900 },
};
/* The family views are measured too: AUDIT-10 recorded the same header
   overprint on all three it sampled, so a fix that only lands on the unfiltered
   index is not the fix.
   These are NOT the audit's three URLs. `?family=` filters on `partType`
   (src/App.jsx:9296), and the audit's `Heat Shrink Tubing` matches no product
   at all — its table held 0 rows, which is why its overprint count was already
   0 and why it proves nothing. `Tape` and `Adhesive` hold 1 row each. The two
   largest real part types are used here instead, with `Tape` kept for
   continuity with the audit's sample. */
const FAMILY_URLS = [
  '/dashboard?family=Accessory',                                       // 13 rows
  '/dashboard?family=' + encodeURIComponent('Polyolefin Heat Shrink'), // 12 rows
  '/dashboard?family=Tape',                                            // 1 row
];

const DRIFT_PX = 2;
const DESC_FLOOR = 220;   // PLAN-10 item 2 acceptance 2/3
const LINE_CAP = 4;       // PLAN-10 item 2 acceptance 2
const DOC_HEIGHT_CAP = 7000;

/* The ink walker is audit10-p7reverify.js's, copied rather than imported:
   §1.5 forbids editing the audit probes, and a suite that shares code with the
   thing it is meant to independently confirm is not independent. */
const MEASURE = `(() => {
  function ink(el){
    const out=[];const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    let n;while((n=w.nextNode())){
      if(!n.nodeValue||!n.nodeValue.trim())continue;
      const r=document.createRange();r.selectNodeContents(n);
      for(const b of r.getClientRects()){if(b.width>0&&b.height>0)out.push({x:b.x,y:b.y,w:b.width,h:b.height,t:n.nodeValue.trim()});}
    }
    return out;
  }
  function overlap(a,b){
    const x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
    const y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
    return (x>0.5&&y>0.5)?Math.round(x*10)/10:0;
  }
  const R=n=>Math.round(n*10)/10;
  const doc={
    docScroll:document.documentElement.scrollWidth,
    docClient:document.documentElement.clientWidth,
    docHeight:document.documentElement.scrollHeight,
  };

  // Below 640px the table is still in the DOM — its wrapper is display:none up
  // to the sm breakpoint — so presence is not the test. Visibility is.
  const table=[...document.querySelectorAll('table')].find(t=>t.checkVisibility());
  if(!table){
    /* mobile-390: the index is a card list. The cards carry no marker
       attribute, and matching on a Tailwind class string would let a className
       change silently reduce this to an empty set (which would then PASS), so
       each card is found by walking up from its own product link to the first
       ancestor that has at least five such siblings — i.e. the list row. */
    const cards=[];
    for(const a of document.querySelectorAll('a[href*="productId="]')){
      if(!a.checkVisibility()) continue;
      let el=a, card=null, guard=0;
      while(el&&el.parentElement&&guard++<12){
        const sibs=[...el.parentElement.children].filter(c=>c.querySelector('a[href*="productId="]'));
        if(sibs.length>=5&&sibs.includes(el)){card=el;break;}
        el=el.parentElement;
      }
      if(!card) continue;
      const id=decodeURIComponent((a.getAttribute('href').match(/productId=([^&]+)/)||[])[1]||'');
      const r=card.getBoundingClientRect();
      if(!cards.some(c=>c.id===id)) cards.push({id,w:R(r.width),h:R(r.height)});
    }
    return {...doc, mode:'cards', cards, cardCount:cards.length};
  }

  const wrap=table.parentElement;
  const ths=[...table.querySelectorAll('thead th')];
  const cols=ths.map(t=>({t:t.textContent.replace(/\\s+/g,' ').trim().slice(0,20),w:R(t.getBoundingClientRect().width)}));
  let headerOverlap=null;
  for(let i=0;i+1<ths.length;i++){
    for(const a of ink(ths[i])) for(const b of ink(ths[i+1])){
      const o=overlap(a,b);
      if(o&&(!headerOverlap||o>headerOverlap.px)) headerOverlap={px:o,left:a.t,right:b.t};
    }
  }
  let pairs=0, worst=null;
  for(const tr of table.querySelectorAll('tr')){
    const cells=[...tr.children];
    const inks=cells.map(c=>ink(c));
    for(let i=0;i+1<cells.length;i++){
      let hit=false;
      for(const a of inks[i]) for(const b of inks[i+1]){
        const o=overlap(a,b);
        if(o){hit=true; if(!worst||o>worst.px) worst={px:o,left:a.t.slice(0,34),right:b.t.slice(0,34)};}
      }
      if(hit) pairs++;
    }
  }
  const di=ths.findIndex(t=>/description/i.test(t.textContent));
  const firstDesc=table.querySelector('tbody tr')?.children[di];
  return {
    ...doc, mode:'table', cols,
    descW: di>=0?cols[di].w:null,
    headerOverlap, pairs, worst,
    descLines: firstDesc?ink(firstDesc).length:null,
    rows: table.querySelectorAll('tbody tr').length,
    tableW:R(table.getBoundingClientRect().width),
    wrapClient:R(wrap.clientWidth), wrapScroll:R(wrap.scrollWidth),
  };
})()`;

const FORCE = `*,*::before,*::after{font-family:"Liberation Sans",sans-serif!important}`;

const results = [];
function note(ok, msg, detail) {
  results.push({ ok, msg });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && detail ? `  <- ${detail}` : ''}`);
}

(async () => {
  const browser = await launch();
  const rows = {};

  for (const vp of Object.keys(VP)) {
    const ctx = await browser.newContext({ viewport: VP[vp] });
    const page = await ctx.newPage();
    rows[vp] = {};
    for (const url of ['/dashboard', ...FAMILY_URLS]) {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      // 'attached', not 'visible': while the defect is live the Description
      // track is 0px and a visibility wait would time out on the bug itself.
      try {
        await page.waitForSelector('[data-ipc-product-row]', { state: 'attached', timeout: 30000 });
      } catch (e) {
        throw new Error(`no product rows at ${vp} ${url}: ${e.message.split('\n')[0]}`);
      }
      await page.waitForTimeout(250);
      const shipped = await page.evaluate(MEASURE);
      await page.addStyleTag({ content: FORCE });
      await page.waitForTimeout(250);
      const liberation = await page.evaluate(MEASURE);
      rows[vp][url] = { shipped, liberation };
    }
    await ctx.close();
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT, 'dashboard.json'), JSON.stringify(rows, null, 1));

  if (SAVE) {
    const b = {
      _note:
        'Captured from the UNMODIFIED tree. desktop-1440 column widths and the ' +
        'mobile-390 card list are what AUDIT-10 measured as CORRECT; item 2 must ' +
        'leave both alone. A global px band is the wrong assertion here — the ' +
        'card heights vary per product — so "unchanged" means unchanged PER ITEM.',
      'desktop-1440': { cols: rows['desktop-1440']['/dashboard'].shipped.cols },
      'mobile-390': { cards: rows['mobile-390']['/dashboard'].shipped.cards },
    };
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(b, null, 1));
    console.log(`baseline saved -> ${BASELINE_FILE}`);
    process.exit(0);
  }

  const BASELINE = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  const main = (vp) => rows[vp]['/dashboard'];

  // ── 1. no cell paints on top of its neighbour, at any viewport, either face ─
  for (const vp of ['desktop-1440', 'tablet-1024', 'tablet-834']) {
    const { shipped, liberation } = main(vp);
    note(shipped.pairs === 0,
      `${vp}: 0 painted-text overlap pairs inside the table, shipped face (${shipped.rows} rows)`,
      `${shipped.pairs} pairs, worst ${shipped.worst ? `${shipped.worst.px}px "${shipped.worst.left}" x "${shipped.worst.right}"` : '—'}`);
    note(liberation.pairs === 0,
      `${vp}: 0 painted-text overlap pairs under Liberation Sans (the C49 control)`,
      `${liberation.pairs} pairs, worst ${liberation.worst ? `${liberation.worst.px}px "${liberation.worst.left}"` : '—'}`);
  }

  // ── 2. the Description track has a floor ─────────────────────────────────
  for (const vp of ['desktop-1440', 'tablet-1024', 'tablet-834']) {
    const s = main(vp).shipped;
    note(s.descW >= DESC_FLOOR,
      `${vp}: the Description track is ${s.descW}px (>= ${DESC_FLOOR})`,
      `${s.descW}px — the elastic track is being starved again`);
  }

  // ── 3. the tablets stop garbling ─────────────────────────────────────────
  for (const vp of ['tablet-1024', 'tablet-834']) {
    const s = main(vp).shipped;
    const l = main(vp).liberation;
    note(!s.headerOverlap && !l.headerOverlap,
      `${vp}: the column headers do not print on top of each other (either face)`,
      `shipped ${s.headerOverlap ? `${s.headerOverlap.px}px "${s.headerOverlap.left}" x "${s.headerOverlap.right}"` : 'none'}, ` +
      `Liberation ${l.headerOverlap ? `${l.headerOverlap.px}px` : 'none'}`);
    note(s.descLines !== null && s.descLines <= LINE_CAP,
      `${vp}: the first description cell renders on ${s.descLines} line boxes (<= ${LINE_CAP}, was 17)`,
      `${s.descLines} line boxes`);
    note(s.docHeight < DOC_HEIGHT_CAP,
      `${vp}: document height ${s.docHeight}px (< ${DOC_HEIGHT_CAP}, was 16,048)`,
      `${s.docHeight}px`);
  }

  // ── 4. the table scrolls inside its own card; the PAGE does not ──────────
  for (const vp of ['tablet-1024', 'tablet-834']) {
    const s = main(vp).shipped;
    note(s.wrapScroll > s.wrapClient,
      `${vp}: the table scrolls inside its card (scrollWidth ${s.wrapScroll} > clientWidth ${s.wrapClient})`,
      `scrollWidth ${s.wrapScroll} vs clientWidth ${s.wrapClient} — the table is being squeezed instead`);
    note(s.docScroll === s.docClient,
      `${vp}: the page itself gains no horizontal scroll (documentElement ${s.docScroll}/${s.docClient})`,
      `${s.docScroll} vs ${s.docClient} — ${s.docScroll - s.docClient}px of page overflow`);
  }

  // ── 3b. the family views carry the same fix ──────────────────────────────
  for (const vp of ['tablet-1024', 'tablet-834']) {
    const bad = FAMILY_URLS.filter((u) => rows[vp][u].shipped.headerOverlap || rows[vp][u].shipped.pairs > 0);
    note(bad.length === 0,
      `${vp}: the 3 /dashboard?family= views are clean too (no header overprint, 0 overlap pairs)`,
      bad.map((u) => `${u} hdr=${rows[vp][u].shipped.headerOverlap ? rows[vp][u].shipped.headerOverlap.px : 0} pairs=${rows[vp][u].shipped.pairs}`).join(' | '));
  }

  // ── 5. desktop-1440 column geometry is UNCHANGED ─────────────────────────
  {
    const now = main('desktop-1440').shipped.cols;
    const was = BASELINE['desktop-1440'].cols;
    const drift = now.length !== was.length
      ? [`column count ${was.length} -> ${now.length}`]
      : now.map((c, i) => (Math.abs(c.w - was[i].w) > DRIFT_PX ? `${was[i].t} ${was[i].w}->${c.w}` : null)).filter(Boolean);
    note(drift.length === 0,
      `desktop-1440: every column width is unchanged from the pre-fix baseline, within ${DRIFT_PX}px ` +
      `(${now.map((c) => c.w).join('/')})`,
      drift.join(', '));
  }

  // ── 6. mobile-390 is UNCHANGED — still a card list, cards identical ──────
  {
    const s = main('mobile-390').shipped;
    note(s.mode === 'cards',
      `mobile-390: the index is still a card list, not a table (${s.cardCount} cards)`,
      `mode=${s.mode}`);
    const was = BASELINE['mobile-390'].cards;
    const byId = new Map((s.cards || []).map((c) => [c.id, c]));
    const drift = was.filter((b) => {
      const n = byId.get(b.id);
      return !n || Math.abs(n.w - b.w) > DRIFT_PX || Math.abs(n.h - b.h) > DRIFT_PX;
    });
    note(drift.length === 0 && (s.cards || []).length === was.length,
      `mobile-390: all ${was.length} cards are unchanged from the pre-fix baseline, within ${DRIFT_PX}px`,
      drift.slice(0, 4).map((b) => {
        const n = byId.get(b.id);
        return n ? `${b.id} ${b.w}x${b.h} -> ${n.w}x${n.h}` : `${b.id} missing`;
      }).join(' | '));
    note(s.docScroll === s.docClient,
      `mobile-390: no page-level horizontal overflow (${s.docScroll}/${s.docClient})`,
      `${s.docScroll - s.docClient}px`);
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan10-dashboard ${results.length - bad}/${results.length}`);
  console.log(`record -> ${path.join(OUT, 'dashboard.json')}`);
  process.exit(bad === 0 ? 0 : 1);
})();
