import { useCallback, useEffect, useRef } from 'react';
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  Ion,
  Math as CesiumMath,
  PostProcessStage,
  OpenStreetMapImageryProvider,
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  IonImageryProvider,
} from 'cesium';
import { Viewer, Globe, Scene, Camera, useCesium } from 'resium';
import EntityClickHandler from './EntityClickHandler';
import type { TrackedEntityInfo } from './EntityClickHandler';
import {
  CRT_SHADER,
  NVG_SHADER,
  FLIR_SHADER,
  SHADER_DEFAULTS,
  type ShaderMode,
} from '../../shaders/postprocess';

const CESIUM_ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;
if (CESIUM_ION_TOKEN) {
  Ion.defaultAccessToken = CESIUM_ION_TOKEN;
}

interface GlobeViewerProps {
  shaderMode: ShaderMode;
  mapTiles: 'google' | 'osm';
  onCameraChange?: (lat: number, lon: number, alt: number, heading: number, pitch: number) => void;
  onViewerReady?: (viewer: CesiumViewer) => void;
  onTrackEntity?: (info: TrackedEntityInfo | null) => void;
  children?: React.ReactNode;
}

const DEFAULT_POSITION = Cartesian3.fromDegrees(151.2093, -33.8688, 20_000_000);
const DEFAULT_HEADING = CesiumMath.toRadians(0);
const DEFAULT_PITCH = CesiumMath.toRadians(-90);
const SCENE_BG_COLOR = new Color(0.04, 0.04, 0.04, 1.0);

function ShaderManager({ shaderMode }: { shaderMode: ShaderMode }) {
  const { viewer } = useCesium();
  const shaderStageRef = useRef<PostProcessStage | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (shaderStageRef.current) {
      try { viewer.scene.postProcessStages.remove(shaderStageRef.current); } catch { /* ok */ }
      shaderStageRef.current = null;
    }
    if (shaderMode === 'none') return;
    let fragmentShader: string;
    let uniforms: Record<string, unknown>;
    switch (shaderMode) {
      case 'crt': fragmentShader = CRT_SHADER; uniforms = { ...SHADER_DEFAULTS.crt }; break;
      case 'nvg': fragmentShader = NVG_SHADER; uniforms = { ...SHADER_DEFAULTS.nvg }; break;
      case 'flir': fragmentShader = FLIR_SHADER; uniforms = { ...SHADER_DEFAULTS.flir }; break;
      default: return;
    }
    const stage = new PostProcessStage({ fragmentShader, uniforms });
    viewer.scene.postProcessStages.add(stage);
    shaderStageRef.current = stage;
    return () => {
      if (shaderStageRef.current && viewer && !viewer.isDestroyed()) {
        try { viewer.scene.postProcessStages.remove(shaderStageRef.current); } catch { /* ok */ }
        shaderStageRef.current = null;
      }
    };
  }, [shaderMode, viewer]);
  return null;
}

function TerrainManager() {
  const { viewer } = useCesium();
  const loaded = useRef(false);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || loaded.current || !CESIUM_ION_TOKEN) return;
    loaded.current = true;

    CesiumTerrainProvider.fromIonAssetId(1, {
      requestVertexNormals: true,
      requestWaterMask: true,
    }).then((terrain) => {
      if (!viewer.isDestroyed()) {
        viewer.terrainProvider = terrain;
        console.info('[GLOBE] Cesium World Terrain loaded');
      }
    }).catch((err) => {
      console.warn('[GLOBE] World Terrain failed, using ellipsoid:', err);
      if (!viewer.isDestroyed()) {
        viewer.terrainProvider = new EllipsoidTerrainProvider();
      }
    });
  }, [viewer]);

  return null;
}

function ImageryManager({ mapTiles }: { mapTiles: 'google' | 'osm' }) {
  const { viewer } = useCesium();
  const prevTiles = useRef(mapTiles);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    if (mapTiles === 'osm') {
      viewer.imageryLayers.removeAll();
      const osm = new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' });
      viewer.imageryLayers.addImageryProvider(osm);
      console.info('[GLOBE] Switched to OpenStreetMap');
    } else if (prevTiles.current === 'osm') {
      viewer.imageryLayers.removeAll();
      IonImageryProvider.fromAssetId(2).then((bing) => {
        if (!viewer.isDestroyed()) {
          viewer.imageryLayers.addImageryProvider(bing);
          console.info('[GLOBE] Switched to Bing Maps Aerial via Ion');
        }
      }).catch((err) => {
        console.warn('[GLOBE] Bing Maps failed, falling back to OSM:', err);
        if (!viewer.isDestroyed()) {
          const osm = new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' });
          viewer.imageryLayers.addImageryProvider(osm);
        }
      });
    }

    prevTiles.current = mapTiles;
  }, [mapTiles, viewer]);

  return null;
}

export default function GlobeViewer({ shaderMode, mapTiles, onCameraChange, onViewerReady, onTrackEntity, children }: GlobeViewerProps) {
  const viewerRef = useRef<CesiumViewer | null>(null);

  const handleViewerReady = useCallback((viewer: CesiumViewer) => {
    if (viewerRef.current === viewer) return;
    viewerRef.current = viewer;

    const globe = viewer.scene.globe;
    if (globe) {
      globe.baseColor = Color.fromCssColorString('#0a0a14');
      globe.depthTestAgainstTerrain = true;
      globe.showGroundAtmosphere = true;
      globe.enableLighting = false;
      globe.show = true;
    }

    viewer.scene.skyAtmosphere.show = true;

    viewer.camera.flyTo({
      destination: DEFAULT_POSITION,
      orientation: { heading: DEFAULT_HEADING, pitch: DEFAULT_PITCH, roll: 0 },
      duration: 3,
    });

    viewer.camera.changed.addEventListener(() => {
      if (!onCameraChange || viewer.isDestroyed()) return;
      const carto = viewer.camera.positionCartographic;
      onCameraChange(
        CesiumMath.toDegrees(carto.latitude),
        CesiumMath.toDegrees(carto.longitude),
        carto.height,
        CesiumMath.toDegrees(viewer.camera.heading),
        CesiumMath.toDegrees(viewer.camera.pitch),
      );
    });
    viewer.camera.percentageChanged = 0.01;
    onViewerReady?.(viewer);
  }, [onCameraChange, onViewerReady]);

  return (
    <Viewer
      full
      ref={(e) => {
        if (e?.cesiumElement) handleViewerReady(e.cesiumElement);
      }}
      animation={false}
      baseLayerPicker={false}
      shouldAnimate={true}
      fullscreenButton={false}
      geocoder={false}
      homeButton={false}
      infoBox={false}
      navigationHelpButton={false}
      sceneModePicker={false}
      selectionIndicator={false}
      timeline={false}
      orderIndependentTranslucency={false}
    >
      <Scene backgroundColor={SCENE_BG_COLOR} />
      <Globe
        enableLighting={false}
        depthTestAgainstTerrain={true}
        baseColor={Color.fromCssColorString('#0a0a14')}
        showGroundAtmosphere={true}
      />
      <Camera />
      <TerrainManager />
      <ImageryManager mapTiles={mapTiles} />
      <ShaderManager shaderMode={shaderMode} />
      <EntityClickHandler onTrackEntity={onTrackEntity} />
      {children}
    </Viewer>
  );
}
