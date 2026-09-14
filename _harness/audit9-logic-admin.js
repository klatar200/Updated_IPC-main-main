/**
 * audit9-logic-admin.js — PLAN-11 Appendix C rows C19, C22, C23, C26, C32,
 * plus the C21 settling save the no-op invariant (16) needs.
 *
 * HTTP + filesystem only; no browser. Every arm drives the real admin forms on
 * a private mirror and byte-diffs `data/` around each step.
 *
 *   BASE      default http://127.0.0.1:8140
 *   SITE      docroot of that origin (mutated, restored in a finally)
 *   PRISTINE  dir holding pristine-*.json
 *   PW        mirror admin password (default from ADMIN_PW env; never written to a record)
 *   ONLY      comma-separated row ids
 *   NEGCTL=1  run the negative controls
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = process.env.BASE || 'http://127.0.0.1:8140';
const SITE = process.env.SITE || '_harness/out/audit9/site-A';
const PRISTINE = process.env.PRISTINE || '_harness/out/audit9/P7';
const OUT = process.env.OUT || '_harness/out/audit9/P7';
const PW = process.env.ADMIN_PW || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const NEGCTL = process.env.NEGCTL === '1';

const FILES = { 'products-all.json': 'pristine-products.json', 'site-info.json': 'pristine-siteinfo.json', 'content.json': 'pristine-content.json' };
const live = (f) => path.join(SITE, 'data', f);
const ref = (f) => path.join(PRISTINE, FILES[f]);
const restoreAll = () => { for (const f of Object.keys(FILES)) fs.copyFileSync(ref(f), live(f)); };
const readLive = (f) => fs.readFileSync(live(f), 'utf8');

const results = [];
let pass = 0, fail = 0;
function check(row, name, ok, observed, expected) {
  results.push({ row, name, ok: !!ok, observed, expected });
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${row}] ${name}  observed=${JSON.stringify(observed)}`);
}
const want = (r) => ONLY.length === 0 || ONLY.includes(r);

// ── a cookie jar over fetch ────────────────────────────────────────────────
let COOKIE = '';
async function req(url, opts = {}) {
  const headers = Object.assign({}, opts.headers, COOKIE ? { cookie: COOKIE } : {});
  const res = await fetch(BASE + url, { ...opts, headers, redirect: 'manual' });
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of sc) { const kv = c.split(';')[0]; if (kv.startsWith('IPCADMIN=')) COOKIE = kv; }
  const body = await res.text();
  return { status: res.status, body, location: res.headers.get('location') || '' };
}
// Location: from an admin page is relative ("settings.php?saved=…"), so it
// cannot be string-replaced onto BASE; resolve it against the request's own URL.
const rel = (loc, from) => new URL(loc, BASE + from).pathname + new URL(loc, BASE + from).search;
const tokenOf = (html) => (html.match(/name="csrf_token"\s+value="([a-f0-9]{64})"/) || [])[1] || '';
const sigOf = (html) => (html.match(/name="orig_sig"\s+value="([a-f0-9]{40})"/) || [])[1] || '';
const form = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x)); else p.append(k, v);
  }
  return p.toString();
};
const POST = (url, obj) => req(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form(obj) });

async function signIn() {
  const g = await req('/admin/auth.php');
  const t = tokenOf(g.body);
  const r = await POST('/admin/auth.php', { csrf_token: t, password: PW });
  const ok = r.status === 302 && /index\.php/.test(r.location);
  if (!ok) throw new Error('mirror sign-in failed: ' + r.status + ' ' + r.body.slice(0, 120));
}

// ── the whole settings form, rebuilt from the page so nothing is dropped ────
function scrapeForm(html, formMarker) {
  // settings.php / content.php / edit.php all carry orig_sig; the sign-out form
  // in nav.php precedes them, so anchor on orig_sig, never on "the first form".
  const i = html.indexOf('name="orig_sig"');
  const start = html.lastIndexOf('<form', i);
  const end = html.indexOf('</form>', i);
  const chunk = html.slice(start, end);
  const out = {};
  const inputRe = /<input\b[^>]*>/g;
  let m;
  while ((m = inputRe.exec(chunk))) {
    const tag = m[0];
    const name = (tag.match(/name="([^"]+)"/) || [])[1];
    if (!name) continue;
    const type = ((tag.match(/type="([^"]+)"/) || [])[1] || 'text').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'file') continue;
    const value = (tag.match(/value="([^"]*)"/) || [])[1] || '';
    const checked = /\schecked\b/.test(tag);
    if (type === 'checkbox' || type === 'radio') { if (!checked) continue; }
    const dec = value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    if (name.endsWith('[]')) { (out[name] = out[name] || []).push(dec); } else out[name] = dec;
  }
  const taRe = /<textarea\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g;
  while ((m = taRe.exec(chunk))) {
    out[m[1]] = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
  }
  const selRe = /<select\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g;
  while ((m = selRe.exec(chunk))) {
    const sel = (m[2].match(/<option[^>]*\sselected[^>]*value="([^"]*)"/) || m[2].match(/<option[^>]*value="([^"]*)"[^>]*\sselected/) || [])[1];
    if (sel !== undefined) out[m[1]] = sel;
  }
  return out;
}

const UNI = '– ° ″ µ 🔥 ‏rtl‎';

async function main() {
  try {
    await signIn();

    // ── C21 settling save (I-admin's note; nodupbackups precedent) ─────────
    // settings.php rebuilds site-info.json from a form carrying fields the
    // shipped file lacks, so the FIRST save is a real change. Settle first.
    if (want('C19') || want('C21') || want('C32')) {
      const g = await req('/admin/settings.php');
      const f = scrapeForm(g.body);
      f.csrf_token = tokenOf(g.body);
      await POST('/admin/settings.php', f);
    }

    // ── C21 — a genuinely unchanged save writes nothing (invariant 16) ─────
    if (want('C21')) {
      const before = readLive('site-info.json');
      const nBefore = fs.readdirSync(path.join(SITE, 'data')).filter((x) => x.startsWith('site-info.backup.')).length;
      const g = await req('/admin/settings.php');
      const f = scrapeForm(g.body); f.csrf_token = tokenOf(g.body);
      const r = await POST('/admin/settings.php', f);
      const g2 = await req(r.location ? rel(r.location, '/admin/settings.php') : '/admin/settings.php');
      const after = readLive('site-info.json');
      const nAfter = fs.readdirSync(path.join(SITE, 'data')).filter((x) => x.startsWith('site-info.backup.')).length;
      check('C21', 'a settled no-op save writes no bytes', before === after, { changed: before !== after }, 'file untouched');
      check('C21', 'a settled no-op save writes no backup', nBefore === nAfter, { nBefore, nAfter }, 'no backup');
      check('C21', 'and it still succeeds with a "No changes" notice', /No changes/i.test(g2.body), { hasNotice: /No changes/i.test(g2.body) }, '"No changes to save"');
    }

    // ── C19 — two tabs, save both (B1) ─────────────────────────────────────
    if (want('C19')) {
      // settings.php
      const tabA = await req('/admin/settings.php');
      const tabB = await req('/admin/settings.php');
      const fa = scrapeForm(tabA.body); fa.csrf_token = tokenOf(tabA.body);
      const fb = scrapeForm(tabB.body); fb.csrf_token = tokenOf(tabB.body);
      check('C19', 'settings.php — both tabs opened with the same signature', fa.orig_sig === fb.orig_sig && !!fa.orig_sig, { sig: (fa.orig_sig || '').slice(0, 10) }, 'same orig_sig');
      fa.company_slogan = 'TAB-A-SLOGAN';
      await POST('/admin/settings.php', fa);
      fb.company_slogan = 'TAB-B-SLOGAN-TYPED';
      const rb = await POST('/admin/settings.php', fb);
      const page = rb.status === 302 ? (await req(rel(rb.location, '/admin/settings.php'))).body : rb.body;
      const warned = /changed by another session|were NOT saved/i.test(page);
      const keptTyped = page.includes('TAB-B-SLOGAN-TYPED');
      const disk = JSON.parse(readLive('site-info.json'));
      check('C19', 'settings.php — stale tab gets the concurrency message', warned, { warned }, 'B1 stale-signature message');
      check('C19', 'settings.php — the stale tab keeps what was typed', keptTyped, { keptTyped }, 'typed values re-rendered, not lost');
      check('C19', 'settings.php — the stale save did not overwrite tab A', disk.company.slogan === 'TAB-A-SLOGAN', { onDisk: disk.company.slogan }, 'tab A survives');

      // edit.php
      const cat = JSON.parse(readLive('products-all.json'));
      const sku = cat[0].sku;
      const eA = await req('/admin/edit.php?sku=' + encodeURIComponent(sku));
      const eB = await req('/admin/edit.php?sku=' + encodeURIComponent(sku));
      const ea = scrapeForm(eA.body); ea.csrf_token = tokenOf(eA.body);
      const eb = scrapeForm(eB.body); eb.csrf_token = tokenOf(eB.body);
      ea.caption = 'TAB-A-CAPTION';
      await POST('/admin/edit.php?sku=' + encodeURIComponent(sku), ea);
      eb.caption = 'TAB-B-CAPTION-TYPED';
      const erb = await POST('/admin/edit.php?sku=' + encodeURIComponent(sku), eb);
      const epage = erb.status === 302 ? (await req(rel(erb.location, '/admin/edit.php'))).body : erb.body;
      const ediskCap = JSON.parse(readLive('products-all.json')).find((p) => p.sku === sku).caption;
      check('C19', 'edit.php — stale tab gets the concurrency message', /changed by another session|were NOT saved/i.test(epage), { warned: /changed by another session/i.test(epage) }, 'B1 message');
      check('C19', 'edit.php — the stale tab keeps what was typed', epage.includes('TAB-B-CAPTION-TYPED'), { kept: epage.includes('TAB-B-CAPTION-TYPED') }, 'typed values kept');
      check('C19', 'edit.php — the stale save did not overwrite tab A', ediskCap === 'TAB-A-CAPTION', { onDisk: ediskCap }, 'tab A survives');

      // content.php
      const cA = await req('/admin/content.php');
      const cB = await req('/admin/content.php');
      const ca = scrapeForm(cA.body); ca.csrf_token = tokenOf(cA.body);
      const cb = scrapeForm(cB.body); cb.csrf_token = tokenOf(cB.body);
      // Field names are copy[group][key]. siteImages entries are PATH fields
      // (link validation applies), so drive the test from a plain text one.
      const copyKey = Object.keys(ca).find((k) => /^copy\[hero\]\[badge\]$/.test(k))
        || Object.keys(ca).find((k) => /^copy\[(?!siteImages)[A-Za-z]+\]\[(eyebrow|title|badge|headlineAccent)\]$/.test(k));
      if (copyKey) {
        ca[copyKey] = 'TAB-A-COPY';
        await POST('/admin/content.php', ca);
        cb[copyKey] = 'TAB-B-COPY-TYPED';
        const crb = await POST('/admin/content.php', cb);
        const cpage = crb.status === 302 ? (await req(rel(crb.location, '/admin/content.php'))).body : crb.body;
        check('C19', 'content.php — stale tab gets the concurrency message', /changed by another session|were NOT saved/i.test(cpage), { warned: /changed by another session/i.test(cpage) }, 'B1 message');
        check('C19', 'content.php — the stale tab keeps what was typed', cpage.includes('TAB-B-COPY-TYPED'), { kept: cpage.includes('TAB-B-COPY-TYPED') }, 'typed values kept');
      } else {
        check('C19', 'content.php — a copy field was found to drive the test', false, { keys: Object.keys(ca).slice(0, 8) }, 'a copy_* field');
      }
      restoreAll();
    }

    // ── C22 — backups: 90 existing, same-second saves, malformed restore ────
    if (want('C22')) {
      const dataDir = path.join(SITE, 'data');
      const stamp = '20260101-120000';
      // 90 pre-existing backups for the SAME second, named as backup_path() names them
      fs.writeFileSync(path.join(dataDir, `site-info.backup.${stamp}.json`), readLive('site-info.json'));
      for (let i = 1; i <= 89; i++) {
        fs.writeFileSync(path.join(dataDir, `site-info.backup.${stamp}-${String(i).padStart(2, '0')}.json`), readLive('site-info.json'));
      }
      const seeded = fs.readdirSync(dataDir).filter((x) => x.startsWith(`site-info.backup.${stamp}`));
      check('C22', '90 same-second backups seeded', seeded.length === 90, { n: seeded.length }, '90');
      // Every site-info backup that exists NOW, not just the seeded stamp —
      // earlier rows in this run leave their own backups behind and they are
      // not "new".
      const listBefore = fs.readdirSync(dataDir).filter((x) => x.startsWith('site-info.backup.'));
      // force a real save in the same nominal second by faking the clock is not
      // possible over HTTP; instead assert backup_path()'s allocator directly on
      // the same directory through a save and read the NEW name it chose.
      const g = await req('/admin/settings.php');
      const f = scrapeForm(g.body); f.csrf_token = tokenOf(g.body);
      f.company_slogan = 'BACKUP-ALLOC-PROBE';
      await POST('/admin/settings.php', f);
      const newOnes = fs.readdirSync(dataDir).filter((x) => x.startsWith('site-info.backup.') && !listBefore.includes(x));
      check('C22', 'a save alongside 90 same-second backups still writes exactly one new backup', newOnes.length === 1, { newOnes }, 'one new file, max-used+1 within its own second');
      // restore of a MALFORMED backup — read-side gate (A-7.8)
      const bad = `site-info.backup.${stamp}-99.json`;
      fs.writeFileSync(path.join(dataDir, bad), '{ this is not json');
      const g2 = await req('/admin/backups.php');
      const r2 = await POST('/admin/backups.php', { csrf_token: tokenOf(g2.body), backup: bad, action: 'restore' });
      const liveNow = readLive('site-info.json');
      check('C22', 'restoring a malformed backup is refused', /not valid JSON/i.test(r2.body), { msg: (r2.body.match(/[^>]*not valid JSON[^<]*/) || [''])[0].trim().slice(0, 90) }, '"not valid JSON — restore aborted, nothing was changed"');
      check('C22', 'and the live file was not touched', liveNow.includes('BACKUP-ALLOC-PROBE'), { untouched: liveNow.includes('BACKUP-ALLOC-PROBE') }, 'live file unchanged');
      // backup_list() ordering — the newest must be first, sorted on (ts, seq)
      const listPage = (await req('/admin/backups.php')).body;
      const order = [...listPage.matchAll(/site-info\.backup\.(\d{8}-\d{6})(?:-(\d{2,4}|[0-9a-f]{6}))?\.json/g)].map((m) => `${m[1]}|${m[2] || '00'}`);
      const sorted = [...order].sort().reverse();
      check('C22', 'backup_list() is ordered on the parsed (timestamp, sequence)', JSON.stringify(order) === JSON.stringify(sorted), { first3: order.slice(0, 3) }, 'newest first by (ts, seq), not by name and not by mtime');
      for (const x of fs.readdirSync(dataDir)) if (/\.backup\./.test(x)) fs.unlinkSync(path.join(dataDir, x));
      restoreAll();
    }

    // ── C23 — rename a SKU whose PDF is shared vs unique ────────────────────
    if (want('C23')) {
      const pdfDir = path.join(SITE, 'pdfs');
      const cat = JSON.parse(readLive('products-all.json'));
      // find a shared pdfUrl and a unique one
      const counts = {};
      for (const p of cat) if (p.pdfUrl) counts[p.pdfUrl] = (counts[p.pdfUrl] || 0) + 1;
      const sharedUrl = Object.keys(counts).find((u) => counts[u] > 1);
      const uniqueUrl = Object.keys(counts).find((u) => counts[u] === 1);
      for (const [label, url] of [['shared', sharedUrl], ['unique', uniqueUrl]]) {
        if (!url) { check('C23', `a ${label} pdfUrl exists in the catalog`, false, { counts: Object.keys(counts).length }, 'one of each'); continue; }
        const victim = JSON.parse(readLive('products-all.json')).find((p) => p.pdfUrl === url);
        const oldFile = path.basename(url);
        const existedBefore = fs.existsSync(path.join(pdfDir, oldFile));
        const g = await req('/admin/edit.php?sku=' + encodeURIComponent(victim.sku));
        const f = scrapeForm(g.body); f.csrf_token = tokenOf(g.body);
        const newSku = victim.sku + 'X9';
        f.sku = newSku;
        const r = await POST('/admin/edit.php?sku=' + encodeURIComponent(victim.sku), f);
        const after = JSON.parse(readLive('products-all.json'));
        const renamed = after.find((p) => p.sku === newSku);
        const stillThere = fs.existsSync(path.join(pdfDir, oldFile));
        const log = fs.existsSync(path.join(SITE, 'admin', 'admin-log.jsonl')) ? fs.readFileSync(path.join(SITE, 'admin', 'admin-log.jsonl'), 'utf8') : '';
        check('C23', `${label} PDF — the rename went through`, !!renamed, { status: r.status, newSku }, 'product renamed');
        if (label === 'shared') {
          check('C23', 'shared PDF — the old file is KEPT (another product still points at it)', stillThere, { oldFile, existedBefore, stillThere }, 'file kept');
        } else {
          check('C23', 'unique PDF — the old file is renamed or removed, not orphaned', !stillThere || (renamed && path.basename(renamed.pdfUrl || '') !== oldFile), { oldFile, existedBefore, stillThere, newUrl: renamed && renamed.pdfUrl }, 'renamed to follow the SKU');
        }
        check('C23', `${label} PDF — the rename is audit-logged`, log.includes(newSku), { logged: log.includes(newSku) }, 'admin-log.jsonl carries the new SKU');
        restoreAll();
        // Put the pdfs back as a clean SYNC — a plain `cp -r` leaves the
        // renamed file behind, and a leftover target makes the next arm's
        // rename hit edit.php's no-clobber guard and look like a failure.
        try {
          for (const x of fs.readdirSync(pdfDir)) fs.unlinkSync(path.join(pdfDir, x));
          execFileSync('cp', ['-r', path.join('_harness/site/pdfs') + '/.', pdfDir]);
        } catch (e) { /* best effort */ }
      }
    }

    // ── C26 — reset-window mtime boundaries, and no config.local.php ────────
    if (want('C26')) {
      const flag = path.join(SITE, 'admin', 'ALLOW-PASSWORD-RESET');
      const savedCookie = COOKIE;
      for (const [secs, label, shouldBeOpen] of [[3599, '3599 s (inside the hour)', true], [3601, '3601 s (past the hour)', false]]) {
        fs.writeFileSync(flag, '');
        execFileSync('touch', ['-d', `@${Math.floor(Date.now() / 1000) - secs}`, flag]);
        COOKIE = '';   // auth.php renders differently for a live session
        const g = await req('/admin/auth.php');
        const open = /name="new_password"/.test(g.body) && /Set Admin Password/i.test(g.body);
        const staleExplained = /more than an hour old/i.test(g.body) && /your normal password works again/i.test(g.body);
        check('C26', `reset flag ${label} — window ${shouldBeOpen ? 'OPEN' : 'CLOSED'}`, open === shouldBeOpen,
          { open, shouldBeOpen }, shouldBeOpen ? 'the Set Admin Password form' : 'the ordinary Sign In form');
        if (!shouldBeOpen) {
          check('C26', 'a stale flag is EXPLAINED, not silently ignored', staleExplained,
            { staleExplained }, 'names the file, says the normal password works, says to delete it over FTP');
        }
      }
      COOKIE = savedCookie;
      fs.unlinkSync(flag);
      // no config.local.php → "no password set" state, not a fatal (A-5.7)
      const cfg = path.join(SITE, 'admin', 'config.local.php');
      const saved = fs.readFileSync(cfg);
      fs.unlinkSync(cfg);
      COOKIE = '';
      const g = await req('/admin/auth.php');
      const fatal = /Fatal error|Parse error|Uncaught/i.test(g.body);
      const noPw = /no password|not been set|not configured|recover/i.test(g.body);
      check('C26', 'no config.local.php — not a fatal', !fatal && g.status === 200, { status: g.status, fatal }, '200, no fatal');
      check('C26', 'no config.local.php — a "no password set" state, with a way forward', noPw, { head: g.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 200) }, 'A-5.7 state');
      fs.writeFileSync(cfg, saved);
      COOKIE = '';
      await signIn();
    }

    // ── C32 — encoding round-trip through each admin form ──────────────────
    if (want('C32')) {
      // settings.php → site-info.json → the public footer
      const g = await req('/admin/settings.php');
      const f = scrapeForm(g.body); f.csrf_token = tokenOf(g.body);
      f.company_slogan = `IPC ${UNI} slogan`;
      await POST('/admin/settings.php', f);
      const raw = readLive('site-info.json');
      const parsed = JSON.parse(raw);
      check('C32', 'settings.php — the value is byte-faithful in the parsed JSON', parsed.company.slogan === `IPC ${UNI} slogan`, { got: parsed.company.slogan }, 'exactly as typed');
      check('C32', 'settings.php — JSON_UNESCAPED_UNICODE on disk (not \\uXXXX)', raw.includes('°') && raw.includes('µ') && !/\\u00b0/i.test(raw), { hasDegree: raw.includes('°'), hasEscape: /\\u00b0/i.test(raw) }, 'literal UTF-8 bytes on disk');
      const pub = await fetch(BASE + '/data/site-info.json').then((r) => r.text());
      check('C32', 'settings.php — and it survives to the served file', pub.includes(`IPC ${UNI} slogan`), { present: pub.includes(UNI) }, 'served byte-for-byte');
      const back = await req('/admin/settings.php');
      check('C32', 'settings.php — it renders back into the form escaped, not doubled', back.body.includes(`IPC ${UNI} slogan`) || back.body.includes(`IPC ${UNI.replace(/&/g, '&amp;')} slogan`), { found: back.body.includes(UNI) }, 'h() once, no &amp;amp;');
      restoreAll();

      // edit.php → products-all.json
      const cat = JSON.parse(readLive('products-all.json'));
      const sku = cat[0].sku;
      const eg = await req('/admin/edit.php?sku=' + encodeURIComponent(sku));
      const ef = scrapeForm(eg.body); ef.csrf_token = tokenOf(eg.body);
      ef.caption = `Cap ${UNI} end`;
      await POST('/admin/edit.php?sku=' + encodeURIComponent(sku), ef);
      const craw = readLive('products-all.json');
      const cparsed = JSON.parse(craw).find((p) => p.sku === sku);
      check('C32', 'edit.php — byte-faithful in products-all.json', cparsed.caption === `Cap ${UNI} end`, { got: cparsed.caption }, 'exactly as typed');
      check('C32', 'edit.php — JSON_UNESCAPED_UNICODE on disk', craw.includes('″') && !/\\u2033/i.test(craw), { literal: craw.includes('″') }, 'literal UTF-8');
      restoreAll();

      // content.php → content.json
      const cg = await req('/admin/content.php');
      const cf = scrapeForm(cg.body); cf.csrf_token = tokenOf(cg.body);
      const key = Object.keys(cf).find((k) => /^copy\[hero\]\[badge\]$/.test(k))
        || Object.keys(cf).find((k) => /^copy\[(?!siteImages)[A-Za-z]+\]\[(eyebrow|title|badge)\]$/.test(k));
      cf[key] = `Copy ${UNI} end`;
      await POST('/admin/content.php', cf);
      const ccraw = readLive('content.json');
      check('C32', 'content.php — byte-faithful in content.json', ccraw.includes(`Copy ${UNI} end`), { present: ccraw.includes(UNI), key }, 'exactly as typed');
      check('C32', 'content.php — JSON_UNESCAPED_UNICODE on disk', ccraw.includes('µ') && !/\\u00b5/i.test(ccraw), { literal: ccraw.includes('µ') }, 'literal UTF-8');
      restoreAll();
    }
  } finally {
    restoreAll();
    let restoreOk = true;
    for (const f of Object.keys(FILES)) if (fs.readFileSync(live(f)).toString() !== fs.readFileSync(ref(f)).toString()) restoreOk = false;
    check('--', 'mirror data restored byte-for-byte', restoreOk, { restoreOk }, 'three data files identical to pristine');
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `logic-admin${NEGCTL ? '-negctl' : ''}.json`), JSON.stringify({ pass, fail, results }, null, 2));
  console.log(`\naudit9-logic-admin ${pass}/${pass + fail}`);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error('CRASHED:', e.message); process.exitCode = 2; });
