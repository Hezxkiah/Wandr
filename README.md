# Wandr 🚶🌳

Take the scenic route. Wandr suggests walking routes based on your starting location, available time, and whether you want to return to your start or end somewhere new. Compare routes by mapped scenery and quieter roads, then explore with directions and location-aware companion messages.

## What you can do

- Choose your current location or an Austin/Dallas starting point.
- Generate a round-trip walk or search for a destination reachable within your time limit.
- Compare up to three routes with integer walk scores out of 10.
- Switch between simple and satellite maps.
- Test a walk with the development simulator: play, pause, change speed, and scrub along the route.

This guide sets up **Texas-wide coverage**, including Austin, Dallas, and College Station. Coverage comes from the map you import; selecting a city in the interface does not download its map.

## Architecture

You need **three services running in separate terminals**:

| Service | Local address | Role |
| --- | --- | --- |
| GraphHopper 11.1 / Java | `http://localhost:8989` | Pedestrian routing, walking times, and directions |
| FastAPI / Python | `http://localhost:8000` | Destination search, route selection, scoring, and narration |
| Next.js / React | `http://localhost:3000` | Browser interface and MapLibre maps |

The frontend uses TypeScript and Tailwind CSS. The backend uses SQLite full-text search for destinations and Shapely for nearby scenery. OpenStreetMap supplies the underlying geographic data. An OpenAI API key is optional; local companion messages work without one.

## Prerequisites

- Git and npm.
- Node.js **20.9 or newer**.
- Python **3.10 or newer**; Python 3.12 is used in the macOS instructions below.
- Java **25 or newer**.
- The **`osmium` command-line tool** (`osmium-tool`). The Python package of the same name does not replace this command.
- Internet access for downloads, map tiles, and optional LLM narration.
- Enough free disk space and memory for the map, routing cache, scenery file, and destination index. Statewide processing is substantially heavier than a small city extract; the first import can take a while.

### macOS

With Homebrew installed:

```bash
brew install node python@3.12 openjdk@25 osmium-tool
export PATH="$(brew --prefix openjdk@25)/bin:$PATH"
```

Check the installed tools:

```bash
node --version
npm --version
python3.12 --version
java -version
osmium --version
```

### Linux and Windows

On Linux, install the prerequisites using your distribution's package manager or vendor installers. Use `python3` below if that is your Python 3.10+ executable, and make sure Java 25+ is on `PATH`.

On Windows, use **WSL2** for the complete Bash-based workflow in this guide, including data preparation. Install the prerequisites and clone the project inside WSL. The repository also contains a native PowerShell GraphHopper helper, but its machine-specific defaults must be changed, and the data-building scripts expect a Unix-style Python environment.

## One-time setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/Hezxkiah/Wandr.git
cd Wandr
npm ci
```

Create the backend environment:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cd ..
```

For Linux/WSL, substitute `python3` for `python3.12` if appropriate. Keep the environment at `backend/.venv`: the data-building scripts use that path.

### 2. Download GraphHopper and the Texas map

Run from the repository root:

```bash
mkdir -p backend/.graphhopper

curl -fL https://repo1.maven.org/maven2/com/graphhopper/graphhopper-web/11.1/graphhopper-web-11.1.jar \
  -o backend/.graphhopper/graphhopper-web-11.1.jar

curl -fL https://download.geofabrik.de/north-america/us/texas-latest.osm.pbf \
  -o backend/.graphhopper/texas-source.osm.pbf
```

These downloads are not included in a Git clone. If you already have these files, skip the downloads. Keep `texas-source.osm.pbf` for future data rebuilds.

### 3. Build scenery and searchable destinations

From the repository root, after the downloads finish:

```bash
bash backend/build_scenery.sh backend/.graphhopper/texas-source.osm.pbf
bash backend/build_places.sh backend/.graphhopper/texas-source.osm.pbf
```

Wait for both commands to finish. They generate:

| File | Used for |
| --- | --- |
| `backend/.graphhopper/scenery.geojsonseq` | Scenery scores and nearby named landscape features |
| `backend/.graphhopper/places.json` | Intermediate destination index |
| `backend/.graphhopper/places.sqlite` | Fast destination autocomplete |

**Pass the Texas map path explicitly.** The build scripts still default to a smaller Plano–UTD extract when no argument is supplied.

### 4. Start the three services

Follow the startup commands below. The first GraphHopper launch builds `backend/.graphhopper/texas-cache`. Wait for the import to finish before generating walks. Later launches reuse that cache.

## Start or restart the app

Replace `/path/to/Wandr` below with your own repository path. If a service is already running, press **Ctrl+C in its existing terminal** before starting another copy.

### Terminal 1 — GraphHopper

```bash
cd /path/to/Wandr/backend

java \
  -Ddw.graphhopper.datareader.file=.graphhopper/texas-source.osm.pbf \
  -Ddw.graphhopper.graph.location=.graphhopper/texas-cache \
  -jar .graphhopper/graphhopper-web-11.1.jar \
  server graphhopper.yml
```

On macOS, if `java -version` does not show Java 25+, run this in the same terminal first:

```bash
export PATH="$(brew --prefix openjdk@25)/bin:$PATH"
```

Use the explicit command above for Texas. The existing `start_graphhopper.sh` defaults to the older Plano–UTD map and cache.

### Terminal 2 — Python backend

```bash
cd /path/to/Wandr/backend
source .venv/bin/activate
export WANDR_SCENERY_BOUNDS="-106.646,25.837,-93.508,36.501"
uvicorn main:app --reload --port 8000
```

Wait for **Application startup complete**. Loading statewide scenery can take time. Set the bounds in each new backend terminal; changing an environment variable in another terminal does not affect the running backend.

### Terminal 3 — Website

```bash
cd /path/to/Wandr
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep all three service terminals running.

### Verify readiness

In an additional terminal:

```bash
curl http://localhost:8989/info
curl http://localhost:8000/health
```

`/info` should return GraphHopper map information. `/health` should return `{"status":"ok"}`, but it checks only FastAPI—not GraphHopper or the generated indexes. A visible homepage alone does not mean routing is ready.

**You do not download or rebuild everything on each restart.** Reuse the JAR, map, generated indexes, and routing cache. Rebuild when you change or update the map. Use a new routing cache directory when changing map coverage; a previous cache can keep serving the old region.

## Using Wandr

1. Choose **Use my location**, **Austin**, or **Dallas**. Allow location access when prompted if using GPS.
2. Select your available walking time.
3. Choose **come back here** for a loop, or **end up at** for a destination walk.
4. For a destination walk, type a place name or address and select a suggestion. Click a result, or use the arrow keys and Enter. Each result shows **X minutes away on foot**, based on a GraphHopper route estimate. Only checked destinations within your selected duration appear.
5. Click **go!**, compare the route cards, and choose a route.
6. Click **let's go!** to open the walk screen, then **start walking**.

Changing the starting point or duration clears a selected destination so its eligibility can be checked again. Search needs both the backend and GraphHopper, and it searches a limited candidate set rather than promising every possible matching destination. Starting the walk rechecks routing because estimates and positions can change.

For a demo without physically walking, run `npm run dev`, enable **Development simulator**, and start the walk. You can pause, change the speed, or scrub progress. The black circle marks the simulated walker. Landmark messages refresh along the route and remain visible when paused. The simulator and its landmark-message flow are development features; the simulator is hidden in production builds.

GPS progress tracking is also available. Poor accuracy or being more than 50 m off-route pauses progress. Matching and directions are approximate, particularly at intersections and overlapping paths.

## Optional AI narration

Local messages do not need an API key. To enable OpenAI-generated wording, set the key **in the backend terminal before starting FastAPI**:

```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_NARRATION_MODEL="gpt-4.1-mini"
uvicorn main:app --reload --port 8000
```

Use your own API account; API usage may be billed. Keep the key on the backend and out of Git. The backend reads exported environment variables; it does not automatically load a `.env` file.

`/walk-context` returns immediate local landmark text. Optional `/narration` requests add generated wording using that context. Requests fall back to local text when generation is unavailable. Landmarks come from the loaded map, so missing map features can lead to general walking prompts.

## How the scores and routing work

- GraphHopper uses OpenStreetMap with a pedestrian profile. The default serenity custom model discourages major roads and tunnels.
- Round trips request eight seeded candidates; destination walks request up to five alternatives. Wandr removes duplicates and selects up to three options using time fit, walk quality, and a route-overlap penalty.
- The displayed **overall walk score** combines **65% mapped scenery** with **35% quieter-road coverage**, then converts to a rounded integer out of 10. When one component is unavailable, only the available component contributes. Options are sorted by the unrounded combined score.
- Scenery is sampled approximately every 25 m. Proximity thresholds are 80 m for parks/water, 30 m for trees, and 50 m for viewpoints. The score blends the strongest category with weighted category coverage, then applies a curve that gives partial coverage more credit.
- Quieter roads are estimated from mapped road classes such as footways and residential streets. This is **not live traffic measurement**. Scenery proximity does not guarantee a view or public access.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `next: command not found` | Run `npm ci` in the repository root before `npm run dev`. |
| `GraphHopper is unavailable` | Check Terminal 1 and `curl http://localhost:8989/info`. The map may still be importing or startup may have failed. |
| `Address already in use` / `Failed to bind` | Another service is using the port. Stop the old GraphHopper terminal before launching the Texas version. On macOS/Linux, `lsof -nP -iTCP:8989 -sTCP:LISTEN` identifies the listener. GraphHopper also uses admin port 8990. |
| `Cannot find point 0` / `Point 0 is out of bounds` | Confirm the running GraphHopper uses `texas-source.osm.pbf` **and** `texas-cache`. An older regional process/cache may still be active. If coverage is correct, the GPS point may not be near a routable pedestrian segment. |
| Java JAR or OSM map missing | Complete the downloads and start Java from `backend`, as shown above. |
| `Suggestions unavailable` / no destination results | Finish building `places.sqlite`; check both backend and GraphHopper. Try a longer walk or a more specific query. Places outside the time limit are excluded. |
| Search stays on `Searching places…` | Wait for backend startup, check its terminal, and retry. The frontend reports a timeout after 20 seconds. |
| Scenery unavailable / generic popups | Build scenery from the same Texas map, export the Texas bounds, and restart FastAPI. It loads scenery when it starts. |
| No simulator | Use `npm run dev`; production builds hide it. |
| Location denied or unavailable | Allow browser/OS location permission, use localhost locally, or choose Austin/Dallas for a demo. |

If your old setup only has `places.json`, build the fast search database without extracting the map again:

```bash
cd /path/to/Wandr
backend/.venv/bin/python backend/index_places.py \
  backend/.graphhopper/places.json \
  backend/.graphhopper/places.sqlite
```

## Configuration

Export these in the backend terminal before starting it:

| Variable | Purpose |
| --- | --- |
| `WANDR_SCENERY_BOUNDS` | Scenery coverage as **west,south,east,north**; use the Texas value shown above. The code default is still Plano–UTD. |
| `WANDR_SCENERY_FILE` | Override the generated scenery GeoJSON sequence path. |
| `WANDR_PLACES_FILE` | Override the destination **SQLite** database path. |
| `GRAPHHOPPER_URL` | Routing server; defaults to `http://localhost:8989`. |
| `GRAPHHOPPER_TIMEOUT_SECONDS` | Main route-generation timeout; defaults to 30 seconds. Autocomplete uses shorter per-route checks. |
| `OPENAI_API_KEY` | Optional narration key. |
| `OPENAI_NARRATION_MODEL` | Optional narration model; defaults to `gpt-4.1-mini`. |

The fallback geocoder is bounded to Texas and can be configured through the `GEOCODER_*` variables in `backend/main.py`. The frontend currently calls `http://localhost:8000` directly, and CORS allows local frontend origins. Public hosting or phone access needs API URL, CORS, and HTTPS configuration; these instructions are for local development.

## Development checks

From the repository root:

```bash
npm run lint
npm run build
backend/.venv/bin/python -B -m unittest discover -s backend -p 'test_*.py'
```

For a manual smoke test, generate a loop, compare route options and both map styles, then start and pause a simulated walk. Also search for a destination, confirm its walking time fits the duration, and verify changing the duration refreshes results.

## What belongs in Git

Commit source code, documentation, and tests. Do not commit `node_modules`, Python virtual environments/bytecode, API keys, map downloads, GraphHopper JARs/caches, or generated scenery/destination indexes. The local runtime assets in `backend/.graphhopper/` are ignored, so other contributors must complete the one-time setup after cloning.

Map data © OpenStreetMap contributors, available under the ODbL. Basemap tiles and satellite imagery have their own providers and attribution, displayed on the map. Routing/search data is local after setup; online map tiles and optional external geocoding/narration still require network access.
