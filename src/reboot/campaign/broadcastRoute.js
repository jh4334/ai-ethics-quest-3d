import { chapterSixLevel } from '../content/levels/chapter6.js';
import { clampToWalkable, walkableRectsFromLevel } from '../level/walkableBounds.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const WALKABLE = walkableRectsFromLevel(chapterSixLevel);

export const BROADCAST_ZONES = deepFreeze([
  {
    anchorZ: -2, id: 'broadcast-entry', landmarkId: 'entry-signal-gate',
    response: 'reflect', spawnZ: 2, titleKo: '방송국 진입로'
  },
  {
    anchorZ: -22, id: 'protection-relay', landmarkId: 'protection-consent-ledger',
    response: 'trace', spawnZ: -14, titleKo: 'LUMEN·DOT 보호 릴레이'
  },
  {
    anchorZ: -46, id: 'transmission-bridge', landmarkId: 'transmission-dash-relays',
    response: 'dash', spawnZ: -38, titleKo: '중계 연결교'
  },
  {
    anchorZ: -71, id: 'final-core', landmarkId: 'broadcast-signal-core',
    response: 'attack', spawnZ: -62, titleKo: '최종 방송 코어'
  }
]);

export function createBroadcastRouteState() {
  return deepFreeze({ position: { x: 0, y: BROADCAST_ZONES[0].spawnZ }, unlockedPhase: 0 });
}

export function broadcastCheckpointForPhase(phaseIndex) {
  const zone = BROADCAST_ZONES[phaseIndex];
  if (!zone) throw new RangeError(`방송 경로 단계 ${phaseIndex}가 없습니다.`);
  return `chapter-6:${zone.id}`;
}

export function restoreBroadcastRouteState(checkpoint) {
  if (!checkpoint || checkpoint === 'chapter-6:broadcast-room' || checkpoint === 'chapter-6:start') {
    return createBroadcastRouteState();
  }
  const id = /^chapter-6:([a-z0-9-]+)$/.exec(checkpoint)?.[1];
  if (id === 'broadcast-console') {
    return deepFreeze({
      position: { x: 0, y: BROADCAST_ZONES.at(-1).spawnZ },
      unlockedPhase: BROADCAST_ZONES.length - 1
    });
  }
  const phaseIndex = BROADCAST_ZONES.findIndex((zone) => zone.id === id);
  if (phaseIndex < 0) return createBroadcastRouteState();
  return deepFreeze({
    position: { x: 0, y: BROADCAST_ZONES[phaseIndex].spawnZ },
    unlockedPhase: phaseIndex
  });
}

export function broadcastZoneReady(route, phaseIndex) {
  const zone = BROADCAST_ZONES[phaseIndex];
  if (!zone || route.unlockedPhase < phaseIndex) return false;
  return Math.hypot(route.position.x, route.position.y - zone.anchorZ) <= 8;
}

export function stepBroadcastRoute(route, input, unlockedPhase) {
  const horizontal = Number.isFinite(input.horizontal) ? input.horizontal : 0;
  const vertical = Number.isFinite(input.vertical) ? input.vertical : 0;
  const magnitude = Math.hypot(horizontal, vertical);
  const delta = Math.max(0, Math.min(Number.isFinite(input.delta) ? input.delta : 0, 0.25));
  const speed = input.dash ? 9 : 4.8;
  const movement = magnitude > 0
    ? { x: horizontal / magnitude * speed * delta, y: vertical / magnitude * speed * delta }
    : { x: 0, y: 0 };
  const accessible = WALKABLE.slice(0, Math.max(0, Math.min(BROADCAST_ZONES.length - 1, unlockedPhase)) + 1);
  const position = clampToWalkable(
    route.position.x + movement.x,
    route.position.y + movement.y,
    accessible
  );
  return deepFreeze({
    position: { x: position.x, y: position.z },
    unlockedPhase: Math.max(route.unlockedPhase, unlockedPhase)
  });
}
