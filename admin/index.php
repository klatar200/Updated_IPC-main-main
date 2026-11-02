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
    // A12-L3-11-1 — a second Close (stale tab, double submit, or a reset that
    // already deleted the flag) found no file, and unlink() of a missing file
    // fails exactly like a permissions failure: Rick was told admin/ is not
    // writable and to delete over FTP a file that was not there.
    if (!file_exists(PASSWORD_RESET_FLAG)) {
        flash_redirect('The password-reset window is already closed — the file is gone.', 'success');
    }
    $removed = @unlink(PASSWORD_RESET_FLAG);
    audit_log('password', 'admin', $removed
        ? 'Password-reset window closed from the dashboard'
        : 'Tried to close the password-reset window, but the file could not be deleted');
    $msg = $removed
        ? 'The password-reset window is closed and the file is gone.'
        : 'Could not delete admin/ALLOW-PASSWORD-RESET — the admin folder is not writable by the web server. Please delete that file over FTP.';
    flash_redirect($msg, $removed ? 'success' : 'error');
}

$products = load_products();
// SEC-9 (audit 2026-09-27) — the message comes from the SESSION, set by
// flash_redirect(), never from the URL. `?msg=…&type=error` used to render any
// text a stranger put in a link as a red admin alert ("Session expired: call
// …"). Escaped, so not XSS — but a phishing banner inside the real admin.
$flash    = flash_take();
$message  = $flash['msg'];
$msgType  = $flash['type'];

// Group by partType
$grouped = [];
foreach ($products as $p) {
    $type = $p['partType'] ?? 'Other';
    $grouped[$type][] = $p;
}
ksort($grouped);
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
    .page-header h1 { font-size: var(--fs-6); font-weight: 800; margin: 0; }
    .page-header p  { font-size: var(--fs-2); color: #4b5563; margin: 2px 0 0; }
    /* Stats bar */
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat  { background: #fff; border: 1px solid #e5e9ee; border-radius: 10px; padding: 14px 20px; flex: 1; min-width: 140px; }
    .stat-val { font-size: var(--fs-5); font-weight: 800; color: #005da3; line-height: 1; }
    .stat-lbl { font-size: var(--fs-1); color: #4b5563; margin-top: 3px; }
    /* Products list — PLAN-13 Phase 5 (§2 E1–E4). One row per product:
       photo, SKU, name, temperature, PDF and photo chips, then Edit and a
       More menu. It replaced five equal buttons per row (210 on the page,
       Delete the same size as View ↗ beside it) in a 1,090px table that, on a
       phone, scrolled every action off-screen to the right (E2). The old
       Actions-column arithmetic (A10-020: 387px of buttons in a 318px box)
       is gone with the five buttons: two controls fit at every width, and
       below 900px each row is a card. Nothing here scrolls sideways. */
    .cat-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 20px; padding: 0; list-style: none; }
    .cat-chips a { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 4px 12px; border: 1px solid var(--field-line); border-radius: 999px; background: #fff; color: var(--ink); font-size: var(--fs-2); font-weight: 600; text-decoration: none; }
    .cat-chips a:hover { border-color: var(--brand); color: var(--brand); }
    .cat-chips a[aria-current="true"] { background: var(--brand-dark); border-color: var(--brand-dark); color: #fff; }
    .cat-chips .n { font-weight: 400; }
    .section { margin-bottom: 28px; scroll-margin-top: calc(var(--admin-bar-h) + 16px); }
    .section-title { font-size: var(--fs-4); font-weight: 700; color: var(--brand-dark); margin: 0 0 10px; line-height: 1.3; }
    .section-title .n { font-weight: 400; color: var(--ink-2); }
    .table-wrap { background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,45,82,0.06); }
    table { width: 100%; table-layout: fixed; border-collapse: collapse; }
    /* E4 — a light header: fifteen dark header bars down one page read as
       fifteen separate pages. */
    th { background: #f6f8fb; color: var(--ink-2); font-size: var(--fs-1); font-weight: 700; padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--line); }
    th:first-child { border-top-left-radius: 10px; }
    th:last-child { border-top-right-radius: 10px; }
    td { padding: 10px 14px; border-bottom: 1px solid #eef2f6; font-size: var(--fs-2); vertical-align: middle; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: rgba(0,93,163,0.025); }
    .c-photo { width: 76px; }
    .c-sku { width: 170px; }
    .c-temp { width: 190px; }
    .c-files { width: 200px; }
    .c-actions { width: 190px; }
    th.c-actions { text-align: right; }
    .thumb { display: block; width: 48px; height: 48px; border-radius: 8px; object-fit: cover; background: #f0f4f8; border: 1px solid var(--line); }
    .thumb-none { display: flex; align-items: center; justify-content: center; text-align: center; font-size: var(--fs-1); line-height: 1.1; color: var(--ink-2); }
    .sku { font-weight: 700; color: var(--brand); }
    .c-sku, .c-name { word-break: break-word; }
    td.c-temp { font-size: var(--fs-1); color: var(--ink-2); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { display: inline-flex; align-items: center; padding: 3px 9px; border: 1px solid transparent; border-radius: 999px; font-size: var(--fs-1); font-weight: 600; text-decoration: none; white-space: nowrap; }
    .chip-ok { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
    .chip-missing { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .chip-bad { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    a.chip:hover { text-decoration: underline; }
    .actions { display: flex; gap: 8px; align-items: center; justify-content: flex-end; }
    /* E1 — Delete lives in the More menu, set apart and in red. <details>,
       so it opens by click, tap or keyboard with JavaScript off; search.js
       keeps one open at a time and closes it on Escape or a click elsewhere. */
    .row-more { position: relative; }
    .row-more > summary { list-style: none; cursor: pointer; }
    .row-more > summary::-webkit-details-marker { display: none; }
    .row-more > summary::after { content: "\25BE"; margin-left: 2px; }
    .row-more-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 40; min-width: 220px; padding: 6px; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 24px rgba(13,45,82,0.16); text-align: left; }
    .row-more-menu a { display: flex; align-items: center; min-height: 40px; padding: 8px 12px; border-radius: 7px; color: var(--ink); font-size: var(--fs-2); font-weight: 600; text-decoration: none; white-space: nowrap; }
    .row-more-menu a:hover, .row-more-menu a:focus-visible { background: #eef4fb; color: var(--brand); }
    .row-more-menu hr { border: 0; border-top: 1px solid var(--line); margin: 6px 4px; }
    .row-more-menu a.danger { color: #b91c1c; }
    .row-more-menu a.danger:hover, .row-more-menu a.danger:focus-visible { background: #fef2f2; color: #991b1b; }
    @media (max-width: 1180px) {
      .c-photo { width: 68px; }
      .c-sku { width: 140px; }
      .c-temp { width: 150px; }
      .c-files { width: 160px; }
      .c-actions { width: 180px; }
    }
    /* E2 — below 900px each row is a card: photo at the left, then SKU, name,
       temperature and chips, and Edit and More across the full width, 44px
       tall. The column headings stay for screen readers. */
    @media (max-width: 900px) {
      .table-wrap { background: none; border: 0; box-shadow: none; }
      table, tbody, tr, td { display: block; width: auto; }
      thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      tbody tr { display: grid; grid-template-columns: 56px minmax(0, 1fr); column-gap: 12px; row-gap: 4px; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
      /* .table-wrap td, not td: the desktop column widths (.c-actions etc.)
         are one class and would otherwise keep the card's cells 190px wide. */
      .table-wrap td, tbody tr:last-child td { padding: 0; border: 0; width: auto; }
      tbody tr:hover td { background: none; }
      td.c-photo { grid-row: 1 / span 4; }
      td.c-sku, td.c-name, td.c-temp, td.c-files { grid-column: 2; }
      td.c-files { margin-top: 4px; }
      td.c-actions { grid-column: 1 / -1; margin-top: 10px; }
      .actions { position: relative; max-width: 440px; }
      .actions > .btn, .actions > .row-more { flex: 1 1 0; }
      .row-more { position: static; }
      .actions .btn, .row-more > summary { width: 100%; min-height: 44px; font-size: var(--fs-2); }
      .row-more-menu { left: 0; right: 0; min-width: 0; }
      .row-more-menu a { min-height: 44px; }
    }
    /* Search */
    .search-bar { display: flex; gap: 10px; margin-bottom: 20px; }
    .search-bar input { flex: 1; padding: 10px 14px; border: 1px solid #d1d9e0; border-radius: 8px; font-size: var(--fs-2); outline: none; }
    /* PLAN-13 Phase 7 — the border change alone was the only focus sign
       (outline: none above), and a 1px colour change is not one. */
    .search-bar input:focus { border-color: #005da3; box-shadow: 0 0 0 3px rgba(0,93,163,0.25); }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main class="admin-wide">
  <div class="page-header">
    <div>
      <h1>Products</h1>
      <p><?= count($products) ?> products across <?= count($grouped) ?> categories</p>
    </div>
    <a href="add.php" class="btn btn-primary">+ Add Product</a>
  </div>

  <?php
  // A-5.6 — leads waiting to be read; first thing on the page (see below).
  $newLeads = inquiries_new_count();
  // Server-setup problems: admin_health_problems() in config.php, shared
  // with the Overview (PLAN-13 Phase 8). Each entry's reasoning is there.
  $healthProblems = admin_health_problems($products);
  ?>
  <?php /* A-5.6 — new leads, above everything else on the page. */ ?>
  <?php if ($newLeads > 0): ?>
    <div class="alert" role="status" style="text-align:left;background:#e8f4ff;border:1px solid #99c9ee;color:#0d2d52">
      <strong><?= (int)$newLeads ?> new <?= $newLeads === 1 ? 'inquiry' : 'inquiries' ?> since you last looked.</strong>
      <a href="inquiries.php" style="margin-left:8px;font-weight:700;color:#005da3">Read <?= $newLeads === 1 ? 'it' : 'them' ?> →</a>
      <div style="margin-top:6px;font-size:var(--fs-2)">
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
    <span id="searchCount" role="status" aria-live="polite" style="display:flex;align-items:center;font-size:var(--fs-2);color:#4b5563;white-space:nowrap;"></span>
  </div>
  <p id="searchEmpty" style="display:none;color:#4b5563;font-size:var(--fs-2);margin:0 0 24px;">No products match your search.</p>

  <?php
    // A12-L11-01-W5-1 — "With PDF" tested the FIELD (!empty), so a data
    // sheet deleted over FTP, lost in a partial upload or a host restore
    // still counted, and the buyer's Datasheet click got the server's bare
    // 404 with nobody told (the ADM-3 record's note, audit-2026-09-27:191).
    // A /pdfs/ link now counts only when its file is on disk.
    $pdfPresent = static function (array $p): bool {
        $u = (string)($p['pdfUrl'] ?? '');
        if ($u === '') return false;
        $path = (string)parse_url($u, PHP_URL_PATH);
        if (strpos($path, '/pdfs/') !== 0) return true;   // an outside link: not ours to check
        return is_file(PDF_DIR . basename(rawurldecode($path)));
    };
    // PLAN-13 Phase 5 (§2 E3) — five products had no photo and nothing on
    // this page said so. Same rule as the PDF: a path on this site counts
    // only when its file is there (site_file_missing(), config.php).
    $photoPresent = static function (array $p): bool {
        $u = trim((string)($p['photoUrl'] ?? ''));
        return $u !== '' && !site_file_missing($u);
    };
    $withPdf   = count(array_filter($products, $pdfPresent));
    $withPhoto = count(array_filter($products, $photoPresent));
    $catSlug = static fn(string $t): string => 'cat-' . trim((string)preg_replace('/[^a-z0-9]+/', '-', strtolower($t)), '-');
  ?>
  <!-- Stats -->
  <div class="stats">
    <div class="stat"><div class="stat-val"><?= count($products) ?></div><div class="stat-lbl">Total Products</div></div>
    <div class="stat"><div class="stat-val"><?= count($grouped) ?></div><div class="stat-lbl">Categories</div></div>
    <div class="stat">
      <div class="stat-val"><?= $withPdf ?></div>
      <div class="stat-lbl">With PDF</div>
    </div>
    <div class="stat">
      <div class="stat-val"><?= count($products) - $withPdf ?></div>
      <div class="stat-lbl">Missing PDF</div>
    </div>
    <div class="stat">
      <div class="stat-val"><?= count($products) - $withPhoto ?></div>
      <div class="stat-lbl">Missing Photo</div>
    </div>
  </div>

  <?php /* E4 — jump to a category. Plain links to each section's id, so they
           work without JavaScript; search.js turns them into a filter. */ ?>
  <nav aria-label="Product categories">
    <ul class="cat-chips">
      <li><a href="#products-list" data-cat="" aria-current="true">All <span class="n"><?= count($products) ?></span></a></li>
      <?php foreach ($grouped as $type => $items): ?>
      <li><a href="#<?= h($catSlug((string)$type)) ?>" data-cat="<?= h($catSlug((string)$type)) ?>"><?= h($type) ?> <span class="n"><?= count($items) ?></span></a></li>
      <?php endforeach; ?>
    </ul>
  </nav>

  <!-- Products by category -->
  <div id="products-list">
  <?php foreach ($grouped as $type => $items): ?>
  <section class="section" data-section id="<?= h($catSlug((string)$type)) ?>" data-cat="<?= h($catSlug((string)$type)) ?>">
    <h2 class="section-title"><?= h($type) ?> <span class="n">(<?= count($items) ?>)</span></h2>
    <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="c-photo">Photo</th>
          <th class="c-sku">SKU</th>
          <th class="c-name">Product Name</th>
          <th class="c-temp">Temp Rating</th>
          <th class="c-files">Files</th>
          <th class="c-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($items as $p):
            $sku  = (string)($p['sku'] ?? $p['id'] ?? '');
            $q    = urlencode($sku);
            $pdfU = (string)($p['pdfUrl'] ?? '');
            $phU  = trim((string)($p['photoUrl'] ?? ''));
            $hasPhoto = $photoPresent($p);
            // A photo path is stored with or without its leading slash; the
            // admin lives in /admin/, so a bare "uploads/…" needs one.
            $thumb = $hasPhoto && !preg_match('#^([a-z][a-z0-9+.-]*:|/)#i', $phU) ? '/' . $phU : $phU;
        ?>
        <tr data-search="<?= h($sku . ' ' . ($p['name'] ?? '')) ?>"><?php /* NEW-N2-14: search.js lower-cases */ ?>
          <td class="c-photo"><?php if ($hasPhoto): ?><img class="thumb" src="<?= h($thumb) ?>" alt="" width="48" height="48" loading="lazy"><?php else: ?><span class="thumb thumb-none">No photo</span><?php endif; ?></td>
          <td class="c-sku"><span class="sku"><?= h($sku !== '' ? $sku : '—') ?></span></td>
          <td class="c-name"><?= h($p['name'] ?? '—') ?></td>
          <td class="c-temp"><?= h($p['operatingTemp'] ?? '—') ?></td>
          <td class="c-files"><div class="chips">
            <?php if ($pdfU === ''): ?>
              <a class="chip chip-missing" href="upload-pdf.php?sku=<?= $q ?>" title="No data sheet yet — add one">No PDF</a>
            <?php elseif ($pdfPresent($p)): ?>
              <a class="chip chip-ok" href="<?= h($pdfU) ?>" target="_blank" rel="noopener" title="Open the data sheet in a new tab">PDF &#10003;</a>
            <?php else: ?>
              <a class="chip chip-bad" href="upload-pdf.php?sku=<?= $q ?>" title="The product points at a PDF that is not on the server — upload it again">PDF missing</a>
            <?php endif; ?>
            <?php if ($hasPhoto): ?>
              <a class="chip chip-ok" href="upload-image.php?sku=<?= $q ?>" title="Change or remove the photo">Photo &#10003;</a>
            <?php elseif ($phU === ''): ?>
              <a class="chip chip-missing" href="upload-image.php?sku=<?= $q ?>" title="No photo yet — add one">No photo</a>
            <?php else: ?>
              <a class="chip chip-bad" href="upload-image.php?sku=<?= $q ?>" title="The product points at a photo that is not on the server — upload it again">Photo missing</a>
            <?php endif; ?>
          </div></td>
          <td class="c-actions">
            <div class="actions">
              <a href="edit.php?sku=<?= $q ?>" class="btn btn-sm btn-edit">Edit</a>
              <details class="row-more">
                <summary class="btn btn-sm btn-secondary" aria-label="More actions for <?= h($sku) ?>">More</summary>
                <div class="row-more-menu">
                  <a href="upload-pdf.php?sku=<?= $q ?>" title="Upload, replace, or remove this product's data sheet PDF">Manage PDF</a>
                  <a href="upload-image.php?sku=<?= $q ?>" title="Upload, replace, or remove this product's photo">Photo</a>
                  <a href="/products?productId=<?= $q ?>" target="_blank" rel="noopener" title="Open this product on the public website in a new tab">View on site &#8599;</a>
                  <hr>
                  <a href="delete.php?sku=<?= $q ?>"
                     class="danger"
                     <?php /* A10 — "This cannot be undone." was the exact wording
                              AUDIT_v3 D13 corrected on delete.php, which now reads
                              "This can be undone. A backup of the whole catalog is
                              saved immediately before the deletion". The page was
                              fixed and this dialog was not, so the two directly
                              contradicted each other — and this is the one the
                              owner reads first. It still names the SKU and it is
                              still a confirmation; only the false claim is gone.
                              (audit-runs/audit1.md A-10) */ ?>
                     data-confirm="Delete <?= h($p['sku'] ?? '') ?>? You will be asked to confirm on the next page. A backup is saved first, so this can be undone from Backups.">Delete…</a>
                </div>
              </details>
            </div>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    </div>
  </section>
  <?php endforeach; ?>
  </div>
</main>
<script src="search.js"></script>
<script src="confirm.js"></script>
</body>
</html>
