# Wandr 🚶🌳

Take the scenic route! Wandr creates walking routes designed for relaxation and exploring your surroundings, based on your location and available time.


## Local development

Wandr has three local services. Run each in a separate terminal:

| Service | Address | Purpose |
| --- | --- | --- |
| GraphHopper | `http://localhost:8989` | Generates pedestrian routes from OpenStreetMap data. |
| FastAPI backend | `http://localhost:8000` | Adds Wandr's route selection, scoring, and destination lookup. |
| Next.js frontend | `http://localhost:3000` | The browser interface. |

Before starting, install Java and download both a GraphHopper distribution and an `.osm.pbf` extract for the area you want to support. These large external assets are deliberately not committed to this repository. The included GraphHopper configuration is currently set up for a Texas extract.

### GraphHopper

Download the Texas `.osm.pbf` map from [Geofabrik](https://download.geofabrik.de/north-america/us/texas.html), then point GraphHopper to its path.

The repository includes a Windows PowerShell helper. Update its `GraphHopperHome`, `JavaExecutable`, and `MapFile` defaults, or provide those values explicitly:

```powershell
.\backend\start_graphhopper.ps1 -MapFile "C:\path\to\texas-latest.osm.pbf"
```

GraphHopper should be ready when this succeeds:

```bash
curl http://localhost:8989/info
```

### Backend

macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Windows PowerShell:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Verify the backend can reach GraphHopper:

```bash
curl http://localhost:8000/health
```

### Frontend

```bash
npm run dev
```

Open `http://localhost:3000`.

## End-to-end smoke test

1. Open `http://localhost:3000` and allow location access.
2. Choose a duration and test a round-trip walk.
3. Confirm route options render on `/map`, switch between the simple and satellite map styles, and select a route.
4. Continue to `/walk`, start the walk, and confirm the first direction appears.
5. Return home and repeat with **end up at** using a destination within the configured Texas geocoding area.

If the route request fails, check the FastAPI terminal first. Common causes are GraphHopper not running, the selected location being outside the downloaded OSM area, or location permission being denied.
