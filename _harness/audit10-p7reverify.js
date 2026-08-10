/**
 * AUDIT-10 pass-7 step 7.3 — independent re-verification of every severity A
 * and B finding.
 *
 * The rule this file exists to enforce: each check below was written from the
 * finding record's OWN `reproduce` array and nothing else — not from the
 * measurement string, not from the probe that first found it, not from the
 * reviewing session's memory. Every check opens a FRESH browser context (and
 * for the admin ones, a fresh login) so no state leaks between findings or
 * between this run and the passes that produced them.
 *
 * A check reports:
 *   reproduces: true   the steps produce the stated phenomenon
 *   reproduces: false  they do not — the record drops to LIKELY/C per pass-7 7.3
 * plus the numbers it read, so the report can quote a second independent
 * measurement rather than repeating pass-1..6's.
 *
 * A10-027 mutates mirror data (it is a save journey). It runs only with
 * --journey, and the caller restores _harness/site/data/ from _harness/pristine/
 * afterwards; pass-7 does that and cmp-checks it.
 *
 * Output: _harness/out/audit10/p7/reverify.json
 * Usage:  node _harness/audit10-p7reverify.js [--journey]
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'audit10', 'p7');
fs.mkdirSync(OUT, { recursive: true });

const VP = {
  'desktop-1440': { width: 1440, height: 900 },
  'tablet-1024': { width: 1024, height: 768 },
  'tablet-834': { width: 834, height: 1112 },
  'mobile-390': { width: 390, height: 844 },
};

const results = [];
function record(id, reproduces, detail) {
  results.push({ id, reproduces, detail });
  const tag = reproduces === true ? 'REPRODUCES' : reproduces === false ? 'DOES NOT REPRODUCE' : 'INCONCLUSIVE';
  console.log(`${id}  ${tag}`);
  console.log('   ' + JSON.stringify(detail));
}

async function fresh(browser, vpName) {
  const ctx = await browser.newContext({ viewport: VP[vpName] });
  const page = await ctx.newPage();
  return { ctx, page };
}

async function freshAdmin(browser, vpName) {
  const { ctx, page } = await fresh(browser, vpName);
  await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', PASS);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.click('button[type="submit"], input[type="submit"]'),
    ]);
  }
  return { ctx, page };
}

// Painted text ranges of every text node inside an element, in page coords.
const INKFN = `
function _ink(el){
  const out=[];const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  let n;while((n=w.nextNode())){
    if(!n.nodeValue||!n.nodeValue.trim())continue;
    const r=document.createRange();r.selectNodeContents(n);
    for(const b of r.getClientRects()){if(b.width>0&&b.height>0)out.push({x:b.x,y:b.y,w:b.width,h:b.height,t:n.nodeValue.trim()});}
  }
  return out;
}
function _overlap(a,b){
  const x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
  const y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
  return (x>0.5&&y>0.5)?{x:Math.round(x*10)/10,y:Math.round(y*10)/10}:null;
}
`;

// playwright parses an evaluate() string starting with `function` as a function
// to CALL, so the helpers have to live INSIDE the evaluated IIFE, not beside it.
const inkEval = body => `(() => { ${INKFN}\nreturn (${body})(); })()`;

// ---------------------------------------------------------------- A10-001
// Steps: /dashboard at 1440x900; the cyan POLYOLEFIN HEAT SHRINK pill is
// painted over the description words on the IP29CG row.
async function a10_001(browser) {
  const { ctx, page } = await fresh(browser, 'desktop-1440');
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr');
  const r = await page.evaluate(inkEval(`() => {
    const rows=[...document.querySelectorAll('table tbody tr')];
    let pairs=0, worst=null, ip29=null;
    for(const tr of rows){
      const tds=[...tr.children];
      for(let i=0;i<tds.length-1;i++){
        const A=_ink(tds[i]), B=_ink(tds[i+1]);
        for(const a of A) for(const b of B){
          const o=_overlap(a,b);
          if(o){pairs++; if(!worst||o.x>worst.px){worst={px:o.x,left:a.t.slice(0,40),right:b.t.slice(0,40)};}}
        }
      }
      if(tr.textContent.includes('IP29CG')){
        const pill=tds[2]?_ink(tds[2])[0]:null;
        const desc=tds[3]?_ink(tds[3])[0]:null;
        if(pill&&desc) ip29={pill:pill.t,pillRight:Math.round((pill.x+pill.w)*10)/10,descTextOrigin:Math.round(desc.x*10)/10,
                             past:Math.round((pill.x+pill.w-desc.x)*10)/10,desc:desc.t.slice(0,50)};
      }
    }
    const ths=[...document.querySelectorAll('table thead th')].map(t=>({t:t.textContent.trim(),w:Math.round(t.getBoundingClientRect().width*10)/10}));
    return {rows:rows.length,pairs,worst,ip29,cols:ths};
  }`));
  await ctx.close();
  const ok = r.pairs > 0 && r.ip29 && r.ip29.past > 0;
  record('A10-001', ok, r);
}

// ---------------------------------------------------------------- A10-002
// Steps: /dashboard at 1024x768; DESCRIPTION and TEMP print on top of each
// other in the header; descriptions wrap one word per line.
async function a10_002(browser) {
  const { ctx, page } = await fresh(browser, 'tablet-1024');
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr');
  const r = await page.evaluate(inkEval(`() => {
    const ths=[...document.querySelectorAll('table thead th')];
    const cols=ths.map(t=>({t:t.textContent.trim(),w:Math.round(t.getBoundingClientRect().width*10)/10}));
    let headerOverlap=null;
    for(let i=0;i<ths.length-1;i++){
      const A=_ink(ths[i]),B=_ink(ths[i+1]);
      for(const a of A) for(const b of B){const o=_overlap(a,b); if(o&&(!headerOverlap||o.x>headerOverlap.px))
        headerOverlap={px:o.x,left:a.t,right:b.t};}
    }
    const desc=ths.findIndex(t=>/description/i.test(t.textContent));
    const firstDescCell=document.querySelector('table tbody tr')?.children[desc];
    const lines=firstDescCell?_ink(firstDescCell).length:null;
    return {tableWidth:Math.round(document.querySelector('table').getBoundingClientRect().width),
            cols,descColWidth:desc>=0?cols[desc].w:null,headerOverlap,
            firstDescCellLineBoxes:lines,docHeight:document.documentElement.scrollHeight};
  }`));
  await ctx.close();
  const ok = r.descColWidth !== null && r.descColWidth < 60 && !!r.headerOverlap;
  record('A10-002', ok, r);
}

// ---------------------------------------------------------------- A10-011
// Steps: /products?productId=CC at 390x844; Download PDF covers the eyebrow
// and Request Quote is printed across the title. Control at 834x1112.
async function a10_011(browser) {
  const out = {};
  for (const vp of ['mobile-390', 'tablet-834']) {
    const { ctx, page } = await fresh(browser, vp);
    await page.goto(BASE + '/products?productId=CC', { waitUntil: 'networkidle' });
    // state:'attached', not the default 'visible': at 390 the h1's own column
    // resolves to 0px, which is exactly the defect — a visible-wait would time out.
    await page.waitForSelector('h1', { state: 'attached' });
    await page.waitForTimeout(500);
    out[vp] = await page.evaluate(inkEval(`() => {
      const h1=[...document.querySelectorAll('h1')].pop();
      let strip=h1; while(strip&&!(strip.className&&String(strip.className).includes('justify-between'))) strip=strip.parentElement;
      if(!strip) return {error:'strip not found'};
      const kids=[...strip.children];
      const btns=[...strip.querySelectorAll('a,button')];
      const titleInk=_ink(kids[0]||h1);
      let overlaps=0,worst=null;
      for(const b of btns){
        const bb=b.getBoundingClientRect();
        for(const t of titleInk){
          const o=_overlap(t,{x:bb.x,y:bb.y,w:bb.width,h:bb.height});
          if(o){overlaps++; if(!worst||o.x>worst.px) worst={px:o.x,py:o.y,text:t.t.slice(0,40),button:b.textContent.trim().slice(0,30)};}
        }
      }
      return {stripInner:Math.round(strip.getBoundingClientRect().width*10)/10,
              leftCol:Math.round(kids[0].getBoundingClientRect().width*10)/10,
              rightCol:kids[1]?Math.round(kids[1].getBoundingClientRect().width*10)/10:null,
              h1Lines:_ink(h1).length,inkOverButtons:overlaps,worst};
    }`));
    await ctx.close();
  }
  const ok = out['mobile-390'] && out['mobile-390'].inkOverButtons > 0 &&
             out['mobile-390'].leftCol < 20 && out['tablet-834'].inkOverButtons === 0;
  record('A10-011', ok, out);
}

// ---------------------------------------------------------------- A10-012
// Steps: /contact at 390x844; press Submit with nothing filled in; the field
// is behind the navbar and its label is off-screen above it.
async function a10_012(browser) {
  const out = {};
  for (const vp of ['mobile-390', 'desktop-1440']) {
    const { ctx, page } = await fresh(browser, vp);
    await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
    await page.waitForSelector('form');
    const btn = await page.$('form button[type="submit"], form input[type="submit"]');
    await btn.click();
    await page.waitForTimeout(900);
    out[vp] = await page.evaluate(`(() => {
      const a=document.activeElement;
      const hdr=document.querySelector('header');
      const hb=hdr?hdr.getBoundingClientRect():null;
      const fb=a?a.getBoundingClientRect():null;
      const lab=a&&a.labels&&a.labels[0]?a.labels[0].getBoundingClientRect():null;
      const under=(fb&&hb)?Math.round((Math.min(fb.bottom,hb.bottom)-Math.max(fb.top,hb.top))*10)/10:null;
      return {active:a?a.name||a.tagName:null,
              msg:a&&a.validationMessage!==undefined?a.validationMessage:null,
              valueMissing:a&&a.validity?a.validity.valueMissing:null,
              headerBottom:hb?Math.round(hb.bottom*10)/10:null,
              headerPosition:hdr?getComputedStyle(hdr).position:null,
              fieldTop:fb?Math.round(fb.top*10)/10:null,fieldHeight:fb?Math.round(fb.height*10)/10:null,
              underHeaderPx:under,fullyHidden:!!(fb&&hb&&under>=fb.height-0.6),
              labelTop:lab?Math.round(lab.top*10)/10:null,
              scrollMarginTop:a?getComputedStyle(a).scrollMarginTop:null,
              scrollY:Math.round(window.scrollY)};
    })()`);
    await ctx.close();
  }
  const ok = !!(out['mobile-390'] && out['mobile-390'].fullyHidden && out['desktop-1440'].fullyHidden);
  record('A10-012', ok, out);
}

// ---------------------------------------------------------------- A10-021
// Steps: sign in at 390x844; the first nav row is sliced by the top of the
// page; the last row sits below the blue bar in white on the light page.
async function a10_021(browser) {
  const { ctx, page } = await freshAdmin(browser, 'mobile-390');
  await page.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(`(() => {
    function parse(c){const m=c.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const p=m[1].split(',').map(Number);
      return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};}
    function over(f,b){return {r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1};}
    function lum(c){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
      return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);}
    function ratio(f,b){const L1=lum(f),L2=lum(b);const a=Math.max(L1,L2),z=Math.min(L1,L2);
      return Math.round(((a+0.05)/(z+0.05))*100)/100;}
    const hdr=document.querySelector('.ipc-admin-header');
    const hb=hdr.getBoundingClientRect();
    const nav=hdr.querySelector('nav');
    const nb=nav?nav.getBoundingClientRect():null;
    const bodyBg=parse(getComputedStyle(document.body).backgroundColor)||{r:255,g:255,b:255,a:1};
    const hdrBg=parse(getComputedStyle(hdr).backgroundColor)||bodyBg;
    const links=[...(nav?nav.querySelectorAll('a,button'):[])].map(a=>{
      const b=a.getBoundingClientRect();
      const belowBar=b.bottom>hb.bottom+1;
      const aboveDoc=b.top<0;
      const fg=parse(getComputedStyle(a).color);
      const bg=belowBar?bodyBg:hdrBg;
      return {text:a.textContent.trim().slice(0,22),top:Math.round(b.top*10)/10,bottom:Math.round(b.bottom*10)/10,
              aboveDoc,belowBar,contrast:fg?ratio(over(fg,bg),bg):null};
    });
    return {headerHeight:Math.round(hb.height),headerOverflow:getComputedStyle(hdr).overflow,
            navTop:nb?Math.round(nb.top*10)/10:null,navHeight:nb?Math.round(nb.height*10)/10:null,
            linkCount:links.length,
            clippedAboveDoc:links.filter(l=>l.aboveDoc).map(l=>l.text),
            belowBar:links.filter(l=>l.belowBar).map(l=>({t:l.text,c:l.contrast})),
            links};
  })()`);
  await ctx.close();
  const ok = r.clippedAboveDoc.length > 0 && r.belowBar.some(l => l.c !== null && l.c < 3);
  record('A10-021', ok, { headerHeight: r.headerHeight, headerOverflow: r.headerOverflow,
    navTop: r.navTop, navHeight: r.navHeight, linkCount: r.linkCount,
    clippedAboveDoc: r.clippedAboveDoc, belowBar: r.belowBar });
}

// ---------------------------------------------------------------- A10-020
// Steps: sign in at 1440x900, land on /admin/index.php, look at the right-hand
// end of any product row; the Delete button is sliced at the table edge and
// nothing scrolls it into view.
// (Re-verified in pass-7 because 7.4 promoted this record C -> B.)
async function a10_020(browser) {
  const out = {};
  for (const vp of ['desktop-1440', 'tablet-1024', 'mobile-390']) {
    const { ctx, page } = await freshAdmin(browser, vp);
    await page.goto(BASE + '/admin/index.php', { waitUntil: 'domcontentloaded' });
    out[vp] = await page.evaluate(`(() => {
      const table=document.querySelector('table');
      const row=document.querySelector('table tbody tr');
      if(!row) return {error:'no product rows'};
      const cell=row.children[row.children.length-1];
      const btns=[...cell.querySelectorAll('a,button')].map(b=>{
        const r=b.getBoundingClientRect();
        return {text:b.textContent.trim().slice(0,14),left:Math.round(r.left),right:Math.round(r.right),w:Math.round(r.width)};
      });
      let wrap=table.parentElement, canScroll=null, contentRight=null;
      while(wrap&&wrap!==document.body){
        const o=getComputedStyle(wrap).overflowX;
        if(o==='auto'||o==='scroll'||o==='hidden'){
          const r=wrap.getBoundingClientRect();
          canScroll=wrap.scrollWidth>wrap.clientWidth;
          contentRight=Math.round(r.left+wrap.clientWidth);
          break;
        }
        wrap=wrap.parentElement;
      }
      const last=btns[btns.length-1]||null;
      const clipped=(last&&contentRight!==null)?Math.max(0,last.right-contentRight):null;
      return {rowCount:document.querySelectorAll('table tbody tr').length,
              actionButtons:btns,contentRight,wrapCanScroll:canScroll,
              lastButton:last,clippedPx:clipped,
              visiblePx:last&&clipped!==null?Math.max(0,last.w-clipped):null};
    })()`);
    await ctx.close();
  }
  const d = out['desktop-1440'];
  const ok = !!(d && d.clippedPx > 0 && d.wrapCanScroll === false);
  record('A10-020', ok, out);
}

// ---------------------------------------------------------------- A10-022
// Steps: /admin/help.php at 390x844 signed in; the whole page scrolls sideways.
async function a10_022(browser) {
  const out = {};
  for (const vp of ['mobile-390', 'tablet-834', 'desktop-1440']) {
    const { ctx, page } = await freshAdmin(browser, vp);
    await page.goto(BASE + '/admin/help.php', { waitUntil: 'domcontentloaded' });
    out[vp] = await page.evaluate(`(() => {
      const d=document.documentElement;
      const wide=[...document.querySelectorAll('table')].filter(t=>{
        let p=t.parentElement,scroller=false;
        while(p&&p!==document.body){const o=getComputedStyle(p).overflowX;if(o==='auto'||o==='scroll'){scroller=true;break;}p=p.parentElement;}
        return !scroller && t.getBoundingClientRect().right > d.clientWidth+1;
      }).length;
      return {scrollWidth:d.scrollWidth,clientWidth:d.clientWidth,
              overflowX:d.scrollWidth-d.clientWidth,
              unwrappedTablesPastViewport:wide,
              tableCount:document.querySelectorAll('table').length};
    })()`);
    await ctx.close();
  }
  const ok = out['mobile-390'].overflowX > 100 && out['desktop-1440'].overflowX === 0;
  record('A10-022', ok, out);
}

// ---------------------------------------------------------------- A10-028
// Steps: /admin/help.php at 1440x900; compare box 2 of the visual diagram with
// numbered step 2 directly beneath it.
async function a10_028(browser) {
  const { ctx, page } = await freshAdmin(browser, 'desktop-1440');
  await page.goto(BASE + '/admin/help.php', { waitUntil: 'domcontentloaded' });
  // The diagram is an inline <svg>: its <text> nodes are NOT in innerText, so
  // read them explicitly. (The first attempt at this check used innerText and
  // wrongly returned "does not reproduce".)
  const r = await page.evaluate(`(() => {
    const wrap=[...document.querySelectorAll('.diagram-wrap')]
      .find(d=>/four-step sequence/i.test(d.textContent));
    const svg=wrap?wrap.querySelector('svg'):null;
    const boxText=svg?[...svg.querySelectorAll('text')].map(t=>t.textContent.trim()):[];
    const diagramString=boxText.join(' ');
    const steps=[...(wrap&&wrap.parentElement?wrap.parentElement.querySelectorAll('ol.steps li'):[])]
      .map(li=>li.textContent.replace(/\\s+/g,' ').trim());
    const body=document.body.textContent;
    return {diagramTextNodes:boxText,
            diagramSaysPasteURL:/Paste in a\\s*Photo URL/.test(diagramString),
            step2:steps[1]||null,
            stepSaysUploadFromComputer:/upload a picture from your computer/i.test(steps[1]||''),
            addFormHasNoPhotoField:/The Add form has no photo field/i.test(steps[1]||''),
            hostedLinkPhrase:/hosted link to a product photo/i.test(body),
            pageAlsoSaysNoHostingNeeded:/do not need Dropbox, Google Drive, or any image-hosting service/i.test(body),
            photoUrlFieldDocumentedAsNeverTyped:/You normally never type in this box/i.test(body)};
  })()`);
  await ctx.close();
  const ok = r.diagramSaysPasteURL && r.stepSaysUploadFromComputer && r.pageAlsoSaysNoHostingNeeded;
  record('A10-028', ok, r);
}

// ---------------------------------------------------------------- A10-029
// Steps: /admin/help.php signed in; read the example chart under EXPANDED
// DIAMETER.
async function a10_029(browser) {
  const { ctx, page } = await freshAdmin(browser, 'desktop-1440');
  await page.goto(BASE + '/admin/help.php', { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(`(() => {
    const tables=[...document.querySelectorAll('table')];
    const t=tables.find(x=>/EXPANDED DIAMETER/i.test(x.textContent)&&/MIN/i.test(x.textContent));
    if(!t) return {found:false};
    const rows=[...t.querySelectorAll('tr')].map(r=>[...r.children].map(c=>c.textContent.trim()));
    const num=s=>{const m=String(s).match(/[0-9]*\\.?[0-9]+/);return m?parseFloat(m[0]):null;};
    const bad=[];
    for(const r of rows.slice(1)){
      if(r.length<4) continue;
      const mn=num(r[1]),mx=num(r[2]);
      if(mn!==null&&mx!==null&&mx<mn) bad.push({row:r.join(' | '),min:mn,max:mx,ratio:Math.round((mx/mn)*1000)/1000});
    }
    return {found:true,tableIndex:tables.indexOf(t),rows,maxBelowMinRows:bad};
  })()`);
  await ctx.close();
  const ok = r.found && r.maxBelowMinRows.length >= 3;
  record('A10-029', ok, r);
}

// ---------------------------------------------------------------- A10-037
// Steps: read the ISO claims on /, /about, /products?productId=VALUE-ADDED,
// /dashboard and the footer badge.
async function a10_037(browser) {
  const urls = ['/', '/about', '/products?productId=VALUE-ADDED', '/dashboard'];
  const out = {};
  const all = new Set();
  for (const u of urls) {
    const { ctx, page } = await fresh(browser, 'desktop-1440');
    await page.goto(BASE + u, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    out[u] = await page.evaluate(`(() => {
      const hits=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      let n;while((n=w.nextNode())){
        const v=n.nodeValue;if(!v||!/ISO\\s*9001/i.test(v))continue;
        const el=n.parentElement;const b=el.getBoundingClientRect();
        const m=v.match(/ISO\\s*9001(:\\s*[0-9]{4})?/gi)||[];
        hits.push({strings:m.map(s=>s.replace(/\\s+/g,' ').trim()),tag:el.tagName,
                   visible:b.width>0&&b.height>0,text:v.trim().slice(0,90)});
      }
      return hits;
    })()`);
    for (const h of out[u]) for (const s of h.strings) all.add(s);
    await ctx.close();
  }
  const norm = [...all].map(s => s.replace(/\s+/g, '').toUpperCase());
  const distinct = [...new Set(norm)];
  const ok = distinct.length >= 3;
  record('A10-037', ok, { distinctClaims: distinct, perUrlCounts: Object.fromEntries(urls.map(u => [u, out[u].length])), raw: out });
}

// ---------------------------------------------------------------- A10-045
// Steps: / at 1440x900; inject the repalette style; the header's bottom border
// and the badge outline are still cyan; /dashboard chips still cyan-tinted.
const REPALETTE = `:root{--brand-primary:#8a1c5a!important;--brand-primary-rgb:138,28,90!important;--brand-dark:#3a1200!important;--brand-accent:#ff9d2e!important;--brand-accent-2:#d2691e!important}`;

async function a10_045(browser) {
  const out = {};
  for (const u of ['/', '/dashboard']) {
    const { ctx, page } = await fresh(browser, 'desktop-1440');
    await page.goto(BASE + u, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const before = await page.evaluate(`(() => {
      const h=document.querySelector('header');
      const cyanBorder=[...document.querySelectorAll('*')].filter(e=>/0,\\s*190,\\s*242|17,\\s*158,\\s*200/.test(getComputedStyle(e).borderColor)).length;
      const cyanBg=[...document.querySelectorAll('*')].filter(e=>/rgba\\((0,\\s*190,\\s*242|17,\\s*158,\\s*200)/.test(getComputedStyle(e).backgroundColor)).length;
      return {headerBorderBottom:h?getComputedStyle(h).borderBottomColor:null,cyanBorderEls:cyanBorder,cyanBgEls:cyanBg,
              brandPrimary:getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim(),
              brandAccentRgbVar:getComputedStyle(document.documentElement).getPropertyValue('--brand-accent-rgb').trim()};
    })()`);
    await page.addStyleTag({ content: REPALETTE });
    await page.waitForTimeout(400);
    const after = await page.evaluate(`(() => {
      const h=document.querySelector('header');
      const cyanBorder=[...document.querySelectorAll('*')].filter(e=>/0,\\s*190,\\s*242|17,\\s*158,\\s*200/.test(getComputedStyle(e).borderColor)).length;
      const cyanBg=[...document.querySelectorAll('*')].filter(e=>/rgba\\((0,\\s*190,\\s*242|17,\\s*158,\\s*200)/.test(getComputedStyle(e).backgroundColor)).length;
      return {headerBorderBottom:h?getComputedStyle(h).borderBottomColor:null,cyanBorderEls:cyanBorder,cyanBgEls:cyanBg,
              brandPrimary:getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim()};
    })()`);
    out[u] = { before, after,
      varActuallyMoved: before.brandPrimary !== after.brandPrimary,
      cyanSurvived: after.cyanBorderEls > 0 || after.cyanBgEls > 0 };
    await ctx.close();
  }
  const ok = out['/'].varActuallyMoved && out['/'].cyanSurvived && out['/dashboard'].cyanSurvived;
  record('A10-045', ok, out);
}

// ---------------------------------------------------------------- A10-046
// Steps: /products?productId=IP38FE at 1440x900; inject the repalette style;
// the product header now fades from the original navy into magenta.
async function a10_046(browser) {
  const out = {};
  for (const u of ['/products?productId=IP38FE', '/industries']) {
    const { ctx, page } = await fresh(browser, 'desktop-1440');
    await page.goto(BASE + u, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const grab = `(() => {
      const els=[...document.querySelectorAll('*')].filter(e=>/linear-gradient/.test(getComputedStyle(e).backgroundImage));
      return els.slice(0,12).map(e=>getComputedStyle(e).backgroundImage);
    })()`;
    const before = await page.evaluate(grab);
    await page.addStyleTag({ content: REPALETTE });
    await page.waitForTimeout(400);
    const after = await page.evaluate(grab);
    const stops = s => (s.match(/rgba?\([^)]+\)/g) || []);
    const frozen = [];
    for (let i = 0; i < Math.min(before.length, after.length); i++) {
      const b = stops(before[i]), a = stops(after[i]);
      if (before[i] === after[i]) continue;                 // whole gradient unmoved -> not this finding
      for (let s = 0; s < Math.min(b.length, a.length); s++) {
        if (b[s] === a[s]) frozen.push({ el: i, stop: s, color: b[s], before: before[i], after: after[i] });
      }
    }
    out[u] = { gradientsSampled: before.length, frozenStopsInChangedGradients: frozen.length, examples: frozen.slice(0, 3) };
    await ctx.close();
  }
  const ok = out['/products?productId=IP38FE'].frozenStopsInChangedGradients > 0;
  record('A10-046', ok, out);
}

// ---------------------------------------------------------------- A10-056
// Steps: /products at 1440x900; scroll to y=1200; click a product card; press
// Back; read window.scrollY.
async function a10_056(browser) {
  const out = {};
  for (const vp of ['desktop-1440', 'mobile-390']) {
    const { ctx, page } = await fresh(browser, vp);
    await page.goto(BASE + '/products', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const restoration = await page.evaluate('history.scrollRestoration');
    await page.evaluate('window.scrollTo(0,1200)');
    await page.waitForTimeout(600);
    const before = await page.evaluate('Math.round(window.scrollY)');
    // Pick a card whose centre the card itself actually owns (elementFromPoint),
    // then click with a real mouse there — a selector click gets intercepted by
    // the sticky RFQ bar on some rows.
    const card = await page.evaluate(`(() => {
      for(const a of document.querySelectorAll('a[href*="productId="]')){
        const b=a.getBoundingClientRect();
        if(b.top<60||b.bottom>window.innerHeight-80||b.width<40) continue;
        const x=b.x+b.width/2, y=b.y+b.height/2;
        const hit=document.elementFromPoint(x,y);
        if(hit&&a.contains(hit)) return {href:a.getAttribute('href'),x:Math.round(x),y:Math.round(y)};
      }
      return null;
    })()`);
    if (!card) { out[vp] = { error: 'no clickable product card' }; await ctx.close(); continue; }
    await page.mouse.click(card.x, card.y);
    await page.waitForTimeout(2000);
    const onProduct = await page.evaluate('({url:location.pathname+location.search,y:Math.round(window.scrollY)})');
    await page.goBack();
    await page.waitForTimeout(2800);
    const afterBack = await page.evaluate('({url:location.pathname+location.search,y:Math.round(window.scrollY)})');
    out[vp] = { scrollRestoration: restoration, before, clicked: card.href, onProduct, afterBack,
                restored: Math.abs(afterBack.y - before) < 200 };
    await ctx.close();
  }
  const ok = out['desktop-1440'].restored === false;
  record('A10-056', ok, out);
}

// ---------------------------------------------------------------- A10-027
// Steps: sign in, open /admin/content.php, change a Privacy Policy field, press
// Save Content, open /admin/audit-log.php and read the newest row.
// MUTATES MIRROR DATA — caller restores from _harness/pristine/.
async function a10_027(browser) {
  const { ctx, page } = await freshAdmin(browser, 'desktop-1440');
  await page.goto(BASE + '/admin/content.php', { waitUntil: 'domcontentloaded' });
  const target = await page.evaluate(`(() => {
    const f=[...document.querySelectorAll('input[name],textarea[name]')]
      .find(e=>/privacy/i.test(e.name) && e.type!=='hidden');
    return f?{name:f.name,tag:f.tagName,value:f.value}:null;
  })()`);
  if (!target) { await ctx.close(); return record('A10-027', null, { error: 'no privacy field found on content.php' }); }
  const marker = 'AUDIT10 PASS7 REVERIFY';
  await page.fill(`[name="${target.name.replace(/"/g, '\\"')}"]`, marker);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"], input[type="submit"]'),
  ]);
  await page.waitForTimeout(800);
  await page.goto(BASE + '/admin/audit-log.php', { waitUntil: 'domcontentloaded' });
  const row = await page.evaluate(`(() => {
    const tr=document.querySelector('table tbody tr');
    return tr?[...tr.children].map(c=>c.textContent.trim()):null;
  })()`);
  await ctx.close();
  const ok = !!row && row.join(' | ').toLowerCase().includes('homepage');
  record('A10-027', ok, { editedField: target.name, editedTo: marker, newestLogRow: row });
}

(async () => {
  const browser = await launch();
  const journey = process.argv.includes('--journey');
  const checks = [a10_001, a10_002, a10_011, a10_012, a10_020, a10_021, a10_022,
                  a10_028, a10_029, a10_037, a10_045, a10_046, a10_056];
  for (const fn of checks) {
    try { await fn(browser); }
    catch (e) { record(fn.name.replace(/^a10_/, 'A10-'), null, { error: String(e).slice(0, 300) }); }
  }
  if (journey) {
    try { await a10_027(browser); }
    catch (e) { record('A10-027', null, { error: String(e).slice(0, 300) }); }
  } else {
    console.log('A10-027  SKIPPED (mutating journey — re-run with --journey)');
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'reverify.json'), JSON.stringify(results, null, 2));
  const rep = results.filter(r => r.reproduces === true).length;
  const no = results.filter(r => r.reproduces === false).length;
  const inc = results.filter(r => r.reproduces === null).length;
  console.log(`\nre-verified ${results.length}: ${rep} reproduce, ${no} do not, ${inc} inconclusive`);
  console.log('-> ' + path.join(OUT, 'reverify.json'));
})();
