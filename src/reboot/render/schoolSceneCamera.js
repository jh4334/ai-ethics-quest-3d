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
  camera.position.set(next.position.x, next.position.y - (combatFocus ? 2 : 0), next.position.z - (combatFocus ? 5 : 0));
  camera.fov = combatFocus ? 36 : next.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(next.lookAt.x, next.lookAt.y, next.lookAt.z);
  return Object.freeze({ cameraState: next, targets });
}
import { updateCameraController } from '../camera/controller.js';
