#!/usr/bin/env bash
# Fetch the latest public catalogue and rebuild both datasets. No keys needed.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "→ fetching public product feed…"
curl -fsS "https://martinmartin-paris.com/products.json?limit=250" -o data/products_raw.json
echo "→ building datasets…"
python3 scripts/build_dataset.py
python3 scripts/build_girls.py
echo "✓ done — site/data refreshed."
