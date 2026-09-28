/**
 * Cookie-jar HTTP client for admin suites that drive the real PHP pages
 * without a browser. One instance per suite: `const a = adminHttp(PORT)`.
 *
 *   a.req(method, path, body, headers)   raw request, no redirect following
 *   a.post(path, pairs, headers)         urlencoded POST of [name, value] pairs
 *   a.postRaw(path, body)                urlencoded POST of a pre-encoded body
 *   a.formFields(html, /marker/)         every named control of the form whose
 *                                        HTML matches marker, as [name, value]
 *   a.csrfOf(html)                       the page's csrf_token
 *   a.login(password)                    true on the 302 a sign-in answers with
 *   a.jar                                the cookie Map (clear() = signed out)
 */
const http = require('http');

const dec = (s) => s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function adminHttp(port) {
  const jar = new Map();
  function req(method, p, body, headers = {}) {
    return new Promise((resolve, reject) => {
      const r = http.request({ method, host: '127.0.0.1', port, path: p, timeout: 30000,
        headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers } }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          for (const sc of res.headers['set-cookie'] || []) {
            const [kv] = sc.split(';'); const i = kv.indexOf('=');
            jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
          }
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
        });
      });
      r.on('error', reject);
      if (body) r.write(body);
      r.end();
    });
  }
  const enc = (pairs) => pairs.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const postRaw = (p, body, headers = {}) => req('POST', p, body, { 'Content-Type': 'application/x-www-form-urlencoded', ...headers });
  const post = (p, pairs, headers = {}) => postRaw(p, enc(pairs), headers);
  const csrfOf = (html) => (/name="csrf_token"\s+value="([^"]*)"/.exec(html) || [, ''])[1];
  function formFields(html, marker) {
    const forms = html.split(/<form\b/i).slice(1).map((f) => f.split(/<\/form>/i)[0]);
    const f = forms.find((x) => marker.test(x));
    if (!f) return null;
    const out = [];
    for (const m of f.matchAll(/<input\b[^>]*>/gi)) {
      const t = m[0];
      const name = (/\bname="([^"]*)"/.exec(t) || [])[1];
      if (!name) continue;
      const type = ((/\btype="([^"]*)"/.exec(t) || [])[1] || 'text').toLowerCase();
      if (['submit', 'button', 'file', 'image', 'reset'].includes(type)) continue;
      if ((type === 'checkbox' || type === 'radio') && !/\bchecked\b/.test(t)) continue;
      out.push([name, dec((/\bvalue="([^"]*)"/.exec(t) || [, ''])[1])]);
    }
    for (const m of f.matchAll(/<textarea\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/textarea>/gi)) {
      // A browser drops ONE newline straight after <textarea>; so must we.
      out.push([m[1], dec(m[2].replace(/^\r?\n/, ''))]);
    }
    for (const m of f.matchAll(/<select\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/select>/gi)) {
      const opts = [...m[2].matchAll(/<option\b([^>]*)>/gi)].map((o) => o[1]);
      const sel = opts.find((o) => /\bselected\b/.test(o)) || opts[0] || '';
      out.push([m[1], dec((/\bvalue="([^"]*)"/.exec(sel) || [, ''])[1])]);
    }
    return out;
  }
  async function login(password) {
    const g = await req('GET', '/admin/auth.php');
    const r = await post('/admin/auth.php', [['password', password], ['csrf_token', csrfOf(g.body)]]);
    return r.status === 302;
  }
  return { jar, req, post, postRaw, formFields, csrfOf, login };
}

module.exports = { adminHttp };
