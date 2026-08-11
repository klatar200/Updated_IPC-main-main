<?php
/**
 * Shared admin header/nav — included on every authenticated admin page so
 * the navbar is identical everywhere. This partial is self-contained (its
 * own scoped <style> block) so it renders the same regardless of whatever
 * CSS the including page already has.
 *
 * Expects config.php to already be loaded and require_auth() to already
 * have run (require_once below is just a defensive no-op if not).
 *
 * Optional variables a page can set before including this file:
 *   $navActive  string — one of 'products' | 'add' | 'auditlog' | 'help'
 *               to underline that tab as the current page.
 *   $navExtra   string — raw HTML for one extra, page-specific link (e.g.
 *               "Upload PDF" on edit.php) inserted before the standard set.
 */
require_once 'config.php';
require_auth(); // defense in depth if this partial is ever requested directly

$navActive = $navActive ?? '';
$navExtra  = $navExtra  ?? '';
?>
<style>
  /* A10-021 — min-height, NOT height. With a fixed 60px the 11-item nav laid
     out 95px tall from y = -17 at 390 and the bar did not clip it: "Products"
     and "+ Add Product" painted above the document top and were unreachable at
     any scroll position, while "View Live Site" and "Sign Out" painted 16.5px
     BELOW the bar onto the #f0f4f8 page background while keeping their white
     ink — 1.07:1 and 1.05:1, against 7.53:1 for the links that stayed on it.
     Rick could neither navigate nor sign out from a phone.
     The layout was never the problem: at 834 and 1024 the same nav already
     wrapped to two rows inside the bar and every link was legible. Only the
     fixed height was. min-height plus vertical padding lets the bar grow to
     contain whatever the nav needs, and flex-wrap lets the logo and nav stack
     when 390 demands it. box-sizing is border-box globally, so the padding is
     inside the 60px and desktop is unchanged at exactly 60px, one row.
     `height: auto` is load-bearing and is NOT redundant with min-height. Six
     pages — add, audit-log, edit, help, index, upload-pdf — redeclare this bar
     in their own <head> as a bare `header { ... height: 60px ... }`, and an
     explicit height clamps the box no matter what min-height says, so without
     this the fix worked on settings.php and silently did nothing on the
     catalog and the Help page. `.ipc-admin-header` (0,1,0) outranks `header`
     (0,0,1), so overriding here fixes every page from the file that owns the
     header rather than editing six copies. The duplication itself is logged in
     WHATS_LEFT.md section 2. */
  .ipc-admin-header { background: #0d2d52; padding: 8px 24px; height: auto; min-height: 60px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .ipc-admin-header nav { display: flex; flex-wrap: wrap; align-items: center; row-gap: 4px; }
  .ipc-admin-header .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .ipc-admin-header .logo-title { color: #fff; font-size: 13px; font-weight: 700; }
  .ipc-admin-header .logo-sub   { color: rgba(255,255,255,0.5); font-size: 10px; }
  .ipc-admin-header nav a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 13px; margin-left: 20px; }
  .ipc-admin-header nav a:hover, .ipc-admin-header nav a.current { color: #fff; }
  .ipc-admin-header nav a.current { border-bottom: 2px solid #005da3; padding-bottom: 4px; }
  .ipc-admin-header .logout { color: rgba(255,255,255,0.5) !important; }
</style>
<header class="ipc-admin-header">
  <a class="logo" href="index.php">
    <img src="logo.svg" alt="IPC" style="width:38px;height:38px;border-radius:6px;display:block;flex-shrink:0;">
    <div>
      <div class="logo-title">IPC Admin</div>
      <div class="logo-sub">Product Manager</div>
    </div>
  </a>
  <nav>
    <?php if ($navExtra !== '') echo $navExtra; ?>
    <a href="index.php" class="<?= $navActive === 'products' ? 'current' : '' ?>">Products</a>
    <a href="add.php" class="<?= $navActive === 'add' ? 'current' : '' ?>">+ Add Product</a>
    <a href="settings.php" class="<?= $navActive === 'settings' ? 'current' : '' ?>">Business Details</a>
    <a href="content.php" class="<?= $navActive === 'content' ? 'current' : '' ?>">Page Content</a>
    <a href="inquiries.php" class="<?= $navActive === 'inquiries' ? 'current' : '' ?>">Inquiries</a>
    <a href="backups.php" class="<?= $navActive === 'backups' ? 'current' : '' ?>">Backups</a>
    <a href="audit-log.php" class="<?= $navActive === 'auditlog' ? 'current' : '' ?>">Audit Log</a>
    <a href="password.php" class="<?= $navActive === 'password' ? 'current' : '' ?>">Password</a>
    <a href="help.php" class="<?= $navActive === 'help' ? 'current' : '' ?>">Help</a>
    <a href="/" target="_blank" rel="noopener" title="Opens the public site in a new tab">View Live Site ↗</a>
    <form method="POST" action="auth.php" style="display:inline;margin:0;">
      <input type="hidden" name="logout" value="1">
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <button type="submit" class="logout" style="background:none;border:none;padding:0;margin-left:20px;font:inherit;font-size:13px;color:rgba(255,255,255,0.5);cursor:pointer;">Sign Out</button>
    </form>
  </nav>
</header>
