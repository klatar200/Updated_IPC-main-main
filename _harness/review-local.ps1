# Stand the built site up on this PC for a manual review of the public pages
# and the admin dashboard. Windows PowerShell 5.1. Pure ASCII on purpose
# (PS 5.1 misreads a .ps1 with non-ASCII bytes and no BOM).
#
#   powershell -ExecutionPolicy Bypass -File _harness\review-local.ps1
#   powershell -ExecutionPolicy Bypass -File _harness\review-local.ps1 -Port 8090 -NoBuild
#
# Every run rebuilds _harness\site (gitignored) from scratch: dist\ after
# `npm run build`, admin\, data\, pdfs\, uploads\ -- the same set
# _harness/sync.sh copies, except data\ comes straight from the repo, not
# _harness\pristine. So anything changed in the review admin is thrown away
# on the next run, and the repo's own data\ is never written.
#
# Admin: http://127.0.0.1:<port>/admin/  password audit-pass-123 (this mirror
# only, written by _harness\setpw.php; never admin\config.local.php).
#
# Not exercised here (CLAUDE.md): php -S ignores .htaccess and .user.ini, so
# the file-blocking rules are Apache-only; the quote form cannot send email
# from a PC (no mail server), so its confirmation is not a test of mail.
param([int]$Port = 8080, [switch]$NoBuild)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

foreach ($tool in 'node', 'npm', 'php') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    Write-Host "Missing: '$tool' is not on PATH." -ForegroundColor Red
    if ($tool -eq 'php') {
      Write-Host 'Install PHP 8.x: the x64 Thread Safe zip from https://windows.php.net/download/ - unzip it (e.g. C:\php), add that folder to PATH, open a NEW PowerShell window, run this again.'
    } else {
      Write-Host 'Install Node.js LTS from https://nodejs.org/, open a NEW PowerShell window, run this again.'
    }
    exit 1
  }
}

if (-not $NoBuild) {
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
}
if (-not (Test-Path (Join-Path $repo 'dist\index.php'))) { throw 'dist\ has no build in it - run without -NoBuild' }

$site = Join-Path $repo '_harness\site'
if (Test-Path $site) { Remove-Item $site -Recurse -Force }
New-Item -ItemType Directory -Path $site | Out-Null

# dist\ (bundle, index.php, contact.php, sitemap.php, images, .htaccess)
Copy-Item -Path (Join-Path $repo 'dist\*') -Destination $site -Recurse -Force

# admin\ -- never a local config.local.php or logs, as in sync.sh
$adm = Join-Path $site 'admin'
New-Item -ItemType Directory -Path $adm | Out-Null
Get-ChildItem -Path (Join-Path $repo 'admin') -File -Force |
  Where-Object { ($_.Extension -eq '.php' -and $_.Name -ne 'config.local.php') -or $_.Extension -eq '.js' -or $_.Name -eq 'logo.svg' -or $_.Name -eq '.htaccess' } |
  Copy-Item -Destination $adm -Force

$dat = Join-Path $site 'data'
New-Item -ItemType Directory -Path $dat | Out-Null
foreach ($f in 'content.json', 'site-info.json', 'products-all.json') {
  Copy-Item -Path (Join-Path $repo "data\$f") -Destination $dat -Force
}

Copy-Item -Path (Join-Path $repo 'pdfs') -Destination $site -Recurse -Force

$img = Join-Path $site 'uploads\images'
New-Item -ItemType Directory -Path $img -Force | Out-Null
if (Test-Path (Join-Path $repo 'uploads\images\*')) {
  Copy-Item -Path (Join-Path $repo 'uploads\images\*') -Destination $img -Recurse -Force
}
Copy-Item -Path (Join-Path $repo 'uploads\.htaccess') -Destination (Join-Path $site 'uploads') -Force

& php (Join-Path $repo '_harness\setpw.php')
if ($LASTEXITCODE -ne 0) { throw 'setting the mirror password failed' }

# The admin needs gd (photo re-encoding), fileinfo (upload type check) and
# mbstring. A fresh Windows PHP zip has no php.ini, so load any that are off.
$phpArgs = @()
$loaded = (& php -m) -join "`n"
$need = @('gd', 'fileinfo', 'mbstring') | Where-Object { $loaded -notmatch "(?mi)^$_\s*$" }
if ($need) {
  $extDir = Join-Path (Split-Path -Parent (Get-Command php).Source) 'ext'
  $phpArgs += @('-d', "extension_dir=$extDir")
  foreach ($e in $need) {
    if (-not (Test-Path (Join-Path $extDir "php_$e.dll"))) {
      Write-Host "Warning: php_$e.dll not found in $extDir - photo/PDF uploads may fail." -ForegroundColor Yellow
    }
    $phpArgs += @('-d', "extension=$e")
  }
}

$url = "http://127.0.0.1:$Port/"
Write-Host ''
Write-Host "Site:   $url" -ForegroundColor Green
Write-Host "Admin:  ${url}admin/   password: audit-pass-123" -ForegroundColor Green
Write-Host 'Stop:   Ctrl+C in this window'
Write-Host ''

# Open the browser a moment after the server starts (php -S blocks below).
Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 2; Start-Process $u } -ArgumentList $url | Out-Null

& php @phpArgs -S "127.0.0.1:$Port" -t $site (Join-Path $repo '_harness\router.php')
