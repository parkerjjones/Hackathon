import { useMemo } from 'react';
import { CallbackPositionProperty, Cartesian3, Color, JulianDate } from 'cesium';
import { Entity, PointGraphics } from 'resium';
import { SKI_PATROL_IDS, type SkiPatrolId } from '../../constants/skiPatrol';

const STEAMBOAT_LAT = 40.4538;
const STEAMBOAT_LON = -106.7709;
const MAX_RADIUS_KM = 1.5;
const DOT_SPEED_MPS = 0.2;
const DOT_ALTITUDE_M = 3600;
const DOT_SIZE_DEFAULT = 8;
const DOT_SIZE_SELECTED = 11;

interface SteamboatDotsLayerProps {
  selectedId?: SkiPatrolId | null;
}

function createSeededRandom(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export default function SteamboatDotsLayer({ selectedId = null }: SteamboatDotsLayerProps) {
  const startTime = useMemo(() => JulianDate.now(), []);

  const dots = useMemo(() => {
    const rand = createSeededRandom(20260307);
    const latRad = (STEAMBOAT_LAT * Math.PI) / 180;
    const metersPerDegLat = 111_320;
    const metersPerDegLon = 111_320 * Math.cos(latRad);

    return SKI_PATROL_IDS.map((patrolId) => {
      const placementAngle = rand() * Math.PI * 2;
      const distanceKm = Math.sqrt(rand()) * MAX_RADIUS_KM;
      const dLat = (distanceKm / 111) * Math.cos(placementAngle);
      const dLon = (distanceKm / (111 * Math.cos(latRad))) * Math.sin(placementAngle);
      const driftHeading = rand() * Math.PI * 2;
      const latRateDegPerSec = (DOT_SPEED_MPS * Math.cos(driftHeading)) / metersPerDegLat;
      const lonRateDegPerSec = (DOT_SPEED_MPS * Math.sin(driftHeading)) / metersPerDegLon;
      const latitude = STEAMBOAT_LAT + dLat;
      const longitude = STEAMBOAT_LON + dLon;

      return {
        id: patrolId,
        name: `Steamboat Patrol ${patrolId}`,
        description: `<b>Patrol ID:</b> ${patrolId}<br/><b>Location:</b> Steamboat Mountain`,
        position: new CallbackPositionProperty((time) => {
          const now = time ?? startTime;
          const seconds = JulianDate.secondsDifference(now, startTime);
          return Cartesian3.fromDegrees(
            longitude + lonRateDegPerSec * seconds,
            latitude + latRateDegPerSec * seconds,
            DOT_ALTITUDE_M
          );
        }, false),
      };
    });
  }, [startTime]);

  return (
    <>
      {dots.map((dot) => (
        <Entity
          key={dot.id}
          id={dot.id}
          position={dot.position}
          name={dot.name}
          description={dot.description}
        >
          <PointGraphics
            pixelSize={dot.id === selectedId ? DOT_SIZE_SELECTED : DOT_SIZE_DEFAULT}
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
