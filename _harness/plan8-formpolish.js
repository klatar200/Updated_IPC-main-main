/**
 * PLAN-8 C39 — contact form polish.
 *
 * Three things the audit found: no privacy-policy note near submit; no legend
 * explaining what `*` means; and "Optional" as the phone placeholder while
 * every other placeholder on the form is a worked example.
 *
 * All three are owner-editable copy, which is what makes this the heaviest of
 * the small items. §5 governs it: a key in content.php's $COPY_GROUPS with no
 * matching default in App.jsx's COPY_DEFAULTS is a SILENT DATA-LOSS PATH with
 * a green success banner on it, because mergeContent iterates
 * Object.keys(defaults). So copydrift.js must stay green, and the posted
 * variable count moves — which is enforced positionally by the form_complete
 * sentinel and has to be re-measured against a real max_input_vars=100 server
 * (plan2-trunc.js on :8124).
 *
 * This suite covers the rendered half. The contract half is copydrift.js and
 * plan4-admin.js; the truncation half is plan2-trunc.js.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan8-formpolish.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-formpolish');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const READ = () => {
  const form = document.querySelector('form[action="/contact.php"]');
  if (!form) return { form: false };
  const submit = form.querySelector('button[type="submit"]');
  const phone = form.querySelector('input[name="phone"]');
  const text = (form.textContent || '').replace(/\s+/g, ' ').trim();

  // The privacy note: a link to /privacy inside the form.
  const privacyLink = [...form.querySelectorAll('a')].find((a) => /privacy/i.test(a.getAttribute('href') || ''));

  // The legend must come BEFORE the first field that is marked required, or it
  // explains a convention the visitor has already had to guess at.
  const firstStar = [...form.querySelectorAll('label')].find((l) => (l.textContent || '').includes('*'));
  const legend = [...form.querySelectorAll('p, span, div')]
    .find((el) => /required/i.test(el.textContent || '') && (el.textContent || '').includes('*')
      && el.children.length <= 2 && (el.textContent || '').length < 120);

  const order = (a, b) => !!(a && b) && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  return {
    form: true,
    phonePlaceholder: phone ? phone.getAttribute('placeholder') : null,
    hasPrivacyLink: !!privacyLink,
    privacyHref: privacyLink ? privacyLink.getAttribute('href') : null,
    privacyBeforeSubmitDistance: (privacyLink && submit)
      ? Math.round(submit.getBoundingClientRect().top - privacyLink.getBoundingClientRect().bottom) : null,
    privacyInFormText: /privacy/i.test(text),
    hasLegend: !!legend,
    legendText: legend ? (legend.textContent || '').replace(/\s+/g, ' ').trim() : null,
    legendBeforeFirstStar: order(legend, firstStar),
    submitText: submit ? (submit.textContent || '').trim() : null,
  };
};

async function tab(page, which) {
  await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  if (which === 'message') {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Send a Message/i.test(x.textContent || ''));
      if (b) b.click();
    });
    await page.waitForTimeout(400);
  }
  return page.evaluate(READ);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  for (const which of ['rfq', 'message']) {
    const r = await tab(page, which);
    if (!r.form) { note(false, `C39: the ${which} form was found`); continue; }

    note(r.hasPrivacyLink && /privacy/.test(r.privacyHref || ''),
      `C39: the ${which} form carries a Privacy Policy link`, `href=${r.privacyHref}`);
    note(r.privacyBeforeSubmitDistance !== null && r.privacyBeforeSubmitDistance >= -80 && r.privacyBeforeSubmitDistance < 240,
      `C39: the ${which} privacy note sits NEAR the submit control`,
      `${r.privacyBeforeSubmitDistance}px from the submit button`);
    note(r.hasLegend, `C39: the ${which} form explains what * means`, `legend=${JSON.stringify(r.legendText)}`);
    note(r.legendBeforeFirstStar,
      `C39: the ${which} legend comes BEFORE the first required field`,
      `legend=${JSON.stringify(r.legendText)}`);
  }

  // The phone placeholder is a DATA item, not a code one: content.json has
  // `phonePlaceholder: "Optional"` saved, so — exactly like B22's date
  // placeholder — the live string is the owner's and only the DEFAULT can be
  // fixed here. Asserting the rendered value against live data would be
  // asserting that this repo edited data/*.json, which GUARDRAILS forbids.
  //
  // So the default is driven the way plan6-families drives day-one state: the
  // key is REMOVED from the served content.json, which is the shape a fresh
  // install has, and the rendered value is then the default under test.
  const rfq = await tab(page, 'rfq');
  note(/^optional$/i.test(rfq.phonePlaceholder || ''),
    'C39: the LIVE phone placeholder is still the owner\'s "Optional" (data untouched)',
    JSON.stringify(rfq.phonePlaceholder));

  const ctxD = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageD = await ctxD.newPage();
  await pageD.route('**/data/content.json*', async (route) => {
    const res = await route.fetch();
    const json = JSON.parse(await res.text());
    if (json.copy && json.copy.contactForm) delete json.copy.contactForm.phonePlaceholder;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await pageD.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
  await pageD.waitForTimeout(600);
  const dflt = await pageD.evaluate(() => {
    const p = document.querySelector('form[action="/contact.php"] input[name="phone"]');
    return p ? p.getAttribute('placeholder') : null;
  });
  await ctxD.close();
  note(!!dflt && !/^optional$/i.test(dflt),
    'C39: with no saved value the DEFAULT phone placeholder is not "Optional"',
    JSON.stringify(dflt));
  note(/\d/.test(dflt || ''),
    'C39: the default phone placeholder shows a real number format',
    JSON.stringify(dflt));

  // Phone must still be OPTIONAL — the placeholder changing must not have
  // turned it into a required field, which would cost leads.
  const req = await page.evaluate(() => {
    const p = document.querySelector('form[action="/contact.php"] input[name="phone"]');
    const lab = p ? document.querySelector(`label[for="${p.id}"]`) : null;
    return { required: p ? p.hasAttribute('required') : null, label: lab ? (lab.textContent || '').trim() : null };
  });
  note(req.required === false && !(req.label || '').includes('*'),
    'C39: phone is still optional — no required attribute and no star',
    JSON.stringify(req));

  await page.screenshot({ path: path.join(OUT, 'contact-rfq-1440.png'), fullPage: true });
  await ctx.close();

  // Both strings must be owner-editable, i.e. actually driven by content.json.
  // Proven by changing them through the SAME merge path the admin writes:
  // stub the fetch so the page receives an edited content.json.
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page2 = await ctx2.newPage();
  await page2.route('**/data/content.json*', async (route) => {
    const res = await route.fetch();
    const json = JSON.parse(await res.text());
    json.copy = json.copy || {};
    json.copy.contactForm = Object.assign({}, json.copy.contactForm, {
      privacyNote: 'OWNER EDITED PRIVACY LINE',
      requiredLegend: 'OWNER EDITED LEGEND *',
      phonePlaceholder: 'OWNER EDITED PHONE',
    });
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page2.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(600);
  const edited = await page2.evaluate(() => {
    const f = document.querySelector('form[action="/contact.php"]');
    const p = f && f.querySelector('input[name="phone"]');
    return {
      text: (f ? f.textContent : '').replace(/\s+/g, ' '),
      phone: p ? p.getAttribute('placeholder') : null,
    };
  });
  note(edited.text.includes('OWNER EDITED PRIVACY LINE'),
    'C39: the privacy note is owner-editable (reached the page from content.json)');
  note(edited.text.includes('OWNER EDITED LEGEND'),
    'C39: the required legend is owner-editable');
  note(edited.phone === 'OWNER EDITED PHONE',
    'C39: the phone placeholder is owner-editable', String(edited.phone));
  await ctx2.close();

  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nplan8-formpolish ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'formpolish.json'), JSON.stringify(results, null, 2));
  console.log(`record -> ${path.join(OUT, 'formpolish.json')}`);
  process.exit(pass === results.length ? 0 : 1);
})();
