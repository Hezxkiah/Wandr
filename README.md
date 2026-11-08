# Wandr 🚶🌳

Take the scenic route! Wandr creates walking routes designed for relaxation and exploring your surroundings, based on your location and available time.


## Setup

Run the following in three separate terminals.

### GraphHopper
Download the Texas `.osm.pbf` map from [Geofabrik](https://download.geofabrik.de/north-america/us/texas.html), then point your backend to its path.

```
.\backend\start_graphhopper.ps1 -MapFile "C:\path\to\texas-latest.osm.pbf"
```

### Backend

```
cd backend
.\.venv\Scripts\Activate.ps1
python main.py
```

### Frontend

```
npm run dev
```

Open `http://localhost:3000`.
