/**
 * PLAN-13 Phase 6 — Inquiries, Audit Log and Backups (§2 F1–F3).
 *
 *   I1  Inquiries filter on the server: ?type=rfq lists only quotes, ?q=
 *       finds one lead by name, ?status= and ?since= narrow, the stats above
 *       do not change, and ?page=2 continues page 1 without overlap
 *   I2  a lead that arrived since the last visit is marked New, still New
 *       after a live filter, and no longer New on the next visit
 *   A1  Audit Log: ?q= (and the older ?sku=) search, ?action= filters,
 *       ?page=2 continues page 1, and every day heading matches its rows
 *   L1  with JavaScript the filters apply as you type: the list and the
 *       address bar change, the Filter button is hidden; without JavaScript
 *       the button is there and submits the same query string
 *   B1  Backups: after a Business Details save, its newest version says what
 *       it was saved ahead of ("Business Details saved")
 *
 * Writes only to put things back: I2 appends one lead to the mirror's
 * inquiries.jsonl and B1 saves Business Details once; both files, the
 * seen-marker and the new backup are restored in a finally.
 * Usage: node _harness/plan13-lists.js      (needs :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const SITE = path.join(__dirname, 'site');
const INQ = path.join(SITE, 'admin', 'inquiries.jsonl');
const SEEN = path.join(SITE, 'admin', '.inquiries-seen.json');
const INFO = path.join(SITE, 'site-data', 'site-info.json');
const DATA = path.join(SITE, 'site-data');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };
const keep = (f) => (fs.existsSync(f) ? fs.readFileSync(f) : null);
const put = (f, buf) => { if (buf === null) fs.rmSync(f, { force: true }); else fs.writeFileSync(f, buf); };

(async () => {
  const saved = { inq: keep(INQ), seen: keep(SEEN), info: keep(INFO) };
  const backupsBefore = new Set(fs.readdirSync(DATA));
  const b = await launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => ok(false, `page error: ${e.message}`));
    await p.goto(BASE + '/admin/auth.php', { waitUntil: 'domcontentloaded' });
    await p.fill('input[type=password]', PW);
    await p.click('button[type=submit]');
    await p.waitForLoadState('domcontentloaded');
    const off = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    await off.addCookies(await ctx.cookies());
    const q = await off.newPage();
    const plain = async (u) => { await q.goto(BASE + u, { waitUntil: 'domcontentloaded' }); return q; };

    console.log('\n── I1 Inquiries filters on the server ──');
    {
      await plain('/admin/inquiries.php');
      const all = await q.evaluate(() => ({ total: document.querySelector('.stat-num').textContent, names: [...document.querySelectorAll('details.inq .who')].map((w) => w.firstChild.textContent.trim()), n: document.querySelectorAll('details.inq').length }));
      await plain('/admin/inquiries.php?type=rfq');
      const rfq = await q.evaluate(() => ({ total: document.querySelector('.stat-num').textContent, badges: [...document.querySelectorAll('details.inq summary .badge:not(.badge-new)')].map((x) => x.textContent.trim()).filter((t) => /^(Quote|Message|Spam trap|Rate limited|Blocked|Incomplete)$/.test(t)) }));
      ok(rfq.badges.length > 0 && rfq.badges.every((t) => t === 'Quote') && rfq.total === all.total,
        `?type=rfq: ${rfq.badges.length} rows, all "Quote"; Total received still ${rfq.total}`);
      const who = all.names.find((x) => x && x !== '—') || '';
      await plain('/admin/inquiries.php?q=' + encodeURIComponent(who));
      const byName = await q.evaluate(() => [...document.querySelectorAll('details.inq .who')].map((w) => w.firstChild.textContent.trim()));
      ok(who !== '' && byName.length > 0 && byName.every((x) => x === who), `?q=${who}: ${byName.length} rows, all "${who}"`);
      await plain('/admin/inquiries.php?status=failed&since=7');
      const failed = await q.evaluate(() => [...document.querySelectorAll('details.inq summary .badge')].map((x) => x.textContent.trim()).filter((t) => /mail server|failed|confirmed/i.test(t)));
      ok(failed.every((t) => t === 'Email failed'), `?status=failed&since=7: ${failed.length} rows, every one "Email failed"`);
      await plain('/admin/inquiries.php?page=2');
      const p2 = await q.evaluate(() => [...document.querySelectorAll('details.inq .when')].map((w) => w.textContent + w.closest('summary').textContent));
      await plain('/admin/inquiries.php');
      const p1 = await q.evaluate(() => [...document.querySelectorAll('details.inq .when')].map((w) => w.textContent + w.closest('summary').textContent));
      ok(all.n === 25 && p2.length > 0 && !p2.some((x) => p1.includes(x)), `25 per page; page 2 has ${p2.length} rows, none repeated from page 1`);
    }

    console.log('\n── I2 New since the last visit ──');
    {
      await p.goto(BASE + '/admin/inquiries.php', { waitUntil: 'networkidle' });   // marks everything seen
      const lead = { ts: new Date().toISOString().slice(0, 19).replace('T', ' '), type: 'rfq', name: 'Phase Six NewLead', company: 'Lists Co', email: 'newlead@example.com', phone: '', part: 'IP33PO', material: '', quantity: '10', reqDate: '', special: '', notes: '', sent: true, ip: '127.0.0.1' };
      fs.appendFileSync(INQ, JSON.stringify(lead) + '\n');
      await p.goto(BASE + '/admin/inquiries.php', { waitUntil: 'networkidle' });
      const first = await p.evaluate(() => [...document.querySelectorAll('details.inq-new .who')].map((w) => w.firstChild.textContent.trim()));
      ok(first.length === 1 && first[0] === 'Phase Six NewLead', `one lead marked New: ${JSON.stringify(first)}`);
      await p.fill('#inq-q', 'Phase Six');
      await p.waitForTimeout(900);
      const filtered = await p.evaluate(() => ({ url: location.search, n: document.querySelectorAll('details.inq').length, isNew: document.querySelectorAll('details.inq-new').length }));
      ok(filtered.url === '?q=Phase+Six' && filtered.n === 1 && filtered.isNew === 1, `live filter "${filtered.url}": ${filtered.n} row, still New (${filtered.isNew})`);
      await p.goto(BASE + '/admin/inquiries.php', { waitUntil: 'networkidle' });
      const after = await p.evaluate(() => document.querySelectorAll('details.inq-new').length);
      ok(after === 0, `the next visit marks nothing New (${after})`);
    }

    console.log('\n── A1 Audit Log ──');
    {
      await plain('/admin/audit-log.php?action=sign-in');
      const act = await q.evaluate(() => [...document.querySelectorAll('#log-results .action-badge')].map((x) => x.textContent.trim()));
      ok(act.length > 0 && act.every((x) => x === 'sign-in'), `?action=sign-in: ${act.length} rows, all sign-in`);
      await plain('/admin/audit-log.php?q=IP33PO');
      const qq = await q.evaluate(() => [...document.querySelectorAll('#log-results tbody tr:not(.day-row)')].map((tr) => tr.textContent));
      await plain('/admin/audit-log.php?sku=IP33PO');
      const legacy = await q.evaluate(() => ({ n: document.querySelectorAll('#log-results tbody tr:not(.day-row)').length, box: document.getElementById('log-q').value }));
      ok(qq.length > 0 && qq.every((t) => /IP33PO/i.test(t)) && legacy.n === qq.length && legacy.box === 'IP33PO',
        `?q=IP33PO: ${qq.length} rows, each naming it; the older ?sku=IP33PO gives the same ${legacy.n} and fills the box`);
      await plain('/admin/audit-log.php');
      const pg1 = await q.evaluate(() => [...document.querySelectorAll('#log-results tbody tr:not(.day-row)')].map((tr) => tr.textContent.replace(/\s+/g, ' ')));
      const days = await q.evaluate(() => {
        let label = null, bad = 0, heads = 0;
        const today = new Date();
        const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        for (const tr of document.querySelectorAll('#log-results tbody tr')) {
          if (tr.classList.contains('day-row')) { label = tr.textContent.trim(); heads++; continue; }
          const d = tr.querySelector('.ts span').textContent.trim();
          const want = d === iso(today) ? 'Today' : null;
          if (label === null || (want && label !== want)) bad++;
        }
        return { heads, bad };
      });
      ok(days.heads >= 1 && days.bad === 0, `${days.heads} day heading(s); every row sits under one, today's under "Today"`);
      await plain('/admin/audit-log.php?page=2');
      const pg2 = await q.evaluate(() => [...document.querySelectorAll('#log-results tbody tr:not(.day-row)')].map((tr) => tr.textContent.replace(/\s+/g, ' ')));
      ok(pg1.length === 50 && pg2.length > 0, `50 per page; page 2 has ${pg2.length} rows`);
    }

    console.log('\n── L1 live with JavaScript, a form without ──');
    {
      await plain('/admin/audit-log.php');
      const btnOff = await q.evaluate(() => { const b = document.querySelector('.filter-submit'); return !!b && b.getBoundingClientRect().height > 0; });
      await q.fill('#log-q', 'IP33PO');
      await Promise.all([q.waitForNavigation({ waitUntil: 'domcontentloaded' }), q.click('.filter-submit')]);
      const offUrl = new URL(q.url()).search;
      ok(btnOff && /q=IP33PO/.test(offUrl), `JavaScript off: Filter button shown, and it submits "${offUrl}"`);
      await p.goto(BASE + '/admin/audit-log.php', { waitUntil: 'networkidle' });
      const btnOn = await p.evaluate(() => { const b = document.querySelector('.filter-submit'); return !!b && b.getBoundingClientRect().height > 0; });
      await p.selectOption('#log-action', 'sign-in');
      await p.waitForTimeout(700);
      const live = await p.evaluate(() => ({ url: location.search, acts: [...new Set([...document.querySelectorAll('#log-results .action-badge')].map((x) => x.textContent.trim()))] }));
      ok(!btnOn && live.url === '?action=sign-in' && live.acts.join() === 'sign-in', `JavaScript on: no Filter button; picking an action gives ${live.url} and only ${live.acts.join(', ')}`);
    }

    console.log('\n── B1 Backups say what each version was saved ahead of ──');
    {
      await p.goto(BASE + '/admin/settings.php', { waitUntil: 'networkidle' });
      // A real edit, not a trailing space: the save trims, so " " was a no-op
      // that only made a backup because the save also wrote homeLayout
      // "classic" into a file without one (fixed 2026-11-01). site-info.json
      // is put back in the finally.
      const field = await p.evaluate(() => {
        const f = document.querySelector('form[data-long-form] input[name="company_slogan"]');
        f.value = f.value + ' (plan13-lists)'; f.dispatchEvent(new Event('input', { bubbles: true })); return f.name;
      });
      await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click('button:has-text("Save Business Details")')]);
      await p.goto(BASE + '/admin/backups.php', { waitUntil: 'networkidle' });
      const r = await p.evaluate(() => {
        const card = [...document.querySelectorAll('.card')].find((c) => c.querySelector('.card-title').textContent.trim() === 'Business Details');
        const row = card && card.querySelector('.row');
        return row ? { why: (row.querySelector('.why') || { textContent: '' }).textContent.trim(), confirm: (row.querySelector('form') || { dataset: {} }).dataset.confirm || '' } : null;
      });
      ok(!!r && /just before: Business Details saved/.test(r.why) && /just before: Business Details saved/.test(r.confirm),
        `newest Business Details version (after editing ${field}): "${r ? r.why.slice(0, 70) : 'no row'}", and the restore prompt says it too`);
    }
    await off.close();
    await ctx.close();
  } finally {
    await b.close();
    put(INQ, saved.inq); put(SEEN, saved.seen); put(INFO, saved.info);
    for (const f of fs.readdirSync(DATA)) if (!backupsBefore.has(f) && /\.backup\./.test(f)) fs.rmSync(path.join(DATA, f), { force: true });
  }
  console.log(`\nplan13-lists ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
