#!/usr/bin/env bash
# Downloads the images/fonts the design still hotlinks from Webflow's CDN and
# stores them in static/assets/, so the site keeps working after the Webflow
# subscription ends.
#
# Run AFTER a build (convert.mjs writes build/assets.tsv), from the repo root:
#   bash build/fetch-assets.sh
#
# Must run somewhere with network access to cdn.prod.website-files.com.

set -euo pipefail

manifest="build/assets.tsv"
dest="static/assets"

[ -f "$manifest" ] || { echo "no $manifest — run: node build/convert.mjs" >&2; exit 1; }
mkdir -p "$dest"

ok=0; skip=0; fail=0
while IFS=$'\t' read -r remote local; do
  [ -n "${remote:-}" ] || continue
  if [ -s "$dest/$local" ]; then
    skip=$((skip+1)); continue
  fi
  if curl -fsSL --max-time 60 -o "$dest/$local" "$remote"; then
    ok=$((ok+1))
    printf '  %-52s %s\n' "$local" "$(du -h "$dest/$local" | cut -f1)"
  else
    fail=$((fail+1))
    rm -f "$dest/$local"
    echo "  FAILED: $remote" >&2
  fi
done < "$manifest"

echo
echo "downloaded $ok, already present $skip, failed $fail"
[ "$fail" -eq 0 ]
