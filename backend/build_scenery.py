"""Build the local scenery GeoJSON sequence from an OpenStreetMap extract."""

import argparse
import json
from pathlib import Path

import osmium

from scenery import BOUNDS, category


def in_bounds(lon, lat):
    return BOUNDS[0] <= lon <= BOUNDS[2] and BOUNDS[1] <= lat <= BOUNDS[3]


class SceneryWriter(osmium.SimpleHandler):
    def __init__(self, stream):
        super().__init__()
        self.stream = stream
        self.count = 0

    def write(self, tags, geometry):
        if not category(tags):
            return
        self.stream.write(
            json.dumps(
                {"type": "Feature", "properties": tags, "geometry": geometry},
                separators=(",", ":"),
            )
            + "\n"
        )
        self.count += 1

    def node(self, node):
        if node.location.valid() and in_bounds(node.location.lon, node.location.lat):
            self.write(
                dict(node.tags),
                {"type": "Point", "coordinates": [node.location.lon, node.location.lat]},
            )

    def way(self, way):
        coordinates = [
            [node.location.lon, node.location.lat]
            for node in way.nodes
            if node.location.valid()
        ]
        if not coordinates or not any(in_bounds(lon, lat) for lon, lat in coordinates):
            return
        closed = len(coordinates) >= 4 and coordinates[0] == coordinates[-1]
        geometry = {
            "type": "Polygon" if closed else "LineString",
            "coordinates": [coordinates] if closed else coordinates,
        }
        self.write(dict(way.tags), geometry)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument(
        "output",
        type=Path,
        nargs="?",
        default=Path(__file__).parent / ".graphhopper/scenery.geojsonseq",
    )
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as output:
        writer = SceneryWriter(output)
        writer.apply_file(args.input, locations=True)
    print(f"Wrote {writer.count} scenery features to {args.output}")


if __name__ == "__main__":
    main()
