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
  .ipc-admin-header { background: #0d2d52; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
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
    <a href="audit-log.php" class="<?= $navActive === 'auditlog' ? 'current' : '' ?>">Audit Log</a>
    <a href="help.php" class="<?= $navActive === 'help' ? 'current' : '' ?>">Help</a>
    <a href="/" target="_blank" rel="noopener" title="Opens the public site in a new tab">View Live Site ↗</a>
    <form method="POST" action="auth.php" style="display:inline;margin:0;">
      <input type="hidden" name="logout" value="1">
      <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
      <button type="submit" class="logout" style="background:none;border:none;padding:0;margin-left:20px;font:inherit;font-size:13px;color:rgba(255,255,255,0.5);cursor:pointer;">Sign Out</button>
    </form>
  </nav>
</header>
