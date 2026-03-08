import { useState, useCallback } from 'react';
import MapBackground from './components/globe/MapBackground';
import OperationsPanel from './components/ui/OperationsPanel';
import StatusBar from './components/ui/StatusBar';
import MessageLog from './components/ui/MessageLog';
import AudioToggle from './components/ui/AudioToggle';
import Crosshair from './components/ui/Crosshair';
import SplashScreen from './components/ui/SplashScreen';
import FilmGrain from './components/ui/FilmGrain';
import ReticulumPanel from './components/ui/ReticulumPanel';
import { useIsMobile } from './hooks/useIsMobile';
import { useAudio } from './hooks/useAudio';
import { useReticulum } from './hooks/useReticulum';
import type { ShaderMode } from './shaders/postprocess';
import type { ReticulumNode } from './hooks/useReticulum';

function App() {
  const isMobile = useIsMobile();
  const audio = useAudio();
  const [booted, setBooted] = useState(false);
  const [shaderMode, setShaderMode] = useState<ShaderMode>('crt');
  const [mapTiles, setMapTiles] = useState<'google' | 'osm'>('osm');

  const [layers, setLayers] = useState({
    flights: false,
    earthquakes: true,
    traffic: false,
  });

  const [camera] = useState({
    latitude: -33.8688,
    longitude: 151.2093,
    altitude: 50000,
    heading: 0,
    pitch: -45,
  });

  const {
    nodes: reticulumNodes,
    interfaces: reticulumInterfaces,
    messages: reticulumMessages,
    connected: reticulumConnected,
    sendMessage: reticulumSend,
    sending: reticulumSending,
  } = useReticulum(true);

  const handleLayerToggle = useCallback((layer: 'earthquakes') => {
    setLayers((prev) => {
      const next = !prev[layer as keyof typeof prev];
      audio.play(next ? 'toggleOn' : 'toggleOff');
      return { ...prev, [layer]: next };
    });
  }, [audio]);

  const handleReticulumNodeClick = useCallback((node: ReticulumNode) => {
    audio.play('click');
  }, [audio]);

  const handleResetView = useCallback(() => { audio.play('click'); }, [audio]);
  const handleGoToSteamboat = useCallback(() => { audio.play('click'); }, [audio]);
  const handleLocateMe = useCallback(() => { audio.play('click'); }, [audio]);

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
      <MapBackground
        nodes={reticulumNodes}
        interfaces={reticulumInterfaces}
        connected={reticulumConnected}
        onNodeClick={handleReticulumNodeClick}
      />

      <Crosshair />
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
        geoStatus={'idle'}
        isMobile={isMobile}
        nodes={reticulumNodes}
        interfaces={reticulumInterfaces}
        connected={reticulumConnected}
        onNodeClick={handleReticulumNodeClick}
      />
      {isMobile ? (
        <>
          <MessageLog
            messages={reticulumMessages}
            connected={reticulumConnected}
            isMobile
            onSend={reticulumSend}
            sending={reticulumSending}
          />
          <ReticulumPanel
            nodes={reticulumNodes}
            interfaces={reticulumInterfaces}
            connected={reticulumConnected}
            isMobile
            onNodeClick={handleReticulumNodeClick}
          />
        </>
      ) : (
        <div className="fixed top-4 right-4 bottom-12 w-72 z-40 flex flex-col gap-3 pointer-events-none">
          <MessageLog
            messages={reticulumMessages}
            connected={reticulumConnected}
            isMobile={false}
            onSend={reticulumSend}
            sending={reticulumSending}
            inColumn
          />
          <ReticulumPanel
            nodes={reticulumNodes}
            interfaces={reticulumInterfaces}
            connected={reticulumConnected}
            isMobile={false}
            onNodeClick={handleReticulumNodeClick}
            inColumn
          />
        </div>
      )}
      <StatusBar
        camera={camera}
        shaderMode={shaderMode}
        isMobile={isMobile}
        dataStatus={{
          earthquakes: 0,
          reticulumNodes: reticulumNodes.length,
        }}
      />
      <AudioToggle muted={audio.muted} onToggle={audio.toggleMute} isMobile={isMobile} />
    </div>
  );
}

export default App;
