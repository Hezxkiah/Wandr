# Wandr 🚶🌳

Take the scenic route! Wandr creates walking routes designed for relaxation and exploring your surroundings, based on your location and available time.


## Local development

Wandr has three local services. Run each in a separate terminal:

| Service | Address | Purpose |
| --- | --- | --- |
| GraphHopper | `http://localhost:8989` | Generates pedestrian routes from OpenStreetMap data. |
| FastAPI backend | `http://localhost:8000` | Adds Wandr's route selection, scoring, and destination lookup. |
| Next.js frontend | `http://localhost:3000` | The browser interface. |

Before starting, install Java 25 or newer and download GraphHopper 11.1 and an OpenStreetMap extract. These external assets are not committed. The local launcher defaults to a Plano–UTD extract; the backend geocoder is bounded to Texas.

The backend requires Python 3.10 or newer.

### GraphHopper

For the Plano–UTD development map, install `osmium-tool` and create an extract from Geofabrik's Texas data:

```bash
mkdir -p backend/.graphhopper
curl -fL https://repo1.maven.org/maven2/com/graphhopper/graphhopper-web/11.1/graphhopper-web-11.1.jar -o backend/.graphhopper/graphhopper-web-11.1.jar
curl -fL https://download.geofabrik.de/north-america/us/texas-latest.osm.pbf -o backend/.graphhopper/texas-source.osm.pbf
osmium extract --bbox=-96.95,32.94,-96.60,33.15 --strategy=complete_ways --output backend/.graphhopper/plano-utd.osm.pbf backend/.graphhopper/texas-source.osm.pbf
```

This bounded map covers Plano and UTD, not the entire Dallas area. The Texas source file can be removed after extraction to reclaim disk space. The launcher uses a separate cache for this extract.

The repository includes a Windows PowerShell helper. Update its `GraphHopperHome`, `JavaExecutable`, and `MapFile` defaults, or provide those values explicitly:

```powershell
.\backend\start_graphhopper.ps1 -MapFile "C:\path\to\utd.osm"
```

macOS/Linux after placing the JAR and map file in `backend/.graphhopper/`:

```bash
./backend/start_graphhopper.sh
```

GraphHopper should be ready when this succeeds:

```bash
curl http://localhost:8989/info
```

### Backend

macOS/Linux:

```bash
cd backend
python3.12 -m venv .venv
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

Verify the backend is running (this endpoint does not check GraphHopper):

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
5. Return home and repeat with **end up at** using a fully qualified destination inside the loaded map area, for example `The University of Texas at Dallas, Richardson, Texas`.

If the route request fails, check the FastAPI terminal first. Common causes are GraphHopper not running, the selected location being outside the downloaded OSM area, or location permission being denied.
