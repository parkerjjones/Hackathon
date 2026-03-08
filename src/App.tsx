import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Viewer as CesiumViewer, Cartesian3, ConstantProperty, Math as CesiumMath } from 'cesium';
import GlobeViewer from './components/globe/GlobeViewer';
import EarthquakeLayer from './components/layers/EarthquakeLayer';
import FlightLayer from './components/layers/FlightLayer';
import TrafficLayer from './components/layers/TrafficLayer';
import SteamboatDotsLayer from './components/layers/SteamboatDotsLayer';
import ReticulumLayer from './components/layers/ReticulumLayer';
import type { AltitudeBand } from './components/layers/FlightLayer';
import OperationsPanel from './components/ui/OperationsPanel';
import StatusBar from './components/ui/StatusBar';
import MessageLog from './components/ui/MessageLog';
import AudioToggle from './components/ui/AudioToggle';
import Crosshair from './components/ui/Crosshair';
import TrackedEntityPanel from './components/ui/TrackedEntityPanel';
import SkiPatrolMenu from './components/ui/SkiPatrolMenu';
import SplashScreen from './components/ui/SplashScreen';
import FilmGrain from './components/ui/FilmGrain';
import ReticulumPanel from './components/ui/ReticulumPanel';
import { useEarthquakes } from './hooks/useEarthquakes';
import { useFlights } from './hooks/useFlights';
import { useFlightsLive } from './hooks/useFlightsLive';
import { useTraffic } from './hooks/useTraffic';
import { useGeolocation } from './hooks/useGeolocation';
import { useIsMobile } from './hooks/useIsMobile';
import { useAudio } from './hooks/useAudio';
import { useReticulum } from './hooks/useReticulum';
import type { ShaderMode } from './shaders/postprocess';
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
  const isMobile = useIsMobile();
  const audio = useAudio();
  const viewerRef = useRef<CesiumViewer | null>(null);

  const [booted, setBooted] = useState(false);
  const [shaderMode, setShaderMode] = useState<ShaderMode>('crt');
  const [mapTiles, setMapTiles] = useState<'google' | 'osm'>('google');

  const [layers, setLayers] = useState({
    flights: false,
    earthquakes: true,
    traffic: false,
  });

  const [showPaths] = useState(false);
  const [altitudeFilter] = useState<Record<AltitudeBand, boolean>>(DEFAULT_ALTITUDE_FILTER);

  const [camera, setCamera] = useState({
    latitude: -33.8688,
    longitude: 151.2093,
    altitude: 50000,
    heading: 0,
    pitch: -45,
  });

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
  const { earthquakes } = useEarthquakes(layers.earthquakes);
  const { flights: flightsGlobal } = useFlights(layers.flights);
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

  // Reticulum mesh network — always on
  const {
    nodes: reticulumNodes,
    interfaces: reticulumInterfaces,
    messages: reticulumMessages,
    connected: reticulumConnected,
    sendMessage: reticulumSend,
    sending: reticulumSending,
  } = useReticulum(true);

  const { location: geoLocation, status: geoStatus, locate: geoLocate } = useGeolocation();

  useEffect(() => {
    if (!geoLocation || geoStatus !== 'success') return;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const flyAltitude = geoLocation.source === 'gps' ? 5_000 : 200_000;
    viewer.trackedEntity = undefined;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(geoLocation.longitude, geoLocation.latitude, flyAltitude),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
      duration: 2.5,
    });
  }, [geoLocation, geoStatus]);

  const flights = useMemo(() => {
    if (flightsLive.length === 0) return flightsGlobal;
    if (flightsGlobal.length === 0) return flightsLive;
    const liveIcaos = new Set(flightsLive.map((f) => f.icao24));
    const globalOnly = flightsGlobal.filter((f) => !liveIcaos.has(f.icao24));
    const routeMap = new Map<string, { originAirport: string; destAirport: string; airline: string }>();
    for (const f of flightsGlobal) {
      if (f.originAirport || f.destAirport) {
        routeMap.set(f.icao24, { originAirport: f.originAirport, destAirport: f.destAirport, airline: f.airline });
      }
    }
    const enrichedLive = flightsLive.map((f) => {
      const route = routeMap.get(f.icao24);
      if (route) {
        return { ...f, originAirport: f.originAirport || route.originAirport, destAirport: f.destAirport || route.destAirport, airline: f.airline || route.airline };
      }
      return f;
    });
    return [...globalOnly, ...enrichedLive];
  }, [flightsGlobal, flightsLive]);

  const handleCameraChange = useCallback(
    (lat: number, lon: number, alt: number, heading: number, pitch: number) => {
      setCamera({ latitude: lat, longitude: lon, altitude: alt, heading, pitch });
    },
    [],
  );

  const handleLayerToggle = useCallback((layer: 'earthquakes') => {
    setLayers((prev) => {
      const next = !prev[layer as keyof typeof prev];
      audio.play(next ? 'toggleOn' : 'toggleOff');
      return { ...prev, [layer]: next };
    });
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
    setTrackedEntity({ id, name: entity.name || `Steamboat Patrol ${id}`, entityType: 'steamboat', description });
    setSelectedSkiPatrolId(id);
  }, []);

  const handleReticulumNodeClick = useCallback((node: { lat: number; lng: number; name: string }) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    audio.play('click');
    viewer.trackedEntity = undefined;
    setTrackedEntity(null);
    setSelectedSkiPatrolId(null);
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(node.lng, node.lat, 5_000),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-60),
        roll: 0,
      },
      duration: 2,
    });
  }, [audio]);

  const stableAltitudeFilter = useMemo(() => altitudeFilter, [altitudeFilter]);

  const handleBootComplete = useCallback(() => {
    audio.play('bootComplete');
    audio.startAmbient();
    setBooted(true);
  }, [audio]);

  if (!booted) {
    return <SplashScreen onComplete={handleBootComplete} />;
  }

  return (
    <div className="w-screen h-screen bg-wv-black overflow-hidden scanline-overlay">
      <FilmGrain opacity={0.06} />
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
        <ReticulumLayer
          nodes={reticulumNodes}
          visible={true}
          isTracking={!!trackedEntity}
        />
      </GlobeViewer>

      <Crosshair />
      <TrackedEntityPanel trackedEntity={trackedEntity} isMobile={isMobile} />
      <SkiPatrolMenu
        visible={trackedEntity?.entityType === 'steamboat'}
        selectedId={selectedSkiPatrolId}
        onSelect={(id) => { audio.play('click'); handleSelectSkiPatrol(id); }}
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
        onResetView={() => { audio.play('click'); handleResetView(); }}
        onGoToSteamboat={() => { audio.play('click'); handleGoToSteamboat(); }}
        onLocateMe={() => { audio.play('click'); handleLocateMe(); }}
        geoStatus={geoStatus}
        isMobile={isMobile}
        nodes={reticulumNodes}
        interfaces={reticulumInterfaces}
        connected={reticulumConnected}
        onNodeClick={handleReticulumNodeClick}
      />
      <MessageLog
        messages={reticulumMessages}
        connected={reticulumConnected}
        isMobile={isMobile}
        onSend={reticulumSend}
        sending={reticulumSending}
      />
      <StatusBar
        camera={camera}
        shaderMode={shaderMode}
        isMobile={isMobile}
        dataStatus={{
          earthquakes: earthquakes.length,
          reticulumNodes: reticulumNodes.length,
        }}
      />
      <ReticulumPanel
        nodes={reticulumNodes}
        interfaces={reticulumInterfaces}
        connected={reticulumConnected}
        isMobile={isMobile}
        onNodeClick={handleReticulumNodeClick}
      />
      <AudioToggle muted={audio.muted} onToggle={audio.toggleMute} isMobile={isMobile} />
    </div>
  );
}

export default App;
