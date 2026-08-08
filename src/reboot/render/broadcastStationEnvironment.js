import * as THREE from 'three';

import { BROADCAST_ZONES } from '../campaign/broadcastRoute.js';
import { createEnvironmentAssetLoader } from '../environment/loader.js';
import { createEmissivePathAccents, createLayeredCampusSilhouettes } from './campusEnvironmentLayers.js';
import { createDisposableRegistry } from './dispose.js';

const PLACEMENTS = Object.freeze([
  ['classroom-desk', -3.4, 0, -6.2, 1.05, 0], ['classroom-desk', 3.4, 0, -6.2, 1.05, 0],
  ['classroom-chair', -3.4, 0, -4.8, 1, Math.PI], ['classroom-chair', 3.4, 0, -4.8, 1, Math.PI],
  ['campus-column', -4.5, 0, -4, 1.3, 0], ['campus-column', 4.5, 0, -4, 1.3, 0],
  ['campus-doorway', 0, 0, -8, 1.55, 0], ['classroom-screen', 0, 1.15, -6.8, 1.2, 0],
  ['campus-column', -6.5, 0, -21, 1.25, 0], ['campus-column', 6.5, 0, -21, 1.25, 0],
  ['classroom-screen', -3.8, 1.1, -24, 1.1, Math.PI / 2], ['classroom-screen', 3.8, 1.1, -24, 1.1, -Math.PI / 2],
  ['campus-stairs', 0, 0, -34.5, 1.35, Math.PI],
  ['campus-column', -5.4, 0, -43, 1.3, 0], ['campus-column', 5.4, 0, -43, 1.3, 0],
  ['campus-column', -5.4, 0, -51, 1.3, 0], ['campus-column', 5.4, 0, -51, 1.3, 0],
  ['classroom-screen', -2.6, 1.1, -48, 1.15, Math.PI / 2], ['classroom-screen', 2.6, 1.1, -48, 1.15, -Math.PI / 2],
  ['campus-doorway', -7, 0, -60, 1.7, 0], ['campus-window', -5.5, 0.4, -80.5, 1.45, 0],
  ['campus-window', 5.5, 0.4, -80.5, 1.45, 0], ['campus-column', -9.5, 0, -70, 1.45, 0],
  ['campus-column', 9.5, 0, -70, 1.45, 0]
]);

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

function addMesh(group, geometry, material, name, position, rotation = null) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(position.x, position.y, position.z);
  if (rotation) object.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  object.castShadow = false;
  object.receiveShadow = false;
  group.add(object);
  return object;
}

function createArchitecture(resources) {
  const group = new THREE.Group();
  group.name = 'broadcast-station-architecture';
  const concrete = resources.register(new THREE.MeshStandardMaterial({ color: 0x4d607c, roughness: 0.88 }), 'broadcast-concrete');
  const metal = resources.register(new THREE.MeshStandardMaterial({
    color: 0x8ca6c4, emissive: 0x0a1524, emissiveIntensity: 0.22, metalness: 0.48, roughness: 0.34
  }), 'broadcast-metal');
  const glass = resources.register(new THREE.MeshStandardMaterial({
    color: 0x69cbe1, opacity: 0.28, roughness: 0.14, transparent: true, depthWrite: false
  }), 'broadcast-glass');
  const cyan = resources.register(new THREE.MeshStandardMaterial({
    color: 0x5de0c1, emissive: 0x155c52, emissiveIntensity: 0.86, metalness: 0.28, roughness: 0.36
  }), 'broadcast-cyan');
  const amber = resources.register(new THREE.MeshStandardMaterial({
    color: 0xf3b36c, emissive: 0x6b3515, emissiveIntensity: 0.78, metalness: 0.3, roughness: 0.4
  }), 'broadcast-amber');
  const red = resources.register(new THREE.MeshStandardMaterial({
    color: 0xd74732, emissive: 0x651b17, emissiveIntensity: 0.92, metalness: 0.34, roughness: 0.36
  }), 'broadcast-red');
  const cladding = resources.register(new THREE.MeshStandardMaterial({
    color: 0x404952, emissive: 0x080e17, emissiveIntensity: 0.2, metalness: 0.18, roughness: 0.82
  }), 'broadcast-station-cladding');

  const platforms = [
    [12, 16, -2, 2.5], [16, 24, -22, 3], [14, 24, -46, 2.4], [26, 26, -71, 4.8]
  ];
  for (const [index, [width, depth, z, radius]] of platforms.entries()) {
    const slab = resources.register(new THREE.ExtrudeGeometry(roundedShape(width, depth, radius), {
      bevelEnabled: true, bevelSegments: 2, bevelSize: 0.12, bevelThickness: 0.08, curveSegments: 6, depth: 0.3
    }), `broadcast-platform-${index}`);
    slab.rotateX(-Math.PI / 2);
    addMesh(group, slab, concrete, `broadcast-platform-${BROADCAST_ZONES[index].id}`, { x: 0, y: -0.3, z });
  }

  const entryGate = resources.register(new THREE.TorusGeometry(3.7, 0.22, 10, 48, Math.PI), 'broadcast-entry-gate');
  addMesh(group, entryGate, amber, 'entry-signal-gate', { x: 0, y: 0.1, z: -5 }, { x: 0, y: 0, z: 0 });
  const entryScanner = resources.register(new THREE.CylinderGeometry(0.55, 0.85, 3.6, 12), 'broadcast-entry-scanner');
  addMesh(group, entryScanner, metal, 'entry-signal-scanner', { x: 0, y: 1.8, z: -5 });

  const relayPylon = resources.register(new THREE.CylinderGeometry(0.55, 0.9, 4.4, 10), 'broadcast-relay-pylon');
  for (const [index, x] of [-5, -1.7, 1.7, 5].entries()) {
    addMesh(group, relayPylon, index % 2 === 0 ? cyan : amber, `protection-relay-pylon-${index}`, { x, y: 2.2, z: -24 });
  }
  const ledger = resources.register(new THREE.TorusGeometry(3.8, 0.14, 8, 40), 'broadcast-consent-ledger');
  addMesh(group, ledger, cyan, 'protection-consent-ledger', { x: 0, y: 0.18, z: -24 }, { x: Math.PI / 2, y: 0, z: 0 });

  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, 1, -41), new THREE.Vector3(-1.6, 2.8, -46),
    new THREE.Vector3(1.6, 2.1, -49), new THREE.Vector3(4.5, 1, -53)
  ]);
  const bridgeRelay = resources.register(new THREE.TubeGeometry(bridgeCurve, 54, 0.16, 8, false), 'broadcast-bridge-relay');
  addMesh(group, bridgeRelay, amber, 'transmission-dash-relays', { x: 0, y: 0, z: 0 });
  const bridgeShell = resources.register(new THREE.CylinderGeometry(5.2, 5.2, 12, 14, 1, true), 'broadcast-bridge-shell');
  addMesh(group, bridgeShell, glass, 'transmission-glass-bridge', { x: 0, y: 2.5, z: -47 }, { x: Math.PI / 2, y: 0, z: 0 });

  const core = resources.register(new THREE.SphereGeometry(2.5, 24, 16), 'broadcast-signal-core');
  addMesh(group, core, red, 'broadcast-signal-core', { x: 0, y: 3.2, z: -75 });
  const coreRing = resources.register(new THREE.TorusGeometry(4.3, 0.22, 10, 52), 'broadcast-core-ring');
  for (const [index, y] of [1.2, 3.2, 5.2].entries()) {
      addMesh(group, coreRing, index === 1 ? red : metal, `broadcast-core-ring-${index}`, { x: 0, y, z: -75 }, { x: Math.PI / 2, y: 0, z: 0 });
  }

  const antennaCrown = new THREE.Group();
  antennaCrown.name = 'broadcast-antenna-crown';
  group.add(antennaCrown);
  const antenna = resources.register(new THREE.CylinderGeometry(0.18, 0.52, 7.2, 9), 'broadcast-antenna-mast');
  for (let index = 0; index < 8; index += 1) {
    const angle = Math.PI / 8 + index * Math.PI / 4;
    addMesh(antennaCrown, antenna, cladding, `broadcast-antenna-mast-${index}`, {
      x: Math.sin(angle) * (9 + (index % 2) * 1.5), y: 3.6 + (index % 3) * 0.7, z: -74 + Math.cos(angle) * 9
    });
  }
  const dish = resources.register(new THREE.SphereGeometry(0.82, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), 'broadcast-signal-dish');
  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    addMesh(antennaCrown, dish, index % 2 ? amber : cyan, `broadcast-signal-dish-${index}`, {
      x: Math.sin(angle) * 11, y: 4 + (index % 2) * 1.2, z: -74 + Math.cos(angle) * 10
    }, { x: Math.PI / 2, y: -angle, z: 0 });
  }
  const onAirHalo = resources.register(new THREE.TorusKnotGeometry(2.2, 0.12, 64, 8, 2, 3), 'broadcast-on-air-halo');
  addMesh(antennaCrown, onAirHalo, red, 'broadcast-on-air-halo', { x: 0, y: 7.4, z: -75 });

  const beacons = BROADCAST_ZONES.map((zone, index) => {
    const geometry = resources.register(new THREE.TorusGeometry(0.86, 0.07, 8, 28), `broadcast-beacon-${index}`);
    const beacon = addMesh(group, geometry, index % 2 === 0 ? amber : cyan, `broadcast-zone-beacon-${zone.id}`, {
      x: 0, y: 0.12, z: zone.anchorZ
    }, { x: Math.PI / 2, y: 0, z: 0 });
    beacon.visible = index === 0;
    return beacon;
  });
  return { beacons, cladding, concrete, group, stationIdentityMeshes: antennaCrown.children.length };
}

export function createBroadcastStationEnvironment({ assetLoader = createEnvironmentAssetLoader(), scene } = {}) {
  if (!scene?.isScene) throw new TypeError('방송국 장면이 필요합니다.');
  const resources = createDisposableRegistry();
  const architecture = createArchitecture(resources);
  const group = new THREE.Group();
  group.name = 'broadcast-station-environment';
  group.add(architecture.group);
  const assetRoot = new THREE.Group();
  assetRoot.name = 'broadcast-station-glb-assets';
  group.add(assetRoot);
  scene.add(group);
  const atmosphere = createLayeredCampusSilhouettes({
    centerZ: -41, colors: [0x25334b, 0x17283d, 0x0d172a], group,
    prefix: 'broadcast-station', resources, spanZ: 86
  });
  const accents = createEmissivePathAccents({
    colors: [0xf3b36c, 0x5de0c1, 0xd74732], group,
    points: BROADCAST_ZONES.flatMap((zone) => [-3.2, 0, 3.2].map((offset, index) => ({
      x: (index - 1) * 0.76, y: 0, z: zone.anchorZ + offset
    }))),
    prefix: 'broadcast-station', resources
  });
  const failures = [];
  let disposed = false;
  const assetIds = [...new Set(PLACEMENTS.map(([id]) => id))];
  const materialPromise = Promise.all([
    ['structural-concrete', architecture.concrete], ['road-asphalt', architecture.cladding]
  ].map(async ([materialId, target]) => {
    const loaded = await assetLoader.loadMaterial(materialId);
    if (loaded.isPlaceholder) failures.push(materialId);
    if (disposed) return;
    architecture.group.traverse((object) => {
      if (object.isMesh && object.material === target) object.material = loaded.material;
    });
  }));
  const assetPromise = Promise.all(assetIds.map(async (assetId) => {
    const loaded = await assetLoader.load(assetId);
    if (loaded.isPlaceholder) failures.push(assetId);
    if (disposed) return;
    for (const [index, entry] of PLACEMENTS.filter(([id]) => id === assetId).entries()) {
      const [, x, y, z, scale, rotationY] = entry;
      const root = loaded.root.clone(true);
      root.name = `broadcast-asset-${assetId}-${index}`;
      root.position.set(x, y, z);
      root.rotation.y = rotationY;
      root.scale.setScalar(scale);
      root.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = false;
        object.receiveShadow = false;
      });
      assetRoot.add(root);
    }
  }));
  const ready = Promise.all([assetPromise, materialPromise]).then(() => Object.freeze({
    failedAssetIds: Object.freeze([...failures]), placedInstances: PLACEMENTS.length
  }));

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      resources.disposeAll();
      assetLoader.dispose();
    },
    getDebugState: () => Object.freeze({
      assetInstances: assetRoot.children.length,
      atmosphericLayers: atmosphere.layerCount,
      emissiveAccents: accents.accentCount,
      failedAssetIds: Object.freeze([...failures]),
      landmarkIds: Object.freeze(BROADCAST_ZONES.map(({ landmarkId }) => landmarkId)),
      pbrArchitectureMeshes: 12,
      stationIdentityMeshes: architecture.stationIdentityMeshes,
      status: assetRoot.children.length > 0 ? 'ready' : 'loading',
      zoneCount: BROADCAST_ZONES.length
    }),
    group,
    ready,
    setActiveZone(index) {
      architecture.beacons.forEach((beacon, beaconIndex) => { beacon.visible = beaconIndex === index; });
    }
  });
}
