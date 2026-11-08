"""Build a compact local autocomplete index from an OSM GeoJSON sequence."""
import json
import sys
from pathlib import Path

from shapely.geometry import shape

source, output = map(Path, sys.argv[1:3])
places = []
seen = set()
with source.open() as stream:
    for line in stream:
        try:
            feature = json.loads(line.lstrip("\x1e"))
            tags = feature.get("properties") or {}
            name = tags.get("name")
            address = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
            if not tags.get("addr:housenumber") or not tags.get("addr:street"):
                continue
            point = shape(feature["geometry"]).representative_point()
            if point.is_empty:
                continue
            label = ", ".join(filter(None, [address, tags.get("addr:city"), tags.get("addr:state"), tags.get("addr:postcode")]))
            key = (label.casefold(), round(point.y, 4), round(point.x, 4))
            if key not in seen:
                seen.add(key)
                places.append({"label": label, "name": name or "", "lat": point.y, "lon": point.x})
        except (ValueError, TypeError, KeyError):
            continue
with output.open("w") as stream:
    json.dump(places, stream, separators=(",", ":"))
print(f"Indexed {len(places)} places in {output}")
