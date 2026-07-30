import { quantize } from '../combat/geometry.js';

// 통행 가능 경계 — 순수 로직(THREE 무의존, node 테스트 대상).
// 레벨 collision 레이어의 walkableBounds(축 정렬 사각형 목록)를 시뮬 이동 클램프용
// 사각형 목록으로 바꾼다. 시뮬은 매 틱 플레이어(그리고 reposition 중인 적)를
// 이 사각형들의 합집합 안으로 되민다 — 맵 밖 허공 이탈 방지.

// 벽·벽면 가구(사물함·수납장 두께 ≤0.5)만큼 X를 안쪽으로 좁힌다.
// 벽에 붙인 배경 사물과 플레이어가 겹치지 않고, 카메라가 벽을 뚫고 보는 일도 줄인다.
export const WALKABLE_WALL_INSET = 0.6;

// 레벨 → 클램프 사각형 목록. Z는 세그먼트가 맞닿아 있으므로 경로 양 끝에서만 좁힌다.
// (중간 세그먼트의 Z를 좁히면 이웃 세그먼트와의 이음새가 끊겨 통행이 막힌다.)
export function walkableRectsFromLevel(level, { inset = WALKABLE_WALL_INSET } = {}) {
  const entries = level?.layers?.collision ?? [];
  if (entries.length === 0) return Object.freeze([]);
  const routeMinZ = Math.min(...entries.map((entry) => entry.walkableBounds.minZ));
  const routeMaxZ = Math.max(...entries.map((entry) => entry.walkableBounds.maxZ));
  return Object.freeze(entries.map((entry) => {
    const bounds = entry.walkableBounds;
    // 좁은 통로에서도 최소 폭 0.4는 남긴다(과도한 inset으로 사각형이 뒤집히지 않게).
    const safeInset = Math.min(inset, Math.max(0, (bounds.maxX - bounds.minX) / 2 - 0.2));
    return Object.freeze({
      maxX: quantize(bounds.maxX - safeInset),
      maxZ: quantize(bounds.maxZ === routeMaxZ ? bounds.maxZ - inset : bounds.maxZ),
      minX: quantize(bounds.minX + safeInset),
      minZ: quantize(bounds.minZ === routeMinZ ? bounds.minZ + inset : bounds.minZ)
    });
  }));
}

// 점 (x, z)를 사각형 합집합 안으로 되민다. 이미 안이면 그대로.
// 결정성: 사각형을 저작 순서대로 훑고, 거리가 같으면 앞선 사각형을 택한다(strict <).
export function clampToWalkable(x, z, rects) {
  if (!Array.isArray(rects) || rects.length === 0 || !Number.isFinite(x) || !Number.isFinite(z)) {
    return { x, z };
  }
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const rect of rects) {
    const clampedX = Math.min(Math.max(x, rect.minX), rect.maxX);
    const clampedZ = Math.min(Math.max(z, rect.minZ), rect.maxZ);
    const distance = (clampedX - x) * (clampedX - x) + (clampedZ - z) * (clampedZ - z);
    if (distance === 0) return { x, z };
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: clampedX, z: clampedZ };
    }
  }
  return { x: quantize(best.x), z: quantize(best.z) };
}
