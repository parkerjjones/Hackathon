import { Cartesian2, Cartesian3, Color, LabelStyle, VerticalOrigin } from 'cesium';
import { Entity, LabelGraphics, PointGraphics } from 'resium';
import { SKI_PATROL_IDS, type SkiPatrolId } from '../../constants/skiPatrol';

const PATROL_ALTITUDE_M = 3060;
const DOT_SIZE_DEFAULT = 8;
const DOT_SIZE_SELECTED = 11;
const CITY_LABEL_LAT = 40.4840;
const CITY_LABEL_LON = -106.8317;
const CITY_LABEL_ALTITUDE_M = 2200;

interface SteamboatDotsLayerProps {
  selectedId?: SkiPatrolId | null;
}

interface PatrolAnchor {
  id: SkiPatrolId;
  latitude: number;
  longitude: number;
  trailName?: string;
  confidence: 'high' | 'medium';
}

// Anchored to OpenStreetMap downhill trail geometry at Steamboat.
const PATROL_ANCHORS: PatrolAnchor[] = [
  { id: 'SP-7Q2M9K', latitude: 40.4581553, longitude: -106.7898958, trailName: 'Sitz', confidence: 'high' },
  { id: 'SP-4V8D1T', latitude: 40.4624974, longitude: -106.7798186, trailName: 'Vagabond', confidence: 'high' },
  { id: 'SP-9L3X6R', latitude: 40.4597347, longitude: -106.7743927, trailName: 'Why Not', confidence: 'high' },
  { id: 'SP-2H5N8P', latitude: 40.4541793, longitude: -106.7811546, trailName: 'Heavenly Daze', confidence: 'medium' },
  { id: 'SP-6C1J4W', latitude: 40.4647602, longitude: -106.7840693, trailName: 'BC Ski Way', confidence: 'medium' },
  { id: 'SP-8B7F3Y', latitude: 40.4533845, longitude: -106.7733049, trailName: 'Spur Run', confidence: 'medium' },
];

export default function SteamboatDotsLayer({ selectedId = null }: SteamboatDotsLayerProps) {
  const dots = SKI_PATROL_IDS.map((patrolId) => {
    const anchor = PATROL_ANCHORS.find((a) => a.id === patrolId);
    const latitude = anchor?.latitude ?? CITY_LABEL_LAT;
    const longitude = anchor?.longitude ?? CITY_LABEL_LON;
    const trailText = anchor?.trailName ? `<b>Trail:</b> ${anchor.trailName}` : '<b>Trail:</b> Unconfirmed';
    return {
      id: patrolId,
      name: `Steamboat Patrol ${patrolId}`,
      description: `<b>Patrol ID:</b> ${patrolId}<br/>${trailText}<br/><b>Location:</b> Steamboat Ski Resort`,
      trailName: anchor?.trailName,
      showTrailLabel: !!anchor?.trailName,
      position: Cartesian3.fromDegrees(longitude, latitude, PATROL_ALTITUDE_M),
    };
  });

  return (
    <>
      <Entity
        id="steamboat-city-label"
        position={Cartesian3.fromDegrees(CITY_LABEL_LON, CITY_LABEL_LAT, CITY_LABEL_ALTITUDE_M)}
        name="Steamboat Springs"
        description="<b>Location:</b> Steamboat Springs"
      >
        <LabelGraphics
          text="Steamboat Springs"
          font="24px sans-serif"
          fillColor={Color.WHITE}
          outlineColor={Color.BLACK}
          outlineWidth={2}
          style={LabelStyle.FILL_AND_OUTLINE}
          verticalOrigin={VerticalOrigin.BOTTOM}
          pixelOffset={new Cartesian2(0, -8)}
          disableDepthTestDistance={Number.POSITIVE_INFINITY}
        />
      </Entity>

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
          {dot.showTrailLabel && (
            <LabelGraphics
              text={dot.trailName}
              font="14px sans-serif"
              fillColor={Color.WHITE}
              outlineColor={Color.BLACK}
              outlineWidth={2}
              style={LabelStyle.FILL_AND_OUTLINE}
              verticalOrigin={VerticalOrigin.BOTTOM}
              pixelOffset={new Cartesian2(0, -14)}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
            />
          )}
        </Entity>
      ))}
    </>
  );
}
