import { useState } from 'react';
import type { ShaderMode } from '../../shaders/postprocess';
import type { AltitudeBand } from '../layers/FlightLayer';
import type { GeoStatus } from '../../hooks/useGeolocation';
import MobileModal from './MobileModal';

interface OperationsPanelProps {
  shaderMode: ShaderMode;
  onShaderChange: (mode: ShaderMode) => void;
  layers: {
    earthquakes: boolean;
    // other layers are managed elsewhere but not toggled here
  };
  onLayerToggle: (layer: 'earthquakes') => void;
  /** Optional per-layer loading state (e.g. ships takes ~20s on first fetch) */
  layerLoading?: Partial<Record<'earthquakes', boolean>>;
  mapTiles: 'google' | 'osm';
  onMapTilesChange: (tile: 'google' | 'osm') => void;
  showPaths: boolean;
  onShowPathsToggle: () => void;
  altitudeFilter: Record<AltitudeBand, boolean>;
  onAltitudeToggle: (band: AltitudeBand) => void;
  onResetView: () => void;
  onGoToSteamboat: () => void;
  onLocateMe: () => void;
  geoStatus: GeoStatus;
  isMobile: boolean;
}

const SHADER_OPTIONS: { value: ShaderMode; label: string; colour: string }[] = [
  { value: 'none', label: 'STANDARD', colour: 'text-wv-text' },
  { value: 'crt', label: 'CRT', colour: 'text-wv-cyan' },
  { value: 'nvg', label: 'NVG', colour: 'text-wv-green' },
  { value: 'flir', label: 'FLIR', colour: 'text-wv-amber' },
];

const LAYER_OPTIONS: { key: 'earthquakes'; label: string; icon: string }[] = [
  { key: 'earthquakes', label: 'SEISMIC', icon: '🌍' },
];

export default function OperationsPanel({
  shaderMode,
  onShaderChange,
  layers,
  layerLoading = {},
  onLayerToggle,
  mapTiles,
  onMapTilesChange,
  onResetView,
  onGoToSteamboat,
  onLocateMe,
  geoStatus,
  isMobile,
}: OperationsPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Count active layers for the FAB badge
  const activeLayerCount = Object.values(layers).filter(Boolean).length;

  /* ── Shared panel inner content (used by both desktop & mobile) ── */
  const panelContent = (
    <>
      {/* Optics Section */}
      <div className="p-3 border-b border-wv-border">
        <div className="text-[9px] text-wv-muted tracking-widest uppercase mb-2">Optics Mode</div>
        <div className="grid grid-cols-2 gap-1">
          {SHADER_OPTIONS.map(({ value, label, colour }) => (
            <button
              key={value}
              onClick={() => onShaderChange(value)}
              className={`
                px-2 py-1.5 rounded text-[10px] font-bold tracking-wider
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

      {/* Map Tiles Section */}
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
                px-2 py-1.5 rounded text-[10px] font-bold tracking-wider
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

      {/* Data Layers Section */}
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

      {/* Locate Me + Reset View */}
      <div className="p-3 border-t border-wv-border flex flex-col gap-1">
        <button
          onClick={onLocateMe}
          disabled={geoStatus === 'requesting'}
          className={`
            w-full px-3 py-2 rounded text-[10px] font-bold tracking-wider
            transition-all duration-200 flex items-center justify-center gap-2
            ${isMobile ? 'min-h-[48px] text-[12px]' : ''}
            ${geoStatus === 'requesting'
              ? 'text-wv-cyan/50 bg-wv-cyan/5 cursor-wait'
              : geoStatus === 'success'
                ? 'text-wv-green bg-wv-green/10 hover:bg-wv-green/20'
                : 'text-wv-cyan bg-wv-cyan/10 hover:bg-wv-cyan/20'
            }
          `}
        >
          <span>{geoStatus === 'requesting' ? '◌' : '◎'}</span>
          <span>
            {geoStatus === 'requesting'
              ? 'LOCATING…'
              : geoStatus === 'success'
                ? 'RE-LOCATE'
                : 'LOCATE ME'
            }
          </span>
        </button>
        <button
          onClick={onGoToSteamboat}
          className={`w-full px-3 py-2 rounded text-[10px] font-bold tracking-wider
            text-wv-cyan bg-wv-cyan/10 hover:bg-wv-cyan/20
            transition-all duration-200 flex items-center justify-center gap-2
            ${isMobile ? 'min-h-[48px] text-[12px]' : ''}`}
        >
          <span>▣</span>
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

  /* ── Mobile: FAB + full-screen modal ── */
  if (isMobile) {
    return (
      <>
        {/* Floating Action Button */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-40 w-11 h-11 rounded-lg panel-glass
                     flex items-center justify-center
                     text-wv-green hover:bg-white/10 transition-colors
                     select-none active:scale-95"
          aria-label="Open operations panel"
        >
          <span className="text-lg">⚙</span>
          {activeLayerCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-wv-green
                             text-[8px] text-wv-black font-bold flex items-center justify-center">
              {activeLayerCount}
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

  /* ── Desktop: fixed side panel (unchanged) ── */
  return (
    <div className="fixed top-4 left-4 w-56 panel-glass rounded-lg overflow-hidden z-40 select-none max-h-[calc(100vh-2rem)] overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-2 border-b border-wv-border flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-wv-green animate-pulse" />
        <span className="text-[10px] text-wv-muted tracking-widest uppercase">Operations</span>
      </div>
      {panelContent}
    </div>
  );
}
