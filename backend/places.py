"""Search the local OSM extract without sending keystrokes to a geocoder."""
import json
import os
from functools import lru_cache
from pathlib import Path

PATH = Path(os.getenv("WANDR_PLACES_FILE", Path(__file__).parent / ".graphhopper/places.json"))


@lru_cache(maxsize=1)
def load_places():
    if not PATH.is_file():
        return None
    with PATH.open() as source:
        return json.load(source)


def search_places(query: str, limit: int = 6):
    places = load_places()
    if places is None:
        return None
    tokens = query.casefold().split()
    matches = [p for p in places if all(token in (p["label"] + " " + p.get("name", "")).casefold() for token in tokens)]
    matches.sort(key=lambda p: (not p["label"].casefold().startswith(query.casefold()), not p.get("name", "").casefold().startswith(query.casefold()), len(p["label"]), p["label"]))
    results = []
    seen = set()
    for place in matches:
        key = (place.get("name", "").casefold(), place["label"].casefold())
        if key in seen:
            continue
        seen.add(key)
        results.append({"label": place["label"], "name": place.get("name", ""), "lat": place["lat"], "lon": place["lon"]})
        if len(results) >= limit:
            break
    return results
