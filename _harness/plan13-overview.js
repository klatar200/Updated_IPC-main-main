/**
 * PLAN-13 Phase 8 — the Overview (admin/home.php), where sign-in now lands.
 *
 *   O1  signing in redirects to home.php, and so does opening auth.php while
 *       signed in; the logo links there and is the current-page marker on it
 *       (aria-current), and the bar still has six entries
 *   O2  the five cards are there: Inquiries, Server, Products, Recent
 *       changes, Shortcuts
 *   O3  Inquiries: the number equals the nav badge; the newest lead in the
 *       log is listed first, a spam-trap row never is; opening the Overview
 *       does not mark anything seen (the badge and .inquiries-seen.json are
 *       unchanged), opening Inquiries still does
 *   O4  Server: the same problem list as All Products (admin_health_problems()),
 *       and "No server problems found" only when that list is empty; with the
 *       password-reset flag present, its Close It Now form posts to index.php
 *       and closing from the Overview removes the flag
 *   O5  Products: "without a photo" equals All Products' Missing Photo stat,
 *       and each listed product links to its own upload page
 *   O6  Recent changes: the newest non-sign-in row of admin-log.jsonl comes
 *       first, and no sign-in row is listed
 *   O7  reading it writes nothing: admin/ and site-data/ are byte-identical
 *       after a GET
 *   O8  390 wide: no sideways scroll, every card on screen width
 *
 * Writes only to put things back: O3 appends two rows to the mirror's
 * inquiries.jsonl and O4 creates admin/ALLOW-PASSWORD-RESET; both, and the
 * seen-marker, are restored in a finally.
 * Usage: node _harness/plan13-overview.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { adminHttp } = require('./adminhttp');
const { launch } = require('./browser');

const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'audit-pass-123';
const SITE = path.join(__dirname, 'site');
const ADMIN = path.join(SITE, 'admin');
const INQ = path.join(ADMIN, 'inquiries.jsonl');
const SEEN = path.join(ADMIN, '.inquiries-seen.json');
const LOG = path.join(ADMIN, 'admin-log.jsonl');
const FLAG = path.join(ADMIN, 'ALLOW-PASSWORD-RESET');

let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}${!c && d ? `\n         → ${d}` : ''}`); };
const keep = (f) => (fs.existsSync(f) ? fs.readFileSync(f) : null);
const put = (f, buf) => { if (buf === null) fs.rmSync(f, { force: true }); else fs.writeFileSync(f, buf); };
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const section = (html, id) => { const i = html.indexOf(`id="${id}"`); return i < 0 ? '' : html.slice(i, html.indexOf('</section>', i)); };
const badge = (html) => +((/class="nav-badge"[^>]*>(\d+)</.exec(html) || [])[1] || 0);
const healthItems = (html) => {
  const m = /<div class="alert alert-error" role="alert"[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/.exec(html);
  return m ? [...m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((x) => text(x[1])) : [];
};
const snapshot = () => {
  const out = {};
  for (const d of [ADMIN, path.join(SITE, 'site-data')]) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isFile()) out[p] = fs.readFileSync(p).toString('base64');
    }
  }
  return out;
};

(async () => {
  const saved = { inq: keep(INQ), seen: keep(SEEN) };
  const a = adminHttp(PORT);
  let browser = null;
  try {
    console.log('\n── O1 sign-in lands on the Overview ──');
    const g = await a.req('GET', '/admin/auth.php');
    const li = await a.post('/admin/auth.php', [['password', PW], ['csrf_token', a.csrfOf(g.body)]]);
    ok(li.status === 302 && li.headers.location === 'home.php', 'signing in redirects to home.php', `${li.status} → ${li.headers.location}`);
    const again = await a.req('GET', '/admin/auth.php');
    ok(again.status === 302 && again.headers.location === 'home.php', 'auth.php while signed in redirects to home.php', `${again.status} → ${again.headers.location}`);
    const home = await a.req('GET', '/admin/home.php');
    ok(home.status === 200 && /<h1>Overview<\/h1>/.test(home.body), 'home.php renders the Overview', `status ${home.status}`);
    ok(/<a class="logo current" href="home.php"[^>]*aria-current="page"/.test(home.body), 'on the Overview the logo is the current-page marker (aria-current)');
    const idx = await a.req('GET', '/admin/index.php');
    ok(/<a class="logo" href="home.php"/.test(idx.body) && !/<a class="logo[^"]*"[^>]*aria-current/.test(idx.body), 'on All Products the logo links to the Overview and is not marked current');
    const tops = (home.body.match(/class="nav-top[ "]/g) || []).length;
    ok(tops === 6, `the bar still has six entries, not seven (${tops})`);

    console.log('\n── O2 the five cards ──');
    for (const [id, h] of [['ov-inquiries', 'Inquiries'], ['ov-server', 'Server'], ['ov-products', 'Products'], ['ov-changes', 'Recent changes'], ['ov-shortcuts', 'Shortcuts']]) {
      ok(new RegExp(`<h2 class="card-title" id="${id}-h">${h}`).test(home.body), `card "${h}"`);
    }

    console.log('\n── O3 Inquiries: counted like the badge, read without marking seen ──');
    {
      const stamp = new Date(Date.now() - 60000).toLocaleString('sv-SE', { timeZone: 'America/Chicago' });
      fs.appendFileSync(INQ, JSON.stringify({ ts: stamp, type: 'rfq', name: 'Overview Probe Buyer', company: 'Probe Co', email: 'ovprobe@example.com', part: 'IP33PO', sent: true }) + '\n');
      fs.appendFileSync(INQ, JSON.stringify({ ts: stamp, type: 'honeypot', name: 'Overview Spam Bot', email: 'bot@example.com', sent: false }) + '\n');
      const seenBefore = keep(SEEN);
      const h1 = (await a.req('GET', '/admin/home.php')).body;
      const card = section(h1, 'ov-inquiries');
      const n = +((/<span class="n[^"]*">(\d+)<\/span>/.exec(card) || [])[1] || -1);
      ok(n === badge(h1) && n >= 1, `the new count (${n}) equals the nav badge (${badge(h1)})`);
      const names = [...card.matchAll(/<span class="main"><strong>([^<]*)<\/strong>/g)].map((m) => m[1]);
      ok(names[0] === 'Overview Probe Buyer', `the newest lead is listed first (${names[0]})`);
      ok(!names.includes('Overview Spam Bot'), 'a spam-trap row is not listed');
      const h2 = (await a.req('GET', '/admin/home.php')).body;
      const seenAfter = keep(SEEN);
      ok(badge(h2) === badge(h1) && Buffer.compare(seenBefore || Buffer.alloc(0), seenAfter || Buffer.alloc(0)) === 0,
        'opening the Overview twice leaves the badge and the seen-marker alone', `badge ${badge(h1)} → ${badge(h2)}`);
      await a.req('GET', '/admin/inquiries.php', null, { 'Sec-Fetch-Site': 'same-origin' });
      ok(badge((await a.req('GET', '/admin/home.php')).body) === 0, 'opening Inquiries still clears it');
    }

    console.log('\n── O4 Server: the same list as All Products ──');
    {
      const hHome = healthItems((await a.req('GET', '/admin/home.php')).body);
      const hIdx = healthItems((await a.req('GET', '/admin/index.php')).body);
      ok(JSON.stringify(hHome) === JSON.stringify(hIdx), `the Overview and All Products list the same ${hIdx.length} problem(s)`, `${hHome.length} vs ${hIdx.length}`);
      const srv = section((await a.req('GET', '/admin/home.php')).body, 'ov-server');
      ok(hHome.length === 0 ? /No server problems found/.test(srv) : !/No server problems found/.test(srv) && srv.includes(`>${hHome.length}<`),
        hHome.length === 0 ? '"No server problems found" with an empty list' : 'the Server card counts the problems');
      fs.writeFileSync(FLAG, '');
      const withFlag = (await a.req('GET', '/admin/home.php')).body;
      // The comparison above may be of two empty lists; with the flag both
      // pages must raise it, and the Server card must stop saying all clear.
      const fHome = healthItems(withFlag), fIdx = healthItems((await a.req('GET', '/admin/index.php')).body);
      ok(fHome.length >= 1 && JSON.stringify(fHome) === JSON.stringify(fIdx) && fHome.some((t) => /password-reset window/i.test(t)),
        `with the flag, both pages list the same ${fHome.length} problem(s), the reset window among them`, `${fHome.length} vs ${fIdx.length}`);
      ok(!/No server problems found/.test(section(withFlag, 'ov-server')), 'and the Server card no longer says "No server problems found"');
      const form =/<form method="POST" action="([^"]*)"[^>]*>(?:(?!<\/form>)[\s\S])*close_reset_window/.exec(withFlag);
      ok(!!form && form[1] === 'index.php', 'with the reset flag present, its Close It Now form posts to index.php', form ? form[1] : 'no form');
      const close = await a.post('/admin/index.php', [['csrf_token', a.csrfOf(withFlag)], ['close_reset_window', '1']]);
      ok(close.status === 302 && !fs.existsSync(FLAG), 'closing it from the Overview removes the flag', `status ${close.status}, flag ${fs.existsSync(FLAG)}`);
    }

    console.log('\n── O5 Products: the same counts as All Products ──');
    {
      const h = (await a.req('GET', '/admin/home.php')).body;
      const idxB = (await a.req('GET', '/admin/index.php')).body;
      const stat = (lbl) => +((new RegExp(`<div class="stat-val">(\\d+)</div>\\s*<div class="stat-lbl">${lbl}</div>`).exec(idxB) || [])[1] || -1);
      const card = text(section(h, 'ov-products'));
      const photo = +((/(\d+) without a photo/.exec(card) || [])[1] || -2);
      const pdf = +((/(\d+) without a data sheet/.exec(card) || [])[1] || -2);
      ok(photo === stat('Missing Photo'), `"${photo} without a photo" equals Missing Photo (${stat('Missing Photo')})`);
      ok(pdf === stat('Missing PDF'), `"${pdf} without a data sheet" equals Missing PDF (${stat('Missing PDF')})`);
      const rows = [...section(h, 'ov-products').matchAll(/<li>[\s\S]*?<strong>([^<]+)<\/strong>[\s\S]*?<\/li>/g)];
      const linked = rows.every((m) => new RegExp(`upload-(image|pdf)\\.php\\?sku=${encodeURIComponent(m[1])}"`).test(m[0]));
      ok(rows.length > 0 ? linked : photo + pdf === 0, `each listed product links to its own upload page (${rows.length} listed)`);
    }

    console.log('\n── O6 Recent changes ──');
    {
      const lines = fs.readFileSync(LOG, 'utf8').trim().split(/\r?\n/).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const newest = [...lines].reverse().find((e) => !/^sign-(in|out|in-failed)$/.test(e.action));
      const card = section((await a.req('GET', '/admin/home.php')).body, 'ov-changes');
      const first = text((/<li>([\s\S]*?)<\/li>/.exec(card) || [])[1] || '');
      ok(!!newest && first.includes(String(newest.detail).slice(0, 30).replace(/&/g, '&')), `the newest change is first ("${first.slice(0, 60)}")`, newest && newest.detail);
      ok(!/Sign(ed)? ?in|sign-in/i.test(text(card).replace(/sign-ins are left out/i, '')), 'no sign-in row is listed');
    }

    console.log('\n── O7 reading it writes nothing ──');
    {
      const before = snapshot();
      await a.req('GET', '/admin/home.php');
      await a.req('GET', '/admin/home.php');
      const after = snapshot();
      const changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k]).map((k) => path.relative(SITE, k));
      ok(changed.length === 0, 'admin/ and site-data/ are byte-identical after two GETs', changed.join(', '));
    }

    console.log('\n── O8 on a phone ──');
    {
      browser = await launch();
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      await p.goto(BASE + '/admin/auth.php', { waitUntil: 'domcontentloaded' });
      await p.fill('input[type=password]', PW);
      await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('button[type=submit]')]);
      ok(/\/admin\/home\.php$/.test(p.url()), `a browser sign-in lands on ${new URL(p.url()).pathname}`);
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        wide: [...document.querySelectorAll('.ov-card')].filter((c) => c.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).map((c) => c.id) }));
      ok(m.sw <= m.cw && m.wide.length === 0, `390: no sideways scroll (${m.sw}/${m.cw}), every card inside the screen`, m.wide.join(', '));
      await ctx.close();
    }
  } catch (e) {
    ok(false, `crashed: ${e.message}`);
  } finally {
    if (browser) await browser.close();
    put(INQ, saved.inq); put(SEEN, saved.seen);
    fs.rmSync(FLAG, { force: true });
  }
  console.log(`\nplan13-overview ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})();
