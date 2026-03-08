import { useMemo, useRef, memo } from 'react';
import { Entity, PointGraphics, LabelGraphics, PolylineGraphics } from 'resium';
import {
  CallbackProperty,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  JulianDate,
  NearFarScalar,
  VerticalOrigin,
  Cartesian2,
  LabelStyle,
} from 'cesium';
import type { ReticulumNode } from '../../hooks/useReticulum';

interface ReticulumLayerProps {
  nodes: ReticulumNode[];
  visible: boolean;
  isTracking?: boolean;
}

const NODE_COLORS: Record<string, Color> = {
  'pi-heltec': Color.fromCssColorString('#39FF14'),
  'mac-heltec': Color.fromCssColorString('#00D4FF'),
};

const DEFAULT_NODE_COLOR = Color.fromCssColorString('#FF9500');

function getNodeColor(id: string): Color {
  return NODE_COLORS[id] || DEFAULT_NODE_COLOR;
}

export default function ReticulumLayer({ nodes, visible, isTracking }: ReticulumLayerProps) {
  if (!visible || nodes.length === 0) return null;

  const connectionPairs: [ReticulumNode, ReticulumNode][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      connectionPairs.push([nodes[i], nodes[j]]);
    }
  }

  return (
    <>
      {connectionPairs.map(([a, b]) => (
        <LoRaLink key={`link-${a.id}-${b.id}`} nodeA={a} nodeB={b} />
      ))}
      {nodes.map((node) => (
        <MemoReticulumEntity key={node.id} node={node} isTracking={!!isTracking} />
      ))}
    </>
  );
}

const LoRaLink = memo(function LoRaLink({
  nodeA,
  nodeB,
}: {
  nodeA: ReticulumNode;
  nodeB: ReticulumNode;
}) {
  const positions = useMemo(
    () => Cartesian3.fromDegreesArrayHeights([
      nodeA.lng, nodeA.lat, 200,
      nodeB.lng, nodeB.lat, 200,
    ]),
    [nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng],
  );

  const material = useMemo(
    () => new ColorMaterialProperty(Color.fromCssColorString('#39FF14').withAlpha(0.2)),
    [],
  );

  return (
    <Entity id={`rns-link-${nodeA.id}-${nodeB.id}`}>
      <PolylineGraphics
        positions={positions}
        width={1.5}
        material={material as any}
        clampToGround={false}
      />
    </Entity>
  );
});

const MemoReticulumEntity = memo(function ReticulumEntity({
  node,
  isTracking,
}: {
  node: ReticulumNode;
  isTracking: boolean;
}) {
  const startTimeRef = useRef(JulianDate.now());
  const nodeColor = getNodeColor(node.id);

  const pixelSize = useMemo(
    () =>
      new CallbackProperty((time) => {
        const now = time ?? JulianDate.now();
        const s = JulianDate.secondsDifference(now, startTimeRef.current);
        const pulse = (Math.sin(s * 2.0) + 1) / 2;
        return 10 + pulse * 5;
      }, false),
    [node.id],
  );

  const outerSize = useMemo(
    () =>
      new CallbackProperty((time) => {
        const now = time ?? JulianDate.now();
        const s = JulianDate.secondsDifference(now, startTimeRef.current);
        const pulse = (Math.sin(s * 1.2) + 1) / 2;
        return 20 + pulse * 10;
      }, false),
    [node.id],
  );

  const outerColor = useMemo(
    () =>
      new CallbackProperty((time) => {
        const now = time ?? JulianDate.now();
        const s = JulianDate.secondsDifference(now, startTimeRef.current);
        const pulse = (Math.sin(s * 1.2) + 1) / 2;
        return nodeColor.withAlpha(0.08 + pulse * 0.15);
      }, false),
    [node.id, nodeColor],
  );

  const position = useMemo(
    () => Cartesian3.fromDegrees(node.lng, node.lat, 200),
    [node.lng, node.lat],
  );

  const age = Date.now() / 1000 - (node.lastUpdate || 0);
  const isFresh = age < 120;
  const hostLabel = node.host === 'raspberry-pi' ? 'RPi4' : node.host === 'macbook' ? 'Mac' : '';
  const coordStr = `${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}`;

  return (
    <>
      <Entity id={`rns-outer-${node.id}`} position={position}>
        <PointGraphics
          pixelSize={outerSize}
          color={outerColor}
          outlineWidth={0}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
        />
      </Entity>

      <Entity
        id={`rns-${node.id}`}
        position={position}
        name={node.name}
        description={`
          <p><b>Node:</b> ${node.name}</p>
          <p><b>Host:</b> ${node.host}</p>
          <p><b>Type:</b> ${node.type === 'rnode' ? 'RNode (Heltec V4)' : 'Remote'}</p>
          <p><b>GPS:</b> ${coordStr}</p>
          <p><b>Status:</b> ${isFresh ? 'ACTIVE' : 'STALE'}</p>
        `}
      >
        <PointGraphics
          pixelSize={pixelSize}
          color={nodeColor}
          outlineColor={Color.BLACK}
          outlineWidth={2}
          scaleByDistance={new NearFarScalar(1e3, 2.0, 1e7, 0.6)}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
        />
        <LabelGraphics
          show={!isTracking}
          text={`${node.name}${hostLabel ? ` [${hostLabel}]` : ''}`}
          font="11px monospace"
          fillColor={nodeColor}
          outlineColor={Color.BLACK}
          outlineWidth={3}
          style={LabelStyle.FILL_AND_OUTLINE}
          verticalOrigin={VerticalOrigin.BOTTOM}
          pixelOffset={new Cartesian2(0, -18)}
          scaleByDistance={new NearFarScalar(1e3, 1, 5e6, 0.3)}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
        />
        <LabelGraphics
          show={!isTracking}
          text={coordStr}
          font="9px monospace"
          fillColor={Color.fromCssColorString('#888888')}
          outlineColor={Color.BLACK}
          outlineWidth={2}
          style={LabelStyle.FILL_AND_OUTLINE}
          verticalOrigin={VerticalOrigin.TOP}
          pixelOffset={new Cartesian2(0, 14)}
          scaleByDistance={new NearFarScalar(1e3, 1, 3e6, 0.2)}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
        />
      </Entity>
    </>
  );
});
