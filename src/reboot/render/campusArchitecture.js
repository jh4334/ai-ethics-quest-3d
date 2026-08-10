import * as THREE from 'three';

import { CAMPUS_DISTRICTS, CAMPUS_LANDMARKS, CAMPUS_MATERIAL_ROLES } from '../content/campus/chapterOneCampus.js';
import { WORLD_COLORS, WORLD_MATERIALS } from '../design/tokens.js';
import { createDisposableRegistry } from './dispose.js';

const MATERIAL_PARAMETERS = WORLD_MATERIALS;

function roundedShape(width, depth, radius) {
  const x = width / 2;
  const z = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -z);
  shape.lineTo(x - radius, -z);
  shape.quadraticCurveTo(x, -z, x, -z + radius);
  shape.lineTo(x, z - radius);
  shape.quadraticCurveTo(x, z, x - radius, z);
  shape.lineTo(-x + radius, z);
  shape.quadraticCurveTo(-x, z, -x, z - radius);
  shape.lineTo(-x, -z + radius);
  shape.quadraticCurveTo(-x, -z, -x + radius, -z);
  return shape;
}

function roundedSlab(resources, width, depth, height, radius, id) {
  const geometry = resources.register(new THREE.ExtrudeGeometry(roundedShape(width, depth, radius), {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(0.12, height / 2),
    bevelThickness: Math.min(0.08, height / 2),
    curveSegments: 5,
    depth: height
  }), id);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function roundedDeck(resources, width, depth, radius, id) {
  const geometry = resources.register(new THREE.ShapeGeometry(
    roundedShape(width, depth, radius), 5
  ), id);
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(
      index,
      (uv.getX(index) + width / 2) / width,
      (uv.getY(index) + depth / 2) / depth
    );
  }
  uv.needsUpdate = true;
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function classroomIslandShape(width, depth) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const outline = [
    [-0.86, -1], [0.86, -1], [0.96, -0.82], [0.84, -0.58],
    [0.58, -0.42], [0.45, -0.15], [0.32, 0.12], [0.38, 0.38],
    [0.52, 0.66], [0.9, 1], [-0.9, 1], [-0.52, 0.66],
    [-0.38, 0.38], [-0.32, 0.12], [-0.45, -0.15], [-0.58, -0.42],
    [-0.84, -0.58], [-0.96, -0.82]
  ];
  const shape = new THREE.Shape();
  outline.forEach(([x, z], index) => {
    const point = [x * halfWidth, -z * halfDepth];
    if (index === 0) shape.moveTo(...point);
    else shape.lineTo(...point);
  });
  shape.closePath();
  return shape;
}

function irregularDeck(resources, width, depth, id) {
  const shape = classroomIslandShape(width, depth);
  const geometry = resources.register(new THREE.ShapeGeometry(shape, 1), id);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(
      index,
      position.getX(index) / width + 0.5,
      position.getY(index) / depth + 0.5
    );
  }
  uv.needsUpdate = true;
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function irregularClassroomSlab(resources, width, depth, height, id) {
  const geometry = resources.register(new THREE.ExtrudeGeometry(
    classroomIslandShape(width, depth),
    {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.1,
      bevelThickness: 0.07,
      curveSegments: 1,
      depth: height
    }
  ), id);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function irregularTerraceSlab(resources, width, depth, height, id, mirrored = false) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const direction = mirrored ? -1 : 1;
  const outline = [
    [-0.9, -0.96], [0.34, -1], [0.94, -0.62], [0.82, 0.12],
    [1, 0.72], [0.42, 1], [-0.36, 0.9], [-1, 0.42], [-0.84, -0.28]
  ];
  const shape = new THREE.Shape();
  outline.forEach(([x, z], index) => {
    const point = [x * halfWidth * direction, z * halfDepth];
    if (index === 0) shape.moveTo(...point);
    else shape.lineTo(...point);
  });
  shape.closePath();
  const geometry = resources.register(new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.08,
    bevelThickness: 0.06,
    curveSegments: 1,
    depth: height
  }), id);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function causewayShape(width, depth) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const outline = [
    [-0.92, 1], [0.9, 1], [0.72, 0.78], [0.5, 0.56],
    [0.62, 0.3], [0.46, 0.04], [0.56, -0.22], [0.4, -0.5],
    [0.5, -0.78], [0.38, -1], [-0.42, -1], [-0.36, -0.76],
    [-0.52, -0.5], [-0.4, -0.2], [-0.56, 0.05], [-0.45, 0.34],
    [-0.62, 0.58], [-0.74, 0.8]
  ];
  const shape = new THREE.Shape();
  outline.forEach(([x, z], index) => {
    const point = [x * halfWidth, -z * halfDepth];
    if (index === 0) shape.moveTo(...point);
    else shape.lineTo(...point);
  });
  shape.closePath();
  return shape;
}

function causewaySlab(resources, width, depth, height, id) {
  const geometry = resources.register(new THREE.ExtrudeGeometry(causewayShape(width, depth), {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.11,
    bevelThickness: 0.08,
    curveSegments: 1,
    depth: height
  }), id);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function causewayDeck(resources, width, depth, id) {
  const geometry = resources.register(new THREE.ShapeGeometry(causewayShape(width, depth), 1), id);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(index, position.getX(index) / width + 0.5, position.getY(index) / depth + 0.5);
  }
  uv.needsUpdate = true;
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function mesh(parent, geometry, material, name, position, rotation = null, scale = null) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(position.x, position.y, position.z);
  if (rotation) object.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  if (scale) object.scale.set(scale.x, scale.y, scale.z);
  object.castShadow = false;
  object.receiveShadow = false;
  parent.add(object);
  return object;
}

function createFirstVistaSurface(group, resources, materials) {
  const rowWidths = [
    9, 9, 8, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 5,
    5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 2, 2
  ];
  const paverCount = rowWidths.reduce((sum, count) => sum + count, 0);
  const stoneColors = [0x8a7d86, 0x9b7e7c, 0x72788a, 0x8d7770];
  const paverScaleX = [0.58, 0.66, 0.62, 0.72];
  const paverScaleZ = [0.62, 0.58, 0.68, 0.72, 0.61];
  const paverShape = new THREE.Shape();
  paverShape.moveTo(-0.72, -0.58);
  paverShape.lineTo(0.48, -0.66);
  paverShape.lineTo(0.72, -0.18);
  paverShape.lineTo(0.61, 0.55);
  paverShape.lineTo(-0.42, 0.67);
  paverShape.lineTo(-0.74, 0.22);
  paverShape.closePath();
  const paverGeometry = resources.register(new THREE.ExtrudeGeometry(paverShape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.055,
    bevelThickness: 0.035,
    curveSegments: 1,
    depth: 0.15
  }), 'campus-first-vista-paver-geometry');
  paverGeometry.rotateX(-Math.PI / 2);
  const pavers = new THREE.InstancedMesh(paverGeometry, materials.path, paverCount);
  pavers.name = 'campus-first-vista-stone-pavers';
  pavers.castShadow = false;
  pavers.receiveShadow = false;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  let paverIndex = 0;
  for (const [row, columnCount] of rowWidths.entries()) {
    const t = row / (rowWidths.length - 1);
    const rowWidth = 4.8 - t * 3;
    const curve = Math.sin(t * Math.PI * 1.7) * 0.48;
    for (let column = 0; column < columnCount; column += 1) {
      const columnOffset = columnCount === 1 ? 0 : column / (columnCount - 1) - 0.5;
      quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (paverIndex % 5 - 2) * 0.085 + Math.sin(row * 0.7) * 0.04
      );
      matrix.compose(
        new THREE.Vector3(
          curve + columnOffset * rowWidth,
          0.17 + (paverIndex % 4) * 0.018,
          10.33 - row * 1.02 + (column % 2 === 0 ? -0.05 : 0.05)
        ),
        quaternion,
        new THREE.Vector3(
          paverScaleX[paverIndex % paverScaleX.length],
          1,
          paverScaleZ[paverIndex % paverScaleZ.length]
        )
      );
      pavers.setMatrixAt(paverIndex, matrix);
      pavers.setColorAt(paverIndex, new THREE.Color(stoneColors[paverIndex % stoneColors.length]));
      paverIndex += 1;
    }
  }
  pavers.instanceMatrix.needsUpdate = true;
  pavers.instanceColor.needsUpdate = true;
  pavers.computeBoundingBox();
  pavers.computeBoundingSphere();

  const cliffPositions = Array.from({ length: 30 }, (_, index) => {
    const t = index / 29;
    const z = 6.1 - t * 26.2;
    const waist = Math.abs(t - 0.5) * 2;
    const x = 3.15 + waist * 2.1 + (index % 3) * 0.12;
    return [[-x, z], [x, z]];
  }).flat();
  const cliffGeometry = resources.register(
    new THREE.DodecahedronGeometry(0.82, 0), 'campus-first-vista-cliff-rock-geometry'
  );
  const cliffRocks = new THREE.InstancedMesh(cliffGeometry, materials.terrain, cliffPositions.length);
  cliffRocks.name = 'campus-first-vista-cliff-rocks';
  cliffRocks.castShadow = false;
  cliffRocks.receiveShadow = false;
  for (const [index, [x, z]] of cliffPositions.entries()) {
    quaternion.setFromEuler(new THREE.Euler(index * 0.17, index * 0.39, index * 0.13));
    matrix.compose(
      new THREE.Vector3(x, -0.28 - (index % 4) * 0.17, z),
      quaternion,
      new THREE.Vector3(
        0.94 + (index % 3) * 0.18,
        0.9 + (index % 6) * 0.16,
        0.96 + (index % 4) * 0.1
      )
    );
    cliffRocks.setMatrixAt(index, matrix);
    cliffRocks.setColorAt(index, new THREE.Color(stoneColors[(index + 1) % stoneColors.length]));
  }
  cliffRocks.instanceMatrix.needsUpdate = true;
  cliffRocks.instanceColor.needsUpdate = true;
  cliffRocks.computeBoundingBox();
  cliffRocks.computeBoundingSphere();

  const terraces = [
    [-4.72, -0.52, 3.92, 3.45, 4.8, 0.78, false],
    [4.8, -0.58, 3.8, 3.35, 4.65, 0.84, true],
    [-4.82, -0.66, -5.35, 3.2, 3.25, 0.92, true],
    [4.9, -0.74, -6.7, 3.1, 3.15, 1.02, false]
  ];
  terraces.forEach(([x, y, z, width, depth, height, mirrored], index) => {
    const terrace = irregularTerraceSlab(
      resources, width, depth, height, `campus-first-vista-garden-terrace-geometry-${index}`, mirrored
    );
    mesh(group, terrace, materials.terrain, `campus-first-vista-garden-terrace-${index}`, { x, y, z });
  });

  const recordShape = new THREE.Shape();
  recordShape.moveTo(-0.46, -0.56);
  recordShape.lineTo(0.38, -0.5);
  recordShape.lineTo(0.5, 0.1);
  recordShape.lineTo(0.18, 0.58);
  recordShape.lineTo(-0.42, 0.42);
  recordShape.closePath();
  for (const x of [-0.18, 0, 0.18]) {
    const hole = new THREE.Path();
    hole.absellipse(x, -0.02, 0.045, 0.045, 0, Math.PI * 2, false, 0);
    recordShape.holes.push(hole);
  }
  const recordGeometry = resources.register(
    new THREE.ShapeGeometry(recordShape, 3), 'campus-first-vista-record-geometry'
  );
  const recordPlacements = [
    [-4.3, 3.2, -5.2, -0.3, 0.2], [-2.9, 4.2, -7.1, 0.25, -0.45],
    [-1.4, 3.35, -6.3, -0.18, 0.4], [0.2, 4.9, -9.2, 0.12, -0.2],
    [1.7, 3.75, -7.2, -0.3, 0.5], [3.2, 4.45, -10.1, 0.34, 0.2],
    [4.6, 3.15, -5.5, -0.15, -0.35], [-3.7, 5.1, -11.1, 0.28, 0.5],
    [-1.2, 5.6, -13.1, -0.2, -0.4], [2.1, 5.25, -12.2, 0.2, 0.35],
    [4.2, 4.75, -14.3, -0.25, -0.15]
  ];
  const records = new THREE.InstancedMesh(recordGeometry, materials.record, recordPlacements.length);
  records.name = 'campus-first-vista-floating-records';
  for (const [index, [x, y, z, pitch, yaw]] of recordPlacements.entries()) {
    quaternion.setFromEuler(new THREE.Euler(pitch, yaw, (index % 3 - 1) * 0.24));
    matrix.compose(
      new THREE.Vector3(x, y, z), quaternion,
      new THREE.Vector3(0.62 + (index % 4) * 0.08, 0.62 + (index % 3) * 0.07, 1)
    );
    records.setMatrixAt(index, matrix);
  }
  records.instanceMatrix.needsUpdate = true;
  records.computeBoundingBox();
  records.computeBoundingSphere();

  const goalBeam = mesh(
    group,
    resources.register(new THREE.CylinderGeometry(0.16, 0.46, 15, 14, 1, true), 'campus-first-vista-goal-beam-geometry'),
    materials.goalBeam,
    'campus-first-vista-goal-beam',
    { x: 2.15, y: 7.5, z: -19.4 }
  );
  goalBeam.renderOrder = 3;

  group.add(pavers, cliffRocks, records);
  return Object.freeze({
    cliffRockCount: cliffPositions.length,
    cliffRockHeightLevels: 6,
    deckMaterialRole: 'terrain',
    floatingRecordCount: recordPlacements.length,
    gardenTerraceCount: terraces.length,
    gardenTerraceHeightLevels: 4,
    goalBeamCount: 1,
    paverCount,
    paverHeightLevels: 4
  });
}

function createPlatforms(group, resources, materials) {
  const platforms = [
    ['open-classroom', 14, 21, 0, 4, 3],
    ['roster-tower', 14, 23, -1.2, -18, 3.5],
    ['athletics-field', 22, 18, 1.25, -39, 4],
    ['library-archive', 18, 14, -1.2, -54, 3.5],
    ['glass-administration', 11, 29, 1, -76, 3],
    ['gymnasium', 29, 29, -0.9, -105, 5]
  ];
  const edgeMaterial = resources.register(new THREE.LineBasicMaterial({
    color: WORLD_COLORS.moon, opacity: 0.58, transparent: true
  }), 'campus-edge-material');
  for (const [id, width, depth, x, z, radius] of platforms) {
    const isCauseway = id === 'roster-tower';
    const slab = id === 'open-classroom'
      ? irregularClassroomSlab(resources, width, depth, 0.46, `campus-${id}-slab`)
      : isCauseway
        ? causewaySlab(resources, width, depth, 0.52, `campus-${id}-slab`)
        : roundedSlab(resources, width, depth, 0.34, radius, `campus-${id}-slab`);
    const platformMaterial = id === 'open-classroom' || isCauseway ? materials.terrain : materials.concrete;
    mesh(group, slab, platformMaterial, `campus-platform-${id}`, { x, y: -0.34, z });
    const deck = id === 'open-classroom'
      ? irregularDeck(resources, width - 0.22, depth - 0.22, `campus-${id}-deck`)
      : isCauseway
        ? causewayDeck(resources, width - 0.22, depth - 0.22, `campus-${id}-deck`)
        : roundedDeck(resources, width - 0.22, depth - 0.22, Math.max(0.4, radius - 0.12), `campus-${id}-deck`);
    mesh(group, deck, platformMaterial, `campus-platform-deck-${id}`, { x, y: 0.025, z });
    const route = roundedDeck(
      resources,
      Math.min(3.4, width * 0.24),
      depth - 0.7,
      Math.min(1.1, radius * 0.34),
      `campus-${id}-memory-route`
    );
    mesh(group, route, id === 'open-classroom' || isCauseway ? materials.path : materials.wood, `campus-memory-route-${id}`, { x: 0, y: 0.12, z });
    const edge = resources.register(new THREE.EdgesGeometry(slab, 24), `campus-${id}-edge`);
    const outline = new THREE.LineSegments(edge, edgeMaterial);
    outline.name = `campus-platform-edge-${id}`;
    outline.position.set(x, -0.335, z);
    group.add(outline);
    const underside = resources.register(new THREE.ConeGeometry(Math.min(width, depth) * 0.47, 5.5, 10, 1, true), `campus-${id}-underside`);
    mesh(group, underside, id === 'open-classroom' ? materials.terrain : materials.brick, `campus-floating-foundation-${id}`, { x, y: -3.05, z }, { x: Math.PI, y: 0, z: 0 }, { x: 1, y: 1, z: depth / width });
  }
  return createFirstVistaSurface(group, resources, materials);
}

function createRosterTower(group, resources, materials) {
  const x = -11.2;
  const z = -27;
  const body = resources.register(new THREE.CylinderGeometry(1.75, 2.35, 7.4, 12, 1, true), 'roster-spire-body');
  mesh(group, body, materials.glass, 'central-roster-spire', { x, y: 3.7, z });
  const core = resources.register(new THREE.CylinderGeometry(0.48, 0.72, 8.5, 10), 'roster-spire-core');
  mesh(group, core, materials.metal, 'roster-spire-core', { x, y: 4.1, z });
  const ring = resources.register(new THREE.TorusGeometry(2.15, 0.1, 8, 32), 'roster-spire-ring');
  for (const y of [1.1, 3.65, 6.2]) mesh(group, ring, materials.wood, `roster-record-ring-${y}`, { x, y, z }, { x: Math.PI / 2, y: 0, z: 0 });
}

function createAthleticsField(group, resources, materials) {
  const field = resources.register(new THREE.CircleGeometry(6.2, 48), 'athletics-field-grass');
  mesh(group, field, materials.foliage, 'athletics-field', { x: 0, y: 0.16, z: -39 }, { x: -Math.PI / 2, y: 0, z: 0 }, { x: 1.35, y: 1, z: 1 });
  const track = resources.register(new THREE.RingGeometry(7.43, 7.57, 64), 'athletics-track-ring');
  mesh(group, track, materials.track, 'athletics-track', { x: 0, y: 0.19, z: -39 }, { x: -Math.PI / 2, y: 0, z: 0 }, { x: 1.25, y: 1, z: 1 });
  const laneMaterial = resources.register(new THREE.MeshBasicMaterial({ color: WORLD_COLORS.memory }), 'athletics-lane-material');
  for (const [index, radius] of [7.38, 7.5, 7.62].entries()) {
    const lane = resources.register(new THREE.RingGeometry(radius, radius + 0.035, 64), `athletics-lane-${index}`);
    mesh(group, lane, laneMaterial, `athletics-lane-line-${index}`, { x: 0, y: 0.205, z: -39 }, { x: -Math.PI / 2, y: 0, z: 0 }, { x: 1.25, y: 1, z: 1 });
  }
  const points = Array.from({ length: 58 }, (_, index) => {
    const t = index / 57;
    const angle = t * Math.PI * 6.3;
    const radius = 0.35 + t * 2.05;
    return new THREE.Vector3(-5.1 + Math.sin(angle) * radius * 0.72, 0.11, -40.2 + Math.cos(angle) * radius);
  });
  const fingerprint = resources.register(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 90, 0.055, 6, false), 'fingerprint-recorder-tube');
  const fingerprintMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: WORLD_COLORS.memory, emissive: 0x9a4518, emissiveIntensity: 0.72, metalness: 0.46, roughness: 0.36
  }), 'fingerprint-recorder-material');
  mesh(group, fingerprint, fingerprintMaterial, 'fingerprint-recorder', { x: 0, y: 0.08, z: 0 });
  const pedestal = resources.register(new THREE.CylinderGeometry(1.05, 1.35, 0.32, 18), 'fingerprint-pedestal');
  mesh(group, pedestal, materials.metal, 'fingerprint-recorder-pedestal', { x: -5.1, y: 0.12, z: -40.2 });
}

function createLibrary(group, resources, materials) {
  const left = roundedSlab(resources, 4.4, 10.5, 3.25, 1.4, 'library-left-shell');
  const right = roundedSlab(resources, 4.4, 10.5, 3.25, 1.4, 'library-right-shell');
  mesh(group, left, materials.brick, 'night-library', { x: -5.4, y: 0, z: -54 });
  mesh(group, right, materials.brick, 'memory-archive', { x: 5.4, y: 0, z: -54 });
  const canopy = resources.register(new THREE.TorusGeometry(4.5, 0.24, 8, 32, Math.PI), 'library-canopy');
  mesh(group, canopy, materials.metal, 'library-archive-canopy', { x: 0, y: 4.2, z: -59.5 }, { x: 0, y: 0, z: 0 });
}

function createAdministrationTower(group, resources, materials) {
  const shell = resources.register(new THREE.CylinderGeometry(3.8, 4.4, 13.5, 8, 1, true), 'administration-glass-shell');
  mesh(group, shell, materials.glass, 'deletion-glass-tower', { x: 0, y: 6.7, z: -76 });
  const ribs = resources.register(new THREE.TorusGeometry(4.05, 0.11, 6, 32), 'administration-rib');
  for (const y of [1.1, 4.6, 8.1, 11.6]) mesh(group, ribs, materials.metal, `administration-ring-${y}`, { x: 0, y, z: -76 }, { x: Math.PI / 2, y: 0, z: 0 });
  const beam = resources.register(new THREE.CylinderGeometry(1.35, 0.46, 19, 24, 1, true), 'deletion-beam');
  const beamMaterial = resources.register(new THREE.MeshBasicMaterial({
    color: WORLD_COLORS.text, depthWrite: false, opacity: 0.16, transparent: true
  }), 'deletion-beam-material');
  mesh(group, beam, beamMaterial, 'deletion-beam-column', { x: 0, y: 12, z: -76 });
}

function createGymnasium(group, resources, materials) {
  const profile = new THREE.Shape();
  profile.moveTo(-12, 0);
  profile.lineTo(-12, 2.8);
  profile.quadraticCurveTo(0, 12, 12, 2.8);
  profile.lineTo(12, 0);
  profile.lineTo(9.7, 0);
  profile.quadraticCurveTo(0, 8.3, -9.7, 0);
  profile.closePath();
  const shell = resources.register(new THREE.ExtrudeGeometry(profile, { bevelEnabled: false, curveSegments: 16, depth: 25 }), 'gym-arched-shell');
  shell.translate(0, 0, -12.5);
  mesh(group, shell, materials.metal, 'floating-gym', { x: 0, y: 0, z: -104 });
  const court = roundedSlab(resources, 18, 23, 0.12, 2, 'gym-wood-court');
  mesh(group, court, materials.wood, 'gym-wood-court', { x: 0, y: 0.02, z: -104 });
}

export function createCampusArchitecture() {
  const resources = createDisposableRegistry();
  const group = new THREE.Group();
  group.name = 'h17-floating-campus-architecture';
  const materials = Object.fromEntries(CAMPUS_MATERIAL_ROLES.map((role) => {
    const name = `campus-${role}-material`;
    const material = resources.register(new THREE.MeshStandardMaterial(MATERIAL_PARAMETERS[role]), name);
    material.name = name;
    return [role, material];
  }));
  materials.terrain = resources.register(new THREE.MeshStandardMaterial({
    color: 0x4b4659, emissive: 0x211c31, emissiveIntensity: 0.44,
    metalness: 0.02, roughness: 0.98
  }), 'campus-terrain-material');
  materials.path = resources.register(new THREE.MeshStandardMaterial({
    color: 0xa58f9f, emissive: 0x49313e, emissiveIntensity: 0.4,
    metalness: 0.03, roughness: 0.94
  }), 'campus-path-stone-material');
  materials.record = resources.register(new THREE.MeshStandardMaterial({
    color: 0xf4e8d0, emissive: 0x866039, emissiveIntensity: 0.28,
    metalness: 0, roughness: 0.86, side: THREE.DoubleSide
  }), 'campus-floating-record-material');
  materials.goalBeam = resources.register(new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending, color: WORLD_COLORS.memory, depthWrite: false,
    opacity: 0.34, side: THREE.DoubleSide, transparent: true
  }), 'campus-goal-beam-material');
  materials.terrain.name = 'campus-terrain-material';
  materials.path.name = 'campus-path-stone-material';
  materials.record.name = 'campus-floating-record-material';
  materials.goalBeam.name = 'campus-goal-beam-material';
  const firstVistaSurface = createPlatforms(group, resources, materials);
  createRosterTower(group, resources, materials);
  createAthleticsField(group, resources, materials);
  createLibrary(group, resources, materials);
  createAdministrationTower(group, resources, materials);
  createGymnasium(group, resources, materials);
  return Object.freeze({
    dispose() {
      group.removeFromParent();
      group.clear();
      return resources.disposeAll();
    },
    getDebugState: () => Object.freeze({
      districts: CAMPUS_DISTRICTS.map(({ id }) => id),
      firstVistaSurface,
      landmarks: CAMPUS_LANDMARKS.map(({ id }) => id),
      materialRoles: [...CAMPUS_MATERIAL_ROLES],
      visibleObjects: group.children.map(({ name }) => name)
    }),
    group
  });
}
