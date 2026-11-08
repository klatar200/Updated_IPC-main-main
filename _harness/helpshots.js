/**
 * The annotated screenshots in admin/help.php and the owner handoff email.
 *
 *   npm run build && bash _harness/sync.sh
 *   node _harness/helpshots-site.js        # leave running: clean mirror on :8140
 *   node _harness/helpshots.js             # writes admin/help-img/*.png and
 *                                          # rick-email/img/*.png (same files)
 *   node _harness/helpshots.js inquiries   # just the shots whose name matches
 *
 * Re-run it whenever an admin page or the site changes shape: the pictures are
 * generated, never hand-edited, so they can be brought back in line with the
 * screens in one command. (Three public-site pictures are .jpg, the rest .png.) The orange numbered circles are drawn into the page
 * before the shot (an overlay, pointer-events: none); help.php and the email
 * explain each number underneath the picture, so a renumbering here must be
 * matched there — the caption lists are written next to each <img>.
 *
 * Restart helpshots-site.js before a full run: the Overview shot needs the
 * demo leads still "new", and the run itself saves one product edit (that is
 * what puts an entry in Backups and the Audit Log).
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8140';
const PW = 'audit-pass-123';
const ROOT = path.join(__dirname, '..');
const OUTS = [path.join(ROOT, 'admin', 'help-img'), path.join(ROOT, 'rick-email', 'img')];
for (const d of OUTS) fs.mkdirSync(d, { recursive: true });
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;

const ORANGE = '#c2410c'; // white text on it is 5.2:1

// Draw numbered callouts. marks: [{ box, n, at, text }], box in document px.
async function drawMarks(p, marks) {
  await p.evaluate(({ marks, ORANGE }) => {
    document.querySelectorAll('.__shot').forEach((e) => e.remove());
    for (const m of marks) {
      const { x, y, width: w, height: h } = m.box;
      const pad = m.pad == null ? 5 : m.pad;
      const ring = document.createElement('div');
      ring.className = '__shot';
      Object.assign(ring.style, {
        position: 'absolute', left: (x - pad) + 'px', top: (y - pad) + 'px',
        width: (w + pad * 2) + 'px', height: (h + pad * 2) + 'px',
        border: `3px solid ${ORANGE}`, borderRadius: '10px', boxSizing: 'border-box',
        boxShadow: '0 0 0 2px rgba(255,255,255,0.85)', zIndex: 2147483646, pointerEvents: 'none',
      });
      document.body.appendChild(ring);
      const b = document.createElement('div');
      b.className = '__shot';
      b.textContent = String(m.n);
      const at = m.at || 'tl';
      const bx = at.includes('r') ? x + w + pad - 16 : x - pad - 14;
      const by = at.includes('b') ? y + h + pad - 16 : y - pad - 14;
      Object.assign(b.style, {
        position: 'absolute', left: bx + 'px', top: by + 'px', width: '30px', height: '30px',
        borderRadius: '50%', background: ORANGE, color: '#fff', font: '700 16px/30px system-ui, Segoe UI, sans-serif',
        textAlign: 'center', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        zIndex: 2147483647, pointerEvents: 'none',
      });
      document.body.appendChild(b);
      if (m.text) {
        const t = document.createElement('div');
        t.className = '__shot';
        t.textContent = m.text;
        Object.assign(t.style, {
          position: 'absolute', left: (bx + 36) + 'px', top: (by + 2) + 'px',
          background: '#111827', color: '#fff', font: '600 13px/1.2 system-ui, Segoe UI, sans-serif',
          padding: '5px 9px', borderRadius: '6px', whiteSpace: 'nowrap', zIndex: 2147483647, pointerEvents: 'none',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        });
        document.body.appendChild(t);
      }
    }
  }, { marks, ORANGE });
}

async function docBox(loc) {
  await loc.first().waitFor({ state: 'attached', timeout: 8000 });
  const r = await loc.first().evaluate((e) => {
    const b = e.getBoundingClientRect();
    return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height };
  });
  if (!r.width && !r.height) throw new Error('zero-size box for ' + loc);
  return r;
}
const union = (boxes) => {
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width)), btm = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: r - x, height: btm - y };
};

/**
 * One picture. spec:
 *   marks: [[locator | box, n, opts?]]   numbered callouts
 *   area:  [locator | box ...]           the clip is the union of these (+ the marks), padded
 *   pad:   clip padding (default 24)     fullWidth: clip spans the whole viewport width
 *   scroll: true → keep the 1440x900 viewport and scroll (the public site:
 *           its hero is sized to the window, so a tall viewport would stretch it)
 */
async function shot(p, name, spec) {
  // Pages with photographs are JPEG (the homepage hero was 830 KB as PNG);
  // screens of text stay PNG, where JPEG would smear the lettering.
  const file = name + (spec.jpeg ? '.jpg' : '.png');
  const fmt = spec.jpeg ? { type: 'jpeg', quality: 82 } : {};
  const resolve = async (a) => (a && typeof a.first === 'function' ? docBox(a) : a);
  const marks = [];
  for (const [a, n, o] of spec.marks || []) marks.push({ box: await resolve(a), n, ...(o || {}) });
  const area = [];
  for (const a of spec.area || []) area.push(await resolve(a));
  const all = union([...area, ...marks.map((m) => ({ x: m.box.x - 22, y: m.box.y - 22, width: m.box.width + 44, height: m.box.height + 44 }))]);
  const pad = spec.pad == null ? 24 : spec.pad;
  const vw = p.viewportSize().width;
  let clip = {
    x: spec.fullWidth ? 0 : Math.max(0, Math.floor(all.x - pad)),
    y: Math.max(0, Math.floor(all.y - pad)),
  };
  clip.width = spec.fullWidth ? vw : Math.min(vw - clip.x, Math.ceil(all.width + pad * 2));
  clip.height = Math.ceil(all.y + all.height + pad) - clip.y;
  if (spec.maxY && clip.y + clip.height > spec.maxY) clip.height = spec.maxY - clip.y;
  if (spec.top0) { clip.height += clip.y; clip.y = 0; }

  if (spec.scroll) {
    // Window-sized layout: scroll the region to the top and clip in the viewport.
    const sy = Math.max(0, clip.y - (spec.scrollOffset || 0));
    await p.evaluate((y) => scrollTo(0, y), sy);
    await p.waitForTimeout(400);
    const realY = await p.evaluate(() => scrollY);
    await drawMarks(p, marks);
    await p.screenshot({ path: path.join(OUTS[0], file), clip: { ...clip, y: clip.y - realY }, ...fmt });
  } else {
    const need = clip.y + clip.height + 40;
    if (!spec.noResize && need > p.viewportSize().height) await p.setViewportSize({ width: vw, height: need });
    await p.evaluate(() => scrollTo(0, 0));
    await drawMarks(p, marks);
    await p.screenshot({ path: path.join(OUTS[0], file), clip, ...fmt });
    await p.setViewportSize({ width: vw, height: 900 });
  }
  await p.evaluate(() => document.querySelectorAll('.__shot').forEach((e) => e.remove()));
  for (const d of OUTS.slice(1)) fs.copyFileSync(path.join(OUTS[0], file), path.join(d, file));
  const kb = Math.round(fs.statSync(path.join(OUTS[0], file)).size / 1024);
  console.log(`  ${file}  ${clip.width}x${clip.height}  ${kb} KB`);
}

const SHOTS = [];
const def = (name, fn) => SHOTS.push({ name, fn });

// ── Admin ───────────────────────────────────────────────────────────────────
def('signin', async (p, go) => {
  await go('/admin/', { signedOut: true });
  await shot(p, 'signin', {
    marks: [[p.locator('input[type=password]'), 1, { at: 'tr' }], [p.locator('button[type=submit]'), 2, { at: 'br' }]],
    area: [p.locator('form').first().locator('xpath=..')], pad: 40,
  });
});

def('menu', async (p, go) => {
  await go('/admin/home.php');
  await p.evaluate(() => document.querySelectorAll('.ipc-admin-header details.nav-group')[1].setAttribute('open', ''));
  const nav = (t) => p.locator(`.ipc-admin-header .nav-top:text-is("${t}")`);
  await shot(p, 'menu', {
    marks: [
      [p.locator('.ipc-admin-header a.logo'), 1, { pad: 3 }],
      [nav('Products'), 2, { pad: 3 }],
      [p.locator('.ipc-admin-header details.nav-group').nth(1), 3, { pad: 3 }],
      [p.locator('.ipc-admin-header a.nav-top[href="inquiries.php"]'), 4, { pad: 3 }],
      [nav('Backups & History'), 5, { pad: 3 }],
      [nav('Help'), 6, { pad: 3 }],
      [nav('Account'), 7, { pad: 3, at: 'tr' }],
    ],
    area: [p.locator('.ipc-admin-header'), p.locator('.ipc-admin-header details[open] .nav-pop')], pad: 0, fullWidth: true, top0: true,
  });
});

def('saved', async (p, go) => {
  // A real save, so Backups and the Audit Log have something to show.
  await go('/admin/edit.php?sku=IP38FE');
  const cap = p.locator('input[name=imageCaption], input[name=caption]').first();
  await cap.fill('Low shrink temperature, extra clear Teflon tubing');
  await p.locator('button:text-is("Save Changes")').click();
  await p.waitForLoadState('networkidle');
  // Found by its words, not its class: with unread leads the "new inquiries"
  // banner is also an alert and comes first, and the shot circled that.
  const flash = p.locator('main').getByText(/saved successfully/i).first();
  // Hide the leads banner so the picture shows only the save message.
  await p.evaluate(() => document.querySelectorAll('main a[href="inquiries.php"]').forEach((a) => {
    const box = a.closest('.alert, .notice, .banner, [class*="lead"], [class*="inq"]');
    if (box && !/saved successfully/i.test(box.textContent)) box.style.display = 'none';
  }));
  await shot(p, 'saved', { marks: [[flash, 1]], area: [p.locator('main h1')] });
});

def('overview', async (p, go) => {
  await go('/admin/home.php');
  await shot(p, 'overview', {
    marks: [
      [p.locator('#ov-inquiries'), 1], [p.locator('#ov-server'), 2, { at: 'tr' }],
      [p.locator('#ov-products'), 3], [p.locator('#ov-changes'), 4, { at: 'tr' }],
    ],
    area: [p.locator('main h1')],
  });
});

def('products', async (p, go) => {
  await go('/admin/index.php');
  const row = p.locator('#cat-accessory tbody tr').first();
  await shot(p, 'products', {
    marks: [
      [p.locator('#productSearch'), 1],
      [p.locator('.stat').first().locator('xpath=..'), 2],
      [p.locator('main nav').first(), 3],
      [row.locator('td').nth(4), 4, { at: 'tl' }],
      [row.locator('a.btn-edit'), 5, { pad: 3 }],
      [row.locator('summary'), 6, { pad: 3, at: 'tr' }],
    ],
    area: [p.locator('main h1'), p.locator('#cat-accessory tbody tr').nth(2)],
  });
});

def('product-more', async (p, go) => {
  await go('/admin/index.php');
  const det = p.locator('#cat-accessory details.row-more').first();
  await det.evaluate((d) => d.setAttribute('open', ''));
  const pop = det.locator(':scope > :not(summary)').first();
  await shot(p, 'product-more', {
    marks: [[pop, 1, { at: 'tl' }]],
    area: [p.locator('#cat-accessory thead'), pop],
    pad: 20,
  });
});

def('edit', async (p, go) => {
  await go('/admin/edit.php?sku=IP38FE');
  await shot(p, 'edit', {
    marks: [
      [p.locator('main nav:has-text("Basic Information")'), 1],
      [p.locator('input[name=name]').locator('xpath=..'), 2],
      [p.locator('.ipc-preview-col'), 3, { at: 'tr' }],
      [p.locator('main a.btn:text-is("Manage PDF")').locator('xpath=..'), 4, { at: 'tr', pad: 3 }],
      [p.locator('button:text-is("Save Changes")'), 5, { at: 'tr', pad: 3 }],
    ],
    // The Save bar sticks to the bottom of the window: keep the window at
    // 900 so it is in the picture, where Rick will see it.
    area: [p.locator('main h1')], maxY: 900, noResize: true,
  });
});

def('add', async (p, go) => {
  await go('/admin/add.php');
  await shot(p, 'add', {
    marks: [
      [p.locator('input[name=sku]'), 1],
      [p.locator('select[name=category], select[name=family], select').first(), 2, { at: 'tr' }],
      [p.locator('input[name=name]'), 3],
    ],
    area: [p.locator('main h1')],
  });
});

def('upload-photo', async (p, go) => {
  await go('/admin/upload-image.php?sku=IP38FE');
  const up = p.locator('main button[type=submit]').filter({ hasText: /upload|replace/i }).first();
  await shot(p, 'upload-photo', {
    marks: [[p.locator('input[type=file]'), 1], [up, 2, { at: 'tr', pad: 3 }], [p.locator('main button:has-text("Remove Photo")'), 3, { at: 'tr', pad: 3 }]],
    area: [p.locator('main h1')],
  });
});

def('upload-pdf', async (p, go) => {
  await go('/admin/upload-pdf.php?sku=IP38FE');
  const up = p.locator('main button[type=submit]').filter({ hasText: /upload|replace/i }).first();
  await shot(p, 'upload-pdf', {
    marks: [[p.locator('input[type=file]'), 1], [up, 2, { at: 'tr', pad: 3 }], [p.locator('main button:has-text("Remove PDF")'), 3, { at: 'tr', pad: 3 }]],
    area: [p.locator('main h1')],
  });
});

def('business', async (p, go) => {
  await go('/admin/settings.php');
  // The Contact card, moved up under the tabs so one picture holds tabs, the
  // lead-email box and the preview (display only — nothing is saved).
  await p.evaluate(() => {
    const c = document.querySelector('#sec-contact');
    const first = document.querySelector('#sec-branding-and-theme');
    if (c && first && first !== c) first.parentNode.insertBefore(c, first);
  });
  const email = p.locator('input[name=contact_email]');
  await shot(p, 'business', {
    marks: [
      [p.locator('main nav').first(), 1],
      [email, 2],
      [p.locator('aside.preview-col .preview-inner'), 3, { at: 'tr' }],
    ],
    area: [p.locator('main h1'), p.locator('#sec-contact')],
  });
});

def('content', async (p, go) => {
  await go('/admin/content.php');
  await shot(p, 'content', {
    marks: [
      [p.locator('main input[type=search], main input[placeholder*="For example"]').first(), 1],
      [p.locator('main nav').first(), 2],
      [p.locator('a:has-text("Open this page on the site")').first(), 3, { at: 'tr', pad: 3 }],
      [p.locator('main input[type=text]').first(), 4],
    ],
    area: [p.locator('main h1')],
  });
});

def('content-list', async (p, go) => {
  await go('/admin/content.php');
  // A repeatable list: the FAQ, with its add / move / remove controls.
  const sec = p.locator('fieldset[data-section="faq"]');
  const row = sec.locator('.content-row').first();
  // Show the first two questions only: the rest are hidden for the picture.
  await sec.evaluate((f) => f.querySelectorAll('.content-row').forEach((r, i) => { if (i > 1) r.style.display = 'none'; }));
  const add = sec.locator('button[data-action=add]');
  await shot(p, 'content-list', {
    marks: [
      [sec.locator('a.where-link'), 1, { pad: 3 }],
      [row.locator('.row-move'), 2, { at: 'tr', pad: 3 }],
      [row.locator('button[data-action=remove]'), 3, { at: 'tr', pad: 3 }],
      [add, 4, { pad: 3 }],
    ],
    area: [sec.locator('legend'), add],
  });
});

def('site-images', async (p, go) => {
  await go('/admin/site-images.php');
  const card = p.locator('main .card').first();
  await shot(p, 'site-images', {
    marks: [
      [card.locator('.now-showing'), 1],
      [card.locator('input[type=file]'), 2],
      [card.locator('button:has-text("Upload")'), 3, { at: 'tr', pad: 3 }],
      [card.locator('select'), 4],
    ],
    area: [p.locator('main h1'), card],
  });
});

def('marketing-pdfs', async (p, go) => {
  await go('/admin/marketing-pdfs.php');
  await shot(p, 'marketing-pdfs', {
    marks: [[p.locator('main input[type=file]').first(), 1], [p.locator('main button:has-text("Upload")').first(), 2, { at: 'tr', pad: 3 }]],
    area: [p.locator('main h1'), p.locator('main .card').first()],
  });
});

def('inquiries', async (p, go) => {
  await go('/admin/inquiries.php');
  const first = p.locator('main details').first();
  await first.evaluate((d) => d.setAttribute('open', ''));
  await p.waitForTimeout(200);
  await shot(p, 'inquiries', {
    marks: [
      [p.locator('main input[type=search], main input[placeholder*="Name, company"]').first(), 1],
      [first.locator('summary'), 2],
      [first.locator('a[href^="mailto:"]').first(), 3, { pad: 3 }],
    ],
    area: [p.locator('main h1'), first, p.locator('main details').nth(1)],
  });
});

def('backups', async (p, go) => {
  await go('/admin/backups.php');
  const restore = p.locator('main button:has-text("Restore")').first();
  await shot(p, 'backups', {
    marks: [[restore.locator('xpath=ancestor::tr[1] | ancestor::li[1] | ancestor::*[contains(@class,"row")][1]').first(), 1], [restore, 2, { at: 'tr', pad: 3 }]],
    area: [p.locator('main h1')],
  });
});

def('audit-log', async (p, go) => {
  await go('/admin/audit-log.php');
  const row = p.locator('main tbody tr:has-text("IP38FE")').first();
  await shot(p, 'audit-log', {
    marks: [[p.locator('main input[type=search], main input[placeholder*="SKU"]').first(), 1], [row, 2]],
    area: [p.locator('main h1'), p.locator('main tbody tr').last()],
  });
});

def('password', async (p, go) => {
  await go('/admin/password.php');
  await shot(p, 'password', {
    marks: [
      [p.locator('main input[type=password]').nth(0), 1],
      [p.locator('main input[type=password]').nth(1), 2],
      [p.locator('main button[type=submit]').first(), 3, { at: 'tr', pad: 3 }],
    ],
    area: [p.locator('main h1'), p.locator('main .card').first()],
  });
});

def('help', async (p, go) => {
  await go('/admin/help.php');
  await shot(p, 'help', {
    marks: [[p.locator('.help-toc'), 1], [p.locator('#overview'), 2, { at: 'tr' }]],
    area: [p.locator('.page-header')], fullWidth: true, top0: true, pad: 0,
  });
});

// ── The public site ─────────────────────────────────────────────────────────
def('site-home', async (p, go) => {
  await go('/');
  const proof = p.locator('main').getByText('Minimum Order', { exact: true }).first()
    .locator('xpath=ancestor::*[count(.//*[contains(text(),"Feet in Stock")])>0][1]');
  await shot(p, 'site-home', {
    jpeg: true, scroll: true, fullWidth: true, top0: true, pad: 0, maxY: 880,
    marks: [
      [p.locator('h1').first(), 1],
      [proof, 2, { at: 'tr' }],
      [p.locator('main img').first(), 3, { at: 'tr' }],
      [p.locator('header a:has-text("Request a Quote")').first(), 4, { at: 'bl' }],
    ],
    area: [{ x: 0, y: 0, width: 1440, height: 880 }],
  });
});

def('site-footer', async (p, go) => {
  await go('/');
  const footer = p.locator('footer').first();
  const col = (re) => footer.getByText(re).first().locator('xpath=..');
  await shot(p, 'site-footer', {
    scroll: true, fullWidth: true, pad: 0,
    marks: [
      [footer.locator('a[href^="tel:"]').first().locator('xpath=ancestor::*[.//a[starts-with(@href,"mailto:")]][1]'), 1],
      [footer.locator('p').first(), 2],
      [col(/^quick links$/i), 3, { at: 'tr' }],
      [footer.locator('a[aria-label*="LinkedIn" i], a[href*="linkedin"]').first().locator('xpath=..'), 4, { at: 'bl' }],
    ],
    area: [footer],
  });
});

def('site-product', async (p, go) => {
  await go('/products?productId=IP38FE');
  await p.waitForTimeout(600);
  await shot(p, 'site-product', {
    jpeg: true, scroll: true, fullWidth: true, pad: 0, top0: true, maxY: 880,
    marks: [
      [p.locator('h1').first(), 1],
      [p.locator('main a:has-text("Datasheet")').first(), 2, { at: 'tr' }],
      [p.locator('main img[src*="IP38FE"]').first(), 3, { at: 'tr' }],
      [p.locator('main a:has-text("Request a Quote")').first(), 4, { at: 'br' }],
    ],
    area: [{ x: 0, y: 0, width: 1440, height: 880 }],
  });
});

def('site-contact', async (p, go) => {
  await go('/contact');
  await p.waitForTimeout(600);
  const tabs = p.getByText('Request a Quote', { exact: true }).nth(1).locator('xpath=ancestor::*[.//*[text()="Send a Message"]][1]');
  await shot(p, 'site-contact', {
    jpeg: true, scroll: true, fullWidth: true, pad: 0, top0: true, maxY: 880,
    marks: [
      [tabs, 1, { at: 'tr' }],
      [await p.evaluate(() => {
        const h = [...document.querySelectorAll('main *')].find((e) => /^direct contact$/i.test(e.textContent.trim()) && e.getBoundingClientRect().width);
        let c = h.parentElement; while (c.getBoundingClientRect().height < 300) c = c.parentElement;
        const r = c.getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: Math.min(r.height, 760 - r.top) };
      }), 2],
    ],
    area: [{ x: 0, y: 0, width: 1440, height: 880 }],
  });
});

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  let signedIn = false;
  const go = async (url, o = {}) => {
    if (!o.signedOut && !signedIn && url.startsWith('/admin/')) {
      await p.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
      await p.fill('input[type=password]', PW);
      await p.click('button[type=submit]');
      await p.waitForLoadState('networkidle');
      signedIn = true;
    }
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.goto(BASE + url, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts && document.fonts.ready);
    await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    await p.evaluate(() => scrollTo(0, 0));
  };
  let failed = 0;
  // The sign-in shot needs a signed-out browser: take it first.
  for (const s of SHOTS) {
    if (only && !only.test(s.name)) continue;
    try { await s.fn(p, go); } catch (e) { failed++; console.log(`  FAIL ${s.name}: ${e.message.split('\n')[0]}`); }
  }
  await b.close();
  process.exitCode = failed ? 1 : 0;
})();
