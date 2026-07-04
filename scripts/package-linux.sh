#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

./scripts/audit-standalone.sh

name="zonetrip-standalone"
version="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
build_dir="dist/$name-$version"

rm -rf dist
mkdir -p "$build_dir"

cp -R \
  .nojekyll \
  README.md \
  DEPLOY.md \
  index.html \
  booth.html \
  styles.css \
  script.js \
  booth.js \
  docs \
  bin \
  deploy \
  install.sh \
  "$build_dir"/

chmod 0755 "$build_dir/bin/zonetrip-serve" "$build_dir/install.sh"

tar -C dist -czf "dist/$name-$version.tar.gz" "$name-$version"

echo "Wrote dist/$name-$version.tar.gz"
