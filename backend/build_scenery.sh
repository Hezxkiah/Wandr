#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT="${1:-$DIR/.graphhopper/plano-utd.osm.pbf}"
OUTPUT="$DIR/.graphhopper/scenery.geojsonseq"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/wandr-scenery.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
osmium tags-filter "$INPUT" 'nwr/leisure=park,garden,nature_reserve' 'nwr/landuse=forest,recreation_ground,grass' 'nwr/natural=wood,water,tree' 'nwr/waterway=river,stream,canal' 'nwr/tourism=viewpoint' 'w/tree_lined=yes,both,left,right' -o "$TMP/features.osm.pbf"
osmium export "$TMP/features.osm.pbf" -f geojsonseq -o "$OUTPUT"
echo "Scenery data written to $OUTPUT"
