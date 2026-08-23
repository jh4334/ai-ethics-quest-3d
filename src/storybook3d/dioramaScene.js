import * as THREE from 'three';

import { createCharacterFactory } from '../reboot/characters/factory.js';
import { createEnvironmentAssetLoader } from '../reboot/environment/loader.js';
import { createRenderer } from '../reboot/render/renderer.js';
import { createChapterLandmarks } from './landmarks.js';

function disposeProcedural(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const owned = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of owned) if (material) materials.add(material);
  });
  root.removeFromParent();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function createStars(scene) {
  const positions = [];
  for (let index = 0; index < 120; index += 1) {
    const angle = index * 2.399963;
    const radius = 8 + (index % 17) * 0.82;
    positions.push(Math.cos(angle) * radius, 4 + (index % 19) * 0.55, -8 - Math.sin(angle) * radius);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffe1a4, size: 0.055, sizeAttenuation: true }));
  scene.add(points);
  return points;
}

function tintAsset(root, accent) {
  const tint = new THREE.Color(accent);
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material?.color) continue;
      material.color.lerp(tint, 0.08);
      material.roughness = Math.max(material.roughness ?? 0.8, 0.72);
      material.metalness = Math.min(material.metalness ?? 0, 0.08);
    }
  });
}

function placeAsset(instance, spec, accent) {
  const root = instance.root;
  root.position.set(...spec.at);
  root.rotation.y = spec.ry ?? 0;
  root.scale.setScalar(spec.scale ?? 1);
  tintAsset(root, accent);
  return root;
}

export function createStorybookDiorama(canvas, { quality = 'auto', windowRef = window } = {}) {
  const renderer = createRenderer(canvas, { quality, windowRef });
  renderer.toneMappingExposure = 1.02;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x09122c);
  scene.fog = new THREE.FogExp2(0x09122c, 0.018);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  camera.position.set(0, 7.2, 12.8);
  camera.lookAt(0, 0.85, 0);

  const hemisphere = new THREE.HemisphereLight(0x9cbcff, 0x21172d, 2.1);
  const key = new THREE.DirectionalLight(0xffd18a, 2.8);
  key.position.set(-5, 9, 7);
  const fill = new THREE.PointLight(0x738cff, 16, 24, 2);
  fill.position.set(5, 4, 4);
  scene.add(hemisphere, key, fill);
  const stars = createStars(scene);

  const assetLoader = createEnvironmentAssetLoader();
  const characterFactory = createCharacterFactory();
  let previousTime = performance.now();
  let elapsed = 0;
  const assetFailures = [];
  let assetInstances = [];
  let landmarks = null;
  let player = null;
  let haru = null;
  let state = null;
  let currentChapter = null;
  let yaw = 0;
  let disposed = false;
  let transition = 1;

  async function ensureCharacters(chapterIndex) {
    if (!player) {
      try {
        player = await characterFactory.create('storybook-reader');
      } catch (error) {
        assetFailures.push(`player: ${error.message}`);
      }
    }
    if (chapterIndex === 5 && !haru) {
      try {
        haru = await characterFactory.create('storybook-haru');
      } catch (error) {
        assetFailures.push(`haru: ${error.message}`);
      }
    }
  }

  function clearChapter() {
    for (const instance of assetInstances) instance.dispose();
    assetInstances = [];
    if (landmarks) disposeProcedural(landmarks.root);
    landmarks = null;
  }

  async function setChapter(chapter, nextState) {
    if (disposed) return;
    clearChapter();
    currentChapter = chapter;
    state = nextState;
    transition = 0;
    scene.background.setHex(chapter.palette.sky);
    scene.fog.color.setHex(chapter.palette.sky);
    renderer.setClearColor(chapter.palette.sky, 1);
    landmarks = createChapterLandmarks(chapter);
    scene.add(landmarks.root);
    await ensureCharacters(nextState.chapterIndex);
    if (disposed || currentChapter !== chapter) return;
    if (player) {
      player.root.position.set(-3.3, 0.45, 1.55);
      player.root.rotation.y = 0.52;
      landmarks.root.add(player.root);
    }
    if (haru && nextState.chapterIndex === 5) {
      haru.root.position.set(2.65, 0.45, 0.1);
      haru.root.rotation.y = -0.7;
      landmarks.root.add(haru.root);
    }

    const loaded = await Promise.all(chapter.assets.map(async (spec) => {
      const instance = await assetLoader.load(spec.id);
      if (instance.isPlaceholder) assetFailures.push(spec.id);
      placeAsset(instance, spec, chapter.palette.secondary);
      return instance;
    }));
    if (disposed || currentChapter !== chapter) {
      for (const instance of loaded) instance.dispose();
      return;
    }
    assetInstances = loaded;
    landmarks.root.add(...loaded.map((instance) => instance.root));
  }

  function updateState(nextState) {
    state = nextState;
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render() {
    if (disposed) return;
    const now = performance.now();
    const delta = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    elapsed += delta;
    transition = Math.min(1, transition + delta * 2.8);
    if (landmarks && state) {
      const discoveries = state.discoveries[currentChapter.id] ?? [];
      landmarks.update(elapsed, state.spreadIndex, discoveries);
      landmarks.root.scale.y = 0.12 + transition * 0.88;
      landmarks.root.rotation.y += (yaw - landmarks.root.rotation.y) * 0.08;
    }
    player?.update(delta, { moving: false });
    haru?.update(delta, { moving: false });
    stars.rotation.y = elapsed * 0.002;
    renderer.render(scene, camera);
  }

  function clueScreenPositions() {
    if (!landmarks || !state || state.spreadIndex !== 1) return [];
    const rect = canvas.getBoundingClientRect();
    const positions = [];
    for (const [id, anchor] of landmarks.clueAnchors) {
      const projected = new THREE.Vector3();
      anchor.getWorldPosition(projected);
      projected.project(camera);
      positions.push({
        id,
        discovered: Boolean(anchor.userData.discovered),
        x: (projected.x * 0.5 + 0.5) * rect.width,
        y: (-projected.y * 0.5 + 0.5) * rect.height
      });
    }
    return positions;
  }

  function rotateBy(deltaX) {
    yaw = THREE.MathUtils.clamp(yaw + deltaX * 0.004, -0.38, 0.38);
  }

  function metrics() {
    return Object.freeze({
      assetFailures: [...assetFailures],
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles
    });
  }

  resize();
  return Object.freeze({
    clueScreenPositions,
    dispose() {
      if (disposed) return;
      disposed = true;
      clearChapter();
      characterFactory.dispose();
      assetLoader.dispose();
      stars.geometry.dispose();
      stars.material.dispose();
      renderer.dispose();
    },
    metrics,
    render,
    resize,
    rotateBy,
    setChapter,
    updateState
  });
}
