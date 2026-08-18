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

header('Content-Type: application/json; charset=utf-8');
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

function ipc_log_inquiry(array $entry): void {
    foreach ([__DIR__ . '/admin', __DIR__ . '/../admin'] as $dir) {
        if (is_dir($dir)) {
            $path = $dir . '/inquiries.jsonl';
            if (is_file($path) && @filesize($path) >= IPC_INQUIRY_ROTATE_BYTES) {
                @rename($path, $dir . '/inquiries-' . date('Y-m-d-His') . '.jsonl');
            }
            @file_put_contents(
                $path,
                json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . "\n",
                FILE_APPEND | LOCK_EX
            );
            return;
        }
    }
}

$si        = ipc_site_info();
$toRaw     = trim($si['contact']['email'] ?? '');
$to        = filter_var($toRaw, FILTER_VALIDATE_EMAIL) ? $toRaw : 'sales@insulationproducts.com';
$bizPhone  = trim($si['contact']['phone'] ?? '') !== '' ? trim($si['contact']['phone']) : '630.771.0700';
$bizFax    = trim($si['contact']['fax'] ?? '')   !== '' ? trim($si['contact']['fax'])   : '630.771.0701';
// CRLF-strip: company_name comes from admin/settings.php (only trim()ed there)
// and is interpolated into the auto-reply's From: header. A newline in it is
// header injection — verified producing a real Bcc:, which would then silently
// BCC every future auto-reply. Post-auth, but the blast radius is every lead.
// (DEPLOY_READINESS_v2 4.16)
$bizName   = trim(preg_replace('/[\r\n]+/', ' ', (string)($si['company']['name'] ?? '')));
if ($bizName === '') $bizName = 'Insulation Products Corporation';
$bizHours  = trim($si['hours']['text'] ?? '')    !== '' ? trim($si['hours']['text'])    : 'Mon-Fri, 8am-5pm CT';
$ad        = $si['address'] ?? [];
$bizAddr   = trim(($ad['street'] ?? '250 Gibraltar Dr') . ', ' . ($ad['city'] ?? 'Bolingbrook') . ', '
           . ($ad['state'] ?? 'IL') . ' ' . ($ad['zip'] ?? '60440'));

// ── POST only ──────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
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
// what we actually mean. The ?: '' is belt and braces. (AUDIT_v3_FINDINGS NB6)
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

function s($val, int $max = IPC_MAX_LINE): string {
    if (is_array($val)) return '';           // 4.17: an array here used to be a fatal
    if (is_object($val)) return '';
    $v = trim((string)$val);
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $v) ?: '';
    if ($max > 0 && strlen($v) > $max) {
        $v = rtrim(substr($v, 0, $max)) . ' … [truncated — the visitor sent more than '
           . $max . ' characters; please reply and ask for the rest]';
    }
    return $v;
}

// Single-line variant for anything that reaches a mail header (Subject,
// From, Reply-To). CRLF here is header injection. (4.16)
function hdr($val): string {
    return trim(preg_replace('/[\r\n]+/', ' ', s($val)) ?: '');
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
    // Everything from the first "+" to the "@" is a sub-address tag.
    $plus = strpos($local, '+');
    if ($plus !== false) $local = substr($local, 0, $plus);
    if ($domain === 'gmail.com' || $domain === 'googlemail.com') {
        $local = str_replace('.', '', $local);
    }
    return $local . '@' . $domain;
}

// Whatever we know about a rejected submission, shaped like a log entry so a
// lead that hits a guard is still recoverable from admin/inquiries.php.
function ipc_partial_entry(string $type, string $note, string $ip): array {
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
    ];
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
$ip       = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$safeIp   = preg_replace('/[^a-fA-F0-9:.]/', '', $ip);
$rateFile = sys_get_temp_dir() . '/ipc_rl_' . md5($safeIp) . '.json';
$now      = time();
$window   = 600; // seconds
$maxHits  = 5;
$maxLogged = 10; // rejected submissions logged per IP per window

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
    $budget = 500;                 // never let a sweep run away on a huge temp dir
    while ($budget-- > 0 && ($f = readdir($h)) !== false) {
        if (strncmp($f, 'ipc_rl_', 7) !== 0 && strncmp($f, 'ipc_ar_', 7) !== 0) continue;
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
        ipc_log_inquiry(ipc_partial_entry(
            'rate-limited',
            'Refused by the 5-per-10-minutes rate limit — this may be a real customer sharing an office '
            . 'internet connection with someone who just submitted. No email was sent. Worth a call back.',
            $ip
        ));
    }
    ipc_rl_save($rateFile, $state);
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => "Too many submissions. Please try again in a few minutes, or call {$bizPhone} directly."]);
    exit;
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
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'This form can only be submitted from the ' . $bizName . ' website. Please call ' . $bizPhone . ' if this keeps happening.']);
        exit;
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
    echo json_encode(['ok' => true]);
    exit;
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
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => ipc_missing_message($missing)]);
        exit;
    }

    $subject = hdr('IPC Quote Request — ' . ($partNumber !== '' ? $partNumber : 'General RFQ') . ' — ' . $name);
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
        http_response_code(422);
        echo json_encode(['ok' => false, 'error' => ipc_missing_message($missing)]);
        exit;
    }

    $subject = hdr('IPC Contact Form — ' . ($subj !== '' ? $subj : 'General Inquiry') . ' — ' . $name);
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
$headers .= "X-Mailer: PHP/" . PHP_VERSION . "\r\n";

$sent = @mail($to, $subject, $body, $headers); // @ — a mail warning must never corrupt the JSON response

// Log the inquiry whether or not the mail went through — a failed send is
// exactly the case where the log is the only surviving copy of the lead.
$logEntry['sent'] = (bool)$sent;
ipc_log_inquiry($logEntry);

if (!$sent) {
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => "The mail server could not send your message. Please call {$bizPhone} or email {$to} directly.",
    ]);
    exit;
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
$rName = reply_slot($name, 60);
if ($rName === '') $rName = 'there';

if ($formType === 'rfq') {
    $replySubject = hdr("We received your quote request — {$bizName}");
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
                  . "  Fax:   {$bizFax}\n"
                  . "  Email: {$to}\n\n"
                  . "{$bizName}\n"
                  . "{$bizAddr}\n";
} else {
    $replySubject = hdr("We received your message — {$bizName}");
    $replyBody    = "Hello {$rName},\n\n"
                  . "Thank you for contacting {$bizName}.\n\n"
                  . "{$msgPromise}\n\n"
                  . $noticePara
                  . "For urgent needs, reach us directly:\n"
                  . "  Phone: {$bizPhone} ({$bizHours})\n"
                  . "  Fax:   {$bizFax}\n"
                  . "  Email: {$to}\n\n"
                  . "{$bizName}\n"
                  . "{$bizAddr}\n";
}

$replyHeaders  = "From: " . hdr($bizName) . " <noreply@insulationproducts.com>\r\n";
$replyHeaders .= "Reply-To: " . hdr($to) . "\r\n";
$replyHeaders .= "MIME-Version: 1.0\r\n";
$replyHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
$replyHeaders .= "X-Mailer: PHP/" . PHP_VERSION . "\r\n";

if ($autoReplyOk) {
    @mail($replyTo, $replySubject, $replyBody, $replyHeaders); // best-effort, no error check
}

echo json_encode(['ok' => true]);
