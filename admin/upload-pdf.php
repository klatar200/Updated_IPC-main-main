<?php
require_once 'config.php';
require_auth();

$sku      = $_GET['sku'] ?? '';
$products = load_products();
$idx      = find_product($products, $sku);
$errors   = [];
$success  = '';

if ($idx === -1) {
    header('Location: index.php?msg=Product+not+found&type=error');
    exit;
}

$product     = $products[$idx];
$currentPdf  = $product['pdfUrl'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check(); // #2

    // Branch A — explicit "Remove PDF" action: clears product.pdfUrl and
    // (best-effort) deletes the file on disk. Keeps the product record.
    if (($_POST['action'] ?? '') === 'remove' && !empty($currentPdf)) {
        $oldUrl = $currentPdf;
        $products[$idx]['pdfUrl'] = '';
        unset($products[$idx]['pdfUrl']);
        if (save_products($products)) {
            // Only unlink files inside our own PDF_DIR — never follow paths
            // outside the upload folder, even if pdfUrl was tampered with.
            $oldName = basename($oldUrl);
            $candidate = PDF_DIR . $oldName;
            $realPdfDir = realpath(PDF_DIR);
            $realFile   = realpath($candidate);
            if ($realPdfDir && $realFile && strpos($realFile, $realPdfDir) === 0) {
                @unlink($realFile);
            }
            audit_log('remove-pdf', $sku, 'Removed PDF: ' . $oldName);
            $success    = 'PDF removed. Visitors will now see “Request Data Sheet” for this product.';
            $currentPdf = '';
            $product    = $products[$idx];
        } else {
            $errors[] = 'Could not save the catalog. Check file permissions on products-all.json.';
        }
    }
    // Branch B — upload / replace flow (the original behavior).
    elseif (!isset($_FILES['pdf_file']) || $_FILES['pdf_file']['error'] !== UPLOAD_ERR_OK) {
        $errors[] = 'Please select a PDF file to upload.';
    } else {
        // Ensure PDF dir exists for the upload path.
        if (!is_dir(PDF_DIR)) {
            mkdir(PDF_DIR, 0755, true);
        }
        $file    = $_FILES['pdf_file'];
        $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        // Validate both extension and actual MIME type (defense in depth)
        $finfo    = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if ($ext !== 'pdf' || $mimeType !== 'application/pdf') {
            $errors[] = 'Only PDF files are accepted (extension and content must both be PDF).';
        } elseif ($file['size'] > 20 * 1024 * 1024) {
            $errors[] = 'File is too large. Maximum size is 20MB.';
        } else {
            // Build a normalized filename: sanitize SKU for filesystem (#5)
            $safeSku  = preg_replace('/[^a-zA-Z0-9_\-]/', '-', $sku); // non-alphanumeric → dash
            $safeSku  = preg_replace('/-{2,}/', '-', $safeSku);         // collapse repeated dashes
            $safeSku  = trim($safeSku, '-');                             // trim leading/trailing dashes
            $safeSku  = strtolower($safeSku);                           // lowercase
            $filename = $safeSku . '.pdf';
            $destPath = PDF_DIR . $filename;
            $destUrl  = PDF_URL . $filename;

            $isReplacement = file_exists($destPath); // #8 — track if we're replacing
            if (move_uploaded_file($file['tmp_name'], $destPath)) {
                // Update the product record with the new PDF URL
                $products[$idx]['pdfUrl'] = $destUrl;
                if (save_products($products)) {
                    audit_log('upload-pdf', $sku, ($isReplacement ? 'Replaced' : 'Uploaded') . ' PDF: ' . $filename); // #6
                    $success    = ($isReplacement ? 'PDF replaced' : 'PDF uploaded') . ' and product updated.';
                    $currentPdf = $destUrl;
                    $product    = $products[$idx];
                } else {
                    $errors[] = 'PDF was saved but could not update products.json.';
                }
            } else {
                $errors[] = 'Upload failed. Check write permissions on the /pdfs/ directory.';
            }
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Upload PDF: <?= h($sku) ?></title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
    header { background: #0d2d52; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
    .logo { color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; }
    nav a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 13px; margin-left: 16px; }
    main { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 28px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 28px; margin-bottom: 20px; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #005da3; margin: 0 0 20px; padding-bottom: 8px; border-bottom: 1px solid #e5e9ee; }
    label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
    .hint { font-size: 11px; color: #9ca3af; margin-top: 5px; }
    input[type=file] { width: 100%; padding: 10px; border: 2px dashed #d1d9e0; border-radius: 8px; font-size: 13px; cursor: pointer; transition: border-color 0.15s; }
    input[type=file]:hover { border-color: #005da3; }
    .btn { display: inline-flex; align-items: center; padding: 10px 22px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: background 0.15s; }
    .btn-primary { background: #005da3; color: #fff; width: 100%; justify-content: center; margin-top: 16px; }
    .btn-primary:hover { background: #004e8c; }
    .btn-secondary { background: #f0f4f8; color: #141414; font-size: 13px; padding: 8px 16px; }
    .current-pdf { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f0f4f8; border-radius: 8px; font-size: 13px; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
  </style>
</head>
<body>
<header>
  <a class="logo" href="index.php">← IPC Admin</a>
  <nav>
    <a href="edit.php?sku=<?= urlencode($sku) ?>">Edit Details</a>
    <a href="auth.php?logout=1">Sign Out</a>
  </nav>
</header>
<main>
  <h1>Upload PDF: <?= h($sku) ?></h1>
  <p class="sub"><?= h($product['name'] ?? '') ?></p>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>
  <?php if ($success): ?>
    <div class="alert-success">✅ <?= h($success) ?></div>
  <?php endif; ?>

  <!-- Current PDF -->
  <div class="card">
    <div class="card-title">Current Data Sheet</div>
    <?php if ($currentPdf): ?>
      <div class="current-pdf">
        <span>📄 <?= h(basename($currentPdf)) ?></span>
        <div style="display:flex;gap:8px;align-items:center">
          <a href="<?= h($currentPdf) ?>" target="_blank" class="btn btn-secondary">View PDF</a>
          <form method="POST" style="display:inline" onsubmit="return confirm('Remove this PDF? The product will revert to showing &quot;Request Data Sheet&quot; on the website. The PDF file will be deleted from the server.');">
            <input type="hidden" name="action" value="remove">
            <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
            <button type="submit" class="btn btn-secondary" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca">Remove PDF</button>
          </form>
        </div>
      </div>
      <div class="hint" style="margin-top:10px">Uploading a new file will replace this PDF. The file will be saved as <code><?= h(preg_replace('/[^a-zA-Z0-9_\-]/', '-', $sku)) ?>.pdf</code> in the <code>/pdfs/</code> folder.</div>
    <?php else: ?>
      <p style="color:#9ca3af;font-size:13px;margin:0">No PDF uploaded yet for this product — the website is showing a “Request Data Sheet” button.</p>
    <?php endif; ?>
  </div>

  <!-- Upload form -->
  <div class="card">
    <div class="card-title">Upload New PDF</div>
    <form method="POST" enctype="multipart/form-data">
      <label for="pdf_file">Select PDF File (max 20MB)</label>
      <input type="file" id="pdf_file" name="pdf_file" accept=".pdf,application/pdf" required />
      <?php
        $safeSku2 = strtolower(trim(preg_replace('/-{2,}/', '-', preg_replace('/[^a-zA-Z0-9_\-]/', '-', $sku)), '-'));
        $willOverwrite = file_exists(PDF_DIR . $safeSku2 . '.pdf');
      ?>
      <div class="hint">
        The file will be saved as <code><?= h($safeSku2) ?>.pdf</code> in the <code>/pdfs/</code> directory.
        <?php if ($willOverwrite): ?>
          <span style="color:#dc2626;font-weight:600"> ⚠ This will replace the existing PDF for this product.</span>
        <?php endif; ?>
      </div>
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <button type="submit" class="btn btn-primary"><?= $willOverwrite ? 'Replace PDF →' : 'Upload PDF →' ?></button>
    </form>
  </div>

  <a href="index.php" class="btn btn-secondary">← Back to Products</a>
</main>
</body>
</html>
