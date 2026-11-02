<?php
require_once 'config.php';
require_auth();

/**
 * Inquiry log viewer — every contact-form / RFQ submission is appended to
 * admin/inquiries.jsonl by public_html/contact.php (sent or failed), so a
 * mail() failure never silently loses a lead. Newest first.
 */

// PLAN-13 Phase 6 — the window the search and filters look through. It was
// the 200 shown on one page; the list now pages 25 at a time, so the window
// can be the most recent 1,000 (about 1 MB of the 2 MB tail read below).
$MAX_SHOW = 1000;
// A filter request from listfilter.js: it must not count as looking at the
// leads again (see "New" below).
$isFetch = ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch';
$newCount = 0;

// inq_tail_lines(), inq_split(), inq_apply_result() and INQ_TAIL_BYTES now
// live in config.php: the Overview reads the newest leads too (PLAN-13
// Phase 8). The reasoning for each stays with them there.

/**
 * Total entries, counted by streaming — O(1) memory on any file size.
 * A send-result line (AUDIT-12 decision 42) is part of the row before it, not
 * an entry of its own. json_encode() escapes every quote inside a value, so
 * the literal `"type":"send-result"` can only be that row's own field.
 */
function inq_count_lines(string $path): int {
    $fh = @fopen($path, 'rb');
    if (!$fh) return 0;
    $n = 0;
    while (($line = fgets($fh)) !== false) {
        if (substr($line, -1) !== "\n") break;   // an unterminated tail is not counted
        if (strpos($line, '"type":"send-result"') !== false) continue;
        $n++;
    }
    fclose($fh);
    return $n;
}

$entries = [];
$total   = 0;
$sendResults = [];   // id => sent, from the send-result lines (decision 42)
if (file_exists(INQUIRIES_FILE)) {
    $total = inq_count_lines(INQUIRIES_FILE);
    // A-5.6 — viewing the page is what clears the nav badge.
    // SEC-10 (audit 2026-09-27) — but only a view that started HERE. The
    // session cookie is SameSite=Lax, so a link on any other site opened this
    // page signed in and silently cleared the "new" badge on unread leads.
    // `Sec-Fetch-Site` is sent by every current browser; `none` is a typed URL
    // or a bookmark. A browser that sends no header keeps the old behaviour.
    $fetchSite = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if (!$isFetch) $newCount = inquiries_new_count();   // before the mark below clears it
    if (!$isFetch && ($fetchSite === '' || $fetchSite === 'same-origin' || $fetchSite === 'none')) {
        inquiries_mark_seen($total);
    }
    // Twice the lines: since decision 42 a lead can be two (row + result).
    $entries = inq_split(inq_tail_lines(INQUIRIES_FILE, 2 * $MAX_SHOW), $sendResults);
    if (count($entries) > $MAX_SHOW) $entries = array_slice($entries, -$MAX_SHOW);
}
$entries = array_reverse($entries); // newest first

// contact.php rotates the live log at 16MB. Surface the archives so Rick knows
// the older leads still exist and where.
$archives = glob(dirname(INQUIRIES_FILE) . '/inquiries-*.jsonl') ?: [];

// A12-L4-W5-R2-4-1 — the day the log rotated, this page went from 200 leads
// to 1, yesterday's included, while Help calls it the place a lead "is still
// on" when email breaks. Fill the window from the newest archives, as the
// Activity Log does with its own (NEW-N2-11). Archive names are
// inquiries-<Y-m-d-His>[-<n>].jsonl; sort on (stamp, n), not the name — "-2"
// sorts before ".jsonl" (the invariant-5 lesson).
$fromArchive = 0;
if (count($entries) < $MAX_SHOW && $archives) {
    $byAge = $archives;
    usort($byAge, static function ($a, $b) {
        $k = static function ($f) {
            return preg_match('/inquiries-(\d{4}-\d{2}-\d{2}-\d{6})(?:-(\d+))?\.jsonl$/', basename($f), $m)
                ? [$m[1], (int)($m[2] ?? 1)] : ['', 0];
        };
        return $k($b) <=> $k($a);   // newest first
    });
    foreach ($byAge as $a) {
        $need = $MAX_SHOW - count($entries);
        if ($need <= 0) break;
        $more = inq_split(inq_tail_lines($a, 2 * $need), $sendResults);
        if (count($more) > $need) $more = array_slice($more, -$need);
        foreach (array_reverse($more) as $e) { $entries[] = $e; $fromArchive++; }
    }
}
// A row and its result can straddle a rotation, so merge after every file is read.
foreach ($entries as $i => $e) $entries[$i] = inq_apply_result($e, $sendResults);

/* Submissions that were REFUSED by a guard are not delivery failures.
   They were rendered as ordinary messages carrying a red "Email failed" badge,
   their `note` was never displayed, and they counted towards $failed — the
   number Rick watches to know whether mail is broken. One bot visit pinned it
   above zero forever and sent him chasing a mail problem that did not exist.
   (AUDIT_v3_FINDINGS NB10) */
$REJECTED = [
    'honeypot'        => ['label' => 'Spam trap',    'blurb' => 'Caught by the hidden spam field'],
    'rate-limited'    => ['label' => 'Rate limited', 'blurb' => 'Too many submissions from one internet connection'],
    'blocked-referer' => ['label' => 'Blocked',      'blurb' => 'Submitted from another website'],
    // A-7.1 — the two 422 exits log now. They MUST be listed here: an entry
    // this map does not know is counted as a real inquiry with sent=false, so
    // it lands in $failed, the number Rick watches to decide whether mail is
    // broken. That is exactly the NB10 defect described above, and adding the
    // logging without adding these rows would have re-created it.
    'rfq-incomplete'     => ['label' => 'Incomplete', 'blurb' => 'Required details were missing — often an email address the browser accepted and the server did not'],
    'message-incomplete' => ['label' => 'Incomplete', 'blurb' => 'Required details were missing — often an email address the browser accepted and the server did not'],
];
// The keys above must match inquiry_rejected_types() in config.php, which the
// nav badge counts with (NEW-N2-8). Fail loudly in the harness if they drift.
assert(array_keys($REJECTED) == inquiry_rejected_types());
$failed   = 0;
$rejected = 0;
$unconfirmed = 0;
foreach ($entries as $e) {
    if (isset($REJECTED[$e['type'] ?? ''])) { $rejected++; continue; }
    // Decision 42 — a row whose send result was never written is not a
    // refusal the mail server reported; it is counted on its own.
    if (($e['status'] ?? '') === 'pending') { $unconfirmed++; continue; }
    if (empty($e['sent'])) $failed++;
}

// ── PLAN-13 Phase 6 (§2 F1): search, filters, paging, new leads ────────────
// The filters are query-string parameters, applied here, so they work with
// JavaScript off and survive a reload, Back and a bookmark; listfilter.js
// applies them as you type by fetching this same page. The stats above stay
// those of the whole window: a filter narrows the list, not the counts.
$PER_PAGE = 25;
$page   = max(1, (int)as_str($_GET['page'] ?? null));
$fq     = trim(as_str($_GET['q'] ?? null));
$fType  = as_str($_GET['type'] ?? null);     // rfq | message | refused
$fState = as_str($_GET['status'] ?? null);   // sent | failed | pending
$fSince = (int)as_str($_GET['since'] ?? null);
if (!in_array($fType, ['', 'rfq', 'message', 'refused'], true)) $fType = '';
if (!in_array($fState, ['', 'sent', 'failed', 'pending'], true)) $fState = '';
if (!in_array($fSince, [0, 7, 30, 90, 365], true)) $fSince = 0;
$query  = ['q' => $fq, 'type' => $fType, 'status' => $fState, 'since' => $fSince ?: ''];
$filtering = $fq !== '' || $fType !== '' || $fState !== '' || $fSince > 0;

// "New" = arrived since the last visit. Opening this page is what marks the
// leads seen (above), so the newest $newCount badge-worthy rows are picked
// out on the full page load and kept in the session; a filter request
// (listfilter.js) reuses them instead of finding nothing new.
$leadKey = static fn(array $e): string => md5(($e['id'] ?? '') . '|' . ($e['ts'] ?? '') . '|' . ($e['email'] ?? '') . '|' . ($e['name'] ?? ''));
if (!$isFetch) {
    $notBadge = array_flip(array_diff(inquiry_rejected_types(), inquiry_callback_types()));
    $newKeys = [];
    foreach ($entries as $e) {
        if (count($newKeys) >= $newCount) break;
        if (isset($notBadge[$e['type'] ?? ''])) continue;
        $newKeys[] = $leadKey($e);
    }
    $_SESSION['inq_new'] = $newKeys;
}
$newSet = array_flip((array)($_SESSION['inq_new'] ?? []));

$cutoff = $fSince > 0 ? time() - $fSince * 86400 : 0;
$matches = [];
foreach ($entries as $e) {
    $rejE = isset($REJECTED[$e['type'] ?? '']);
    $rfqE = ($e['type'] ?? '') === 'rfq' || ($e['form'] ?? '') === 'rfq';
    if ($fType === 'refused' && !$rejE) continue;
    if ($fType === 'rfq' && ($rejE || !$rfqE)) continue;
    if ($fType === 'message' && ($rejE || $rfqE)) continue;
    if ($fState !== '') {
        if ($rejE) continue;
        $st = ($e['status'] ?? '') === 'pending' ? 'pending' : (!empty($e['sent']) ? 'sent' : 'failed');
        if ($st !== $fState) continue;
    }
    if ($cutoff > 0) {
        $t = strtotime((string)($e['ts'] ?? ''));
        if ($t === false || $t < $cutoff) continue;
    }
    if ($fq !== '') {
        $hay = '';
        foreach (['name', 'company', 'email', 'phone', 'part', 'material', 'quantity', 'reqDate', 'special', 'notes', 'subject', 'message', 'note'] as $k) {
            if (isset($e[$k]) && is_scalar($e[$k])) $hay .= ' ' . $e[$k];
        }
        if (stripos($hay, $fq) === false) continue;
    }
    $matches[] = $e;
}
$matchCount = count($matches);
$pages      = max(1, (int)ceil($matchCount / $PER_PAGE));
if ($page > $pages) $page = $pages;
$shown      = array_slice($matches, ($page - 1) * $PER_PAGE, $PER_PAGE);

?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Inquiries</title>
  <?= admin_head() ?>
  <style>
    .empty { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 40px; text-align: center; color: #4b5563; font-size: var(--fs-3); }
    .inq { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; margin-bottom: 12px; overflow: hidden; }
    .inq summary { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; list-style: none; flex-wrap: wrap; }
    .inq summary::-webkit-details-marker { display: none; }
    .inq summary:hover { background: #f8fafc; }
    .badge { font-size: var(--fs-1); font-weight: 700; padding: 3px 9px; border-radius: 20px; flex-shrink: 0; }
    .badge-rfq { background: rgba(0,93,163,0.1); color: #005da3; }
    .badge-msg { background: rgba(107,114,128,0.12); color: #4b5563; }
    .badge-sent { background: #f0fdf4; color: #166534; }
    .badge-failed { background: #fef2f2; color: #b91c1c; }
    .badge-pending { background: #fffbeb; color: #92400e; }
    /* Blocked/spam entries read as neutral, not as an error to chase. */
    .badge-blocked { background: rgba(107,114,128,0.12); color: #4b5563; }
    .inq-rejected { background: #fafbfc; border-style: dashed; }
    .inq-rejected .who { font-weight: 400; color: #4b5563; }
    .note-box { margin: 0 0 12px; padding: 10px 12px; background: #f8fafc; border-left: 3px solid #d1d9e0; border-radius: 4px; font-size: var(--fs-1); color: #4b5563; line-height: 1.5; }
    .who { font-size: var(--fs-2); font-weight: 600; }
    .who small { color: #4b5563; font-weight: 400; }
    .when { margin-left: auto; font-size: var(--fs-1); color: #4b5563; flex-shrink: 0; }
    .detail { border-top: 1px solid #eef2f6; padding: 16px 18px; }
    .detail table { border-collapse: collapse; width: 100%; }
    .detail th { text-align: left; font-size: var(--fs-1); color: #4b5563; padding: 5px 14px 5px 0; vertical-align: top; white-space: nowrap; width: 130px; }
    .detail td { font-size: var(--fs-2); color: #374151; padding: 5px 0; white-space: pre-wrap; word-break: break-word; }
    .detail a { color: #005da3; }
    .stats { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat { background: #fff; border: 1px solid #e5e9ee; border-radius: 10px; padding: 14px 20px; }
    .stat-num { font-size: var(--fs-5); font-weight: 800; color: #005da3; }
    .stat-num.bad { color: #b91c1c; }
    .stat-lbl { font-size: var(--fs-1); color: #4b5563; }
    .note { font-size: var(--fs-1); color: #4b5563; margin-top: 16px; }
    /* PLAN-13 Phase 6 — a lead that arrived since the last visit. */
    .inq-new { border-color: #93c5fd; box-shadow: inset 4px 0 0 var(--brand); }
    .badge-new { background: var(--brand); color: #fff; }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main class="admin-wide">
  <h1>Inquiries</h1>
  <p class="sub">Every quote request and message submitted through the website's contact form — including ones the mail server failed to deliver, so no lead is ever lost. Reply from your own email client.</p>

  <div class="stats">
    <div class="stat"><div class="stat-num"><?= $total ?></div><div class="stat-lbl">Total received</div></div>
    <div class="stat"><div class="stat-num <?= $failed > 0 ? 'bad' : '' ?>"><?= $failed ?></div><div class="stat-lbl">Mail server refused<?= ($total > $MAX_SHOW || $fromArchive > 0) ? ' (last ' . count($entries) . ')' : '' ?></div></div>
    <?php if ($rejected > 0): ?>
      <div class="stat"><div class="stat-num"><?= $rejected ?></div><div class="stat-lbl">Refused by the form<?= ($total > $MAX_SHOW || $fromArchive > 0) ? ' (last ' . count($entries) . ')' : '' ?></div></div>
    <?php endif; ?>
  </div>
  <?php if ($failed > 0): ?>
    <?php /* A12-L9-W5-G4-1 — name the tile on screen (A-5.6 renamed it from
             "Email delivery failed") and say what to do, as Help does. */ ?>
    <p class="sub" style="margin:-8px 0 20px">"Mail server refused" counts only genuine send failures: the notification email for those requests did not go out. Each one is still listed below, so the lead is safe — reply to it from your own email. If this number keeps growing, tell your developer; the website's mail setup needs fixing. Submissions the website blocked as spam are listed separately and are not a mail problem.</p>
  <?php endif; ?>

  <?php if ($unconfirmed > 0): ?>
    <p class="sub" style="margin:-8px 0 20px"><?= $unconfirmed ?> request<?= $unconfirmed === 1 ? ' is' : 's are' ?> marked "Not confirmed": the website saved the request, then the mail server took so long that the website never heard whether the notification email went out. The request is safe here — reply to it from your own email in case the notification never arrived.</p>
  <?php endif; ?>

  <?php if (empty($entries)): ?>
    <div class="empty">No inquiries yet. Submissions from the website's contact form will appear here.</div>
  <?php endif; ?>

  <?php if (!empty($entries)): ?>
  <form method="GET" class="list-filters" data-live-filter="#inq-results" role="search" aria-label="Filter inquiries">
    <div class="fld fld-grow">
      <label for="inq-q">Search</label>
      <input type="search" id="inq-q" name="q" value="<?= h($fq) ?>" placeholder="Name, company, email, part number or words from the message" autocomplete="off" />
    </div>
    <div class="fld">
      <label for="inq-type">Type</label>
      <select id="inq-type" name="type">
        <option value="">All types</option>
        <option value="rfq"<?= $fType === 'rfq' ? ' selected' : '' ?>>Quote requests</option>
        <option value="message"<?= $fType === 'message' ? ' selected' : '' ?>>Messages</option>
        <option value="refused"<?= $fType === 'refused' ? ' selected' : '' ?>>Refused by the form</option>
      </select>
    </div>
    <div class="fld">
      <label for="inq-status">Email</label>
      <select id="inq-status" name="status">
        <option value="">Any</option>
        <option value="sent"<?= $fState === 'sent' ? ' selected' : '' ?>>Sent to mail server</option>
        <option value="failed"<?= $fState === 'failed' ? ' selected' : '' ?>>Email failed</option>
        <option value="pending"<?= $fState === 'pending' ? ' selected' : '' ?>>Not confirmed</option>
      </select>
    </div>
    <div class="fld">
      <label for="inq-since">Received</label>
      <select id="inq-since" name="since">
        <option value="">Any time</option>
        <?php foreach ([7 => 'Last 7 days', 30 => 'Last 30 days', 90 => 'Last 3 months', 365 => 'Last 12 months'] as $d => $l): ?>
        <option value="<?= $d ?>"<?= $fSince === $d ? ' selected' : '' ?>><?= $l ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <button type="submit" class="btn btn-primary filter-submit">Filter</button>
    <?php if ($filtering): ?><a href="inquiries.php" class="btn btn-secondary">Clear</a><?php endif; ?>
  </form>
  <?php endif; ?>

  <div id="inq-results" aria-live="polite">
  <?php if (!empty($entries)): ?>
    <p class="list-count"><?php if ($matchCount === 0): ?>Nothing matches these filters.<?php else: ?><?= $filtering ? $matchCount . ' matching' : $matchCount ?> <?= $matchCount === 1 ? 'inquiry' : 'inquiries' ?><?= $pages > 1 ? ' — showing ' . (($page - 1) * $PER_PAGE + 1) . '–' . (($page - 1) * $PER_PAGE + count($shown)) : '' ?>, newest first.<?php if ($newSet): ?> <strong><?= count($newSet) ?> new</strong> since your last visit.<?php endif; ?><?php endif; ?></p>
  <?php endif; ?>
  <?php $lastDay = null; foreach ($shown as $e):
      $type   = $e['type'] ?? '';
      $rej    = $REJECTED[$type] ?? null;
      $isRfq  = $type === 'rfq' || ($e['form'] ?? '') === 'rfq';   // UX-11 — a refused quote keeps its quote fields
      $sent   = !empty($e['sent']);
      $pending = ($e['status'] ?? '') === 'pending';   // decision 42 — no send result was written
      $isNew  = isset($newSet[$leadKey($e)]);
      $day    = substr((string)($e['ts'] ?? ''), 0, 10);
  ?>
  <?php if ($day !== $lastDay): $lastDay = $day; ?><h2 class="day-head"><?= h(admin_day_label((string)($e['ts'] ?? ''))) ?></h2><?php endif; ?>
  <details class="inq<?= $rej ? ' inq-rejected' : '' ?><?= $isNew ? ' inq-new' : '' ?>">
    <summary>
      <?php if ($isNew): ?><span class="badge badge-new">New</span><?php endif; ?>
      <?php if ($rej): ?>
        <span class="badge badge-blocked"><?= h($rej['label']) ?></span>
      <?php else: ?>
        <span class="badge <?= $isRfq ? 'badge-rfq' : 'badge-msg' ?>"><?= $isRfq ? 'Quote' : 'Message' ?></span>
        <?php /* A-5.6 — "Emailed" claimed delivery this code cannot observe.
                 mail() only reports that the local mail server ACCEPTED the
                 message; SPF/DKIM rejection, greylisting and spam-foldering all
                 happen afterwards and all look identical from here. */ ?>
        <?php if ($pending): ?>
          <span class="badge badge-pending" title="The website saved this request, but never heard back from the mail server about the notification email — it may or may not have gone out. Reply from your own email to be safe.">Not confirmed</span>
        <?php else: ?>
        <span class="badge <?= $sent ? 'badge-sent' : 'badge-failed' ?>" title="<?= $sent ? 'Handed to the mail server. That is not proof it reached the inbox — check with the sender if in doubt.' : 'The mail server refused the message outright.' ?>"><?= $sent ? 'Sent to mail server' : 'Email failed' ?></span>
        <?php endif; ?>
      <?php endif; ?>
      <span class="who"><?= h($e['name'] ?? '') !== '' ? h($e['name']) : '—' ?> <small><?= h($e['company'] ?? '') ?></small></span>
      <?php if ($rej): ?><small style="color:#4b5563"><?= h($rej['blurb']) ?></small><?php endif; ?>
      <span class="when"><?= h($e['ts'] ?? '') ?></span>
    </summary>
    <div class="detail">
      <?php if (!empty($e['note'])): ?>
        <p class="note-box"><?= h($e['note']) ?></p>
      <?php endif; ?>
      <table>
        <?php /* A-9.B2-11 — a rejected submission is logged with an empty
                 email, and this printed <a href="mailto:"> around an em dash:
                 a link with no accessible name that goes nowhere. Show the
                 dash as plain text when there is no address to write to. */ ?>
        <tr><th>Email</th><td><?php if (!empty($e['email'])): ?><a href="mailto:<?= h(str_replace('%40', '@', rawurlencode((string)$e['email']))) ?>"><?= h($e['email']) ?></a><?php else: ?>—<?php endif; ?></td></tr>
        <?php if (!empty($e['phone'])): ?><tr><th>Phone</th><td><?= h($e['phone']) ?></td></tr><?php endif; ?>
        <?php if ($isRfq): ?>
          <?php if (!empty($e['part'])): ?><tr><th>Part number</th><td><?= h($e['part']) ?></td></tr><?php endif; ?>
          <?php if (!empty($e['material'])): ?><tr><th>Material</th><td><?= h($e['material']) ?></td></tr><?php endif; ?>
          <?php if (!empty($e['quantity'])): ?><tr><th>Quantity</th><td><?= h($e['quantity']) ?></td></tr><?php endif; ?>
          <?php if (!empty($e['reqDate'])): ?><tr><th>Required by</th><td><?= h($e['reqDate']) ?></td></tr><?php endif; ?>
          <?php if (!empty($e['special'])): ?><tr><th>Special reqs</th><td><?= h($e['special']) ?></td></tr><?php endif; ?>
          <?php if (!empty($e['notes'])): ?><tr><th>Notes</th><td><?= h($e['notes']) ?></td></tr><?php endif; ?>
        <?php else: ?>
          <?php if (!empty($e['subject'])): ?><tr><th>Subject</th><td><?= h($e['subject']) ?></td></tr><?php endif; ?>
          <?php if (!empty($e['message'])): ?><tr><th>Message</th><td><?= h($e['message']) ?></td></tr><?php endif; ?>
        <?php endif; ?>
        <?php if (!empty($e['ip'])): ?><tr><th>Visitor IP</th><td><?= h($e['ip']) ?></td></tr><?php endif; ?>
      </table>
    </div>
  </details>
  <?php endforeach; ?>
  <?= admin_pager($page, $page < $pages, $query) ?>
  </div>

  <?php if ($total > $MAX_SHOW): ?>
    <p class="note">The search and filters look through the <?= $MAX_SHOW ?> most recent of <?= $total ?> inquiries. The full history is kept in <code>admin/inquiries.jsonl</code>.</p>
  <?php endif; ?>
  <?php if ($fromArchive > 0): ?>
    <p class="note">The last <?= $fromArchive ?> shown come from the newest archive file, because the live log was started afresh when it reached its size limit.</p>
  <?php endif; ?>
  <?php if ($archives): ?>
    <p class="note">Older inquiries have been moved into <?= count($archives) ?> archive file<?= count($archives) === 1 ? '' : 's' ?>
      (<?= h(implode(', ', array_map('basename', $archives))) ?>) in the <code>admin</code> folder. Nothing is ever deleted —
      ask your developer if you need to look inside one.</p>
  <?php endif; ?>
</main>
<script src="listfilter.js"></script>
</body>
</html>
