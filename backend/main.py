import asyncio
import os
from math import asin, cos, radians, sin, sqrt
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

GRAPHHOPPER_URL = os.getenv("GRAPHHOPPER_URL", "http://localhost:8989").rstrip("/")
GRAPHHOPPER_TIMEOUT_SECONDS = float(os.getenv("GRAPHHOPPER_TIMEOUT_SECONDS", "30"))
WALKING_METERS_PER_MINUTE = float(os.getenv("WALKING_METERS_PER_MINUTE", "83.33"))
ROUND_TRIP_CANDIDATE_COUNT = 8
GEOCODER_URL = os.getenv(
    "GEOCODER_URL", "https://nominatim.openstreetmap.org"
).rstrip("/")
GEOCODER_USER_AGENT = os.getenv(
    "GEOCODER_USER_AGENT", "Wandr-local-development/0.2"
)
GEOCODER_COUNTRY_CODES = os.getenv("GEOCODER_COUNTRY_CODES", "us")
GEOCODER_VIEWBOX = os.getenv(
    "GEOCODER_VIEWBOX", "-106.646,36.501,-93.508,25.837"
)


class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class RouteRequest(BaseModel):
    start: Coordinate
    end: Coordinate | None = None
    end_name: str | None = Field(None, min_length=2, max_length=200)
    mode: Literal["point_to_point", "round_trip"] = "point_to_point"
    vibe: Literal["serenity", "discovery"] = "serenity"
    target_minutes: float = Field(30, gt=0, le=24 * 60)

def generate_endpoint(start: Coordinate, meters: float) -> Coordinate:
    # 1 degree lat ≈ 111,000 meters
    # 1 degree lon ≈ 111,000 * cos(lat) meters
    bearing = random.uniform(0, 2 * math.pi)
    d_lat = (meters / 111000) * math.cos(bearing)
    d_lon = (meters / 111000) * math.sin(bearing) / math.cos(math.radians(start.lat))
    return Coordinate(lat=start.lat + d_lat, lon=start.lon + d_lon)

CUSTOM_MODELS: dict[str, dict[str, Any]] = {
    "serenity": {
        "priority": [
            {
                "if": "road_class == MOTORWAY || road_class == TRUNK",
                "multiply_by": "0.05",
            },
            {"if": "road_class == PRIMARY", "multiply_by": "0.35"},
            {"if": "road_environment == TUNNEL", "multiply_by": "0.35"},
        ],
        "distance_influence": 50,
    },
    "discovery": {
        "priority": [
            {
                "if": "road_class == MOTORWAY || road_class == TRUNK",
                "multiply_by": "0.15",
            },
            {"if": "road_class == PRIMARY", "multiply_by": "0.60"},
            {
                "if": "road_class == RESIDENTIAL || road_class == LIVING_STREET",
                "multiply_by": "1.25",
            },
        ],
        "distance_influence": 100,
    },
}

LOW_TRAFFIC_ROAD_CLASSES = {
    "cycleway",
    "footway",
    "living_street",
    "path",
    "pedestrian",
    "residential",
    "service",
    "steps",
    "track",
}


def distance_between(first: list[float], second: list[float]) -> float:
    """Return the approximate distance between two [lon, lat] points in meters."""
    lon1, lat1 = map(radians, first[:2])
    lon2, lat2 = map(radians, second[:2])
    delta_lon = lon2 - lon1
    delta_lat = lat2 - lat1
    haversine = (
        sin(delta_lat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    )
    return 2 * 6_371_000 * asin(sqrt(haversine))


def low_traffic_percent(path: dict[str, Any], coordinates: list[list[float]]) -> int:
    details = path.get("details") or {}
    road_classes = details.get("road_class") or []
    total_distance = 0.0
    low_traffic_distance = 0.0

    for start, end, road_class in road_classes:
        segment_distance = sum(
            distance_between(coordinates[index], coordinates[index + 1])
            for index in range(max(0, start), min(end, len(coordinates) - 1))
        )
        total_distance += segment_distance
        if str(road_class).lower() in LOW_TRAFFIC_ROAD_CLASSES:
            low_traffic_distance += segment_distance

    if total_distance == 0:
        return 0
    return round(low_traffic_distance / total_distance * 100)


def common_payload(request: RouteRequest) -> dict[str, Any]:
    return {
        "profile": "foot",
        "ch.disable": True,
        "custom_model": CUSTOM_MODELS[request.vibe],
        "points_encoded": False,
        "instructions": True,
        "calc_points": True,
        "details": ["road_class", "road_environment"],
    }


def point_to_point_payload(
    request: RouteRequest, end: Coordinate | None = None
) -> dict[str, Any]:
    resolved_end = end or request.end
    if resolved_end is None:
        raise HTTPException(
            status_code=422,
            detail="A destination name is required for point-to-point walks",
        )

    direct_distance = distance_between(
        [request.start.lon, request.start.lat],
        [resolved_end.lon, resolved_end.lat],
    )
    target_distance = request.target_minutes * WALKING_METERS_PER_MINUTE
    max_weight_factor = max(
        1.4,
        min(5.0, (target_distance / max(direct_distance, 1)) * 1.5),
    )

    return {
        **common_payload(request),
        "points": [
            [request.start.lon, request.start.lat],
            [resolved_end.lon, resolved_end.lat],
        ],
        "algorithm": "alternative_route",
        "alternative_route.max_paths": 5,
        "alternative_route.max_weight_factor": max_weight_factor,
        "alternative_route.max_share_factor": 0.85,
    }


def round_trip_payload(request: RouteRequest, seed: int) -> dict[str, Any]:
    return {
        **common_payload(request),
        "points": [[request.start.lon, request.start.lat]],
        "algorithm": "round_trip",
        "round_trip.distance": request.target_minutes * WALKING_METERS_PER_MINUTE,
        "round_trip.seed": seed,
    }


def route_sort_key(path: dict[str, Any], target_minutes: float) -> tuple[bool, float]:
    duration_minutes = float(path.get("time", 0)) / 60000
    exceeds_limit = duration_minutes > target_minutes + 0.5
    return exceeds_limit, abs(duration_minutes - target_minutes)


def deduplicate_paths(paths: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique_paths: list[dict[str, Any]] = []
    seen: set[tuple[tuple[float, float], ...]] = set()

    for path in paths:
        points = path.get("points")
        coordinates = points.get("coordinates") if isinstance(points, dict) else None
        if not coordinates:
            continue
        signature = tuple(
            (round(float(coordinate[0]), 5), round(float(coordinate[1]), 5))
            for coordinate in coordinates
        )
        if signature in seen:
            continue
        seen.add(signature)
        unique_paths.append(path)

    return unique_paths


def feature_from_path(
    path: dict[str, Any], request: RouteRequest, rank: int
) -> dict[str, Any] | None:
    points = path.get("points")
    coordinates = points.get("coordinates") if isinstance(points, dict) else None
    if not coordinates:
        return None

    distance_meters = float(path.get("distance", 0))
    duration_minutes = float(path.get("time", 0)) / 60000

    return {
        "type": "Feature",
        "id": f"route-{rank}",
        "geometry": {"type": "LineString", "coordinates": coordinates},
        "properties": {
            "rank": rank,
            "mode": request.mode,
            "vibe": request.vibe,
            "target_minutes": request.target_minutes,
            "distance_meters": round(distance_meters, 2),
            "duration_minutes": round(duration_minutes, 2),
            "target_difference_minutes": round(
                duration_minutes - request.target_minutes, 2
            ),
            "within_time_limit": duration_minutes <= request.target_minutes + 0.5,
            "points": len(coordinates),
            "low_traffic_percent": low_traffic_percent(path, coordinates),
            "instructions": path.get("instructions", []),
        },
    }


app = FastAPI(title="Wandr Routing API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def geocode_destination(name: str) -> Coordinate:
    params = {
        "q": name,
        "format": "jsonv2",
        "limit": 1,
        "countrycodes": GEOCODER_COUNTRY_CODES,
        "viewbox": GEOCODER_VIEWBOX,
        "bounded": 1,
    }
    try:
        async with httpx.AsyncClient(
            base_url=GEOCODER_URL,
            timeout=10,
            headers={"User-Agent": GEOCODER_USER_AGENT},
        ) as client:
            response = await client.get("/search", params=params)
            response.raise_for_status()
            results = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Destination search timed out") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail="Destination search is unavailable"
        ) from exc

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f'Could not find "{name}" in the supported map area',
        )
    return Coordinate(lat=float(results[0]["lat"]), lon=float(results[0]["lon"]))


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/route")
async def create_route(request: RouteRequest) -> dict[str, Any]:
    resolved_end = request.end
    if request.mode == "point_to_point" and resolved_end is None:
        if not request.end_name:
            raise HTTPException(
                status_code=422,
                detail="A destination name is required for point-to-point walks",
            )
        resolved_end = await geocode_destination(request.end_name)

    try:
        async with httpx.AsyncClient(
            base_url=GRAPHHOPPER_URL,
            timeout=GRAPHHOPPER_TIMEOUT_SECONDS,
        ) as client:
            if request.mode == "round_trip":
                responses = await asyncio.gather(
                    *(
                        client.post("/route", json=round_trip_payload(request, seed))
                        for seed in range(ROUND_TRIP_CANDIDATE_COUNT)
                    )
                )
                paths: list[dict[str, Any]] = []
                for response in responses:
                    response.raise_for_status()
                    paths.extend(response.json().get("paths") or [])
            else:
                response = await client.post(
                    "/route", json=point_to_point_payload(request, resolved_end)
                )
                response.raise_for_status()
                paths = response.json().get("paths") or []
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

    unique_paths = deduplicate_paths(paths)
    if not unique_paths:
        raise HTTPException(status_code=502, detail="GraphHopper returned no route")

    ranked_paths = sorted(
        unique_paths,
        key=lambda path: route_sort_key(path, request.target_minutes),
    )[:3]
    features = [
        feature
        for rank, path in enumerate(ranked_paths, start=1)
        if (feature := feature_from_path(path, request, rank)) is not None
    ]

    if not features:
        raise HTTPException(status_code=502, detail="GraphHopper returned no route geometry")

    return {
        "type": "FeatureCollection",
        "features": features,
        "properties": {
            "mode": request.mode,
            "target_minutes": request.target_minutes,
            "requested_routes": 3,
            "returned_routes": len(features),
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
