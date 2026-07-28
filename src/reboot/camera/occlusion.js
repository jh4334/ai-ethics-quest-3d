function intersectsAxis(origin, direction, minimum, maximum, interval) {
  if (Math.abs(direction) < 1e-9) {
    return origin >= minimum && origin <= maximum ? interval : null;
  }
  const first = (minimum - origin) / direction;
  const second = (maximum - origin) / direction;
  const near = Math.min(first, second);
  const far = Math.max(first, second);
  const next = { maximum: Math.min(interval.maximum, far), minimum: Math.max(interval.minimum, near) };
  return next.minimum <= next.maximum ? next : null;
}

function segmentIntersectsBounds(start, end, bounds) {
  const direction = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z };
  let interval = { maximum: 1, minimum: 0 };
  interval = intersectsAxis(start.x, direction.x, bounds.minX, bounds.maxX, interval);
  if (interval == null) return false;
  interval = intersectsAxis(start.y, direction.y, bounds.minY, bounds.maxY, interval);
  if (interval == null) return false;
  interval = intersectsAxis(start.z, direction.z, bounds.minZ, bounds.maxZ, interval);
  return interval != null;
}

export function decideOccluderFades({ cameraPosition, occluders, playerPosition }) {
  return occluders.map((occluder) => {
    const fade = segmentIntersectsBounds(cameraPosition, playerPosition, occluder.bounds);
    return { fade, id: occluder.id, opacity: fade ? 0.2 : 1 };
  });
}
