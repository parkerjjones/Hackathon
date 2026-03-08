export const SKI_PATROL_IDS = [
  'SP-7Q2M9K',
  'SP-4V8D1T',
  'SP-9L3X6R',
  'SP-2H5N8P',
  'SP-6C1J4W',
  'SP-8B7F3Y',
] as const;

export type SkiPatrolId = (typeof SKI_PATROL_IDS)[number];
