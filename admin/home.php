<?php
require_once 'config.php';
require_auth();

/**
 * Overview — PLAN-13 Phase 8 (§3 item 9), the page sign-in lands on.
 *
 * The dashboard used to open on All Products: 70 rows, with the two things
 * that most need the owner — a lead waiting and a server problem — as banners
 * above a list he had not come for, and nothing at all about what changed or
 * which products are missing a photo. This page answers "does anything need
 * me?" first. It reads only: nothing here saves, and looking at it does NOT
 * mark inquiries as seen (only opening Inquiries does, A-5.6).
 *
 * All Products stays one click away (the Products card and the shortcuts),
 * and the server-problem list is the same function index.php shows,
 * admin_health_problems().
 */

$products = load_products();
$newLeads = inquiries_new_count();
$latest   = inquiries_latest(4);
$changes  = audit_recent_changes(5);
$healthProblems = admin_health_problems($products);
$flash = flash_take();

// Products with a file to fix — the same rules as the chips on All Products:
// a path on this site counts only when its file is on the server.
$pdfOk = static function (array $p): bool {
    $u = (string)($p['pdfUrl'] ?? '');
    if ($u === '') return false;
    $path = (string)parse_url($u, PHP_URL_PATH);
    if (strpos($path, '/pdfs/') !== 0) return true;   // an outside link: not ours to check
    return is_file(PDF_DIR . basename(rawurldecode($path)));
};
$photoOk = static function (array $p): bool {
    $u = trim((string)($p['photoUrl'] ?? ''));
    return $u !== '' && !site_file_missing($u);
};
$needs = [];
foreach ($products as $p) {
    $sku = (string)($p['sku'] ?? '');
    if ($sku === '') continue;
    $noPhoto = !$photoOk($p);
    $noPdf   = !$pdfOk($p);
    if ($noPhoto || $noPdf) $needs[] = ['sku' => $sku, 'name' => (string)($p['name'] ?? ''), 'photo' => $noPhoto, 'pdf' => $noPdf,
        'photoSet' => trim((string)($p['photoUrl'] ?? '')) !== '', 'pdfSet' => trim((string)($p['pdfUrl'] ?? '')) !== ''];
}
$missingPhoto = count(array_filter($needs, static fn($n) => $n['photo']));
$missingPdf   = count(array_filter($needs, static fn($n) => $n['pdf']));
$NEEDS_SHOWN  = 6;

$CHANGE_LABEL = [
    'add' => 'Product added', 'edit' => 'Product edited', 'delete' => 'Product deleted',
    'upload-pdf' => 'Data sheet uploaded', 'remove-pdf' => 'Data sheet removed',
    'upload-image' => 'Photo uploaded', 'remove-image' => 'Photo removed',
    'site-image' => 'Site image changed', 'marketing-pdf' => 'Catalog or brochure PDF',
    'settings' => 'Business Details saved', 'content' => 'Page Content saved',
    'restore' => 'Backup restored', 'password' => 'Password',
];
$leadKind = static function (array $e): string {
    $t = (string)($e['type'] ?? '');
    if ($t === 'rfq') return 'Quote request';
    if ($t === 'message') return 'Message';
    return 'Call back';   // inquiry_callback_types(): refused, but a real person
};
$when = static function (string $ts): string {
    $t = strtotime($ts);
    return admin_day_label($ts) . ($t === false ? '' : ', ' . date('g:i a', $t));
};
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="icon" type="image/svg+xml" href="logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Overview</title>
  <?= admin_head() ?>
  <style>
    .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    .page-header h1 { font-size: var(--fs-6); font-weight: 800; margin: 0; }
    .page-header p { font-size: var(--fs-2); color: var(--ink-2); margin: 2px 0 0; }
    .page-header .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    /* Two columns from 900px; one on a phone. Each card is a heading, a
       short list and one "go there" link at its foot. */
    .ov-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
    @media (max-width: 899px) { .ov-grid { grid-template-columns: minmax(0, 1fr); } }
    .ov-card { margin-bottom: 0; padding: 22px 24px; }
    .ov-card .card-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .ov-card .card-title a { font-size: var(--fs-2); font-weight: 600; white-space: nowrap; }
    .ov-big { display: flex; align-items: baseline; gap: 10px; margin: 0 0 12px; }
    .ov-big .n { font-size: var(--fs-6); font-weight: 800; color: var(--brand); line-height: 1; }
    .ov-big .n.zero { color: var(--ink-2); }
    .ov-big .l { font-size: var(--fs-3); color: var(--ink); }
    .ov-list { list-style: none; margin: 0; padding: 0; }
    .ov-list li { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 9px 0; border-top: 1px solid #eef2f6; font-size: var(--fs-2); }
    .ov-list li:first-child { border-top: 0; }
    .ov-list .main { min-width: 0; overflow-wrap: anywhere; }
    .ov-list .main strong { color: var(--ink); }
    .ov-list .meta { color: var(--ink-2); font-size: var(--fs-1); white-space: nowrap; text-align: right; }
    .ov-list .detail { display: block; color: var(--ink-2); font-size: var(--fs-1); margin-top: 2px; }
    .ov-empty { color: var(--ink-2); font-size: var(--fs-2); margin: 0; }
    .ov-ok { display: flex; align-items: center; gap: 8px; color: #166534; font-size: var(--fs-3); font-weight: 600; margin: 0; }
    .tag { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: var(--fs-1); font-weight: 600; border: 1px solid transparent; white-space: nowrap; }
    .tag-bad { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .tag-wait { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .tag-new { background: #e8f4ff; color: #0d2d52; border-color: #99c9ee; }
    .ov-fix { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .ov-fix a { font-size: var(--fs-1); font-weight: 600; white-space: nowrap; }
    .ov-shortcuts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    @media (max-width: 420px) { .ov-shortcuts { grid-template-columns: minmax(0, 1fr); } }
    .ov-shortcuts a { display: flex; align-items: center; min-height: 44px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); font-size: var(--fs-2); font-weight: 600; text-decoration: none; }
    .ov-shortcuts a:hover, .ov-shortcuts a:focus-visible { border-color: var(--brand); color: var(--brand); background: #f6f9fc; }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main class="admin-wide">
  <div class="page-header">
    <div>
      <h1>Overview</h1>
      <p>What needs your attention on the website. Nothing on this page changes anything.</p>
    </div>
    <div class="head-actions">
      <a href="index.php" class="btn btn-secondary">All Products</a>
      <a href="add.php" class="btn btn-primary">+ Add Product</a>
    </div>
  </div>

  <?php if ($flash['msg']): ?>
    <div class="alert alert-<?= h($flash['type']) ?>"><?= h($flash['msg']) ?></div>
  <?php endif; ?>

  <?php if ($healthProblems): ?>
    <div class="alert alert-error" role="alert" style="text-align:left">
      <strong>Server setup problem — please send this to your developer.</strong>
      <ul style="margin:8px 0 0 18px;padding:0">
        <?php foreach ($healthProblems as $hp): ?><li style="margin-bottom:6px"><?= $hp ?></li><?php endforeach; ?>
      </ul>
    </div>
  <?php endif; ?>

  <div class="ov-grid">
    <section class="card ov-card" id="ov-inquiries" aria-labelledby="ov-inquiries-h">
      <h2 class="card-title" id="ov-inquiries-h">Inquiries <a href="inquiries.php">Open Inquiries →</a></h2>
      <p class="ov-big"><span class="n<?= $newLeads ? '' : ' zero' ?>"><?= (int)$newLeads ?></span>
        <span class="l">new since you last opened Inquiries</span></p>
      <?php if ($latest): ?>
        <ul class="ov-list" aria-label="Newest inquiries">
          <?php foreach ($latest as $i => $e):
            $st = (string)($e['status'] ?? ''); ?>
          <li>
            <span class="main"><strong><?= h((string)($e['name'] ?? '(no name)')) ?></strong><?php
              if (!empty($e['company'])): ?> — <?= h((string)$e['company']) ?><?php endif; ?>
              <span class="detail"><?= h($leadKind($e)) ?><?php if (!empty($e['part'])): ?> · <?= h((string)$e['part']) ?><?php endif; ?></span></span>
            <span class="meta"><?php if ($i < $newLeads): ?><span class="tag tag-new">New</span> <?php endif; ?><?php
              if ($st === 'pending'): ?><span class="tag tag-wait">Not confirmed</span> <?php
              elseif (in_array((string)($e['type'] ?? ''), ['rfq', 'message'], true) && empty($e['sent'])): ?><span class="tag tag-bad">Email failed</span> <?php endif; ?>
              <br><?= h($when((string)($e['ts'] ?? ''))) ?></span>
          </li>
          <?php endforeach; ?>
        </ul>
      <?php else: ?>
        <p class="ov-empty">No quote requests or messages yet. When a customer uses the website's contact form, it is listed here and on Inquiries.</p>
      <?php endif; ?>
    </section>

    <section class="card ov-card" id="ov-server" aria-labelledby="ov-server-h">
      <h2 class="card-title" id="ov-server-h">Server <a href="help.php#health">What these mean →</a></h2>
      <?php if ($healthProblems): ?>
        <p class="ov-big"><span class="n" style="color:#b91c1c"><?= count($healthProblems) ?></span>
          <span class="l"><?= count($healthProblems) === 1 ? 'problem' : 'problems' ?> to send to your developer — listed in red at the top of this page.</span></p>
      <?php else: ?>
        <p class="ov-ok"><span aria-hidden="true">✓</span> No server problems found.</p>
        <p class="ov-empty" style="margin-top:8px">Folders can be written, the security files are in place, and the server can resize photos.</p>
      <?php endif; ?>
    </section>

    <section class="card ov-card" id="ov-products" aria-labelledby="ov-products-h">
      <h2 class="card-title" id="ov-products-h">Products <a href="index.php">All Products →</a></h2>
      <p class="ov-big"><span class="n"><?= count($products) ?></span>
        <span class="l">products · <?= $missingPhoto ?> without a photo · <?= $missingPdf ?> without a data sheet</span></p>
      <?php if ($needs): ?>
        <ul class="ov-list" aria-label="Products missing a photo or data sheet">
          <?php foreach (array_slice($needs, 0, $NEEDS_SHOWN) as $n): ?>
          <li>
            <span class="main"><strong><?= h($n['sku']) ?></strong> <?= h($n['name']) ?>
              <span class="detail"><?= h(implode(' and ', array_filter([
                $n['photo'] ? ($n['photoSet'] ? 'photo file missing' : 'no photo') : '',
                $n['pdf'] ? ($n['pdfSet'] ? 'data sheet file missing' : 'no data sheet') : '',
              ]))) ?></span></span>
            <span class="ov-fix">
              <?php if ($n['photo']): ?><a href="upload-image.php?sku=<?= rawurlencode($n['sku']) ?>">Add photo</a><?php endif; ?>
              <?php if ($n['pdf']): ?><a href="upload-pdf.php?sku=<?= rawurlencode($n['sku']) ?>">Add data sheet</a><?php endif; ?>
            </span>
          </li>
          <?php endforeach; ?>
        </ul>
        <?php if (count($needs) > $NEEDS_SHOWN): ?>
          <p class="ov-empty" style="margin-top:8px">and <?= count($needs) - $NEEDS_SHOWN ?> more — the chips on <a href="index.php">All Products</a> show every one.</p>
        <?php endif; ?>
      <?php else: ?>
        <p class="ov-ok"><span aria-hidden="true">✓</span> Every product has its photo and data sheet.</p>
      <?php endif; ?>
    </section>

    <section class="card ov-card" id="ov-changes" aria-labelledby="ov-changes-h">
      <h2 class="card-title" id="ov-changes-h">Recent changes <a href="audit-log.php">Audit Log →</a></h2>
      <?php if ($changes): ?>
        <ul class="ov-list" aria-label="The last <?= count($changes) ?> changes">
          <?php foreach ($changes as $c):
            $act = (string)($c['action'] ?? '');
            $sku = (string)($c['sku'] ?? '');
            $detail = (string)($c['detail'] ?? '');
            if (strlen($detail) > 140) $detail = rtrim(substr($detail, 0, 137)) . '…'; ?>
          <li>
            <span class="main"><strong><?= h($CHANGE_LABEL[$act] ?? ucfirst($act)) ?></strong><?php
              if ($sku !== '' && !in_array($sku, ['-', 'multiple', 'admin'], true)): ?> · <?= h($sku) ?><?php endif; ?>
              <?php if ($detail !== ''): ?><span class="detail"><?= h($detail) ?></span><?php endif; ?></span>
            <span class="meta"><?= h($when((string)($c['ts'] ?? ''))) ?></span>
          </li>
          <?php endforeach; ?>
        </ul>
        <p class="ov-empty" style="margin-top:10px">Changed something by mistake? <a href="backups.php">Backups</a> can put the version before it back.</p>
      <?php else: ?>
        <p class="ov-empty">Nothing has been changed from this dashboard yet.</p>
      <?php endif; ?>
    </section>

    <section class="card ov-card" id="ov-shortcuts" aria-labelledby="ov-shortcuts-h">
      <h2 class="card-title" id="ov-shortcuts-h">Shortcuts</h2>
      <nav class="ov-shortcuts" aria-label="Shortcuts">
        <a href="index.php">All Products</a>
        <a href="add.php">Add Product</a>
        <a href="settings.php">Business Details</a>
        <a href="content.php">Page Content</a>
        <a href="site-images.php">Site Images &amp; Logo</a>
        <a href="marketing-pdfs.php">Catalog &amp; Brochure PDFs</a>
        <a href="backups.php">Backups</a>
        <a href="help.php">Help</a>
        <a href="/" target="_blank" rel="noopener">View Live Site ↗</a>
      </nav>
    </section>
  </div>
</main>
</body>
</html>
