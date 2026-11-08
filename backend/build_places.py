"""Build a compact local autocomplete index from an OSM extract."""
import argparse
import json
from pathlib import Path

import osmium
from shapely.geometry import shape

from scenery import BOUNDS


class PlaceIndex(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.places = []
        self.seen = set()

    def add(self, tags, lon, lat):
        if not (BOUNDS[0] <= lon <= BOUNDS[2] and BOUNDS[1] <= lat <= BOUNDS[3]):
            return
        number, street = tags.get("addr:housenumber"), tags.get("addr:street")
        if not number or not street:
            return
        address = f"{number} {street}"
        label = ", ".join(filter(None, [address, tags.get("addr:city"), tags.get("addr:state"), tags.get("addr:postcode")]))
        key = (label.casefold(), round(lat, 4), round(lon, 4))
        if key not in self.seen:
            self.seen.add(key)
            self.places.append({"label": label, "name": tags.get("name", ""), "lat": lat, "lon": lon})

    def node(self, node):
        if node.location.valid():
            self.add(node.tags, node.location.lon, node.location.lat)

    def way(self, way):
        locations = [node.location for node in way.nodes if node.location.valid()]
        if locations:
            self.add(
                way.tags,
                sum(location.lon for location in locations) / len(locations),
                sum(location.lat for location in locations) / len(locations),
            )


def from_geojson(source):
    index = PlaceIndex()
    with source.open(encoding="utf-8") as stream:
        for line in stream:
            try:
                feature = json.loads(line.lstrip("\x1e"))
                point = shape(feature["geometry"]).representative_point()
                if not point.is_empty:
                    index.add(feature.get("properties") or {}, point.x, point.y)
            except (ValueError, TypeError, KeyError):
                continue
    return index


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument(
        "output",
        type=Path,
        nargs="?",
        default=Path(__file__).parent / ".graphhopper/places.json",
    )
    args = parser.parse_args()
    if args.input.name.endswith(".osm.pbf"):
        index = PlaceIndex()
        index.apply_file(args.input, locations=True)
    else:
        index = from_geojson(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as stream:
        json.dump(index.places, stream, separators=(",", ":"))
    print(f"Indexed {len(index.places)} places in {args.output}")


if __name__ == "__main__":
    main()
