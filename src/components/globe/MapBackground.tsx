import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { ReticulumNode, RNSInterface } from '../../hooks/useReticulum';

interface MapBackgroundProps {
  nodes: ReticulumNode[];
  interfaces: RNSInterface[];
  connected: boolean;
  onNodeClick?: (node: ReticulumNode) => void;
}

const TILE = 256;
const ZOOM = 15;
const tileCache = new Map<string, HTMLImageElement>();

function latLngToTile(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = (lng + 180) / 360 * n;
  const lr = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n;
  return { tx: Math.floor(x), ty: Math.floor(y), px: Math.floor((x - Math.floor(x)) * TILE), py: Math.floor((y - Math.floor(y)) * TILE) };
}

function latLngToPx(lat: number, lng: number, cLat: number, cLng: number, z: number, cx: number, cy: number): [number, number] {
  const n = 2 ** z;
  const toM = (la: number, lo: number) => {
    const x = ((lo + 180) / 360) * n * TILE;
    const lr = (la * Math.PI) / 180;
    return [x, ((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2) * n * TILE];
  };
  const [mx, my] = toM(lat, lng);
  const [cmx, cmy] = toM(cLat, cLng);
  return [cx + (mx - cmx), cy + (my - cmy)];
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement> {
  const key = `${z}/${x}/${y}`;
  const c = tileCache.get(key);
  if (c?.complete && c.naturalWidth) return Promise.resolve(c);
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { tileCache.set(key, img); res(img); };
    img.onerror = () => res(img);
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  });
}

async function buildMap(lat: number, lng: number, w: number, h: number): Promise<HTMLCanvasElement> {
  const { tx, ty, px, py } = latLngToTile(lat, lng, ZOOM);
  const gridR = Math.ceil(Math.max(w, h) / TILE / 2) + 1;
  const gridSize = gridR * 2 + 1;

  const tiles = await Promise.all(
    Array.from({ length: gridSize * gridSize }, (_, i) => {
      const dx = (i % gridSize) - gridR, dy = Math.floor(i / gridSize) - gridR;
      return loadTile(ZOOM, tx + dx, ty + dy).then(img => ({ img, dx: dx + gridR, dy: dy + gridR }));
    }),
  );

  const comp = document.createElement('canvas');
  comp.width = gridSize * TILE; comp.height = gridSize * TILE;
  const cc = comp.getContext('2d')!;
  for (const { img, dx, dy } of tiles) {
    if (img.complete && img.naturalWidth) cc.drawImage(img, dx * TILE, dy * TILE);
  }

  const cPx = gridR * TILE + px, cPy = gridR * TILE + py;
  const left = Math.max(0, cPx - Math.floor(w / 2));
  const top = Math.max(0, cPy - Math.floor(h / 2));

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const oc = out.getContext('2d')!;
  oc.drawImage(comp, left, top, w, h, 0, 0, w, h);

  const id = oc.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const grey = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = 0;
    d[i + 1] = Math.min(255, Math.floor(grey * 0.9));
    d[i + 2] = Math.min(255, Math.floor(grey * 0.45));
  }
  oc.putImageData(id, 0, 0);
  return out;
}

export default function MapBackground({ nodes, interfaces, connected, onNodeClick }: MapBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const frameRef = useRef(0);
  const timeRef = useRef(0);
  const mapRef = useRef<{ canvas: HTMLCanvasElement; lat: number; lng: number } | null>(null);
  const loadingRef = useRef(false);

  const center = useMemo(() => {
    if (nodes.length === 0) return null;
    const lat = nodes.reduce((s, n) => s + n.lat, 0) / nodes.length;
    const lng = nodes.reduce((s, n) => s + n.lng, 0) / nodes.length;
    return { lat, lng };
  }, [nodes]);

  useEffect(() => {
    if (!center || loadingRef.current) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    const cur = mapRef.current;
    if (cur && Math.abs(cur.lat - center.lat) < 0.0003 && Math.abs(cur.lng - center.lng) < 0.0003) return;
    loadingRef.current = true;
    buildMap(center.lat, center.lng, Math.ceil(w), Math.ceil(h)).then(c => {
      mapRef.current = { canvas: c, lat: center.lat, lng: center.lng };
      loadingRef.current = false;
    });
  }, [center]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = sizeRef.current.w, H = sizeRef.current.h;
    if (W === 0 || H === 0) { frameRef.current = requestAnimationFrame(draw); return; }
    const cx = W / 2, cy = H / 2;
    const t = timeRef.current;

    ctx.clearRect(0, 0, W, H);

    const map = mapRef.current;
    if (map) {
      ctx.drawImage(map.canvas, 0, 0, W, H);

      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let sy = 0; sy < H; sy += 3) ctx.fillRect(0, sy, W, 1);

      nodes.forEach((node, i) => {
        const [nx, ny] = latLngToPx(node.lat, node.lng, map.lat, map.lng, ZOOM, cx, cy);
        if (nx < -50 || nx > W + 50 || ny < -50 || ny > H + 50) return;

        const isPi = node.id === 'pi-heltec';
        const color = isPi ? [0, 255, 140] : node.id === 'mac-heltec' ? [0, 200, 255] : [255, 180, 0];
        const cs = `rgb(${color[0]},${color[1]},${color[2]})`;

        const ch = 16;
        ctx.strokeStyle = cs; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(nx - ch, ny); ctx.lineTo(nx - 5, ny);
        ctx.moveTo(nx + 5, ny); ctx.lineTo(nx + ch, ny);
        ctx.moveTo(nx, ny - ch); ctx.lineTo(nx, ny - 5);
        ctx.moveTo(nx, ny + 5); ctx.lineTo(nx, ny + ch);
        ctx.stroke();

        const pr = 8 + 4 * Math.sin(t * 0.8 + i);
        ctx.beginPath(); ctx.arc(nx, ny, pr, 0, Math.PI * 2);
        ctx.strokeStyle = cs; ctx.lineWidth = 1; ctx.stroke();

        const outerR = 20 + 5 * Math.sin(t * 0.4 + i);
        ctx.beginPath(); ctx.arc(nx, ny, outerR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.15)`; ctx.stroke();

        ctx.beginPath(); ctx.arc(nx, ny, 3, 0, Math.PI * 2);
        ctx.fillStyle = cs; ctx.fill();

        ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = cs;
        ctx.fillText(node.name.toUpperCase(), nx, ny - 24);

        const host = node.host === 'raspberry-pi' ? 'RASPBERRY PI 4' : node.host === 'macbook' ? 'MACBOOK' : node.host.toUpperCase();
        ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.5)`;
        ctx.font = '9px monospace';
        ctx.fillText(host, nx, ny + 28);
        ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.35)`;
        ctx.fillText(`${node.lat.toFixed(5)}, ${node.lng.toFixed(5)}`, nx, ny + 40);
      });

      const blen = 24;
      ctx.strokeStyle = 'rgb(0,255,140)'; ctx.lineWidth = 2;
      for (const [ax, ay, dx, dy] of [
        [6, 6, 1, 1], [W - 7, 6, -1, 1],
        [6, H - 7, 1, -1], [W - 7, H - 7, -1, -1],
      ] as [number, number, number, number][]) {
        ctx.beginPath();
        ctx.moveTo(ax + blen * dx, ay); ctx.lineTo(ax, ay); ctx.lineTo(ax, ay + blen * dy);
        ctx.stroke();
      }

      if (nodes.length > 0) {
        const n0 = nodes[0];
        const coord = `${n0.lat.toFixed(5)}  ${n0.lng.toFixed(5)}`;
        ctx.font = '12px monospace'; ctx.textAlign = 'left';
        const cw = ctx.measureText(coord).width + 12;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(4, H - 24, cw, 18);
        ctx.fillStyle = 'rgb(0,255,140)';
        ctx.fillText(coord, 10, H - 10);
      }

      const loraUp = interfaces.some(iface => iface.status === 'Up');
      if (loraUp) {
        const pulse = 0.12 + 0.08 * Math.sin(t * 1.5);
        ctx.strokeStyle = `rgba(0,255,140,${pulse})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0);
        ctx.moveTo(0, H - 1); ctx.lineTo(W, H - 1); ctx.stroke();
      }

      if (interfaces.length > 0) {
        ctx.font = '10px monospace'; ctx.textAlign = 'right';
        interfaces.forEach((iface, i) => {
          const y = H - 24 - i * 14;
          const statusC = iface.status === 'Up' ? 'rgba(57,255,20,0.7)' : 'rgba(255,59,48,0.7)';
          const label = `${iface.name} [${iface.status || '?'}]`;
          const lw = ctx.measureText(label).width + 12;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(W - 6 - lw, y - 10, lw + 2, 14);
          ctx.fillStyle = statusC;
          ctx.fillText(label, W - 8, y);
        });
      }
    } else {
      ctx.fillStyle = 'rgb(0,0,0)'; ctx.fillRect(0, 0, W, H);

      for (let gy = 0; gy < H; gy += 18) {
        const offset = (Math.floor(gy / 18) % 2) ? 9 : 0;
        for (let gx = offset; gx < W; gx += 18) {
          ctx.fillStyle = 'rgb(0,35,20)';
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      ctx.strokeStyle = 'rgba(0,35,20,1)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 60, cy); ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 60, cy);
      ctx.moveTo(cx, cy - 60); ctx.lineTo(cx, cy - 8);
      ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 60);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.stroke();

      for (let i = 0; i < 3; i++) {
        const a = t * 0.5 + i * (Math.PI * 2 / 3);
        const r = 80 + 15 * Math.sin(t * 0.3 + i);
        ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,255,140,0.3)'; ctx.fill();
      }

      const pc = `rgba(0,100,55,${0.3 + 0.2 * Math.sin(t * 1.2)})`;
      ctx.fillStyle = pc; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
      ctx.fillText(connected ? 'ACQUIRING GPS...' : 'RNS OFFLINE', cx, cy + 80);
    }

    timeRef.current += 0.016;
    frameRef.current = requestAnimationFrame(draw);
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
      if (center && !loadingRef.current) {
        loadingRef.current = true;
        buildMap(center.lat, center.lng, Math.ceil(rect.width), Math.ceil(rect.height)).then(c => {
          mapRef.current = { canvas: c, lat: center.lat, lng: center.lng };
          loadingRef.current = false;
        });
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [center]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNodeClick || nodes.length === 0 || !mapRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const m = mapRef.current;
    nodes.forEach(node => {
      const [nx, ny] = latLngToPx(node.lat, node.lng, m.lat, m.lng, ZOOM, rect.width / 2, rect.height / 2);
      if ((mx - nx) ** 2 + (my - ny) ** 2 < 600) onNodeClick(node);
    });
  }, [nodes, onNodeClick]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="absolute inset-0 w-full h-full cursor-crosshair"
      style={{ imageRendering: 'auto' }}
    />
  );
}
