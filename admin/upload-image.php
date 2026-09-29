<?php
require_once 'config.php';
require_auth();

/**
 * Product image manager — upload, replace, or remove a product's photo.
 * Mirrors upload-pdf.php. Files live in /uploads/images/ which is OUTSIDE the
 * Vite build output, so redeploying the React app never clobbers photos.
 */

$sku      = as_str($_GET['sku'] ?? null);   // A-5.7 — ?sku[]=x fatalled find_product(string)
$products = load_products();
$idx      = find_product($products, $sku);
$errors   = [];
$success  = '';

// Accepted formats: IPC_IMG_TYPES in config.php (extension AND sniffed MIME
// must match; SVG deliberately excluded — script-injection vector).

if ($idx === -1) {
    flash_redirect('Product not found', 'error');
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
    // SEC-12 — `image_file[]` makes every key an array; say so instead of a TypeError.
    elseif (!upload_field_is_single('image_file')) {
        $errors[] = 'Please choose one image file at a time.';
    }
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
        // uploads/.htaccess (NEW-N3-3) and every image check — extension and
        // sniffed MIME (A-5.x), no PHP tag in the bytes (A-9.P3-2, NEW-V1-1),
        // 8 MB, the pixel ceiling before any decode (SEC-2), a real decode —
        // now live in config.php (uploads_protection_problem(),
        // uploaded_image_problem()) so the Site Images page runs the same ones.
        // Order and messages are unchanged.
        $file    = $_FILES['image_file'];
        $problem = uploads_protection_problem();
        if ($problem === '') $problem = uploaded_image_problem($file, $ext);
        if ($problem !== '') {
            $errors[] = $problem;
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
            // SEC-1 — never write over a file ANOTHER product is using. Two
            // real ways in: SKUs that sanitise to the same name ("AUD-1" and
            // "AUD 1" are both AUD-1.png), and a new product reusing an old SKU
            // whose renamed owner still points at OLD.png. Either overwrote the
            // other product's live photo under "Photo replaced". upload-pdf.php
            // refuses in this case (T3.6); a photo takes the next free name
            // instead, because "rename the SKU first" is no fix for Rick.
            // Compared by index, not SKU, so two rows with the same SKU still
            // count as different products. (audit-runs/audit-2026-09-27.md SEC-1)
            $others = $products;
            unset($others[$idx]);
            if (image_in_use($others, $filename)) {
                $stem = pathinfo($filename, PATHINFO_FILENAME);
                for ($n = 2; $n < 1000; $n++) {
                    $filename = $stem . '-' . $n . '.' . $ext;
                    if (!file_exists(IMG_DIR . $filename) && !image_in_use($others, $filename)) break;
                }
            }
            $destPath = IMG_DIR . $filename;
            $destUrl  = IMG_URL . $filename;

            $isReplacement = file_exists($destPath);
            if (move_uploaded_file($file['tmp_name'], $destPath)) {
                // A-5.16 — bound the pixel size once the file is in place.
                // A-7.6 — and keep the reason, so "too big to resize" can be
                // said out loud instead of reading like "already fine".
                $resizeReason = '';
                $wasResized = image_downscale_in_place($destPath, $ext, $resizeReason);
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
                    $success      = ($isReplacement ? 'Photo replaced' : 'Photo uploaded') . ' and product updated.'
                                    // A-5.16 (resized), A-9.P2-2 (no gd: saved at full size, the only
                                    // silent outcome until then) — text in image_resize_note(), shared
                                    // with site-images.php. SEC-2 refuses over-ceiling images earlier.
                                    . image_resize_note($wasResized, $resizeReason);
                    $currentPhoto = $destUrl;
                    $isManaged    = true;
                    $product      = $products[$idx];
                } else {
                    $errors[] = 'Image was saved but could not update products-all.json.';
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
  <?= admin_head() ?>
  <style>
    main { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
    .sub { font-size: 13px; color: #6b7280; margin: 0 0 28px; }
    .card { background: #fff; border: 1px solid #e5e9ee; border-radius: 12px; padding: 28px; margin-bottom: 20px; }
    /* Kept, against admin_head()'s shared 5px: these two upload pages and
       password.php have always used 6px here. One pixel, but the point of
       the extraction was that it changed nothing on screen. */
    label { margin-bottom: 6px; }
    .hint { font-size: 11px; color: #9ca3af; margin-top: 5px; }
    input[type=file] { width: 100%; padding: 10px; border: 2px dashed #d1d9e0; border-radius: 8px; font-size: 13px; cursor: pointer; transition: border-color 0.15s; }
    input[type=file]:hover { border-color: #005da3; }
    .btn { display: inline-flex; align-items: center; padding: 10px 22px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: background 0.15s; }
    .btn-primary { background: #005da3; color: #fff; width: 100%; justify-content: center; margin-top: 16px; }
    .btn-secondary { background: #f0f4f8; color: #141414; font-size: 13px; padding: 8px 16px; }
    .current-img { padding: 12px 16px; background: #f0f4f8; border-radius: 8px; font-size: 13px; }
    .current-img img { max-width: 100%; max-height: 260px; display: block; margin: 0 auto 12px; border-radius: 6px; background: #fff; }
    .img-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
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
      <label for="image_file">Select image — JPG, PNG, WEBP, or GIF (max <?= h(min_upload_label(8)) ?>)</label>
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
