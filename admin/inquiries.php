<?php
require_once 'config.php';
require_auth();

/**
 * Inquiry log viewer — every contact-form / RFQ submission is appended to
 * admin/inquiries.jsonl by public_html/contact.php (sent or failed), so a
 * mail() failure never silently loses a lead. Newest first.
 */

$MAX_SHOW = 200;

$entries = [];
if (file_exists(INQUIRIES_FILE)) {
    $lines = file(INQUIRIES_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines) {
        foreach ($lines as $line) {
            $e = json_decode($line, true);
            if (is_array($e)) $entries[] = $e;
        }
    }
}
$total   = count($entries);
$entries = array_slice(array_reverse($entries), 0, $MAX_SHOW); // newest first
$failed  = 0;
foreach ($entries as $e) if (empty($e['sent'])) $failed++;

$navActive = 'inquiries';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Inquiries</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    main { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 24px; }
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
<main>
  <h1>Inquiries</h1>
  <p class="sub">Every quote request and message submitted through the website's contact form — including ones the mail server failed to deliver, so no lead is ever lost. Reply from your own email client.</p>

  <div class="stats">
    <div class="stat"><div class="stat-num"><?= $total ?></div><div class="stat-lbl">Total received</div></div>
    <div class="stat"><div class="stat-num <?= $failed > 0 ? 'bad' : '' ?>"><?= $failed ?></div><div class="stat-lbl">Email delivery failed<?= $total > $MAX_SHOW ? ' (last ' . $MAX_SHOW . ')' : '' ?></div></div>
  </div>

  <?php if (empty($entries)): ?>
    <div class="empty">No inquiries yet. Submissions from the website's contact form will appear here.</div>
  <?php endif; ?>

  <?php foreach ($entries as $e):
      $isRfq  = ($e['type'] ?? '') === 'rfq';
      $sent   = !empty($e['sent']);
  ?>
  <details class="inq">
    <summary>
      <span class="badge <?= $isRfq ? 'badge-rfq' : 'badge-msg' ?>"><?= $isRfq ? 'Quote' : 'Message' ?></span>
      <span class="badge <?= $sent ? 'badge-sent' : 'badge-failed' ?>"><?= $sent ? 'Emailed' : 'Email failed' ?></span>
      <span class="who"><?= h($e['name'] ?? '—') ?> <small><?= h($e['company'] ?? '') ?></small></span>
      <span class="when"><?= h($e['ts'] ?? '') ?></span>
    </summary>
    <div class="detail">
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
</main>
</body>
</html>
