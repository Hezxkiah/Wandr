"""Approximate proximity to mapped scenery; missing data is not absence."""
import json
import math
import os
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.ops import nearest_points, transform
from shapely.strtree import STRtree

DATA = Path(os.getenv("WANDR_SCENERY_FILE", Path(__file__).parent / ".graphhopper/scenery.geojsonseq"))
# The bundled build instructions use this bounding box; override for other extracts.
BOUNDS = tuple(float(x) for x in os.getenv("WANDR_SCENERY_BOUNDS", "-96.95,32.94,-96.60,33.15").split(","))
WEIGHTS = {"park": 0.4, "water": 0.3, "trees": 0.2, "viewpoint": 0.1}
RADIUS = {"park": 80, "water": 80, "trees": 30, "viewpoint": 50}


def category(tags):
    if tags.get("tourism") == "viewpoint": return "viewpoint"
    if tags.get("natural") == "water" or tags.get("waterway") in {"river", "stream", "canal"}: return "water"
    if tags.get("natural") in {"wood", "tree"} or tags.get("landuse") == "forest" or tags.get("tree_lined") in {"yes", "both", "left", "right"}: return "trees"
    if tags.get("leisure") in {"park", "garden", "nature_reserve"} or tags.get("landuse") in {"recreation_ground", "grass"}: return "park"
    return None


class SceneryIndex:
    def __init__(self, path=DATA):
        self.geometries, self.categories, self.names = [], [], []
        self.available = path.is_file()
        if self.available:
            with path.open() as source:
                for line in source:
                    try:
                        feature = json.loads(line.lstrip("\x1e"))
                        kind = category(feature.get("properties") or {})
                        geom = shape(feature["geometry"])
                        if kind and not geom.is_empty:
                            self.geometries.append(geom)
                            self.categories.append(kind)
                            tags = feature.get("properties") or {}
                            self.names.append(tags.get("name") or tags.get("name:en") or "")
                    except (ValueError, KeyError, TypeError):
                        continue
        self.tree = STRtree(self.geometries)

    def nearby(self, coordinate, limit=3):
        if not self.available or not self.geometries:
            return []
        lon, lat = coordinate[:2]
        sx = 111320 * math.cos(math.radians(lat))
        sy = 111320
        pt = Point(lon, lat)
        results = []
        # Use actual local meter distances; prefer named landmarks over anonymous grass/trees.
        for idx in self.tree.query(pt.buffer(250 / min(sx, sy))):
            if not self.names[idx]:
                continue
            local = transform(lambda x, y, z=None: ((x - lon) * sx, (y - lat) * sy), self.geometries[idx])
            distance = local.distance(Point(0, 0))
            if distance <= 250:
                nearest = nearest_points(pt, self.geometries[idx])[1]
                results.append({"kind": self.categories[idx], "name": self.names[idx], "distance_meters": round(distance), "coordinate": [nearest.x, nearest.y]})
        results.sort(key=lambda item: item["distance_meters"])
        unique = {}
        for result in results:
            unique.setdefault((result["kind"], result["name"].casefold()), result)
        return list(unique.values())[:limit]

    def score(self, coordinates):
        if not self.available or not self.geometries or not coordinates or any(not (BOUNDS[0] <= x <= BOUNDS[2] and BOUNDS[1] <= y <= BOUNDS[3]) for x, y, *_ in coordinates):
            return None
        totals = dict.fromkeys(WEIGHTS, 0.0)
        length = 0.0
        for a, b in zip(coordinates, coordinates[1:]):
            lat = (a[1] + b[1]) / 2
            sx = 111320 * math.cos(math.radians(lat)); sy = 111320
            dist = math.hypot((b[0]-a[0])*sx, (b[1]-a[1])*sy)
            count = max(1, math.ceil(dist / 25))
            for i in range(count):
                t = (i + .5) / count
                pt = Point(a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t)
                length += dist / count
                nearby = set()
                for idx in self.tree.query(pt.buffer(100 / min(sx, sy))):
                    kind = self.categories[idx]
                    # Degree-space distance is converted conservatively at local latitude.
                    if self.geometries[idx].distance(pt) * min(sx, sy) <= RADIUS[kind]: nearby.add(kind)
                for kind in nearby: totals[kind] += dist / count
        if not length: return None
        percentages = {k: round(100 * v / length) for k, v in totals.items()}
        # A pleasant route need not contain every kind of scenery. Blend its
        # strongest category with variety, then gently lift partial coverage.
        coverage = {k: v / length for k, v in totals.items()}
        variety = sum(coverage[k] * WEIGHTS[k] for k in WEIGHTS)
        combined = 0.5 * max(coverage.values()) + 0.5 * variety
        score = round(100 * min(1.0, max(0.0, combined)) ** 0.75)
        return {"score": score, "nearby_percent": percentages}


index = SceneryIndex()
