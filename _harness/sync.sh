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

cp _harness/pristine/content.json      _harness/site/data/content.json
cp _harness/pristine/site-info.json    _harness/site/data/site-info.json
cp _harness/pristine/products-all.json _harness/site/data/products-all.json

php _harness/setpw.php

echo "mirror bundle: $(grep -o 'index-[A-Za-z0-9_-]*\.js' _harness/site/index.html)"
echo "built  bundle: $(grep -o 'index-[A-Za-z0-9_-]*\.js' dist/index.html)"
