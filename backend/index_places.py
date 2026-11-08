"""Build a local full-text destination database from the generated JSON index."""
import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path


def build(source, output):
    output = Path(output)
    with Path(source).open() as stream:
        places = json.load(stream)
    with tempfile.TemporaryDirectory(prefix="wandr-search-", dir=output.parent) as work:
        temporary = Path(work) / "places.sqlite"
        with sqlite3.connect(temporary) as connection:
            connection.execute("PRAGMA journal_mode=OFF")
            connection.execute("CREATE VIRTUAL TABLE places USING fts5(name, label, lat UNINDEXED, lon UNINDEXED)")
            connection.executemany(
                "INSERT INTO places(name,label,lat,lon) VALUES (?,?,?,?)",
                ((place.get("name", ""), place["label"], place["lat"], place["lon"]) for place in places),
            )
            connection.execute("INSERT INTO places(places) VALUES ('optimize')")
        os.replace(temporary, output)
    print(f"Indexed {len(places)} destinations for fast search in {output}", flush=True)


if __name__ == "__main__":
    build(*sys.argv[1:3])
