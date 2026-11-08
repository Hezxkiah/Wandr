#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT="${1:-$DIR/.graphhopper/plano-utd.osm.pbf}"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/wandr-places.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
osmium tags-filter "$INPUT" 'nwr/addr:housenumber' -o "$TMP/places.osm.pbf"
osmium export "$TMP/places.osm.pbf" -f geojsonseq -o "$TMP/places.geojsonseq"
"$DIR/.venv/bin/python" "$DIR/build_places.py" "$TMP/places.geojsonseq" "$DIR/.graphhopper/places.json"
