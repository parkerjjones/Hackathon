import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReticulumNode, RNSInterface } from '../../hooks/useReticulum';
import MobileModal from './MobileModal';

interface ReticulumPanelProps {
  nodes: ReticulumNode[];
  interfaces: RNSInterface[];
  connected: boolean;
  isMobile: boolean;
  onNodeClick?: (node: ReticulumNode) => void;
  inColumn?: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; fromIdx: number; toIdx: number;
}

function getNodeScreenPos(idx: number, total: number, cx: number, cy: number, radius: number) {
  if (total === 1) return { x: cx, y: cy };
  const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function NetworkCanvas({
  nodes, interfaces, connected, onNodeClick, fillHeight,
}: {
  nodes: ReticulumNode[]; interfaces: RNSInterface[];
  connected: boolean; onNodeClick?: (node: ReticulumNode) => void; fillHeight?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef(0);
  const timeRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = sizeRef.current.w, H = sizeRef.current.h;
    if (W === 0 || H === 0) { frameRef.current = requestAnimationFrame(draw); return; }
    const cx = W / 2, cy = H / 2;
    const radius = Math.min(W, H) * 0.32;
    const t = timeRef.current;

    ctx.clearRect(0, 0, W, H);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.6);
    grad.addColorStop(0, 'rgba(0,212,255,0.03)');
    grad.addColorStop(0.5, 'rgba(57,255,20,0.01)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (let i = 1; i <= 3; i++) {
      const r = radius * (i / 3) * 1.3;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(57,255,20,${0.04 + Math.sin(t * 0.5 + i) * 0.02})`;
      ctx.lineWidth = 0.5; ctx.stroke();
    }

    const sa = (t * 0.3) % (Math.PI * 2);
    const sg = ctx.createLinearGradient(cx, cy, cx + Math.cos(sa) * radius * 1.5, cy + Math.sin(sa) * radius * 1.5);
    sg.addColorStop(0, 'rgba(57,255,20,0.08)'); sg.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sa) * radius * 1.5, cy + Math.sin(sa) * radius * 1.5);
    ctx.strokeStyle = sg; ctx.lineWidth = 1; ctx.stroke();

    if (nodes.length === 0) {
      ctx.fillStyle = connected ? 'rgba(102,102,102,0.5)' : 'rgba(255,59,48,0.6)';
      ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(connected ? 'SCANNING MESH...' : 'RNS OFFLINE', cx, cy);
      timeRef.current += 0.016; frameRef.current = requestAnimationFrame(draw); return;
    }

    const positions = nodes.map((_, i) => getNodeScreenPos(i, nodes.length, cx, cy, radius));

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i], b = positions[j];
        const pulse = (Math.sin(t * 2 + i + j) + 1) / 2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2 + Math.sin(t + i * 3) * 8, (a.y + b.y) / 2 + Math.cos(t + j * 3) * 8, b.x, b.y);
        ctx.strokeStyle = `rgba(57,255,20,${0.06 + pulse * 0.12})`; ctx.lineWidth = 1; ctx.stroke();
        if (Math.random() < 0.02) particlesRef.current.push({ x: a.x, y: a.y, vx: (b.x - a.x) * 0.02, vy: (b.y - a.y) * 0.02, life: 0, maxLife: 50, fromIdx: i, toIdx: j });
      }
    }

    const alive: Particle[] = [];
    for (const p of particlesRef.current) {
      p.x += p.vx; p.y += p.vy; p.life++;
      if (p.life < p.maxLife) {
        alive.push(p);
        const progress = p.life / p.maxLife;
        const alpha = progress < 0.2 ? progress * 5 : progress > 0.8 ? (1 - progress) * 5 : 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 + Math.sin(progress * Math.PI) * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${alpha * 0.6})`; ctx.fill();
      }
    }
    particlesRef.current = alive;

    nodes.forEach((node, i) => {
      const pos = positions[i];
      const pulse = (Math.sin(t * 2.5 + i * 1.7) + 1) / 2;
      const age = Date.now() / 1000 - (node.lastUpdate || 0);
      const fresh = age < 120;
      const color = node.id === 'pi-heltec' ? { r: 57, g: 255, b: 20 } : node.id === 'mac-heltec' ? { r: 0, g: 212, b: 255 } : { r: 255, g: 149, b: 0 };
      const glowR = 16 + pulse * 8;
      const gg = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
      gg.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${fresh ? 0.3 : 0.1})`); gg.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2); ctx.fillStyle = gg; ctx.fill();
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 4 + pulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${fresh ? 0.9 : 0.3})`; ctx.fill();
      const ch = 10 + pulse * 3;
      ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},0.25)`; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pos.x - ch, pos.y); ctx.lineTo(pos.x + ch, pos.y);
      ctx.moveTo(pos.x, pos.y - ch); ctx.lineTo(pos.x, pos.y + ch); ctx.stroke();
      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},0.8)`; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
      ctx.fillText(node.name.toUpperCase(), pos.x, pos.y - 20);
      const hostStr = node.host === 'raspberry-pi' ? 'RPi4' : node.host === 'macbook' ? 'MacBook' : node.host;
      ctx.fillStyle = 'rgba(102,102,102,0.6)'; ctx.font = '7px monospace';
      ctx.fillText(hostStr.toUpperCase(), pos.x, pos.y + 26);
      ctx.fillStyle = 'rgba(102,102,102,0.4)';
      ctx.fillText(`${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}`, pos.x, pos.y + 36);
    });

    if (interfaces.length > 0) {
      const iy = H - 12;
      interfaces.forEach((iface, i) => {
        ctx.fillStyle = iface.status === 'Up' ? 'rgba(57,255,20,0.6)' : 'rgba(255,59,48,0.6)';
        ctx.font = '8px monospace'; ctx.textAlign = 'left';
        ctx.fillText(`${iface.name}: ${iface.status || '?'}${iface.peers != null ? ` [${iface.peers}P]` : ''}`, 10 + i * (W / interfaces.length), iy);
      });
    }

    timeRef.current += 0.016; frameRef.current = requestAnimationFrame(draw);
  }, [nodes, interfaces, connected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNodeClick || nodes.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const ccx = rect.width / 2, ccy = rect.height / 2;
    const r = Math.min(rect.width, rect.height) * 0.32;
    nodes.forEach((node, i) => {
      const pos = getNodeScreenPos(i, nodes.length, ccx, ccy, r);
      if ((mx - pos.x) ** 2 + (my - pos.y) ** 2 < 400) onNodeClick(node);
    });
  }, [nodes, onNodeClick]);

  return (
    <canvas ref={canvasRef} onClick={handleClick}
      className={fillHeight ? 'w-full h-full cursor-crosshair' : 'w-full cursor-crosshair'}
      style={fillHeight ? { imageRendering: 'auto' } : { height: 200, imageRendering: 'auto' }} />
  );
}

export default function ReticulumPanel({
  nodes,
  interfaces,
  connected,
  isMobile,
  onNodeClick,
  inColumn,
}: ReticulumPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const loraIface = interfaces.find((i) => i.type === 'RNodeInterface');

  const panelContent = (
    <>
      <div className={inColumn ? 'flex-1 min-h-0' : ''}>
        <NetworkCanvas
          nodes={nodes}
          interfaces={interfaces}
          connected={connected}
          onNodeClick={onNodeClick}
          fillHeight={!!inColumn}
        />
      </div>

      <div className="px-3 py-2 border-t border-wv-border">
        <div className="flex items-center justify-between text-[9px]">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-wv-green animate-pulse' : 'bg-wv-red'}`} />
            <span className="text-wv-muted tracking-wider">
              {connected ? 'MESH ACTIVE' : 'OFFLINE'}
            </span>
          </div>
          <span className="text-wv-muted">
            {nodes.length} NODE{nodes.length !== 1 ? 'S' : ''}
          </span>
        </div>

        {loraIface && (
          <div className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-0.5 text-[8px]">
            {loraIface.noiseFloor != null && (
              <div>
                <span className="text-wv-muted">NF </span>
                <span className="text-wv-amber">{loraIface.noiseFloor}dBm</span>
              </div>
            )}
            {loraIface.battery != null && (
              <div>
                <span className="text-wv-muted">BAT </span>
                <span className={loraIface.battery > 20 ? 'text-wv-green' : 'text-wv-red'}>
                  {loraIface.battery}%
                </span>
              </div>
            )}
            {loraIface.airtime && (
              <div>
                <span className="text-wv-muted">AIR </span>
                <span className="text-wv-cyan">{loraIface.airtime}</span>
              </div>
            )}
            {loraIface.tx && (
              <div>
                <span className="text-wv-muted">TX </span>
                <span className="text-wv-text">{loraIface.tx}</span>
              </div>
            )}
            {loraIface.rx && (
              <div>
                <span className="text-wv-muted">RX </span>
                <span className="text-wv-text">{loraIface.rx}</span>
              </div>
            )}
            {loraIface.rate && (
              <div>
                <span className="text-wv-muted">RATE </span>
                <span className="text-wv-text">{loraIface.rate}</span>
              </div>
            )}
          </div>
        )}

        {interfaces.length > 0 && (
          <div className="mt-2 border-t border-wv-border pt-1.5">
            <div className="text-[8px] text-wv-muted tracking-widest mb-1">INTERFACES</div>
            {interfaces.map((iface, i) => (
              <div key={i} className="flex items-center justify-between text-[8px] py-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1 h-1 rounded-full ${iface.status === 'Up' ? 'bg-wv-green' : 'bg-wv-red'}`} />
                  <span className="text-wv-text">{iface.name}</span>
                </div>
                <span className="text-wv-muted">{iface.type.replace('Interface', '')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-16 left-3 z-40 w-11 h-11 rounded-lg panel-glass
                     flex items-center justify-center
                     text-wv-green hover:bg-white/10 transition-colors
                     select-none active:scale-95"
          aria-label="Open Reticulum panel"
        >
          <span className="text-lg">◉</span>
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
          title="Reticulum Mesh"
          icon="◉"
          accent="bg-wv-green"
        >
          {panelContent}
        </MobileModal>
      </>
    );
  }

  return (
    <div className={
      inColumn
        ? 'w-full flex-1 min-h-0 panel-glass rounded-lg overflow-hidden select-none pointer-events-auto flex flex-col'
        : 'fixed bottom-12 right-4 w-72 panel-glass rounded-lg overflow-hidden z-40 select-none'
    }>
      <div className="px-3 py-2 border-b border-wv-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-wv-green animate-pulse' : 'bg-wv-red'}`} />
          <span className="text-[10px] text-wv-muted tracking-widest uppercase">Reticulum Mesh</span>
        </div>
        <span className="text-[9px] text-wv-muted">
          {nodes.length} NODE{nodes.length !== 1 ? 'S' : ''}
        </span>
      </div>
      {panelContent}
    </div>
  );
}
