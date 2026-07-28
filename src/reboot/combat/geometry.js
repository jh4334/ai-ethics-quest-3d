const POSITION_SCALE = 1_000_000;

export function quantize(value) {
  return Math.round(value * POSITION_SCALE) / POSITION_SCALE;
}

export function normalizeDirection(x, y, fallback = { x: 1, y: 0 }) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ...fallback };
  const length = Math.hypot(x, y);
  if (length <= 0.000001) return { ...fallback };
  return { x: quantize(x / length), y: quantize(y / length) };
}

export function isContactInArc(origin, facing, position, range, minimumDot) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
  const offsetX = position.x - origin.x;
  const offsetY = position.y - origin.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance > range || distance <= 0.000001) return false;
  const directionX = offsetX / distance;
  const directionY = offsetY / distance;
  return facing.x * directionX + facing.y * directionY >= minimumDot;
}
