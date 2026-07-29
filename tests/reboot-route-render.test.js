import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { chapterOneLevel } from '../src/reboot/content/levels/chapter1.js';
import { createSchoolRoute } from '../src/reboot/render/schoolRoute.js';

function createRoute(level = chapterOneLevel) {
  const scene = new THREE.Scene();
  return { route: createSchoolRoute({ level, scene }), scene };
}

const REQUIRED_LANDMARKS = Object.freeze({
  'classroom-cold-open': ['classroom-teacher-terminal', 'classroom-student-desks', 'classroom-board', 'classroom-clock'],
  'collapsing-corridor': ['corridor-locker-banks', 'corridor-room-number', 'corridor-emergency-sign'],
  'first-arena': ['arena-projector-source', 'arena-source-grid', 'arena-damaged-desk-perimeter'],
  'memory-backup-decision': ['memory-backup-terminal', 'memory-server-rack', 'memory-evidence-frame'],
  'scanner-pursuit': ['pursuit-scanner-beacons', 'pursuit-gate-rhythm'],
  'gym-boss-arena': ['gym-court-markings', 'gym-scoreboard', 'gym-broadcast-door', 'gym-approval-server']
});

test('Given chapter one data, When the route is built, Then every authored layer has explicit debug state', () => {
  // Given: the six-segment chapter-one school level.
  const { route, scene } = createRoute();

  // When: the renderer contract is inspected.
  const debug = route.getDebugState();

  // Then: no gameplay layer is hidden inside art geometry.
  assert.equal(scene.children.includes(route.group), true);
  assert.deepEqual(debug.segmentIds, chapterOneLevel.segments.map((entry) => entry.id));
  assert.deepEqual(debug.colliderIds, chapterOneLevel.layers.collision.map((entry) => entry.id));
  assert.deepEqual(debug.navigationIds, chapterOneLevel.layers.navigation.map((entry) => entry.id));
  assert.deepEqual(debug.checkpointIds, chapterOneLevel.layers.checkpoint.map((entry) => entry.id));
  assert.deepEqual(debug.visualIds, chapterOneLevel.layers.visual.map((entry) => entry.id));
  assert.deepEqual(debug.localLightIds, chapterOneLevel.layers.localLight.map((entry) => entry.id));
  assert.deepEqual(debug.encounterIds, chapterOneLevel.layers.encounter.map((entry) => entry.id));
  assert.equal(debug.occluders.length, chapterOneLevel.segments.length * 2);
  assert.equal(debug.routeCues.length, chapterOneLevel.segments.length);
});

test('Given six visual kinds, When route dressing is built, Then every segment exposes its school landmarks', () => {
  // Given: each chapter-one segment has an authored visual kind.
  const { route } = createRoute();

  // When: semantic dressing state is inspected.
  const landmarksBySegment = route.getDebugState().landmarksBySegment;

  // Then: each segment exposes the complete landmark language expected for its role.
  assert.deepEqual(Object.keys(landmarksBySegment), chapterOneLevel.segments.map((segment) => segment.id));
  for (const [segmentId, expectedIds] of Object.entries(REQUIRED_LANDMARKS)) {
    assert.deepEqual(landmarksBySegment[segmentId].map((landmark) => landmark.id), expectedIds);
    assert.deepEqual(
      chapterOneLevel.layers.visual.find((visual) => visual.segmentId === segmentId).landmarkIds,
      expectedIds
    );
  }
});

test('Given route landmark metadata, When segments are compared, Then all six visual signatures differ', () => {
  // Given: one independently built complete route.
  const { route } = createRoute();

  // When: each segment's semantic roles form a stable signature.
  const signatures = Object.values(route.getDebugState().landmarksBySegment)
    .map((landmarks) => landmarks.map((landmark) => landmark.role).join('|'));

  // Then: no two school spaces depend on the same prop vocabulary.
  assert.equal(signatures.length, chapterOneLevel.segments.length);
  assert.equal(new Set(signatures).size, signatures.length);
});

test('Given a route without landmark authoring, When it renders, Then chapter-one dressing does not leak', () => {
  // Given: a valid route whose visual layer does not opt into semantic landmarks.
  const generic = structuredClone(chapterOneLevel);
  generic.layers.visual.forEach((visual) => { delete visual.landmarkIds; });

  // When: the shared school-route renderer builds that route.
  const { route } = createRoute(generic);
  const dressing = route.getDebugState().budget.dressing;

  // Then: no chapter-one instance, draw call, or GPU resource is allocated.
  assert.deepEqual(dressing, { drawCalls: 0, instances: 0, resources: 0, triangles: 0 });
  assert.equal(Object.values(route.getDebugState().landmarksBySegment).every((entries) => entries.length === 0), true);
});

test('Given authored collision and navigation, When meshes are built, Then walkability stays flat and data-owned', () => {
  // Given: visual kinds that do not describe collision.
  const altered = structuredClone(chapterOneLevel);
  altered.layers.visual.forEach((visual) => { visual.kind = 'decor-only'; });

  // When: route collision state is produced.
  const { route } = createRoute(altered);
  const debug = route.getDebugState();
  const routeRoles = [];
  route.group.traverse((object) => routeRoles.push(object.userData.routeRole));

  // Then: collision bounds come only from collision/navigation data and have no stairs or ramps.
  assert.deepEqual(debug.colliders, altered.layers.collision.map((entry) => ({
    bounds: entry.walkableBounds,
    id: entry.id,
    segmentId: entry.segmentId,
    surface: 'flat'
  })));
  assert.equal(debug.colliders.every((entry) => entry.surface === 'flat'), true);
  assert.equal(routeRoles.includes('stairs'), false);
  assert.equal(routeRoles.includes('ramp'), false);
  assert.equal(route.group.getObjectByProperty('isSkinnedMesh', true), undefined);
});

test('Given local-light records, When the route is built, Then only those data-backed lights exist', () => {
  // Given: authored light fixtures attached to visual records.
  const expected = chapterOneLevel.layers.localLight;

  // When: the scene graph is traversed.
  const { route } = createRoute();
  const lights = [];
  route.group.traverse((object) => {
    if (object.isLight) lights.push(object);
  });

  // Then: there is one bounded point light for each record and no speculative light.
  assert.equal(lights.length, expected.length);
  assert.deepEqual(lights.map((light) => light.userData.sourceId), expected.map((entry) => entry.id));
  assert.deepEqual(lights.map((light) => light.position.toArray()), expected.map((entry) => [
    entry.position.x, entry.position.y, entry.position.z
  ]));
  assert.equal(lights.every((light) => light.isPointLight && light.distance > 0 && !light.castShadow), true);
});

test('Given a low-spec route budget, When all six segments render, Then draw calls and triangles stay conservative', () => {
  // Given: the complete school route.
  const { route } = createRoute();

  // When: its deterministic render budget is measured.
  const budget = route.getDebugState().budget;

  // Then: instancing keeps both budgets far below scene-level caps.
  assert.ok(budget.drawCalls <= 18, budget.drawCalls);
  assert.ok(budget.triangles <= 5000, budget.triangles);
  assert.ok(budget.dressing.drawCalls <= 6, budget.dressing.drawCalls);
  assert.ok(budget.dressing.instances <= 120, budget.dressing.instances);
  const instancedMeshes = [];
  route.group.traverse((object) => { if (object.isInstancedMesh) instancedMeshes.push(object); });
  assert.equal(instancedMeshes.length, budget.drawCalls);
});

test('Given the same level twice, When routes are built, Then debug state is deterministic', () => {
  // Given: two independent scene graphs built from the same immutable data.
  const first = createRoute().route;
  const second = createRoute().route;

  // When: render-facing state is serialized.
  const firstDebug = first.getDebugState();
  const secondDebug = second.getDebugState();

  // Then: runtime UUIDs and clocks do not leak into the contract.
  assert.deepEqual(firstDebug, secondDebug);
});

test('Given malformed collision data, When route construction is attempted, Then nothing is attached', () => {
  // Given: collision bounds that disagree with navigation.
  const malformed = structuredClone(chapterOneLevel);
  malformed.layers.collision[0].walkableBounds.maxX -= 1;
  const scene = new THREE.Scene();

  // When/Then: the boundary rejects the level before scene mutation.
  assert.throws(
    () => createSchoolRoute({ level: malformed, scene }),
    /COLLISION_NAV_DISAGREEMENT/
  );
  assert.equal(scene.children.length, 0);
});

test('Given a live route, When disposal repeats, Then scene and GPU resources are released once', () => {
  // Given: a route attached to a scene with tracked GPU resources.
  const { route, scene } = createRoute();
  const disposedResources = [];
  const trackedResources = new Set();
  route.group.traverse((object) => {
    if (!object.isMesh) return;
    for (const resource of [object.geometry, object.material]) {
      if (trackedResources.has(resource)) continue;
      trackedResources.add(resource);
      resource.addEventListener('dispose', () => disposedResources.push(resource.uuid));
    }
  });

  // When: disposal is called twice.
  const firstCount = route.dispose();
  const secondCount = route.dispose();

  // Then: the group is detached, resources fire once, and cleanup is idempotent.
  assert.equal(scene.children.includes(route.group), false);
  assert.equal(firstCount, route.getDebugState().budget.resources);
  assert.equal(secondCount, 0);
  assert.equal(new Set(disposedResources).size, firstCount);
  assert.equal(disposedResources.length, firstCount);
  assert.equal(route.group.children.length, 0);
  assert.equal(route.getDebugState().disposed, true);
});
