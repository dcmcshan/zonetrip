#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

runtime_files="index.html booth.html styles.css script.js booth.js"

echo "Checking runtime files for external network references..."
if grep -RInE 'https?://|//[A-Za-z0-9.-]+|@import|<iframe|<img[^>]+src="https?:|fetch\(|XMLHttpRequest|navigator\.sendBeacon' $runtime_files; then
  echo "External runtime dependency found. Zone Trip must remain standalone." >&2
  exit 1
fi

echo "Checking required local files..."
test -f index.html
test -f booth.html
test -f styles.css
test -f script.js
test -f booth.js
test -f docs/Zone_Trip_White_Paper_First_Review.pdf
test -x bin/zonetrip-serve

echo "Standalone audit passed."
