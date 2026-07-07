<?php
/**
 * IPC Admin — LOCAL password override (gitignored).
 *
 * This file overrides the shipped-default ADMIN_PASSWORD_HASH in config.php.
 * config.php loads this file first, so the hash below is the one that counts.
 *
 * Deploy: upload this file into public_html/admin/ alongside config.php.
 * Never commit it — it is listed in .gitignore.
 *
 * To change the password later: regenerate a bcrypt hash (PHP:
 * password_hash('new-pass', PASSWORD_DEFAULT)) and replace the string below.
 */
define('ADMIN_PASSWORD_HASH', '$2y$12$akgfrrdQ7t7lna3vD.QImOR/IKotBCYByHUA2/PUMFHymewlQJWQO');
