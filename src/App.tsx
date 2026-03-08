import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Viewer as CesiumViewer, Cartesian3, ConstantProperty, Math as CesiumMath } from 'cesium';
import GlobeViewer from './components/globe/GlobeViewer';
import EarthquakeLayer from './components/layers/EarthquakeLayer';
import FlightLayer from './components/layers/FlightLayer';
import TrafficLayer from './components/layers/TrafficLayer';
import SteamboatDotsLayer from './components/layers/SteamboatDotsLayer';
import type { AltitudeBand } from './components/layers/FlightLayer';
import OperationsPanel from './components/ui/OperationsPanel';
import StatusBar from './components/ui/StatusBar';
import IntelFeed from './components/ui/IntelFeed';
import AudioToggle from './components/ui/AudioToggle';
import Crosshair from './components/ui/Crosshair';
import TrackedEntityPanel from './components/ui/TrackedEntityPanel';
import SkiPatrolMenu from './components/ui/SkiPatrolMenu';
import SplashScreen from './components/ui/SplashScreen';
import FilmGrain from './components/ui/FilmGrain';
import { useEarthquakes } from './hooks/useEarthquakes';
import { useFlights } from './hooks/useFlights';
import { useFlightsLive } from './hooks/useFlightsLive';
import { useTraffic } from './hooks/useTraffic';
import { useGeolocation } from './hooks/useGeolocation';
import { useIsMobile } from './hooks/useIsMobile';
import { useAudio } from './hooks/useAudio';
import type { ShaderMode } from './shaders/postprocess';
import type { IntelFeedItem, IntelFeedLocation } from './components/ui/IntelFeed';
import type { TrackedEntityInfo } from './components/globe/EntityClickHandler';
import { SKI_PATROL_IDS, type SkiPatrolId } from './constants/skiPatrol';

const DEFAULT_ALTITUDE_FILTER: Record<AltitudeBand, boolean> = {
  cruise: false,
  high: true,
  mid: true,
  low: true,
  ground: true,
};

function App() {
  // Responsive breakpoint
  const isMobile = useIsMobile();

  // Audio engine
  const audio = useAudio();

  // Viewer ref for reset-view functionality
  const viewerRef = useRef<CesiumViewer | null>(null);

  // Boot sequence
  const [booted, setBooted] = useState(false);

  // State: shader mode
  const [shaderMode, setShaderMode] = useState<ShaderMode>('crt');

  // State: map tiles (google 3D vs OSM for testing)
  const [mapTiles, setMapTiles] = useState<'google' | 'osm'>('google');

  // State: data layer visibility
  const [layers, setLayers] = useState({
    flights: false,        // not shown in UI
    earthquakes: true,
    traffic: false,        
  });

  // State: flight sub-toggles
  const [showPaths, setShowPaths] = useState(false);
  const [altitudeFilter, setAltitudeFilter] = useState<Record<AltitudeBand, boolean>>(DEFAULT_ALTITUDE_FILTER);

  // State: camera position
  const [camera, setCamera] = useState({
    latitude: -33.8688,
    longitude: 151.2093,
    altitude: 50000,
    heading: 0,
    pitch: -45,
  });

  // State: tracked entity (lock view)
  const [trackedEntity, setTrackedEntity] = useState<TrackedEntityInfo | null>(null);
  const [selectedSkiPatrolId, setSelectedSkiPatrolId] = useState<SkiPatrolId | null>(null);

  const handleTrackEntity = useCallback((info: TrackedEntityInfo | null) => {
    setTrackedEntity(info);
    if (
      info?.entityType === 'steamboat'
      && info.id
      && SKI_PATROL_IDS.includes(info.id as SkiPatrolId)
    ) {
      setSelectedSkiPatrolId(info.id as SkiPatrolId);
    } else {
      setSelectedSkiPatrolId(null);
    }
  }, []);

  const handleViewerReady = useCallback((viewer: CesiumViewer) => {
    viewerRef.current = viewer;
  }, []);

  const handleResetView = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.trackedEntity = undefined;
    setTrackedEntity(null);
    setSelectedSkiPatrolId(null);
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(151.2093, -33.8688, 20_000_000),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
      duration: 2,
    });
  }, []);

  const handleGoToSteamboat = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.trackedEntity = undefined;
    setTrackedEntity(null);
    setSelectedSkiPatrolId(null);
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(-106.8317, 40.4844, 120_000),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-60),
        roll: 0,
      },
      duration: 2.5,
    });
  }, []);

  // Data hooks
  const { earthquakes, feedItems: eqFeedItems } = useEarthquakes(layers.earthquakes);
  const { flights: flightsGlobal, feedItems: fltFeedItems } = useFlights(layers.flights);
  const { flightsLive } = useFlightsLive(
    layers.flights,
    camera.latitude,
    camera.longitude,
    camera.altitude,
    !!trackedEntity,
  );
  const { roads: trafficRoads, vehicles: trafficVehicles } = useTraffic(
    layers.traffic,
    camera.latitude,
    camera.longitude,
    camera.altitude,
  );
  // ships hook removed; layer not visible

  // Geolocation hook — browser GPS (consent) + IP fallback
  const { location: geoLocation, status: geoStatus, locate: geoLocate } = useGeolocation();

  // Fly to user's location when geolocation succeeds
  useEffect(() => {
    if (!geoLocation || geoStatus !== 'success') return;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Choose altitude based on precision: GPS → street level, IP → city level
    const flyAltitude = geoLocation.source === 'gps' ? 5_000 : 200_000;

    viewer.trackedEntity = undefined;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        geoLocation.longitude,
        geoLocation.latitude,
        flyAltitude,
      ),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
      duration: 2.5,
    });
  }, [geoLocation, geoStatus]);

  // Smart layer swap: live (adsb.fi 5s) replaces global (FR24 30s) for matching aircraft.
  // Global aircraft outside the live region remain visible. Zero duplicates guaranteed.
  const flights = useMemo(() => {
    if (flightsLive.length === 0) return flightsGlobal;
    if (flightsGlobal.length === 0) return flightsLive;

    // Set of icao24s in the live feed — these are EXCLUDED from global to prevent duplicates
    const liveIcaos = new Set(flightsLive.map((f) => f.icao24));

    // Global flights NOT covered by live feed (outside the adsb.fi 250nm region)
    const globalOnly = flightsGlobal.filter((f) => !liveIcaos.has(f.icao24));

    // Enrich live flights with FR24 route info where the live data is missing it
    const routeMap = new Map<string, { originAirport: string; destAirport: string; airline: string }>();
    for (const f of flightsGlobal) {
      if (f.originAirport || f.destAirport) {
        routeMap.set(f.icao24, {
          originAirport: f.originAirport,
          destAirport: f.destAirport,
          airline: f.airline,
        });
      }
    }
    const enrichedLive = flightsLive.map((f) => {
      const route = routeMap.get(f.icao24);
      if (route) {
        return {
          ...f,
          originAirport: f.originAirport || route.originAirport,
          destAirport: f.destAirport || route.destAirport,
          airline: f.airline || route.airline,
        };
      }
      return f;
    });

    return [...globalOnly, ...enrichedLive];
  }, [flightsGlobal, flightsLive]);

  // Combine intel feed items
  const allFeedItems: IntelFeedItem[] = [...fltFeedItems, ...eqFeedItems];

  const handleIntelFeedLocationClick = useCallback((location: IntelFeedLocation) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    audio.play('click');
    viewer.trackedEntity = undefined;
    setTrackedEntity(null);
    setSelectedSkiPatrolId(null);
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(location.longitude, location.latitude, 1_500_000),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
      duration: 2,
    });
  }, [audio]);

  // Handlers
  const handleCameraChange = useCallback(
    (lat: number, lon: number, alt: number, heading: number, pitch: number) => {
      setCamera({ latitude: lat, longitude: lon, altitude: alt, heading, pitch });
    },
    []
  );

  const handleLayerToggle = useCallback((layer: 'earthquakes') => {
    setLayers((prev) => {
      const next = !prev[layer as keyof typeof prev];
      audio.play(next ? 'toggleOn' : 'toggleOff');
      return { ...prev, [layer]: next };
    });
  }, [audio]);

  const handleAltitudeToggle = useCallback((band: AltitudeBand) => {
    audio.play('click');
    setAltitudeFilter((prev) => ({ ...prev, [band]: !prev[band] }));
  }, [audio]);

  const handleLocateMe = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.trackedEntity = undefined;
    setTrackedEntity(null);
    setSelectedSkiPatrolId(null);
    geoLocate();
  }, [geoLocate]);

  const handleSelectSkiPatrol = useCallback((id: SkiPatrolId) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const entity = viewer.entities.getById(id);
    if (!entity) return;

    entity.viewFrom = new ConstantProperty(new Cartesian3(0, -3_500, 5_000));
    viewer.trackedEntity = entity;
    const description = typeof entity.description?.getValue(viewer.clock.currentTime) === 'string'
      ? entity.description.getValue(viewer.clock.currentTime)
      : '';

    setTrackedEntity({
      id,
      name: entity.name || `Steamboat Patrol ${id}`,
      entityType: 'steamboat',
      description,
    });
    setSelectedSkiPatrolId(id);
  }, []);

  const stableAltitudeFilter = useMemo(() => altitudeFilter, [altitudeFilter]);

  // Boot complete callback — starts ambient drone
  const handleBootComplete = useCallback(() => {
    audio.play('bootComplete');
    audio.startAmbient();
    setBooted(true);
  }, [audio]);

  // Splash screen
  if (!booted) {
    return <SplashScreen onComplete={handleBootComplete} audio={audio} />;
  }

  return (
    <div className="w-screen h-screen bg-wv-black overflow-hidden scanline-overlay">
      {/* Animated film grain texture */}
      <FilmGrain opacity={0.06} />
      {/* 3D Globe (fills entire viewport) */}
      <GlobeViewer
        shaderMode={shaderMode}
        mapTiles={mapTiles}
        onCameraChange={handleCameraChange}
        onTrackEntity={handleTrackEntity}
        onViewerReady={handleViewerReady}
      >
        <EarthquakeLayer earthquakes={earthquakes} visible={layers.earthquakes} isTracking={!!trackedEntity} />
        <FlightLayer
          flights={flights}
          visible={layers.flights}
          showPaths={showPaths}
          altitudeFilter={stableAltitudeFilter}
          isTracking={!!trackedEntity}
        />
        <TrafficLayer
          roads={trafficRoads}
          vehicles={trafficVehicles}
          visible={layers.traffic}
          showRoads={true}
          showVehicles={true}
          congestionMode={false}
        />
        <SteamboatDotsLayer selectedId={selectedSkiPatrolId} />
      </GlobeViewer>

      {/* Tactical UI Overlay */}
      <Crosshair />
      <TrackedEntityPanel trackedEntity={trackedEntity} isMobile={isMobile} />
      <SkiPatrolMenu
        visible={trackedEntity?.entityType === 'steamboat'}
        selectedId={selectedSkiPatrolId}
        onSelect={(id) => {
          audio.play('click');
          handleSelectSkiPatrol(id);
        }}
        isMobile={isMobile}
      />
      <OperationsPanel
        shaderMode={shaderMode}
        onShaderChange={(mode) => { audio.play('shaderSwitch'); setShaderMode(mode); }}
        layers={layers}
        layerLoading={{}}
        onLayerToggle={handleLayerToggle}
        mapTiles={mapTiles}
        onMapTilesChange={(t) => { audio.play('click'); setMapTiles(t); }}
        showPaths={showPaths}
        onShowPathsToggle={() => { audio.play('click'); setShowPaths((p) => !p); }}
        altitudeFilter={altitudeFilter}
        onAltitudeToggle={handleAltitudeToggle}
        onResetView={() => { audio.play('click'); handleResetView(); }}
        onGoToSteamboat={() => { audio.play('click'); handleGoToSteamboat(); }}
        onLocateMe={() => { audio.play('click'); handleLocateMe(); }}
        geoStatus={geoStatus}
        isMobile={isMobile}
      />
      <IntelFeed
        items={allFeedItems}
        isMobile={isMobile}
        onLocationClick={handleIntelFeedLocationClick}
      />
      <StatusBar
        camera={camera}
        shaderMode={shaderMode}
        isMobile={isMobile}
        dataStatus={{
          earthquakes: earthquakes.length,
        }}
      />
      <AudioToggle muted={audio.muted} onToggle={audio.toggleMute} isMobile={isMobile} />
    </div>
  );
}

export default App;
