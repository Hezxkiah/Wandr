# Scenic routing plan

GraphHopper does not expose a single `scenic=true` parameter. Wandr should generate a varied candidate set, use a custom model to prefer pleasant walking edges, then score and diversify the results.

## 1. Improve the walking custom model

- Prefer `FOOTWAY`, `PATH`, `TRACK`, `PEDESTRIAN`, and `LIVING_STREET` road classes.
- Penalize `PRIMARY`, `SECONDARY`, tunnels, and high-speed road environments.
- Keep `distance_influence` low enough to permit a pleasant detour, but not so low that routes become erratic.
- Preserve hard safety and access restrictions from the `foot` profile.

The first version can use the encoded values already loaded by this project: `road_class`, `road_environment`, and `foot_priority`.

## 2. Import richer edge attributes

Add `surface`, `smoothness`, `urban_density`, `average_slope`, and `lit` to GraphHopper's encoded values, then rebuild the graph cache. These allow Wandr to avoid poor surfaces, dense arterial areas, steep climbs, and unlit segments when appropriate. Rebuilding the graph cache is required whenever encoded values change.

## 3. Add nature-aware custom areas

Generate GeoJSON custom areas from OpenStreetMap polygons and load them with GraphHopper's `custom_areas.directory` setting:

- Reward parks, forests, nature reserves, trails, and waterfront buffers.
- Penalize industrial zones and large parking or commercial areas.
- Refer to those polygons in the custom model as `in_<area_id>` conditions.

This is the key step for a meaningful “percent near nature” metric; road class alone cannot reliably identify nature.

## 4. Generate and rank candidates

- Point-to-point: request up to five alternatives with a scenic custom model.
- Round-trip: generate 12–20 seeded loops and vary target distance slightly around the user's time limit.
- Score every candidate using time fit, nature exposure, low-traffic exposure, surface quality, slope, and route overlap.
- Select three routes with a diversity penalty so results are visibly different.
- Treat duration as a limit: prefer routes at or below it, then minimize the gap from the requested duration.

Suggested initial score:

```text
0.40 nature exposure
+ 0.20 low-traffic exposure
+ 0.15 walking-path exposure
+ 0.10 surface quality
+ 0.10 time fit
+ 0.05 low slope
- overlap penalty against already selected routes
```

## 5. Calibrate with real walks

Log only anonymous route-quality feedback: selected route, skipped routes, and an optional rating. Use it to tune weights by city and season. Keep score components in the API response so the interface can explain each recommendation with concrete metrics.
