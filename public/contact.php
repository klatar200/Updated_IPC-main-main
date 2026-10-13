<?php
/**
 * IPC contact / RFQ mail handler.
 * Lives at public_html/contact.php — served by Apache as PHP.
 * Called via fetch() POST from the React SPA ContactPage.
 *
 * Security measures:
 *   - POST-only, JSON response
 *   - Same-origin referer check
 *   - Honeypot field ("website") — bots fill it in, humans leave it blank
 *   - Per-IP rate limit: 5 submissions per 10-minute window
 *   - All input stripped and HTML-entity encoded before use in email body
 *   - No SQL; file writes limited to the rate-limit temp file and the
 *     inquiry log (admin/inquiries.jsonl, blocked from the web)
 *
 * The recipient address and the contact details quoted in error/auto-reply
 * text are read from data/site-info.json (editable in the admin under
 * "Business Details"), with the original values as hardcoded fallbacks.
 */

// A-7.2 — the Content-Type is decided per response now, in respond(), because
// this endpoint answers TWO callers: the fetch() in src/App.jsx and a native
// form navigation. Setting it unconditionally here is what left the no-JS
// submitter looking at `{"ok":true}` on a white page.
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// ── Live business details (site-info.json) ─────────────────────
// Two candidate paths so this works both deployed (public_html/contact.php
// next to public_html/data/) and in the repo (public/contact.php with ../data).
function ipc_site_info(): array {
    foreach ([__DIR__ . '/data/site-info.json', __DIR__ . '/../data/site-info.json'] as $p) {
        if (is_file($p)) {
            $d = json_decode((string)@file_get_contents($p), true);
            return is_array($d) ? $d : [];
        }
    }
    return [];
}

// ── Editable copy (content.json) ───────────────────────────────
// Same two-path lookup as ipc_site_info(), for the same reason.
//
// PLAN-6 item 3: the auto-reply's promise ("respond within one business day")
// was a string literal while everything around it — business name, phone, fax,
// email, hours, address — already came from site-info.json. That is a
// customer-facing service-level commitment the owner could not soften for a
// holiday shutdown or a week without an estimator.
//
// RETURNS [] ON ANY PROBLEM, DELIBERATELY. This function runs for every
// enquiry. A missing, unreadable or malformed content.json must cost the
// nicety, never the lead — the sales notification above has already been sent
// by the time this is read, and every caller below falls back to the built-in
// text. Asserted both ways in _harness/plan3-autoreply.js.
function ipc_contact_copy(): array {
    foreach ([__DIR__ . '/data/content.json', __DIR__ . '/../data/content.json'] as $p) {
        if (!is_file($p)) continue;
        $d = json_decode((string)@file_get_contents($p), true);
        if (!is_array($d)) return [];
        $c = $d['copy']['contactForm'] ?? null;
        return is_array($c) ? $c : [];
    }
    return [];
}

/**
 * One editable line of auto-reply prose, or the built-in default.
 *
 * Body-only by design, so this does NOT go through hdr().
 *
 * The CR/LF strip is NOT what stops header injection, and it was originally
 * commented as though it were. Measured: mail() takes the body and the headers
 * as separate arguments, so a field carrying "Promise\r\nBcc: x" puts that text
 * on its own line INSIDE the body, in both directions — with the strip and
 * without it. The header block is untouched either way. (Contrast 4.16 above,
 * where company_name really was interpolated into a From: header and really did
 * produce a live Bcc:.)
 *
 * It is kept for two smaller, real reasons: a stray newline in a plain-text
 * email can produce a line that reads like a header to a naive client or a
 * forwarding chain, and if any of these fields is ever moved into a SUBJECT the
 * value is already single-line — at which point it must ALSO go through hdr().
 * `plan3-autoreply.js` asserts the normalisation itself, which is falsifiable,
 * rather than an injection that cannot happen here.
 */
function ipc_copy_line(array $copy, string $key, string $default): string {
    $v = $copy[$key] ?? null;
    if (!is_string($v)) return $default;
    $v = trim(preg_replace('/[\r\n]+/', ' ', $v));
    // An empty string is a real answer — "say nothing here" — for the optional
    // notice. The two promise fields pass a non-empty default and are guarded
    // at the call site.
    return $v;
}

// ── Inquiry log ────────────────────────────────────────────────
// Every submission (sent or failed) is appended to admin/inquiries.jsonl so a
// mail() failure never silently loses a lead. Viewable at admin/inquiries.php;
// blocked from direct web access by admin/.htaccess. Best-effort by design.
// Rotation ceiling. admin/inquiries.php used to read the whole file with file()
// and fatalled on memory once it grew (measured: 43MB/20,000 entries still
// rendered, 65MB exhausted a 128M limit) — so the page Rick relies on as the
// "no lead is ever lost" safety net went permanently blank, and his only
// recovery was FTP-deleting the file that also held every real lead. The viewer
// now reads the tail instead, and this keeps the live file from growing without
// bound in the first place. Rotated files are never deleted.
// (AUDIT_v3_FINDINGS B3)
define('IPC_INQUIRY_ROTATE_BYTES', 16 * 1024 * 1024);

/**
 * A-7.4 — this returns bool now, and a failure leaves a signal.
 *
 * "Best-effort by design" was a reasonable call when it was written. **A-5.6
 * changed what this file is for**: it added the unread-lead badge, the
 * dashboard panel, and copy that tells the owner in as many words that this is
 * the list to trust when a notification email does not arrive. The design
 * intent moved and the failure handling did not follow.
 *
 * Of the four mail/log outcomes exactly one is silent, and it is the bad one:
 *
 *   mail ok    + log ok     → 200 success, record kept
 *   mail fails + log ok     → 500 + phone number, record kept
 *   mail ok    + log FAILS  → 200 success, NO RECORD          ← this one
 *   mail fails + log fails  → 500 + phone number, no record
 *
 * The visitor still gets 200 on row 3 and that is deliberate — the mail did go,
 * so telling them to resend would be wrong. The signal belongs on the owner's
 * side instead, which is what the marker is for: admin/index.php reads it into
 * the health banner.
 *
 * The marker is best-effort too, and its limit is stated rather than papered
 * over: if the whole filesystem is out of space or inodes, creating it fails as
 * well. It covers what `admin_writable()` cannot — that check is a bare
 * `is_writable(__DIR__)`, so it catches the permission case and returns true
 * for a log file that is individually unwritable, locked, or replaced by a
 * directory.
 */
define('IPC_LOG_FAIL_MARKER', '.inquiry-log-failed.json');

/**
 * The live log, opened for append and LOCKED, rotated first if it is full.
 *
 * A12-L4-05-W5-2 — the size check and rename ran before, and outside, the
 * lock. Two submissions in the same second at the 16 MB mark both saw a full
 * file: the first archived it and started a fresh log, the second renamed THAT
 * fresh file onto the same second-granular archive name, and rename() replaced
 * the archive holding every earlier lead. Now the check runs under the lock,
 * a handle whose file was renamed away while it waited is reopened, and an
 * archive name already taken gets a suffix instead of being overwritten.
 * Returns null when the file cannot be opened or locked.
 *
 * @return resource|null
 */
function ipc_inquiry_log_open(string $dir, string $path) {
    for ($try = 0; $try < 4; $try++) {
        $fh = @fopen($path, 'a+b');
        if (!$fh) return null;
        if (!flock($fh, LOCK_EX)) { fclose($fh); return null; }
        clearstatcache(true, $path);
        $st  = fstat($fh);
        $cur = @stat($path);
        if (!$st || !$cur || $st['ino'] !== $cur['ino'] || $st['dev'] !== $cur['dev']) {
            // Rotated (renamed away) by another request while this one waited.
            flock($fh, LOCK_UN);
            fclose($fh);
            continue;
        }
        if ($st['size'] >= IPC_INQUIRY_ROTATE_BYTES) {
            $base = $dir . '/inquiries-' . date('Y-m-d-His');
            $arch = $base . '.jsonl';
            for ($n = 2; file_exists($arch) && $n < 100; $n++) $arch = $base . '-' . $n . '.jsonl';
            $moved = !file_exists($arch) && @rename($path, $arch);
            flock($fh, LOCK_UN);
            fclose($fh);
            if ($moved) continue;      // start the fresh log
            $fh = @fopen($path, 'a+b'); // could not rotate: keep appending
            if (!$fh) return null;
            if (!flock($fh, LOCK_EX)) { fclose($fh); return null; }
        }
        return $fh;
    }
    return null;
}

function ipc_log_inquiry(array $entry): bool {
    foreach ([__DIR__ . '/admin', __DIR__ . '/../admin'] as $dir) {
        if (is_dir($dir)) {
            $path = $dir . '/inquiries.jsonl';
            $line  = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            // json_encode() can still return false; "false . \n" is a bare
            // newline, which inquiries.php skips as empty — a lost lead that
            // also inflates the count. Treat it as the failure it is.
            // NEW-N2-10 (audit 2026-09-27) — a SHORT earlier append (disk
            // full) left no newline, so this line was glued onto it and both
            // were dropped as invalid JSON — and this success then cleared the
            // failure marker, hiding it. Start on a fresh line, under the same
            // lock as the write, and keep the marker when that repair was needed.
            $bytes = false;
            $repaired = false;
            if ($line !== false) {
                $fh = ipc_inquiry_log_open($dir, $path);
                if ($fh) {
                    $st = fstat($fh);
                    if ($st && $st['size'] > 0 && fseek($fh, -1, SEEK_END) === 0 && fread($fh, 1) !== "\n") {
                        $repaired = true;
                    }
                    $w = fwrite($fh, ($repaired ? "\n" : '') . $line . "\n");
                    fflush($fh);
                    flock($fh, LOCK_UN);
                    $bytes = $w === false ? false : $w - ($repaired ? 1 : 0);
                }
                if ($fh) fclose($fh);
            }
            $ok = ($bytes !== false && $bytes === strlen((string)$line) + 1);
            if ($ok && !$repaired) {
                @unlink($dir . '/' . IPC_LOG_FAIL_MARKER);
            } else {
                @file_put_contents($dir . '/' . IPC_LOG_FAIL_MARKER, json_encode([
                    'ts'   => date('c'),
                    'path' => 'admin/inquiries.jsonl',
                ]), LOCK_EX);
            }
            return $ok;
        }
    }
    return false;
}

/**
 * AUDIT-12 (A12-L5-01-1, A12-L5-02-W5-3) — one text field of site-info.json,
 * read with mergeSiteInfo's type rule (NEW-N1-16): a string, or a number taken
 * as text; anything else (an object, a list, true) is NOT an override and the
 * caller uses the shipped value, as the website does. trim() on an array was a
 * TypeError before the lead was mailed or logged, so one hand-edited field
 * cost every quote request while the site looked normal; `true` and a list
 * signed every auto-reply "1" / "Array". Returns null for "not usable".
 */
function ipc_si_text(array $si, string $section, string $key): ?string {
    $sec = $si[$section] ?? null;
    if (!is_array($sec) || !array_key_exists($key, $sec)) return null;
    $v = $sec[$key];
    if (is_int($v) || is_float($v)) $v = (string)$v;
    return is_string($v) ? trim($v) : null;
}

$si        = ipc_site_info();
$toRaw     = ipc_si_text($si, 'contact', 'email') ?? '';
$to        = filter_var($toRaw, FILTER_VALIDATE_EMAIL) ? $toRaw : 'sales@insulationproducts.com';
$bizPhone  = ipc_si_text($si, 'contact', 'phone') ?? '';
if ($bizPhone === '') $bizPhone = '630.771.0700';
// The tel: target. Same rule as mergeSiteInfo / index.php: the owner's
// "Phone (dial link)", and when only the display phone moved off the shipped
// number, a North American dial string derived from it. Stripping the display
// phone to digits dialled "630771070012" for "630.771.0700 ext. 12".
// (A12-L15-18-2)
$bizDial   = ipc_si_text($si, 'contact', 'phoneDial') ?? '';
if ($bizDial === '') $bizDial = '+16307710700';
if ($bizPhone !== '630.771.0700' && $bizDial === '+16307710700') {
    $digits = preg_replace('/\D/', '', $bizPhone);
    $derived = strlen($digits) === 10 ? '+1' . $digits : ((strlen($digits) === 11 && $digits[0] === '1') ? '+' . $digits : '');
    if ($derived !== '') $bizDial = $derived;
}
// contact.fax is in SITE_CLEARABLE: a blank stored value means "no fax line"
// and the auto-reply leaves the Fax line out, as the site does. Only an
// absent or unusable value falls back to the shipped number. (A12-L15-07-1)
$bizFax    = ipc_si_text($si, 'contact', 'fax') ?? '630.771.0701';
// CRLF-strip: company_name comes from admin/settings.php (only trim()ed there)
// and is interpolated into the auto-reply's From: header. A newline in it is
// header injection — verified producing a real Bcc:, which would then silently
// BCC every future auto-reply. Post-auth, but the blast radius is every lead.
// (DEPLOY_READINESS_v2 4.16)
$bizName   = trim(preg_replace('/[\r\n]+/', ' ', ipc_si_text($si, 'company', 'name') ?? ''));
if ($bizName === '') $bizName = 'Insulation Products Corporation';
$bizHours  = ipc_si_text($si, 'hours', 'text') ?? '';
if ($bizHours === '') $bizHours = 'Mon–Fri, 8am–5pm CT';
$ad        = is_array($si['address'] ?? null) ? $si['address'] : [];
// PUB-8 (audit 2026-09-27) — `??` does not catch "", and settings.php writes a
// cleared field as "" (invariant 4). A blank street signed every auto-reply
// ", Bolingbrook, IL". Same rule as the site's mergeSiteInfo: blank = default,
// and a number is text (a street number of 1975 prints as the site prints it).
$adPart    = static function ($v, string $dflt): string {
    if (is_int($v) || is_float($v)) $v = (string)$v;
    $v = is_string($v) ? trim($v) : '';
    return $v !== '' ? $v : $dflt;
};
$bizAddr   = $adPart($ad['street'] ?? '', '250 Gibraltar Dr') . ', ' . $adPart($ad['city'] ?? '', 'Bolingbrook') . ', '
           . $adPart($ad['state'] ?? '', 'IL') . ' ' . $adPart($ad['zip'] ?? '', '60440');

/**
 * A-7.2 — HTML escaping, for the one place in this file that renders HTML.
 *
 * Invariant 10 says `s()` deliberately does NOT escape, because its
 * destinations are a text/plain email and a JSONL line, and that escaping
 * belongs at the render boundary. respond()'s HTML branch IS that boundary and
 * is the first one this file has ever had, so it gets its own function rather
 * than changing what `s()` means.
 */
function hesc($v): string {
    return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Does this caller want a page, or a JSON object?
 *
 * A native form navigation sends `Accept: text/html,…`; `fetch()` with no
 * explicit Accept sends `*&#47;*`, and the two handlers in src/App.jsx set no
 * Accept header — verified, not assumed. So the header is a clean
 * discriminator and needs no extra hidden field on the form.
 *
 * Deliberately a substring test rather than a full q-value parse: the only
 * thing being decided is "did a browser navigate here", every real browser
 * puts `text/html` first, and a wrong answer costs a JSON body to a person or
 * an HTML body to a script that ignores it — not a lost lead.
 */
function ipc_wants_html(): bool {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    return is_string($accept) && stripos($accept, 'text/html') !== false;
}

/**
 * A-7.2 — the single exit for every response this endpoint makes.
 *
 * Both forms carry `method`/`action` deliberately — that native-submit path is
 * the reason A-5.3 exists. A-5.3 made it SUCCEED; it did not make the visitor
 * able to tell, because `Content-Type: application/json` was set
 * unconditionally and there was no HTML branch anywhere in the file. Measured
 * with JavaScript off: the lead was captured and the buyer was left on a white
 * page reading `{"ok":true}`, with no confirmation, no phone number and no way
 * back.
 *
 * The page is deliberately self-contained with inline styles: it is served at
 * /contact.php, so the SPA's bundle and stylesheet are not loaded, and the one
 * situation it exists for is the one where JavaScript did not run.
 */
function respond(int $code, array $payload): void {
    global $bizPhone, $bizDial, $bizName, $to;
    if ($code !== 200) http_response_code($code);

    if (!ipc_wants_html()) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload);
        exit;
    }

    $ok    = !empty($payload['ok']);
    // PUB-9 (audit 2026-09-27) — the no-JS page said "Message sent" for a quote
    // request and hardcoded "one business day", ignoring the confirmation the
    // owner edits in Page Content (copy.contactForm.*SuccessBody), which the
    // JS form shows. Same text now; the defaults match COPY_DEFAULTS in App.jsx.
    $isRfq = (is_string($_POST['form_type'] ?? null) ? $_POST['form_type'] : '') === 'rfq';
    $cfCopy = ipc_contact_copy();
    $title = $ok ? ($isRfq ? 'Quote request sent' : 'Message sent') : 'We could not send that';
    $dfltBody = $isRfq
        ? 'Your quote request has been received. Our sales team will review the details and respond within one business day — often the same day for in-stock items.'
        : 'Your message has been received. Our sales team will respond within one business day.';
    $msg   = $ok
        ? ipc_copy_line($cfCopy, $isRfq ? 'rfqSuccessBody' : 'msgSuccessBody', $dfltBody)
        : (string)($payload['error'] ?? 'Something went wrong. Please call us and we will help you directly.');
    // A cleared confirmation falls back to the SAME default the JS form shows
    // (mergeContent drops "" for these keys). A shorter sentence here left the
    // no-JS buyer without the response promise. (A12-L5-05-2)
    if ($ok && $msg === '') $msg = $dfltBody;

    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
       . '<meta name="viewport" content="width=device-width, initial-scale=1">'
       . '<meta name="robots" content="noindex">'
       . '<title>' . hesc($title) . ' — ' . hesc($bizName) . '</title></head>'
       . '<body style="margin:0;background:#f8fafc;font-family:system-ui,-apple-system,\'Segoe UI\',sans-serif;color:#141414;line-height:1.55">'
       . '<div style="max-width:38rem;margin:0 auto;padding:2.5rem 1.5rem">'
       . '<h1 style="font-size:1.4rem;margin:0 0 .75rem">' . hesc($title) . '</h1>'
       . '<p style="margin:0 0 1.25rem;padding:.75rem 1rem;background:#fff;border:1px solid #e5e9ee;border-radius:6px">'
       . hesc($msg) . '</p>'
       . '<p style="margin:0 0 .4rem"><strong>Phone</strong> <a href="tel:' . hesc($bizDial)
       . '" style="color:#0a2240">' . hesc($bizPhone) . '</a></p>'
       . '<p style="margin:0 0 1.25rem"><strong>Email</strong> <a href="mailto:' . hesc($to)
       . '" style="color:#0a2240">' . hesc($to) . '</a></p>'
       . '<p style="margin:0"><a href="/" style="color:#0a2240">← Back to ' . hesc($bizName) . '</a>'
       . ' &nbsp;·&nbsp; <a href="/contact" style="color:#0a2240">Back to the contact form</a></p>'
       . '</div></body></html>';
    exit;
}

// ── POST only ──────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

// ── Sanitise helpers ───────────────────────────────────────────
// Declared before the guards below because those guards log the lead, and the
// logged values have to be trimmed and capped the same way the accepted ones are.
//
// This destination is a text/plain email plus a JSON log line. NEITHER is HTML,
// so escaping here is wrong twice over:
//   - strip_tags() ate "<1/4 inch and >" out of a real quote request. This
//     company sells tubing sized in fractions of an inch; the size spec is
//     exactly what got deleted, silently, and the quote went out wrong.
//   - htmlspecialchars() turned  1/2" wall  into  1/2&quot; wall  and
//     O'Brien & Sons into O&#039;Brien &amp; Sons, which admin/inquiries.php
//     then escaped AGAIN into  O&amp;#039;Brien &amp;amp; Sons .
// Escaping belongs at the render boundary, and inquiries.php already has h().
// Strip only CR/LF and control characters — that is what actually matters here,
// because these values are interpolated into mail headers and JSONL lines.
// (DEPLOY_READINESS_v2 T2.5)
//
// NO /u MODIFIER. The T2.5 rewrite added one, and preg_replace() returns NULL
// on any subject that is not valid UTF-8 — so a single malformed byte turned
// this into an unauthenticated HTTP 500 with an empty body and nothing logged.
// The character class here is pure ASCII, so byte-wise is not just safe, it is
// what we actually mean. The ?? '' is belt and braces for that null. It was
// `?: ''`, which ALSO replaced the string "0" — PHP's falsy string — so a
// quantity of 0 was refused as missing and a company or part number of 0 was
// dropped from the email and the log. (AUDIT_v3_FINDINGS NB6; A12-L4-06-2)
//
// LENGTH CAPS. .user.ini allows a 32MB POST and nothing here bounded a field:
// a single 1MB message produced a 1,049,617-byte email and a 1,048,735-byte
// log line, and a handful of those filled the inquiry log. Truncation is
// announced in the value itself so nobody quotes half a spec back to a
// customer without knowing it was cut. (AUDIT_v3_FINDINGS B3)
// A-5.17 — this file stamps every inquiry record and every mail body, and it
// does not include admin/config.php, so it needs the timezone of its own. UTC
// (PHP's fallback when date.timezone is unset) put every lead five or six hours
// ahead of the business that received it.
if (!defined('IPC_TIMEZONE')) define('IPC_TIMEZONE', 'America/Chicago');
@date_default_timezone_set(IPC_TIMEZONE);

// DEP-2 (audit 2026-09-27) — the ENVELOPE sender, i.e. sendmail's -f. It is
// what SPF is checked against and what DMARC aligns with the From: above.
// Without it the host MTA picks its own, so SPF on insulationproducts.com is
// never consulted for these messages.
//
// OFF ON PURPOSE — do not "fix" by filling it in. Setting it BEFORE the
// domain's SPF record authorises Network Solutions' outbound servers makes
// every quote notification fail SPF outright, which is worse than today.
// Turn it on only when GO-LIVE §A's SPF step is ticked: set it to
// 'noreply@insulationproducts.com', rebuild, and upload contact.php.
// `_harness/dep2-envelope.js` asserts it ships as ''.
if (!defined('IPC_ENVELOPE_FROM')) define('IPC_ENVELOPE_FROM', '');
$mailParams = IPC_ENVELOPE_FROM !== '' ? '-f' . IPC_ENVELOPE_FROM : '';

define('IPC_MAX_LINE', 200);    // name, email, phone, company, subject, part…
define('IPC_MAX_TEXT', 5000);   // message, additionalNotes, specialReqs

/**
 * "Please add a subject and a message." — naming only what is actually absent.
 *
 * The single combined sentence this replaces ("Name, a valid email address,
 * and a message are required.") named every required field whether or not the
 * sender had supplied it, so someone who typed everything but a subject was
 * told their name and email were missing too and went looking for a fault in
 * the fields that were fine. The React handler renders this string verbatim
 * (4.5), so it is the whole of what the visitor sees.
 * (audit-runs/audit1.md A-04)
 */
function ipc_missing_message(array $missing): string {
    $n = count($missing);
    if ($n === 1) return 'Please add ' . $missing[0] . '.';
    $last = array_pop($missing);
    return 'Please add ' . implode(', ', $missing) . ' and ' . $last . '.';
}

/**
 * The first $max BYTES of $v, never ending inside a multi-byte UTF-8 character.
 * A bare substr() split "ó" at the cap, and the resulting invalid UTF-8 made
 * mime_header() return '' — the sales notification went out with an EMPTY
 * Subject for a long Spanish subject line. (A12-L3-15-1) mbstring is not
 * assumed (A-9.P2-1), so this walks the bytes itself.
 */
function ipc_utf8_cut(string $v, int $max): string {
    if (strlen($v) <= $max) return $v;
    $cut = substr($v, 0, $max);
    $i = strlen($cut) - 1;
    $cont = 0;
    while ($i >= 0 && $cont < 3 && (ord($cut[$i]) & 0xC0) === 0x80) { $i--; $cont++; }
    if ($i >= 0) {
        $b = ord($cut[$i]);
        $need = $b >= 0xF0 ? 4 : ($b >= 0xE0 ? 3 : ($b >= 0xC0 ? 2 : 1));
        if ($need > 1 && $need !== $cont + 1) $cut = substr($cut, 0, $i);
    }
    return $cut;
}

/**
 * The Inquiries note for a submission refused for missing fields. The
 * "mistyped email" explanation is given only when the email address is what
 * was refused; a quote request missing only its quantity used to tell Rick to
 * doubt a perfectly good address, and that the customer "thinks they
 * submitted" although they were shown the error. (A12-L8-09-4)
 */
function ipc_incomplete_note(array $missing): string {
    $note = 'Refused because required fields were missing or unusable (' . implode('; ', $missing) . '). ';
    if (in_array('a valid email address', $missing, true)) {
        $note .= 'Often a mistyped email address that the browser accepted and the server did not — '
               . 'a real customer who thinks they submitted. ';
    } else {
        $note .= 'The visitor was shown which field to fill in, so a complete request may follow. ';
    }
    return $note . 'No email was sent. Worth a call back.';
}

function s($val, int $max = IPC_MAX_LINE): string {
    if (is_array($val)) return '';           // 4.17: an array here used to be a fatal
    if (is_object($val)) return '';
    $v = trim((string)$val);
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $v) ?? '';
    if ($max > 0 && strlen($v) > $max) {
        $v = rtrim(ipc_utf8_cut($v, $max)) . ' … [truncated — the visitor sent more than '
           . $max . ' characters; please reply and ask for the rest]';
    }
    return $v;
}

/**
 * A visitor value shortened to fit inside a mail Subject, WITHOUT the
 * "[truncated — the visitor sent more than 200 characters …]" note. hdr() runs
 * s() over the WHOLE assembled Subject, so a 150-character subject plus a name
 * crossed the 200 cap and the note told sales to ask for "the rest" of a
 * message whose body was complete — and cut the sender's name off. Each part
 * is capped here so the assembled line stays under the cap. (A12-L8-08-3)
 */
function ipc_subject_part(string $v, int $max): string {
    $v = trim(preg_replace('/[\r\n]+/', ' ', $v) ?? '');
    return strlen($v) > $max ? rtrim(ipc_utf8_cut($v, $max - 3)) . '…' : $v;
}

/**
 * Invalid UTF-8 bytes replaced by "?", valid sequences kept. Byte-wise, no /u
 * (NB6). Used by mime_header() so one stray byte cannot empty a Subject.
 * (A12-L3-15-1)
 */
function ipc_utf8_scrub(string $v): string {
    $r = preg_replace_callback(
        '/([\x00-\x7F]|[\xC2-\xDF][\x80-\xBF]|\xE0[\xA0-\xBF][\x80-\xBF]|[\xE1-\xEC\xEE\xEF][\x80-\xBF]{2}'
        . '|\xED[\x80-\x9F][\x80-\xBF]|\xF0[\x90-\xBF][\x80-\xBF]{2}|[\xF1-\xF3][\x80-\xBF]{3}|\xF4[\x80-\x8F][\x80-\xBF]{2})|./s',
        static function ($m) { return ($m[1] ?? '') !== '' ? $m[1] : '?'; },
        $v
    );
    return $r ?? '';
}

// Single-line variant for anything that reaches a mail header (Subject,
// From, Reply-To). CRLF here is header injection. (4.16)
function hdr($val): string {
    return trim(preg_replace('/[\r\n]+/', ' ', s($val)) ?: '');
}

/**
 * PUB-5 (audit 2026-09-27) — a header value as RFC 2047 encoded-words when it
 * is not plain ASCII. The Subject carried raw 8-bit UTF-8 (the em dash on every
 * message, and the visitor's name), which strict MTAs reject or mangle. Takes
 * an ALREADY hdr()-cleaned value. Split on character boundaries into words of
 * at most 45 bytes (60 once base64'd), joined by a space — no folding, so mail()
 * sees one line. mbstring is not assumed (A-9.P2-1).
 */
function mime_header(string $v): string {
    if (!preg_match('/[^\x20-\x7E]/', $v)) return $v;
    // On invalid UTF-8 preg_match_all(/u) fails and the Subject came out
    // EMPTY. Scrub, then split. (A12-L3-15-1)
    if (!preg_match_all('/./us', $v, $m)) {
        $v = ipc_utf8_scrub($v);
        if (!preg_match('/[^\x20-\x7E]/', $v)) return $v;
        if (!preg_match_all('/./us', $v, $m)) return $v;
    }
    $words = [];
    $cur = '';
    foreach ($m[0] as $ch) {
        if (strlen($cur) + strlen($ch) > 45) { $words[] = $cur; $cur = ''; }
        $cur .= $ch;
    }
    if ($cur !== '') $words[] = $cur;
    return implode(' ', array_map(static function ($w) { return '=?UTF-8?B?' . base64_encode($w) . '?='; }, $words));
}

// Third destination: a BODY slot inside the auto-reply.
//
// s() keeps newlines on purpose — its destinations are a text/plain mail to
// IPC and a JSONL record, and `<1/4 inch and >2 inch ID` must survive intact
// (invariant 10). hdr() covers header values. But the auto-reply is the one
// mail whose RECIPIENT the visitor chooses, and it echoes visitor text back,
// so those two rules left a third case uncovered: an anonymous POST could put
// freely line-broken prose into the body of a mail sent from this domain, with
// its SPF/DKIM, to any address. Measured: a forged "invoice overdue — pay
// online now" notice arrived intact at a third party. (audit-runs/audit5.md
// A-5.1)
//
// Collapse every whitespace run — newlines included — to a single space and cap
// short. A real quote confirmation still reads correctly; a forged notice
// cannot be assembled, because nothing the sender supplies can open a line of
// its own. Applied ONLY to the reply's copies: the sales notification and the
// inquiry record keep the value exactly as it was typed.
function reply_slot($val, int $max = 80): string {
    // No /u — a non-UTF-8 byte made preg_replace() return null and 500 (NB6).
    $v = preg_replace('/\s+/', ' ', s($val));
    $v = trim($v === null ? '' : $v);
    if ($v === '') return '';
    // A link is what turns a mangled fragment into a working phish: it is the
    // one payload that survives being quoted inside someone else's template,
    // and it arrives carrying this domain's reputation. None of the slots this
    // function guards — the sender's name, a part number, a material, a
    // quantity, a date — has any legitimate reason to contain one.
    $v = preg_replace('~\b(?:https?://|ftp://|mailto:|www\.)\S*~i', '[link removed]', $v);
    // A-5.1 covered SCHEMES; this covers what was left, and
    // what is left is what actually lands. Measured against the shipped
    // function: `evil-example.com/ipc-pay` and `ipc-billing.net/pay` passed
    // straight through, and so did `xhttps://evil.example/pay` — the word
    // boundary above does not fire between `x` and `h`. Outlook and Gmail both
    // autolink a bare domain.tld/path in a text/plain body, so a surviving
    // token is a live, clickable link carrying this domain's reputation.
    //
    // The first label must be 2+ characters so an initial keeps working:
    // `J. Smith` and `J.Smith` are names, `evil.com` is not. That is a real
    // trade — `Jo.Smith` would be redacted — and it is the right way round,
    // because none of the five slots this guards (sender name, part number,
    // material, quantity, required-by date) has any legitimate reason to
    // contain a host, while every one of them can contain a person's name.
    // The 2+ letter TLD is what keeps `8.0 mil` and `1.5` intact.
    // (audit-runs/audit6.md A-6.3)
    $v = preg_replace(
        '~[a-z0-9][a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}(?:[/?#]\S*)?~i',
        '[link removed]',
        $v
    );
    $v = trim($v === null ? '' : $v);
    if ($v === '') return '';
    // mbstring is present on every supported host, but it is an extension and
    // not guaranteed; fall back to a byte cut rather than fatalling. A split
    // multibyte character here is cosmetic — this value's only destination is a
    // text/plain body, never JSON, so nothing downstream can fail on it.
    $mb = function_exists('mb_strlen') && function_exists('mb_substr');
    if ($mb && mb_strlen($v, 'UTF-8') > $max) {
        return rtrim(mb_substr($v, 0, $max, 'UTF-8')) . '…';
    }
    if (!$mb && strlen($v) > $max) {
        return rtrim(substr($v, 0, $max)) . '...';
    }
    return $v;
}

// The auto-reply cap's key — the MAILBOX, not the string that was typed.
//
// This value is used for ONE thing: md5()'d into the per-recipient cap
// filename. The auto-reply is still SENT to the address exactly as submitted,
// and ipc_log_inquiry() still records it exactly as submitted. Rewriting either
// of those would corrupt the lead record Rick works from — the whole point of
// inquiries.jsonl is that it is what the customer actually typed. (4.15b)
//
// Dot-stripping is GMAIL-FAMILY ONLY, deliberately. Dots are significant almost
// everywhere else, and collapsing them would merge genuinely different people
// at the same company onto one cap — silently denying a real prospect their
// confirmation email to fix a spam nuisance, which is the worse trade.
function ipc_ar_cap_key(string $email): string {
    $email = strtolower(trim($email));
    // rstrpos: an @ is legal inside a quoted local part, so the domain is what
    // follows the LAST one.
    $at = strrpos($email, '@');
    if ($at === false) return $email;          // not an address shape; key on it as-is
    $local  = substr($email, 0, $at);
    $domain = substr($email, $at + 1);
    // A12-L3-W2-G3-1 — RFC 5322 quoting is spelling, not a different mailbox:
    // "joe"@x, "\joe"@x and joe@x are one inbox, and FILTER_VALIDATE_EMAIL
    // accepts all of them, so each new quoting was a fresh cap of 3. Unquote,
    // resolving backslash escapes, before keying.
    if (strlen($local) >= 2 && $local[0] === '"' && substr($local, -1) === '"') {
        $local = preg_replace('/\\\\(.)/s', '$1', substr($local, 1, -1)) ?? $local;
    }
    // Everything from the first "+" to the "@" is a sub-address tag.
    $plus = strpos($local, '+');
    if ($plus !== false) $local = substr($local, 0, $plus);
    if ($domain === 'gmail.com' || $domain === 'googlemail.com') {
        $local = str_replace('.', '', $local);
        // A12-L3-02-2 — the two spellings of the domain are one inbox too.
        $domain = 'gmail.com';
    }
    return $local . '@' . $domain;
}

// Whatever we know about a rejected submission, shaped like a log entry so a
// lead that hits a guard is still recoverable from admin/inquiries.php.
function ipc_partial_entry(string $type, string $note, string $ip): array {
    // UX-11 (admin audit 2026-10-05) — a refused QUOTE request kept only name,
    // email and the notes, so a rate-limited RFQ (the office-NAT customer this
    // entry exists for) lost its part number and quantity. Keep them, under the
    // keys inquiries.php already shows for a quote, capped like the message.
    $rfq = (is_string($_POST['form_type'] ?? null) ? $_POST['form_type'] : '') === 'rfq';
    $extra = !$rfq ? [] : [
        'form'     => 'rfq',
        'part'     => s($_POST['partNumber'] ?? '', 200),
        'material' => s($_POST['material'] ?? '', 200),
        'quantity' => s($_POST['quantity'] ?? '', 200),
        'reqDate'  => s($_POST['requiredDate'] ?? '', 200),
        'special'  => s($_POST['specialReqs'] ?? '', 500),
        'notes'    => s($_POST['additionalNotes'] ?? '', 500),
    ];
    return [
        'ts'      => date('Y-m-d H:i:s'),
        'type'    => $type,
        'name'    => s($_POST['name'] ?? ''),
        'company' => s($_POST['company'] ?? ''),
        'email'   => s($_POST['email'] ?? ''),
        'phone'   => s($_POST['phone'] ?? ''),
        'subject' => s($_POST['subject'] ?? ''),
        // A-5.25 — a rejected submission is kept so a real lead caught by a
        // guard is still recoverable, but it does not need the full 5,000
        // characters: at the 5-per-10-minute cap that is ~11.5MB a day per IP
        // of permanent growth, and rotated archives are deliberately never
        // deleted. 500 characters is plenty to recognise a genuine enquiry and
        // ask the sender to resend, and it cuts the worst-case growth ~10x.
        'message' => s($_POST['message'] ?? $_POST['additionalNotes'] ?? '', 500),
        'ip'      => $ip,
        'sent'    => false,
        'note'    => $note,
    ] + $extra;
}

// ── Rate limit: 5 per IP per 10 minutes ───────────────────────
// This now runs FIRST, ahead of the referer and honeypot checks, because both
// of those used to exit before ever reaching it: 20 honeypot POSTs created
// zero rate-limit files and extrapolated to ~5.3 MB/min of inquiry log from a
// single IP. Every rejected request consumes a slot now.
// (AUDIT_v3_FINDINGS B3)
//
// A rejection is logged too — the file's own comment above says a 403 that
// exits before ipc_log_inquiry() loses the lead, and the 429 had exactly the
// same hole: five engineers behind one corporate NAT file RFQs inside ten
// minutes and the sixth vanishes with no record anywhere. But an unbounded
// "log every rejection" is the flood the rate limiter exists to stop, so the
// number of rejections logged per IP per window is itself capped.
// (AUDIT_v3_FINDINGS NB8)
/**
 * The limiter's KEY for an address — the same rule as the admin sign-in
 * throttle's login_throttle_key() (SEC-6, SEC-A1 in admin/config.php, which
 * this file does not include): IPv4 as-is, a v4-mapped IPv6 address as its
 * IPv4, any other IPv6 address as its /64. A single customer is routinely
 * handed a whole /64, so keying the full address gave one connection 2^64
 * fresh allowances of 5. The inquiry record still carries the real address.
 * (A12-L3-W2-G1-1)
 */
function ipc_rl_key(string $ip): string {
    if (strpos($ip, ':') === false || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) return $ip;
    $bin = @inet_pton($ip);
    if ($bin === false || strlen($bin) !== 16) return $ip;
    if (substr($bin, 0, 12) === str_repeat("\0", 10) . "\xff\xff") return inet_ntop(substr($bin, 12));
    return inet_ntop(substr($bin, 0, 8) . str_repeat("\0", 8)) . '/64';
}

$ip       = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$safeIp   = preg_replace('/[^a-fA-F0-9:.\/]/', '', ipc_rl_key(is_string($ip) ? $ip : 'unknown'));
$rateFile = sys_get_temp_dir() . '/ipc_rl_' . md5($safeIp) . '.json';
$now      = time();
$window   = 600; // seconds
$maxHits  = 5;
$maxLogged = 10; // rejected submissions logged per IP per window

// PUB-13 (audit 2026-09-27) — one lock per IP, held from this read until the
// request ends (PHP releases it on exit). The read-modify-write held nothing
// across the read, and on a multi-worker server a burst from one address got
// 17 submissions through a cap of 5. Requests from the SAME address now queue;
// nobody else waits.
// Lock files carry their own prefix (ipc_lk_), NOT ipc_rl_/ipc_ar_: those
// prefixes mean "one limiter record" to anything counting them, and
// plan3-autoreply counts cap files to prove its key normalisation.
$rlLockPath = dirname($rateFile) . '/ipc_lk_' . basename($rateFile);
$rlLock = @fopen($rlLockPath, 'c');
if ($rlLock) @flock($rlLock, LOCK_EX);
// A12-L3-04-W5-1 — fopen('c') + flock() do not change the file's mtime, so a
// lock first made two days ago looked stale to ipc_prune_limiter_files() WHILE
// IN USE; it was unlinked mid-burst, later requests locked a fresh file, and
// one address got 10-23 submissions through a cap of 5. Taking the lock now
// marks it as live.
if ($rlLock) @touch($rlLockPath);
$state = ['hits' => [], 'blocked' => 0];
if (file_exists($rateFile)) {
    $raw = json_decode((string)@file_get_contents($rateFile), true);
    if (is_array($raw)) {
        if (isset($raw['hits']) && is_array($raw['hits'])) {
            $state['hits']    = $raw['hits'];
            $state['blocked'] = (int)($raw['blocked'] ?? 0);
        } else {
            $state['hits'] = $raw;   // legacy format: a bare array of timestamps
        }
    }
}
// Drop timestamps outside the window
$state['hits'] = array_values(array_filter($state['hits'], function ($t) use ($now, $window) {
    return ($now - (int)$t) < $window;
}));
if (empty($state['hits'])) $state['blocked'] = 0;   // the window rolled over

/** Persist the limiter state; used by every exit path below. */
function ipc_rl_save(string $file, array $state): bool {
    $json  = json_encode($state);
    if ($json === false) return false;
    $bytes = @file_put_contents($file, $json, LOCK_EX);
    return $bytes !== false && $bytes === strlen($json);
}

/**
 * Both limiters keep their state in the shared temp dir behind @-suppressed
 * writes, and nothing checked whether the write landed or ever removed a file.
 * Two consequences, and they pull in opposite directions:
 *
 *  - If the write fails — temp dir not writable under this host's open_basedir
 *    or TMPDIR, or the account's inode quota reached — the next request reads
 *    an absent file, counts zero hits, and BOTH controls are simply off, with
 *    nothing anywhere reporting it.
 *  - Nothing pruned, so one file accumulated per distinct visitor IP and per
 *    distinct auto-reply recipient, forever, in the same directory as PHP's
 *    session files. That is an inode-quota attack from an unauthenticated
 *    form, and inode exhaustion is itself the condition in the first bullet.
 *
 * Prune on roughly 1 request in 25 — often enough to stay bounded under real
 * traffic, rare enough that a scandir() is not on the hot path.
 * (audit-runs/audit5.md A-5.9)
 */
function ipc_prune_limiter_files(int $now): void {
    if (mt_rand(1, 25) !== 1) return;
    $dir = sys_get_temp_dir();
    $h   = @opendir($dir);
    if (!$h) return;
    $cutoff = 86400 * 2;          // both windows (10 min, 24 h) are well inside this
    // A12-L15-19-1 — the budget used to count EVERY directory entry, and
    // readdir() order is stable, so on a temp dir with 500+ unrelated files
    // (other sites' sessions) ahead of ours every sweep re-read the same
    // slice and no limiter file was ever examined. The budget now counts only
    // limiter files; the scan itself has a far larger bound of its own.
    $budget = 500;                 // limiter files examined per sweep
    $scan   = 50000;               // never let a sweep run away on a huge temp dir
    while ($budget > 0 && $scan-- > 0 && ($f = readdir($h)) !== false) {
        if (strncmp($f, 'ipc_rl_', 7) !== 0 && strncmp($f, 'ipc_ar_', 7) !== 0 && strncmp($f, 'ipc_lk_', 7) !== 0) continue;
        $budget--;
        $full = $dir . '/' . $f;
        $mt   = @filemtime($full);
        if ($mt !== false && ($now - $mt) > $cutoff) @unlink($full);
    }
    closedir($h);
}

ipc_prune_limiter_files($now);

if (count($state['hits']) >= $maxHits) {
    if ($state['blocked'] < $maxLogged) {
        $state['blocked']++;
        // UX-11 (admin audit 2026-10-05) — rate-limited entries now raise the
        // owner's new-inquiries badge (they are "worth a call back"). A bot
        // that trips the limit would raise it up to $maxLogged times a window,
        // so one that ALSO filled the hidden spam field is logged as the spam
        // it is. The residual risk — a bot that leaves that field empty — is
        // recorded in WHATS_LEFT §1ap.
        ipc_log_inquiry(ipc_partial_entry(
            !empty($_POST['website']) ? 'honeypot' : 'rate-limited',
            'Refused by the 5-per-10-minutes rate limit — this may be a real customer sharing an office '
            . 'internet connection with someone who just submitted. No email was sent. Worth a call back.',
            $ip
        ));
    }
    ipc_rl_save($rateFile, $state);
    respond(429, ['ok' => false, 'error' => "Too many submissions. Please try again in a few minutes, or call {$bizPhone} directly."]);
}
$state['hits'][] = $now;
// A-5.9 — if the state cannot be persisted, the rate limit is not enforcing.
// The lead intake deliberately still FAILS OPEN here: refusing submissions
// because a temp file will not write would lose real quote requests, which is
// the one outcome this whole file exists to prevent. The AUTO-REPLY, which is
// the outbound-to-a-stranger half, fails CLOSED instead — see below.
$limiterPersisted = ipc_rl_save($rateFile, $state);

// ── Same-origin referer check ──────────────────────────────────
// An ABSENT Referer is not evidence of abuse. Privacy extensions,
// `Referrer-Policy: no-referrer` and corporate TLS proxies all strip it, and
// the old code 403'd those visitors with the literal word "Forbidden" — which
// the React handler then showed in a browser alert() instead of the friendly
// fallback containing the phone number, AND the lead was never logged because
// the 403 exited before ipc_log_inquiry(). A missing header now passes.
//
// The old present-header test was `strpos($referer, $host) === false`, a bare
// substring match: `Referer: https://evil.example/?x=insulationproducts.com`
// passed it. Compare the parsed HOST instead. (DEPLOY_READINESS_v2 T2.6)
// An UNPARSEABLE Referer is not evidence of abuse either. `garbage`, a
// path-only value and `android-app://com.google.android.gm` all have no host,
// and all three used to 403 — the same reasoning as the absent header above,
// applied to headers that arrive mangled instead of stripped. Only a Referer
// that parses to a DIFFERENT host is a cross-site post.
// (AUDIT_v3_FINDINGS NB9)
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$host    = $_SERVER['HTTP_HOST']    ?? '';
if (is_string($referer) && $referer !== '' && $host !== '') {
    $refScheme = strtolower((string)parse_url($referer, PHP_URL_SCHEME));
    $refHost   = parse_url($referer, PHP_URL_HOST);
    $ownHost   = strtolower(preg_replace('/:\d+$/', '', $host));
    $refHost   = strtolower((string)$refHost);
    // Only http(s) referrers describe a web origin we can compare against.
    // `android-app://com.google.android.gm` parses to a perfectly good host that
    // is simply not a website — Gmail for Android sends it, and it was being
    // treated as an attack. Anything that is not http/https is "absent".
    if ($refScheme !== '' && $refScheme !== 'http' && $refScheme !== 'https') $refHost = '';
    // Accept the host itself and any subdomain of it (www. ↔ apex).
    $sameSite = $refHost === '' || (
        $refHost === $ownHost
        || substr($refHost, -strlen('.' . $ownHost)) === '.' . $ownHost
        || substr($ownHost, -strlen('.' . $refHost)) === '.' . $refHost
    );
    if (!$sameSite) {
        // Log BEFORE returning. The comment above names this exact bug and only
        // the absent-Referer half of it was fixed. (AUDIT_v3_FINDINGS NB8)
        ipc_log_inquiry(ipc_partial_entry(
            'blocked-referer',
            'Refused because the browser said it came from another website (' . s($refHost) . '). '
            . 'Usually a spam bot, occasionally a real customer behind an unusual proxy. No email was sent.',
            $ip
        ));
        respond(403, ['ok' => false, 'error' => 'This form can only be submitted from the ' . $bizName . ' website. Please call ' . $bizPhone . ' if this keeps happening.']);
    }
}

// ── Honeypot ───────────────────────────────────────────────────
// The "website" field is hidden from humans (off-screen CSS in the form).
// Bots that fill every field will populate it; we silently accept and discard.
//
// This block sits BELOW the rate limiter on purpose. It used to exit above it,
// so honeypot POSTs never created or consumed a slot and were completely
// unlimited. (AUDIT_v3_FINDINGS B3)
if (!empty($_POST['website'])) {
    // Log it. A human who autofills a hidden field (some password managers do)
    // used to see the full success page while the lead was thrown away with no
    // record anywhere that it ever existed. (DEPLOY_READINESS_v2 4.18)
    ipc_log_inquiry(ipc_partial_entry(
        'honeypot',
        'Rejected by the spam honeypot. Almost certainly a bot — but check it before deleting.',
        $ip
    ));
    respond(200, ['ok' => true]);
}

// ── Routing ────────────────────────────────────────────────────
// 4.17: trim() on an array threw a TypeError → unauthenticated HTTP 500 that
// leaked the server path when display_errors is on. Guard the type.
$formType = is_string($_POST['form_type'] ?? null) ? trim($_POST['form_type']) : 'message';

if ($formType === 'rfq') {

    // ── RFQ form ───────────────────────────────────────────────
    $name        = s($_POST['name']            ?? '');
    // is_string() guard: `email[]=a@b.test` reached trim() as an array and threw
    // an uncaught TypeError — an unauthenticated 500 with path disclosure, the
    // same defect class 4.17 claims to have closed for form_type only.
    // (AUDIT_v3_FINDINGS NB7)
    $rawEmail    = s($_POST['email'] ?? '');
    $email       = filter_var($rawEmail, FILTER_VALIDATE_EMAIL) ? $rawEmail : '';
    $phone       = s($_POST['phone']           ?? '');
    $company     = s($_POST['company']         ?? '');
    $partNumber  = s($_POST['partNumber']      ?? '');
    $material    = s($_POST['material']        ?? '');
    $quantity    = s($_POST['quantity']        ?? '');
    $reqDate     = s($_POST['requiredDate']    ?? '');
    $specialReqs = s($_POST['specialReqs']     ?? '', IPC_MAX_TEXT);
    $notes       = s($_POST['additionalNotes'] ?? '', IPC_MAX_TEXT);

    // `quantity` carries `required` on the rendered input (src/App.jsx
    // rfq-quantity) and was checked NOWHERE on the server, so any submission
    // that did not come from the browser form — a bot, a replayed request, a
    // browser with validation disabled — reached sales as a quote request with
    // a blank quantity, which is the one field a quote cannot be produced
    // without. The client rule and the server rule now name the same fields.
    // (audit-runs/audit1.md A-04)
    $missing = [];
    if ($name === '')     $missing[] = 'your name';
    if ($email === '')    $missing[] = 'a valid email address';
    if ($quantity === '') $missing[] = 'the quantity required';
    if ($missing) {
        // A-7.1 — record it before exiting. Every OTHER rejection in this file
        // logs first — the 429, the 403, the honeypot, the 500 — each with a
        // comment saying why, because each was a defect once. A-5.3's own
        // words: "That exit happens before mail() AND before the inquiry log,
        // so the lead was not merely undelivered, it left no trace at all."
        // A-5.3 fixed one CAUSE of reaching the 422 and did not change the
        // exit.
        //
        // It is reachable by a real customer, not just a malformed client,
        // because the browser and the server disagree about what an email
        // address is: HTML5 deliberately permits a dotless domain (intranet
        // addresses are legal), so type="email" ACCEPTS `jane@acmecorp` and
        // hands the form over, and FILTER_VALIDATE_EMAIL then rejects it. A
        // dropped ".com" is an ordinary typo.
        ipc_log_inquiry(ipc_partial_entry(
            'rfq-incomplete',
            ipc_incomplete_note($missing),
            $ip
        ));
        respond(422, ['ok' => false, 'error' => ipc_missing_message($missing)]);
    }

    // Parts capped so the assembled Subject stays under hdr()'s 200-byte cap
    // (22 + 100 + 5 + 70). The body carries both values in full. (A12-L8-08-3)
    $subject = mime_header(hdr('IPC Quote Request — ' . ($partNumber !== '' ? ipc_subject_part($partNumber, 100) : 'General RFQ') . ' — ' . ipc_subject_part($name, 70)));
    $body    = "IPC QUOTE REQUEST\n"
             . "=================\n\n"
             . "Name:            {$name}\n"
             . "Company:         {$company}\n"
             . "Email:           {$email}\n"
             . "Phone:           {$phone}\n\n"
             . "Part Number:     {$partNumber}\n"
             . "Material Type:   {$material}\n"
             . "Quantity:        {$quantity}\n"
             . "Required By:     {$reqDate}\n\n"
             . "Special Requirements:\n{$specialReqs}\n\n"
             . "Additional Notes:\n{$notes}\n\n"
             . "---\n"
             . "Submitted: " . date('Y-m-d H:i:s T') . "\n"
             . "IP:        {$ip}\n";

    $replyTo = $email;

    $logEntry = [
        'ts'      => date('Y-m-d H:i:s'),
        'type'    => 'rfq',
        'name'    => $name,
        'company' => $company,
        'email'   => $email,
        'phone'   => $phone,
        'part'    => $partNumber,
        'material'=> $material,
        'quantity'=> $quantity,
        'reqDate' => $reqDate,
        'special' => $specialReqs,
        'notes'   => $notes,
        'ip'      => $ip,
    ];

} else {

    // ── General message form ───────────────────────────────────
    $name    = s($_POST['name']    ?? '');
    $rawEmail = s($_POST['email'] ?? '');   // is_string() guard — see NB7 above
    $email   = filter_var($rawEmail, FILTER_VALIDATE_EMAIL) ? $rawEmail : '';
    $phone   = s($_POST['phone']   ?? '');
    $company = s($_POST['company'] ?? '');
    $subj    = s($_POST['subject'] ?? '');
    $message = s($_POST['message'] ?? '', IPC_MAX_TEXT);

    // `subject` is the RFQ `quantity` case again: `required` on the rendered
    // input (src/App.jsx msg-subject), unchecked here. A subject-less
    // submission mailed with a blank "Subject:" line in the body and the
    // generic "General Inquiry" in the header, so the one line that tells sales
    // what the message is about was silently droppable. (audit-runs/audit1.md A-04)
    $missing = [];
    if ($name === '')    $missing[] = 'your name';
    if ($email === '')   $missing[] = 'a valid email address';
    if ($subj === '')    $missing[] = 'a subject';
    if ($message === '') $missing[] = 'a message';
    if ($missing) {
        // A-7.1 — record it before exiting. Every OTHER rejection in this file
        // logs first — the 429, the 403, the honeypot, the 500 — each with a
        // comment saying why, because each was a defect once. A-5.3's own
        // words: "That exit happens before mail() AND before the inquiry log,
        // so the lead was not merely undelivered, it left no trace at all."
        // A-5.3 fixed one CAUSE of reaching the 422 and did not change the
        // exit.
        //
        // It is reachable by a real customer, not just a malformed client,
        // because the browser and the server disagree about what an email
        // address is: HTML5 deliberately permits a dotless domain (intranet
        // addresses are legal), so type="email" ACCEPTS `jane@acmecorp` and
        // hands the form over, and FILTER_VALIDATE_EMAIL then rejects it. A
        // dropped ".com" is an ordinary typo.
        ipc_log_inquiry(ipc_partial_entry(
            'message-incomplete',
            ipc_incomplete_note($missing),
            $ip
        ));
        respond(422, ['ok' => false, 'error' => ipc_missing_message($missing)]);
    }

    // Parts capped as for the RFQ above (21 + 100 + 5 + 70). (A12-L8-08-3)
    $subject = mime_header(hdr('IPC Contact Form — ' . ($subj !== '' ? ipc_subject_part($subj, 100) : 'General Inquiry') . ' — ' . ipc_subject_part($name, 70)));
    $body    = "IPC CONTACT FORM\n"
             . "================\n\n"
             . "Name:    {$name}\n"
             . "Company: {$company}\n"
             . "Email:   {$email}\n"
             . "Phone:   {$phone}\n"
             . "Subject: {$subj}\n\n"
             . "Message:\n{$message}\n\n"
             . "---\n"
             . "Submitted: " . date('Y-m-d H:i:s T') . "\n"
             . "IP:        {$ip}\n";

    $replyTo = $email;

    $logEntry = [
        'ts'      => date('Y-m-d H:i:s'),
        'type'    => 'message',
        'name'    => $name,
        'company' => $company,
        'email'   => $email,
        'phone'   => $phone,
        'subject' => $subj,
        'message' => $message,
        'ip'      => $ip,
    ];
}

// ── Send to the sales team ──────────────────────────────────────
// Reply-To is set to the visitor's email so sales can reply directly.
// From is a no-reply on the domain — Network Solutions requires the From
// address to exist on the account to pass their outbound spam filter, so it
// stays hardcoded even though the recipient is configurable.
$headers  = "From: IPC Website <noreply@insulationproducts.com>\r\n";
$headers .= "Reply-To: " . hdr($replyTo) . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "Content-Transfer-Encoding: 8bit\r\n"; // NEW-V3-2 — the body is 8-bit UTF-8; say so
// X-Mailer removed. It served no delivery purpose and announced the exact
// PHP patch level — to the SALES address on one path, and on the other to any
// address a stranger types into the form, who only has to submit it once to
// read the version off their own auto-reply. Both .htaccess files already turn
// off ServerSignature and unset X-Powered-By; this was the hole in that same
// posture. (audit-runs/audit5.md, Low tier)


// A12-L2-W1-G3-1 — on PHP 8 a host that lists mail() in disable_functions
// removes it outright, and calling it was a fatal error BEFORE the inquiry
// log below: no email, no Inquiries row, no marker. Treat it as a failed send
// so the record is written and the visitor gets the call-us answer.
$sent = function_exists('mail')
    ? @mail($to, $subject, $body, $headers, $mailParams) // @ — a mail warning must never corrupt the JSON response
    : false;

// Log the inquiry whether or not the mail went through — a failed send is
// exactly the case where the log is the only surviving copy of the lead.
$logEntry['sent'] = (bool)$sent;
ipc_log_inquiry($logEntry);

if (!$sent) {
    respond(500, [
        'ok'    => false,
        'error' => "The mail server could not send your message. Please call {$bizPhone} or email {$to} directly.",
    ]);
}

// ── Auto-reply to visitor ───────────────────────────────────────
// Best-effort only — we never fail the request if this one doesn't go through.
//
// Rate-limited PER RECIPIENT, not just per IP. The old code would mail any
// address the submitter typed, from this company's domain, capped only by the
// 5-per-IP window — i.e. a rotating-IP botnet could use the site to email-bomb
// a third party under IPC's name and burn the domain's sending reputation.
// (DEPLOY_READINESS_v2 4.15)
//
// The cap keyed on the address AS SUBMITTED, which Gmail's own addressing
// rules defeat: a@gmail.com, a+1@gmail.com and a.b@gmail.com are one mailbox,
// so a sender cycling +1/+2/+3 got a fresh auto-reply every time and the
// per-recipient cap bounded nothing. ipc_ar_cap_key() normalises for the KEY
// ONLY — see the function. (4.15b)
$autoReplyOk = true;
if ($replyTo !== '') {
    $arFile = sys_get_temp_dir() . '/ipc_ar_' . md5(ipc_ar_cap_key($replyTo)) . '.json';
    $arWindow = 86400;   // 24 hours
    $arMax    = 3;
    // PUB-13 — the same for the per-recipient auto-reply cap (7 sent against a
    // cap of 3, measured on prefork).
    $arLockPath = dirname($arFile) . '/ipc_lk_' . basename($arFile);
    $arLock = @fopen($arLockPath, 'c');
    if ($arLock) @flock($arLock, LOCK_EX);
    if ($arLock) @touch($arLockPath);   // live, not stale — see the per-IP lock above
    $ar = [];
    if (file_exists($arFile)) {
        $ar = json_decode((string)@file_get_contents($arFile), true);
        if (!is_array($ar)) $ar = [];
    }
    $ar = array_values(array_filter($ar, function ($t) use ($now, $arWindow) {
        return ($now - (int)$t) < $arWindow;
    }));
    // A-5.9 — no persisted cap means no cap. Sending anyway would put an
    // uncapped outbound channel, addressed by a stranger, on this domain's
    // reputation; not sending costs the sender a courtesy confirmation while
    // the lead itself is already captured (sales notification + inquiry log,
    // both above). Fail closed.
    if (!$limiterPersisted) {
        $autoReplyOk = false;
    }
    if (count($ar) >= $arMax) {
        $autoReplyOk = false;      // the sales notification above already went out
    } else {
        $ar[] = $now;
        // Same rule: if the updated cap cannot be stored, do not send — the
        // next request would read a missing file and start counting from zero.
        $arJson  = json_encode($ar);
        $arBytes = $arJson === false ? false : @file_put_contents($arFile, $arJson, LOCK_EX);
        if ($arBytes === false || $arBytes !== strlen((string)$arJson)) $autoReplyOk = false;
    }
}
// PLAN-6 item 3. The prose is editable; the REQUEST SUMMARY below is not, and
// that split is deliberate — the summary is data, and a templating syntax in an
// admin textarea is a way to produce broken emails. The subject stays built by
// the code for the same reason, which is also why none of these needs hdr().
$arCopy    = ipc_contact_copy();
$rfqPromise = ipc_copy_line($arCopy, 'autoReplyRfqPromise',
    'Our sales team will review your request and respond within one business day — often the same day for in-stock items.');
$msgPromise = ipc_copy_line($arCopy, 'autoReplyMsgPromise',
    'Our team will respond within one business day.');
// Optional and empty by default: a temporary line for a shutdown or a backlog.
// An empty value must add NOTHING — not a blank paragraph, not a stray rule —
// or every auto-reply carries a gap for the 51 weeks a notice is not needed.
$notice     = ipc_copy_line($arCopy, 'autoReplyNotice', '');
$noticePara = $notice === '' ? '' : "{$notice}\n\n";
// A promise cleared to empty falls back rather than leaving the reader with no
// idea when to expect an answer. Clearing it is almost certainly a mistake, and
// unlike the notice there is no reading under which "say nothing" is right.
if ($rfqPromise === '') $rfqPromise = 'Our sales team will review your request and respond within one business day — often the same day for in-stock items.';
if ($msgPromise === '') $msgPromise = 'Our team will respond within one business day.';

// A-5.1 — every visitor-supplied value that reaches THIS body is neutralised
// first. The sales notification built above still carries the raw text, and so
// does the JSONL record, so nothing IPC needs is lost.
// A fax cleared in Business Details leaves the line out (A12-L15-07-1).
$faxLine = $bizFax === '' ? '' : "  Fax:   {$bizFax}\n";

$rName = reply_slot($name, 60);
if ($rName === '') $rName = 'there';

if ($formType === 'rfq') {
    $replySubject = mime_header(hdr("We received your quote request — {$bizName}"));
    $replyBody    = "Hello {$rName},\n\n"
                  . "Thank you for submitting a quote request to {$bizName}.\n\n"
                  . "{$rfqPromise}\n\n"
                  . $noticePara
                  . "YOUR REQUEST SUMMARY\n"
                  . "--------------------\n"
                  . "Part Number:   " . reply_slot($partNumber, 80) . "\n"
                  . "Material Type: " . reply_slot($material, 80) . "\n"
                  . "Quantity:      " . reply_slot($quantity, 80) . "\n"
                  . "Required By:   " . reply_slot($reqDate, 40) . "\n\n"
                  . "For urgent needs, reach us directly:\n"
                  . "  Phone: {$bizPhone} ({$bizHours})\n"
                  . $faxLine
                  . "  Email: {$to}\n\n"
                  . "{$bizName}\n"
                  . "{$bizAddr}\n";
} else {
    $replySubject = mime_header(hdr("We received your message — {$bizName}"));
    $replyBody    = "Hello {$rName},\n\n"
                  . "Thank you for contacting {$bizName}.\n\n"
                  . "{$msgPromise}\n\n"
                  . $noticePara
                  . "For urgent needs, reach us directly:\n"
                  . "  Phone: {$bizPhone} ({$bizHours})\n"
                  . $faxLine
                  . "  Email: {$to}\n\n"
                  . "{$bizName}\n"
                  . "{$bizAddr}\n";
}

// RFC 5322 quoting on the display name. hdr() closes header INJECTION (4.16)
// but adds no quoting, so an unquoted name containing a comma — "Insulation
// Products, Inc." is the obvious one — parses as an address LIST: "Insulation
// Products" and "Inc. <noreply@…>". Strict MTAs reject that, and mail() here is
// best-effort and @-suppressed, so every auto-reply would simply stop with
// nothing reporting it. Quote it, and escape any quote or backslash inside.
// (audit-runs/audit5.md, Low tier)
// PUB-5 — a quoted-string display name must be ASCII; a non-ASCII company
// name goes out as encoded-words instead (which may not sit inside quotes).
$fromName      = preg_match('/[^\x20-\x7E]/', hdr($bizName))
    ? mime_header(hdr($bizName))
    : '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], hdr($bizName)) . '"';
$replyHeaders  = "From: " . $fromName . " <noreply@insulationproducts.com>\r\n";
$replyHeaders .= "Reply-To: " . hdr($to) . "\r\n";
$replyHeaders .= "MIME-Version: 1.0\r\n";
$replyHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
$replyHeaders .= "Content-Transfer-Encoding: 8bit\r\n"; // NEW-V3-2


if ($autoReplyOk && function_exists('mail')) {
    @mail($replyTo, $replySubject, $replyBody, $replyHeaders, $mailParams); // best-effort, no error check
}

respond(200, ['ok' => true]);
