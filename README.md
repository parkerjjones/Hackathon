# Reticulum Ski Patrol Network

Reticulum Ski Patrol Network is a tactical 3D globe app built for the Hackathon project by Patrick and Parker.

The app runs a Cesium-based globe with a ski-patrol themed interface, a live seismic feed, click-to-track entities, and an operational control panel. It also contains optional flight and traffic data pipelines that are currently disabled in the UI by default.

## Current product focus

- Splash boot screen with keyboard or click to enter
- Tactical globe UI with shader modes (`STANDARD`, `CRT`, `NVG`, `FLIR`)
- Seismic layer (USGS) enabled by default
- Intel feed with clickable earthquake locations (camera jump)
- Ski patrol entity markers and lock-on panel
- Geolocation (`Locate Me`) with browser GPS first, IP fallback
- Map tile mode switch (`GOOGLE 3D` or `OSM`)

## Tech stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, CesiumJS (via Resium)
- Backend: Express 5 (serverless-friendly), node-cache, ws
- Deployment target: Vercel (`api/index.js` wraps `server/index.js`)

## Local development

### Requirements

- Node.js 18+ (20+ recommended)
- npm 9+

### Install

```bash
npm install
```

### Environment variables

Create these files locally (do not commit secrets):

- `.env`
- `server/.env`

Client-side (`.env`):

```bash
VITE_GOOGLE_API_KEY=your_google_tiles_key
VITE_CESIUM_ION_TOKEN=your_cesium_ion_token_optional
```

Server-side (`server/.env`):

```bash
OPENSKY_CLIENT_ID=optional
OPENSKY_CLIENT_SECRET=optional
AISSTREAM_API_KEY=optional
```

Notes:

- `VITE_GOOGLE_API_KEY` is needed for Google 3D tiles; OSM still works without it.
- Geolocation fallback uses the backend `/api/geolocation` route.
- Ship and satellite data endpoints exist on the backend but are not currently wired into the UI.

### Run

Use two terminals:

```bash
npm run dev:server
npm run dev
```

Or run both together:

```bash
npm run dev:all
```

App URL: `http://localhost:5173`

## Build and preview

```bash
npm run build
npm run preview
```

## Project structure

```text
api/
  index.js                 # Vercel serverless entry
server/
  index.js                 # Express API routes and integrations
  data/sydneyRoads.js      # Traffic fallback road data
src/
  App.tsx                  # App composition and state
  components/
    globe/                 # Cesium viewer and entity click tracking
    layers/                # Active: earthquakes, flights, traffic, steamboat dots
    ui/                    # Splash, operations panel, intel feed, status UI
  hooks/                   # Data hooks (earthquakes, flights, traffic, geolocation)
  shaders/postprocess.ts   # CRT/NVG/FLIR post processing
```

## API routes in `server/index.js`

Routes used by current frontend behavior:

- `GET /api/geolocation`
- `GET /api/flights` (only if flights layer is enabled in code)
- `GET /api/flights/live` (only if flights layer is enabled in code)
- `GET /api/traffic/roads` (only if traffic layer is enabled in code)

Additional routes currently available but not used by the active UI path:

- `GET /api/earthquakes`
- `GET /api/satellites`
- `GET /api/ships`
- `GET /api/health`
- `WS /ws`

## Deployment (Vercel)

This repo already includes `vercel.json` with:

- Vite build output from `dist`
- Rewrite from `/api/*` to `api/index.js`
- Function settings for the serverless API wrapper

Set your environment variables in Vercel project settings for both build-time (`VITE_*`) and runtime (server vars).

## Security

- `.env` and `server/.env` are gitignored.
- Do not commit API keys or tokens.

## Credits

Built by Patrick and Parker.
