import * as THREE from 'three';

import { createDualSchoolState, stepDualSchool } from '../campaign/dualSchool.js';
import { createCharacterFactory } from '../characters/factory.js';
import { chapterThreeLevel } from '../content/levels/chapter3.js';
import { getSceneViewport } from './schoolSceneCamera.js';
import { createDisposableRegistry } from './dispose.js';
import { createCampaignLandmarks } from './campaignLandmarks.js';
import { createSchoolRoute } from './schoolRoute.js';

const CAST = Object.freeze([
  Object.freeze({ id: 'player', key: 'player', position: [0, 0, -17.5], rotation: Math.PI }),
  Object.freeze({ id: 'recommender', key: 'recommender-comfort', position: [-3.2, 0, -23], rotation: 0 }),
  Object.freeze({ id: 'recommender', key: 'recommender-verified', position: [3.2, 0, -23], rotation: 0 })
]);

function createLayerMesh(geometry, material, x) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, 0.015, -22);
  mesh.scale.set(9.7, 0.03, 23.5);
  return mesh;
}

export function createDualSchoolPreviewScene({
  canvas, initialLayer = 'comfort', input, renderer, ui = {}, windowRef = window
}) {
  if (!['comfort', 'verified'].includes(initialLayer)) throw new RangeError('두 학교 미리보기 층이 올바르지 않습니다.');
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050918, 30, 70);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 5.6, -10.5);
  camera.lookAt(0, 0.7, -22.5);

  const route = resources.register(createSchoolRoute({ level: chapterThreeLevel, lightLimit: 0, scene }), 'dual-route');
  const landmarks = resources.register(createCampaignLandmarks({ scene, type: 'dual-school' }), 'dual-landmarks');
  const factory = resources.register(createCharacterFactory(), 'dual-cast');
  const geometry = resources.register(new THREE.BoxGeometry(1, 1, 1), 'dual-floor-geometry');
  const comfortMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0xc56b8f, emissive: 0x5d173a, emissiveIntensity: 0.9, transparent: true
  }), 'comfort-floor-material');
  const verifiedMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0x35b8c7, emissive: 0x0d536b, emissiveIntensity: 0.95, transparent: true
  }), 'verified-floor-material');
  const markerMaterial = resources.register(new THREE.MeshBasicMaterial({ color: 0xf4c06d }), 'layer-marker-material');
  const comfortFloor = createLayerMesh(geometry, comfortMaterial, -5.05);
  const verifiedFloor = createLayerMesh(geometry, verifiedMaterial, 5.05);
  const marker = new THREE.Mesh(geometry, markerMaterial);
  marker.scale.set(2.5, 0.06, 2.5);
  marker.position.y = 0.08;
  const castRoot = new THREE.Group();
  castRoot.name = 'dual-school-character-cast';
  scene.add(comfortFloor, verifiedFloor, marker, castRoot);
  scene.add(new THREE.HemisphereLight(0xbfd3ff, 0x31162b, 3.1));
  const characterFill = new THREE.PointLight(0xffdcc0, 3.4, 34, 1.8);
  characterFill.position.set(0, 6, -17);
  characterFill.castShadow = false;
  scene.add(characterFill);

  const anchors = new Map();
  const characters = new Map();
  const errors = [];
  let state = createDualSchoolState();
  if (initialLayer === 'verified') state = stepDualSchool(state, { type: 'switch-layer' }).state;
  let entered = false;
  let unsubscribeInput = null;

  for (const entry of CAST) {
    const anchor = new THREE.Group();
    anchor.name = `dual-anchor-${entry.key}`;
    anchor.position.set(...entry.position);
    anchor.rotation.y = entry.rotation;
    castRoot.add(anchor);
    anchors.set(entry.key, anchor);
  }

  function resize() {
    const viewport = getSceneViewport(canvas);
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height, false);
  }

  function syncPresentation() {
    const comfortActive = state.activeLayer === 'comfort';
    comfortMaterial.opacity = comfortActive ? 0.86 : 0.2;
    verifiedMaterial.opacity = comfortActive ? 0.2 : 0.86;
    marker.position.set(comfortActive ? -3.2 : 3.2, 0.08, -23);
    scene.background = new THREE.Color(comfortActive ? 0x180b1d : 0x061923);
    canvas.dataset.dualSchoolLayer = state.activeLayer;
    canvas.dataset.characters = errors.length > 0 ? 'error' : characters.size === CAST.length ? 'ready' : 'loading';
    if (ui.objective) ui.objective.textContent = comfortActive
      ? '편안한 현실 — E로 검증된 현실을 겹쳐 보세요'
      : '검증된 현실 — 반대편 추천자의 약점을 확인하세요';
    if (ui.enemy) ui.enemy.textContent = `RECOMMENDER ${state.activeLayer.toUpperCase()}`;
    if (ui.action) ui.action.textContent = 'E  현실 전환';
    if (ui.chain) ui.chain.textContent = '두 학교 동기화';
  }

  function queueAction({ action, active }) {
    if (!active) return;
    if (action === 'trace') state = stepDualSchool(state, { type: 'switch-layer' }).state;
    if (action === 'attack' || action === 'secure') {
      state = stepDualSchool(state, {
        amount: 20,
        enemyId: `recommender-${state.activeLayer}`,
        type: 'damage-enemy'
      }).state;
    }
    syncPresentation();
  }

  async function loadCast() {
    // 완료 순서가 아니라 저작(CAST) 순서로 삽입한다 — characterIds 관측이 결정적이 되게.
    const loaded = await Promise.all(CAST.map(async (entry) => {
      try {
        const character = await factory.create(entry.id);
        if (!entered) {
          character.dispose();
          return null;
        }
        return { character, entry };
      } catch (error) {
        if (entered) errors.push(`${entry.key}: ${error.message}`);
        return null;
      }
    }));
    for (const item of loaded) {
      if (!item) continue;
      anchors.get(item.entry.key).add(item.character.root);
      characters.set(item.entry.key, item.character);
    }
    if (entered) syncPresentation();
  }

  return Object.freeze({
    dispose() {
      unsubscribeInput?.();
      castRoot.removeFromParent();
      comfortFloor.removeFromParent();
      verifiedFloor.removeFromParent();
      marker.removeFromParent();
      resources.disposeAll();
    },
    enter() {
      if (entered) return;
      entered = true;
      resize();
      unsubscribeInput = input.subscribe(queueAction);
      windowRef.addEventListener('resize', resize);
      syncPresentation();
      loadCast();
    },
    exit() {
      if (!entered) return;
      entered = false;
      unsubscribeInput?.();
      unsubscribeInput = null;
      windowRef.removeEventListener('resize', resize);
    },
    getDebugState() {
      return Object.freeze({
        activeLayer: state.activeLayer,
        characterErrors: Object.freeze([...errors]),
        characterIds: Object.freeze([...characters.keys()]),
        enemies: state.enemies,
        landmarks: landmarks.getDebugState(),
        route: route.getDebugState()
      });
    },
    update(delta) {
      for (const character of characters.values()) character.update(delta, {});
      renderer.render(scene, camera);
    }
  });
}
