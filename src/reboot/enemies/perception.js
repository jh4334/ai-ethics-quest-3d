function segmentIntersectsBounds(start, end, bounds) {
  let low = 0;
  let high = 1;
  for (const axis of ['x', 'z']) {
    const delta = end[axis] - start[axis];
    const min = bounds[`min${axis.toUpperCase()}`];
    const max = bounds[`max${axis.toUpperCase()}`];
    if (Math.abs(delta) < 1e-9) {
      if (start[axis] < min || start[axis] > max) return false;
      continue;
    }
    const first = (min - start[axis]) / delta;
    const second = (max - start[axis]) / delta;
    low = Math.max(low, Math.min(first, second));
    high = Math.min(high, Math.max(first, second));
    if (low > high) return false;
  }
  return high >= 0 && low <= 1;
}

export function perceiveEnemy(enemy, context) {
  const target = context.player;
  const dx = target.position.x - enemy.position.x;
  const dz = target.position.z - enemy.position.z;
  const distance = Math.hypot(dx, dz);
  const divisor = distance || 1;
  const direction = Object.freeze({ x: dx / divisor, z: dz / divisor });
  const blockers = Array.isArray(context.blockers) ? context.blockers : [];
  const obstructed = blockers.some((bounds) => segmentIntersectsBounds(enemy.position, target.position, bounds));
  const sameZone = target.zoneId === enemy.zoneId;
  const onScreen = context.onScreen !== false;
  const withinAcquire = distance <= enemy.definition.perception.acquireRange;
  const withinLoss = distance <= enemy.definition.perception.lossRange;
  const targetTrackable = sameZone && withinLoss;
  return Object.freeze({
    direction,
    distance,
    onScreen,
    obstructed,
    sameZone,
    targetId: target.id,
    targetTrackable,
    targetVisible: targetTrackable && withinAcquire && !obstructed && onScreen,
    withinAcquire,
    withinLoss
  });
}
