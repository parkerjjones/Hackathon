import { useState } from 'react';
import type { ShaderMode } from '../../shaders/postprocess';
import type { GeoStatus } from '../../hooks/useGeolocation';
import type { ReticulumNode, RNSInterface } from '../../hooks/useReticulum';
import MobileModal from './MobileModal';

interface OperationsPanelProps {
  shaderMode: ShaderMode;
  onShaderChange: (mode: ShaderMode) => void;
  layers: {
    earthquakes: boolean;
  };
  onLayerToggle: (layer: 'earthquakes') => void;
  layerLoading?: Partial<Record<'earthquakes', boolean>>;
  mapTiles: 'google' | 'osm';
  onMapTilesChange: (tile: 'google' | 'osm') => void;
  onResetView: () => void;
  onGoToSteamboat: () => void;
  onLocateMe: () => void;
  geoStatus: GeoStatus;
  isMobile: boolean;
  nodes: ReticulumNode[];
  interfaces: RNSInterface[];
  connected: boolean;
  onNodeClick?: (node: ReticulumNode) => void;
}

const SHADER_OPTIONS: { value: ShaderMode; label: string; colour: string }[] = [
  { value: 'none', label: 'STANDARD', colour: 'text-wv-text' },
  { value: 'crt', label: 'CRT', colour: 'text-wv-cyan' },
  { value: 'nvg', label: 'NVG', colour: 'text-wv-green' },
  { value: 'flir', label: 'FLIR', colour: 'text-wv-amber' },
];

const LAYER_OPTIONS: { key: 'earthquakes'; label: string; icon: string }[] = [
  { key: 'earthquakes', label: 'SEISMIC', icon: 'E' },
];

function NodeStatusCard({ node, onClick }: { node: ReticulumNode; onClick?: () => void }) {
  const age = Date.now() / 1000 - (node.lastUpdate || 0);
  const fresh = age < 120;
  const color = node.id === 'pi-heltec'
    ? 'text-wv-green'
    : node.id === 'mac-heltec'
      ? 'text-wv-cyan'
      : 'text-wv-amber';
  const dotColor = fresh ? 'bg-wv-green' : 'bg-wv-red';
  const hostLabel = node.host === 'raspberry-pi' ? 'Raspberry Pi 4' : node.host === 'macbook' ? 'MacBook' : node.host;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-2 rounded hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor} ${fresh ? 'animate-pulse' : ''}`} />
        <span className={`text-[10px] font-bold tracking-wider ${color}`}>{node.name.toUpperCase()}</span>
        <span className="ml-auto text-[8px] text-wv-muted">{fresh ? 'ACTIVE' : 'STALE'}</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px] pl-4">
        <div>
          <span className="text-wv-muted">HOST </span>
          <span className="text-wv-text">{hostLabel}</span>
        </div>
        <div>
          <span className="text-wv-muted">TYPE </span>
          <span className="text-wv-text">{node.type === 'rnode' ? 'RNode V4' : 'Remote'}</span>
        </div>
        <div>
          <span className="text-wv-muted">LAT </span>
          <span className="text-wv-cyan">{node.lat.toFixed(5)}</span>
        </div>
        <div>
          <span className="text-wv-muted">LNG </span>
          <span className="text-wv-cyan">{node.lng.toFixed(5)}</span>
        </div>
        {node.lastUpdate > 0 && (
          <div className="col-span-2">
            <span className="text-wv-muted">AGE </span>
            <span className="text-wv-text">
              {age < 60 ? `${Math.floor(age)}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function InterfaceCard({ iface }: { iface: RNSInterface }) {
  const isUp = iface.status === 'Up';
  return (
    <div className="px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-wv-green' : 'bg-wv-red'}`} />
        <span className="text-[9px] text-wv-text font-bold tracking-wider">{iface.name}</span>
        <span className="ml-auto text-[8px] text-wv-muted">{iface.type.replace('Interface', '')}</span>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-0.5 text-[8px] pl-4">
        <div>
          <span className="text-wv-muted">STATUS </span>
          <span className={isUp ? 'text-wv-green' : 'text-wv-red'}>{iface.status || '?'}</span>
        </div>
        {iface.noiseFloor != null && (
          <div>
            <span className="text-wv-muted">NF </span>
            <span className="text-wv-amber">{iface.noiseFloor}dBm</span>
          </div>
        )}
        {iface.battery != null && (
          <div>
            <span className="text-wv-muted">BAT </span>
            <span className={iface.battery > 20 ? 'text-wv-green' : 'text-wv-red'}>{iface.battery}%</span>
          </div>
        )}
        {iface.airtime && (
          <div>
            <span className="text-wv-muted">AIR </span>
            <span className="text-wv-cyan">{iface.airtime}</span>
          </div>
        )}
        {iface.rate && (
          <div>
            <span className="text-wv-muted">RATE </span>
            <span className="text-wv-text">{iface.rate}</span>
          </div>
        )}
        {iface.tx && (
          <div>
            <span className="text-wv-muted">TX </span>
            <span className="text-wv-text">{iface.tx}</span>
          </div>
        )}
        {iface.rx && (
          <div>
            <span className="text-wv-muted">RX </span>
            <span className="text-wv-text">{iface.rx}</span>
          </div>
        )}
        {iface.peers != null && (
          <div>
            <span className="text-wv-muted">PEERS </span>
            <span className="text-wv-text">{iface.peers}</span>
          </div>
        )}
        {iface.cpuTemp != null && (
          <div>
            <span className="text-wv-muted">TEMP </span>
            <span className="text-wv-text">{iface.cpuTemp}C</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OperationsPanel({
  shaderMode,
  onShaderChange,
  layers,
  onLayerToggle,
  layerLoading = {},
  mapTiles,
  onMapTilesChange,
  onResetView,
  onGoToSteamboat,
  onLocateMe,
  geoStatus,
  isMobile,
  nodes,
  interfaces,
  connected,
  onNodeClick,
}: OperationsPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const panelContent = (
    <>
      {/* Mesh Status Header */}
      <div className="p-3 border-b border-wv-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-wv-green animate-pulse' : 'bg-wv-red'}`} />
            <span className="text-[9px] text-wv-muted tracking-widest uppercase">
              {connected ? 'mesh active' : 'mesh offline'}
            </span>
          </div>
          <span className="text-[9px] text-wv-green font-bold">
            {nodes.length} NODE{nodes.length !== 1 ? 'S' : ''}
          </span>
        </div>
      </div>

      {/* Node List */}
      <div className="border-b border-wv-border">
        <div className="px-3 pt-2 pb-1">
          <div className="text-[9px] text-wv-muted tracking-widest uppercase">Nodes</div>
        </div>
        {nodes.length === 0 ? (
          <div className="px-3 pb-2 text-[9px] text-wv-muted/50">No nodes discovered</div>
        ) : (
          <div className="flex flex-col">
            {nodes.map((node) => (
              <NodeStatusCard
                key={node.id}
                node={node}
                onClick={onNodeClick ? () => onNodeClick(node) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Interfaces */}
      {interfaces.length > 0 && (
        <div className="border-b border-wv-border">
          <div className="px-3 pt-2 pb-1">
            <div className="text-[9px] text-wv-muted tracking-widest uppercase">Interfaces</div>
          </div>
          <div className="flex flex-col">
            {interfaces.map((iface, i) => (
              <InterfaceCard key={i} iface={iface} />
            ))}
          </div>
        </div>
      )}

      {/* Optics */}
      <div className="p-3 border-b border-wv-border">
        <div className="text-[9px] text-wv-muted tracking-widest uppercase mb-2">Optics Mode</div>
        <div className="grid grid-cols-4 gap-1">
          {SHADER_OPTIONS.map(({ value, label, colour }) => (
            <button
              key={value}
              onClick={() => onShaderChange(value)}
              className={`
                px-1 py-1.5 rounded text-[9px] font-bold tracking-wider text-center
                transition-all duration-200
                ${isMobile ? 'min-h-[44px]' : ''}
                ${shaderMode === value
                  ? `${colour} bg-white/10 ring-1 ring-white/20`
                  : 'text-wv-muted hover:text-wv-text hover:bg-white/5'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Tiles */}
      <div className="p-3 border-b border-wv-border">
        <div className="text-[9px] text-wv-muted tracking-widest uppercase mb-2">Map Tiles</div>
        <div className="grid grid-cols-2 gap-1">
          {([
            { value: 'google' as const, label: 'GOOGLE 3D', colour: 'text-wv-cyan' },
            { value: 'osm' as const, label: 'OSM', colour: 'text-wv-green' },
          ]).map(({ value, label, colour }) => (
            <button
              key={value}
              onClick={() => onMapTilesChange(value)}
              className={`
                px-2 py-1.5 rounded text-[10px] font-bold tracking-wider text-center
                transition-all duration-200
                ${isMobile ? 'min-h-[44px]' : ''}
                ${mapTiles === value
                  ? `${colour} bg-white/10 ring-1 ring-white/20`
                  : 'text-wv-muted hover:text-wv-text hover:bg-white/5'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Layers */}
      <div className="p-3 border-b border-wv-border">
        <div className="text-[9px] text-wv-muted tracking-widest uppercase mb-2">Data Layers</div>
        <div className="flex flex-col gap-1">
          {LAYER_OPTIONS.map(({ key, label, icon }) => {
            const isOn = layers[key];
            const isLoading = !!layerLoading[key];
            return (
              <button
                key={key}
                onClick={() => onLayerToggle(key)}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded text-[10px]
                  transition-all duration-200 text-left
                  ${isMobile ? 'min-h-[44px] text-[12px]' : ''}
                  ${isOn
                    ? isLoading ? 'text-wv-amber bg-wv-amber/10' : 'text-wv-green bg-wv-green/10'
                    : 'text-wv-muted hover:text-wv-text hover:bg-white/5'
                  }
                `}
              >
                <span className="text-sm">{icon}</span>
                <span className="tracking-wider">{label}</span>
                {isOn && isLoading ? (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="text-[8px] text-wv-amber tracking-wider animate-pulse">LOADING</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-wv-amber animate-pulse" />
                  </span>
                ) : (
                  <span className={`ml-auto w-1.5 h-1.5 rounded-full transition-colors duration-300 ${isOn ? 'bg-wv-green' : 'bg-wv-muted/30'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 flex flex-col gap-1">
        <button
          onClick={onGoToSteamboat}
          className={`w-full px-3 py-2 rounded text-[10px] font-bold tracking-wider
            text-wv-cyan bg-wv-cyan/10 hover:bg-wv-cyan/20
            transition-all duration-200 flex items-center justify-center gap-2
            ${isMobile ? 'min-h-[48px] text-[12px]' : ''}`}
        >
          <span>S</span>
          <span>STEAMBOAT</span>
        </button>
        <button
          onClick={onResetView}
          className={`w-full px-3 py-2 rounded text-[10px] font-bold tracking-wider
            text-wv-amber bg-wv-amber/10 hover:bg-wv-amber/20
            transition-all duration-200 flex items-center justify-center gap-2
            ${isMobile ? 'min-h-[48px] text-[12px]' : ''}`}
        >
          <span>⟲</span>
          <span>RESET VIEW</span>
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-40 w-11 h-11 rounded-lg panel-glass
                     flex items-center justify-center
                     text-wv-green hover:bg-white/10 transition-colors
                     select-none active:scale-95"
          aria-label="Open operations panel"
        >
          <span className="text-lg">⚙</span>
          {nodes.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-wv-green
                             text-[8px] text-wv-black font-bold flex items-center justify-center">
              {nodes.length}
            </span>
          )}
        </button>
        <MobileModal
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          title="Operations"
          icon="⚙"
          accent="bg-wv-green"
        >
          {panelContent}
        </MobileModal>
      </>
    );
  }

  return (
    <div className="fixed top-4 bottom-12 left-4 w-60 panel-glass rounded-lg overflow-hidden z-40 select-none flex flex-col">
      <div className="px-3 py-2 border-b border-wv-border flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full bg-wv-green animate-pulse" />
        <span className="text-[10px] text-wv-muted tracking-widest uppercase">Operations</span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-between">
        {panelContent}
      </div>
    </div>
  );
}
