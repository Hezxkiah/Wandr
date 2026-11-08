#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="${GRAPHHOPPER_RUNTIME_DIR:-$SCRIPT_DIR/.graphhopper}"
JAR_PATH="$RUNTIME_DIR/graphhopper-web-11.1.jar"
MAP_FILE="${1:-$RUNTIME_DIR/plano-utd.osm.pbf}"
JAVA_BIN="${JAVA_BIN:-/opt/homebrew/opt/openjdk@25/bin/java}"

if [[ ! -x "$JAVA_BIN" ]]; then
  echo "Java 25 was not found at $JAVA_BIN. Set JAVA_BIN to a Java 25+ executable." >&2
  exit 1
fi

if [[ ! -f "$JAR_PATH" ]]; then
  echo "GraphHopper 11.1 was not found at $JAR_PATH." >&2
  exit 1
fi

if [[ ! -f "$MAP_FILE" ]]; then
  echo "The OSM map was not found at $MAP_FILE." >&2
  exit 1
fi

cd "$SCRIPT_DIR"
exec "$JAVA_BIN" \
  "-Ddw.graphhopper.datareader.file=$MAP_FILE" \
  "-Ddw.graphhopper.graph.location=$RUNTIME_DIR/plano-utd-graph-cache" \
  -jar "$JAR_PATH" server graphhopper.yml
