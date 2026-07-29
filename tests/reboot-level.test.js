import assert from 'node:assert/strict';
import test from 'node:test';
import { solveCameraFrame } from '../src/reboot/camera/framing.js';

const unavailable = () => {
  throw new Error('Task 5 동작이 아직 구현되지 않았습니다.');
};

const content = await import('../src/reboot/content/levels/chapter1.js').catch(() => ({
  chapterOneLevel: { layers: {}, segments: [] }
}));
const validation = await import('../src/reboot/level/validateLevel.js').catch(() => ({
  validateLevel: unavailable
}));
const camera = await import('../src/reboot/camera/controller.js').catch(() => ({
  CAMERA_LIMITS: { maxShake: 0 },
  addCameraModifier: unavailable,
  addCameraShake: unavailable,
  createCameraController: unavailable,
  getFramingReport: unavailable,
  resetCameraController: unavailable,
  updateCameraController: unavailable
}));
const occlusion = await import('../src/reboot/camera/occlusion.js').catch(() => ({
  decideOccluderFades: unavailable
}));

const { chapterOneLevel } = content;
const { validateLevel } = validation;
const {
  CAMERA_LIMITS,
  addCameraModifier,
  addCameraShake,
  createCameraController,
  getFramingReport,
  resetCameraController,
  updateCameraController
} = camera;
const { decideOccluderFades } = occlusion;

const expectedRoute = [
  'classroom-cold-open',
  'collapsing-corridor',
  'first-arena',
  'memory-backup-decision',
  'scanner-pursuit',
  'gym-boss-arena'
];
const representativeTargets = {
  player: { id: 'player', x: 0, y: 0, z: 0 },
  routeCue: { id: 'route-cue', x: 0, y: 0, z: -8 },
  threat: { id: 'scanner', x: 3, y: 0, z: -3 },
  traceTarget: { id: 'trace', x: -2, y: 0, z: -5 }
};

function errorCodes(level) {
  return validateLevel(level).errors.map((error) => error.code);
}

test('chapter one route is authored in story order with unique stable ids', () => {
  // Given: the authored chapter-one school route.
  const ids = chapterOneLevel.segments.map((segment) => segment.id);

  // When: its order and ids are inspected.
  // Then: all six required beats appear once in playable order.
  assert.deepEqual(ids, expectedRoute);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.keys(chapterOneLevel.layers).sort(), [
    'checkpoint', 'collision', 'encounter', 'localLight', 'navigation', 'visual'
  ]);
});

test('chapter one route anchors stay on the authored gameplay plane', () => {
  // Given: route anchors authored for a flat school floor.
  // When: the complete level is validated.
  const result = validateLevel(chapterOneLevel);

  // Then: no anchor leaves the declared plane.
  assert.equal(result.errors.some((error) => error.code === 'ANCHOR_OUT_OF_PLANE'), false);
  assert.equal(chapterOneLevel.segments.every((segment) => segment.anchor.y === chapterOneLevel.planeY), true);
});

test('validator reports missing exits and checkpoints without hiding either fault', () => {
  // Given: a route segment with both contracts removed.
  const malformed = structuredClone(chapterOneLevel);
  malformed.segments[2].exits = [];
  malformed.segments[2].checkpointId = 'missing-checkpoint';

  // When: the malformed route is validated.
  const codes = errorCodes(malformed);

  // Then: both independent authoring faults are visible.
  assert.equal(codes.includes('MISSING_EXIT'), true);
  assert.equal(codes.includes('MISSING_CHECKPOINT'), true);
});

test('validator rejects collision and navigation bounds that disagree', () => {
  // Given: one collision floor is narrower than its navigation zone.
  const malformed = structuredClone(chapterOneLevel);
  malformed.layers.collision[0].walkableBounds.maxX -= 1;

  // When: the malformed route is validated.
  const codes = errorCodes(malformed);

  // Then: the disagreement is named directly.
  assert.equal(codes.includes('COLLISION_NAV_DISAGREEMENT'), true);
});

test('validator rejects local lights without a valid visual attachment', () => {
  // Given: a light points at a visual id that is not authored.
  const malformed = structuredClone(chapterOneLevel);
  malformed.layers.localLight[0].visualId = 'ghost-fixture';

  // When: the malformed route is validated.
  const codes = errorCodes(malformed);

  // Then: the light is reported as unattached.
  assert.equal(codes.includes('UNATTACHED_LIGHT'), true);
});

test('every school segment and the boss chapter exit are reachable', () => {
  // Given: the complete authored route graph.
  // When: reachability is validated.
  const result = validateLevel(chapterOneLevel);

  // Then: all segments and the external boss exit are reached.
  assert.deepEqual(result.reachableSegmentIds, expectedRoute);
  assert.equal(result.bossExitReachable, true);
  assert.deepEqual(result.errors, []);
});

test('validator exposes malformed ids and invalid anchors in explicit failing fixtures', () => {
  // Given: one invalid id and one non-finite anchor.
  const malformed = structuredClone(chapterOneLevel);
  malformed.segments[0].id = '교실 시작';
  malformed.segments[1].anchor.x = Number.NaN;

  // When: the fixture is validated twice.
  const first = errorCodes(malformed);
  const second = errorCodes(malformed);

  // Then: both failures are deterministic and cannot masquerade as success.
  assert.equal(first.includes('INVALID_ID'), true);
  assert.equal(first.includes('INVALID_ANCHOR'), true);
  assert.deepEqual(second, first);
});

for (const viewport of [
  { height: 900, mode: 'desktop', width: 1440 },
  { height: 844, mode: 'touch', width: 390 }
]) {
  test(`${viewport.mode} camera framing includes player, threat, TRACE target, and route cue`, () => {
    // Given: representative chapter-one targets and viewport dimensions.
    const state = createCameraController(representativeTargets, viewport);

    // When: the solved frame is evaluated.
    const report = getFramingReport(state, representativeTargets, viewport);

    // Then: all four required targets remain readable.
    assert.equal(report.allIncluded, true);
    assert.deepEqual(report.includedIds.sort(), ['player', 'route-cue', 'scanner', 'trace']);
  });
}

test('school camera keeps the four-target frame close enough for readable main characters', () => {
  // Given: the same representative targets used by desktop and touch inclusion checks.
  const desktop = solveCameraFrame(representativeTargets, { height: 820, mode: 'desktop', width: 1180 });
  const touch = solveCameraFrame(representativeTargets, { height: 844, mode: 'touch', width: 390 });

  // When: the authored camera offsets from its shared look-at are measured.
  const offsets = [desktop, touch].map((frame) => ({
    distance: frame.position.z - frame.lookAt.z,
    height: frame.position.y - frame.lookAt.y
  }));

  // Then: both frames stay close enough to render faces and hair without losing all four targets.
  assert.ok(offsets[0].distance <= 17 && offsets[0].height <= 9);
  assert.ok(offsets[1].distance <= 20.2 && offsets[1].height <= 10.2);
});

test('camera framing remains finite with player-only or empty target input', () => {
  // Given: optional targets are absent, and a reset may briefly have no player target.
  const viewport = { height: 900, mode: 'desktop', width: 1440 };

  // When: both incomplete target sets are framed.
  const states = [
    createCameraController({ player: representativeTargets.player }, viewport),
    createCameraController({}, viewport)
  ];

  // Then: position and look-at coordinates stay finite instead of leaking Infinity/NaN.
  for (const state of states) {
    assert.equal(Object.values(state.position).every(Number.isFinite), true);
    assert.equal(Object.values(state.lookAt).every(Number.isFinite), true);
  }
});

test('occluders between camera and player receive a fade decision', () => {
  // Given: one wall on the sight line and one wall outside it.
  const occluders = [
    { bounds: { maxX: 1, maxY: 3, maxZ: 5, minX: -1, minY: 0, minZ: 4 }, id: 'blocking-wall' },
    { bounds: { maxX: 8, maxY: 3, maxZ: 5, minX: 6, minY: 0, minZ: 4 }, id: 'side-wall' }
  ];

  // When: sight-line fades are decided.
  const decisions = decideOccluderFades({
    cameraPosition: { x: 0, y: 2, z: 10 },
    occluders,
    playerPosition: { x: 0, y: 1, z: 0 }
  });

  // Then: only the blocking wall fades.
  assert.deepEqual(decisions, [
    { fade: true, id: 'blocking-wall', opacity: 0.2 },
    { fade: false, id: 'side-wall', opacity: 1 }
  ]);
});

test('chase and boss camera modifiers expire after their short authored duration', () => {
  // Given: both short-lived modifiers are active.
  let state = createCameraController(representativeTargets, { height: 900, mode: 'desktop', width: 1440 });
  state = addCameraModifier(state, 'chase', { duration: 0.3, strength: 1 });
  state = addCameraModifier(state, 'boss', { duration: 0.5, strength: 0.8 });

  // When: the camera advances beyond both durations.
  const updated = updateCameraController(state, representativeTargets, 0.6, { height: 900, mode: 'desktop', width: 1440 });

  // Then: no stale modifier remains.
  assert.deepEqual(updated.modifiers, {});
});

test('camera shake is capped and reset framing clears all transient state', () => {
  // Given: an excessive shake and an active chase modifier.
  let state = createCameraController(representativeTargets, { height: 900, mode: 'desktop', width: 1440 });
  state = addCameraModifier(state, 'chase', { duration: 2, strength: 1 });
  state = addCameraShake(state, 99);

  // When: reset framing is requested.
  const reset = resetCameraController(representativeTargets, { height: 900, mode: 'desktop', width: 1440 });

  // Then: the budget was capped and reset snaps to a clean authored frame.
  assert.equal(state.shake.amount, CAMERA_LIMITS.maxShake);
  assert.deepEqual(reset.modifiers, {});
  assert.deepEqual(reset.shake, { amount: 0, phase: 0 });
  assert.deepEqual(reset.position, createCameraController(representativeTargets, { height: 900, mode: 'desktop', width: 1440 }).position);
});

test('deterministic smoothing is equivalent across cancel-resume update splits', () => {
  // Given: the same initial frame and a moved target set.
  const viewport = { height: 900, mode: 'desktop', width: 1440 };
  const initial = createCameraController(representativeTargets, viewport);
  const moved = structuredClone(representativeTargets);
  moved.player.x = 4;
  moved.routeCue.x = 4;

  // When: time advances once or across an equivalent pause boundary.
  const whole = updateCameraController(initial, moved, 0.4, viewport);
  const paused = updateCameraController(initial, moved, 0, viewport);
  const split = updateCameraController(updateCameraController(paused, moved, 0.2, viewport), moved, 0.2, viewport);

  // Then: deterministic exponential smoothing produces the same framing.
  assert.deepEqual(split.position, whole.position);
  assert.deepEqual(split.lookAt, whole.lookAt);
});
