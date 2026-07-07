import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createAudioEngine } from './audio.js';
import { createBurstSystem, createFloatingIcon, setIconEmoji } from './effects.js';
import { CLASSIFY_BUCKETS, getClassifyChallenge, scoreClassify } from './classify.js';
import { createCompanion, createNoiseBoss, createNova, createNpcCharacter, createPlayerCharacter } from './characters.js';
import {
  createPuzzleState,
  cyclePuzzleObject,
  getShrinePuzzle,
  isPuzzleSolved
} from './shrinePuzzle.js';
import { pickMemory } from './bossMemories.js';
import {
  FINALE,
  buildNovaCertificate,
  getFinaleToolSteps,
  getTeachingLines
} from './finale.js';
import {
  PROLOGUE,
  QUESTS,
  applyGateChoice,
  applyIntroTalk,
  getGateDialog,
  getGateStatus,
  getNpcDialog,
  getStoryDeeds,
  getStoryObjective,
  getStoryVisualFlags
} from './story.js';
import {
  ETHICS_TOPICS,
  FINAL_CORE_MISSION,
  SHRINES,
  WORLD_ZONES,
  applyShrineResult,
  canUnlockFinalCore,
  completeFinalCore,
  createInitialProgress,
  PROMISE_TOOLS,
  awardFragment,
  getToolById,
  getExtraShrineQuestions,
  getLearningReport,
  getProgressSummary,
  getShrineById,
  getTopicById,
  normalizeProgress,
  recordLearningVisit,
  recordPracticeChoice
} from './worldData.js';

const APP_MARKER = 'AI Ethics Quest 3D';
const STORAGE_KEY = 'ai-ethics-quest-3d/progress/v1';

// 터치 기기에서는 키보드(WASD/E/J) 안내가 의미 없으므로 조작 문구를 바꾼다.
const IS_TOUCH = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(pointer: coarse)').matches;
const TOPIC_NAMES_KO = { privacy: '개인정보 마을', bias: '편향의 숲', copyright: '저작권 유적', deepfake: '딥페이크 동굴' };

const MOVE_HINT = IS_TOUCH
  ? '왼쪽 방향 버튼 이동 · 오른쪽 A로 확인·공격'
  : 'WASD/방향키 이동 · E·Space 확인/공격 · J 기록';
const ACTION_LABEL = IS_TOUCH ? '' : 'E: ';
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
    animated: [],
    icons: [],
    burst: null,
    companion: null,
    gates: new Map(),
    zoneAuras: new Map()
  };

  configureRenderer(renderer);
  createWorld(renderState);
  createPlayer(renderState);
  scene.add(renderState.playerGroup);
  setupPostProcessing(renderState, root);
  renderState.burst = createBurstSystem(scene);
  createInteractionIcons(renderState);

  // 동행 요정 도트 — 항상 플레이어 어깨 옆에 둥둥.
  renderState.companion = createCompanion();
  renderState.companion.position.copy(PLAYER_START).add(new THREE.Vector3(0.8, 1.2, 0));
  scene.add(renderState.companion);

  game.audio = createAudioEngine();
  game.renderState = renderState;

  const cleanupInput = bindInput(game, ui);
  bindHudActions(game, ui, renderState);

  resize(renderer, camera, root, renderState.composer);
  updateHud(game, ui);
  updateCoreVisual(game, renderState);
  // 이미 노바를 되살린 세이브라면, 코어 위에 노바가 떠 있는 채로 시작한다.
  if (game.progress.aiCoreCompleted) {
    morphNoiseToNova(game);
  }

  let animationId = 0;
  const updateRotateHint = () => {
    if (!ui.rotateHint) {
      return;
    }
    // 세로로 잡은 폰에서만 가로 권장 안내를 띄운다(태블릿·데스크톱 제외).
    // 대화창이 열려 있으면 내용과 겹치므로 숨긴다.
    const portraitPhone = IS_TOUCH && window.innerHeight > window.innerWidth && window.innerWidth < 560;
    const dialogOpen = ui.dialog && !ui.dialog.hidden;
    const inAction = Boolean(game.combat?.active || game.puzzle?.active);
    ui.rotateHint.hidden = !(portraitPhone && game.started && !dialogOpen && !inAction);
  };
  const onResize = () => {
    resize(renderer, camera, root, renderState.composer);
    updateRotateHint();
  };
  const onVisibilityChange = () => {
    game.paused = document.hidden || !ui.dialog.hidden;
  };
  game.updateRotateHint = updateRotateHint;

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    game.paused = true;
    ui.prompt.textContent = '그래픽 화면이 잠시 멈췄어요. 새로고침하면 다시 시작할 수 있어요.';
    ui.prompt.hidden = false;
  });

  // 타이틀 화면 뒤로 보일 섬 전경 카메라.
  camera.position.set(0, 9.5, 16);
  camera.lookAt(0, 1.4, 0);
  setupTitleScreen(game, ui);

  function frame() {
    animationId = window.requestAnimationFrame(frame);
    const raw = Math.min(clock.getDelta(), 0.04);
    // 히트스톱: 타격 순간 게임 시간을 잠깐 거의 멈춰 손맛을 준다(시각 효과는 계속).
    let delta = raw;
    if (game.hitStop > 0) {
      game.hitStop = Math.max(0, game.hitStop - raw);
      delta = raw * 0.06;
    }
    if (game.started && !game.paused) {
      updateGame(delta, game, renderState, ui);
    }
    updateAmbient(raw, renderState);
    if (renderState.composer) {
      renderState.composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  frame();

  if (typeof window !== 'undefined' && window.__ETHICS_TEST_HOOK__) {
    window.__ethicsGame = game;
    window.__ethicsUi = ui;
  }

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
        <div class="status-head">
          <strong data-fragment-count>조각 0/4</strong>
          <span data-core-status>AI 코어 잠김</span>
        </div>
        <div class="fragment-row" data-fragment-row></div>
        <div class="tool-belt" data-tool-belt aria-label="약속 도구"></div>
      </section>

      <div class="rotate-hint" data-rotate-hint hidden>📱↻ 가로로 돌리면 더 잘 보여요</div>

      <button class="journal-toggle" type="button" data-journal-toggle aria-expanded="false">
        기록
      </button>

      <button class="sound-toggle" type="button" data-sound-toggle aria-pressed="false" aria-label="소리 켜기/끄기" title="소리 켜기/끄기">
        🔈
      </button>

      <div class="screen-flash" data-flash></div>

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

      <div class="boss-hud" data-boss-hud hidden aria-live="polite">
        <div class="boss-hud-top">
          <span class="boss-name">⚡ 노이즈</span>
          <span class="boss-weak" data-boss-weak></span>
        </div>
        <div class="boss-memory" data-boss-memory></div>
        <div class="boss-bar"><div class="boss-bar-fill" data-boss-fill></div></div>
        <div class="boss-hint" data-boss-hint></div>
      </div>

      <div class="combat-popup" data-combat-popup aria-hidden="true"></div>

      <div class="puzzle-hud" data-puzzle-hud hidden aria-live="polite">
        <div class="puzzle-title" data-puzzle-title></div>
        <div class="puzzle-goal" data-puzzle-goal></div>
        <div class="puzzle-hint" data-puzzle-hint></div>
      </div>

      <div class="touch-controls" aria-label="터치 조작">
        <div class="touch-dpad" aria-label="이동">
          <button type="button" data-touch="up" aria-label="위로 이동">▲</button>
          <button type="button" data-touch="left" aria-label="왼쪽 이동">◀</button>
          <button type="button" data-touch="right" aria-label="오른쪽 이동">▶</button>
          <button type="button" data-touch="down" aria-label="아래로 이동">▼</button>
        </div>
        <div class="touch-actions">
          <button type="button" data-touch="tool" class="touch-tool" aria-label="도구 바꾸기">🔄</button>
          <button type="button" data-touch="action" class="touch-a" data-action-label aria-label="확인·공격">A</button>
        </div>
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

      <section class="title-screen" data-title>
        <div class="title-card">
          <p class="title-eyebrow">AI 윤리 어드벤처 · 2부</p>
          <h1 class="title-name">AI 윤리의 섬</h1>
          <p class="title-desc">섬을 탐험하며 네 가지 윤리 조각을 모아 AI 코어를 깨우는 수호자가 되어 보세요.</p>
          <div class="title-actions" data-title-actions></div>
          <p class="title-controls">${IS_TOUCH ? '왼쪽 방향 버튼으로 이동 · 오른쪽 A 버튼으로 확인·공격' : '이동 WASD·방향키 · 확인/공격 E·Space·Enter · 기록 J'}</p>
        </div>
      </section>

      <section class="certificate" data-certificate hidden>
        <div class="certificate-card" data-certificate-card></div>
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
    bossHud: root.querySelector('[data-boss-hud]'),
    bossFill: root.querySelector('[data-boss-fill]'),
    bossHint: root.querySelector('[data-boss-hint]'),
    bossWeak: root.querySelector('[data-boss-weak]'),
    bossMemory: root.querySelector('[data-boss-memory]'),
    combatPopup: root.querySelector('[data-combat-popup]'),
    puzzleHud: root.querySelector('[data-puzzle-hud]'),
    puzzleTitle: root.querySelector('[data-puzzle-title]'),
    puzzleGoal: root.querySelector('[data-puzzle-goal]'),
    puzzleHint: root.querySelector('[data-puzzle-hint]'),
    actionLabel: root.querySelector('[data-action-label]'),
    dialog: root.querySelector('[data-dialog]'),
    dialogKicker: root.querySelector('[data-dialog-kicker]'),
    dialogTitle: root.querySelector('[data-dialog-title]'),
    dialogBody: root.querySelector('[data-dialog-body]'),
    dialogClose: root.querySelector('[data-dialog-close]'),
    journal: root.querySelector('[data-journal]'),
    journalToggle: root.querySelector('[data-journal-toggle]'),
    journalClose: root.querySelector('[data-close-journal]'),
    journalContent: root.querySelector('[data-journal-content]'),
    toolBelt: root.querySelector('[data-tool-belt]'),
    soundToggle: root.querySelector('[data-sound-toggle]'),
    flash: root.querySelector('[data-flash]'),
    title: root.querySelector('[data-title]'),
    titleActions: root.querySelector('[data-title-actions]'),
    rotateHint: root.querySelector('[data-rotate-hint]'),
    certificate: root.querySelector('[data-certificate]'),
    certificateCard: root.querySelector('[data-certificate-card]'),
    touchButtons: [...root.querySelectorAll('[data-touch]')]
  };
}

function triggerFlash(ui, colorHex) {
  if (!ui.flash) {
    return;
  }
  ui.flash.style.setProperty('--flash-color', colorHex ?? '#ffffff');
  ui.flash.classList.remove('is-active');
  // 리플로우를 강제해 애니메이션을 재시작한다.
  void ui.flash.offsetWidth;
  ui.flash.classList.add('is-active');
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
  const progress = loadStoredProgress();
  return {
    progress,
    player: {
      position: PLAYER_START.clone(),
      direction: new THREE.Vector3(0, 0, 1),
      speed: 5.2,
      bob: 0,
      moving: false
    },
    keys: new Set(),
    nearest: null,
    paused: false,
    started: false,
    audio: null,
    renderState: null,
    combat: null,
    puzzle: null,
    hitStop: 0,
    shake: 0,
    coreWasUnlocked: canUnlockFinalCore(progress.collectedFragments),
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
  if (renderState.burst) {
    renderState.burst.update(delta);
  }
  // 노이즈/노바는 대화창(일시정지) 중에도 살아 움직여야 하므로 여기서 갱신한다.
  animateNoiseBoss(delta, elapsed, renderState.noiseBoss);
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

  renderState.gates = renderState.gates ?? new Map();
  renderState.zoneAuras = renderState.zoneAuras ?? new Map();
  for (const zone of WORLD_ZONES) {
    const zonePosition = new THREE.Vector3(...zone.position);
    createPath(scene, zonePosition);
    createZone(scene, zone, zonePosition);
    createNpc(scene, zone, zonePosition, interactables);
    const shrineCrystal = createShrine(scene, zone, zonePosition, interactables);
    shrineCrystals.set(zone.shrineId, shrineCrystal);
    createGate(scene, zone, interactables, renderState.gates);
    createZoneAura(scene, zone, zonePosition, renderState.zoneAuras);
  }

  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    const radius = 9.5 + (i % 4) * 0.55;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 2.6 || Math.abs(z) < 2.6) {
      continue;
    }
    createSmallTree(scene, new THREE.Vector3(x, 0, z), i % 3, animated);
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

const ICON_FOR_TYPE = { shrine: ['❗', '#eba52c'], npc: ['💬', null], gate: ['⚠️', '#8a5eff'] };

function createInteractionIcons(renderState) {
  const { scene, interactables, icons } = renderState;
  interactables.forEach((item, index) => {
    const spec = ICON_FOR_TYPE[item.type];
    if (!spec) {
      return;
    }
    const topic = getTopicById(item.topicId);
    const [emoji, ring] = spec;
    const sprite = createFloatingIcon(emoji, ring ?? topic.color);
    const baseY = item.type === 'shrine' ? item.position.y + 2.5 : item.position.y + 2.2;
    sprite.position.set(item.position.x, baseY, item.position.z);
    scene.add(sprite);
    icons.push({ sprite, item, baseY, phase: index * 1.3 });
  });
}

function updateInteractionIcons(game, renderState) {
  const elapsed = clock.elapsedTime;
  for (const icon of renderState.icons) {
    // 위아래로 통통 떠서 시선을 끈다.
    icon.sprite.position.y = icon.baseY + Math.sin(elapsed * 2.2 + icon.phase) * 0.13;

    if (icon.item.type === 'shrine') {
      const done = game.progress.completedShrines.includes(icon.item.shrineId);
      if (done && !icon.done) {
        setIconEmoji(icon.sprite, '✅', '#2fae74');
        icon.done = true;
      }
      icon.sprite.material.opacity = done ? 0.42 : 1;
      icon.sprite.scale.setScalar(0.9 * (icon.item.shrineId === game.nearest?.shrineId ? 1.18 : 1));
    } else if (icon.item.type === 'gate') {
      const status = getGateStatus(game.progress, icon.item.topicId);
      // 관문: 대화 전엔 흐릿, 도구 있으면 밝게 '지금 여기!', 해결되면 사라짐.
      if (status === 'solved') {
        icon.sprite.visible = false;
      } else if (status === 'ready' && !icon.ready) {
        setIconEmoji(icon.sprite, '❗', '#8a5eff');
        icon.ready = true;
      }
      icon.sprite.material.opacity = status === 'need-intro' ? 0.28 : status === 'ready' ? 1 : 0.55;
      const near = icon.item.topicId === game.nearest?.topicId && game.nearest?.type === 'gate';
      icon.sprite.scale.setScalar(0.9 * (near ? 1.2 : 1));
    } else {
      const visited = game.progress.visitedTopics.includes(icon.item.topicId);
      const solved = getGateStatus(game.progress, icon.item.topicId) === 'solved';
      if (solved && !icon.done) {
        setIconEmoji(icon.sprite, '✅', '#2fae74');
        icon.done = true;
      }
      icon.sprite.material.opacity = solved ? 0.4 : visited ? 0.5 : 1;
      const bump = icon.item.zoneId === game.nearest?.zoneId && game.nearest?.type === 'npc' ? 1.18 : 1;
      icon.sprite.scale.setScalar(0.9 * bump);
    }
  }
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
  const npc = createNpcCharacter(zone.topicId);
  npc.position.set(zonePosition.x - 1.25, 0, zonePosition.z + 1.05);
  // 플레이어(섬 안쪽)를 바라보도록 회전.
  npc.rotation.y = Math.atan2(-npc.position.x, -npc.position.z);
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

// 노이즈 관문 — 도구로 해결해야 하는 지지직 사건 덩어리.
function createGate(scene, zone, interactables, gates) {
  const quest = QUESTS[zone.topicId];
  const [gx, gz] = quest.gatePosition;
  const group = new THREE.Group();
  // 회색·보라 글리치 덩어리
  const glitchMat = new THREE.MeshStandardMaterial({
    color: 0x4a3f5c,
    emissive: 0x6a4fb0,
    emissiveIntensity: 0.4,
    roughness: 0.9,
    flatShading: true
  });
  for (let i = 0; i < 5; i += 1) {
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34 + (i % 3) * 0.12, 0), glitchMat);
    const a = (i / 5) * Math.PI * 2;
    chunk.position.set(Math.cos(a) * 0.5, 0.5 + (i % 2) * 0.35, Math.sin(a) * 0.5);
    chunk.castShadow = true;
    group.add(chunk);
  }
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a2436, emissive: 0x8a5eff, emissiveIntensity: 0.7, flatShading: true })
  );
  core.position.y = 0.7;
  group.add(core);
  group.position.set(gx, 0, gz);
  scene.add(group);

  gates.set(zone.topicId, group);
  interactables.push({
    type: 'gate',
    topicId: zone.topicId,
    position: new THREE.Vector3(gx, 0, gz),
    labelKo: `${quest.gateLabelKo} 살펴보기`
  });
}

// 구역의 세계 상태 연출: 아직 못 풀었으면 지지직 노이즈 안개가 덮고,
// 조각을 얻어 해결하면 안개가 걷히고 그 구역 색의 꽃이 피어난다(세계가 낫는다).
function createZoneAura(scene, zone, position, zoneAuras) {
  const topic = getTopicById(zone.topicId);
  const color = new THREE.Color(topic.color);
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);

  // 노이즈 안개 — 회색·보라 반투명 원반 + 떠도는 글리치 픽셀들.
  const haze = new THREE.Group();
  const hazeDisc = new THREE.Mesh(
    new THREE.CircleGeometry(3.1, 40),
    new THREE.MeshBasicMaterial({ color: 0x6a5f82, transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false })
  );
  hazeDisc.rotation.x = -Math.PI / 2;
  hazeDisc.position.y = 1.6;
  haze.add(hazeDisc);
  const pixelMat = new THREE.MeshStandardMaterial({ color: 0x8a7fb0, emissive: 0x5a3d9a, emissiveIntensity: 0.6, roughness: 0.8 });
  const pixels = [];
  for (let i = 0; i < 8; i += 1) {
    const s = 0.14 + (i % 3) * 0.05;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), pixelMat);
    pixels.push(cube);
    haze.add(cube);
  }
  group.add(haze);

  // 치유의 꽃 — 해결 전엔 숨어 있다가(scale 0) 해결되면 피어난다.
  const bloom = new THREE.Group();
  bloom.scale.setScalar(0.001);
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + i;
    const r = 1.7 + (i % 3) * 0.5;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x4f935a, roughness: 0.9 })
    );
    const petals = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.5, flatShading: true })
    );
    petals.position.y = 0.32;
    const flower = new THREE.Group();
    flower.add(stem, petals);
    flower.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r);
    flower.userData.seed = i;
    bloom.add(flower);
  }
  group.add(bloom);

  scene.add(group);
  zoneAuras.set(zone.topicId, { haze, hazeDisc, pixels, bloom });
}

function createSmallTree(scene, position, variant, animated) {
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
  leaves.rotation.order = 'ZXY';
  trunk.castShadow = true;
  leaves.castShadow = true;
  scene.add(trunk, leaves);
  // 산들바람에 잎이 살랑거린다(생기 있는 섬).
  if (animated) {
    const phase = position.x * 0.7 + position.z * 0.5;
    animated.push({
      update: (elapsed) => {
        leaves.rotation.z = Math.sin(elapsed * 1.3 + phase) * 0.06;
        leaves.rotation.x = Math.cos(elapsed * 1.1 + phase) * 0.045;
      }
    });
  }
}

function createPlayer({ playerGroup }) {
  playerGroup.add(createPlayerCharacter());
  playerGroup.position.copy(PLAYER_START);
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
      game.audio?.resume();
      game.keys.add(keyMap.get(event.code));
      event.preventDefault();
    }
    if (!isFormControl && (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space')) {
      event.preventDefault();
      primaryAction(game, ui);
    }
    if (event.code === 'KeyJ') {
      event.preventDefault();
      toggleJournal(game, ui);
    }
    // 전투 중 도구 바꾸기: Q(순환) / 1~4(직접 선택).
    if (game.combat?.active && (event.code === 'KeyQ' || event.code === 'Tab')) {
      event.preventDefault();
      cycleActiveTool(game, ui, 1);
    }
    if (game.combat?.active && /^Digit[1-4]$/.test(event.code)) {
      event.preventDefault();
      const idx = Number(event.code.slice(-1)) - 1;
      const toolId = game.combat.tools[idx];
      if (toolId) {
        selectActiveTool(game, ui, toolId);
      }
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
        primaryAction(game, ui);
      } else if (action === 'tool') {
        cycleActiveTool(game, ui, 1);
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
  ui.soundToggle?.addEventListener('click', () => {
    game.audio?.resume();
    const muted = game.audio?.toggleMute();
    ui.soundToggle.textContent = muted ? '🔇' : '🔈';
    ui.soundToggle.setAttribute('aria-pressed', String(!muted));
    if (!muted) {
      game.audio?.playClick();
    }
  });
  // 전투 중 도구 벨트를 탭하면 그 도구를 '든 도구'로 선택(약점 맞추기).
  ui.toolBelt?.addEventListener('click', (event) => {
    const slot = event.target.closest?.('[data-tool-slot]');
    if (slot && game.combat?.active) {
      selectActiveTool(game, ui, slot.dataset.toolSlot);
    }
  });
  renderState.coreCrystal = activeQuest.coreCrystal;
  renderState.coreGlow = activeQuest.coreGlow;
}

function getInteractablePosition(game, type, id) {
  const key = type === 'shrine' ? 'shrineId' : 'zoneId';
  const found = game.renderState?.interactables?.find(
    (item) => item.type === type && item[key] === id
  );
  return found ? found.position.clone() : new THREE.Vector3(0, 1, 0);
}

function setupTitleScreen(game, ui) {
  if (!ui.title) {
    game.started = true;
    return;
  }
  const summary = getProgressSummary(game.progress.collectedFragments);
  const hasProgress = summary.collected > 0 || game.progress.visitedTopics.length > 0;

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'title-start';
  startButton.textContent = hasProgress ? '이어서 하기' : '모험 시작하기';
  ui.titleActions.appendChild(startButton);

  if (hasProgress) {
    const freshButton = document.createElement('button');
    freshButton.type = 'button';
    freshButton.className = 'title-fresh';
    freshButton.textContent = '처음부터';
    freshButton.addEventListener('click', () => {
      const confirmed = typeof window.confirm === 'function'
        ? window.confirm('탐험 기록을 모두 지우고 처음부터 시작할까요?')
        : true;
      if (!confirmed) {
        return;
      }
      clearStoredProgress();
      game.progress = createInitialProgress();
      game.coreWasUnlocked = false;
      updateHud(game, ui);
      dismissTitle(game, ui);
    });
    ui.titleActions.appendChild(freshButton);
  }

  startButton.addEventListener('click', () => dismissTitle(game, ui));
}

function dismissTitle(game, ui) {
  game.audio?.resume();
  game.audio?.playClick();
  game.started = true;
  game.paused = false;
  game.updateRotateHint?.();
  if (ui.title) {
    ui.title.classList.add('is-hidden');
    window.setTimeout(() => {
      ui.title.hidden = true;
      // 첫 플레이라면 프롤로그로 이야기를 열어 준다.
      if (!game.progress.prologueSeen) {
        openPrologue(game, ui);
      }
    }, 420);
  }
}

// 프롤로그 시퀀스: 해변 각성 → 도트 마중 → 노이즈 위기 → 첫 목표. 한 번 보면 다시 안 나온다.
function openPrologue(game, ui) {
  ui.dialogKicker.textContent = PROLOGUE.titleKo;
  ui.dialogTitle.textContent = '낯선 섬의 해변';

  const render = (index) => {
    const beat = PROLOGUE.beats[index];
    const isLast = index + 1 >= PROLOGUE.beats.length;
    const speaker = beat.speakerKo
      ? `<p class="finale-tool">${beat.speakerKo === '도트' ? '✨ ' : ''}${beat.speakerKo}</p>`
      : '';
    const lines = beat.linesKo.map((text) => `<p class="finale-line">${text}</p>`).join('');
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="big">
        <p class="finale-count">프롤로그 ${index + 1}/${PROLOGUE.beats.length}</p>
        ${speaker}
        ${lines}
      </div>
      <div class="finale-nav">
        <button type="button" class="finale-next" data-prologue-next>
          ${isLast ? `${PROLOGUE.closingKo} →` : '다음 →'}
        </button>
      </div>
    `;
    ui.dialogBody.querySelector('[data-prologue-next]').addEventListener('click', () => {
      game.audio?.playClick();
      if (isLast) {
        game.progress = { ...game.progress, prologueSeen: true };
        persistProgress(game.progress);
        closeDialog(game, ui);
      } else {
        render(index + 1);
      }
    });
  };

  render(0);
  openDialog(game, ui);
}

// AI 코어를 완성하면 수료증(엔딩)을 띄운다.
function showCertificate(game, ui) {
  if (!ui.certificate) {
    return;
  }
  const cert = buildNovaCertificate(game.progress);
  const badges = cert.deeds
    .map(
      (deed) => `
      <li style="--topic-color:${deed.color}">
        <span class="cert-badge" style="--topic-color:${deed.color}">🏅</span>
        <span class="cert-deed">
          <strong>${deed.titleKo}</strong>
          ${deed.deedKo ? `<em>“${deed.deedKo}”${deed.recovered ? ' — 실수 뒤 바로잡음' : ''}</em>` : ''}
        </span>
      </li>`
    )
    .join('');
  ui.certificateCard.innerHTML = `
    <p class="cert-eyebrow">${cert.eyebrowKo}</p>
    <h2 class="cert-title">${cert.titleKo}</h2>
    <p class="cert-body">${cert.bodyKo}</p>
    <ul class="cert-badges">${badges}</ul>
    ${cert.recoveredNoteKo ? `<p class="cert-recovered">${cert.recoveredNoteKo}</p>` : ''}
    <p class="cert-pledge">${cert.pledgeKo}</p>
    <p class="cert-signature">${cert.novaLineKo}</p>
    <div class="cert-actions">
      <button type="button" class="cert-print" data-cert-print>인쇄 / 저장</button>
      <button type="button" class="cert-close" data-cert-close>닫기</button>
    </div>
  `;
  ui.certificate.hidden = false;
  ui.certificateCard.querySelector('[data-cert-close]').addEventListener('click', () => {
    ui.certificate.hidden = true;
  });
  ui.certificateCard.querySelector('[data-cert-print]').addEventListener('click', () => {
    if (typeof window.print === 'function') {
      window.print();
    }
  });
}

// 조각을 얻거나 코어가 각성할 때: 파티클·빛기둥·화면 반짝·효과음을 한 번에.
function celebrate(game, worldPosition, colorHex, kind) {
  game.renderState?.burst?.spawn(worldPosition, colorHex);
  triggerFlash(game.ui, colorHex);
  if (kind === 'core') {
    game.audio?.playCoreAwaken();
  } else {
    game.audio?.playCollect();
  }
}

function updateGame(delta, game, renderState, ui) {
  updatePlayer(delta, game, renderState.playerGroup);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - delta * 3.2);
  }
  updateCamera(renderState.camera, game.player.position, game.shake);
  updateCompanion(delta, game, renderState);
  animateWorld(delta, renderState, game);
  updateCombat(delta, game, ui);
  updatePuzzle(delta, game, ui);
  updateInteractionIcons(game, renderState);
  updateNearestInteractable(game, renderState.interactables, ui);
}

function updateCompanion(delta, game, renderState) {
  const dot = renderState.companion;
  if (!dot) {
    return;
  }
  const elapsed = clock.elapsedTime;
  // 플레이어 뒤쪽 살짝 위에서 둥실둥실 따라온다.
  const dir = game.player.direction;
  const target = new THREE.Vector3(
    game.player.position.x - dir.x * 0.6 + Math.sin(elapsed * 1.3) * 0.25,
    game.player.position.y + 1.25 + Math.sin(elapsed * 2.6) * 0.12,
    game.player.position.z - dir.z * 0.6 + Math.cos(elapsed * 1.3) * 0.25
  );
  dot.position.lerp(target, Math.min(1, delta * 4.5));
  dot.rotation.y += delta * 1.4;
}

function updatePlayer(delta, game, playerGroup) {
  const move = new THREE.Vector3(
    (game.keys.has('right') ? 1 : 0) - (game.keys.has('left') ? 1 : 0),
    0,
    (game.keys.has('down') ? 1 : 0) - (game.keys.has('up') ? 1 : 0)
  );

  const moving = move.lengthSq() > 0;
  game.player.moving = moving;
  if (moving) {
    move.normalize();
    game.player.direction.copy(move);
    game.player.position.addScaledVector(move, game.player.speed * delta);
    game.player.position.copy(clampToIsland(game.player.position));
    playerGroup.rotation.y = Math.atan2(move.x, move.z);
    // 걸을 때 통통 튀는 느낌 + 살짝 기우뚱.
    game.player.bob += delta * 12;
    playerGroup.rotation.z = Math.sin(game.player.bob) * 0.05;
  } else {
    game.player.bob += delta * 2;
    playerGroup.rotation.z *= 0.85;
  }

  playerGroup.position.lerp(game.player.position, 0.82);
  const hop = moving ? Math.abs(Math.sin(game.player.bob)) * 0.12 : Math.sin(game.player.bob) * 0.03;
  playerGroup.position.y = game.player.position.y + hop;
}

function clampToIsland(position) {
  const flatLength = Math.hypot(position.x, position.z);
  if (flatLength <= ISLAND_RADIUS) {
    return position;
  }

  const scale = ISLAND_RADIUS / flatLength;
  return new THREE.Vector3(position.x * scale, position.y, position.z * scale);
}

function updateCamera(camera, target, shake = 0) {
  // 살짝 낮고 뒤로 물러난 각도 — 하늘·바다 지평선이 배경으로 드러난다.
  const desired = new THREE.Vector3(target.x * 0.6, target.y + 7.9, target.z + 12.6);
  camera.position.lerp(desired, 0.08);
  // 화면 흔들림(타격·피격 순간): 카메라를 잠깐 떨어 손맛을 준다.
  if (shake > 0) {
    const s = shake * 0.5;
    const t = clock.elapsedTime * 90;
    camera.position.x += Math.sin(t) * s;
    camera.position.y += Math.cos(t * 1.3) * s;
  }
  camera.lookAt(target.x * 0.4, target.y + 1.35, target.z - 1.2);
}

function addShake(game, magnitude) {
  game.shake = Math.min(0.6, Math.max(game.shake, magnitude));
}

// 전투 팝업 텍스트("일치!", "튕김!", "회피 실패!") — 잠깐 크게 떴다 사라진다.
function flashCombatPopup(ui, text, kind) {
  if (!ui.combatPopup) {
    return;
  }
  ui.combatPopup.textContent = text;
  ui.combatPopup.dataset.kind = kind || '';
  ui.combatPopup.classList.remove('pop');
  void ui.combatPopup.offsetWidth; // 리플로우로 애니메이션 재시작
  ui.combatPopup.classList.add('pop');
}

function animateWorld(delta, { shrineCrystals, coreCrystal, coreGlow, gates, zoneAuras }, game) {
  const elapsed = clock.elapsedTime;
  for (const [shrineId, crystal] of shrineCrystals.entries()) {
    crystal.rotation.y += delta * 1.6;
    const shrine = getShrineById(shrineId);
    const completed = game.progress.completedShrines.includes(shrineId);
    crystal.position.y = 0.82 + Math.sin(elapsed * 2.2 + shrine.topicId.length) * 0.08;
    crystal.material.emissiveIntensity = completed ? 0.72 : 0.24;
  }

  // 노이즈 관문: 지지직 흔들리다가, 해결되면 오그라들어 사라진다(세계가 낫는다).
  if (gates) {
    const flags = getStoryVisualFlags(game.progress);
    for (const [topicId, group] of gates.entries()) {
      const solved = flags.has(`${topicId}:solved`);
      if (solved) {
        if (group.visible) {
          group.scale.multiplyScalar(1 - Math.min(1, delta * 3));
          if (group.scale.x < 0.05) {
            group.visible = false;
          }
        }
        continue;
      }
      group.rotation.y += delta * 0.8;
      group.children.forEach((chunk, i) => {
        chunk.position.y += Math.sin(elapsed * 6 + i) * delta * 0.3;
        chunk.rotation.x += delta * (1 + i * 0.2);
      });
    }
  }

  // 구역 세계 상태: 미해결이면 노이즈 안개가 떠돌고, 해결되면 안개가 걷히고 꽃이 핀다.
  if (zoneAuras) {
    const flags = getStoryVisualFlags(game.progress);
    for (const [topicId, aura] of zoneAuras.entries()) {
      const solved = flags.has(`${topicId}:solved`);
      // 안개 페이드: 해결되면 서서히 사라진다.
      const targetOpacity = solved ? 0 : 0.36;
      aura.hazeDisc.material.opacity += (targetOpacity - aura.hazeDisc.material.opacity) * Math.min(1, delta * 2.5);
      aura.haze.visible = aura.hazeDisc.material.opacity > 0.02;
      if (aura.haze.visible) {
        aura.pixels.forEach((cube, i) => {
          const a = elapsed * (0.5 + (i % 3) * 0.25) + i * 1.7;
          const r = 1.4 + (i % 4) * 0.35;
          cube.position.set(Math.cos(a) * r, 1.2 + Math.sin(elapsed * 3 + i) * 0.5, Math.sin(a) * r);
          cube.rotation.x += delta * 2;
          cube.visible = Math.sin(elapsed * 14 + i * 1.9) > -0.6; // 지지직 깜빡임
        });
      }
      // 꽃 개화: 해결되면 부드럽게 피어나 산들바람에 흔들린다.
      const targetBloom = solved ? 1 : 0.001;
      const s = aura.bloom.scale.x + (targetBloom - aura.bloom.scale.x) * Math.min(1, delta * 2.5);
      aura.bloom.scale.setScalar(s);
      if (s > 0.05) {
        aura.bloom.children.forEach((flower, i) => {
          flower.rotation.z = Math.sin(elapsed * 1.6 + (flower.userData.seed ?? i)) * 0.18;
        });
      }
    }
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

// 최종장 3D 연출: 노이즈는 지지직 떨고 글리치 픽셀이 돈다. 도구를 쓸 때마다 목표 크기로 오그라든다.
function animateNoiseBoss(delta, elapsed, boss) {
  if (!boss || !boss.group) {
    return;
  }
  const { group, data } = boss;
  // 목표 크기로 부드럽게 수렴.
  const s = group.scale.x + (boss.targetScale - group.scale.x) * Math.min(1, delta * 4);
  group.scale.setScalar(s);
  if (data.kind === 'noise') {
    // 피격 반짝임: 맞으면 잠깐 크게 떨고 눈이 번쩍인다.
    const flash = boss.hitFlash > 0 ? boss.hitFlash : 0;
    if (boss.hitFlash > 0) {
      boss.hitFlash = Math.max(0, boss.hitFlash - delta);
    }
    const shake = flash > 0 ? flash * 0.5 : 0;
    // 베이스 위치(전투 중엔 XZ로 떠돌음) + 지지직 떨림.
    group.position.x = (boss.baseX ?? 0) + Math.sin(elapsed * 22) * (0.04 + shake) * s;
    group.position.z = (boss.baseZ ?? 0) + Math.cos(elapsed * 19) * (0.04 + shake) * s;
    group.position.y = (boss.baseY ?? 4.3) + Math.sin(elapsed * 4) * 0.12;
    data.body.rotation.y += delta * 0.6;
    data.body.rotation.x = Math.sin(elapsed * 3) * 0.1;
    data.body.material.emissiveIntensity = 0.5 + flash * 2.2;
    data.pixels.forEach((cube, i) => {
      const a = elapsed * (0.6 + (i % 3) * 0.3) + i;
      const r = 1.15 + (i % 4) * 0.12;
      cube.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.8, Math.sin(a) * r);
      cube.rotation.x += delta * 3;
      cube.visible = Math.sin(elapsed * 18 + i * 1.7) > -0.7; // 깜빡깜빡
    });
    const blink = flash > 0 ? 1 : (Math.sin(elapsed * 2.5) > -0.9 ? 1 : 0.15);
    // 전투 중엔 눈이 '약점 색'으로 물든다 — 그 색 도구로 때려야 한다는 신호.
    if (boss.weakColorHex) {
      data.eyes.forEach((eye) => { eye.material.emissive.set(boss.weakColorHex); eye.material.color.set(boss.weakColorHex); });
    }
    data.eyes.forEach((eye) => { eye.scale.y = blink; });
  } else if (data.kind === 'nova') {
    group.position.y = boss.baseY + Math.sin(elapsed * 2) * 0.14;
    data.core.rotation.y += delta * 0.9;
    group.rotation.z = Math.sin(elapsed * 1.5) * 0.15;
  }
}

// 노이즈 보스를 코어 위에 등장시킨다. combat=true면 손이 닿는 높이로 낮게 띄운다(직접 타격).
function spawnNoiseBoss(game, { combat = false } = {}) {
  const rs = game.renderState;
  if (!rs || rs.noiseBoss) {
    return;
  }
  const group = createNoiseBoss();
  const baseX = 0;
  const baseZ = 0;
  const baseY = combat ? 2.6 : 4.3; // 전투는 낮게(타격), 대화 연출은 높게(프레이밍).
  group.position.set(baseX, baseY, baseZ);
  group.scale.setScalar(0.05);
  rs.scene.add(group);
  rs.noiseBoss = {
    group,
    data: group.userData,
    targetScale: combat ? 1.3 : 1.5,
    baseX,
    baseZ,
    baseY,
    hitFlash: 0,
    kind: 'noise'
  };
}

// 도구를 한 번 쓸 때마다 노이즈가 작아진다.
function shrinkNoiseBoss(game, remainingSteps, totalSteps) {
  const boss = game.renderState?.noiseBoss;
  if (!boss || boss.kind !== 'noise') {
    return;
  }
  const t = totalSteps > 0 ? remainingSteps / totalSteps : 0;
  boss.targetScale = 0.4 + t * 0.95; // 마지막엔 0.4까지 오그라든다
}

// 노이즈 → 노바 재탄생: 안개 뭉치를 치우고 별빛을 띄운다.
function morphNoiseToNova(game) {
  const rs = game.renderState;
  if (!rs) {
    return;
  }
  if (rs.noiseBoss?.group) {
    rs.scene.remove(rs.noiseBoss.group);
  }
  const group = createNova();
  const baseY = 3.6;
  group.position.set(0, baseY, 0);
  rs.scene.add(group);
  rs.noiseBoss = { group, data: group.userData, targetScale: 1, baseX: 0, baseY, kind: 'nova' };
}

function updateNearestInteractable(game, interactables, ui) {
  // 전투·퍼즐 중엔 일반 상호작용 안내를 숨긴다(전용 HUD가 안내를 대신한다).
  if (game.combat?.active || game.puzzle?.active) {
    game.nearest = null;
    ui.prompt.hidden = true;
    return;
  }
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
    ui.prompt.textContent = `${ACTION_LABEL}${nearest.labelKo}`;
  } else if (ui.dialog.hidden) {
    // 터치 기기: 가까운 대상이 없으면 안내를 숨겨 화면을 비운다(d-pad로 충분).
    if (IS_TOUCH) {
      ui.prompt.hidden = true;
    } else {
      ui.prompt.hidden = false;
      ui.prompt.textContent = MOVE_HINT;
    }
  }
}

// 오른쪽 A 버튼/Space·Enter·E: 전투 중이면 '공격', 퍼즐 중이면 '돌 바꾸기', 아니면 '확인·대화'.
function primaryAction(game, ui) {
  game.audio?.resume();
  if (game.combat?.active) {
    playerAttack(game, ui);
  } else if (game.puzzle?.active) {
    puzzleCycle(game, ui);
  } else {
    interact(game, ui);
  }
}

function interact(game, ui) {
  // 첫 상호작용에서 오디오를 깨운다(자동재생 정책 대응).
  game.audio?.resume();

  if (!ui.dialog.hidden) {
    return;
  }

  if (!game.nearest) {
    ui.prompt.hidden = false;
    ui.prompt.textContent = '가까운 NPC, 사당, AI 코어로 이동해 보세요.';
    return;
  }

  game.audio?.playClick();

  if (game.nearest.type === 'npc') {
    openNpcDialog(game, ui, game.nearest.topicId);
  } else if (game.nearest.type === 'shrine') {
    // 아직 못 깬 사당은 3D 조작 퍼즐로, 이미 깬 사당은 복습 대화로.
    if (game.progress.completedShrines.includes(game.nearest.shrineId)) {
      openShrineDialog(game, ui, game.nearest.shrineId);
    } else {
      startShrinePuzzle(game, ui, game.nearest.shrineId);
    }
  } else if (game.nearest.type === 'gate') {
    openGateDialog(game, ui, game.nearest.topicId);
  } else if (
    canUnlockFinalCore(game.progress.collectedFragments)
    && !game.progress.aiCoreCompleted
    && !game.combat
  ) {
    // 조각을 모으고 코어에 닿으면: 대화가 아니라 실제 노이즈와의 액션 전투로 진입.
    startBossFight(game, ui);
  } else {
    openCoreDialog(game, ui);
  }
}

function speechHtml(linesKo) {
  return linesKo.map((line) => `<p class="speech-line">${line}</p>`).join('');
}

function openNpcDialog(game, ui, topicId) {
  const zone = WORLD_ZONES.find((item) => item.topicId === topicId);
  // 대화 내용은 '지금' 상태로 정하고(첫 대화면 소개), 그 뒤에 관문을 연다.
  const dialog = getNpcDialog(game.progress, topicId);
  game.progress = recordLearningVisit(game.progress, topicId);
  game.progress = applyIntroTalk(game.progress, topicId);
  persistProgress(game.progress);
  updateHud(game, ui);

  ui.dialogKicker.textContent = zone.nameKo;
  ui.dialogTitle.textContent = zone.npc.nameKo;
  ui.dialogBody.innerHTML = `
    ${speechHtml(dialog.linesKo)}
    <p class="quest-hint">${getStoryObjective(game.progress)}</p>
  `;
  openDialog(game, ui);
}

function openGateDialog(game, ui, topicId) {
  const quest = QUESTS[topicId];
  ui.dialogKicker.textContent = quest.gateLabelKo;
  ui.dialogTitle.textContent = quest.questTitleKo;

  function render() {
    const dialog = getGateDialog(game.progress, topicId);
    if (dialog.kind !== 'choice') {
      ui.dialogBody.innerHTML = speechHtml(dialog.linesKo);
      if (dialog.kind === 'need-tool') {
        const tool = getToolById(dialog.toolId);
        ui.dialogBody.innerHTML += `<p class="quest-hint">${tool.emoji} 「${tool.nameKo}」이(가) 필요해요 — 사당의 시련을 통과하세요.</p>`;
      }
      return;
    }
    const tool = getToolById(quest.toolId);
    const options = dialog.options
      .map((o) => `<button type="button" class="choice-button" data-gate-choice="${o.id}">${o.textKo}</button>`)
      .join('');
    ui.dialogBody.innerHTML = `
      <p class="gate-tool">${tool.emoji} 「${tool.nameKo}」 사용</p>
      <p>${dialog.introKo}</p>
      <p class="prompt-line">${dialog.promptKo}</p>
      <div class="choice-list">${options}</div>
      <p class="feedback-line" data-gate-feedback></p>
    `;
    const feedback = ui.dialogBody.querySelector('[data-gate-feedback]');
    for (const button of ui.dialogBody.querySelectorAll('[data-gate-choice]')) {
      button.addEventListener('click', () => {
        const before = canUnlockFinalCore(game.progress.collectedFragments);
        const outcome = applyGateChoice(game.progress, topicId, button.dataset.gateChoice);
        game.progress = outcome.progress;
        if (outcome.awardFragment) {
          game.progress = awardFragment(game.progress, topicId);
        }
        persistProgress(game.progress);
        feedback.dataset.correct = String(outcome.wise);
        if (outcome.wise) {
          feedback.textContent = outcome.feedbackKo;
          for (const sibling of ui.dialogBody.querySelectorAll('[data-gate-choice]')) {
            sibling.disabled = true;
          }
          // 조각 획득 연출 + 코어 각성 체크.
          const topic = getTopicById(topicId);
          celebrate(game, new THREE.Vector3(quest.gatePosition[0], 1.4, quest.gatePosition[1]), topic?.color ?? '#7cf0ff', 'collect');
          window.setTimeout(() => {
            ui.dialogBody.innerHTML += `<div class="gate-resolve">${speechHtml(outcome.resolveKo)}<p class="quest-hint">${getStoryObjective(game.progress)}</p></div>`;
          }, 500);
          if (!before && canUnlockFinalCore(game.progress.collectedFragments)) {
            window.setTimeout(() => celebrate(game, new THREE.Vector3(0, 1.6, 0), '#7cf0ff', 'core'), 900);
          }
        } else {
          game.audio?.playWrong();
          feedback.textContent = `${outcome.feedbackKo}`;
          // 회복: 잠시 뒤 다시 선택하게 한다.
          window.setTimeout(() => render(), 1400);
        }
        updateHud(game, ui);
      });
    }
  }

  render();
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

  const challenge = getClassifyChallenge(shrine.topicId);

  function showPracticeGate() {
    const buttons = [];
    if (extraQuestions.length > 0) {
      buttons.push(`<button type="button" class="practice-start" data-practice-start>📝 연습 문제 더 풀기 (${extraQuestions.length}문제)</button>`);
    }
    if (challenge) {
      buttons.push(`<button type="button" class="practice-start classify-start" data-classify-start>🧩 ${challenge.titleKo}</button>`);
    }
    if (buttons.length === 0) {
      return;
    }
    practiceArea.innerHTML = buttons.join('');
    practiceArea.querySelector('[data-practice-start]')?.addEventListener('click', () => renderPractice(0));
    practiceArea.querySelector('[data-classify-start]')?.addEventListener('click', () => renderClassify());
  }

  // 탭 기반 분류 미니게임: 카드를 골라 '안전/조심' 바구니에 담고 채점한다.
  function renderClassify() {
    const assignments = {};
    let selectedCardId = null;

    function draw(result) {
      const unsorted = challenge.cards.filter((card) => !assignments[card.id]);
      const cardChip = (card, inBucket) => {
        const state = result
          ? result.perCard.find((entry) => entry.cardId === card.id)?.correct
            ? 'correct'
            : 'wrong'
          : '';
        const selected = selectedCardId === card.id ? ' is-selected' : '';
        return `<button type="button" class="clue-card${selected}" data-clue="${card.id}" data-state="${state}">${card.textKo}</button>`;
      };
      const bucketHtml = CLASSIFY_BUCKETS.map((bucket) => {
        const inBucket = challenge.cards.filter((card) => assignments[card.id] === bucket.id);
        return `
          <div class="clue-bucket" data-bucket="${bucket.id}">
            <p class="clue-bucket-title">${bucket.emoji} ${bucket.labelKo}</p>
            <div class="clue-bucket-items">${inBucket.map((card) => cardChip(card, true)).join('')}</div>
          </div>
        `;
      }).join('');
      const allPlaced = challenge.cards.every((card) => assignments[card.id]);

      practiceArea.innerHTML = `
        <div class="classify-card">
          <p class="practice-count">🧩 분류 도전</p>
          <p class="prompt-line">${challenge.promptKo}</p>
          <p class="classify-hint">카드를 누른 뒤 바구니를 누르면 담겨요.</p>
          <div class="clue-tray" data-tray>${unsorted.map((card) => cardChip(card, false)).join('')}</div>
          <div class="clue-buckets">${bucketHtml}</div>
          <p class="feedback-line" data-classify-feedback>${
            result ? `${result.correct}/${result.total} 맞았어요.${result.passed ? ' 완벽해요! 🎉' : ' 빨간 카드를 다시 옮겨 보세요.'}` : ''
          }</p>
          <div class="classify-actions">
            <button type="button" class="classify-check" data-classify-check ${allPlaced ? '' : 'disabled'}>채점하기</button>
            <button type="button" class="classify-back" data-classify-back>← 도전 메뉴</button>
          </div>
        </div>
      `;

      for (const btn of practiceArea.querySelectorAll('[data-clue]')) {
        btn.addEventListener('click', () => {
          selectedCardId = selectedCardId === btn.dataset.clue ? null : btn.dataset.clue;
          game.audio?.playClick();
          draw(null);
        });
      }
      for (const bucket of practiceArea.querySelectorAll('[data-bucket]')) {
        bucket.addEventListener('click', () => {
          if (!selectedCardId) {
            return;
          }
          assignments[selectedCardId] = bucket.dataset.bucket;
          selectedCardId = null;
          game.audio?.playClick();
          draw(null);
        });
      }
      practiceArea.querySelector('[data-classify-back]').addEventListener('click', () => showPracticeGate());
      const checkBtn = practiceArea.querySelector('[data-classify-check]');
      if (checkBtn && allPlaced) {
        checkBtn.addEventListener('click', () => {
          const scored = scoreClassify(shrine.topicId, assignments);
          if (scored.passed) {
            game.audio?.playCollect();
            const topic = getTopicById(shrine.topicId);
            const shrinePos = getInteractablePosition(game, 'shrine', shrineId);
            celebrate(game, shrinePos.clone().setY(shrinePos.y + 1.2), topic?.color ?? '#ffd76a', 'collect');
          } else {
            game.audio?.playWrong();
          }
          draw(scored);
        });
      }
    }

    draw(null);
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
        if (outcome.result.correct) {
          game.audio?.playCorrect();
        } else {
          game.audio?.playWrong();
        }
        updateHud(game, ui);
        const isLast = index + 1 >= extraQuestions.length;
        nav.innerHTML = isLast
          ? '<p class="practice-done">연습 완료! 잘했어요.</p><button type="button" class="classify-back" data-practice-back>← 도전 메뉴</button>'
          : '<button type="button" class="practice-next" data-practice-next>다음 문제 →</button>';
        if (isLast) {
          nav.querySelector('[data-practice-back]').addEventListener('click', () => showPracticeGate());
        } else {
          nav.querySelector('[data-practice-next]').addEventListener('click', () => renderPractice(index + 1));
        }
      });
    }
  }

  for (const button of ui.dialogBody.querySelectorAll('[data-choice]')) {
    button.disabled = completed;
    button.addEventListener('click', () => {
      const firstClear = !game.progress.completedShrines.includes(shrineId);
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
        // 사당 통과 = 약속 도구 획득. 조각은 이 도구로 관문을 풀어야 얻는다.
        const topic = getTopicById(outcome.result.topicId);
        const shrinePos = getInteractablePosition(game, 'shrine', shrineId);
        celebrate(game, shrinePos.clone().setY(shrinePos.y + 1.2), topic?.color ?? '#ffd76a', 'collect');
        if (firstClear && outcome.toolId) {
          const tool = getToolById(outcome.toolId);
          const quest = QUESTS[outcome.result.topicId];
          reflection.hidden = false;
          reflection.dataset.tool = 'true';
          reflection.textContent = `${tool.emoji} 「${tool.nameKo}」 획득! ${tool.powerKo} 이제 「${quest.gateLabelKo}」로 가서 사용하세요.`;
        }
        showPracticeGate();
      } else {
        game.audio?.playWrong();
      }
      updateHud(game, ui);
    });
  }

  if (completed) {
    showPracticeGate();
  }

  openDialog(game, ui);
}

// ===== 사당 3D 조작 퍼즐: 돌에 다가가 A로 상태를 바꿔 목표 배치를 완성한다 =====
const PUZZLE_REACH = 1.9;

function makeStateSprite(text) {
  const sprite = createLabelSprite(text, '#ffd76a');
  sprite.scale.set(1.5, 0.62, 1);
  return sprite;
}

function startShrinePuzzle(game, ui, shrineId) {
  if (game.puzzle) {
    return;
  }
  const shrine = getShrineById(shrineId);
  const topicId = shrine.topicId;
  const puzzle = getShrinePuzzle(topicId);
  if (!puzzle) {
    openShrineDialog(game, ui, shrineId); // 안전망: 퍼즐이 없으면 기존 방식.
    return;
  }
  const states = createPuzzleState(topicId);
  const basePos = getInteractablePosition(game, 'shrine', shrineId);
  const scene = game.renderState.scene;
  const n = puzzle.objects.length;
  const pedestals = puzzle.objects.map((obj, i) => {
    const group = new THREE.Group();
    const px = basePos.x + (i - (n - 1) / 2) * 1.6;
    const pz = basePos.z + 1.7; // 플레이어가 다가서는 쪽
    group.position.set(px, 0, pz);
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0xb9b0c8, roughness: 0.7 })
    );
    stand.position.y = 0.35;
    stand.castShadow = true;
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color: obj.color, emissive: obj.color, emissiveIntensity: 0.4, roughness: 0.4, flatShading: true })
    );
    orb.position.y = 1.0;
    const sprite = makeStateSprite(puzzle.objects[i].states[states[i]]);
    sprite.position.y = 1.62;
    const nameTag = createLabelSprite(obj.labelKo, obj.color);
    nameTag.scale.set(1.7, 0.42, 1);
    nameTag.position.y = 0.05;
    group.add(stand, orb, sprite, nameTag);
    scene.add(group);
    return { group, orb, sprite, obj, position: group.position.clone() };
  });

  game.puzzle = { active: true, topicId, shrineId, states, pedestals, nearIndex: -1, solved: false };
  ui.root.classList.add('is-combat'); // A 버튼을 강조(공격 버튼 스타일 재사용)
  if (ui.actionLabel) {
    ui.actionLabel.textContent = '🔁';
  }
  ui.puzzleHud.hidden = false;
  ui.puzzleTitle.textContent = `🧩 ${puzzle.titleKo}`;
  ui.puzzleGoal.textContent = puzzle.goalKo;
  ui.prompt.hidden = true;
  game.updateRotateHint?.();
  refreshPuzzleEmblems(game);
}

function refreshPuzzleEmblems(game) {
  const pz = game.puzzle;
  if (!pz) {
    return;
  }
  const puzzle = getShrinePuzzle(pz.topicId);
  pz.pedestals.forEach((ped, i) => {
    const text = puzzle.objects[i].states[pz.states[i]];
    const old = ped.sprite;
    const fresh = makeStateSprite(text);
    fresh.position.copy(old.position);
    ped.group.remove(old);
    old.material.map?.dispose?.();
    old.material.dispose?.();
    ped.group.add(fresh);
    ped.sprite = fresh;
  });
}

function puzzleCycle(game, ui) {
  const pz = game.puzzle;
  if (!pz || !pz.active || pz.nearIndex < 0) {
    game.audio?.playClick();
    return;
  }
  const i = pz.nearIndex;
  pz.states = cyclePuzzleObject(pz.topicId, pz.states, i);
  const puzzle = getShrinePuzzle(pz.topicId);
  // 해당 돌의 스프라이트만 갱신.
  const ped = pz.pedestals[i];
  const fresh = makeStateSprite(puzzle.objects[i].states[pz.states[i]]);
  fresh.position.copy(ped.sprite.position);
  ped.group.remove(ped.sprite);
  ped.sprite.material.map?.dispose?.();
  ped.sprite.material.dispose?.();
  ped.group.add(fresh);
  ped.sprite = fresh;
  game.audio?.playClick();
  if (isPuzzleSolved(pz.topicId, pz.states)) {
    winShrinePuzzle(game, ui);
  }
}

function updatePuzzle(delta, game, ui) {
  const pz = game.puzzle;
  if (!pz || !pz.active) {
    return;
  }
  const elapsed = clock.elapsedTime;
  // 가장 가까운 돌을 찾아 강조하고 안내를 갱신.
  let nearIndex = -1;
  let nearDist = PUZZLE_REACH;
  pz.pedestals.forEach((ped, i) => {
    const d = Math.hypot(game.player.position.x - ped.position.x, game.player.position.z - ped.position.z);
    if (d < nearDist) {
      nearDist = d;
      nearIndex = i;
    }
    // 살짝 둥실 + 회전.
    ped.orb.position.y = 1.0 + Math.sin(elapsed * 2 + i) * 0.06;
    ped.orb.rotation.y += delta * 0.8;
    const targeted = i === nearIndex;
    ped.orb.material.emissiveIntensity = targeted ? 1.1 : 0.4;
    ped.orb.scale.setScalar(targeted ? 1.18 : 1);
  });
  pz.nearIndex = nearIndex;
  const puzzle = getShrinePuzzle(pz.topicId);
  if (nearIndex >= 0) {
    ui.puzzleHint.textContent = `가까운 돌: ${puzzle.objects[nearIndex].labelKo} — A로 바꾸기`;
  } else {
    ui.puzzleHint.textContent = '돌에 다가가 A로 바꿔요';
  }
}

function winShrinePuzzle(game, ui) {
  const pz = game.puzzle;
  if (!pz || pz.solved) {
    return;
  }
  pz.solved = true;
  const shrine = getShrineById(pz.shrineId);
  const correct = shrine.choices.find((c) => c.correct);
  const outcome = applyShrineResult(game.progress, pz.shrineId, correct.id);
  game.progress = outcome.progress;
  persistProgress(game.progress);
  const topic = getTopicById(pz.topicId);
  celebrate(game, getInteractablePosition(game, 'shrine', pz.shrineId).clone().setY(1.4), topic?.color ?? '#ffd76a', 'collect');
  const toolId = outcome.toolId;
  endShrinePuzzle(game, ui);
  updateHud(game, ui);
  // 도구 획득 안내(간단 대화).
  if (toolId) {
    const tool = getToolById(toolId);
    const quest = QUESTS[pz.topicId];
    ui.dialogKicker.textContent = topic?.titleKo ?? '사당';
    ui.dialogTitle.textContent = `${shrine.nameKo} 통과!`;
    ui.dialogBody.innerHTML = `
      <p class="prompt-line">${getShrinePuzzle(pz.topicId).lessonKo}</p>
      <p class="reflection" data-tool="true">${tool.emoji} 「${tool.nameKo}」 획득! ${tool.powerKo} 이제 「${quest.gateLabelKo}」로 가서 사용하세요.</p>
      <div class="finale-nav"><button type="button" class="finale-next" data-dialog-ok>좋아!</button></div>
    `;
    ui.dialogBody.querySelector('[data-dialog-ok]').addEventListener('click', () => closeDialog(game, ui));
    openDialog(game, ui);
  }
}

function endShrinePuzzle(game, ui) {
  const pz = game.puzzle;
  if (!pz) {
    return;
  }
  for (const ped of pz.pedestals) {
    game.renderState.scene.remove(ped.group);
  }
  game.puzzle = null;
  ui.root.classList.remove('is-combat');
  if (ui.actionLabel) {
    ui.actionLabel.textContent = 'A';
  }
  ui.puzzleHud.hidden = true;
  game.updateRotateHint?.();
}

function openCoreDialog(game, ui) {
  const unlocked = canUnlockFinalCore(game.progress.collectedFragments);
  ui.dialogKicker.textContent = unlocked ? FINALE.titleKo : '중앙 코어';
  ui.dialogTitle.textContent = unlocked ? '노이즈와 마주 서다' : FINAL_CORE_MISSION.nameKo;

  if (!unlocked) {
    const summary = getProgressSummary(game.progress.collectedFragments);
    ui.dialogBody.innerHTML = `
      <p>코어의 틈에서 지지직 안개가 새어 나온다. 아직 내려갈 수 없다.</p>
      <p>윤리 조각이 ${FINAL_CORE_MISSION.unlockRequirement}개 이상 필요해요. 지금은 ${summary.collected}개를 모았습니다.</p>
    `;
    openDialog(game, ui);
    return;
  }

  // 이미 노바를 되살렸다면: 짧은 후일담 + 증명서 다시 보기.
  if (game.progress.aiCoreCompleted) {
    ui.dialogBody.innerHTML = `
      <p class="prompt-line">노바가 섬 위를 반짝이며 돈다. "또 놀러 왔구나. 좋은 것들아!"</p>
      <div class="finale-nav">
        <button type="button" class="finale-next" data-cert-again>증명서 다시 보기</button>
      </div>
    `;
    ui.dialogBody.querySelector('[data-cert-again]').addEventListener('click', () => showCertificate(game, ui));
    openDialog(game, ui);
    return;
  }

  // 조각을 다 모았고 아직 안 깬 상태로 코어에 닿으면 실제 전투로 진입(대화 아님).
  startBossFight(game, ui);
}

// ===== 최종장 액션 전투: 노이즈에게 다가가 A(공격)로 잡음을 걷어낸다 =====
const BOSS_MAX_HP = 6;
const ATTACK_RANGE = 3.7;
const ATTACK_COOLDOWN = 0.3;
const WEAK_ROTATE = 6.0; // 상황(약점) 자동 회전 주기(초) — 읽고 판단할 시간
const FIRE_INTERVAL = 2.9; // 잡음 파도 발사 간격
const WINDUP_TIME = 0.62; // 발사 예고(피할 시간)
const PROJECTILE_SPEED = 6.2;
const PROJECTILE_HIT = 0.95;
const STUN_TIME = 0.75;

function toolColorHex(toolId) {
  return getTopicById(getToolById(toolId)?.topicId)?.color ?? '#ffd76a';
}

function startBossFight(game, ui) {
  if (game.combat) {
    return;
  }
  spawnNoiseBoss(game, { combat: true });
  if (game.renderState?.companion) {
    game.renderState.companion.visible = false; // 도트는 후드로 숨는다
  }
  game.audio?.resume();
  game.audio?.playNoiseGroan();
  // 보유한 약속의 도구들 — 이 중 하나가 매 순간 노이즈의 '약점'이 된다.
  const tools = (game.progress.tools ?? []).slice();
  if (tools.length === 0) {
    tools.push('shield');
  }
  game.combat = {
    active: true,
    hp: BOSS_MAX_HP,
    maxHp: BOSS_MAX_HP,
    cooldown: 0,
    driftAngle: Math.PI * 0.25,
    tools,
    activeTool: 0,
    weakIndex: 0,
    weakToolId: tools[0],
    weakTimer: WEAK_ROTATE,
    memCounter: 0,
    weakMemory: pickMemory(tools[0], 0),
    bounceStreak: 0, // 같은 약점에서 연속으로 틀린 횟수(2회면 이모지 힌트 공개)
    revealed: false, // 약점 도구 이모지를 보여줄지(처음엔 상황만 읽고 판단)
    hintHold: 0, // 이유/튕김 안내를 잠깐 붙잡아 두는 타이머
    fireTimer: FIRE_INTERVAL,
    windup: 0,
    projectile: null,
    stun: 0
  };
  syncBossWeakColor(game);
  ui.root.classList.add('is-combat');
  ui.bossHud.hidden = false;
  ui.prompt.hidden = true;
  if (ui.actionLabel) {
    ui.actionLabel.textContent = '⚔';
  }
  game.updateRotateHint?.();
  updateBossHud(game, ui);
}

function syncBossWeakColor(game) {
  const c = game.combat;
  const boss = game.renderState?.noiseBoss;
  if (c && boss) {
    boss.weakColorHex = toolColorHex(c.weakToolId);
  }
}

function rotateWeakness(game, ui) {
  const c = game.combat;
  c.weakIndex = (c.weakIndex + 1) % c.tools.length;
  c.weakToolId = c.tools[c.weakIndex];
  c.weakTimer = WEAK_ROTATE;
  c.memCounter += 1;
  c.weakMemory = pickMemory(c.weakToolId, c.memCounter);
  c.bounceStreak = 0;
  c.revealed = false;
  syncBossWeakColor(game);
  // 새 상황 말풍선을 팝 애니메이션으로 띄운다.
  if (ui?.bossMemory) {
    ui.bossMemory.textContent = c.weakMemory.textKo;
    ui.bossMemory.classList.remove('pop');
    void ui.bossMemory.offsetWidth;
    ui.bossMemory.classList.add('pop');
  }
}

function cycleActiveTool(game, ui, dir = 1) {
  const c = game.combat;
  if (!c || !c.active) {
    return;
  }
  c.activeTool = (c.activeTool + dir + c.tools.length) % c.tools.length;
  game.audio?.playClick();
  updateBossHud(game, ui);
}

function selectActiveTool(game, ui, toolId) {
  const c = game.combat;
  if (!c || !c.active) {
    return;
  }
  const idx = c.tools.indexOf(toolId);
  if (idx >= 0) {
    c.activeTool = idx;
    game.audio?.playClick();
    updateBossHud(game, ui);
  }
}

function playerAttack(game, ui) {
  const c = game.combat;
  if (!c || !c.active || c.cooldown > 0 || c.stun > 0) {
    return;
  }
  c.cooldown = ATTACK_COOLDOWN;
  const boss = game.renderState?.noiseBoss;
  if (!boss || boss.kind !== 'noise') {
    return;
  }
  const dist = Math.hypot(
    game.player.position.x - (boss.baseX ?? 0),
    game.player.position.z - (boss.baseZ ?? 0)
  );
  if (dist > ATTACK_RANGE) {
    game.audio?.playClick();
    ui.bossHint.textContent = '더 가까이 다가가요';
    return;
  }
  const activeToolId = c.tools[c.activeTool];
  if (activeToolId !== c.weakToolId) {
    // 상황에 안 맞는 도구 — 튕겨 나간다(대미지 없음). 정답은 안 주고, 상황을 다시 읽게 한다.
    game.audio?.playWrong();
    boss.hitFlash = 0.12;
    addShake(game, 0.1);
    flashCombatPopup(ui, '튕김!', 'bounce');
    c.bounceStreak += 1;
    if (c.bounceStreak >= 2) {
      c.revealed = true; // 두 번 연속 틀리면 도구 힌트 공개(좌절 방지)
    }
    const weak = getToolById(c.weakToolId);
    ui.bossHint.textContent = c.revealed
      ? `이 상황엔 ${weak?.emoji ?? ''} ${weak?.nameKo ?? ''} — 그 도구로 바꿔요`
      : `튕김! "${c.weakMemory.textKo}" — 어떤 약속이 필요할까?`;
    c.hintHold = 1.8;
    updateBossHud(game, ui);
    return;
  }
  // 상황에 맞는 약속으로 명중: 노이즈가 신음하며 오그라든다.
  c.hp = Math.max(0, c.hp - 1);
  boss.hitFlash = 0.3;
  addShake(game, 0.3);
  game.hitStop = 0.06; // 히트스톱 — 타격 순간 멈칫
  const weakTool = getToolById(c.weakToolId);
  flashCombatPopup(ui, `${weakTool?.emoji ?? ''} 약속이 통했다!`, 'hit');
  ui.bossHint.textContent = c.weakMemory.hintKo; // 왜 이 도구였는지 한 줄
  c.hintHold = 1.6;
  celebrate(game, new THREE.Vector3(boss.baseX ?? 0, boss.baseY ?? 2.6, boss.baseZ ?? 0), toolColorHex(c.weakToolId), 'collect');
  game.audio?.playCorrect();
  game.audio?.playNoiseGroan();
  boss.targetScale = 0.4 + (c.hp / c.maxHp) * 0.95;
  rotateWeakness(game, ui); // 노이즈가 다른 잘못된 기억을 토해낸다 — 새 상황.
  updateBossHud(game, ui);
  if (c.hp <= 0) {
    winBossFight(game, ui);
  }
}

function fireNoiseWave(game) {
  const c = game.combat;
  const boss = game.renderState?.noiseBoss;
  const scene = game.renderState?.scene;
  if (!c || !boss || !scene) {
    return;
  }
  const bx = boss.baseX ?? 0;
  const bz = boss.baseZ ?? 0;
  let dx = game.player.position.x - bx;
  let dz = game.player.position.z - bz;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a5eff, emissive: 0x6a3dd0, emissiveIntensity: 1.1, roughness: 0.5, flatShading: true })
  );
  mesh.position.set(bx, 1.2, bz);
  scene.add(mesh);
  c.projectile = { mesh, dx, dz, x: bx, z: bz, life: 2.4 };
  game.audio?.playNoiseGroan();
}

function staggerPlayer(game, ui) {
  const c = game.combat;
  c.stun = STUN_TIME;
  const boss = game.renderState?.noiseBoss;
  // 노이즈 반대쪽으로 밀려난다.
  let dx = game.player.position.x - (boss?.baseX ?? 0);
  let dz = game.player.position.z - (boss?.baseZ ?? 0);
  const len = Math.hypot(dx, dz) || 1;
  game.player.position.x += (dx / len) * 1.3;
  game.player.position.z += (dz / len) * 1.3;
  game.player.position.copy(clampToIsland(game.player.position));
  game.audio?.playWrong();
  triggerFlash(ui, '#ff5f7e');
  addShake(game, 0.5);
  flashCombatPopup(ui, '회피 실패!', 'stagger');
  ui.bossHint.textContent = '잡음에 맞았다! 잠깐 정신 차리는 중…';
}

function updateCombat(delta, game, ui) {
  const c = game.combat;
  if (!c || !c.active) {
    return;
  }
  if (c.cooldown > 0) {
    c.cooldown = Math.max(0, c.cooldown - delta);
  }
  if (c.stun > 0) {
    c.stun = Math.max(0, c.stun - delta);
  }
  if (c.hintHold > 0) {
    c.hintHold = Math.max(0, c.hintHold - delta);
  }
  const boss = game.renderState?.noiseBoss;
  if (boss && boss.kind === 'noise') {
    c.driftAngle += delta * 0.5;
    boss.baseX = Math.cos(c.driftAngle) * 2.4;
    boss.baseZ = Math.sin(c.driftAngle) * 2.4;

    // 상황(약점) 자동 회전 — 노이즈가 다른 잘못된 기억을 토해낸다.
    c.weakTimer -= delta;
    if (c.weakTimer <= 0) {
      rotateWeakness(game, ui);
      updateBossHud(game, ui);
    }

    // 잡음 파도: 예고(windup) 후 플레이어 쪽으로 발사 → 피해야 한다.
    if (c.projectile) {
      const pr = c.projectile;
      pr.x += pr.dx * PROJECTILE_SPEED * delta;
      pr.z += pr.dz * PROJECTILE_SPEED * delta;
      pr.life -= delta;
      pr.mesh.position.set(pr.x, 1.2, pr.z);
      pr.mesh.rotation.x += delta * 6;
      const hit = Math.hypot(game.player.position.x - pr.x, game.player.position.z - pr.z) < PROJECTILE_HIT;
      if (hit && c.stun <= 0) {
        staggerPlayer(game, ui);
      }
      if (hit || pr.life <= 0) {
        game.renderState.scene.remove(pr.mesh);
        c.projectile = null;
        c.fireTimer = FIRE_INTERVAL;
      }
    } else if (c.windup > 0) {
      c.windup -= delta;
      boss.hitFlash = 0.18; // 예고: 몸이 번쩍인다
      if (c.windup <= 0) {
        fireNoiseWave(game);
      }
    } else {
      c.fireTimer -= delta;
      if (c.fireTimer <= 0) {
        c.windup = WINDUP_TIME;
        ui.bossHint.textContent = '노이즈가 잡음을 모은다 — 피해!';
      }
    }

    // 방금 뜬 이유/튕김 안내(hintHold)는 잠깐 유지하고, 그 외엔 상황 기반 기본 안내.
    if (c.stun <= 0 && !c.projectile && c.windup <= 0 && c.hintHold <= 0) {
      const dist = Math.hypot(game.player.position.x - boss.baseX, game.player.position.z - boss.baseZ);
      if (dist > ATTACK_RANGE) {
        ui.bossHint.textContent = '노이즈에게 다가가요';
      } else if (c.revealed) {
        const weak = getToolById(c.weakToolId);
        ui.bossHint.textContent = `${weak?.emoji ?? ''} ${weak?.nameKo ?? ''}(으)로 바꿔서 공격!`;
      } else {
        ui.bossHint.textContent = '이 상황엔 어떤 약속이 필요할까? 도구를 골라 공격!';
      }
    }
  }
}

function updateBossHud(game, ui) {
  const c = game.combat;
  if (!c || !ui.bossFill) {
    return;
  }
  ui.bossFill.style.width = `${Math.round((c.hp / c.maxHp) * 100)}%`;
  if (ui.bossWeak) {
    const weak = getToolById(c.weakToolId);
    const active = getToolById(c.tools[c.activeTool]);
    // 정답 도구는 처음엔 숨기고 색만 힌트로 준다. 명중하거나 2연속 튕기면 공개.
    const weakMark = c.revealed ? (weak?.emoji ?? '?') : '?';
    ui.bossWeak.innerHTML = `약점 <b style="color:${toolColorHex(c.weakToolId)}">${weakMark}</b> · 든 도구 ${active?.emoji ?? ''}`;
  }
  if (ui.bossMemory && c.weakMemory) {
    ui.bossMemory.textContent = c.weakMemory.textKo;
  }
  // 도구 벨트에서 현재 든 도구를 강조.
  if (ui.toolBelt) {
    const activeId = c.tools[c.activeTool];
    ui.toolBelt.querySelectorAll('[data-tool-slot]').forEach((slot) => {
      slot.dataset.active = String(slot.dataset.toolSlot === activeId);
    });
  }
}

function winBossFight(game, ui) {
  const c = game.combat;
  if (!c) {
    return;
  }
  c.active = false;
  if (c.projectile?.mesh) {
    game.renderState.scene.remove(c.projectile.mesh);
  }
  game.combat = null;
  ui.root.classList.remove('is-combat');
  ui.bossHud.hidden = true;
  if (ui.toolBelt) {
    ui.toolBelt.querySelectorAll('[data-tool-slot]').forEach((slot) => { slot.dataset.active = 'false'; });
  }
  if (ui.actionLabel) {
    ui.actionLabel.textContent = 'A';
  }
  const boss = game.renderState?.noiseBoss;
  if (boss) {
    boss.baseX = 0;
    boss.baseZ = 0;
    boss.targetScale = 0.42; // 지쳐 작게 웅크린다
  }
  game.audio?.playCorrect();
  addShake(game, 0.55);
  game.hitStop = 0.09;
  flashCombatPopup(ui, '제압!', 'win');
  // 잡음을 다 걷어낸 뒤: 지울지 가르칠지 고르는 윤리적 선택으로 마무리(가르침→노바→증명서).
  window.setTimeout(() => {
    runFinale(game, ui, { fromCombat: true });
    openDialog(game, ui);
  }, 750);
}

// 최종장 마무리 대화: 전투 뒤엔 곧장 [지운다/가르친다] 선택부터 시작한다.
// → 가르치면 행적이 곧 가르침이 되어 노바로 재탄생 → 증명서.
function runFinale(game, ui, opts = {}) {
  // 최종장은 시네마틱 모드: 대화창을 하단에 도킹해 위쪽에 노이즈 보스를 보여준다.
  ui.dialogKicker.textContent = FINALE.titleKo;
  ui.dialogTitle.textContent = '노이즈와 마주 서다';
  ui.root.classList.add('is-cinematic');
  const steps = getFinaleToolSteps(game.progress);
  const lines = (arr) => arr.map((text) => `<p class="finale-line">${text}</p>`).join('');
  const nav = (label, attr) =>
    `<div class="finale-nav"><button type="button" class="finale-next" ${attr}>${label}</button></div>`;

  function renderIntro() {
    // 코어 위에 거대한 노이즈가 등장한다. 도트는 후드 속으로 쏙 숨는다(대사와 연동).
    spawnNoiseBoss(game);
    if (game.renderState?.companion) {
      game.renderState.companion.visible = false;
    }
    game.audio?.playNoiseGroan();
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="big">${lines(FINALE.introKo)}</div>
      ${nav('마주 선다 →', 'data-finale="tools:0"')}
    `;
    bindNav();
  }

  function renderToolStep(index) {
    const step = steps[index];
    const isLast = index + 1 >= steps.length;
    // 도구를 쓸 때마다 노이즈가 눈에 띄게 오그라든다.
    shrinkNoiseBoss(game, steps.length - 1 - index, steps.length);
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="shrink">
        <p class="finale-count">약속의 도구 ${index + 1}/${steps.length}</p>
        <p class="finale-tool"><span class="finale-emoji">${step.emoji}</span> ${step.nameKo}</p>
        <p class="finale-line">${step.actionKo}</p>
        <p class="finale-line finale-result">${step.resultKo}</p>
      </div>
      ${nav(isLast ? '노이즈 앞에 서다 →' : '다음 도구 →', `data-finale="${isLast ? 'choice' : `tools:${index + 1}`}"`)}
    `;
    const topicColor = getTopicById(getToolById(step.toolId)?.topicId)?.color ?? '#7cf0ff';
    celebrate(game, new THREE.Vector3(0, 4.3, 0), topicColor, 'collect');
    game.audio?.playNoiseGroan(); // 노이즈가 도구에 밀려 신음하며 작아진다.
    bindNav();
  }

  function renderChoice() {
    const buttons = FINALE.choices
      .map((c) => `<button type="button" class="choice-button" data-finale-choice="${c.id}">${c.textKo}</button>`)
      .join('');
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="small">
        <p class="prompt-line">${FINALE.choicePromptKo}</p>
      </div>
      <div class="choice-list">${buttons}</div>
    `;
    for (const button of ui.dialogBody.querySelectorAll('[data-finale-choice]')) {
      button.addEventListener('click', () => {
        game.audio?.playClick();
        if (button.dataset.finaleChoice === 'teach') {
          renderTeach();
        } else {
          renderErase();
        }
      });
    }
  }

  // [지운다] — 실패가 아니라 배움. 코어가 말리고 다시 묻는다.
  function renderErase() {
    game.audio?.playWrong();
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="small">${lines(FINALE.eraseKo)}</div>
      ${nav('다시 생각한다 →', 'data-finale="choice"')}
    `;
    bindNav();
  }

  // [가르친다] — 네가 섬에서 실제로 한 행동이 그대로 가르침이 된다.
  function renderTeach() {
    const teachings = getTeachingLines(game.progress);
    const items = teachings
      .map(
        (t) => `
        <li class="finale-teach-item" style="--topic-color:${t.color}">
          <span class="finale-teach-topic">「${t.titleKo}」의 약속</span>
          <span class="finale-teach-deed">너는 「${t.deedKo}」${t.recovered ? ' <em>(실수했지만 돌아가 바로잡았지)</em>' : ''}.</span>
          <span class="finale-teach-lesson">${t.promiseKo}</span>
        </li>`
      )
      .join('');
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="teach">
        <p class="finale-line">${FINALE.teachIntroKo}</p>
        <ul class="finale-teach">${items}</ul>
      </div>
      ${nav('약속을 다 들려준다 →', 'data-finale="rebirth"')}
    `;
    bindNav();
  }

  function renderRebirth() {
    // 안개 뭉치가 사라지고 별빛 노바가 떠오른다. 도트가 다시 나와 노바의 첫 친구가 된다.
    morphNoiseToNova(game);
    if (game.renderState?.companion) {
      game.renderState.companion.visible = true;
    }
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="nova">${lines(FINALE.rebirthKo)}</div>
      ${nav('섬으로 돌아간다 →', 'data-finale="done"')}
    `;
    // 노바 재탄생 세리머니 + 맑은 종소리.
    celebrate(game, new THREE.Vector3(0, 3.6, 0), '#7cf0ff', 'core');
    game.audio?.playNovaChime();
    bindNav();
  }

  function finish() {
    // 검증된 상태 전이를 재사용해 코어 완료 플래그를 세운다.
    const outcome = completeFinalCore(game.progress, 'balanced-promise');
    game.progress = outcome.progress;
    persistProgress(game.progress);
    updateHud(game, ui);
    // 최종장 대화창을 닫고 그 위에 증명서를 띄운다(닫으면 섬으로 복귀).
    closeDialog(game, ui);
    showCertificate(game, ui);
  }

  function bindNav() {
    const button = ui.dialogBody.querySelector('[data-finale]');
    if (!button) {
      return;
    }
    button.addEventListener('click', () => {
      game.audio?.playClick();
      const target = button.dataset.finale;
      if (target === 'choice') {
        renderChoice();
      } else if (target === 'rebirth') {
        renderRebirth();
      } else if (target === 'done') {
        finish();
      } else if (target.startsWith('tools:')) {
        renderToolStep(Number(target.slice('tools:'.length)));
      }
    });
  }

  // 전투를 거쳐 왔으면 노이즈는 이미 등장·제압됐으니 바로 [지운다/가르친다] 선택부터.
  if (opts.fromCombat) {
    renderChoice();
  } else {
    renderIntro();
  }
}

function openDialog(game, ui) {
  game.paused = true;
  ui.dialog.hidden = false;
  ui.prompt.hidden = true;
  // 모바일에서 대화창 뒤로 방향 버튼이 비치지 않도록 숨긴다(대화 중엔 이동 불가).
  ui.root.classList.add('is-dialog-open');
  game.updateRotateHint?.();
}

function closeDialog(game, ui) {
  ui.dialog.hidden = true;
  game.paused = false;
  ui.root.classList.remove('is-dialog-open');
  ui.root.classList.remove('is-cinematic');
  ui.root.querySelector('[data-game-canvas]')?.focus?.();
  game.updateRotateHint?.();
  // 최종장을 끝맺지 않고 닫았다면 등장한 노이즈를 치우고 도트를 되돌린다(노바·완료 상태는 유지).
  const boss = game.renderState?.noiseBoss;
  if (boss && boss.kind === 'noise' && !game.progress.aiCoreCompleted) {
    game.renderState.scene.remove(boss.group);
    game.renderState.noiseBoss = null;
    if (game.renderState.companion) {
      game.renderState.companion.visible = true;
    }
  }
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
  ui.objective.textContent = getStoryObjective(game.progress);
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
  if (ui.toolBelt) {
    const owned = new Set(game.progress.tools ?? []);
    ui.toolBelt.innerHTML = PROMISE_TOOLS.map((tool) => {
      const have = owned.has(tool.id);
      const title = have ? `${tool.nameKo} — ${tool.powerKo}` : `${tool.nameKo} (사당에서 획득)`;
      return `<button type="button" class="tool-slot" data-tool-slot="${tool.id}" data-have="${have}" ${have ? '' : 'disabled'} title="${title}">${have ? tool.emoji : '·'}</button>`;
    }).join('');
  }
  renderJournal(game, ui);
}

function renderJournal(game, ui) {
  const summary = getProgressSummary(game.progress.collectedFragments);
  const report = getLearningReport(game.progress);
  const deeds = getStoryDeeds(game.progress);
  ui.journalContent.innerHTML = `
    <p class="controls-note">${MOVE_HINT}</p>
    ${deeds.length > 0
      ? `<section class="learning-report">
           <h3>📖 나의 이야기 — 섬이 기억하는 나의 행동</h3>
           <ul class="deed-list">${deeds.map((d) => `<li>${d.deedKo}</li>`).join('')}</ul>
         </section>`
      : ''}
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
