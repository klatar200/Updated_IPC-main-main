<?php
require_once 'config.php';
require_auth();

$sku      = $_GET['sku'] ?? '';
$products = load_products();
$idx      = find_product($products, $sku);

if ($idx === -1) {
    header('Location: index.php?msg=Product+not+found&type=error');
    exit;
}

$product = $products[$idx];
$navActive = '';

// POST = confirmed delete — verify CSRF token
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    array_splice($products, $idx, 1);
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
                } else {
                    $realImgDir = realpath(IMG_DIR);
                    $realFile   = realpath(IMG_DIR . $photoName);
                    if ($realImgDir && $realFile && strpos($realFile, $realImgDir) === 0) {
                        @unlink($realFile);
                        $photoDetail = ' | Photo removed: ' . $photoName;
                    }
                }
            }
        }
        $pdfDetail = '';
        if ($removed) $pdfDetail .= ' | PDFs removed: ' . implode(', ', $removed);
        if ($kept)    $pdfDetail .= ' | PDFs kept (used by another product): ' . implode(', ', $kept);
        $pdfDetail .= $photoDetail;
        audit_log('delete', $sku, 'Product deleted: ' . ($product['name'] ?? '') . $pdfDetail); // #6
        header('Location: index.php?msg=' . urlencode($sku . ' deleted successfully') . '&type=success');
        exit;
    }
    header('Location: index.php?msg=' . urlencode('Delete failed — check file permissions') . '&type=error');
    exit;
}

// GET = confirmation page
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><link rel="icon" type="image/svg+xml" href="logo.svg" /><title>IPC Admin — Delete <?= h($sku) ?></title>
  <style>
    * { box-sizing: border-box; }
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
      photo are deleted from the server too — unless another product still
      uses the same file, in which case that file is kept.
    </p>
    <p style="font-size:13px;color:#4b5563">
      <strong>This can be undone.</strong> A backup of the whole catalog is
      saved immediately before the deletion, so if this is a mistake, go to
      <a href="backups.php">Backups</a> and restore the most recent
      <em>Product Catalog</em> entry. Do it before making other changes — only
      the <?= (int)BACKUP_KEEP ?> most recent backups are kept, and every save
      counts.
    </p>
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
