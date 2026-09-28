<?php
require_once 'config.php';
require_auth();

$sku      = as_str($_GET['sku'] ?? null);   // A-5.7 — ?sku[]=x fatalled find_product(string)
$products = load_products();
$idx      = find_product($products, $sku);

if ($idx === -1) {
    flash_redirect('Product not found', 'error');
}

$product = $products[$idx];
$navActive = '';

// POST = confirmed delete — verify CSRF token
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $before = $products;
    array_splice($products, $idx, 1);
    $brokenRefs = industry_refs_broken_by($before, $products); // ADM-14
    if (save_products($products)) {
        // Also remove the product's PDF so deleting a product doesn't leave an
        // orphaned data sheet on disk. Scoped strictly to PDF_DIR so a tampered
        // pdfUrl can never make us unlink a file outside the upload folder.
        // Clean up the product's PDF files — the primary sheet plus any
        // additionalPdfs (F2). $products already has the deleted row spliced
        // out, so pdf_delete_if_unused() only keeps a file when a DIFFERENT
        // product still references it (e.g. a shared datasheet).
        $pdfUrls = [];
        if (!empty($product['pdfUrl'])) $pdfUrls[] = $product['pdfUrl'];
        if (!empty($product['additionalPdfs']) && is_array($product['additionalPdfs'])) {
            foreach ($product['additionalPdfs'] as $ap) {
                if (!empty($ap['url'])) $pdfUrls[] = $ap['url'];
            }
        }
        $removed = []; $kept = [];
        foreach ($pdfUrls as $u) {
            $res = pdf_delete_if_unused($products, $u);
            if ($res === 'removed')   $removed[] = basename($u);
            elseif ($res === 'kept')  $kept[]    = basename($u);
        }
        // The uploaded photo was never cleaned up — image_in_use() existed and
        // was never called here, so every deleted product left an orphan in
        // uploads/images/. (DEPLOY_READINESS_v2 4.33)
        $photoDetail = '';
        $photoUrl = (string)($product['photoUrl'] ?? '');
        if ($photoUrl !== '' && strpos($photoUrl, IMG_URL) === 0) {
            $photoName = basename($photoUrl);
            if ($photoName !== '' && $photoName !== '.' && $photoName !== '..') {
                if (image_in_use($products, $photoName)) {
                    $photoDetail = ' | Photo kept (used by another product): ' . $photoName;
                } elseif (file_to_trash(IMG_DIR, $photoName)) {
                    // ADM-3 — moved aside, not erased, so a catalog restore
                    // brings it back (config.php file_to_trash()).
                    $photoDetail = ' | Photo removed: ' . $photoName;
                }
            }
        }
        $pdfDetail = '';
        if ($removed) $pdfDetail .= ' | PDFs removed: ' . implode(', ', $removed);
        if ($kept)    $pdfDetail .= ' | PDFs kept (used by another product): ' . implode(', ', $kept);
        $pdfDetail .= $photoDetail;
        audit_log('delete', $sku, 'Product deleted: ' . ($product['name'] ?? '') . $pdfDetail); // #6
        flash_redirect($sku . ' deleted successfully'
            . ($brokenRefs ? '. Note: the Industries page still links to it from ' . implode(', ', $brokenRefs)
                . ' — those links now show "product not found". Fix them in Page Content → Industries.' : ''), 'success');
    }
    flash_redirect('Delete failed — check file permissions', 'error');
}

// GET = confirmation page
// ADM-14 — say BEFORE the click which Industries links this delete breaks.
$without = $products;
array_splice($without, $idx, 1);
$brokenRefs = industry_refs_broken_by($products, $without);
?>
<!doctype html>
<html lang="en">
<head>
  <?php /* A8 — the viewport tag. Every other admin page carries it; this one
           did not, so the one page where misreading the SKU costs a product
           rendered desktop-zoomed on a phone. (audit-runs/audit1.md A-08) */ ?>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><link rel="icon" type="image/svg+xml" href="logo.svg" /><title>IPC Admin — Delete <?= h($sku) ?></title>
  <?= admin_head() ?>
  <style>
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; }
    main { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 60px); padding: 24px; }
    .card { background: #fff; border-radius: 12px; padding: 40px; max-width: 440px; width: 100%; box-shadow: 0 4px 24px rgba(0,45,82,0.12); text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 800; color: #141414; margin: 0 0 8px; }
    p  { font-size: 14px; color: #6b7280; margin: 0 0 28px; }
    .product-name { font-weight: 600; color: #141414; }
    .actions { display: flex; gap: 10px; justify-content: center; }
    .btn { padding: 10px 24px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: background 0.15s; }
    .btn-danger { background: #dc2626; color: #fff; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-cancel { background: #f0f4f8; color: #141414; }
    .btn-cancel:hover { background: #e5e9ee; }
  </style>
</head>
<body>
<?php include 'nav.php'; ?>
<main>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Delete this product?</h1>
    <p>
      <span class="product-name"><?= h($sku) ?> — <?= h($product['name'] ?? '') ?></span><br><br>
      <?php /* Was: "The PDF file (if any) will also be deleted… This action
               cannot be undone." Both halves were wrong — the uploaded PHOTO is
               deleted too and went unmentioned, and save_products() writes a
               backup first, so it CAN be undone from backups.php, which is in
               his own navigation. (AUDIT_v3_FINDINGS D13 / §3.6) */ ?>
      This removes it from the catalog. Its PDF data sheet and its uploaded
      photo come off the website too — unless another product still uses the
      same file, in which case that file stays.
    </p>
    <p style="font-size:13px;color:#4b5563">
      <?php /* ADM-3 — this promise used to be half true: the catalog came back
               but the files had been erased. They are now kept out of sight,
               and a restore puts them back. */ ?>
      <strong>This can be undone.</strong> A backup of the whole catalog is
      saved immediately before the deletion, and the data sheet and photo are
      kept out of sight rather than erased. If this is a mistake, go to
      <a href="backups.php">Backups</a> and restore the most recent
      <em>Product Catalog</em> entry — the product, its data sheet and its photo
      all come back. Do it before making other changes — only
      the <?= (int)BACKUP_KEEP ?> most recent backups are kept, and every save
      counts.
    </p>
    <?php if ($brokenRefs): ?>
    <p style="font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:10px 12px">
      <strong>The Industries page links to this product</strong> from <?= h(implode(', ', $brokenRefs)) ?>.
      After deleting, those links show &ldquo;product not found&rdquo; until you change them in
      <a href="content.php">Page Content</a> &rarr; Industries.
    </p>
    <?php endif; ?>
    <div class="actions">
      <a href="index.php" class="btn btn-cancel">Cancel</a>
      <form method="POST" style="display:inline">
        <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
        <button type="submit" class="btn btn-danger">Yes, Delete</button>
      </form>
    </div>
  </div>
</main>
</body>
</html>
