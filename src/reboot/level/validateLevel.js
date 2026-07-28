const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BOUND_KEYS = ['minX', 'maxX', 'minZ', 'maxZ'];

function issue(code, path, message) {
  return { code, message, path };
}

function hasFiniteAnchor(anchor) {
  return anchor != null && ['x', 'y', 'z'].every((axis) => Number.isFinite(anchor[axis]));
}

function sameBounds(left, right) {
  return left != null && right != null
    && BOUND_KEYS.every((key) => Number.isFinite(left[key]) && left[key] === right[key]);
}

function collectReachable(level, segmentById) {
  const reached = new Set();
  const pending = segmentById.has(level.startSegmentId) ? [level.startSegmentId] : [];
  let bossExitReachable = false;

  while (pending.length > 0) {
    const id = pending.shift();
    if (reached.has(id)) continue;
    reached.add(id);
    const segment = segmentById.get(id);
    for (const exit of segment.exits ?? []) {
      if (exit.to === level.bossExitId) bossExitReachable = true;
      if (segmentById.has(exit.to) && !reached.has(exit.to)) pending.push(exit.to);
    }
  }

  return { bossExitReachable, reached };
}

export function validateLevel(level) {
  const errors = [];
  const segments = Array.isArray(level?.segments) ? level.segments : [];
  const layers = level?.layers ?? {};
  const checkpoints = Array.isArray(layers.checkpoint) ? layers.checkpoint : [];
  const collisions = Array.isArray(layers.collision) ? layers.collision : [];
  const navigation = Array.isArray(layers.navigation) ? layers.navigation : [];
  const visuals = Array.isArray(layers.visual) ? layers.visual : [];
  const lights = Array.isArray(layers.localLight) ? layers.localLight : [];
  const checkpointIds = new Set(checkpoints.map((entry) => entry.id));
  const collisionById = new Map(collisions.map((entry) => [entry.id, entry]));
  const navigationById = new Map(navigation.map((entry) => [entry.id, entry]));
  const visualById = new Map(visuals.map((entry) => [entry.id, entry]));
  const segmentById = new Map();

  segments.forEach((segment, index) => {
    const path = `segments[${index}]`;
    if (!ID_PATTERN.test(segment.id ?? '')) {
      errors.push(issue('INVALID_ID', `${path}.id`, '구간 ID는 소문자 영문·숫자·하이픈만 사용할 수 있습니다.'));
    }
    if (segmentById.has(segment.id)) {
      errors.push(issue('DUPLICATE_ID', `${path}.id`, '구간 ID가 중복됩니다.'));
    } else {
      segmentById.set(segment.id, segment);
    }
    if (!hasFiniteAnchor(segment.anchor)) {
      errors.push(issue('INVALID_ANCHOR', `${path}.anchor`, '구간 앵커 좌표는 모두 유한한 수여야 합니다.'));
    } else if (segment.anchor.y !== level.planeY) {
      errors.push(issue('ANCHOR_OUT_OF_PLANE', `${path}.anchor.y`, '구간 앵커가 게임플레이 평면을 벗어났습니다.'));
    }
    if (!Array.isArray(segment.exits) || segment.exits.length === 0) {
      errors.push(issue('MISSING_EXIT', `${path}.exits`, '모든 구간에는 다음 출구가 필요합니다.'));
    }
    if (!checkpointIds.has(segment.checkpointId)) {
      errors.push(issue('MISSING_CHECKPOINT', `${path}.checkpointId`, '구간 체크포인트를 찾을 수 없습니다.'));
    }

    const collision = collisionById.get(segment.collisionId);
    const nav = navigationById.get(segment.navigationId);
    if (!collision || !nav || collision.segmentId !== segment.id || nav.segmentId !== segment.id
      || !sameBounds(collision.walkableBounds, nav.bounds)) {
      errors.push(issue(
        'COLLISION_NAV_DISAGREEMENT',
        path,
        '충돌 보행 영역과 내비게이션 영역이 일치해야 합니다.'
      ));
    }
  });

  lights.forEach((light, index) => {
    const visual = visualById.get(light.visualId);
    if (!visual || visual.segmentId !== light.segmentId || !segmentById.has(light.segmentId)) {
      errors.push(issue(
        'UNATTACHED_LIGHT',
        `layers.localLight[${index}]`,
        '로컬 조명은 같은 구간의 시각 요소에 부착해야 합니다.'
      ));
    }
  });

  const { bossExitReachable, reached } = collectReachable(level, segmentById);
  segments.forEach((segment, index) => {
    if (!reached.has(segment.id)) {
      errors.push(issue('UNREACHABLE_SEGMENT', `segments[${index}]`, '시작점에서 도달할 수 없는 구간입니다.'));
    }
  });
  if (!bossExitReachable) {
    errors.push(issue('UNREACHABLE_BOSS_EXIT', 'bossExitId', '보스 아레나의 장 종료 출구에 도달할 수 없습니다.'));
  }

  return {
    bossExitReachable,
    errors,
    reachableSegmentIds: segments.filter((segment) => reached.has(segment.id)).map((segment) => segment.id)
  };
}
