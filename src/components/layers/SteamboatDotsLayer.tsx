import { useMemo } from 'react';
import { Cartesian3, Color } from 'cesium';
import { Entity, PointGraphics } from 'resium';

const STEAMBOAT_LAT = 40.4538;
const STEAMBOAT_LON = -106.7709;
const DOT_COUNT = 6;
const MAX_RADIUS_KM = 12;

function createSeededRandom(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export default function SteamboatDotsLayer() {
  const dots = useMemo(() => {
    const rand = createSeededRandom(20260307);
    const latRad = (STEAMBOAT_LAT * Math.PI) / 100;

    return Array.from({ length: DOT_COUNT }, (_, idx) => {
      const angle = rand() * Math.PI * 2;
      const distanceKm = Math.sqrt(rand()) * MAX_RADIUS_KM;
      const dLat = (distanceKm / 111) * Math.cos(angle);
      const dLon = (distanceKm / (111 * Math.cos(latRad))) * Math.sin(angle);

      return {
        id: `steamboat-dot-${idx + 1}`,
        latitude: STEAMBOAT_LAT + dLat,
        longitude: STEAMBOAT_LON + dLon,
      };
    });
  }, []);

  return (
    <>
      {dots.map((dot) => (
        <Entity
          key={dot.id}
          id={dot.id}
          position={Cartesian3.fromDegrees(dot.longitude, dot.latitude, 0)}
          name="Steamboat Marker"
        >
          <PointGraphics
            pixelSize={8}
            color={Color.RED}
            outlineColor={Color.BLACK}
            outlineWidth={1}
            disableDepthTestDistance={Number.POSITIVE_INFINITY}
          />
        </Entity>
      ))}
    </>
  );
}
