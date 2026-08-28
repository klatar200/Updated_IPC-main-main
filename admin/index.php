<?php
require_once 'config.php';
require_auth();

// Close an open (or stale) password-reset window from the dashboard.
// Before this, the flag file could only be removed the way it was created —
// over FTP — so the window opened by a failed recovery stayed open until
// somebody remembered it existed. Nothing else on the site could see it.
// (AUDIT_v3_FINDINGS B2)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['close_reset_window'])) {
    csrf_check();
    $removed = @unlink(PASSWORD_RESET_FLAG);
    audit_log('password', 'admin', $removed
        ? 'Password-reset window closed from the dashboard'
        : 'Tried to close the password-reset window, but the file could not be deleted');
    $msg = $removed
        ? 'The password-reset window is closed and the file is gone.'
        : 'Could not delete admin/ALLOW-PASSWORD-RESET — the admin folder is not writable by the web server. Please delete that file over FTP.';
    header('Location: index.php?msg=' . rawurlencode($msg) . '&type=' . ($removed ? 'success' : 'error'));
    exit;
}

$products = load_products();
$message  = $_GET['msg'] ?? '';
$msgType  = in_array($_GET['type'] ?? '', ['success', 'error']) ? $_GET['type'] : 'success'; // whitelist

// Group by partType
$grouped = [];
foreach ($products as $p) {
    $type = $p['partType'] ?? 'Other';
    $grouped[$type][] = $p;
}
ksort($grouped);
$navActive = 'products';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Products</title>
  <?= admin_head() ?>
  <style>
    /* Layout — the reset, body, container, buttons and alerts now come from
       admin_head() in config.php; what is left here is this page only. */
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-header h1 { font-size: 22px; font-weight: 800; margin: 0; }
    .page-header p  { font-size: 13px; color: #6b7280; margin: 2px 0 0; }
    /* Stats bar */
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat  { background: #fff; border: 1px solid #e5e9ee; border-radius: 10px; padding: 14px 20px; flex: 1; min-width: 140px; }
    .stat-val { font-size: 22px; font-weight: 800; color: #005da3; line-height: 1; }
    .stat-lbl { font-size: 11px; color: #6b7280; margin-top: 3px; }
    /* Table */
    .section { margin-bottom: 32px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #e5e9ee; }
    /* Fixed layout + shared column widths so every category table lines up
       identically down the page (headers and columns align across sections). */
    /* KEEP: the narrow-screen safety net. `overflow-x: auto` is what lets the
       table scroll inside its card at 834 and 390 instead of pushing the page
       sideways — plan10-adminrows.js asserts both. Do not remove it while
       tuning the column widths below. */
    .table-wrap { overflow-x: auto; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,45,82,0.06); }
    table { width: 100%; min-width: 980px; table-layout: fixed; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; }
    th    { background: #0d2d52; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 12px 16px; text-align: left; }
    td    { padding: 12px 16px; border-bottom: 1px solid #f0f4f8; font-size: 13px; vertical-align: middle; }
    /* Uniform columns: SKU · Name (fills) · Temp · Data Sheet · Actions */
    th:nth-child(1), td:nth-child(1) { width: 160px; word-break: break-word; }
    th:nth-child(3), td:nth-child(3) { width: 150px; }
    th:nth-child(4), td:nth-child(4) { width: 120px; }
    /* Actions.
     *
     * 350px never held the button set. Measured on this machine's system-ui:
     * Edit 51 + Manage PDF 109 + Photo 64 + View 71 + Delete 68, plus four 6px
     * gaps, is 387px of buttons against a content box of 350 - 16 - 16 = 318.
     * All 42 rows wrapped Delete onto a second line. The same measurement on
     * another machine came out at 340px of buttons — still 22px over — where
     * instead of wrapping, the row filled the box edge to edge and Delete sat
     * flush on the cell border with no visible gap. Same defect; which of the
     * two you see depends only on how your system font renders, which is why
     * it reproduced for some people and not others.
     *
     * Widening the PAGE does not fix it: `table-layout: fixed` pins columns
     * 1/3/4/5 at their declared widths and gives every extra pixel to the Name
     * column, so Actions stayed at 350 no matter how wide the admin got. The
     * number has to change here.
     *
     * 350 stays as the DEFAULT and 460 arrives at >=1140px, deliberately.
     * 387px of buttons + 16 + 20 of padding needs a 423px column, and adding
     * that to the other three fixed columns (160 + 150 + 120) plus a readable
     * ~200px Name column needs 1090px of table — which does not fit a 1024px
     * viewport, where the content area is 976px. Forcing it there just moved
     * the defect: measured at 1024 with a flat 460, the table overflowed its
     * wrapper and Delete sat 987..1056 outside a container clipped at 1000,
     * i.e. clipped again (plan10-adminrows.js caught this, 14/15). Below 1140
     * the buttons wrap onto a second line instead, which is what they already
     * did and what `flex-wrap` is there for.
     *
     * 1140 is the smallest viewport where the widened table fits without
     * scrolling: 1140 - 48 of page padding = 1092 >= the 1090 min-width. */
    th:nth-child(5), td:nth-child(5) { width: 350px; }
    @media (min-width: 1140px) {
      table { min-width: 1090px; }
      th:nth-child(5), td:nth-child(5) { width: 460px; }
    }
    /* The floor that removes the machine-to-machine variance. The declared
       `padding: 12px 16px` above is real but was fully consumed by the button
       row, so on a narrow-font machine the last button rendered flush against
       the cell border. 20px on the last column means the row can never sit on
       the border again even if the button set grows. */
    td:last-child { padding-right: 20px; }
    td:nth-child(2) { word-break: break-word; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(0,93,163,0.02); }
    .sku  { font-weight: 700; color: #005da3; font-size: 12px; }
    .type-badge { background: rgba(17,158,200,0.1); color: #0369a1; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }
    /* KEEP: flex-wrap stays. With the column at 460 it should never fire, but
       it is the last line of defence on a font wider than anything measured —
       wrapping is ugly, a clipped Delete button is not recoverable. */
    .actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .actions .btn { flex-shrink: 0; }
    /* Search */
    .search-bar { display: flex; gap: 10px; margin-bottom: 20px; }
    .search-bar input { flex: 1; padding: 10px 14px; border: 1px solid #d1d9e0; border-radius: 8px; font-size: 13px; outline: none; }
    .search-bar input:focus { border-color: #005da3; }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main class="admin-wide">
  <div class="page-header">
    <div>
      <h1>Product Catalog</h1>
      <p><?= count($products) ?> products across <?= count($grouped) ?> categories</p>
    </div>
    <a href="add.php" class="btn btn-primary">+ Add Product</a>
  </div>

  <?php
  /* Server health panel. Three things fail SILENTLY on a host where the PHP
     user differs from the FTP user, and every one of them is invisible until
     it matters: the audit log stays empty, every inbound sales lead is dropped
     (inquiries.jsonl), and password changes cannot be written. Surface it.
     (DEPLOY_READINESS_v2 T3.3) */
  // A-5.6 — leads waiting to be read. Deliberately NOT a $healthProblems entry:
  // nothing is broken, and burying it among red permission warnings is how it
  // would get ignored. It is the first thing on the dashboard instead.
  $newLeads = inquiries_new_count();

  $healthProblems = [];
  if (!admin_writable()) {
      // A-5.8 — this one condition takes down BOTH brute-force controls at once,
      // and the banner used to name neither. login_throttle_mutate() opens
      // .login-throttle.json and returns null when it cannot, so
      // login_attempt_gate() falls through with wait = 0 and every request goes
      // straight to password_verify() with no cool-off, permanently; audit_log()
      // no-ops in the same failure, so the guessing run is also unrecorded.
      // Failing open is deliberate (it must not lock the owner out) — which is
      // exactly why it has to be said out loud here.
      $healthProblems[] = 'The <code>admin</code> folder is not writable by the web server. '
        . 'Sales leads from the contact form are being DISCARDED, the activity log cannot record anything, '
        . 'the Password page cannot save, and — because both depend on files in this folder — '
        . '<strong>the login cool-off that limits password guessing is switched off and failed sign-ins are not being recorded</strong>. '
        . 'Set admin/ to 755 (or 775) over FTP, then sign out and back in to confirm this warning is gone.';
  }
  if (!data_writable()) {
      $healthProblems[] = 'The <code>data</code> folder is not writable by the web server. '
        . 'Nothing you edit on any page can be saved. Set data/ to 755 (or 775) over FTP.';
  }
  if (!is_dir(IMG_DIR) || !is_writable(IMG_DIR)) {
      $healthProblems[] = 'The <code>uploads/images</code> folder is missing or not writable. '
        . 'Product photo uploads will fail. Create public_html/uploads/images/ over FTP and set it to 755.';
  }
  // A-5.9 — the contact form's rate limit and its per-recipient auto-reply cap
  // both keep their state in the system temp dir. If that is not writable the
  // controls do not fail loudly, they simply stop counting, and nothing else
  // in the dashboard would ever say so. The admin runs as the same PHP user,
  // so this is the same question the form asks.
  $tmpDir = sys_get_temp_dir();
  if (!is_dir($tmpDir) || !is_writable($tmpDir)) {
      $healthProblems[] = 'The server\'s temporary folder (<code>' . h($tmpDir) . '</code>) is not writable. '
        . 'The contact form still works and still records every lead, but its spam rate limit is not counting, '
        . 'and confirmation emails to senders are being held back as a precaution. Ask the host to fix permissions on it.';
  }
  if (!is_dir(PDF_DIR) || !is_writable(PDF_DIR)) {
      $healthProblems[] = 'The <code>pdfs</code> folder is missing or not writable. '
        . 'Data-sheet uploads will fail. Set public_html/pdfs/ to 755 (or 775) over FTP.';
  }
  /* A-7.4 — contact.php could not write the inquiry log.
     This is the one mail/log outcome that is otherwise SILENT: the mail went,
     so the visitor saw a success page and has no reason to resend, and A-5.6
     made this log the record the owner is told to trust when a notification
     does not arrive. The marker is written by ipc_log_inquiry() and cleared by
     the next write that succeeds, so it says "this is happening now", not
     "this happened once".
     Deliberately not gated on admin_writable(): that is a bare
     is_writable(__DIR__) and returns true for a log file that is individually
     unwritable, locked, or replaced by a directory — which is the gap this
     covers. */
  $logFailMarker = __DIR__ . '/.inquiry-log-failed.json';
  if (is_file($logFailMarker)) {
      $when = @filemtime($logFailMarker);
      $healthProblems[] = '<strong>Quote requests are arriving but cannot be recorded.</strong> '
        . 'The website could not write to <code>admin/inquiries.jsonl</code>'
        . ($when ? ' (last tried ' . h(date('M j, Y g:i a', $when)) . ')' : '') . '. '
        . 'The notification emails are still being sent, so nothing is lost yet — but the '
        . 'Inquiries page is not recording new leads. Usually a full disk or a permissions '
        . 'change on public_html/admin/. This clears itself as soon as one write succeeds.';
  }
  /* The password-reset window. While it is open, ANY visitor to /admin/ — signed
     in or not — is served the "Set Admin Password" form and can take the
     account. It used to be invisible: nothing on any page mentioned it, and
     auth.php bounces a signed-in admin here before he can see the screen.
     (AUDIT_v3_FINDINGS B2) */
  $closeBtn = '<form method="POST" style="display:inline;margin-left:6px">'
    . '<input type="hidden" name="csrf_token" value="' . h(csrf_token()) . '">'
    . '<input type="hidden" name="close_reset_window" value="1">'
    . '<button type="submit" class="btn btn-sm btn-danger" style="vertical-align:baseline">Close it now</button>'
    . '</form>';
  if (password_reset_unlocked()) {
      $healthProblems[] = '<strong>The password-reset window is OPEN.</strong> '
        . 'While <code>admin/ALLOW-PASSWORD-RESET</code> is in the admin folder, anyone on the internet who opens '
        . 'your admin address is shown a "Set Admin Password" form and can lock you out. '
        . 'It closes by itself one hour after the file was uploaded — close it now if you are done.' . $closeBtn;
  } elseif (password_reset_expired()) {
      $healthProblems[] = 'The file <code>admin/ALLOW-PASSWORD-RESET</code> is still in the admin folder. '
        . 'It is more than an hour old so it no longer does anything, but it should not be left there.' . $closeBtn;
  }
  ?>
  <?php /* A-5.6 — new leads, above everything else on the page. */ ?>
  <?php if ($newLeads > 0): ?>
    <div class="alert" role="status" style="text-align:left;background:#e8f4ff;border:1px solid #99c9ee;color:#0d2d52">
      <strong><?= (int)$newLeads ?> new <?= $newLeads === 1 ? 'inquiry' : 'inquiries' ?> since you last looked.</strong>
      <a href="inquiries.php" style="margin-left:8px;font-weight:700;color:#005da3">Read <?= $newLeads === 1 ? 'it' : 'them' ?> →</a>
      <div style="margin-top:6px;font-size:13px">
        Every quote request is saved here even when the notification email does not arrive,
        so this is the list to trust.
      </div>
    </div>
  <?php endif; ?>

  <?php if ($healthProblems): ?>
    <div class="alert alert-error" role="alert" style="text-align:left">
      <strong>Server setup problem — please send this to your developer.</strong>
      <ul style="margin:8px 0 0 18px;padding:0">
        <?php foreach ($healthProblems as $hp): ?><li style="margin-bottom:6px"><?= $hp ?></li><?php endforeach; ?>
      </ul>
    </div>
  <?php endif; ?>

  <?php if ($message): ?>
    <div class="alert alert-<?= h($msgType) ?>"><?= h($message) ?></div>
  <?php endif; ?>

  <!-- Search -->
  <div class="search-bar">
    <input type="search" id="productSearch" placeholder="Search by SKU / part number or product name…" autocomplete="off" aria-label="Search products" />
    <span id="searchCount" style="display:flex;align-items:center;font-size:13px;color:#6b7280;white-space:nowrap;"></span>
  </div>
  <p id="searchEmpty" style="display:none;color:#9ca3af;font-size:13px;margin:0 0 24px;">No products match your search.</p>

  <!-- Stats -->
  <div class="stats">
    <div class="stat"><div class="stat-val"><?= count($products) ?></div><div class="stat-lbl">Total Products</div></div>
    <div class="stat"><div class="stat-val"><?= count($grouped) ?></div><div class="stat-lbl">Categories</div></div>
    <div class="stat">
      <div class="stat-val"><?= count(array_filter($products, fn($p) => !empty($p['pdfUrl']))) ?></div>
      <div class="stat-lbl">With PDF</div>
    </div>
    <div class="stat">
      <div class="stat-val"><?= count(array_filter($products, fn($p) => empty($p['pdfUrl']))) ?></div>
      <div class="stat-lbl">Missing PDF</div>
    </div>
  </div>

  <!-- Products by category -->
  <?php foreach ($grouped as $type => $items): ?>
  <div class="section" data-section>
    <div class="section-title"><?= h($type) ?> (<?= count($items) ?>)</div>
    <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Product Name</th>
          <th>Temp Rating</th>
          <th>Data Sheet</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($items as $p): ?>
        <tr data-search="<?= h(strtolower(($p['sku'] ?? $p['id'] ?? '') . ' ' . ($p['name'] ?? ''))) ?>">
          <td><span class="sku"><?= h($p['sku'] ?? $p['id'] ?? '—') ?></span></td>
          <td><?= h($p['name'] ?? '—') ?></td>
          <td style="font-size:12px;color:#6b7280"><?= h($p['operatingTemp'] ?? '—') ?></td>
          <td>
            <?php if (!empty($p['pdfUrl'])): ?>
              <a href="<?= h($p['pdfUrl']) ?>" target="_blank" class="btn btn-sm btn-pdf">View PDF</a>
            <?php else: ?>
              <span style="color:#9ca3af;font-size:12px;">None</span>
            <?php endif; ?>
          </td>
          <td>
            <div class="actions">
              <a href="edit.php?sku=<?= urlencode($p['sku'] ?? $p['id'] ?? '') ?>" class="btn btn-sm btn-edit">Edit</a>
              <a href="upload-pdf.php?sku=<?= urlencode($p['sku'] ?? $p['id'] ?? '') ?>" class="btn btn-sm btn-pdf" title="Upload, replace, or remove this product's data sheet PDF">Manage PDF</a>
              <a href="upload-image.php?sku=<?= urlencode($p['sku'] ?? $p['id'] ?? '') ?>" class="btn btn-sm btn-pdf" title="Upload, replace, or remove this product's photo">Photo</a>
              <a href="/products?productId=<?= urlencode($p['sku'] ?? $p['id'] ?? '') ?>"
                 target="_blank" rel="noopener"
                 class="btn btn-sm btn-edit"
                 title="Open this product on the public website in a new tab">View ↗</a>
              <a href="delete.php?sku=<?= urlencode($p['sku'] ?? $p['id'] ?? '') ?>"
                 class="btn btn-sm btn-danger"
                 <?php /* A10 — "This cannot be undone." was the exact wording
                          AUDIT_v3 D13 corrected on delete.php, which now reads
                          "This can be undone. A backup of the whole catalog is
                          saved immediately before the deletion". The page was
                          fixed and this dialog was not, so the two directly
                          contradicted each other — and this is the one the
                          owner reads first. It still names the SKU and it is
                          still a confirmation; only the false claim is gone.
                          (audit-runs/audit1.md A-10) */ ?>
                 data-confirm="Delete <?= h($p['sku'] ?? '') ?>? You will be asked to confirm on the next page. A backup is saved first, so this can be undone from Backups.">Delete</a>
            </div>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    </div>
  </div>
  <?php endforeach; ?>
</main>
<script src="search.js"></script>
<script src="confirm.js"></script>
</body>
</html>
