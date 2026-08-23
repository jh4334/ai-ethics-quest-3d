import * as THREE from 'three';

import { createCharacterFactory } from '../reboot/characters/factory.js';
import { createEnvironmentAssetLoader } from '../reboot/environment/loader.js';
import { createRenderer } from '../reboot/render/renderer.js';
import { getAdventureZone } from './adventureContent.js';

function addMesh(parent, geometry, material, at = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...at);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function disposeRoot(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) if (material) materials.add(material);
  });
  root.removeFromParent();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function materialsFor(zone) {
  const toon = (color, emissive = 0x000000, intensity = 0) => new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: intensity });
  return {
    accent: toon(zone.accent, zone.accent, 0.35),
    paper: toon(0xeadfc5),
    path: toon(zone.path),
    ground: toon(zone.ground),
    ink: toon(0x17152b, 0x381644, 0.18),
    inkEye: toon(0xffd681, 0xff9e3d, 0.6),
    leaf: toon(0x72b89a, 0x174f4a, 0.18),
    stone: toon(0x514a66),
    gate: toon(0x342d4e),
    water: new THREE.MeshStandardMaterial({ color: 0x15284a, emissive: 0x08122d, emissiveIntensity: 0.4, roughness: 0.38, metalness: 0.08 })
  };
}

function createInkCreature(materials, scale = 1) {
  const root = new THREE.Group();
  addMesh(root, new THREE.DodecahedronGeometry(0.38 * scale, 1), materials.ink, [0, 0.48 * scale, 0]);
  for (const x of [-0.13, 0.13]) addMesh(root, new THREE.SphereGeometry(0.045 * scale, 8, 6), materials.inkEye, [x * scale, 0.53 * scale, 0.32 * scale]);
  for (let index = 0; index < 5; index += 1) {
    const angle = index * Math.PI * 2 / 5;
    const leg = addMesh(root, new THREE.ConeGeometry(0.09 * scale, 0.42 * scale, 6), materials.ink, [Math.cos(angle) * 0.3 * scale, 0.2 * scale, Math.sin(angle) * 0.3 * scale]);
    leg.rotation.z = Math.cos(angle) * 0.45;
  }
  return root;
}

function addGate(root, materials, zone) {
  const gate = new THREE.Group();
  gate.name = 'memory-gate';
  gate.position.set(zone.gate.x, 0, zone.gate.z);
  for (const x of [-1.35, 1.35]) addMesh(gate, new THREE.CylinderGeometry(0.24, 0.32, 2.7, 8), materials.gate, [x, 1.35, 0]);
  addMesh(gate, new THREE.TorusGeometry(1.35, 0.22, 8, 24, Math.PI), materials.accent, [0, 1.35, 0], [0, 0, 0]);
  const bars = new THREE.Group();
  bars.name = 'gate-bars';
  for (let index = -2; index <= 2; index += 1) addMesh(bars, new THREE.CylinderGeometry(0.045, 0.045, 2, 6), materials.gate, [index * 0.42, 1, 0]);
  gate.add(bars);
  root.add(gate);
  return { gate, bars };
}

function addChapterLandmark(root, materials, chapterIndex) {
  const landmark = new THREE.Group();
  landmark.position.set(-5.8, 0.2, 2.8);
  if (chapterIndex === 0) {
    addMesh(landmark, new THREE.CylinderGeometry(0.7, 0.9, 2.7, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xf2a44d, emissiveIntensity: 0.7, transparent: true, opacity: 0.44, side: THREE.DoubleSide }), [0, 1.35, 0]);
  } else if (chapterIndex === 1) {
    addMesh(landmark, new THREE.CylinderGeometry(0.42, 0.65, 3.1, 9), materials.ground, [0, 1.55, 0], [0, 0, -0.1]);
    addMesh(landmark, new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8), materials.accent, [0, 2.8, 0], [0, 0, Math.PI / 2]);
  } else if (chapterIndex === 2) {
    for (let index = 0; index < 9; index += 1) {
      const angle = index * Math.PI * 2 / 9;
      addMesh(landmark, new THREE.IcosahedronGeometry(0.18, 0), materials.accent, [Math.cos(angle) * 1.4, 0.8 + index % 3 * 0.35, Math.sin(angle) * 1.4]);
    }
  } else if (chapterIndex === 3) {
    for (let index = 0; index < 7; index += 1) {
      const bird = addMesh(landmark, new THREE.ConeGeometry(0.16, 0.5, 3), materials.paper, [-1.2 + index * 0.4, 1 + index % 2 * 0.4, 0], [Math.PI / 2, 0, index % 2 ? 0.5 : -0.5]);
      bird.userData.float = index;
    }
  } else if (chapterIndex === 4) {
    for (let index = 0; index < 3; index += 1) addMesh(landmark, new THREE.TorusGeometry(0.55 + index * 0.2, 0.12, 8, 14), materials.accent, [0, 0.8 + index * 0.68, 0], [0, Math.PI / 2, 0]).userData.gear = index % 2 ? -1 : 1;
  } else {
    for (let index = 0; index < 16; index += 1) addMesh(landmark, new THREE.SphereGeometry(0.055, 8, 6), materials.accent, [-1.6 + index % 8 * 0.45, 0.8 + Math.floor(index / 8) * 0.7, 0]).userData.float = index;
  }
  root.add(landmark);
  return landmark;
}

function createZoneVisual(chapter, adventure) {
  const zone = getAdventureZone(adventure.chapterIndex);
  const root = new THREE.Group();
  root.name = `adventure-zone-${adventure.chapterIndex + 1}`;
  const materials = materialsFor(zone);
  addMesh(root, new THREE.CircleGeometry(36, 48), materials.water, [0, -0.72, 0], [-Math.PI / 2, 0, 0]);
  const island = addMesh(root, new THREE.CylinderGeometry(9.5, 10.2, 0.7, 32), materials.ground, [0, -0.35, 0]);
  island.scale.z = 0.72;
  for (let z = 4.4; z >= -4.6; z -= 0.85) addMesh(root, new THREE.CylinderGeometry(0.6, 0.72, 0.12, 7), materials.path, [Math.sin(z * 1.1) * 0.18, 0.08, z]);
  for (const x of [-7.3, 7.3]) {
    for (let z = -3.8; z <= 4; z += 2.2) {
      addMesh(root, new THREE.ConeGeometry(0.72, 1.7, 7), materials.ground, [x, 0.7, z]);
      addMesh(root, new THREE.ConeGeometry(0.42, 1.2, 7), materials.leaf, [x, 1.75, z]);
    }
  }
  addChapterLandmark(root, materials, adventure.chapterIndex);
  const clueObjects = new Map();
  for (const [index, clue] of zone.clues.entries()) {
    const clueRoot = new THREE.Group();
    clueRoot.position.set(clue.x, 0.25, clue.z);
    addMesh(clueRoot, index === 0 ? new THREE.OctahedronGeometry(0.28, 0) : new THREE.IcosahedronGeometry(0.3, 1), materials.accent, [0, 0.45, 0]);
    addMesh(clueRoot, new THREE.TorusGeometry(0.48, 0.045, 8, 28), materials.accent, [0, 0.05, 0], [Math.PI / 2, 0, 0]);
    root.add(clueRoot);
    clueObjects.set(clue.id, clueRoot);
  }
  const sigilObjects = zone.sigils.map((sigil, index) => {
    const group = new THREE.Group();
    group.position.set(sigil.x, 0.08, sigil.z);
    addMesh(group, new THREE.TorusGeometry(0.62, 0.09, 8, 28), materials.stone, [0, 0, 0], [Math.PI / 2, 0, 0]);
    addMesh(group, new THREE.TetrahedronGeometry(0.22, 0), materials.accent, [0, 0.18, 0], [0, index * Math.PI / 2, 0]);
    root.add(group);
    return group;
  });
  const key = new THREE.Group();
  key.position.set(zone.key.x, 0.8, zone.key.z);
  addMesh(key, new THREE.TorusGeometry(0.25, 0.07, 8, 22), materials.accent, [0, 0, 0], [Math.PI / 2, 0, 0]);
  addMesh(key, new THREE.BoxGeometry(0.1, 0.1, 0.62), materials.accent, [0, 0, 0.42]);
  root.add(key);
  const { gate, bars } = addGate(root, materials, zone);
  const enemies = new Map();
  for (const enemy of adventure.enemies) {
    const creature = createInkCreature(materials, 1);
    creature.position.set(enemy.x, 0, enemy.z);
    root.add(creature);
    enemies.set(enemy.id, creature);
  }
  const boss = createInkCreature(materials, 2.15);
  boss.position.set(zone.boss.x, 0, zone.boss.z);
  root.add(boss);
  return { root, materials, clueObjects, sigilObjects, key, gate, bars, enemies, boss };
}

export function createStorybookAdventureScene(canvas, { quality = 'auto', windowRef = window } = {}) {
  const renderer = createRenderer(canvas, { quality, windowRef });
  renderer.toneMappingExposure = 0.92;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
  scene.add(new THREE.HemisphereLight(0xaac8ff, 0x251936, 2.25));
  const moon = new THREE.DirectionalLight(0xffd39b, 2.6);
  moon.position.set(-6, 12, 8);
  const fill = new THREE.PointLight(0x667dff, 15, 25, 2);
  fill.position.set(6, 5, 5);
  scene.add(moon, fill);
  const assetLoader = createEnvironmentAssetLoader();
  const characterFactory = createCharacterFactory();
  const assetFailures = [];
  let visual = null;
  let player = null;
  let assets = [];
  let currentChapter = null;
  let state = null;
  let elapsed = 0;
  let disposed = false;
  const lastPlayer = new THREE.Vector3();
  const blade = new THREE.Group();
  const guard = new THREE.Group();
  const bladeMaterial = new THREE.MeshToonMaterial({ color: 0xf2bc61, emissive: 0xf2bc61, emissiveIntensity: 0.35 });
  const guardMaterial = new THREE.MeshToonMaterial({ color: 0x72b89a, emissive: 0x174f4a, emissiveIntensity: 0.18 });

  async function setChapter(chapter, adventure) {
    if (visual) disposeRoot(visual.root);
    for (const instance of assets) instance.dispose();
    assets = [];
    currentChapter = chapter;
    state = adventure;
    const zone = getAdventureZone(adventure.chapterIndex);
    scene.background = new THREE.Color(chapter.palette.sky);
    scene.fog = new THREE.Fog(chapter.palette.sky, 20, 42);
    renderer.setClearColor(chapter.palette.sky, 1);
    visual = createZoneVisual(chapter, adventure);
    scene.add(visual.root);
    if (!player) {
      try {
        player = await characterFactory.create('storybook-reader');
        player.root.scale.setScalar(1.2);
        scene.add(player.root);
        addMesh(blade, new THREE.CylinderGeometry(0.045, 0.075, 1.45, 8), bladeMaterial, [0, 0.62, 0], [Math.PI / 2, 0, 0]);
        addMesh(guard, new THREE.CircleGeometry(0.48, 16), guardMaterial, [0, 0.7, 0], [0, 0, 0]);
        scene.add(blade, guard);
      } catch (error) {
        assetFailures.push(`player:${error.message}`);
      }
    }
    updateState(adventure);
    camera.position.set(zone.start.x + 7.5, 10.5, zone.start.z + 8.5);
    camera.lookAt(zone.start.x, 0, zone.start.z - 1.2);
    const targetVisual = visual;
    const decorationSpecs = quality === 'low' ? [] : chapter.assets.slice(0, 4);
    Promise.all(decorationSpecs.map(async (spec, index) => {
      const instance = await assetLoader.load(spec.id);
      if (instance.isPlaceholder) assetFailures.push(spec.id);
      const angle = index * Math.PI * 2 / 4 + 0.5;
      instance.root.position.set(Math.cos(angle) * 6.2, 0, Math.sin(angle) * 4.1);
      instance.root.rotation.y = -angle;
      instance.root.scale.setScalar((spec.scale ?? 1) * 0.9);
      return instance;
    })).then((loaded) => {
      if (disposed || currentChapter !== chapter) {
        for (const instance of loaded) instance.dispose();
        return;
      }
      assets = loaded;
      if (loaded.length) targetVisual.root.add(...loaded.map((instance) => instance.root));
    }).catch((error) => assetFailures.push(`decorations:${error.message}`));
  }

  function updateState(adventure) {
    state = adventure;
    if (!visual) return;
    if (player) {
      player.root.position.set(adventure.player.x, 0, adventure.player.z);
      player.root.rotation.y = Math.atan2(adventure.player.facingX, adventure.player.facingZ);
    }
    for (const [id, object] of visual.clueObjects) object.visible = !adventure.clues.includes(id);
    visual.sigilObjects.forEach((object, index) => object.scale.setScalar(adventure.sigils.includes(`sigil-${index + 1}`) ? 1.22 : 1));
    visual.key.visible = adventure.puzzleSolved && adventure.clues.length === 2 && !adventure.hasKey;
    visual.bars.visible = !adventure.gateOpen;
    for (const enemy of adventure.enemies) visual.enemies.get(enemy.id).visible = !enemy.defeated;
    visual.boss.visible = adventure.boss.active && !adventure.boss.defeated;
    blade.visible = adventure.attackPulse > 0;
    guard.visible = adventure.guarding;
    const angle = Math.atan2(adventure.player.facingX, adventure.player.facingZ);
    for (const object of [blade, guard]) {
      object.position.set(adventure.player.x, 0, adventure.player.z);
      object.rotation.y = angle;
    }
    blade.rotation.x = adventure.attackPulse > 0 ? -0.55 : 0;
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(delta = 1 / 60) {
    if (!state || disposed) return;
    elapsed += delta;
    const target = new THREE.Vector3(state.player.x + 7.5, 10.5, state.player.z + 8.5);
    camera.position.lerp(target, Math.min(1, delta * 5.5));
    camera.lookAt(state.player.x, 0.55, state.player.z - 1.4);
    const moved = lastPlayer.distanceToSquared(new THREE.Vector3(state.player.x, 0, state.player.z)) > 0.0001;
    lastPlayer.set(state.player.x, 0, state.player.z);
    player?.update(delta, { moving: moved });
    if (visual) {
      visual.key.rotation.y = elapsed * 1.6;
      visual.key.position.y = 0.8 + Math.sin(elapsed * 2.2) * 0.12;
      visual.boss.rotation.y = Math.sin(elapsed * 0.8) * 0.16;
      visual.root.traverse((object) => {
        if (object.userData.float !== undefined) object.position.y += Math.sin(elapsed * 1.8 + object.userData.float) * 0.0006;
        if (object.userData.gear) object.rotation.z = elapsed * 0.4 * object.userData.gear;
      });
    }
    renderer.render(scene, camera);
  }

  function metrics() {
    return Object.freeze({ assetFailures: [...assetFailures], drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
  }

  resize();
  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      if (visual) disposeRoot(visual.root);
      for (const instance of assets) instance.dispose();
      disposeRoot(blade);
      disposeRoot(guard);
      characterFactory.dispose();
      assetLoader.dispose();
      renderer.dispose();
    },
    metrics,
    render,
    resize,
    setChapter,
    updateState
  });
}
