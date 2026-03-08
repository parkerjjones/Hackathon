# CLAUDE.md — WorldView Project Guide

## Project Overview
hello

WorldView is a real-time tactical intelligence dashboard built on a 3D CesiumJS globe. It overlays live data feeds — flights, satellites, earthquakes, traffic, and CCTV cameras — onto an interactive Earth visualisation with a military/tactical UI aesthetic.

**Tech stack:** React 19 + TypeScript + Vite 7 + CesiumJS (via Resium) + Tailwind CSS v4 + Express 5 backend proxy + WebSocket.

## Repository Structure

```
worldview/
├── server/                  # Express backend proxy (Node.js, plain JS)
│   ├── index.js             # All API routes, WebSocket, caching
│   ├── .env                 # Server-side secrets (OpenSky, Google Maps, NSW)
│   └── data/
│       └── sydneyRoads.js   # Static fallback road data for Sydney CBD
├── src/
│   ├── App.tsx              # Root component — state management, data hooks, layer composition
│   ├── main.tsx             # React entrypoint
│   ├── index.css            # Tailwind v4 + custom tactical theme + Cesium overrides
│   ├── vite-env.d.ts        # Vite type declarations
│   ├── components/
│   │   ├── globe/
│   │   │   ├── GlobeViewer.tsx        # CesiumJS Viewer wrapper (3D tiles, OSM, shaders)
│   │   │   └── EntityClickHandler.tsx # Click-to-track entities, ESC to unlock
│   │   ├── layers/
│   │   │   ├── CCTVLayer.tsx          # CCTV markers (imperative BillboardCollection)
│   │   │   ├── EarthquakeLayer.tsx    # Pulsing seismic markers (Resium entities)
│   │   │   ├── FlightLayer.tsx        # High-perf flight rendering (~27K aircraft)
│   │   │   ├── SatelliteLayer.tsx     # SGP4-propagated satellite orbits
│   │   │   └── TrafficLayer.tsx       # Road network + animated vehicle particles
│   │   └── ui/
│   │       ├── CCTVPanel.tsx          # Camera thumbnail grid + preview
│   │       ├── Crosshair.tsx          # SVG centre crosshair overlay
│   │       ├── IntelFeed.tsx          # Right-side real-time event feed
│   │       ├── OperationsPanel.tsx    # Left-side control panel (layers, shaders, filters)
│   │       ├── SplashScreen.tsx       # Boot-sequence animation
│   │       ├── StatusBar.tsx          # Bottom bar (coords, UTC clock, data counts)
│   │       └── TrackedEntityPanel.tsx # Entity lock-on detail overlay
│   ├── data/
│   │   └── airports.ts     # Airport IATA → coordinate lookup
│   ├── hooks/
│   │   ├── useCameras.ts   # CCTV feed aggregation (TfL, Austin, NSW)
│   │   ├── useEarthquakes.ts # USGS earthquake polling
│   │   ├── useFlights.ts   # Global flights via FR24 proxy
│   │   ├── useFlightsLive.ts # Regional high-freq flights via adsb.fi
│   │   ├── useSatellites.ts  # TLE fetch + SGP4 propagation pipeline
│   │   └── useTraffic.ts     # Road fetch + 60fps vehicle animation
│   ├── shaders/
│   │   └── postprocess.ts  # GLSL post-processing (CRT, NVG, FLIR)
│   └── types/
│       └── camera.ts       # CameraFeed, CameraSource, CameraMeta types
├── public/                  # Static assets
├── .env                     # Client-side env vars (VITE_GOOGLE_API_KEY, VITE_CESIUM_ION_TOKEN, etc.)
├── package.json
├── vite.config.ts           # Vite + React + Cesium + Tailwind plugins, /api proxy
├── tsconfig.json            # Project references (app + node)
├── tsconfig.app.json        # Strict TypeScript for src/
├── tsconfig.node.json       # TypeScript for build config
└── eslint.config.js
```

## Quick Commands

```bash
# Install dependencies
npm install

# Start backend proxy server (port 3001)
npm run dev:server

# Start Vite dev server (port 5173, proxies /api → :3001)
npm run dev

# Start both simultaneously
npm run dev:all

# Production build
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

## Environment Variables

### Client-side (`.env`)
| Variable | Purpose |
|---|---|
| `VITE_GOOGLE_API_KEY` | Google Maps 3D Photorealistic Tiles |
| `VITE_CESIUM_ION_TOKEN` | Cesium Ion terrain/imagery (optional) |
| `WINDY_API_KEY` | Windy webcam API (reserved, not yet active) |
| `NSW_TRANSPORT_API_KEY` | Transport for NSW CCTV API |

### Server-side (`server/.env`)
| Variable | Purpose |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Server-side Google Maps (unused currently) |
| `OPENSKY_CLIENT_ID` | OpenSky Network OAuth2 client |
| `OPENSKY_CLIENT_SECRET` | OpenSky Network OAuth2 secret |

## Architecture Decisions

- **Imperative Cesium rendering** — FlightLayer, CCTVLayer, and TrafficLayer bypass Resium's React bindings and use raw `BillboardCollection` / `PolylineCollection` / `PointPrimitiveCollection` for performance (handles 27K+ entities at 60 fps).
- **Dual flight data sources** — Global coverage from FlightRadar24 (30 s poll), enriched with high-frequency regional data from adsb.fi (5 s poll) for smooth movement when zoomed in. Deduplication by ICAO24 hex.
- **Backend proxy pattern** — All external API calls routed through Express server to hide credentials, enforce rate limits, and cache responses via `node-cache`.
- **Dead-reckoning** — FlightLayer extrapolates aircraft positions between data updates using heading + velocity for smooth 60 fps rendering.
- **SGP4 propagation** — Satellites positioned in real-time using TLE orbital elements and the `satellite.js` library, not pre-computed paths.
- **GLSL post-processing** — CRT scanline, night-vision (NVG), and thermal (FLIR) effects applied as CesiumJS `PostProcessStage` fragment shaders.

## Coding Conventions

- **TypeScript strict mode** — `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` enforced.
- **Functional React** — All components are function components using hooks. No class components.
- **Callback stability** — Heavy use of `useCallback` and `useMemo` to prevent unnecessary re-renders in the Cesium render loop.
- **CallbackProperty pattern** — Cesium entity positions use `CallbackProperty` for smooth tracking without React re-renders.
- **Imperative refs** — Layer components hold `useRef` to Cesium primitive collections and update them imperatively in `useEffect`.
- **Naming** — Files: PascalCase for components, camelCase for hooks/utils. Exports match filename.
- **Styling** — Tailwind CSS v4 utility classes with custom `wv-*` colour tokens. No CSS modules.
- **Server** — Plain Node.js with ESM imports, no TypeScript. Express 5 with `dotenv/config`.

## Data Flow

```
External APIs ──► Express Proxy (cache + auth) ──► React Hooks (poll + transform)
                                                       │
                                               App.tsx (state mgmt)
                                                       │
                              ┌─────────────┬──────────┼──────────┬───────────┐
                         GlobeViewer    Layers (5)    UI Panels   StatusBar
                         (Cesium)     (imperative)   (React DOM)  (React DOM)
```

## External APIs

| API | Endpoint | Rate | Data |
|---|---|---|---|
| FlightRadar24 | `data-cloud.flightradar24.com` | 15 s min interval | Global aircraft positions, routes |
| adsb.fi | `opendata.adsb.fi` | 5 s poll | Regional high-freq aircraft |
| OpenSky Network | `opensky-network.org` (OAuth2) | 10 s (WebSocket) | Aircraft via bounding box |
| USGS | `earthquake.usgs.gov` | 60 s cache | Earthquake GeoJSON (past 24 h) |
| TLE API / CelesTrak | `tle.ivanstanojevic.me` / `celestrak.org` | 2 hr cache | Satellite TLE data |
| Overpass (OSM) | `overpass-api.de` | 24 hr cache | Road network geometries |
| TfL | `api.tfl.gov.uk` | 5 min cache | London CCTV cameras |
| Austin Open Data | `data.austintexas.gov` | 5 min cache | Austin TX traffic cameras |
| Transport for NSW | `api.transport.nsw.gov.au` | 5 min cache | NSW Australia cameras |

## Testing

- No test suite currently exists. When adding tests:
  - Mock all external API calls and Cesium primitives
  - Focus on hook logic (data transformation, polling, error handling)
  - Use Vitest (compatible with Vite)

## Known Considerations

- Google 3D Photorealistic Tiles require a valid API key with Maps JavaScript API enabled; falls back to OSM automatically.
- Cesium Ion token is optional; only needed for Cesium's own terrain/imagery services.
- The backend server must be running for flights, satellites, CCTV, traffic, and earthquake data to load (all proxied through `/api`).
- FlightRadar24 scraping may be rate-limited or blocked; the system degrades gracefully to adsb.fi.
- Overpass API has strict rate limits; the server uses failover servers and falls back to static Sydney road data.
