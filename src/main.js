import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  ETHICS_TOPICS,
  FINAL_CORE_MISSION,
  SHRINES,
  WORLD_ZONES,
  applyShrineResult,
  canUnlockFinalCore,
  completeFinalCore,
  createInitialProgress,
  getExtraShrineQuestions,
  getLearningReport,
  getNextObjective,
  getProgressSummary,
  getShrineById,
  getTopicById,
  normalizeProgress,
  recordLearningVisit,
  recordPracticeChoice
} from './worldData.js';

const APP_MARKER = 'AI Ethics Quest 3D';
const STORAGE_KEY = 'ai-ethics-quest-3d/progress/v1';
const PLAYER_START = new THREE.Vector3(0, 0.55, 8.5);
const ISLAND_RADIUS = 12.1;
const INTERACTION_RADIUS = 2.25;
const CORE_RADIUS = 2.8;
const clock = new THREE.Clock();

let activeQuest = null;

export function initEthicsQuest3D(root = document.querySelector('#app')) {
  if (!root) {
    throw new Error('AI Ethics Quest 3D root element not found');
  }

  root.dataset.appMarker = APP_MARKER;
  root.innerHTML = createShell();

  const canvas = root.querySelector('[data-game-canvas]');
  const ui = bindUi(root);
  const game = createGameState(ui);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    showRendererFallback(ui, error);
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 180);
  const renderState = {
    renderer,
    scene,
    camera,
    playerGroup: new THREE.Group(),
    interactables: [],
    shrineCrystals: new Map(),
    coreCrystal: null,
    coreGlow: null,
    composer: null,
    animated: []
  };

  configureRenderer(renderer);
  createWorld(renderState);
  createPlayer(renderState);
  scene.add(renderState.playerGroup);
  setupPostProcessing(renderState, root);

  const cleanupInput = bindInput(game, ui);
  bindHudActions(game, ui, renderState);

  resize(renderer, camera, root, renderState.composer);
  updateHud(game, ui);
  updateCoreVisual(game, renderState);

  let animationId = 0;
  const onResize = () => resize(renderer, camera, root, renderState.composer);
  const onVisibilityChange = () => {
    game.paused = document.hidden || !ui.dialog.hidden;
  };

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    game.paused = true;
    ui.prompt.textContent = '그래픽 화면이 잠시 멈췄어요. 새로고침하면 다시 시작할 수 있어요.';
    ui.prompt.hidden = false;
  });

  function frame() {
    animationId = window.requestAnimationFrame(frame);
    const delta = Math.min(clock.getDelta(), 0.04);
    if (!game.paused) {
      updateGame(delta, game, renderState, ui);
    }
    updateAmbient(delta, renderState);
    if (renderState.composer) {
      renderState.composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  frame();

  return {
    marker: APP_MARKER,
    destroy() {
      window.cancelAnimationFrame(animationId);
      cleanupInput();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.dispose();
      root.innerHTML = '';
    }
  };
}

function createShell() {
  return `
    <main class="quest-shell" data-app-marker="${APP_MARKER}">
      <canvas class="quest-canvas" data-game-canvas aria-label="AI 윤리의 섬 3D 게임 화면"></canvas>

      <section class="objective-chip" aria-live="polite">
        <p class="eyebrow">AI 윤리의 섬</p>
        <h1>알고리즘의 신전</h1>
        <p data-objective>사당을 찾아 윤리 조각을 모으세요.</p>
      </section>

      <section class="status-strip" aria-label="진행 상황">
        <strong data-fragment-count>조각 0/4</strong>
        <span data-core-status>AI 코어 잠김</span>
        <div class="fragment-row" data-fragment-row></div>
      </section>

      <button class="journal-toggle" type="button" data-journal-toggle aria-expanded="false">
        기록
      </button>

      <aside class="journal-panel" data-journal hidden>
        <div class="panel-heading">
          <div>
            <p class="eyebrow">수업 기록</p>
            <h2>탐험 노트</h2>
          </div>
          <button type="button" data-close-journal aria-label="탐험 노트 닫기">닫기</button>
        </div>
        <div data-journal-content></div>
      </aside>

      <section class="class-hint" aria-label="수업 안내">
        <span>1차시: 탐험과 개념</span>
        <span>2차시: AI 코어 토론</span>
      </section>

      <div class="interaction-prompt" data-prompt hidden></div>

      <div class="touch-controls" aria-label="터치 이동">
        <button type="button" data-touch="up" aria-label="위로 이동">▲</button>
        <button type="button" data-touch="left" aria-label="왼쪽 이동">◀</button>
        <button type="button" data-touch="action" aria-label="상호작용">E</button>
        <button type="button" data-touch="right" aria-label="오른쪽 이동">▶</button>
        <button type="button" data-touch="down" aria-label="아래로 이동">▼</button>
      </div>

      <section class="dialog-panel" data-dialog hidden aria-live="polite">
        <div class="panel-heading">
          <div>
            <p class="eyebrow" data-dialog-kicker>학습</p>
            <h2 data-dialog-title>대화</h2>
          </div>
          <button type="button" data-dialog-close aria-label="닫기">닫기</button>
        </div>
        <div data-dialog-body></div>
      </section>
    </main>
  `;
}

function bindUi(root) {
  return {
    root,
    objective: root.querySelector('[data-objective]'),
    fragmentCount: root.querySelector('[data-fragment-count]'),
    coreStatus: root.querySelector('[data-core-status]'),
    fragmentRow: root.querySelector('[data-fragment-row]'),
    prompt: root.querySelector('[data-prompt]'),
    dialog: root.querySelector('[data-dialog]'),
    dialogKicker: root.querySelector('[data-dialog-kicker]'),
    dialogTitle: root.querySelector('[data-dialog-title]'),
    dialogBody: root.querySelector('[data-dialog-body]'),
    dialogClose: root.querySelector('[data-dialog-close]'),
    journal: root.querySelector('[data-journal]'),
    journalToggle: root.querySelector('[data-journal-toggle]'),
    journalClose: root.querySelector('[data-close-journal]'),
    journalContent: root.querySelector('[data-journal-content]'),
    touchButtons: [...root.querySelectorAll('[data-touch]')]
  };
}

function loadStoredProgress() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialProgress();
    }
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return createInitialProgress();
  }
}

function persistProgress(progress) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // 사생활 모드 등 저장이 막힌 환경에서는 세션 안에서만 진행을 유지한다.
  }
}

function clearStoredProgress() {
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // 저장소가 없으면 지울 것도 없다.
  }
}

function createGameState(ui) {
  return {
    progress: loadStoredProgress(),
    player: {
      position: PLAYER_START.clone(),
      direction: new THREE.Vector3(0, 0, 1),
      speed: 5.2
    },
    keys: new Set(),
    nearest: null,
    paused: false,
    ui
  };
}

function configureRenderer(renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x8fd3ef, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 밝고 쨍한 판타지 톤: ACES 필름 톤매핑 + 약간 높은 노출로 색을 살린다.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
}

function setupPostProcessing(renderState, root) {
  const { renderer, scene, camera } = renderState;
  const width = Math.max(root.clientWidth, 320);
  const height = Math.max(root.clientHeight, 360);

  let composer;
  try {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    // 발광 크리스털·코어가 은은하게 빛나도록 블룸을 얹는다(저사양 고려해 약하게).
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.85, 0.72);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    renderState.composer = composer;
    renderState.bloomPass = bloom;
  } catch (error) {
    // 후처리를 못 쓰는 환경이면 기본 렌더로 조용히 폴백한다.
    renderState.composer = null;
  }
}

function updateAmbient(delta, renderState) {
  const elapsed = clock.elapsedTime;
  for (const item of renderState.animated) {
    item.update(elapsed, delta);
  }
}

function createWorld(renderState) {
  const { scene, interactables, shrineCrystals, animated } = renderState;
  // 색을 살리기 위해 안개는 아주 옅게, 먼 배경만 살짝 감싸도록.
  scene.fog = new THREE.Fog(0x9fd9f5, 34, 88);

  createSky(scene, animated);

  // 밝은 하늘빛 + 따뜻한 반사광의 반구광으로 색을 쨍하게 띄운다.
  const hemiLight = new THREE.HemisphereLight(0xdff3ff, 0x6f8f66, 2.1);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xfff0d0, 2.7);
  sun.position.set(-13, 20, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // 반대쪽에서 들어오는 청록 림 라이트로 판타지 느낌의 입체감을 준다.
  const rim = new THREE.DirectionalLight(0x5ad2ff, 0.7);
  rim.position.set(11, 7, -12);
  scene.add(rim);

  createStylizedWater(scene, animated);

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 11.2, 0.92, 96),
    new THREE.MeshStandardMaterial({ color: 0x86c26a, roughness: 0.92 })
  );
  island.position.y = -0.18;
  island.receiveShadow = true;
  island.castShadow = true;
  scene.add(island);

  const beach = new THREE.Mesh(
    new THREE.TorusGeometry(12.15, 0.34, 12, 128),
    new THREE.MeshStandardMaterial({ color: 0xf0dc98, roughness: 0.85 })
  );
  beach.rotation.x = Math.PI / 2;
  beach.position.y = 0.08;
  scene.add(beach);

  createGrassField(scene);

  createCenterCore(scene, animated);

  for (const zone of WORLD_ZONES) {
    const zonePosition = new THREE.Vector3(...zone.position);
    createPath(scene, zonePosition);
    createZone(scene, zone, zonePosition);
    createNpc(scene, zone, zonePosition, interactables);
    const shrineCrystal = createShrine(scene, zone, zonePosition, interactables);
    shrineCrystals.set(zone.shrineId, shrineCrystal);
  }

  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    const radius = 9.5 + (i % 4) * 0.55;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 2.6 || Math.abs(z) < 2.6) {
      continue;
    }
    createSmallTree(scene, new THREE.Vector3(x, 0, z), i % 3);
  }
}

function createSky(scene, animated) {
  // 위쪽은 짙은 하늘색, 아래쪽은 따뜻한 노을빛으로 이어지는 그라디언트 돔.
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#2f6bd8');
  gradient.addColorStop(0.45, '#66b8f0');
  gradient.addColorStop(0.75, '#b6e6ff');
  gradient.addColorStop(1, '#ffe6c2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 256);
  const skyTexture = new THREE.CanvasTexture(canvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(sky);

  // 태양 글로우 스프라이트 (블룸이 잡아 반짝인다).
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  sun.scale.set(14, 14, 1);
  sun.position.set(-34, 26, -46);
  scene.add(sun);

  // 부드럽게 흐르는 구름 스프라이트들.
  const cloudTexture = createCloudTexture();
  const cloudGroup = new THREE.Group();
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, opacity: 0.72, depthWrite: false, fog: false }));
    const angle = (i / 9) * Math.PI * 2;
    const radius = 48 + (i % 3) * 8;
    cloud.position.set(Math.cos(angle) * radius, 20 + (i % 4) * 4, Math.sin(angle) * radius);
    const scale = 16 + (i % 3) * 7;
    cloud.scale.set(scale, scale * 0.55, 1);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);
  animated.push({ update: (elapsed) => { cloudGroup.rotation.y = elapsed * 0.006; } });
}

function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  for (const [cx, cy, r] of [[54, 74, 30], [78, 70, 26], [40, 78, 22], [66, 58, 24]]) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStylizedWater(scene, animated) {
  const geometry = new THREE.PlaneGeometry(120, 120, 48, 48);
  const material = new THREE.MeshStandardMaterial({
    color: 0x2fa7d8,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.94
  });
  // 시간에 따라 물결이 출렁이도록 정점 셰이더에 파동을 주입한다.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n uniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float wave = sin((position.x + uTime * 1.4) * 0.5) * 0.12
                    + cos((position.y + uTime * 1.1) * 0.6) * 0.1;
         transformed.z += wave;`
      );
    material.userData.shader = shader;
  };

  const water = new THREE.Mesh(geometry, material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.55;
  water.receiveShadow = true;
  scene.add(water);

  animated.push({
    update: (elapsed) => {
      const shader = material.userData.shader;
      if (shader) {
        shader.uniforms.uTime.value = elapsed;
      }
    }
  });
}

function createGrassField(scene) {
  // 인스턴싱으로 가벼운 풀·꽃을 뿌려 바닥을 생기 있게 만든다.
  const bladeGeometry = new THREE.ConeGeometry(0.09, 0.42, 4);
  bladeGeometry.translate(0, 0.21, 0);
  const grassColors = [0x5fbf5a, 0x7ed36a, 0x54b07a];
  const flowerColors = [0xff7eb6, 0xffd23f, 0x9b7cff, 0xff9f43];
  const count = 260;
  const grass = new THREE.InstancedMesh(
    bladeGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: false, color: 0xffffff, roughness: 0.9 }),
    count
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;
  for (let i = 0; i < count * 2 && placed < count; i += 1) {
    const angle = (i * 2.399963) % (Math.PI * 2);
    const radius = 2.4 + ((i * 0.618) % 1) * 8.8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    // 중앙 코어와 길목은 비운다.
    if (Math.hypot(x, z) < 2.6) {
      continue;
    }
    dummy.position.set(x, 0.02, z);
    const scale = 0.7 + ((i * 0.37) % 1) * 0.8;
    dummy.scale.set(scale, scale, scale);
    dummy.rotation.y = (i * 1.3) % (Math.PI * 2);
    dummy.updateMatrix();
    grass.setMatrixAt(placed, dummy.matrix);
    const isFlower = i % 6 === 0;
    color.setHex(isFlower ? flowerColors[i % flowerColors.length] : grassColors[i % grassColors.length]);
    grass.setColorAt(placed, color);
    placed += 1;
  }
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) {
    grass.instanceColor.needsUpdate = true;
  }
  grass.castShadow = false;
  grass.receiveShadow = true;
  scene.add(grass);
}

function createCenterCore(scene, animated) {
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.65, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x8b93b8, roughness: 0.7 })
  );
  pedestal.position.set(0, 0.28, 0);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  scene.add(pedestal);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.95, 0.08, 10, 48),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb032, emissiveIntensity: 0.6, roughness: 0.32, metalness: 0.3 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.64;
  scene.add(ring);

  // 코어를 감싸고 천천히 도는 두 번째 마법 고리.
  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.05, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0x7cf0ff, emissive: 0x39d6ff, emissiveIntensity: 0.9, roughness: 0.3 })
  );
  orbitRing.position.y = 1.4;
  scene.add(orbitRing);
  animated.push({ update: (elapsed) => { orbitRing.rotation.x = elapsed * 0.6; orbitRing.rotation.y = elapsed * 0.4; } });

  const crystal = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.72, 0),
    new THREE.MeshStandardMaterial({
      color: 0x9aa6b2,
      emissive: 0x2a3440,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.1
    })
  );
  crystal.position.set(0, 1.4, 0);
  crystal.castShadow = true;
  scene.add(crystal);

  const coreLight = new THREE.PointLight(0x8fb4c9, 0.8, 10);
  coreLight.position.set(0, 1.7, 0);
  scene.add(coreLight);

  activeQuest = { coreCrystal: crystal, coreGlow: coreLight };
}

function createPath(scene, target) {
  const distance = Math.max(target.length() - 1.8, 1);
  const midpoint = target.clone().multiplyScalar(0.5);
  const path = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.045, distance),
    new THREE.MeshStandardMaterial({ color: 0xd7c785, roughness: 0.88 })
  );
  path.position.set(midpoint.x, 0.11, midpoint.z);
  path.rotation.y = Math.atan2(target.x, target.z);
  path.receiveShadow = true;
  scene.add(path);
}

function createZone(scene, zone, position) {
  const topic = getTopicById(zone.topicId);
  const color = new THREE.Color(topic.color);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.85, 42),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.32,
      roughness: 0.9,
      side: THREE.DoubleSide
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(position.x, 0.13, position.z);
  scene.add(disc);

  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 1.7, 12),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.15 })
  );
  marker.position.set(position.x, 0.95, position.z);
  marker.castShadow = true;
  scene.add(marker);

  // 표식 위에 떠서 반짝이는 작은 구슬 — 블룸으로 빛난다.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.4, roughness: 0.2 })
  );
  beacon.position.set(position.x, 1.95, position.z);
  scene.add(beacon);

  const label = createLabelSprite(zone.nameKo, topic.color);
  label.position.set(position.x, 2.35, position.z);
  scene.add(label);

  if (zone.topicId === 'privacy') {
    createPrivacyVillage(scene, position);
  } else if (zone.topicId === 'bias') {
    createFairnessForest(scene, position);
  } else if (zone.topicId === 'copyright') {
    createCopyrightRuins(scene, position);
  } else {
    createDeepfakeCave(scene, position);
  }
}

function createPrivacyVillage(scene, position) {
  for (const offset of [
    [-1.5, -0.7],
    [1.3, -0.5],
    [-0.2, 1.2]
  ]) {
    const house = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.7, 0.88),
      new THREE.MeshStandardMaterial({ color: 0xf3d6a4, roughness: 0.88 })
    );
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.72, 0.58, 4),
      new THREE.MeshStandardMaterial({ color: 0xa75b4f, roughness: 0.82 })
    );
    base.position.y = 0.48;
    roof.position.y = 1.1;
    roof.rotation.y = Math.PI / 4;
    house.add(base, roof);
    house.position.set(position.x + offset[0], 0, position.z + offset[1]);
    house.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    scene.add(house);
  }
}

function createFairnessForest(scene, position) {
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const radius = i % 2 === 0 ? 1.5 : 2.2;
    createSmallTree(
      scene,
      new THREE.Vector3(position.x + Math.cos(angle) * radius, 0, position.z + Math.sin(angle) * radius),
      i
    );
  }
}

function createCopyrightRuins(scene, position) {
  for (const offset of [-1.5, 0, 1.5]) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 1.45, 12),
      new THREE.MeshStandardMaterial({ color: 0xc7bea2, roughness: 0.78 })
    );
    column.position.set(position.x + offset, 0.78, position.z - 1.4);
    column.castShadow = true;
    scene.add(column);
  }

  const tablet = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.9, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x9d927b, roughness: 0.86 })
  );
  tablet.position.set(position.x, 0.68, position.z + 1.25);
  tablet.castShadow = true;
  scene.add(tablet);
}

function createDeepfakeCave(scene, position) {
  const cave = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.9, 0),
    new THREE.MeshStandardMaterial({ color: 0x514464, roughness: 0.92 })
  );
  cave.scale.set(1.35, 0.82, 0.88);
  cave.position.set(position.x, 0.78, position.z - 0.35);
  cave.castShadow = true;
  scene.add(cave);

  const opening = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 24),
    new THREE.MeshBasicMaterial({ color: 0x1c1826 })
  );
  opening.position.set(position.x, 0.72, position.z - 1.86);
  opening.rotation.x = 0;
  scene.add(opening);
}

function createNpc(scene, zone, zonePosition, interactables) {
  const topic = getTopicById(zone.topicId);
  const npc = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.36, 0.72, 16),
    new THREE.MeshStandardMaterial({ color: topic.color, roughness: 0.6 })
  );
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd6ae, roughness: 0.7 })
  );
  body.position.y = 0.5;
  head.position.y = 1.02;
  npc.add(body, head);
  npc.position.set(zonePosition.x - 1.25, 0, zonePosition.z + 1.05);
  npc.traverse((child) => {
    child.castShadow = true;
  });
  scene.add(npc);

  interactables.push({
    type: 'npc',
    topicId: zone.topicId,
    zoneId: zone.id,
    position: npc.position.clone(),
    labelKo: `${zone.npc.nameKo}와 대화`
  });
}

function createShrine(scene, zone, zonePosition, interactables) {
  const topic = getTopicById(zone.topicId);
  const shrine = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.9, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: 0x7e8073, roughness: 0.75 })
  );
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.08, 12, 32, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xb8ab80, roughness: 0.64 })
  );
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.36, 0),
    new THREE.MeshStandardMaterial({
      color: topic.color,
      emissive: topic.color,
      emissiveIntensity: 0.28,
      roughness: 0.32
    })
  );
  base.position.y = 0.24;
  arch.position.y = 0.78;
  arch.rotation.z = Math.PI;
  crystal.position.y = 0.82;
  shrine.add(base, arch, crystal);
  shrine.position.set(zonePosition.x + 1.35, 0, zonePosition.z - 1.05);
  shrine.rotation.y = Math.atan2(-shrine.position.x, -shrine.position.z);
  shrine.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  scene.add(shrine);

  interactables.push({
    type: 'shrine',
    topicId: zone.topicId,
    shrineId: zone.shrineId,
    position: shrine.position.clone(),
    labelKo: `${getShrineById(zone.shrineId).nameKo} 풀기`
  });

  return crystal;
}

function createSmallTree(scene, position, variant) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.75, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a5333, roughness: 0.9 })
  );
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(0.58 + (variant % 2) * 0.12, 1.18, 9),
    new THREE.MeshStandardMaterial({ color: variant % 3 === 0 ? 0x3f7f55 : 0x4f935a, roughness: 0.88 })
  );
  trunk.position.set(position.x, 0.43, position.z);
  leaves.position.set(position.x, 1.22, position.z);
  trunk.castShadow = true;
  leaves.castShadow = true;
  scene.add(trunk, leaves);
}

function createPlayer({ playerGroup }) {
  const cloak = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 0.75, 18),
    new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: 0.58 })
  );
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xffd2a0, roughness: 0.7 })
  );
  const scarf = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.08, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xe0bb4b, roughness: 0.5 })
  );
  cloak.position.y = 0.42;
  head.position.y = 0.94;
  scarf.position.set(0, 0.72, 0.18);
  playerGroup.add(cloak, head, scarf);
  playerGroup.position.copy(PLAYER_START);
  playerGroup.traverse((child) => {
    child.castShadow = true;
  });
}

function createLabelSprite(text, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  context.fillStyle = 'rgba(18, 28, 35, 0.78)';
  roundRect(context, 22, 22, 468, 84, 18);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 8;
  roundRect(context, 22, 22, 468, 84, 18);
  context.stroke();
  context.fillStyle = '#fffaf0';
  context.font = '700 42px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 66);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    })
  );
  sprite.scale.set(3.15, 0.78, 1);
  return sprite;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function bindInput(game, ui) {
  const keyMap = new Map([
    ['KeyW', 'up'],
    ['ArrowUp', 'up'],
    ['KeyS', 'down'],
    ['ArrowDown', 'down'],
    ['KeyA', 'left'],
    ['ArrowLeft', 'left'],
    ['KeyD', 'right'],
    ['ArrowRight', 'right']
  ]);

  const onKeyDown = (event) => {
    const target = event.target;
    const isFormControl = target instanceof HTMLButtonElement
      || target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || target?.isContentEditable;

    if (keyMap.has(event.code)) {
      game.keys.add(keyMap.get(event.code));
      event.preventDefault();
    }
    if (!isFormControl && (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space')) {
      event.preventDefault();
      interact(game, ui);
    }
    if (event.code === 'KeyJ') {
      event.preventDefault();
      toggleJournal(game, ui);
    }
    if (event.code === 'Escape') {
      closeDialog(game, ui);
      closeJournal(game, ui);
    }
  };
  const onKeyUp = (event) => {
    if (keyMap.has(event.code)) {
      game.keys.delete(keyMap.get(event.code));
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const touchStops = ui.touchButtons.map((button) => {
    const action = button.dataset.touch;
    const down = (event) => {
      event.preventDefault();
      if (action === 'action') {
        interact(game, ui);
      } else {
        game.keys.add(action);
      }
    };
    const up = () => {
      game.keys.delete(action);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('pointerleave', up);
    return () => {
      button.removeEventListener('pointerdown', down);
      button.removeEventListener('pointerup', up);
      button.removeEventListener('pointercancel', up);
      button.removeEventListener('pointerleave', up);
    };
  });

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    for (const stop of touchStops) {
      stop();
    }
  };
}

function bindHudActions(game, ui, renderState) {
  ui.dialogClose.addEventListener('click', () => closeDialog(game, ui));
  ui.journalToggle.addEventListener('click', () => toggleJournal(game, ui));
  ui.journalClose.addEventListener('click', () => closeJournal(game, ui));
  renderState.coreCrystal = activeQuest.coreCrystal;
  renderState.coreGlow = activeQuest.coreGlow;
}

function updateGame(delta, game, renderState, ui) {
  updatePlayer(delta, game, renderState.playerGroup);
  updateCamera(renderState.camera, game.player.position);
  animateWorld(delta, renderState, game);
  updateNearestInteractable(game, renderState.interactables, ui);
}

function updatePlayer(delta, game, playerGroup) {
  const move = new THREE.Vector3(
    (game.keys.has('right') ? 1 : 0) - (game.keys.has('left') ? 1 : 0),
    0,
    (game.keys.has('down') ? 1 : 0) - (game.keys.has('up') ? 1 : 0)
  );

  if (move.lengthSq() > 0) {
    move.normalize();
    game.player.direction.copy(move);
    game.player.position.addScaledVector(move, game.player.speed * delta);
    game.player.position.copy(clampToIsland(game.player.position));
    playerGroup.rotation.y = Math.atan2(move.x, move.z);
  }

  playerGroup.position.lerp(game.player.position, 0.82);
}

function clampToIsland(position) {
  const flatLength = Math.hypot(position.x, position.z);
  if (flatLength <= ISLAND_RADIUS) {
    return position;
  }

  const scale = ISLAND_RADIUS / flatLength;
  return new THREE.Vector3(position.x * scale, position.y, position.z * scale);
}

function updateCamera(camera, target) {
  // 살짝 낮고 뒤로 물러난 각도 — 하늘·바다 지평선이 배경으로 드러난다.
  const desired = new THREE.Vector3(target.x * 0.6, target.y + 7.9, target.z + 12.6);
  camera.position.lerp(desired, 0.08);
  camera.lookAt(target.x * 0.4, target.y + 1.35, target.z - 1.2);
}

function animateWorld(delta, { shrineCrystals, coreCrystal, coreGlow }, game) {
  const elapsed = clock.elapsedTime;
  for (const [shrineId, crystal] of shrineCrystals.entries()) {
    crystal.rotation.y += delta * 1.6;
    const shrine = getShrineById(shrineId);
    const completed = game.progress.completedShrines.includes(shrineId);
    crystal.position.y = 0.82 + Math.sin(elapsed * 2.2 + shrine.topicId.length) * 0.08;
    crystal.material.emissiveIntensity = completed ? 0.72 : 0.24;
  }

  if (coreCrystal) {
    const unlocked = canUnlockFinalCore(game.progress.collectedFragments);
    coreCrystal.rotation.y += delta * (unlocked ? 1.2 : 0.45);
    coreCrystal.position.y = 1.4 + Math.sin(elapsed * 1.8) * 0.08;
    coreCrystal.material.color.set(unlocked ? 0x6fe0be : 0x7c8790);
    coreCrystal.material.emissive.set(unlocked ? 0x2fbf9d : 0x182026);
    coreCrystal.material.emissiveIntensity = unlocked ? 0.82 : 0.35;
    if (coreGlow) {
      coreGlow.intensity = unlocked ? 2.4 : 0.8;
      coreGlow.color.set(unlocked ? 0x6fe0be : 0x8fb4c9);
    }
  }
}

function updateNearestInteractable(game, interactables, ui) {
  const coreDistance = Math.hypot(game.player.position.x, game.player.position.z);
  let nearest = coreDistance <= CORE_RADIUS
    ? {
        type: 'core',
        position: new THREE.Vector3(0, 0, 0),
        labelKo: canUnlockFinalCore(game.progress.collectedFragments) ? 'AI 코어 최종 미션' : 'AI 코어 잠금 상태 확인'
      }
    : null;
  let nearestDistance = nearest ? coreDistance : Infinity;

  for (const item of interactables) {
    const distance = game.player.position.distanceTo(item.position);
    if (distance < INTERACTION_RADIUS && distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  }

  game.nearest = nearest;
  if (nearest && ui.dialog.hidden) {
    ui.prompt.hidden = false;
    ui.prompt.textContent = `E: ${nearest.labelKo}`;
  } else if (ui.dialog.hidden) {
    ui.prompt.hidden = false;
    ui.prompt.textContent = 'WASD/방향키 이동 · E 대화/사당 · J 기록';
  }
}

function interact(game, ui) {
  if (!ui.dialog.hidden) {
    return;
  }

  if (!game.nearest) {
    ui.prompt.hidden = false;
    ui.prompt.textContent = '가까운 NPC, 사당, AI 코어로 이동해 보세요.';
    return;
  }

  if (game.nearest.type === 'npc') {
    openNpcDialog(game, ui, game.nearest.topicId);
  } else if (game.nearest.type === 'shrine') {
    openShrineDialog(game, ui, game.nearest.shrineId);
  } else {
    openCoreDialog(game, ui);
  }
}

function openNpcDialog(game, ui, topicId) {
  const topic = getTopicById(topicId);
  const zone = WORLD_ZONES.find((item) => item.topicId === topicId);
  game.progress = recordLearningVisit(game.progress, topicId);
  persistProgress(game.progress);
  updateHud(game, ui);

  ui.dialogKicker.textContent = zone.nameKo;
  ui.dialogTitle.textContent = zone.npc.nameKo;
  ui.dialogBody.innerHTML = `
    <p class="prompt-line">${zone.npc.prompt}</p>
    <p>${zone.npc.lesson}</p>
    <dl class="topic-rule">
      <dt>${topic.titleKo} 약속</dt>
      <dd>${topic.safeRule}</dd>
    </dl>
    ${topic.realCaseKo ? `<p class="real-case"><strong>실제로 있었던 일</strong> ${topic.realCaseKo}</p>` : ''}
    <p class="reflection">${zone.npc.reflection}</p>
  `;
  openDialog(game, ui);
}

function openShrineDialog(game, ui, shrineId) {
  const shrine = getShrineById(shrineId);
  const topic = getTopicById(shrine.topicId);
  const completed = game.progress.completedShrines.includes(shrineId);
  ui.dialogKicker.textContent = topic.titleKo;
  ui.dialogTitle.textContent = shrine.nameKo;

  const choices = shrine.choices
    .map((choice) => `<button type="button" class="choice-button" data-choice="${choice.id}">${choice.textKo}</button>`)
    .join('');

  const extraQuestions = getExtraShrineQuestions(shrineId);

  ui.dialogBody.innerHTML = `
    <p class="prompt-line">${shrine.questionKo}</p>
    <div class="choice-list">${choices}</div>
    <p class="feedback-line" data-feedback>${completed ? '이미 해결한 사당입니다. 연습 문제로 더 익혀 보세요.' : ''}</p>
    <p class="reflection" data-shrine-reflection hidden></p>
    <div class="practice-area" data-practice-area></div>
  `;

  const zone = WORLD_ZONES.find((item) => item.shrineId === shrineId);
  const feedback = ui.dialogBody.querySelector('[data-feedback]');
  const reflection = ui.dialogBody.querySelector('[data-shrine-reflection]');
  const practiceArea = ui.dialogBody.querySelector('[data-practice-area]');

  function showPracticeGate() {
    if (extraQuestions.length === 0) {
      return;
    }
    practiceArea.innerHTML = `
      <button type="button" class="practice-start" data-practice-start>연습 문제 더 풀기 (${extraQuestions.length}문제)</button>
    `;
    practiceArea
      .querySelector('[data-practice-start]')
      .addEventListener('click', () => renderPractice(0));
  }

  function renderPractice(index) {
    const question = extraQuestions[index];
    const optionButtons = question.choices
      .map((choice) => `<button type="button" class="choice-button" data-practice-choice="${choice.id}">${choice.textKo}</button>`)
      .join('');
    practiceArea.innerHTML = `
      <div class="practice-card">
        <p class="practice-count">연습 ${index + 1}/${extraQuestions.length}</p>
        <p class="prompt-line">${question.questionKo}</p>
        <div class="choice-list">${optionButtons}</div>
        <p class="feedback-line" data-practice-feedback></p>
        <div data-practice-nav></div>
      </div>
    `;
    const practiceFeedback = practiceArea.querySelector('[data-practice-feedback]');
    const nav = practiceArea.querySelector('[data-practice-nav]');
    let answered = false;
    for (const button of practiceArea.querySelectorAll('[data-practice-choice]')) {
      button.addEventListener('click', () => {
        if (answered) {
          return;
        }
        answered = true;
        const outcome = recordPracticeChoice(game.progress, shrineId, question.id, button.dataset.practiceChoice);
        game.progress = outcome.progress;
        persistProgress(game.progress);
        practiceFeedback.textContent = outcome.result.feedbackKo;
        practiceFeedback.dataset.correct = String(outcome.result.correct);
        updateHud(game, ui);
        const isLast = index + 1 >= extraQuestions.length;
        nav.innerHTML = isLast
          ? '<p class="practice-done">연습 완료! 잘했어요. 다른 구역도 탐험해 보세요.</p>'
          : '<button type="button" class="practice-next" data-practice-next>다음 문제 →</button>';
        if (!isLast) {
          nav.querySelector('[data-practice-next]').addEventListener('click', () => renderPractice(index + 1));
        }
      });
    }
  }

  for (const button of ui.dialogBody.querySelectorAll('[data-choice]')) {
    button.disabled = completed;
    button.addEventListener('click', () => {
      const outcome = applyShrineResult(game.progress, shrineId, button.dataset.choice);
      game.progress = outcome.progress;
      persistProgress(game.progress);
      feedback.textContent = outcome.result.feedbackKo;
      feedback.dataset.correct = String(outcome.result.correct);
      // 1부(어드벤처)와 같은 원칙: 위험한 선택은 처벌 대신 회고 질문으로 잇는다.
      reflection.hidden = outcome.result.correct;
      if (!outcome.result.correct) {
        reflection.textContent = `생각해 보기 — ${zone.npc.reflection}`;
      }
      for (const sibling of ui.dialogBody.querySelectorAll('[data-choice]')) {
        sibling.disabled = outcome.result.correct;
      }
      if (outcome.result.correct) {
        showPracticeGate();
      }
      updateHud(game, ui);
    });
  }

  if (completed) {
    showPracticeGate();
  }

  openDialog(game, ui);
}

function openCoreDialog(game, ui) {
  const unlocked = canUnlockFinalCore(game.progress.collectedFragments);
  ui.dialogKicker.textContent = unlocked ? '최종 미션' : '중앙 코어';
  ui.dialogTitle.textContent = FINAL_CORE_MISSION.nameKo;

  if (!unlocked) {
    const summary = getProgressSummary(game.progress.collectedFragments);
    ui.dialogBody.innerHTML = `
      <p>AI 코어는 아직 조용합니다.</p>
      <p>${FINAL_CORE_MISSION.unlockRequirement}개 이상의 윤리 조각이 필요해요. 현재 ${summary.collected}개를 모았습니다.</p>
    `;
    openDialog(game, ui);
    return;
  }

  const choices = FINAL_CORE_MISSION.choices
    .map((choice) => `<button type="button" class="choice-button" data-core-choice="${choice.id}">${choice.textKo}</button>`)
    .join('');

  ui.dialogBody.innerHTML = `
    <p class="prompt-line">${FINAL_CORE_MISSION.promptKo}</p>
    <div class="choice-list">${choices}</div>
    <p class="feedback-line" data-feedback>${game.progress.aiCoreCompleted ? FINAL_CORE_MISSION.completionKo : ''}</p>
  `;

  const feedback = ui.dialogBody.querySelector('[data-feedback]');
  for (const button of ui.dialogBody.querySelectorAll('[data-core-choice]')) {
    button.disabled = game.progress.aiCoreCompleted;
    button.addEventListener('click', () => {
      const outcome = completeFinalCore(game.progress, button.dataset.coreChoice);
      game.progress = outcome.progress;
      persistProgress(game.progress);
      feedback.textContent = outcome.messageKo;
      feedback.dataset.correct = String(outcome.result?.correct ?? false);
      if (outcome.result?.correct) {
        for (const sibling of ui.dialogBody.querySelectorAll('[data-core-choice]')) {
          sibling.disabled = true;
        }
      }
      updateHud(game, ui);
    });
  }
  openDialog(game, ui);
}

function openDialog(game, ui) {
  game.paused = true;
  ui.dialog.hidden = false;
  ui.prompt.hidden = true;
}

function closeDialog(game, ui) {
  ui.dialog.hidden = true;
  game.paused = false;
  ui.root.querySelector('[data-game-canvas]')?.focus?.();
}

function toggleJournal(game, ui) {
  if (ui.journal.hidden) {
    renderJournal(game, ui);
    ui.journal.hidden = false;
    ui.journalToggle.setAttribute('aria-expanded', 'true');
  } else {
    closeJournal(game, ui);
  }
}

function closeJournal(game, ui) {
  ui.journal.hidden = true;
  ui.journalToggle.setAttribute('aria-expanded', 'false');
}

function updateHud(game, ui) {
  const summary = getProgressSummary(game.progress.collectedFragments);
  ui.objective.textContent = getNextObjective(game.progress);
  ui.fragmentCount.textContent = `조각 ${summary.collected}/${summary.total}`;
  ui.coreStatus.textContent = game.progress.aiCoreCompleted
    ? 'AI 코어 완료'
    : summary.finalCoreUnlocked
      ? 'AI 코어 열림'
      : 'AI 코어 잠김';
  ui.fragmentRow.innerHTML = ETHICS_TOPICS.map((topic) => {
    const collected = summary.collectedTopicIds.includes(topic.id);
    return `<span class="fragment-dot" style="--topic-color:${topic.color}" data-collected="${collected}" title="${topic.fragmentKo}">${topic.titleKo}</span>`;
  }).join('');
  renderJournal(game, ui);
}

function renderJournal(game, ui) {
  const summary = getProgressSummary(game.progress.collectedFragments);
  const report = getLearningReport(game.progress);
  ui.journalContent.innerHTML = `
    <p class="controls-note">이동: WASD/방향키 · 상호작용: E/Enter · 기록: J</p>
    <ul class="topic-list">
      ${ETHICS_TOPICS.map((topic) => {
        const visited = game.progress.visitedTopics.includes(topic.id);
        const collected = summary.collectedTopicIds.includes(topic.id);
        return `
          <li>
            <strong>${topic.titleKo}</strong>
            <span>${collected ? '조각 획득' : visited ? '대화 완료' : '탐험 전'}</span>
            <p>${topic.studentTakeaway}</p>
          </li>
        `;
      }).join('')}
    </ul>
    <section class="learning-report" data-learning-report>
      <h3>학습 리포트</h3>
      <p>사당 해결 ${report.solvedCount}/4 · 첫 도전 성공 ${report.firstTryCount}개 · 연습 문제 ${report.practiceCorrectCount}/${report.practiceCount} 정답 · AI 코어 ${report.core.completed ? '완료' : '미완료'}</p>
      <ul class="report-list">
        ${report.topics
          .map((topic) => `<li><strong>${topic.titleKo}</strong> ${topic.statusKo}${topic.attempts > 0 ? ` (${topic.attempts}회 도전)` : ''}</li>`)
          .join('')}
      </ul>
      ${report.reviewTopics.length > 0
        ? `<p class="report-review-heading">다시 이야기해 볼 질문</p>
           <ul class="report-list">
             ${report.reviewTopics.map((topic) => `<li>${topic.reviewQuestionKo}</li>`).join('')}
           </ul>`
        : ''}
      <p class="class-note">이 리포트는 내 배움을 돌아보는 자료예요. 활동지에 옮겨 쓰고 모둠 토론에서 나눠 보세요.</p>
      <button type="button" class="report-reset" data-reset-progress>기록 초기화 (새 친구가 시작할 때)</button>
    </section>
  `;

  ui.journalContent.querySelector('[data-reset-progress]')?.addEventListener('click', () => {
    const confirmed = typeof window.confirm === 'function'
      ? window.confirm('탐험 기록을 모두 지우고 처음부터 시작할까요?')
      : true;
    if (!confirmed) {
      return;
    }
    clearStoredProgress();
    game.progress = createInitialProgress();
    updateHud(game, ui);
  });
}

function updateCoreVisual(game, { coreCrystal, coreGlow }) {
  if (!coreCrystal) {
    return;
  }
  const unlocked = canUnlockFinalCore(game.progress.collectedFragments);
  coreCrystal.material.color.set(unlocked ? 0x6fe0be : 0x7c8790);
  coreCrystal.material.emissive.set(unlocked ? 0x2fbf9d : 0x182026);
  coreCrystal.material.emissiveIntensity = unlocked ? 0.82 : 0.35;
  if (coreGlow) {
    coreGlow.color.set(unlocked ? 0x6fe0be : 0x8fb4c9);
  }
}

function resize(renderer, camera, root, composer) {
  const width = Math.max(root.clientWidth, 320);
  const height = Math.max(root.clientHeight, 360);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setSize(width, height);
  }
}

function showRendererFallback(ui, error) {
  ui.dialogKicker.textContent = '그래픽 오류';
  ui.dialogTitle.textContent = '3D 화면을 시작할 수 없어요';
  ui.dialogBody.innerHTML = `
    <p>이 브라우저 또는 기기에서 WebGL을 사용할 수 없습니다. 최신 브라우저에서 다시 열어 주세요.</p>
    <p class="technical-note">${error.message}</p>
  `;
  ui.dialog.hidden = false;
}

if (typeof window !== 'undefined') {
  window.initEthicsQuest3D = initEthicsQuest3D;
  window.addEventListener('DOMContentLoaded', () => {
    initEthicsQuest3D();
  });
}
