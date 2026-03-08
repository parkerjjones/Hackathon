import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  Ion,
  Math as CesiumMath,
  PostProcessStage,
  GoogleMaps,
  OpenStreetMapImageryProvider,
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  createGooglePhotorealistic3DTileset,
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

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
if (GOOGLE_API_KEY) {
  GoogleMaps.defaultApiKey = GOOGLE_API_KEY;
}

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
const CONTEXT_OPTIONS = {
  webgl: {
    alpha: false,
    depth: true,
    stencil: false,
    antialias: true,
    preserveDrawingBuffer: true,
  },
};
const SCENE_BG_COLOR = new Color(0.04, 0.04, 0.04, 1.0);

function applyOSM(viewer: CesiumViewer) {
  if (viewer.isDestroyed()) return;
  const osmProvider = new OpenStreetMapImageryProvider({
    url: 'https://tile.openstreetmap.org/',
  });
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(osmProvider);
}

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

export default function GlobeViewer({ shaderMode, mapTiles, onCameraChange, onViewerReady, onTrackEntity, children }: GlobeViewerProps) {
  const viewerRef = useRef<CesiumViewer | null>(null);
  const [google3dReady, setGoogle3dReady] = useState(false);
  const google3dTilesetRef = useRef<any>(null);
  const google3dLoadingRef = useRef(false);

  const handleViewerReady = useCallback(async (viewer: CesiumViewer) => {
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

    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }

    if (mapTiles === 'google' && GOOGLE_API_KEY) {
      try {
        if (google3dLoadingRef.current) return;
        google3dLoadingRef.current = true;
        viewer.imageryLayers.removeAll();
        if (globe) globe.show = false;
        const tileset = await createGooglePhotorealistic3DTileset();
        if (!viewer.isDestroyed()) {
          viewer.scene.primitives.add(tileset);
          google3dTilesetRef.current = tileset;
          setGoogle3dReady(true);
          console.info('[GLOBE] Google Photorealistic 3D Tiles loaded');
        }
      } catch (err) {
        console.warn('[GLOBE] Google 3D Tiles failed, using OSM:', err);
        if (globe) globe.show = true;
        applyOSM(viewer);
      } finally {
        google3dLoadingRef.current = false;
      }
    } else {
      if (globe) globe.show = true;
      applyOSM(viewer);
    }

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
  }, [mapTiles, onCameraChange, onViewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const globe = viewer.scene.globe;

    if (mapTiles === 'google' && !google3dReady && GOOGLE_API_KEY && !google3dLoadingRef.current) {
      viewer.imageryLayers.removeAll();
      if (globe) globe.show = false;
      (async () => {
        try {
          google3dLoadingRef.current = true;
          const tileset = await createGooglePhotorealistic3DTileset();
          if (!viewer.isDestroyed()) {
            viewer.scene.primitives.add(tileset);
            google3dTilesetRef.current = tileset;
            setGoogle3dReady(true);
            console.info('[GLOBE] Switched to Google 3D Tiles');
          }
        } catch (err) {
          console.warn('[GLOBE] Google 3D tile switch failed, staying on OSM:', err);
          if (globe) globe.show = true;
          applyOSM(viewer);
        } finally {
          google3dLoadingRef.current = false;
        }
      })();
    } else if (mapTiles === 'osm') {
      if (google3dTilesetRef.current) {
        try {
          viewer.scene.primitives.remove(google3dTilesetRef.current);
        } catch {
          // already removed
        }
        google3dTilesetRef.current = null;
      }
      setGoogle3dReady(false);
      google3dLoadingRef.current = false;
      if (globe) globe.show = true;
      applyOSM(viewer);
      console.info('[GLOBE] Switched to OpenStreetMap');
    }
  }, [mapTiles, google3dReady]);

  return (
    <Viewer
      full
      ref={(e) => {
        if (e?.cesiumElement) handleViewerReady(e.cesiumElement);
      }}
      animation={false}
      baseLayerPicker={false}
      baseLayer={false as any}
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
      contextOptions={CONTEXT_OPTIONS}
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
      <ShaderManager shaderMode={shaderMode} />
      <EntityClickHandler onTrackEntity={onTrackEntity} />
      {children}
    </Viewer>
  );
}
