<?php
require_once 'config.php';
require_auth();

/**
 * Inquiry log viewer — every contact-form / RFQ submission is appended to
 * admin/inquiries.jsonl by public_html/contact.php (sent or failed), so a
 * mail() failure never silently loses a lead. Newest first.
 */

$MAX_SHOW = 200;

// Read only the TAIL of the log, never the whole thing.
// file() loads every line into memory at once: measured, a 43MB / 20,000-entry
// log still rendered, and a 65MB one died with "Allowed memory size of
// 134217728 bytes exhausted … on line 15" — i.e. the page Rick relies on as the
// "no lead is ever lost" safety net goes permanently blank, and his only
// recovery is FTP-deleting the file that holds every real lead.
// 2MB is ~4,000 entries, comfortably more than $MAX_SHOW.
// (AUDIT_v3_FINDINGS B3)
define('INQ_TAIL_BYTES', 2 * 1024 * 1024);

/** Last $maxLines JSONL lines of $path, reading at most INQ_TAIL_BYTES. */
function inq_tail_lines(string $path, int $maxLines): array {
    $fh = @fopen($path, 'rb');
    if (!$fh) return [];
    $size  = (int)@filesize($path);
    $start = max(0, $size - INQ_TAIL_BYTES);
    if ($start > 0) fseek($fh, $start);
    $buf = (string)stream_get_contents($fh);
    fclose($fh);
    if ($start > 0) {
        $nl  = strpos($buf, "\n");            // drop the half-line we landed in
        $buf = $nl === false ? '' : substr($buf, $nl + 1);
    }
    $lines = preg_split('/\r\n|\n|\r/', $buf, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    return count($lines) > $maxLines ? array_slice($lines, -$maxLines) : $lines;
}

/** Total entries, counted by streaming — O(1) memory on any file size. */
function inq_count_lines(string $path): int {
    $fh = @fopen($path, 'rb');
    if (!$fh) return 0;
    $n = 0;
    while (($chunk = fread($fh, 1024 * 1024)) !== false && $chunk !== '') {
        $n += substr_count($chunk, "\n");
    }
    fclose($fh);
    return $n;
}

$entries = [];
$total   = 0;
if (file_exists(INQUIRIES_FILE)) {
    $total = inq_count_lines(INQUIRIES_FILE);
    foreach (inq_tail_lines(INQUIRIES_FILE, $MAX_SHOW) as $line) {
        $e = json_decode($line, true);
        if (is_array($e)) $entries[] = $e;
    }
}
$entries = array_reverse($entries); // newest first

// contact.php rotates the live log at 16MB. Surface the archives so Rick knows
// the older leads still exist and where.
$archives = glob(dirname(INQUIRIES_FILE) . '/inquiries-*.jsonl') ?: [];

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
];
$failed   = 0;
$rejected = 0;
foreach ($entries as $e) {
    if (isset($REJECTED[$e['type'] ?? ''])) { $rejected++; continue; }
    if (empty($e['sent'])) $failed++;
}

$navActive = 'inquiries';
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
    .empty { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 40px; text-align: center; color: #9ca3af; font-size: 14px; }
    .inq { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; margin-bottom: 12px; overflow: hidden; }
    .inq summary { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; list-style: none; flex-wrap: wrap; }
    .inq summary::-webkit-details-marker { display: none; }
    .inq summary:hover { background: #f8fafc; }
    .badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 20px; flex-shrink: 0; }
    .badge-rfq { background: rgba(0,93,163,0.1); color: #005da3; }
    .badge-msg { background: rgba(107,114,128,0.12); color: #4b5563; }
    .badge-sent { background: #f0fdf4; color: #166534; }
    .badge-failed { background: #fef2f2; color: #dc2626; }
    /* Blocked/spam entries read as neutral, not as an error to chase. */
    .badge-blocked { background: rgba(107,114,128,0.12); color: #6b7280; }
    .inq-rejected { background: #fafbfc; border-style: dashed; }
    .inq-rejected .who { font-weight: 400; color: #6b7280; }
    .note-box { margin: 0 0 12px; padding: 10px 12px; background: #f8fafc; border-left: 3px solid #d1d9e0; border-radius: 4px; font-size: 12px; color: #4b5563; line-height: 1.5; }
    .who { font-size: 13px; font-weight: 600; }
    .who small { color: #6b7280; font-weight: 400; }
    .when { margin-left: auto; font-size: 12px; color: #9ca3af; flex-shrink: 0; }
    .detail { border-top: 1px solid #eef2f6; padding: 16px 18px; }
    .detail table { border-collapse: collapse; width: 100%; }
    .detail th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; padding: 5px 14px 5px 0; vertical-align: top; white-space: nowrap; width: 130px; }
    .detail td { font-size: 13px; color: #374151; padding: 5px 0; white-space: pre-wrap; word-break: break-word; }
    .detail a { color: #005da3; }
    .stats { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat { background: #fff; border: 1px solid #e5e9ee; border-radius: 10px; padding: 14px 20px; }
    .stat-num { font-size: 20px; font-weight: 800; color: #005da3; }
    .stat-num.bad { color: #dc2626; }
    .stat-lbl { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; }
    .note { font-size: 12px; color: #9ca3af; margin-top: 16px; }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main class="admin-wide">
  <h1>Inquiries</h1>
  <p class="sub">Every quote request and message submitted through the website's contact form — including ones the mail server failed to deliver, so no lead is ever lost. Reply from your own email client.</p>

  <div class="stats">
    <div class="stat"><div class="stat-num"><?= $total ?></div><div class="stat-lbl">Total received</div></div>
    <div class="stat"><div class="stat-num <?= $failed > 0 ? 'bad' : '' ?>"><?= $failed ?></div><div class="stat-lbl">Email delivery failed<?= $total > $MAX_SHOW ? ' (last ' . $MAX_SHOW . ')' : '' ?></div></div>
    <?php if ($rejected > 0): ?>
      <div class="stat"><div class="stat-num"><?= $rejected ?></div><div class="stat-lbl">Blocked as spam<?= $total > $MAX_SHOW ? ' (last ' . $MAX_SHOW . ')' : '' ?></div></div>
    <?php endif; ?>
  </div>
  <?php if ($failed > 0): ?>
    <p class="sub" style="margin:-8px 0 20px">“Email delivery failed” counts only genuine send failures. Submissions the website blocked as spam are listed separately and are not a mail problem.</p>
  <?php endif; ?>

  <?php if (empty($entries)): ?>
    <div class="empty">No inquiries yet. Submissions from the website's contact form will appear here.</div>
  <?php endif; ?>

  <?php foreach ($entries as $e):
      $type   = $e['type'] ?? '';
      $rej    = $REJECTED[$type] ?? null;
      $isRfq  = $type === 'rfq';
      $sent   = !empty($e['sent']);
  ?>
  <details class="inq<?= $rej ? ' inq-rejected' : '' ?>">
    <summary>
      <?php if ($rej): ?>
        <span class="badge badge-blocked"><?= h($rej['label']) ?></span>
      <?php else: ?>
        <span class="badge <?= $isRfq ? 'badge-rfq' : 'badge-msg' ?>"><?= $isRfq ? 'Quote' : 'Message' ?></span>
        <span class="badge <?= $sent ? 'badge-sent' : 'badge-failed' ?>"><?= $sent ? 'Emailed' : 'Email failed' ?></span>
      <?php endif; ?>
      <span class="who"><?= h($e['name'] ?? '') !== '' ? h($e['name']) : '—' ?> <small><?= h($e['company'] ?? '') ?></small></span>
      <?php if ($rej): ?><small style="color:#9ca3af"><?= h($rej['blurb']) ?></small><?php endif; ?>
      <span class="when"><?= h($e['ts'] ?? '') ?></span>
    </summary>
    <div class="detail">
      <?php if (!empty($e['note'])): ?>
        <p class="note-box"><?= h($e['note']) ?></p>
      <?php endif; ?>
      <table>
        <tr><th>Email</th><td><a href="mailto:<?= h($e['email'] ?? '') ?>"><?= h($e['email'] ?? '—') ?></a></td></tr>
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

  <?php if ($total > $MAX_SHOW): ?>
    <p class="note">Showing the <?= $MAX_SHOW ?> most recent of <?= $total ?> inquiries. The full history is kept in <code>admin/inquiries.jsonl</code>.</p>
  <?php endif; ?>
  <?php if ($archives): ?>
    <p class="note">Older inquiries have been moved into <?= count($archives) ?> archive file<?= count($archives) === 1 ? '' : 's' ?>
      (<?= h(implode(', ', array_map('basename', $archives))) ?>) in the <code>admin</code> folder. Nothing is ever deleted —
      ask your developer if you need to look inside one.</p>
  <?php endif; ?>
</main>
</body>
</html>
