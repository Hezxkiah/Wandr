"""Indexed local destination search; keystrokes stay on the local backend."""
import math
import os
import re
import sqlite3
from pathlib import Path

PATH = Path(os.getenv("WANDR_PLACES_FILE", Path(__file__).parent / ".graphhopper/places.sqlite"))


def search_places(query: str, limit: int = 8, lat=None, lon=None):
    if not PATH.is_file():
        return None
    tokens = re.findall(r"[^\W_]+", query.casefold(), re.UNICODE)
    if not tokens:
        return []
    match = " AND ".join(f'"{token}"*' for token in tokens)
    params = [match]
    where = "places MATCH ?"
    distance_sql = "0"
    distance_params = []
    if lat is not None and lon is not None:
        sx = 111.32 * math.cos(math.radians(lat))
        sy = 111.32
        distance_sql = "((lon - ?) * ? * (lon - ?) * ? + (lat - ?) * ? * (lat - ?) * ?)"
        distance_params = [lon, sx, lon, sx, lat, sy, lat, sy]
        where += f" AND {distance_sql} <= 3600"
        params += distance_params
    sql = f"SELECT name,label,lat,lon,{distance_sql} AS distance_squared FROM places WHERE {where} ORDER BY (lower(name) LIKE ?) DESC, distance_squared, length(label) LIMIT ?"
    arguments = distance_params + params + [query.casefold() + "%", limit * 4]
    with sqlite3.connect(f"{PATH.resolve().as_uri()}?mode=ro", uri=True, timeout=3) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(sql, arguments).fetchall()
    results, seen = [], set()
    for row in rows:
        key = (row["name"].casefold(), row["label"].casefold(), round(float(row["lat"]), 4), round(float(row["lon"]), 4))
        if key in seen:
            continue
        seen.add(key)
        results.append({"name": row["name"], "label": row["label"], "lat": float(row["lat"]), "lon": float(row["lon"]), "distance_km": round(math.sqrt(row["distance_squared"]), 1) if lat is not None and lon is not None else None})
        if len(results) == limit:
            break
    return results
