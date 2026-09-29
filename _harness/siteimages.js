/**
 * Site Images & Logo (admin/site-images.php) — WHATS_LEFT §2h item 3b, built
 * 2026-09-29. The five page photos and the logo get an upload button, a picker
 * of pictures already on the server, and a remove.
 *
 * Throwaway copy of the mirror, own `php -S` on :8726, the real admin pages
 * through adminhttp.js, and one browser pass over the public site.
 *
 *   upload     a real 2000px PNG → uploads/site/<slot>-<stamp>.png, scaled to
 *              IMG_MAX_WIDTH, stored in content.json copy.siteImages.<slot>,
 *              every OTHER key of content.json untouched, a backup written,
 *              audited as site-image; the homepage renders it
 *   logo       same into site-info.json theme.logoUrl (leading slash), other
 *              keys untouched; the header renders it
 *   choose     a shipped images/site/ picture is accepted; a path outside the
 *              two folders, a missing file and a traversal are refused and
 *              change nothing
 *   refuse     a GIF-header polyglot with a PHP tag, an SVG, and a PNG named
 *              .jpg are refused and nothing lands in uploads/site/
 *   no-clobber two uploads to one slot keep both files
 *   remove     a photo slot becomes "" (empty on the page); the logo goes
 *              back to "" (the shipped logo)
 *   damaged    a damaged content.json refuses the upload BEFORE the file is
 *              stored (no orphan), and is not overwritten
 *   stale tab  a Page Content form opened before an upload refuses to save
 *              over it (content.php's orig_sig)
 *   guards     signed out → sign-in; no CSRF token → refused; unknown slot
 *
 *   node _harness/siteimages.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { adminHttp } = require('./adminhttp');
const { launch } = require('./browser');

const MIRROR = path.join(__dirname, 'site');
const PORT = 8726;
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'audit-pass-123';
const results = [];
const note = (ok, label, detail) => {
  results.push({ ok, label });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && detail ? `\n       → ${detail}` : ''}`);
};

const png = (w, h) => spawnSync('php', ['-r', `$i=imagecreatetruecolor(${w},${h}); imagefill($i,0,0,imagecolorallocate($i,20,90,160)); imagepng($i);`], { encoding: 'buffer' }).stdout;
const sizeOf = (file) => spawnSync('php', ['-r', '$s=getimagesize($argv[1]); echo $s[0];', file], { encoding: 'utf8' }).stdout;

(async () => {
  if (spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '2', BASE + '/']).status === 0) {
    console.log(`siteimages: port ${PORT} is already in use`); process.exit(2);
  }
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-siteimg-'));
  const SITE = path.join(TMP, 'site');
  fs.cpSync(MIRROR, SITE, { recursive: true, filter: (p) => !/\/admin\/(\.sessions|.*\.jsonl$|\.login-throttle\.json$)|\/pdfs(\/|$)/.test(p) });
  for (const f of ['products-all.json', 'content.json', 'site-info.json']) fs.copyFileSync(path.join(__dirname, 'pristine', f), path.join(SITE, 'data', f));
  for (const x of fs.readdirSync(path.join(SITE, 'data'))) if (/\.backup\./.test(x)) fs.rmSync(path.join(SITE, 'data', x));
  fs.rmSync(path.join(SITE, 'uploads', 'site'), { recursive: true, force: true });
  const DATA = path.join(SITE, 'data');
  const UP = path.join(SITE, 'uploads', 'site');
  const readJ = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
  const upFiles = () => (fs.existsSync(UP) ? fs.readdirSync(UP).filter((n) => !n.startsWith('.')) : []);
  const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE, path.join(__dirname, 'router.php')], { cwd: SITE, stdio: 'ignore' });
  let browser = null;
  const a = adminHttp(PORT);
  const upload = async (slot, name, buf, type = 'image/png', withCsrf = true) => {
    const g = await a.req('GET', '/admin/site-images.php');
    const b = '----si' + Date.now() + Math.random().toString(16).slice(2);
    const parts = [];
    if (withCsrf) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="csrf_token"\r\n\r\n${a.csrfOf(g.body)}\r\n`));
    parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="slot"\r\n\r\n${slot}\r\n--${b}\r\nContent-Disposition: form-data; name="action"\r\n\r\nupload\r\n`));
    parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="image_file"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`), buf, Buffer.from(`\r\n--${b}--\r\n`));
    return a.req('POST', '/admin/site-images.php', Buffer.concat(parts), { 'Content-Type': `multipart/form-data; boundary=${b}` });
  };
  const act = async (slot, action, extra = []) => {
    const g = await a.req('GET', '/admin/site-images.php');
    return a.post('/admin/site-images.php', [['csrf_token', a.csrfOf(g.body)], ['slot', slot], ['action', action], ...extra]);
  };
  const follow = async (r) => (r.status === 302 ? (await a.req('GET', '/admin/' + r.headers.location)).body : r.body);
  try {
    await new Promise((r) => setTimeout(r, 700));
    const out = await a.req('GET', '/admin/site-images.php');
    note(out.status === 302 && /auth\.php/.test(out.headers.location || ''), 'guards: signed out → sign-in page');
    if (!(await a.login(PW))) throw new Error('sign-in failed');
    const page = await a.req('GET', '/admin/site-images.php');
    note(page.status === 200 && (page.body.match(/<section class="card" id="slot-/g) || []).length === 6, 'the page lists six slots (five page photos + logo)');

    // ── upload ──
    const before = readJ('content.json');
    const r1 = await upload('heroPhoto', 'My Hero Shot!.png', png(2000, 1200));
    const after = readJ('content.json');
    const heroPath = after.copy.siteImages.heroPhoto;
    const heroFile = path.join(SITE, heroPath || 'x');
    note(r1.status === 302 && /^uploads\/site\/heroPhoto-\d{8}-\d{6}(-\d+)?\.png$/.test(heroPath || '') && fs.existsSync(heroFile),
      'upload: stored as uploads/site/heroPhoto-<stamp>.png (not the visitor\'s filename) and written to copy.siteImages.heroPhoto', `${r1.status} ${heroPath}`);
    note(sizeOf(heroFile) === '1600', 'upload: a 2000px picture is scaled to 1600px wide', sizeOf(heroFile));
    const strip = (c) => { const x = JSON.parse(JSON.stringify(c)); delete x.copy.siteImages.heroPhoto; return JSON.stringify(x); };
    note(strip(before) === strip(after), 'upload: nothing else in content.json changed');
    note(fs.readdirSync(DATA).some((f) => /^content\.backup\./.test(f)), 'upload: a Page Content backup was written first');
    const log = fs.readFileSync(path.join(SITE, 'admin', 'admin-log.jsonl'), 'utf8');
    note(/"action":"site-image"/.test(log) && /heroPhoto/.test(log), 'upload: audited as site-image');

    const infoBefore = readJ('site-info.json');
    const r2 = await upload('logo', 'logo.png', png(400, 120));
    const infoAfter = readJ('site-info.json');
    const logo = infoAfter.theme.logoUrl;
    note(r2.status === 302 && /^\/uploads\/site\/logo-\d{8}-\d{6}(-\d+)?\.png$/.test(logo || ''), 'logo: stored with a leading slash in theme.logoUrl', logo);
    const sx = (i) => { const x = JSON.parse(JSON.stringify(i)); delete x.theme.logoUrl; return JSON.stringify(x); };
    note(sx(infoBefore) === sx(infoAfter), 'logo: nothing else in site-info.json changed');

    browser = await launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const shown = await p.evaluate(({ hero, logo }) => {
      const ok = (sel) => [...document.querySelectorAll('img')].some((i) => i.getAttribute('src') && i.getAttribute('src').includes(sel) && i.naturalWidth > 0);
      return { hero: ok(hero), logo: ok(logo) };
    }, { hero: path.basename(heroPath), logo: path.basename(logo) });
    await ctx.close();
    note(shown.hero && shown.logo, 'public site: the homepage renders the uploaded hero photo and logo (loaded, not broken)', JSON.stringify(shown));

    // ── no clobber ──
    const n0 = upFiles().length;
    await upload('heroPhoto', 'a.png', png(300, 200));
    await upload('heroPhoto', 'b.png', png(300, 200));
    note(upFiles().length === n0 + 2 && fs.existsSync(heroFile), 'no-clobber: two more uploads add two files and the earlier one is still there');

    // ── choose ──
    const r3 = await act('aboutPhoto', 'choose', [['choice', 'images/site/staff.jpg']]);
    note(r3.status === 302 && readJ('content.json').copy.siteImages.aboutPhoto === 'images/site/staff.jpg', 'choose: a shipped images/site/ picture is accepted');
    const snap = fs.readFileSync(path.join(DATA, 'content.json'), 'utf8');
    for (const bad of ['../data/content.json', 'uploads/site/does-not-exist.jpg', 'images/site/../../data/content.json', '/etc/passwd', 'uploads/images/CC.png']) {
      const r = await act('aboutPhoto', 'choose', [['choice', bad]]);
      note(r.status === 200 && /Pick a picture from the list/.test(r.body) && fs.readFileSync(path.join(DATA, 'content.json'), 'utf8') === snap,
        `choose: "${bad}" is refused and changes nothing`);
    }

    // ── refuse ──
    const n1 = upFiles().length;
    const poly = Buffer.concat([Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'), Buffer.from('<?php echo 1; ?>')]);
    const rp = await upload('servicesPhoto', 'x.gif', poly, 'image/gif');
    const rs = await upload('logo', 'logo.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml');
    const rm = await upload('servicesPhoto', 'photo.jpg', png(50, 50), 'image/jpeg');
    note(rp.status === 200 && rs.status === 200 && rm.status === 200 && upFiles().length === n1
      && /contains program code|Only JPG, PNG, WEBP, or GIF/.test(rp.body) && /Only JPG, PNG, WEBP, or GIF/.test(rs.body) && /Only JPG, PNG, WEBP, or GIF/.test(rm.body),
    'refuse: a PHP polyglot, an SVG and a PNG named .jpg are refused and nothing lands', `${rp.status}/${rs.status}/${rm.status}, files ${upFiles().length} vs ${n1}`);

    // ── stale Page Content tab ──
    const cg = await a.req('GET', '/admin/content.php');
    const stale = a.formFields(cg.body.replace(/<template\b[\s\S]*?<\/template>/gi, ''), /form_complete/);
    await upload('bandTeamPhoto', 'team.png', png(300, 200));
    const teamNow = readJ('content.json').copy.siteImages.bandTeamPhoto;
    const rc = await a.post('/admin/content.php', stale);
    note(readJ('content.json').copy.siteImages.bandTeamPhoto === teamNow && /changed by another session|another browser tab/i.test(rc.body),
      'stale tab: a Page Content form opened before the upload refuses to save over it', `status ${rc.status}`);

    // ── remove ──
    await act('heroPhoto', 'remove');
    await act('logo', 'remove');
    note(readJ('content.json').copy.siteImages.heroPhoto === '' && readJ('site-info.json').theme.logoUrl === '', 'remove: hero becomes "" (empty on the page), logo back to "" (the shipped logo)');

    // ── damaged ──
    const good = fs.readFileSync(path.join(DATA, 'content.json'), 'utf8');
    fs.writeFileSync(path.join(DATA, 'content.json'), good.slice(0, -40));
    const n2 = upFiles().length;
    const rd = await upload('heroPhoto', 'x.png', png(300, 200));
    note(rd.status === 200 && /damaged/.test(rd.body) && upFiles().length === n2 && fs.readFileSync(path.join(DATA, 'content.json'), 'utf8') === good.slice(0, -40),
      'damaged: a damaged content.json refuses the upload before storing the file, and is not overwritten');
    fs.writeFileSync(path.join(DATA, 'content.json'), good);

    // ── guards ──
    const rn = await upload('heroPhoto', 'x.png', png(300, 200), 'image/png', false);
    note(rn.status !== 302 && readJ('content.json').copy.siteImages.heroPhoto === '', 'guards: an upload without a CSRF token is refused', `status ${rn.status}`);
    const ru = await act('footerPhoto', 'remove');
    note(ru.status === 200 && /Unknown picture slot/.test(ru.body), 'guards: an unknown slot is refused');
    note(/new picture uploaded/.test(await follow(await upload('servicesPhoto', 's.png', png(300, 200)))), 'the success message is shown after the redirect');
  } finally {
    if (browser) await browser.close();
    srv.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nsiteimages ${results.length - bad}/${results.length}`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
