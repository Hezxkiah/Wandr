import math
import os
import random
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

GRAPHHOPPER_URL = os.getenv("GRAPHHOPPER_URL", "http://localhost:8989").rstrip("/")
GRAPHHOPPER_TIMEOUT_SECONDS = float(os.getenv("GRAPHHOPPER_TIMEOUT_SECONDS", "30"))


class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class RouteRequest(BaseModel):
    start: Coordinate
    end: Coordinate | None = None
    vibe: Literal["serenity", "discovery"] = "serenity"
    target_minutes: float = Field(30, gt=0, le=24 * 60)

def generate_endpoint(start: Coordinate, meters: float) -> Coordinate:
    # 1 degree lat ≈ 111,000 meters
    # 1 degree lon ≈ 111,000 * cos(lat) meters
    bearing = random.uniform(0, 2 * math.pi)
    d_lat = (meters / 111000) * math.cos(bearing)
    d_lon = (meters / 111000) * math.sin(bearing) / math.cos(math.radians(start.lat))
    return Coordinate(lat=start.lat + d_lat, lon=start.lon + d_lon)

# These models use attributes available in standard GraphHopper profiles. They
# are intentionally kept server-independent: a model can only reference
# encoded values that the selected GraphHopper profile exposes.
CUSTOM_MODELS: dict[str, dict[str, Any]] = {
    "serenity": {
        "priority": [
            {
                "if": "road_class == MOTORWAY || road_class == TRUNK",
                "multiply_by": "0.05",
            },
            {
                "if": "road_class == PRIMARY",
                "multiply_by": "0.35",
            },
            {
                "if": "road_environment == TUNNEL",
                "multiply_by": "0.35",
            },
        ],
        "distance_influence": 50,
    },
    "discovery": {
        "priority": [
            {
                "if": "road_class == MOTORWAY || road_class == TRUNK",
                "multiply_by": "0.15",
            },
            {
                "if": "road_class == PRIMARY",
                "multiply_by": "0.60",
            },
            {
                "if": "road_class == RESIDENTIAL || road_class == LIVING_STREET",
                "multiply_by": "1.25",
            },
        ],
        "distance_influence": 100,
    },
}


app = FastAPI(title="Wandr Routing API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/route")
async def create_route(request: RouteRequest, time: int | None = None) -> dict[str, Any]:
    # GraphHopper POST points must be [longitude, latitude].
    if request.end is None:
        meters_one_way = (request.target_minutes * 80) / 2  # ~80 m/min walking
        request.end = generate_endpoint(request.start, meters_one_way)
    
    graphhopper_payload = {
        "points": [
            [request.start.lon, request.start.lat],
            [request.end.lon, request.end.lat],
        ],
        "profile": "foot",
        "ch.disable": True,
        "custom_model": CUSTOM_MODELS[request.vibe],
        "points_encoded": False,
        "instructions": True,
        "calc_points": True,
    }

    try:
        async with httpx.AsyncClient(
            base_url=GRAPHHOPPER_URL,
            timeout=GRAPHHOPPER_TIMEOUT_SECONDS,
        ) as client:
            response = await client.post("/route", json=graphhopper_payload)
            response.raise_for_status()
            graphhopper_data = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="GraphHopper request timed out") from exc
    except httpx.HTTPStatusError as exc:
        detail = "GraphHopper rejected the route request"
        try:
            detail = exc.response.json().get("message", detail)
        except ValueError:
            pass
        raise HTTPException(status_code=502, detail=detail) from exc
    except (httpx.RequestError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="GraphHopper is unavailable") from exc

    paths = graphhopper_data.get("paths") or []
    if not paths:
        raise HTTPException(status_code=502, detail="GraphHopper returned no route")

    path = paths[0]
    points = path.get("points")
    coordinates = points.get("coordinates") if isinstance(points, dict) else None
    if not coordinates:
        raise HTTPException(status_code=502, detail="GraphHopper returned no route geometry")

    distance_meters = float(path.get("distance", 0))
    duration_ms = float(path.get("time", 0))
    duration_minutes = duration_ms / 60000

    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates,
        },
        "properties": {
            "vibe": request.vibe,
            "target_minutes": request.target_minutes,
            "distance_meters": round(distance_meters, 2),
            "duration_minutes": round(duration_minutes, 2),
            "target_difference_minutes": round(
                duration_minutes - request.target_minutes, 2
            ),
            "points": len(coordinates),
            "instructions": path.get("instructions", []),
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

