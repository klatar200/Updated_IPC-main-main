#!/bin/sh
# Re-sync the mirror from source. Run after EVERY `npm run build` and after
# every edit under admin/ or public/, or the suites test stale code — this has
# caused false passes before (GUARDRAILS 4.2).
#
# Deliberately removes site/assets first: Vite emits a content-hashed bundle,
# so a plain copy leaves the previous hash behind and index.html can end up
# pointing at either one.
set -e
cd "$(dirname "$0")/.."

# Bootstrap after a fresh clone: site/, pristine/ and out/ are gitignored, so
# they do not exist yet. pristine/ is the reference copy the suites restore from
# and compare against with cmp — it is seeded from data/ ONCE and then left
# alone, so a suite that accidentally writes to the mirror can still be caught.
# It is deliberately NOT re-copied on every sync: refreshing it from data/ each
# time would silently launder exactly the corruption it exists to detect.
if [ ! -d _harness/pristine ]; then
  echo "bootstrap: seeding _harness/pristine from data/"
  mkdir -p _harness/pristine
  cp data/content.json data/site-info.json data/products-all.json _harness/pristine/
fi
mkdir -p _harness/site/data _harness/site/admin _harness/out

rm -rf _harness/site/assets
cp -r dist/. _harness/site/
cp admin/*.php _harness/site/admin/
cp admin/*.js  _harness/site/admin/
# logo.svg was never copied, so every admin page in the mirror rendered a broken
# <img> and a 404 favicon — the brand mark is missing from every admin
# screenshot in the audit record, and any suite measuring the header was
# measuring a header without its logo. Deliberately NOT a `cp admin/*`:
# admin/.htaccess must stay out, because `php -S` ignores it and its presence in
# the mirror would imply file-blocking coverage the harness does not have.
# (audit-runs/audit1.md A-14)
cp admin/logo.svg _harness/site/admin/

# pdfs/ is served by the datasheet index and by every product page's download
# button. Without it in the mirror every pdfUrl 404s for a reason that has
# nothing to do with the site, and plan7-datasheets measures the harness.
# rsync-free: only copy when the source is newer, 8 MB is not worth re-copying
# on every sync.
cp -ru pdfs _harness/site/ 2>/dev/null || cp -r pdfs _harness/site/

cp _harness/pristine/content.json      _harness/site/data/content.json
cp _harness/pristine/site-info.json    _harness/site/data/site-info.json
cp _harness/pristine/products-all.json _harness/site/data/products-all.json

php _harness/setpw.php

echo "mirror bundle: $(grep -o 'index-[A-Za-z0-9_-]*\.js' _harness/site/index.html)"
echo "built  bundle: $(grep -o 'index-[A-Za-z0-9_-]*\.js' dist/index.html)"

# STALE-dist GUARD.
#
# The header above says to run this after every edit under admin/ or public/,
# and for admin/ that is true — those files are copied straight across. public/
# is NOT: Vite's publicDir copies it into dist/, so a public/ file reaches the
# mirror only through `npm run build`. Running sync.sh alone after editing
# public/contact.php serves the PREVIOUS file, and the two bundle lines printed
# above cannot reveal it — a contact.php edit does not change the bundle hash,
# so both lines match and everything looks fine.
#
# Measured 2026-08-13: the first pass of a contact.php change was verified
# against a stale mirror and reported the old behaviour as still live.
# Compare the two trees instead of trusting the bundle hash.
# (audit-runs/audit2.md B-03)
stale=''
for f in public/*; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  if [ ! -f "dist/$b" ] || ! cmp -s "$f" "dist/$b"; then
    stale="$stale $b"
  fi
done
if [ -n "$stale" ]; then
  echo "STALE:        dist/ does not match public/ for:$stale"
  echo "              The mirror is serving the OLD copies. Run: npm run build && sh _harness/sync.sh"
  exit 1
fi
echo "public/ vs dist/: in sync"
