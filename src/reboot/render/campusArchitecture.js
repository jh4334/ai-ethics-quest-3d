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

function createPlatforms(group, resources, materials) {
  const platforms = [
    ['open-classroom', 14, 13, 0, 0, 3],
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
    const slab = roundedSlab(resources, width, depth, 0.34, radius, `campus-${id}-slab`);
    mesh(group, slab, materials.concrete, `campus-platform-${id}`, { x, y: -0.34, z });
    const edge = resources.register(new THREE.EdgesGeometry(slab, 24), `campus-${id}-edge`);
    const outline = new THREE.LineSegments(edge, edgeMaterial);
    outline.name = `campus-platform-edge-${id}`;
    outline.position.set(x, -0.335, z);
    group.add(outline);
    const underside = resources.register(new THREE.ConeGeometry(Math.min(width, depth) * 0.47, 5.5, 10, 1, true), `campus-${id}-underside`);
    mesh(group, underside, materials.brick, `campus-floating-foundation-${id}`, { x, y: -3.05, z }, { x: Math.PI, y: 0, z: 0 }, { x: 1, y: 1, z: depth / width });
  }
}

function createRosterTower(group, resources, materials) {
  const x = -4.6;
  const body = resources.register(new THREE.CylinderGeometry(3.1, 4.1, 9.5, 12, 1, true), 'roster-spire-body');
  mesh(group, body, materials.glass, 'central-roster-spire', { x, y: 4.7, z: -18 });
  const core = resources.register(new THREE.CylinderGeometry(0.72, 1.1, 10.8, 10), 'roster-spire-core');
  mesh(group, core, materials.metal, 'roster-spire-core', { x, y: 5.1, z: -18 });
  const ring = resources.register(new THREE.TorusGeometry(3.55, 0.12, 8, 36), 'roster-spire-ring');
  for (const y of [1.2, 4.5, 7.8]) mesh(group, ring, materials.wood, `roster-record-ring-${y}`, { x, y, z: -18 }, { x: Math.PI / 2, y: 0, z: 0 });
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
  const materials = Object.fromEntries(CAMPUS_MATERIAL_ROLES.map((role) => [
    role,
    resources.register(new THREE.MeshStandardMaterial(MATERIAL_PARAMETERS[role]), `campus-${role}-material`)
  ]));
  createPlatforms(group, resources, materials);
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
      landmarks: CAMPUS_LANDMARKS.map(({ id }) => id),
      materialRoles: [...CAMPUS_MATERIAL_ROLES],
      visibleObjects: group.children.map(({ name }) => name)
    }),
    group
  });
}
