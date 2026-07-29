export function closestRouteSegment(segments, z) {
  return segments.reduce((closest, segment) => (
    Math.abs(segment.anchor.z - z) < Math.abs(closest.anchor.z - z) ? segment : closest
  ));
}

export function getSceneViewport(canvas) {
  const width = Math.max(canvas.clientWidth, 1);
  const height = Math.max(canvas.clientHeight, 1);
  return { height, mode: width <= 820 ? 'touch' : 'desktop', width };
}

export function getEncounterCameraTargets(frame, routeCue, encounter) {
  const committed = encounter.enemies.find((enemy) => ['windup', 'active'].includes(enemy.phase));
  const nearest = encounter.enemies
    .filter((enemy) => enemy.phase !== 'defeat')
    .toSorted((first, second) => (
      Math.hypot(first.position.x - frame.player.position.x, first.position.z - frame.player.position.z)
      - Math.hypot(second.position.x - frame.player.position.x, second.position.z - frame.player.position.z)
    ))[0];
  const threatId = committed?.id ?? nearest?.id;
  const threat = frame.targets.find((target) => target.id === threatId) ?? frame.player;
  const memoryTarget = frame.targets.find((target) => target.id === 'memory-backup');
  const traceTarget = Math.abs(frame.player.position.z + 54) < 10 && memoryTarget
    ? memoryTarget
    : threat;
  const cue = committed ? { id: routeCue.id, ...threat.position } : routeCue.position;
  return {
    player: { id: 'player', ...frame.player.position },
    threat: { id: threat.id, ...threat.position },
    traceTarget: { id: traceTarget.id, ...traceTarget.position },
    routeCue: { id: routeCue.id, ...cue }
  };
}

export function getBossCameraTargets(frame, routeCue) {
  const boss = { id: 'attendance-proctor', x: 0, y: 0, z: -104 };
  return {
    player: { id: 'player', ...frame.player.position },
    routeCue: { id: routeCue.id, ...boss },
    threat: boss,
    traceTarget: boss
  };
}

function projectWorldBounds(camera, viewport, target, size) {
  const points = [];
  for (const x of [-size.radius, size.radius]) {
    for (const y of [size.bottom, size.top]) {
      for (const z of [-size.radius, size.radius]) {
        const projected = camera.position.clone().set(target.x + x, target.y + y, target.z + z).project(camera);
        points.push({
          depth: projected.z,
          x: (projected.x + 1) * viewport.width / 2,
          y: (1 - projected.y) * viewport.height / 2
        });
      }
    }
  }
  return Object.freeze({
    bottom: Math.max(...points.map((point) => point.y)),
    depthValid: points.every((point) => point.depth >= -1 && point.depth <= 1),
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y))
  });
}

export function inspectCombatSafeArea(camera, targets, viewport, mode) {
  if (mode === 'route') return null;
  camera.updateMatrixWorld(true);
  const safeRect = Object.freeze({
    bottom: viewport.height - (viewport.mode === 'touch' ? 150 : 90),
    left: viewport.mode === 'touch' ? 16 : 24,
    right: viewport.width - (viewport.mode === 'touch' ? 16 : 24),
    top: viewport.mode === 'touch' ? 135 : 80
  });
  const subjects = [
    { id: 'player', size: { bottom: 0, radius: 0.65, top: 2.5 }, target: targets.player },
    { id: 'threat', size: { bottom: 0, radius: 0.75, top: 2.7 }, target: targets.threat },
    { id: 'telegraph', size: { bottom: 0, radius: 1.55, top: 0.12 }, target: targets.threat }
  ];
  const bounds = subjects.map(({ id, size, target }) => Object.freeze({
    id,
    ...projectWorldBounds(camera, viewport, target, size)
  }));
  const inside = (box) => box.depthValid
    && box.left >= safeRect.left && box.right <= safeRect.right
    && box.top >= safeRect.top && box.bottom <= safeRect.bottom;
  const includedIds = bounds.filter(inside).map(({ id }) => id);
  return Object.freeze({
    allIncluded: includedIds.length === subjects.length,
    bounds: Object.freeze(bounds),
    includedIds: Object.freeze(includedIds),
    mode,
    safeRect
  });
}

export function updateSchoolCamera({
  bossEnabled, camera, cameraState, currentSegment, delta, encounter, frame, routeCue, viewport
}) {
  const inBoss = bossEnabled && currentSegment.id === 'gym-boss-arena';
  const targets = inBoss
    ? getBossCameraTargets(frame, routeCue)
    : getEncounterCameraTargets(frame, routeCue, encounter);
  const next = updateCameraController(cameraState, targets, delta, viewport);
  const combatFocus = (currentSegment.id === 'first-arena'
    && encounter.enemies.some((enemy) => ['windup', 'active'].includes(enemy.phase))) || inBoss;
  const mode = inBoss ? 'boss' : combatFocus ? 'arena' : 'route';
  const heightShift = mode === 'boss' ? 2 : 0;
  const distanceShift = mode === 'boss' ? 5 : 0;
  camera.position.set(next.position.x, next.position.y - heightShift, next.position.z - distanceShift);
  camera.fov = mode === 'arena' ? 50 : mode === 'boss' ? 36 : next.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(next.lookAt.x, next.lookAt.y, next.lookAt.z);
  return Object.freeze({
    cameraState: next,
    combatSafeArea: inspectCombatSafeArea(camera, targets, viewport, mode),
    targets
  });
}
import { updateCameraController } from '../camera/controller.js';
