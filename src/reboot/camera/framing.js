const REQUIRED_TARGET_KEYS = ['player', 'threat', 'traceTarget', 'routeCue'];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return length === 0
    ? { x: 0, y: 0, z: -1 }
    : { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function collectTargets(targets) {
  return REQUIRED_TARGET_KEYS.map((key) => targets[key]).filter((target) => target != null);
}

export function solveCameraFrame(targets, viewport, modifiers = {}) {
  const authoredPoints = collectTargets(targets);
  const player = targets.player ?? authoredPoints[0] ?? { id: 'camera-origin', x: 0, y: 0, z: 0 };
  const points = authoredPoints.length === 0 ? [player] : authoredPoints;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));
  const touch = viewport.mode === 'touch';
  const chase = modifiers.chase?.strength ?? 0;
  const boss = modifiers.boss?.strength ?? 0;
  const lookLimit = touch ? 4 : 5;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const lookAt = {
    x: clamp(centerX, player.x - lookLimit, player.x + lookLimit),
    y: 1.15 + boss * 0.35,
    z: clamp(centerZ - chase * 0.7, player.z - lookLimit, player.z + lookLimit)
  };
  const spread = Math.max((maxX - minX) * 1.25, (maxZ - minZ) * 0.78);
  const distance = clamp((touch ? 14.7 : 11.4) + spread * 0.85 - chase * 1.4 + boss * 6.5, 12, touch ? 28 : 24);
  const height = clamp((touch ? 9.2 : 8) + spread * 0.1 - chase * 0.5 + boss * 2.9, 7.5, 14);

  return {
    fov: touch ? 52 : 44,
    lookAt,
    position: { x: lookAt.x, y: lookAt.y + height, z: lookAt.z + distance }
  };
}

export function inspectCameraFrame(frame, targets, viewport) {
  const forward = normalize({
    x: frame.lookAt.x - frame.position.x,
    y: frame.lookAt.y - frame.position.y,
    z: frame.lookAt.z - frame.position.z
  });
  const right = normalize({ x: -forward.z, y: 0, z: forward.x });
  const up = normalize({
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x
  });
  const verticalLimit = Math.tan((frame.fov * Math.PI) / 360) * 0.94;
  const horizontalLimit = verticalLimit * (viewport.width / viewport.height) * 0.94;
  const includedIds = collectTargets(targets).filter((target) => {
    const relative = {
      x: target.x - frame.position.x,
      y: target.y + 1 - frame.position.y,
      z: target.z - frame.position.z
    };
    const depth = dot(relative, forward);
    return depth > 0
      && Math.abs(dot(relative, right) / depth) <= horizontalLimit
      && Math.abs(dot(relative, up) / depth) <= verticalLimit;
  }).map((target) => target.id);

  return { allIncluded: includedIds.length === collectTargets(targets).length, includedIds };
}
