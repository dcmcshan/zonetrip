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
  WORLD_MODEL.md \
  HARDWARE.md \
  PROCESSOR.md \
  charter.md \
  model.md \
  index.html \
  booth.html \
  styles.css \
  script.js \
  scene.js \
  booth.js \
  booth-config.js \
  favicon.svg \
  CNAME \
  docs \
  bin \
  manifesto \
  architecture \
  assets \
  vendor \
  services \
  deploy \
  scripts \
  install.sh \
  "$build_dir"/

chmod 0755 "$build_dir/bin/zonetrip-serve" "$build_dir/bin/zonetrip-capture-once" "$build_dir/install.sh" "$build_dir/scripts/install-local-ai.sh" "$build_dir/scripts/deploy-cloud-run-processor.sh" "$build_dir/scripts/deploy-cloud-run.sh" "$build_dir/scripts/package-linux.sh" "$build_dir/scripts/audit-standalone.sh"
chmod 0755 "$build_dir/scripts/test-processor-contract.py"

tar -C dist -czf "dist/$name-$version.tar.gz" "$name-$version"

echo "Wrote dist/$name-$version.tar.gz"
