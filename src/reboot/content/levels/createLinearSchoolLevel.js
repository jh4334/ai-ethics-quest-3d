function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const RANGES = Object.freeze([
  { maxZ: 6, minZ: -10 },
  { maxZ: -10, minZ: -34 },
  { maxZ: -34, minZ: -58 },
  { maxZ: -58, minZ: -84 }
]);

export function createLinearSchoolLevel({ bossExitId, id, segments }) {
  if (!Array.isArray(segments) || segments.length !== RANGES.length) {
    throw new RangeError('확장 학교 경로는 네 구간이어야 합니다.');
  }
  const authored = segments.map((segment, index) => {
    const range = RANGES[index];
    const centerZ = (range.minZ + range.maxZ) / 2;
    const centerX = segment.anchorX ?? 0;
    return {
      ...segment,
      anchor: { x: centerX, y: 0, z: centerZ },
      bounds: {
        maxX: centerX + segment.width, maxZ: range.maxZ,
        minX: centerX - segment.width, minZ: range.minZ
      },
      checkpointId: `checkpoint-${segment.id}`,
      collisionId: `collision-${segment.id}`,
      navigationId: `nav-${segment.id}`
    };
  });
  const result = {
    bossExitId,
    id,
    planeY: 0,
    startSegmentId: authored[0].id,
    segments: authored.map((segment, index) => ({
      anchor: segment.anchor,
      checkpointId: segment.checkpointId,
      collisionId: segment.collisionId,
      exits: [{ kind: index === authored.length - 1 ? 'chapter-exit' : 'segment', to: authored[index + 1]?.id ?? bossExitId }],
      geometryId: segment.geometryId,
      id: segment.id,
      interactionId: segment.interactionId,
      label: segment.label,
      navigationId: segment.navigationId,
      pathId: segment.pathId ?? null,
      phaseBeats: [...(segment.phaseBeats ?? [])],
      sideEffectId: segment.sideEffectId ?? null
    })),
    layers: {
      checkpoint: authored.map((segment) => ({ id: segment.checkpointId, segmentId: segment.id, spawn: { ...segment.anchor } })),
      collision: authored.map((segment) => ({ id: segment.collisionId, segmentId: segment.id, walkableBounds: segment.bounds })),
      encounter: authored.map((segment) => ({ id: `encounter-${segment.id}`, kind: segment.kind, segmentId: segment.id })),
      localLight: authored.map((segment) => ({
        color: segment.color, id: `light-${segment.id}`, position: { x: 0, y: 3, z: segment.anchor.z },
        segmentId: segment.id, visualId: `visual-${segment.id}`
      })),
      navigation: authored.map((segment) => ({ bounds: segment.bounds, id: segment.navigationId, segmentId: segment.id })),
      visual: authored.map((segment) => ({
        geometryId: segment.geometryId,
        id: `visual-${segment.id}`,
        kind: segment.kind,
        segmentId: segment.id
      }))
    }
  };
  return deepFreeze(result);
}
