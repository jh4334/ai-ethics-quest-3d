import { inspectCameraFrame, solveCameraFrame } from './framing.js';

export const CAMERA_LIMITS = Object.freeze({
  maxDelta: 0.5,
  maxShake: 0.35,
  shakeDecay: 1.4,
  smoothingRate: 5.5
});

function rounded(value) {
  return Math.round(value * 1e9) / 1e9;
}

function smoothVector(current, desired, alpha) {
  return {
    x: rounded(current.x + (desired.x - current.x) * alpha),
    y: rounded(current.y + (desired.y - current.y) * alpha),
    z: rounded(current.z + (desired.z - current.z) * alpha)
  };
}

function tickModifiers(modifiers, delta) {
  return Object.fromEntries(Object.entries(modifiers).flatMap(([kind, modifier]) => {
    const remaining = rounded(Math.max(0, modifier.remaining - delta));
    return remaining === 0 ? [] : [[kind, { ...modifier, remaining }]];
  }));
}

export function createCameraController(targets, viewport) {
  const frame = solveCameraFrame(targets, viewport);
  return {
    basePosition: frame.position,
    fov: frame.fov,
    lookAt: frame.lookAt,
    modifiers: {},
    position: frame.position,
    shake: { amount: 0, phase: 0 }
  };
}

export function addCameraModifier(state, kind, options) {
  if (kind !== 'chase' && kind !== 'boss') {
    throw new RangeError(`지원하지 않는 카메라 보정: ${kind}`);
  }
  const duration = Math.max(0, options.duration);
  const strength = Math.max(0, Math.min(1, options.strength));
  return {
    ...state,
    modifiers: {
      ...state.modifiers,
      [kind]: { remaining: duration, strength }
    }
  };
}

export function addCameraShake(state, amount) {
  return {
    ...state,
    shake: {
      ...state.shake,
      amount: Math.min(CAMERA_LIMITS.maxShake, Math.max(state.shake.amount, amount))
    }
  };
}

export function updateCameraController(state, targets, elapsedSeconds, viewport) {
  const delta = Math.max(0, Math.min(CAMERA_LIMITS.maxDelta, elapsedSeconds));
  const modifiers = tickModifiers(state.modifiers, delta);
  const desired = solveCameraFrame(targets, viewport, modifiers);
  const alpha = 1 - Math.exp(-CAMERA_LIMITS.smoothingRate * delta);
  const basePosition = smoothVector(state.basePosition, desired.position, alpha);
  const lookAt = smoothVector(state.lookAt, desired.lookAt, alpha);
  const amount = rounded(Math.max(0, state.shake.amount - CAMERA_LIMITS.shakeDecay * delta));
  const phase = rounded(state.shake.phase + delta * 19);
  const position = {
    x: rounded(basePosition.x + Math.sin(phase) * amount),
    y: rounded(basePosition.y + Math.cos(phase * 1.3) * amount * 0.7),
    z: basePosition.z
  };

  return {
    basePosition,
    fov: rounded(state.fov + (desired.fov - state.fov) * alpha),
    lookAt,
    modifiers,
    position,
    shake: { amount, phase }
  };
}

export function resetCameraController(targets, viewport) {
  return createCameraController(targets, viewport);
}

export function getFramingReport(state, targets, viewport) {
  return inspectCameraFrame(state, targets, viewport);
}
