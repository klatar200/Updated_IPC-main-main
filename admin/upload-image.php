<?php
require_once 'config.php';
require_auth();

/**
 * Product image manager — upload, replace, or remove a product's photo.
 * Mirrors upload-pdf.php. Files live in /uploads/images/ which is OUTSIDE the
 * Vite build output, so redeploying the React app never clobbers photos.
 */

$sku      = $_GET['sku'] ?? '';
$products = load_products();
$idx      = find_product($products, $sku);
$errors   = [];
$success  = '';

// Accepted formats: extension AND sniffed MIME must both match. SVG is
// deliberately excluded (script-injection vector when served inline).
$IMG_TYPES = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'webp' => 'image/webp',
    'gif'  => 'image/gif',
];

if ($idx === -1) {
    header('Location: index.php?msg=Product+not+found&type=error');
    exit;
}

$product      = $products[$idx];
$currentPhoto = $product['photoUrl'] ?? '';
// Only photos inside our upload folder are managed (replace/delete) here;
// external URLs and build-shipped /images/ paths are left untouched on disk.
$isManaged = $currentPhoto !== '' && strpos($currentPhoto, IMG_URL) === 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    // Branch A — "Remove photo": clears product.photoUrl; deletes the file
    // only if it lives in IMG_DIR and no other product references it.
    if (($_POST['action'] ?? '') === 'remove' && $currentPhoto !== '') {
        $oldUrl = $currentPhoto;
        unset($products[$idx]['photoUrl']);
        if (save_products($products)) {
            $oldName = basename($oldUrl);
            if (strpos($oldUrl, IMG_URL) === 0 && !image_in_use($products, $oldName)) {
                $realImgDir = realpath(IMG_DIR);
                $realFile   = realpath(IMG_DIR . $oldName);
                if ($realImgDir && $realFile && strpos($realFile, $realImgDir) === 0) {
                    @unlink($realFile);
                }
            }
            audit_log('remove-image', $sku, 'Removed photo: ' . $oldName);
            $success      = 'Photo removed. The product will show the IPC branded placeholder.';
            $currentPhoto = '';
            $isManaged    = false;
            $product      = $products[$idx];
        } else {
            $errors[] = 'Could not save the catalog. Check file permissions on products-all.json.';
        }
    }
    // Branch B — upload / replace.
    elseif (!isset($_FILES['image_file']) || $_FILES['image_file']['error'] !== UPLOAD_ERR_OK) {
        $errors[] = upload_error_message($_FILES['image_file']['error'] ?? UPLOAD_ERR_NO_FILE, 'image');
    } else {
        // The mkdir() return was unchecked, and creating uploads/images/ at
        // runtime produced a folder WITHOUT the .htaccess that blocks script
        // execution there. Create both, and fail loudly if we can't.
        // (DEPLOY_READINESS_v2 T3.2)
        if (!is_dir(IMG_DIR) && !@mkdir(IMG_DIR, 0755, true) && !is_dir(IMG_DIR)) {
            $errors[] = 'Could not create the uploads/images folder on the server. Create public_html/uploads/images/ over FTP and make it writable (755).';
        }
        $uploadsHt = dirname(rtrim(IMG_DIR, '/')) . '/.htaccess';
        if (is_dir(dirname($uploadsHt)) && !file_exists($uploadsHt)) {
            @file_put_contents($uploadsHt, "# Uploaded files are DATA. Never let the web server execute anything here.\n"
                . "php_flag engine off\n"
                . "AddType text/plain .php .php3 .php4 .php5 .phtml .pl .py .cgi .sh .htaccess\n"
                . "<FilesMatch \"\\.(php|php[3-9]|phtml|pl|py|cgi|sh)$\">\n"
                . "  Order allow,deny\n"
                . "  Deny from all\n"
                . "</FilesMatch>\n");
        }
        $file = $_FILES['image_file'];
        $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        // Content sniffing via getimagesize() — decodes the actual image
        // header, needs no PHP extension (fileinfo isn't enabled everywhere).
        $sniffed  = @getimagesize($file['tmp_name']);
        $mimeType = $sniffed !== false ? (string)($sniffed['mime'] ?? '') : '';
        // Cross-check with finfo when the extension is available (Linux hosts).
        if ($mimeType !== '' && function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $fmime = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);
            if ($fmime !== $mimeType) $mimeType = '';
        }

        if (!isset($IMG_TYPES[$ext]) || $mimeType !== $IMG_TYPES[$ext]) {
            $errors[] = 'Only JPG, PNG, WEBP, or GIF images are accepted (extension and content must match).';
        } elseif ($file['size'] > 8 * 1024 * 1024) {
            $errors[] = 'File is too large. Maximum size is 8MB.';
        } else {
            // Filename strategy (mirrors the PDF manager): replace in place if
            // this product already has a managed photo with the same extension;
            // otherwise derive a fresh name from the SKU.
            $existingName = $isManaged ? basename($currentPhoto) : '';
            if ($existingName !== ''
                && preg_match('/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|gif)$/i', $existingName)
                && strtolower(pathinfo($existingName, PATHINFO_EXTENSION)) === $ext) {
                $filename = $existingName;
            } else {
                $filename = image_filename_for_sku($sku, $ext);
            }
            $destPath = IMG_DIR . $filename;
            $destUrl  = IMG_URL . $filename;

            $isReplacement = file_exists($destPath);
            if (move_uploaded_file($file['tmp_name'], $destPath)) {
                // If the extension changed, clean up the old managed file
                // (unless another product still points at it).
                if ($isManaged && basename($currentPhoto) !== $filename) {
                    $oldName = basename($currentPhoto);
                    $products[$idx]['photoUrl'] = $destUrl; // update before in-use check
                    if (!image_in_use($products, $oldName)) {
                        $realImgDir = realpath(IMG_DIR);
                        $realFile   = realpath(IMG_DIR . $oldName);
                        if ($realImgDir && $realFile && strpos($realFile, $realImgDir) === 0) {
                            @unlink($realFile);
                        }
                    }
                }
                $products[$idx]['photoUrl'] = $destUrl;
                if (save_products($products)) {
                    audit_log('upload-image', $sku, ($isReplacement ? 'Replaced' : 'Uploaded') . ' photo: ' . $filename);
                    $success      = ($isReplacement ? 'Photo replaced' : 'Photo uploaded') . ' and product updated.';
                    $currentPhoto = $destUrl;
                    $isManaged    = true;
                    $product      = $products[$idx];
                } else {
                    $errors[] = 'Image was saved but could not update products.json.';
                }
            } else {
                $errors[] = 'Upload failed. Check write permissions on the /uploads/images/ directory.';
            }
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><link rel="icon" type="image/svg+xml" href="logo.svg" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IPC Admin — Product Photo: <?= h($sku) ?></title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; margin: 0; color: #141414; }
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
    .current-img { padding: 12px 16px; background: #f0f4f8; border-radius: 8px; font-size: 13px; }
    .current-img img { max-width: 100%; max-height: 260px; display: block; margin: 0 auto 12px; border-radius: 6px; background: #fff; }
    .img-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .error-list { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
  </style>
</head>
<body>
<?php
$navExtra = '<a href="edit.php?sku=' . urlencode($sku) . '">Edit Details</a>'
          . '<a href="upload-pdf.php?sku=' . urlencode($sku) . '">Manage PDF</a>';
include 'nav.php';
?>
<main>
  <h1>Product Photo: <?= h($sku) ?></h1>
  <p class="sub"><?= h($product['name'] ?? '') ?></p>

  <?php if (!empty($errors)): ?>
    <ul class="error-list"><?php foreach ($errors as $e): ?><li><?= h($e) ?></li><?php endforeach; ?></ul>
  <?php endif; ?>
  <?php if ($success): ?>
    <div class="alert-success">✅ <?= h($success) ?></div>
  <?php endif; ?>

  <!-- Current photo -->
  <div class="card">
    <div class="card-title">Current Photo</div>
    <?php if ($currentPhoto): ?>
      <div class="current-img">
        <img src="<?= h($currentPhoto) ?>" alt="<?= h($sku) ?> product photo">
        <div class="img-row">
          <span>🖼 <?= h(basename($currentPhoto)) ?><?= $isManaged ? '' : ' (external — not stored in /uploads/images/)' ?></span>
          <form method="POST" style="display:inline" data-confirm="Remove this photo? The product will revert to the IPC branded placeholder on the website.<?= $isManaged ? ' The image file will be deleted from the server.' : '' ?>">
            <input type="hidden" name="action" value="remove">
            <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
            <button type="submit" class="btn btn-secondary" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca">Remove Photo</button>
          </form>
        </div>
      </div>
    <?php else: ?>
      <p style="color:#9ca3af;font-size:13px;margin:0">No photo set — the website is showing the IPC branded placeholder for this product.</p>
    <?php endif; ?>
  </div>

  <!-- Upload form -->
  <div class="card">
    <div class="card-title">Upload New Photo</div>
    <form method="POST" enctype="multipart/form-data">
      <label for="image_file">Select image — JPG, PNG, WEBP, or GIF (max 8MB)</label>
      <input type="file" id="image_file" name="image_file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" required />
      <div class="hint">
        The file is saved in <code>/uploads/images/</code> named after the SKU and the product's Photo URL is updated automatically.
        <?php if ($isManaged): ?><span style="color:#dc2626;font-weight:600"> ⚠ Uploading replaces the current photo.</span><?php endif; ?>
        A landscape photo around 1200×900px looks best on the product page.
      </div>
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <button type="submit" class="btn btn-primary"><?= $isManaged ? 'Replace Photo →' : 'Upload Photo →' ?></button>
    </form>
  </div>

  <a href="index.php" class="btn btn-secondary">← Back to Products</a>
</main>
<script src="confirm.js"></script>
</body>
</html>
