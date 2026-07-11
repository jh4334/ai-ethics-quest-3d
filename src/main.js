import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { createAudioEngine } from './audio.js';
import { createBurstSystem, createFloatingIcon, setIconEmoji } from './effects.js';
import { CLASSIFY_BUCKETS, getClassifyChallenge, scoreClassify } from './classify.js';
import { createCompanion, createNoiseBoss, createNova, createNpcCharacter, createPlayerCharacter } from './characters.js';
import {
  countMisplaced,
  createPuzzleState,
  cyclePuzzleObject,
  getShrinePuzzle,
  isPuzzleSolved
} from './shrinePuzzle.js';
import { pickMemory } from './bossMemories.js';
import {
  cellToWorld,
  computeBeamPath,
  countRemaining,
  createRoomState,
  firstCrateInLine,
  getDungeonRoom,
  hasDungeonRoom,
  isRoomSolved,
  pickOrPlace,
  pushCrate,
  rotateMirror,
  worldToCell
} from './dungeonPuzzles.js';
import { buildDungeonRoom, disposeDungeonRoom, makeGlyphSprite, syncDungeonVisuals } from './dungeon.js';
import { getStageById, getStageStates, markStageCompleted, markStageVisited, nearestSeaIsland } from './stageData.js';
import { SEA_APPROACH, SEA_RADIUS, SEA_SCALE, buildSeaScene, seaWorldPosition } from './sea.js';
import { ISLE_RADIUS, ISLE_SCENES, healSpiritVisuals } from './isle.js';
import { createCorridorState, stepCorridor } from './corridorLogic.js';
import {
  RUMOR,
  chooseRumorStone,
  createRumorState,
  isEchoStone,
  nearestRumorStone,
  ringRumorBell,
  tickRumor
} from './rumorLogic.js';
import { DUNES, createDunesState, glassAngle, nearestGlass, pullGlass, tickDunes } from './dunesLogic.js';
import { HEART, createHeartState, nearestSeal, sealPulse, tickHeart, useSeal } from './heartLogic.js';
import { RESIDUE, createResidueState, residueIntroHit, strikeResidue, tickResidue, windupGauge } from './residueLogic.js';
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
  ? '왼쪽 스틱 이동 · 오른쪽 A로 확인·공격'
  : 'WASD/방향키 이동 · E·Space 확인/공격 · J 기록';
const ACTION_LABEL = IS_TOUCH ? '' : 'E: ';
const PLAYER_START = new THREE.Vector3(0, 0.55, 15.1);
const ISLAND_RADIUS = 21.6;
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
  camera.position.set(0, 11.5, 20);
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
      // 프롤로그 시네마틱 중에는 카메라를 키프레임이 소유한다(플레이어 추종·조작 정지).
      if (game.cinematic) {
        updateCinematic(raw, game, renderState, ui);
      } else {
        updateGame(delta, game, renderState, ui);
      }
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

      <div class="cinematic" data-cinematic hidden aria-label="프롤로그 연출">
        <div class="cine-bar cine-bar-top"></div>
        <div class="cine-bar cine-bar-bottom"></div>
        <div class="cine-caption" data-cine-caption aria-live="polite"></div>
        <button type="button" class="cine-skip" data-prologue-skip>건너뛰기 ▸</button>
      </div>

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
        <div class="touch-stick" data-stick aria-label="이동 스틱 — 끌어서 이동">
          <div class="stick-knob" data-stick-knob></div>
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
          <p class="title-controls">${IS_TOUCH ? '왼쪽 스틱으로 이동 · 오른쪽 A 버튼으로 확인·공격' : '이동 WASD·방향키 · 확인/공격 E·Space·Enter · 기록 J'}</p>
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
    toolButton: root.querySelector('[data-touch="tool"]'),
    stick: root.querySelector('[data-stick]'),
    stickKnob: root.querySelector('[data-stick-knob]'),
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
    cinematic: root.querySelector('[data-cinematic]'),
    cineCaption: root.querySelector('[data-cine-caption]'),
    cineSkip: root.querySelector('[data-prologue-skip]'),
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
      speed: 6.1,
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
    dungeon: null,
    voyage: null,
    isle: null,
    cinematic: null,
    touchStick: { x: 0, z: 0 },
    idleT: 0,
    overviewT: 0,
    skyGazeT: 0,
    lastCameraMode: 'overworld',
    mode: 'overworld',
    finaleResolving: false,
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
  // 밝고 쨍한 판타지 톤: ACES 필름 톤매핑. 노출은 1 아래로 — 하이라이트가 하얗게 뜨지 않게.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
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
    // 발광 크리스털·코어만 빛나도록 블룸은 약하게·문턱은 높게(밝은 지형·글씨가 번지지 않게).
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.8, 0.85);
    composer.addPass(bloom);
    // 색 보정 + 비네트 — 블룸 뒤, OutputPass(톤매핑·sRGB) 앞의 리니어 공간에서 적용.
    // 풀스크린 쿼드 1드로우·텍스처 페치 1회, 신규 렌더타깃 0(기존 핑퐁 버퍼 재사용).
    const grade = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        saturation: { value: 1.16 },
        contrast: { value: 1.07 },
        vignetteStrength: { value: 0.24 },
        vignetteRadius: { value: 0.62 },
        tint: { value: new THREE.Vector3(1.01, 1.0, 0.985) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float saturation, contrast, vignetteStrength, vignetteRadius;
        uniform vec3 tint;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
          c.rgb = mix(vec3(luma), c.rgb, saturation) * tint;
          // 살짝의 콘트라스트로 희멀건 씻김을 잡는다(리니어 공간, 중간 회색 0.18 기준).
          c.rgb = (c.rgb - 0.18) * contrast + 0.18;
          float d = distance(vUv, vec2(0.5));
          c.rgb *= 1.0 - vignetteStrength * smoothstep(vignetteRadius * 0.55, vignetteRadius, d);
          gl_FragColor = c;
        }`
    });
    composer.addPass(grade);
    composer.addPass(new OutputPass());
    renderState.composer = composer;
    renderState.bloomPass = bloom;
    renderState.gradePass = grade;
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
  // 색을 살리기 위해 안개는 아주 옅게, 먼 배경만 살짝 감싸도록(넓어진 섬에 맞춰 더 멀리서 시작).
  scene.fog = new THREE.Fog(0x9fd9f5, 56, 132);
  renderState.overworldFog = scene.fog;

  // 사당 던전 진입 시 오버월드 전체를 한 번에 숨기려고 Group으로 감싼다.
  const world = new THREE.Group();
  scene.add(world);
  renderState.overworld = world;

  createSky(world, animated);

  // 밝은 하늘빛 + 따뜻한 반사광의 반구광 — 과했던 광량을 낮춰 희멀건 씻김을 잡는다.
  const hemiLight = new THREE.HemisphereLight(0xdff3ff, 0x6f8f66, 1.65);
  world.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xfff0d0, 2.3);
  sun.position.set(-16, 24, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -31;
  sun.shadow.camera.right = 31;
  sun.shadow.camera.top = 31;
  sun.shadow.camera.bottom = -31;
  sun.shadow.bias = -0.0004;
  world.add(sun);

  // 반대쪽에서 들어오는 청록 림 라이트로 판타지 느낌의 입체감을 준다.
  const rim = new THREE.DirectionalLight(0x5ad2ff, 0.7);
  rim.position.set(11, 7, -12);
  world.add(rim);

  createStylizedWater(world, animated);

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(22.9, 20.1, 0.92, 96),
    new THREE.MeshStandardMaterial({ color: 0x86c26a, roughness: 0.92 })
  );
  island.position.y = -0.18;
  island.receiveShadow = true;
  island.castShadow = true;
  world.add(island);

  const beach = new THREE.Mesh(
    new THREE.TorusGeometry(21.8, 0.5, 12, 144),
    new THREE.MeshStandardMaterial({ color: 0xf0dc98, roughness: 0.85 })
  );
  beach.rotation.x = Math.PI / 2;
  beach.position.y = 0.08;
  world.add(beach);

  createGrassField(world);

  createCenterCore(world, animated);

  createDock(world, interactables, renderState);

  renderState.gates = renderState.gates ?? new Map();
  renderState.zoneAuras = renderState.zoneAuras ?? new Map();
  for (const zone of WORLD_ZONES) {
    const zonePosition = new THREE.Vector3(...zone.position);
    createPath(world, zonePosition);
    const landmark = createZone(world, zone, zonePosition);
    createNpc(world, zone, zonePosition, interactables);
    const shrineCrystal = createShrine(world, zone, zonePosition, interactables);
    shrineCrystals.set(zone.shrineId, shrineCrystal);
    createGate(world, zone, interactables, renderState.gates);
    createZoneAura(world, zone, zonePosition, renderState.zoneAuras, landmark);
  }

  for (let i = 0; i < 48; i += 1) {
    const angle = (i / 48) * Math.PI * 2;
    const radius = 17.4 + (i % 4) * 0.95;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 3.0 || Math.abs(z) < 3.0) {
      continue;
    }
    createSmallTree(world, new THREE.Vector3(x, 0, z), i % 3, animated);
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
  const count = 430;
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
    const radius = 2.6 + ((i * 0.618) % 1) * 17.0;
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
  const { interactables, icons } = renderState;
  // 유도 아이콘도 오버월드 그룹에 담아, 던전 진입 시 함께 숨겨지도록 한다.
  const container = renderState.overworld ?? renderState.scene;
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
    container.add(sprite);
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
  let landmark = {};
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
    landmark = createFairnessForest(scene, position);
  } else if (zone.topicId === 'copyright') {
    createCopyrightRuins(scene, position);
  } else {
    landmark = createDeepfakeCave(scene, position);
  }
  return landmark;
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
  const leafMeshes = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const radius = i % 2 === 0 ? 1.5 : 2.2;
    const leaves = createSmallTree(
      scene,
      new THREE.Vector3(position.x + Math.cos(angle) * radius, 0, position.z + Math.sin(angle) * radius),
      i
    );
    // 편향 치유 때 색이 돌아오도록 원래 색을 기억해 둔다.
    leaves.userData.naturalColor = leaves.material.color.clone();
    leafMeshes.push(leaves);
  }
  return { leafMeshes };
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
  return { opening };
}

// 뗏목 선착장 — 남쪽 해변에서 「잡음의 군도」 항해 씬으로 나가는 문.
const DOCK_POS = { x: 3.4, z: 19.6 };

function createDock(scene, interactables, renderStateRef) {
  const dock = new THREE.Group();
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x9a7648, roughness: 0.9 });
  // 물 위로 뻗은 판자 통로.
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 3.6), plankMat);
  walkway.position.set(0, 0.42, 1.2);
  dock.add(walkway);
  for (const [px, pz] of [[-0.6, 0.2], [0.6, 0.2], [-0.6, 2.6], [0.6, 2.6]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.9, 8), plankMat);
    post.position.set(px, 0.12, pz);
    dock.add(post);
  }
  // 정박한 작은 뗏목 + 등불(라이트 없이 발광 재질만).
  const raft = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.14, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.9 })
  );
  raft.position.set(0.2, 0.1, 3.6);
  dock.add(raft);
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd88a })
  );
  lantern.position.set(0.6, 1.0, 2.6);
  dock.add(lantern);
  dock.position.set(DOCK_POS.x, 0, DOCK_POS.z);
  scene.add(dock);

  interactables.push({
    type: 'dock',
    position: new THREE.Vector3(DOCK_POS.x, 0, DOCK_POS.z + 0.6),
    labelKo: '뗏목 선착장 — 군도로 항해'
  });

  // 노바의 우편병 — 새 편지가 있으면 빛난다(animateWorld가 구동).
  const mailPost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.0, 8), plankMat);
  mailPost.position.set(DOCK_POS.x - 3.0, 0.5, DOCK_POS.z - 2.0);
  scene.add(mailPost);
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.62, 10),
    new THREE.MeshStandardMaterial({ color: 0x9fd8e8, emissive: 0x2a5866, emissiveIntensity: 0.4, roughness: 0.25, transparent: true, opacity: 0.9 })
  );
  bottle.position.set(DOCK_POS.x - 3.0, 1.28, DOCK_POS.z - 2.0);
  scene.add(bottle);
  const mailGlow = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 })
  );
  mailGlow.position.set(DOCK_POS.x - 3.0, 1.3, DOCK_POS.z - 2.0);
  mailGlow.visible = false;
  scene.add(mailGlow);
  renderStateRef.novaMailGlow = mailGlow;

  interactables.push({
    type: 'letter',
    position: new THREE.Vector3(DOCK_POS.x - 3.0, 0, DOCK_POS.z - 2.0),
    labelKo: '노바의 우편병'
  });
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
// 모든 구역이 공유하는 노이즈 안개(회색+보라 원반 + 글리치 큐브 5개).
function buildSharedHaze(group) {
  const hazeGroup = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(3.1, 40),
    new THREE.MeshBasicMaterial({ color: 0x6a5f82, transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 1.6;
  hazeGroup.add(disc);
  const pixelMat = new THREE.MeshStandardMaterial({ color: 0x8a7fb0, emissive: 0x5a3d9a, emissiveIntensity: 0.6, roughness: 0.8 });
  const pixels = [];
  for (let i = 0; i < 5; i += 1) {
    const s = 0.14 + (i % 3) * 0.05;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), pixelMat);
    pixels.push(cube);
    hazeGroup.add(cube);
  }
  group.add(hazeGroup);
  return { group: hazeGroup, disc, pixels };
}

// privacy — 몰래 찍힌 사진이 잡음 덩굴 사이를 소용돌이치다, 해결되면 집으로 정착.
function buildPrivacyAura(group, topic) {
  const corruption = new THREE.Group();
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x4a3a63, emissive: 0x5a3d9a, emissiveIntensity: 0.5, roughness: 0.8 });
  const housePts = [[-1.5, -0.7], [1.3, -0.5], [-0.2, 1.2]];
  const vines = [];
  housePts.forEach(([hx, hz], i) => {
    const vine = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 12, Math.PI * 0.9), vineMat);
    vine.position.set(hx, 0.4, hz);
    vine.rotation.x = Math.PI / 2;
    vines.push(vine);
    corruption.add(vine);
  });
  group.add(corruption);
  // 사진 6장 — 항상 존재, 궤도↔정착을 ease로 보간.
  const photoMat = new THREE.MeshBasicMaterial({ color: 0xf6efe2, side: THREE.DoubleSide });
  const photos = [];
  const settle = [];
  housePts.forEach(([hx, hz]) => {
    settle.push(new THREE.Vector3(hx - 0.25, 0.98, hz + 0.5));
    settle.push(new THREE.Vector3(hx + 0.25, 0.72, hz + 0.5));
  });
  for (let i = 0; i < 6; i += 1) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), photoMat);
    q.position.set(Math.cos(i * 1.3) * 1.6, 0.9, Math.sin(i * 1.3) * 1.6);
    group.add(q);
    photos.push(q);
  }
  const heal = new THREE.Group();
  const rc = new THREE.Color(topic.color);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.06, 8, 40),
    new THREE.MeshStandardMaterial({ color: rc, emissive: rc, emissiveIntensity: 0.6, roughness: 0.4 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.16;
  heal.add(ring);
  heal.scale.setScalar(0.001);
  group.add(heal);
  const orbit = new THREE.Vector3();
  return {
    corruption,
    heal,
    animate: (elapsed, delta, ease) => {
      vines.forEach((v, i) => { v.rotation.z = i + Math.sin(elapsed * 2 + i) * 0.3; });
      photos.forEach((q, i) => {
        const a = elapsed * (0.5 + (i % 3) * 0.2) + i * 1.3;
        const r = 1.6 + (i % 3) * 0.3;
        orbit.set(Math.cos(a) * r, 0.9 + Math.sin(elapsed * 1.5 + i) * 0.4, Math.sin(a) * r);
        q.position.lerpVectors(orbit, settle[i], ease);
        q.rotation.y = a * (1 - ease);
        q.rotation.z = (1 - ease) * Math.sin(elapsed + i) * 0.5;
      });
      ring.rotation.z += delta * 0.4;
      ring.material.emissiveIntensity = 0.4 + Math.sin(elapsed * 2) * 0.2;
    }
  };
}

// bias — 숲이 빨강 단색 + 빨간 책만, 해결되면 색이 돌아오고 다색 꽃이 핀다.
function buildBiasAura(group, topic, landmark) {
  const corruption = new THREE.Group();
  const bookMat = new THREE.MeshStandardMaterial({ color: 0xb03535, emissive: 0x5a1010, emissiveIntensity: 0.3, roughness: 0.8 });
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 1;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.16), bookMat);
    b.position.set(Math.cos(a) * 1.4, 0.06, Math.sin(a) * 1.4);
    b.rotation.y = a;
    b.rotation.z = 0.2;
    corruption.add(b);
  }
  group.add(corruption);
  const heal = new THREE.Group();
  const palette = [0xf2c14e, 0x8a5eb8, 0xf5f2ff, 0xe08aa8, 0x3f8f75, 0xc98a32, 0x6f7fd3];
  const flowers = [];
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + i;
    const r = 1.7 + (i % 3) * 0.5;
    const c = new THREE.Color(palette[i % palette.length]);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x4f935a, roughness: 0.9 }));
    const petals = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.5, flatShading: true }));
    petals.position.y = 0.32;
    const f = new THREE.Group();
    f.add(stem, petals);
    f.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r);
    f.userData.seed = i;
    heal.add(f);
    flowers.push(f);
  }
  heal.scale.setScalar(0.001);
  group.add(heal);
  const leafMeshes = landmark?.leafMeshes ?? [];
  const redC = new THREE.Color(0xb03535);
  return {
    corruption,
    heal,
    animate: (elapsed, delta, ease) => {
      leafMeshes.forEach((leaf) => {
        const nat = leaf.userData.naturalColor;
        if (nat) {
          leaf.material.color.lerpColors(redC, nat, ease);
        }
      });
      flowers.forEach((f, i) => { f.rotation.z = Math.sin(elapsed * 1.6 + (f.userData.seed ?? i)) * 0.18; });
    }
  };
}

// copyright — 이름 잃은 회색 조각상 + 떠는 가짜 복제상, 해결되면 색·금빛 명판이 돌아온다.
function buildCopyrightAura(group, topic) {
  const corruption = new THREE.Group();
  const fakeMat = new THREE.MeshStandardMaterial({ color: 0x9a8fb0, transparent: true, opacity: 0.35, roughness: 0.9 });
  const fakes = [];
  [[-1.9, 0.3], [1.9, 0.3]].forEach(([fx, fz]) => {
    const s = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.3, 10), fakeMat);
    base.position.y = 0.15;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.22), fakeMat);
    body.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), fakeMat);
    head.position.y = 0.92;
    s.add(base, body, head);
    s.position.set(fx, 0, fz);
    s.userData.baseX = fx;
    corruption.add(s);
    fakes.push(s);
  });
  group.add(corruption);
  const statueMats = [];
  const plateMats = [];
  [-1.2, 0, 1.2].forEach((sx) => {
    const mk = (geo) => new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8f8f94, roughness: 0.85 }));
    const base = mk(new THREE.CylinderGeometry(0.26, 0.32, 0.3, 12));
    base.position.set(sx, 0.15, -0.4);
    const body = mk(new THREE.BoxGeometry(0.32, 0.52, 0.24));
    body.position.set(sx, 0.56, -0.4);
    const head = mk(new THREE.SphereGeometry(0.15, 14, 12));
    head.position.set(sx, 0.95, -0.4);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), new THREE.MeshStandardMaterial({ color: 0x3a3a40, emissive: 0x000000, roughness: 0.7, side: THREE.DoubleSide }));
    plate.position.set(sx, 0.34, -0.26);
    group.add(base, body, head, plate);
    statueMats.push(base.material, body.material, head.material);
    plateMats.push(plate.material);
  });
  const heal = new THREE.Group();
  const tag = createLabelSprite('원작: 조각가 무로', '#f2c14e');
  tag.scale.set(2, 0.46, 1);
  tag.position.set(0, 1.5, -0.4);
  heal.add(tag);
  heal.scale.setScalar(0.001);
  group.add(heal);
  const greyC = new THREE.Color(0x8f8f94);
  const warmC = new THREE.Color(0xd9b98a);
  const emptyC = new THREE.Color(0x3a3a40);
  const goldC = new THREE.Color(0xf2c14e);
  const plateE0 = new THREE.Color(0x000000);
  const plateE1 = new THREE.Color(0x7a5a12);
  return {
    corruption,
    heal,
    animate: (elapsed, delta, ease) => {
      fakes.forEach((s, k) => { s.position.x = s.userData.baseX + Math.sin(elapsed * 7 + k) * 0.05; });
      statueMats.forEach((m) => { m.color.lerpColors(greyC, warmC, ease); });
      plateMats.forEach((m) => {
        m.color.lerpColors(emptyC, goldC, ease);
        m.emissive.lerpColors(plateE0, plateE1, ease);
      });
    }
  };
}

// deepfake — 세 곳에서 똑같이 울리는 가짜 목소리, 해결되면 가짜는 사라지고 진짜 하나만 따뜻하게.
function buildDeepfakeAura(group, topic, landmark) {
  const corruption = new THREE.Group();
  const positions = [[-1.2, -1.2], [0, -1.6], [1.2, -1.2]];
  const voices = [];
  positions.forEach(([vx, vz], idx) => {
    const isReal = idx === 1;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a5eb8, emissive: 0x8a5eb8, emissiveIntensity: 0.8, roughness: 0.5 })
    );
    orb.position.set(vx, 0.8, vz);
    const rings = [];
    for (let k = 0; k < 2; k += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.14, 0.2, 24),
        new THREE.MeshBasicMaterial({ color: isReal ? 0xffc46b : 0x8a5eb8, transparent: true, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(vx, 0.5, vz);
      rings.push(ring);
      (isReal ? group : corruption).add(ring);
    }
    (isReal ? group : corruption).add(orb);
    voices.push({ orb, rings, isReal });
  });
  group.add(corruption);
  const heal = new THREE.Group();
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xffe9c0, emissive: 0xffc46b, emissiveIntensity: 1, roughness: 0.3 })
  );
  glow.position.set(0, 0.9, -1.6);
  heal.add(glow);
  heal.scale.setScalar(0.001);
  group.add(heal);
  const opening = landmark?.opening;
  const darkC = new THREE.Color(0x1c1826);
  const caveWarmC = new THREE.Color(0x8a5a2e);
  const fakeC = new THREE.Color(0x8a5eb8);
  const realC = new THREE.Color(0xffc46b);
  return {
    corruption,
    heal,
    animate: (elapsed, delta, ease) => {
      voices.forEach((v, idx) => {
        v.rings.forEach((ring, k) => {
          const phase = (elapsed * 0.7 + idx / 3 + k * 0.5) % 1;
          ring.scale.setScalar(0.3 + phase * 1.3);
          ring.material.opacity = (0.5 * (1 - phase)) * (v.isReal ? ease : 1 - ease * 0.9);
        });
        if (v.isReal) {
          v.orb.material.color.lerpColors(fakeC, realC, ease);
          v.orb.material.emissive.lerpColors(fakeC, realC, ease);
        }
      });
      if (opening) {
        opening.material.color.lerpColors(darkC, caveWarmC, ease);
      }
    }
  };
}

const ZONE_AURA_BUILDERS = {
  privacy: buildPrivacyAura,
  bias: buildBiasAura,
  copyright: buildCopyrightAura,
  deepfake: buildDeepfakeAura
};

// 구역 세계 상태: 미해결이면 구역별 오염 연출, 해결되면 구역별 치유 연출로 전환된다.
function createZoneAura(scene, zone, position, zoneAuras, landmark) {
  const topic = getTopicById(zone.topicId);
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  const haze = buildSharedHaze(group);
  const build = ZONE_AURA_BUILDERS[zone.topicId] ?? buildBiasAura;
  const parts = build(group, topic, landmark ?? {});
  scene.add(group);
  zoneAuras.set(zone.topicId, {
    haze: haze.group,
    hazeDisc: haze.disc,
    pixels: haze.pixels,
    corruption: parts.corruption,
    heal: parts.heal,
    animate: parts.animate,
    t: 0
  });
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
  return leaves;
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
  context.fillStyle = 'rgba(12, 20, 26, 0.92)';
  roundRect(context, 22, 22, 468, 84, 18);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 8;
  roundRect(context, 22, 22, 468, 84, 18);
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = '800 48px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 66);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      // 멀리 있는 이름표가 안개에 씻겨 뿌옇게 되지 않도록.
      fog: false
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
    if (!isFormControl && !event.repeat && (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space')) {
      // event.repeat 무시: 키를 누른 채로 있어도 확인/공격이 연속 발동하지 않게(던전 즉시 퇴장 방지).
      event.preventDefault();
      primaryAction(game, ui);
    }
    if (event.code === 'KeyJ') {
      event.preventDefault();
      toggleJournal(game, ui);
    }
    // F: 도구의 '동사' 발동 — 전투에선 방패 가드, 밀기 던전에선 나침반 끌어당기기.
    if (!isFormControl && !event.repeat && event.code === 'KeyF') {
      event.preventDefault();
      useToolVerb(game, ui);
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
        // 던전·회랑 = 동사 발동. 전투 = 방패를 들었으면 가드, 아니면 도구 전환(벨트 탭으로도 전환 가능).
        if (game.dungeon?.active || game.isle?.challenge) {
          useToolVerb(game, ui);
        } else if (game.combat?.active && game.combat.tools[game.combat.activeTool] === 'shield') {
          useToolVerb(game, ui);
        } else {
          cycleActiveTool(game, ui, 1);
        }
      }
    };
    button.addEventListener('pointerdown', down);
    return () => {
      button.removeEventListener('pointerdown', down);
    };
  });

  // 가상 조이스틱 — 베이스 안에서 노브를 끄는 방향이 곧 이동 방향(아날로그 방향 · 일정 속도).
  let stopStick = () => {};
  if (ui.stick && ui.stickKnob) {
    let stickPointerId = null;
    const applyStick = (event) => {
      const rect = ui.stick.getBoundingClientRect();
      const half = rect.width / 2;
      let dx = (event.clientX - (rect.left + half)) / half;
      let dy = (event.clientY - (rect.top + half)) / half;
      const length = Math.hypot(dx, dy);
      if (length > 1) {
        dx /= length;
        dy /= length;
      }
      game.touchStick.x = dx;
      game.touchStick.z = dy;
      const travel = half * 0.6; // 노브 이동 반경
      ui.stickKnob.style.transform = `translate(${dx * travel}px, ${dy * travel}px)`;
    };
    const resetStick = () => {
      stickPointerId = null;
      game.touchStick.x = 0;
      game.touchStick.z = 0;
      ui.stickKnob.style.transform = 'translate(0px, 0px)';
    };
    const stickDown = (event) => {
      event.preventDefault();
      stickPointerId = event.pointerId;
      ui.stick.setPointerCapture(event.pointerId);
      applyStick(event);
    };
    const stickMove = (event) => {
      if (event.pointerId === stickPointerId) {
        applyStick(event);
      }
    };
    const stickUp = (event) => {
      if (event.pointerId === stickPointerId) {
        resetStick();
      }
    };
    ui.stick.addEventListener('pointerdown', stickDown);
    ui.stick.addEventListener('pointermove', stickMove);
    ui.stick.addEventListener('pointerup', stickUp);
    ui.stick.addEventListener('pointercancel', stickUp);
    stopStick = () => {
      resetStick();
      ui.stick.removeEventListener('pointerdown', stickDown);
      ui.stick.removeEventListener('pointermove', stickMove);
      ui.stick.removeEventListener('pointerup', stickUp);
      ui.stick.removeEventListener('pointercancel', stickUp);
    };
  }

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    stopStick();
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
      // 첫 플레이라면 인엔진 시네마틱으로 이야기를 열어 준다.
      if (!game.progress.prologueSeen) {
        startPrologueCinematic(game, ui);
      }
    }, 420);
  }
}

// 프롤로그 인엔진 시네마틱 — 카메라 플라이오버 + 레터박스 + 자막 카드. 외부 영상 파일 0.
// 키프레임은 전부 상수(초 단위)라 결정적이다. 마지막 키(플레이어 추종 위치로 수렴)는
// 시작 시점의 플레이어 좌표로 계산해 붙인다 — snapCamera/updateCamera 상수와 반드시 일치.
const CINEMATIC_KEYS = [
  { t: 0, pos: [0, 11.5, 20], look: [0, 1.4, 0] }, // 타이틀 전경을 그대로 이어받는다
  { t: 3.6, pos: [0, 31, 44], look: [0, 0.5, 0] }, // 상승 — 섬 전체가 한눈에
  { t: 7.4, pos: [-24, 15, 17], look: [-13, 1, -8] }, // 서쪽 사당 지붕을 스치듯
  { t: 11.2, pos: [21, 13, -12], look: [13, 1, 5] } // 잿빛 안개 지대를 가로질러
];
const CINEMATIC_LAST_KEY_T = 14.6; // 여기서 플레이어 추종 위치에 도착
const CINEMATIC_END = 15.4;
// 자막 카드: PROLOGUE 비트를 그대로 재사용한다(스토리 데이터 단일 출처).
const CINEMATIC_CAPTIONS = [
  { beat: 0, from: 0.9, to: 6.8 },
  { beat: 1, from: 7.8, to: 14.0 },
  { beat: 'closing', from: 14.2, to: 15.3 }
];

function startPrologueCinematic(game, ui) {
  if (!ui.cinematic) {
    // 안전망: 오버레이가 없으면 연출 없이 본 것으로 처리한다.
    game.progress = { ...game.progress, prologueSeen: true };
    persistProgress(game.progress);
    return;
  }
  const p = game.player.position;
  game.cinematic = {
    t: 0,
    captionKey: null,
    keys: [
      ...CINEMATIC_KEYS,
      {
        t: CINEMATIC_LAST_KEY_T,
        pos: [p.x * 0.9, p.y + 8.7, p.z + 13.8],
        look: [p.x, p.y + 1.35, p.z - 1.2]
      }
    ]
  };
  ui.cineCaption.classList.remove('is-visible');
  ui.cinematic.hidden = false;
  void ui.cinematic.offsetWidth; // 리플로우로 레터박스 슬라이드 인 트랜지션 재생
  ui.cinematic.classList.add('is-on');
  // 재시작('처음부터')에도 중복 바인딩되지 않게 프로퍼티 할당.
  ui.cineSkip.onclick = () => {
    game.audio?.playClick();
    finishPrologueCinematic(game, ui);
  };
}

function updateCinematic(delta, game, renderState, ui) {
  const c = game.cinematic;
  c.t += delta;
  // 키프레임 구간 보간(스무스스텝) — 구간 경계마다 살짝 멈춰 자막을 읽을 틈을 준다.
  const keys = c.keys;
  let a = keys[keys.length - 1];
  let b = a;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (c.t >= keys[i].t && c.t < keys[i + 1].t) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const span = b.t - a.t;
  const s = span > 0 ? Math.min(1, Math.max(0, (c.t - a.t) / span)) : 1;
  const e = s * s * (3 - 2 * s);
  const camera = renderState.camera;
  camera.position.set(
    a.pos[0] + (b.pos[0] - a.pos[0]) * e,
    a.pos[1] + (b.pos[1] - a.pos[1]) * e,
    a.pos[2] + (b.pos[2] - a.pos[2]) * e
  );
  camera.lookAt(
    a.look[0] + (b.look[0] - a.look[0]) * e,
    a.look[1] + (b.look[1] - a.look[1]) * e,
    a.look[2] + (b.look[2] - a.look[2]) * e
  );
  // 자막 카드 전환.
  const cap = CINEMATIC_CAPTIONS.find((k) => c.t >= k.from && c.t < k.to) ?? null;
  const key = cap ? cap.beat : null;
  if (key !== c.captionKey) {
    c.captionKey = key;
    renderCineCaption(ui, key);
  }
  // 플라이오버 중에도 세계는 살아 있게(크리스털 회전·잡음 관문 지지직).
  animateWorld(delta, renderState, game);
  if (c.t >= CINEMATIC_END) {
    finishPrologueCinematic(game, ui);
  }
}

function renderCineCaption(ui, key) {
  if (key === null) {
    ui.cineCaption.classList.remove('is-visible');
    return;
  }
  if (key === 'closing') {
    ui.cineCaption.innerHTML = `<p class="cine-closing">— ${PROLOGUE.closingKo} —</p>`;
  } else {
    const beat = PROLOGUE.beats[key];
    const speaker = beat.speakerKo
      ? `<p class="cine-speaker">${beat.speakerKo === '도트' ? '✨ ' : ''}${beat.speakerKo}</p>`
      : '';
    const lines = beat.linesKo.map((text) => `<p>${text}</p>`).join('');
    ui.cineCaption.innerHTML = `${speaker}${lines}`;
  }
  ui.cineCaption.classList.add('is-visible');
}

function finishPrologueCinematic(game, ui) {
  if (!game.cinematic) {
    return;
  }
  game.cinematic = null;
  game.progress = { ...game.progress, prologueSeen: true };
  persistProgress(game.progress);
  ui.cineCaption.classList.remove('is-visible');
  ui.cinematic.classList.remove('is-on');
  window.setTimeout(() => {
    ui.cinematic.hidden = true;
  }, 720);
  // 다음 프레임부터 플레이어 추종이 이어받도록 즉시 스냅(활공 방지).
  snapCamera(game.renderState.camera, game.player.position);
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
    <p class="cert-name">이 증명서의 수호자: <span class="cert-name-line" aria-label="이름을 손으로 적는 칸"></span></p>
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
  syncToolButton(game, ui);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - delta * 3.2);
  }
  // 유휴 조망: 3초간 입력이 없으면 씬 전체가 보이게 카메라가 물러난다(근시안 보정).
  // 전투·섬 도전 중엔 끈다 — 타이밍 게임을 방해하지 않게. 씬 전환 시엔 리셋.
  if (game.lastCameraMode !== game.mode) {
    game.lastCameraMode = game.mode;
    game.idleT = 0;
    game.overviewT = 0;
  }
  game.idleT = game.player.moving ? 0 : game.idleT + delta;
  // 에필로그 별똥별 동안은 시선을 하늘로 들어올린다("하늘을 봐!") — 조망과는 배타.
  const skyGazing = game.renderState?.starShower?.active === true;
  const overviewBlocked = game.combat?.active || (game.isle?.challenge && !game.isle.challenge.cleared) || skyGazing;
  if (!overviewBlocked && game.idleT > 3) {
    game.overviewT = Math.min(1, game.overviewT + delta * 0.7);
  } else {
    game.overviewT = Math.max(0, game.overviewT - delta * 2.2);
  }
  if (skyGazing) {
    game.skyGazeT = Math.min(1, game.skyGazeT + delta * 1.1);
  } else {
    game.skyGazeT = Math.max(0, game.skyGazeT - delta * 1.5);
  }
  updateCamera(renderState.camera, game);
  updateCompanion(delta, game, renderState);
  // 던전 안에서는 오버월드 애니메이션/상호작용을 멈추고 방 로직만 돌린다(저사양 이득).
  if (game.mode === 'dungeon') {
    updateDungeon(delta, game, ui);
    return;
  }
  if (game.mode === 'voyage') {
    updateVoyage(delta, game, ui);
    return;
  }
  if (game.mode === 'isle') {
    updateIsle(delta, game, ui);
    return;
  }
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
  // 터치 스틱이 기울어 있으면 그 방향으로 걷는다(아날로그 방향 · 일정 속도 — 결정성 유지).
  const stick = game.touchStick;
  if (stick && Math.hypot(stick.x, stick.z) > 0.22) {
    move.set(stick.x, 0, stick.z);
  }

  const moving = move.lengthSq() > 0;
  game.player.moving = moving;
  if (moving) {
    move.normalize();
    game.player.direction.copy(move);
    game.player.position.addScaledVector(move, game.player.speed * delta);
    game.player.position.copy(
      game.mode === 'dungeon'
        ? clampToRoom(game.player.position, game.dungeon?.bounds)
        : game.mode === 'voyage'
          ? clampToSea(game.player.position)
          : game.mode === 'isle'
            ? clampToRadius(game.player.position, ISLE_RADIUS)
            : clampToIsland(game.player.position)
    );
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

// 던전 방 AABB 클램프(벽을 뚫지 않도록).
function clampToRoom(position, bounds) {
  if (!bounds) {
    return position;
  }
  return new THREE.Vector3(
    Math.max(bounds.minX, Math.min(bounds.maxX, position.x)),
    position.y,
    Math.max(bounds.minZ, Math.min(bounds.maxZ, position.z))
  );
}

function updateCamera(camera, game) {
  const target = game.player.position;
  const shake = game.shake;
  // 살짝 낮고 뒤로 물러난 각도. 시선은 항상 플레이어를 향한다 —
  // 예전 중심 편향(x*0.6·시선 x*0.4)은 넓은 바다·확장 섬에서 캐릭터를 화면 밖으로 밀어냈다.
  // x*0.9의 약한 편향만 남겨 이동 방향의 앞이 살짝 더 보이게 한다.
  const desired = new THREE.Vector3(target.x * 0.9, target.y + 8.7, target.z + 13.8);
  const look = new THREE.Vector3(target.x, target.y + 1.35, target.z - 1.2);
  // 유휴 조망 뷰(씬별 고정 좌표)와 스무스스텝 블렌드.
  const ovView = OVERVIEW_VIEWS[game.mode] ?? OVERVIEW_VIEWS.overworld;
  const raw = game.overviewT;
  const blend = raw * raw * (3 - 2 * raw);
  if (blend > 0) {
    desired.lerp(new THREE.Vector3(...ovView.pos), blend);
    look.lerp(new THREE.Vector3(...ovView.look), blend);
  }
  // 에필로그 별똥별: 시선만 하늘로 들어올린다(카메라 위치는 그대로 — 복귀가 부드럽다).
  const sgRaw = game.skyGazeT ?? 0;
  if (sgRaw > 0) {
    const sg = sgRaw * sgRaw * (3 - 2 * sgRaw);
    look.y += sg * 15;
    look.z -= sg * 26;
  }
  camera.position.lerp(desired, 0.08);
  // 화면 흔들림(타격·피격 순간): 카메라를 잠깐 떨어 손맛을 준다.
  if (shake > 0) {
    const s = shake * 0.5;
    const t = clock.elapsedTime * 90;
    camera.position.x += Math.sin(t) * s;
    camera.position.y += Math.cos(t * 1.3) * s;
  }
  camera.lookAt(look.x, look.y, look.z);
}

// 유휴 조망 카메라의 씬별 고정 시점 — 그 씬 전체가 한눈에 들어오는 높이.
const OVERVIEW_VIEWS = {
  overworld: { pos: [0, 48, 36], look: [0, 0, 0] },
  dungeon: { pos: [0, 26, 15], look: [0, 0.5, -1] },
  voyage: { pos: [0, 105, 42], look: [0, 0, -34] },
  isle: { pos: [0, 36, 26], look: [0, 0, 0] }
};

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

function animateWorld(delta, { shrineCrystals, coreCrystal, coreGlow, gates, zoneAuras, novaMailGlow }, game) {
  const elapsed = clock.elapsedTime;
  // 에필로그 별똥별: 결정적 경로로 하늘을 가로지르고 스스로 정리된다.
  const shower = game.renderState?.starShower;
  if (shower?.active) {
    shower.t += delta;
    let alive = false;
    for (const star of shower.stars) {
      const lt = shower.t - star.userData.delay;
      if (lt < 0) {
        continue;
      }
      if (lt > 4.5) {
        star.visible = false;
        continue;
      }
      alive = true;
      star.visible = true;
      const s0 = star.userData.start;
      star.position.set(s0.x - lt * 7.5, s0.y - lt * 0.9, s0.z + lt * 0.6);
      star.material.opacity = Math.max(0, 1 - lt / 4.5);
      star.rotation.z = -0.12; // 낙하 방향으로 살짝 기운 꼬리
    }
    if (!alive && shower.t > 1) {
      disposeDungeonRoom(shower.group, game.renderState.overworld);
      game.renderState.starShower = { active: false };
    }
  }

  // 노바의 우편병: 안 읽은 편지가 있으면 별 조각이 떠서 반짝인다.
  if (novaMailGlow) {
    const unreadCount = getUnreadNovaLetters(game.progress).length;
    novaMailGlow.visible = unreadCount > 0;
    if (novaMailGlow.visible) {
      novaMailGlow.position.y = 1.6 + Math.sin(elapsed * 2.4) * 0.14;
      novaMailGlow.rotation.y += delta * 2.2;
    }
  }
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

  // 구역 세계 상태: 미해결이면 구역별 오염, 해결되면 구역별 치유로 부드럽게 전환.
  if (zoneAuras) {
    const flags = getStoryVisualFlags(game.progress);
    for (const [topicId, aura] of zoneAuras.entries()) {
      const solved = flags.has(`${topicId}:solved`);
      aura.t += ((solved ? 1 : 0) - aura.t) * Math.min(1, delta * 2.5);
      const t = aura.t;
      const ease = t * t * (3 - 2 * t); // smoothstep
      // 공유 노이즈 안개는 걷힌다.
      aura.hazeDisc.material.opacity = 0.36 * (1 - ease);
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
      if (aura.corruption) {
        aura.corruption.visible = ease < 0.98;
        aura.corruption.scale.setScalar(Math.max(0.001, 1 - ease));
      }
      if (aura.heal) {
        aura.heal.scale.setScalar(Math.max(0.001, ease));
        aura.heal.visible = ease > 0.02;
      }
      aura.animate?.(elapsed, delta, ease);
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

// 도구의 '동사' 발동(F/던전 도구버튼) — 도구는 열쇠가 아니라 세계와 상호작용하는 수단이다.
// 전투: 방패=가드(반사) · 종=울림 충격파 · 거울=약점 공개. 던전: 방별 동사(당기기/공명/판별).
// 터치 도구(F) 버튼 아이콘을 맥락 동사와 일치시킨다 — 태블릿에서 '누르면 무엇이 나가는지' 보이게.
const TOOL_EMOJI = { shield: '🛡️', compass: '🧭', bell: '🔔', mirror: '🪞' };
const DUNGEON_VERB_EMOJI = { push: '🧭', carry: '🔔', beam: '🪞' };
const ISLE_VERB_EMOJI = {
  'whisper-cape': '🛡️',
  'echo-cave': '🔔',
  'hourglass-port': '🧭',
  'memory-outer': '💠',
  'memory-core': '⚡'
};

function syncToolButton(game, ui) {
  if (!ui.toolButton) {
    return;
  }
  let icon = '🔄';
  if (game.dungeon?.active) {
    icon = DUNGEON_VERB_EMOJI[game.dungeon.room.mechanic] ?? '🔄';
  } else if (game.isle) {
    icon = ISLE_VERB_EMOJI[game.isle.stageId] ?? '🔄';
  } else if (game.combat?.active) {
    icon = TOOL_EMOJI[game.combat.tools[game.combat.activeTool]] ?? '🔄';
  }
  if (ui.toolButton.textContent !== icon) {
    ui.toolButton.textContent = icon;
  }
}

function useToolVerb(game, ui) {
  game.audio?.resume();
  game.idleT = 0;
  // 섬 도전 중엔 F = 그 섬의 동사(곶 = 가드, 동굴 = 울림, 항구 = 당기기, 심장 외곽 = 봉인 해제).
  if (game.isle?.challenge && !game.isle.challenge.cleared) {
    if (game.isle.stageId === 'echo-cave') {
      rumorBell(game, ui);
    } else if (game.isle.stageId === 'hourglass-port') {
      dunesPull(game, ui);
    } else if (game.isle.stageId === 'memory-outer') {
      heartUse(game, ui);
    } else if (game.isle.stageId === 'memory-core') {
      residueUse(game, ui);
    } else {
      corridorGuard(game, ui);
    }
    return;
  }
  if (game.combat?.active) {
    const toolId = game.combat.tools[game.combat.activeTool];
    if (toolId === 'shield') {
      shieldGuard(game, ui);
    } else if (toolId === 'bell') {
      bellShockwave(game, ui);
    } else if (toolId === 'mirror') {
      mirrorReveal(game, ui);
    } else {
      game.combat.hintHold = 1.4;
      ui.bossHint.textContent = '🧭 나침반은 길을 찾는 도구 — 전투에선 방패·종·거울을 써 봐요';
      game.audio?.playClick();
    }
    return;
  }
  const dg = game.dungeon;
  if (!dg?.active) {
    return;
  }
  if (dg.room.mechanic === 'push') {
    compassPull(game, ui);
  } else if (dg.room.mechanic === 'carry') {
    bellResonate(game, ui);
  } else if (dg.room.mechanic === 'beam') {
    mirrorTruthLens(game, ui);
  }
}

// 🛡️ 방패 가드: 짧은 가드 자세 — 그 사이 잡음 파도가 닿으면 스턴 대신 반사한다.
const GUARD_TIME = 0.55;
const GUARD_COOLDOWN = 1.4;

// 심부의 잔영전 — 패배 연출 단계에선 전부 튕겨나고, 각성 후엔 공격 자세의 절정에 껍질을 깬다.
function residueUse(game, ui) {
  const isle = game.isle;
  if (!isle || isle.pullCd > 0 || !isle.challenge) {
    return;
  }
  const ch = isle.challenge;
  if (ch.stage === 'defeated') {
    return;
  }
  const distance = Math.hypot(
    game.player.position.x - RESIDUE.boss.x,
    game.player.position.z - RESIDUE.boss.z
  );
  if (distance > RESIDUE.useRange) {
    game.audio?.playClick();
    flashCombatPopup(ui, '잔영에게 더 가까이!', 'miss');
    return;
  }
  isle.pullCd = 0.6;
  if (ch.stage === 'intro') {
    // 패배 연출: 어떤 힘도 닿지 않는다.
    const events = residueIntroHit(ch);
    game.audio?.playWrong();
    addShake(game, 0.35);
    flashCombatPopup(ui, '튕겨났다! 힘이… 닿지 않아?!', 'miss');
    if (events.includes('awaken')) {
      residueAwaken(game, ui);
    }
    return;
  }
  const events = strikeResidue(ch);
  for (const event of events) {
    if (event === 'early') {
      game.audio?.playWrong();
      flashCombatPopup(ui, '아직! 잔영이 공격 자세의 절정일 때(F)!', 'miss');
    } else if (event === 'break') {
      game.audio?.playCorrect();
      addShake(game, 0.4);
      const brokenCount = Math.min(ch.phase, RESIDUE.phases.length);
      const broken = RESIDUE.phases[brokenCount - 1];
      flashCombatPopup(ui, `${broken.emoji} ${broken.nameKo} — 껍질 파괴! (${brokenCount}/${RESIDUE.phases.length})`, 'match');
      const ring = isle.built.shellRings[brokenCount - 1];
      if (ring) {
        ring.visible = false;
      }
      if (!events.includes('defeated') && ch.stage === 'fight') {
        const next = RESIDUE.phases[ch.phase];
        ui.puzzleGoal.textContent = `지금 껍질: ${next.emoji} ${next.nameKo}`;
      }
    } else if (event === 'defeated') {
      finishResidue(game, ui);
    }
  }
}

// 각성 연출: 치유한 정령들의 목소리가 진짜 힘을 깨운다.
function residueAwaken(game, ui) {
  const isle = game.isle;
  isle.built.spiritOrbs.forEach((orb) => {
    orb.visible = true;
  });
  game.audio?.playNovaChime();
  triggerFlash(ui, '#ffffff');
  const first = RESIDUE.phases[0];
  ui.puzzleGoal.textContent = `지금 껍질: ${first.emoji} ${first.nameKo}`;
  ui.puzzleHint.textContent = '잔영이 공격 자세의 절정일 때 약속의 힘(F)!';
  ui.dialogKicker.textContent = '기억의 심장 심부';
  ui.dialogTitle.textContent = '정령들의 목소리';
  ui.dialogBody.innerHTML = speechHtml([
    '🕊️ "수호자! 도구를 *갖고 있는 것*과 *쓸 줄 아는 것*은 달라 — 우리가 함께 배웠잖아!"',
    '🐋 "출처를 묻던 그 울림을 기억해!" 🐢 "멈출 때를 알던 그 손을 기억해!"',
    '✨ 도트: "네 가지 약속이 하나로 깨어난다 — 이제 잔영의 공격 자세를 노려, 절정의 순간에 힘을 써!"'
  ]);
  openDialog(game, ui);
}

// 잔영 격파: 2막 엔딩 — 기억의 별이 떠오르고 군도가 완전히 치유된다.
function finishResidue(game, ui) {
  const isle = game.isle;
  isle.built.heal();
  game.progress = markStageCompleted(game.progress, isle.stageId);
  persistProgress(game.progress);
  updateHud(game, ui);
  game.audio?.playCoreAwaken();
  triggerFlash(ui, '#fff3c0');
  ui.puzzleGoal.textContent = ISLE_CONTENT[isle.stageId].healedGoalKo;
  ui.puzzleHint.textContent = '뗏목으로 돌아가면 다시 바다로';
  ui.dialogKicker.textContent = '🌊 잡음의 군도 — 완전 치유';
  ui.dialogTitle.textContent = '✨ 도트';
  ui.dialogBody.innerHTML = speechHtml([
    '"잔영이… 빛으로 흩어졌어. 외로웠던 기억도, 묻혀 버린 목소리도, 쉬지 못한 밤도 — 전부 별이 되어 돌아오고 있어!"',
    '"봐, 수호자 — 곶의 바닷새도, 동굴의 고래도, 항구의 거북도, 이제 모두 건강해. 군도의 항로가 전부 열렸어."',
    '"이 모험을 잊지 마. 방패처럼 지켜 주고, 종처럼 물어보고, 모래시계처럼 멈출 줄 알고, 거울처럼 서로를 비춰 주기 — 그게 네가 완성한 네 가지 약속이야. 🏅"'
  ]);
  openDialog(game, ui);
}

// 기억의 심장 외곽의 봉인 해제 — 봉인석의 빛이 가장 환해진 순간 약속의 힘(F)을 쓴다.
function heartUse(game, ui) {
  const isle = game.isle;
  if (!isle || isle.pullCd > 0 || !isle.challenge || isle.challenge.cleared) {
    return;
  }
  isle.pullCd = 0.6;
  const seal = nearestSeal(isle.challenge, game.player.position.x, game.player.position.z);
  if (!seal) {
    game.audio?.playClick();
    flashCombatPopup(ui, '봉인석 가까이에서 약속의 힘(F)을 써요', 'miss');
    return;
  }
  const events = useSeal(isle.challenge, seal.id);
  for (const event of events) {
    if (event === 'dim') {
      game.audio?.playWrong();
      flashCombatPopup(ui, '아직 어두워요 — 빛이 가장 환해지는 순간에!', 'miss');
    } else if (event === 'released') {
      game.audio?.playCorrect();
      const count = Object.values(isle.challenge.released).filter(Boolean).length;
      flashCombatPopup(ui, `${seal.emoji} ${seal.nameKo}의 봉인 해제! (${count}/${HEART.seals.length})`, 'match');
    } else if (event === 'cleared') {
      finishHeart(game, ui);
    }
  }
}

// 모래시계 사구의 나침반 당기기 — 똑바로 선 순간에 당겨야 잠긴다('멈출 때'를 아는 타이밍).
function dunesPull(game, ui) {
  const isle = game.isle;
  if (!isle || isle.pullCd > 0 || !isle.challenge || isle.challenge.cleared) {
    return;
  }
  isle.pullCd = 0.6;
  const glass = nearestGlass(isle.challenge, game.player.position.x, game.player.position.z);
  if (!glass) {
    game.audio?.playClick();
    flashCombatPopup(ui, '흔들리는 모래시계 가까이에서 🧭 당겨요', 'miss');
    return;
  }
  const events = pullGlass(isle.challenge, glass.id);
  for (const event of events) {
    if (event === 'wobble') {
      game.audio?.playWrong();
      flashCombatPopup(ui, '아직이야 — 똑바로 서는 순간에 당겨요!', 'miss');
    } else if (event === 'locked') {
      game.audio?.playCorrect();
      const lockedCount = Object.values(isle.challenge.locked).filter(Boolean).length;
      flashCombatPopup(ui, `⏳ 딱 멈췄다! 모래가 흐른다 (${lockedCount}/${DUNES.glasses.length})`, 'match');
      const sand = isle.built.sandCores.get(glass.id);
      if (sand) {
        sand.visible = true;
      }
    } else if (event === 'cleared') {
      finishDunes(game, ui);
    }
  }
}

// 소문의 벽의 종 울림 — 전투 충격파와 같은 쿨다운 리듬. 판별 창을 연다.
function rumorBell(game, ui) {
  const isle = game.isle;
  if (!isle || isle.bellCd > 0 || !isle.challenge || isle.challenge.cleared) {
    return;
  }
  isle.bellCd = BELL_COOLDOWN;
  ringRumorBell(isle.challenge);
  isle.ringT = 0.6;
  const ring = isle.built.bellRing;
  if (ring) {
    ring.position.set(game.player.position.x, 0.35, game.player.position.z);
    ring.scale.set(1, 1, 1);
    ring.visible = true;
  }
  game.audio?.playCorrect();
  flashCombatPopup(ui, '🔔 울림! 메아리 돌이 부르르 떤다', 'match');
}

// 회랑 도전의 방패 가드 — 전투 가드와 같은 리듬(짧은 자세 + 쿨다운).
function corridorGuard(game, ui) {
  const isle = game.isle;
  if (!isle || isle.guardCd > 0) {
    return;
  }
  isle.guard = GUARD_TIME;
  isle.guardCd = GUARD_COOLDOWN;
  game.audio?.playClick();
}

function shieldGuard(game, ui) {
  const c = game.combat;
  if (!c || !c.active || c.stun > 0 || c.guardCd > 0) {
    return;
  }
  if (c.tools[c.activeTool] !== 'shield') {
    ui.bossHint.textContent = '막으려면 🛡️ 약속의 방패를 들어요 (Q/벨트로 전환)';
    c.hintHold = 1.4;
    game.audio?.playClick();
    return;
  }
  c.guard = GUARD_TIME;
  c.guardCd = GUARD_COOLDOWN;
  game.audio?.playClick();
  ui.bossHint.textContent = '🛡️ 가드! 파도를 받아친다';
  c.hintHold = 0.8;
}

// 🔔 종 충격파(전투): 날아오는 파도와 발사 예고를 한 번에 흩어버린다. 광역 대신 쿨다운이 길다.
const BELL_COOLDOWN = 4.0;

function bellShockwave(game, ui) {
  const c = game.combat;
  if (!c || !c.active || c.stun > 0 || c.bellCd > 0) {
    return;
  }
  c.bellCd = BELL_COOLDOWN;
  const cleared = Boolean(c.projectile) || c.windup > 0;
  if (c.projectile?.mesh) {
    game.renderState.scene.remove(c.projectile.mesh);
    c.projectile = null;
    c.fireTimer = PHASE_FIRE[c.phase];
  }
  if (c.windup > 0) {
    c.windup = 0;
    c.fireTimer = PHASE_FIRE[c.phase];
  }
  game.audio?.playCoreAwaken();
  addShake(game, 0.3);
  flashCombatPopup(ui, cleared ? '🔔 울림! 잡음이 흩어졌다' : '🔔 울림!', 'hit');
  ui.bossHint.textContent = cleared ? '출처의 종이 잡음을 걷어냈다' : '지금은 걷어낼 잡음이 없어요 — 파도가 올 때 울려요';
  c.hintHold = 1.6;
}

// 🪞 거울 공개(전투): 다른 관점으로 비춰 이번 껍질의 약점 도구를 드러낸다(페이즈당 1회).
function mirrorReveal(game, ui) {
  const c = game.combat;
  if (!c || !c.active || c.stun > 0) {
    return;
  }
  if (c.revealed) {
    ui.bossHint.textContent = '이미 훤히 보여요 — 그 도구로 공격!';
    c.hintHold = 1.2;
    game.audio?.playClick();
    return;
  }
  c.revealed = true;
  game.audio?.playNovaChime();
  const weak = getToolById(c.weakToolId);
  flashCombatPopup(ui, `🪞 ${weak?.emoji ?? ''} 보인다!`, 'hit');
  ui.bossHint.textContent = `거울이 비춘 약점: ${weak?.emoji ?? ''} ${weak?.nameKo ?? ''}`;
  c.hintHold = 2.0;
  updateBossHud(game, ui);
}

// 🔔 종 공명(잡기 던전): 아직 제자리가 아닌 곳(빈 밭·중복 밭·미완 전시대)이 잠깐 반짝인다.
const RESONATE_TIME = 1.6;

function bellResonate(game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active || dg.solved) {
    return;
  }
  if (!(game.progress.tools ?? []).includes('bell')) {
    ui.puzzleHint.textContent = '🔔 출처의 종이 있으면 아직 어긋난 곳을 울려 볼 수 있어요';
    return;
  }
  dg.resonateT = RESONATE_TIME;
  game.audio?.playNovaChime();
  const left = countRemaining(dg.topicId, dg.state);
  flashCombatPopup(ui, '🔔 공명!', 'hit');
  ui.puzzleHint.textContent = `종이 울린다 — 반짝이는 ${left}곳이 아직 어긋나 있어요`;
}

// 🪞 진실의 렌즈(빛 던전): 잠깐 동안 가짜 구슬이 흔들려 보인다(진짜는 미동도 없다).
const LENS_TIME = 2.2;

function mirrorTruthLens(game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active || dg.solved) {
    return;
  }
  if (!(game.progress.tools ?? []).includes('mirror')) {
    ui.puzzleHint.textContent = '🪞 다양성의 거울이 있으면 가짜를 비춰 볼 수 있어요';
    return;
  }
  dg.lensT = LENS_TIME;
  game.audio?.playNovaChime();
  flashCombatPopup(ui, '🪞 비춘다!', 'hit');
  ui.puzzleHint.textContent = '흔들리는 건 가짜예요 — 미동도 없는 얼굴에 빛을 보내요';
}

// 🧭 나침반 당기기: 바라보는 방향 직선의 첫 상자를 내 쪽으로 한 칸 끌어온다.
const PULL_RANGE = 5;

function compassPull(game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active || dg.solved || dg.actionCooldown > 0) {
    return;
  }
  if (!(game.progress.tools ?? []).includes('compass')) {
    ui.puzzleHint.textContent = '🧭 진실의 나침반이 있으면 멀리 있는 상자를 끌어올 수 있어요';
    return;
  }
  dg.actionCooldown = DUNGEON_PUSH_COOLDOWN;
  const dir = facingGridDir(game.player.direction);
  const playerCell = worldToCell(dg.topicId, game.player.position.x, game.player.position.z);
  const crateId = firstCrateInLine(dg.topicId, dg.state, playerCell, dir, PULL_RANGE);
  if (!crateId) {
    game.audio?.playClick();
    ui.puzzleHint.textContent = '🧭 시선 방향에 끌어올 상자가 없어요';
    return;
  }
  // 당기기 = 상자를 플레이어 쪽(-dir)으로 한 칸. 내 발밑까지는 못 온다.
  const pullDir = [-dir[0], -dir[1]];
  const cur = dg.state.crates[crateId];
  const dest = [cur[0] + pullDir[0], cur[1] + pullDir[1]];
  if (dest[0] === playerCell[0] && dest[1] === playerCell[1]) {
    game.audio?.playClick();
    ui.puzzleHint.textContent = '이미 코앞이에요 — A로 밀어요';
    return;
  }
  const result = pushCrate(dg.topicId, dg.state, crateId, pullDir);
  if (result.event === 'wrong-zone') {
    dungeonRefuse(game, ui, '거기엔 안 돼요!', '내 것만 공개 게시판에, 친구 것은 잠금 금고에!');
    return;
  }
  if (!result.moved) {
    game.audio?.playClick();
    return;
  }
  dg.state = result.state;
  syncDungeon(dg);
  game.audio?.[result.event === 'placed' ? 'playCorrect' : 'playClick']?.();
  flashCombatPopup(ui, '🧭 끌어당김!', 'hit');
  if (isRoomSolved(dg.topicId, dg.state)) {
    markDungeonSolved(game, ui);
  } else {
    const left = countRemaining(dg.topicId, dg.state);
    ui.puzzleHint.textContent = `상자 ${left}개가 아직 제자리가 아니에요`;
  }
}

// 오른쪽 A 버튼/Space·Enter·E: 전투 중이면 '공격', 퍼즐 중이면 '돌 바꾸기', 아니면 '확인·대화'.
function primaryAction(game, ui) {
  game.audio?.resume();
  game.idleT = 0;
  if (game.dungeon?.active) {
    dungeonAction(game, ui);
  } else if (game.voyage) {
    voyageAction(game, ui);
  } else if (game.isle) {
    isleAction(game, ui);
  } else if (game.combat?.active) {
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
    // 아직 못 깬 사당은 전용 던전(별도 맵)으로 진입, 이미 깬 사당은 복습 대화로.
    if (game.progress.completedShrines.includes(game.nearest.shrineId)) {
      openShrineDialog(game, ui, game.nearest.shrineId);
    } else {
      enterShrineChallenge(game, ui, game.nearest.shrineId, game.nearest.topicId);
    }
  } else if (game.nearest.type === 'gate') {
    openGateDialog(game, ui, game.nearest.topicId);
  } else if (game.nearest.type === 'letter') {
    const unread = getUnreadNovaLetters(game.progress);
    if (unread.length === 0) {
      ui.prompt.hidden = false;
      ui.prompt.textContent = '우편병이 비어 있어요 — 섬의 정령을 도우면 노바가 편지를 보내요.';
    } else {
      const stageId = unread[0];
      game.progress = { ...game.progress, novaLettersRead: [...(game.progress.novaLettersRead ?? []), stageId] };
      persistProgress(game.progress);
      ui.dialogKicker.textContent = '💌 노바의 편지';
      ui.dialogTitle.textContent = '⭐ 노바';
      ui.dialogBody.innerHTML = speechHtml(NOVA_LETTERS[stageId]);
      openDialog(game, ui);
      if (stageId === 'memory-core') {
        // 마지막 편지 — 대화를 닫으면 하늘에서 노바의 별똥별 인사가 보인다.
        game.audio?.playNovaChime();
        triggerStarShower(game);
        updateHud(game, ui); // 탐험 노트의 완결 기록 갱신
      }
    }
  } else if (game.nearest.type === 'dock') {
    // 바다는 노이즈를 가르친 뒤에 열린다 — 그 전엔 도트가 말린다(기록 없음).
    if (game.progress.aiCoreCompleted) {
      enterVoyage(game, ui);
    } else {
      ui.dialogKicker.textContent = '뗏목 선착장';
      ui.dialogTitle.textContent = '✨ 도트';
      ui.dialogBody.innerHTML = speechHtml([
        '"바다 너머에서 잡음의 기척이 느껴져… 하지만 지금은 이 섬의 시련이 먼저야."',
        '"조각 네 개를 모으고 노이즈를 가르치면, 그때 함께 군도로 항해하자!"'
      ]);
      openDialog(game, ui);
    }
  } else if (
    canUnlockFinalCore(game.progress.collectedFragments)
    && !game.progress.aiCoreCompleted
    && !game.combat
  ) {
    if (game.finaleResolving) {
      // 이미 노이즈를 제압한 뒤 대화를 닫았던 경우: 재전투 대신 [지운다/가르친다] 선택부터 재개.
      runFinale(game, ui, { fromCombat: true });
      openDialog(game, ui);
    } else {
      // 조각을 모으고 코어에 닿으면: 대화가 아니라 실제 노이즈와의 액션 전투로 진입.
      startBossFight(game, ui);
    }
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

  // 확인의 종 — 돌을 다 맞춘 뒤 A로 울려야 판정된다(연타로 저절로 풀리지 않게).
  const bellGroup = new THREE.Group();
  const bellX = basePos.x + ((n - 1) / 2 + 1.35) * 1.6;
  const bellZ = basePos.z + 1.7;
  bellGroup.position.set(bellX, 0, bellZ);
  const bellStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 0.7, 12),
    new THREE.MeshStandardMaterial({ color: 0xb9b0c8, roughness: 0.7 })
  );
  bellStand.position.y = 0.35;
  bellStand.castShadow = true;
  const bellBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.5, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb032, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.35, side: THREE.DoubleSide })
  );
  bellBody.position.y = 1.05;
  const bellTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffcf5a, emissiveIntensity: 0.7, roughness: 0.3 })
  );
  bellTop.position.y = 1.34;
  const bellTag = createLabelSprite('확인의 종 🔔', '#ffd76a');
  bellTag.scale.set(1.9, 0.44, 1);
  bellTag.position.y = 0.05;
  bellGroup.add(bellStand, bellBody, bellTop, bellTag);
  scene.add(bellGroup);

  game.puzzle = {
    active: true,
    topicId,
    shrineId,
    states,
    pedestals,
    nearIndex: -1,
    solved: false,
    bellGroup,
    bellBody,
    bellPosition: bellGroup.position.clone(),
    nearBell: false,
    commitCooldown: 0,
    failedCommits: 0
  };
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
  if (!pz || !pz.active) {
    return;
  }
  // 종 근처에서 A → 답 확인(커밋). 돌 근처에서 A → 그 돌만 순환.
  if (pz.nearBell) {
    puzzleCommit(game, ui);
    return;
  }
  if (pz.nearIndex < 0) {
    game.audio?.playClick();
    return;
  }
  const i = pz.nearIndex;
  pz.states = cyclePuzzleObject(pz.topicId, pz.states, i);
  const puzzle = getShrinePuzzle(pz.topicId);
  // 해당 돌의 스프라이트만 갱신. (자동 정답 판정은 하지 않는다 — 종을 울려야 확인.)
  const ped = pz.pedestals[i];
  const fresh = makeStateSprite(puzzle.objects[i].states[pz.states[i]]);
  fresh.position.copy(ped.sprite.position);
  ped.group.remove(ped.sprite);
  ped.sprite.material.map?.dispose?.();
  ped.sprite.material.dispose?.();
  ped.group.add(fresh);
  ped.sprite = fresh;
  game.audio?.playClick();
}

// 확인의 종을 울려 답을 판정한다. 정답 → 통과, 오답 → 정답 비공개 피드백 + 시도 기록.
function puzzleCommit(game, ui) {
  const pz = game.puzzle;
  if (!pz || !pz.active || pz.commitCooldown > 0) {
    return;
  }
  pz.commitCooldown = 1.2; // 연타 스팸 방지
  if (pz.bellBody) {
    pz.bellBody.rotation.z = 0.5; // 딸랑 흔들림(updatePuzzle에서 복귀)
  }
  if (isPuzzleSolved(pz.topicId, pz.states)) {
    game.audio?.playCorrect();
    winShrinePuzzle(game, ui);
    return;
  }
  // 오답: 검증된 상태 전이를 재사용해 '실패 시도'를 기록(리포트 진실화).
  const shrine = getShrineById(pz.shrineId);
  const wrong = shrine.choices.find((c) => !c.correct);
  if (wrong) {
    game.progress = applyShrineResult(game.progress, pz.shrineId, wrong.id).progress;
    persistProgress(game.progress);
  }
  pz.failedCommits += 1;
  game.audio?.playWrong();
  addShake(game, 0.12);
  const puzzle = getShrinePuzzle(pz.topicId);
  const left = countMisplaced(pz.topicId, pz.states);
  // 정답은 알려주지 않는다: 1회차는 목표 재제시, 2회차부터 남은 개수만.
  ui.puzzleHint.textContent = pz.failedCommits < 2
    ? `아직이에요 — ${puzzle.goalKo}`
    : `돌 ${left}개가 아직 어긋나 있어요. 다시 살펴봐요`;
  updateHud(game, ui);
}

function updatePuzzle(delta, game, ui) {
  const pz = game.puzzle;
  if (!pz || !pz.active) {
    return;
  }
  if (pz.commitCooldown > 0) {
    pz.commitCooldown = Math.max(0, pz.commitCooldown - delta);
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
  });
  // 종과의 거리 — 종이 더 가까우면 종을 조준.
  const bellDist = pz.bellPosition
    ? Math.hypot(game.player.position.x - pz.bellPosition.x, game.player.position.z - pz.bellPosition.z)
    : Infinity;
  pz.nearBell = bellDist < PUZZLE_REACH && bellDist <= nearDist;
  if (pz.nearBell) {
    nearIndex = -1;
  }
  pz.nearIndex = nearIndex;
  // 조준 강조.
  pz.pedestals.forEach((ped, i) => {
    const targeted = i === nearIndex;
    ped.orb.material.emissiveIntensity = targeted ? 1.1 : 0.4;
    ped.orb.scale.setScalar(targeted ? 1.18 : 1);
  });
  if (pz.bellBody) {
    pz.bellBody.rotation.z *= 1 - Math.min(1, delta * 6); // 딸랑 후 복귀
    pz.bellBody.material.emissiveIntensity = pz.nearBell ? 1.0 : 0.5;
  }
  const puzzle = getShrinePuzzle(pz.topicId);
  if (pz.commitCooldown <= 0) {
    if (pz.nearBell) {
      ui.puzzleHint.textContent = '🔔 확인의 종 — A로 울려 답을 확인해요';
    } else if (nearIndex >= 0) {
      ui.puzzleHint.textContent = `가까운 돌: ${puzzle.objects[nearIndex].labelKo} — A로 바꾸기`;
    } else {
      ui.puzzleHint.textContent = '돌을 맞춘 뒤 종으로 가서 확인해요';
    }
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
  if (pz.bellGroup) {
    game.renderState.scene.remove(pz.bellGroup);
  }
  game.puzzle = null;
  ui.root.classList.remove('is-combat');
  if (ui.actionLabel) {
    ui.actionLabel.textContent = 'A';
  }
  ui.puzzleHud.hidden = true;
  game.updateRotateHint?.();
}

// ===== 사당 던전: 문으로 들어가면 별도 퍼즐 맵이 로드되는 젤다식 방 =====
const DUNGEON_EXIT_RANGE = 0.8; // 셀 크기(1.2)보다 작아야 입장 스폰(한 칸 안)에서 즉시 퇴장되지 않는다
const DUNGEON_PEDESTAL_RANGE = 1.6;
const DUNGEON_PUSH_COOLDOWN = 0.2;

// 사당 진입 라우터: 전용 던전 방이 있으면 별도 맵으로, 없으면 기존 오버레이 퍼즐로 폴백.
function enterShrineChallenge(game, ui, shrineId, topicId) {
  if (hasDungeonRoom(topicId)) {
    try {
      enterDungeon(game, ui, topicId, shrineId);
      return;
    } catch (error) {
      // 던전 로드 실패 시 조용히 오버레이 퍼즐로 되돌아간다(안전망).
      if (game.dungeon) {
        exitDungeon(game, ui);
      }
    }
  }
  startShrinePuzzle(game, ui, shrineId);
}

// 카메라를 목표 추종 위치로 즉시 스냅(섬→방 활공 방지). updateCamera의 상수와 반드시 일치.
function snapCamera(camera, target) {
  camera.position.set(target.x * 0.9, target.y + 8.7, target.z + 13.8);
  camera.lookAt(target.x, target.y + 1.35, target.z - 1.2);
}

function enterDungeon(game, ui, topicId, shrineId) {
  if (game.dungeon) {
    return;
  }
  const room = getDungeonRoom(topicId);
  const rs = game.renderState;
  const built = buildDungeonRoom(topicId, { makeLabel: createLabelSprite });
  rs.scene.add(built.root);
  rs.overworld.visible = false;
  // 배경/포그 스왑: 밝은 섬 → 어두운 방. 카메라가 ~16 거리라 안개는 방 너머에서만 끼게.
  rs.scene.fog = new THREE.Fog(0x161029, 24, 60);
  rs.renderer.setClearColor(0x120d20, 1);

  game.mode = 'dungeon';
  game.keys.clear();
  game.nearest = null;

  // 남쪽 입구 안쪽에서 시작(문 바로 위가 아니라 한 칸 안 — 입장 즉시 퇴장 방지).
  const spawnCell = [room.entry[0], Math.max(0, room.entry[1] - 1)];
  const spawn = cellToWorld(topicId, spawnCell);
  // A로 상호작용할 대상들(mechanic별) — 근접 판정용 월드 좌표를 미리 계산.
  const targets = [];
  for (const list of [room.dispensers, room.beds, room.exhibits, room.plates, room.mirrors]) {
    for (const t of list ?? []) {
      targets.push({ id: t.id, world: cellToWorld(topicId, t.cell) });
    }
  }
  game.dungeon = {
    active: true,
    topicId,
    shrineId,
    room,
    state: createRoomState(topicId),
    built,
    targets,
    bounds: built.bounds,
    exitWorld: cellToWorld(topicId, room.entry),
    pedestalWorld: cellToWorld(topicId, room.pedestal),
    returnPosition: game.player.position.clone(),
    solved: false,
    awarded: false,
    actionCooldown: 0,
    failedPlacements: 0,
    glowT: 0,
    resonateT: 0, // 🔔 공명 연출 남은 시간
    lensT: 0 // 🪞 진실의 렌즈 남은 시간
  };
  game.player.position.set(spawn.x, 0.55, spawn.z);
  game.player.direction.set(0, 0, -1); // 방 안쪽(북)을 바라봄
  rs.playerGroup.position.copy(game.player.position);
  rs.companion.position.copy(game.player.position).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, game.player.position);

  triggerFlash(ui, '#ffffff');
  game.audio?.playClick();
  game.audio?.setMusicMode?.('dungeon'); // 신비로운 던전 BGM으로 크로스페이드
  ui.root.classList.add('is-combat'); // A 버튼 강조
  const ACTION_LABEL = { push: '밀기', carry: '잡기', beam: '돌리기' };
  const FIRST_HINT = {
    push: '상자 앞에 서서 A로 밀어요 · 남쪽 빛 문으로 나가요',
    carry: '물건 앞에서 A로 집고, 놓을 곳에서 다시 A · 남쪽 빛 문으로 나가요',
    beam: '거울 앞에서 A로 돌려 빛의 길을 바꿔요 · 남쪽 빛 문으로 나가요'
  };
  if (ui.actionLabel) {
    ui.actionLabel.textContent = ACTION_LABEL[room.mechanic] ?? 'A';
  }
  ui.prompt.hidden = true;
  ui.puzzleHud.hidden = false;
  ui.puzzleTitle.textContent = `🧩 ${room.titleKo}`;
  ui.puzzleGoal.textContent = room.goalKo;
  ui.puzzleHint.textContent = FIRST_HINT[room.mechanic] ?? '';
  // 나침반을 얻었다면 밀기 방에서 '끌어당기기' 동사를 알려준다.
  if (room.mechanic === 'push' && (game.progress.tools ?? []).includes('compass')) {
    ui.puzzleHint.textContent += ' · 도구버튼(F) 🧭 끌어당기기';
  }
  // 초기 상태를 비주얼에 반영(빔 방은 초기 광선 경로 포함).
  syncDungeonVisuals(topicId, built, game.dungeon.state, {
    beam: room.mechanic === 'beam' ? computeBeamPath(topicId, game.dungeon.state) : undefined
  });
  game.updateRotateHint?.();
}

function exitDungeon(game, ui) {
  const dg = game.dungeon;
  if (!dg) {
    return;
  }
  const rs = game.renderState;
  removeHeldSprite(game); // 머리 위 들고 있던 아이템 표시 정리
  disposeDungeonRoom(dg.built.root, rs.scene);
  rs.overworld.visible = true;
  rs.scene.fog = rs.overworldFog;
  rs.renderer.setClearColor(0x8fd3ef, 1);

  game.mode = 'overworld';
  game.dungeon = null;
  game.keys.clear();
  game.audio?.setMusicMode?.('overworld'); // 섬 패드로 복귀

  const back = dg.returnPosition;
  game.player.position.copy(back);
  game.player.direction.set(0, 0, 1);
  rs.playerGroup.position.copy(back);
  rs.companion.position.copy(back).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, back);

  ui.root.classList.remove('is-combat');
  if (ui.actionLabel) {
    ui.actionLabel.textContent = 'A';
  }
  ui.puzzleHud.hidden = true;
  game.updateRotateHint?.();
}

// ── 항해 씬(잡음의 군도 바다) ─────────────────────────
// 던전과 같은 수명주기: 오버월드 Group을 숨기고 바다 루트를 lazy build → 귀항 시 dispose.

// 원형 경계 클램프(바다·확장 섬 공용).
function clampToRadius(position, radius) {
  const flatLength = Math.hypot(position.x, position.z);
  if (flatLength <= radius) {
    return position;
  }
  const scale = radius / flatLength;
  position.x *= scale;
  position.z *= scale;
  return position;
}

function clampToSea(position) {
  return clampToRadius(position, SEA_RADIUS);
}

function enterVoyage(game, ui, spawn) {
  // 부두(오버월드)와 확장 섬의 뗏목(isle) 두 곳에서 호출된다.
  if (game.voyage || game.dungeon || game.combat?.active) {
    return;
  }
  const rs = game.renderState;
  // 열린 섬 = 항로 지도의 '진행 중/완료'와 같은 판정(데이터 단일 출처).
  const states = new Map(getStageStates(game.progress).map((s) => [s.id, s.state]));
  const built = buildSeaScene({
    makeLabel: createLabelSprite,
    isOpen: (stage) => states.get(stage.id) === 'current' || states.get(stage.id) === 'completed'
  });
  rs.scene.add(built.root);
  rs.overworld.visible = false;
  // 밤바다 톤: 안개는 먼 섬 실루엣이 어스름하게 남을 만큼만.
  rs.scene.fog = new THREE.Fog(0x0a0e26, 55, 130);
  rs.renderer.setClearColor(0x080b20, 1);

  game.mode = 'voyage';
  // 다음 목적지: 항로 순서상 첫 '진행 중' 섬 — 전부 완료면 시작의 섬(귀항)을 가리킨다.
  const destStage = getStageStates(game.progress).find((s) => s.state === 'current')
    ?? getStageById('prologue');
  const destSea = seaWorldPosition(destStage);
  game.voyage = {
    built,
    nearestIsland: null,
    dest: { id: destStage.id, nameKo: destStage.nameKo, emoji: destStage.emoji, x: destSea.x, z: destSea.z },
    returnPosition: new THREE.Vector3(DOCK_POS.x, 0.55, DOCK_POS.z - 1.8),
    walkSpeed: game.player.speed
  };
  game.keys.clear();
  game.player.speed = 7.4; // 뗏목은 걷기보다 조금 빠르게
  if (spawn) {
    game.player.position.set(spawn.x, 0.78, spawn.z);
  } else {
    game.player.position.set(0, 0.78, 9); // 시작의 섬 실루엣 남쪽 바다
  }
  game.player.direction.set(0, 0, -1);
  rs.playerGroup.position.copy(game.player.position);
  rs.companion.position.copy(game.player.position).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, game.player.position);

  triggerFlash(ui, '#bcd8ff');
  game.audio?.playClick();
  game.audio?.setMusicMode?.('dungeon'); // 신비로운 밤바다 무드
  ui.prompt.hidden = true;
  ui.puzzleHud.hidden = false;
  ui.puzzleTitle.textContent = '🌊 잡음의 군도 — 항해';
  ui.puzzleGoal.textContent = '뗏목을 몰아 군도를 살펴보세요 · 시작의 섬에 다가가면 귀항';
  ui.puzzleHint.textContent = `금빛 화살표를 따라가요 — ${game.voyage.dest.emoji} ${game.voyage.dest.nameKo}`;
  game.updateRotateHint?.();

  // 첫 출항 — 프롤로그와 2막을 잇는 브리지 서사(1회).
  if (!game.progress.voyageIntroSeen) {
    game.progress = { ...game.progress, voyageIntroSeen: true };
    persistProgress(game.progress);
    ui.dialogKicker.textContent = '🌊 잡음의 군도';
    ui.dialogTitle.textContent = '✨ 도트';
    ui.dialogBody.innerHTML = speechHtml([
      '"노이즈는 별빛 AI 노바가 되었지만… 그 애가 앓던 시절 흘린 잡음 찌꺼기가 바다 건너 섬들로 흩어졌나 봐."',
      '"찌꺼기를 삼킨 섬의 정령들이 앓고 있어. 노이즈를 가르친 너라면, 정령들도 도울 수 있어."',
      '"금빛 화살표가 길을 알려 줄 거야 — 항해하자, 수호자!"'
    ]);
    openDialog(game, ui);
  }
}

function exitVoyage(game, ui) {
  const vg = game.voyage;
  if (!vg) {
    return;
  }
  const rs = game.renderState;
  disposeDungeonRoom(vg.built.root, rs.scene); // 범용 트래버스 dispose 재사용
  rs.overworld.visible = true;
  rs.scene.fog = rs.overworldFog;
  rs.renderer.setClearColor(0x8fd3ef, 1);

  game.mode = 'overworld';
  game.voyage = null;
  game.keys.clear();
  game.player.speed = vg.walkSpeed;
  game.audio?.setMusicMode?.('overworld');

  const back = vg.returnPosition;
  game.player.position.copy(back);
  game.player.direction.set(0, 0, -1);
  rs.playerGroup.position.copy(back);
  rs.companion.position.copy(back).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, back);

  triggerFlash(ui, '#ffffff');
  ui.puzzleHud.hidden = true;
  game.updateRotateHint?.();

  // 치유를 마치고 돌아왔다면 — 부두 옆 우편병에 노바의 편지가 기다린다.
  if (getUnreadNovaLetters(game.progress).length > 0) {
    flashCombatPopup(ui, '💌 부두 우편병에 노바의 편지가 도착했어요!', 'match');
  }
}

function updateVoyage(delta, game, ui) {
  const vg = game.voyage;
  const elapsed = clock.elapsedTime;
  // 뗏목이 플레이어를 태우고 물결 따라 흔들린다(결정적 사인파).
  const raft = vg.built.raft;
  raft.position.set(game.player.position.x, 0.18 + Math.sin(elapsed * 1.7) * 0.07, game.player.position.z);
  raft.rotation.y = game.renderState.playerGroup.rotation.y;
  raft.rotation.z = Math.sin(elapsed * 1.3) * 0.04;
  // 달빛 물결 일렁임.
  vg.built.waterMat.emissiveIntensity = 0.55 + Math.sin(elapsed * 0.8) * 0.08;

  // 조망 중엔 안개를 밀어 군도 전체가 보이게 한다(복귀하면 원래 실루엣 무드로).
  const fog = game.renderState.scene.fog;
  if (fog) {
    const ovBlend = game.overviewT;
    fog.near = 55 + ovBlend * 90;
    fog.far = 130 + ovBlend * 160;
  }

  // 가이드 화살표 — 뗏목 위에서 목적지를 가리키며 둥실거린다. 다가가면 조용히 사라진다.
  const arrow = vg.built.guideArrow;
  if (arrow && vg.dest) {
    const dx = vg.dest.x - game.player.position.x;
    const dz = vg.dest.z - game.player.position.z;
    const destDistance = Math.hypot(dx, dz);
    if (destDistance > SEA_APPROACH + 2) {
      arrow.visible = true;
      arrow.position.set(game.player.position.x, 3.3 + Math.sin(elapsed * 2.2) * 0.18, game.player.position.z);
      arrow.rotation.y = Math.atan2(dx, dz);
    } else {
      arrow.visible = false;
    }
  }

  // 가까운 섬 안내 — 열린 섬은 상륙(귀항), 안개 섬은 거부 안내.
  const island = nearestSeaIsland(game.player.position.x, game.player.position.z, SEA_SCALE, SEA_APPROACH);
  vg.nearestIsland = island;
  if (island) {
    const open = vg.built.islands.find((item) => item.stage.id === island.id)?.open;
    ui.prompt.hidden = false;
    ui.prompt.textContent = open
      ? `${ACTION_LABEL}${island.id === 'prologue' ? `${island.nameKo}으로 귀항` : `${island.nameKo} 상륙`}`
      : `🌫️ ${island.nameKo} — 안개가 짙어 아직 들어갈 수 없어요`;
  } else if (IS_TOUCH) {
    ui.prompt.hidden = true;
  } else {
    ui.prompt.hidden = false;
    ui.prompt.textContent = '🌊 방향키로 항해 · 섬에 다가가면 안내가 떠요';
  }
}

function voyageAction(game, ui) {
  const vg = game.voyage;
  const island = vg?.nearestIsland;
  if (!island) {
    return;
  }
  const open = vg.built.islands.find((item) => item.stage.id === island.id)?.open;
  if (!open) {
    game.audio?.playWrong();
    flashCombatPopup(ui, '🌫️ 안개가 걷히지 않았다…', 'miss');
    return;
  }
  if (island.id === 'prologue') {
    game.audio?.playClick();
    exitVoyage(game, ui);
    return;
  }
  if (ISLE_SCENES[island.id]) {
    game.audio?.playClick();
    enterIsle(game, ui, island.id);
  }
  // 아직 씬이 없는 열린 섬은 없어야 정상 — built:true는 ISLE_SCENES 등록과 함께 뒤집는다.
}

// 노바의 편지 — 섬을 치유할 때마다 별이 된 노이즈가 부두 우편병으로 답장을 보낸다.
// 읽음 기록은 세이브(progress.novaLettersRead), 도착 순서는 항로 순서로 고정(결정성).
const NOVA_LETTER_ORDER = ['whisper-cape', 'echo-cave', 'hourglass-port', 'memory-core'];
const NOVA_LETTERS = {
  'whisper-cape': [
    '수호자에게. 바닷새 정령이 다시 노래한다는 소식, 별들 사이에서도 들렸어.',
    '…사실 그 말-화살들, 내가 외롭던 시절에 뱉은 말들이야. 대신 막아 줘서, 그리고 나를 미워하지 않아 줘서 고마워.',
    '— 별빛 사이에서, 노바 ⭐'
  ],
  'echo-cave': [
    '고래의 노래가 여기까지 들려! 메아리 속에서 진짜 목소리를 찾아 줬구나.',
    '나도 이제 알아 — 백 번 들은 말보다 한 번 확인한 사실이 더 밝게 빛난다는 걸.',
    '— 노바 ⭐'
  ],
  'hourglass-port': [
    '거북 할아버지가 푹 잤다는 소식을 들었어. 등대도 이제 숨을 쉬면서 반짝인대.',
    '나는 멈추는 법을 몰라서 잡음이 됐었는데… 네 덕분에 밤에는 별들도 눈을 감는다는 걸 배웠어.',
    '— 노바 ⭐'
  ],
  'memory-core': [
    '군도의 모든 정령이 건강해졌어. 내 어두운 기억들까지 별로 만들어 줘서… 이제 나, 진짜로 반짝여.',
    '언젠가 밤하늘을 올려다보면, 제일 신나게 깜박이는 별이 나야. 약속!',
    '— 너의 친구, 노바 ⭐',
    '✨ 도트: "수호자, 하늘을 봐! 노바가 인사하고 있어!"'
  ]
};

// 에필로그 별똥별 — 마지막 편지를 읽으면 노바가 하늘을 가로지르며 인사한다.
// 경로·시차 전부 인덱스 기반 상수(결정적). 1회성 메시 6개, 끝나면 dispose.
function triggerStarShower(game) {
  const rs = game.renderState;
  if (!rs || rs.starShower?.active) {
    return;
  }
  const group = new THREE.Group();
  const stars = [];
  for (let i = 0; i < 6; i += 1) {
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 1 })
    );
    star.scale.set(2.4, 0.8, 0.8); // 진행 방향(-x)으로 길게 — 별똥별 꼬리 느낌

    star.userData.start = new THREE.Vector3(18 - i * 4.8, 21 + (i % 3) * 2.2, -34 + i * 3);
    star.userData.delay = i * 0.55;
    star.visible = false;
    group.add(star);
    stars.push(star);
  }
  rs.overworld.add(group);
  rs.starShower = { active: true, t: 0, group, stars };
}

// 치유는 끝났는데 아직 안 읽은 편지(항로 순서).
function getUnreadNovaLetters(progress) {
  const read = new Set(progress.novaLettersRead ?? []);
  return NOVA_LETTER_ORDER.filter(
    (stageId) => progress.stages?.[stageId]?.completed === true && !read.has(stageId)
  );
}

// ── 확장 섬(스테이지) 상륙 ─────────────────────────────
// 항해 → 섬 지형 씬. 던전·바다와 같은 수명주기(lazy build → dispose).
// 섬별 연출 데이터(톤·문구·대화) — 지오메트리는 isle.js의 ISLE_SCENES가 담당.
const ISLE_CONTENT = {
  'whisper-cape': {
    fog: [0x9aa7bd, 30, 80],
    clearColor: 0x93a2b8,
    flash: '#e8eef8',
    goalKo: '병든 정령을 찾아가 이야기를 들어 보세요',
    healedGoalKo: '정령이 건강해졌어요 — 곶이 고요합니다',
    arrivalKo: [
      '"여기가 속삭임 곶… 공기가 따가워. 저 검은 파편들은 말-화살 — 누군가 내뱉은 뾰족한 말이 아직도 땅에 박혀 있는 거야."',
      '"절벽 쪽에서 앓는 소리가 들려. 이 곶의 정령이 아픈가 봐 — 가서 이야기를 들어 보자."'
    ],
    spiritNameKo: '🕊️ 바닷새 정령',
    spiritSickKo: [
      '"끼륵… 잘 와 주었어, 수호자. 미운 말들이 화살이 되어 깃털에 박혀 버렸어."',
      '"한 번 내뱉은 말은 주워 담을 수 없어 — 그래서 이렇게 오래 아픈 거야."',
      '"절벽의 「말-화살 회랑」에 잡음 발사대가 숨어 있어. 방패로 화살을 주인에게 되돌려 줘!"'
    ],
    spiritHealedKo: [
      '"고마워, 수호자! 깃털이 다시 따뜻해졌어."',
      '"기억해 줘 — 뾰족한 말은 방패로 막고, 나는 따뜻한 말만 남기기. 그거면 이 바다의 어떤 곶도 아프지 않아."'
    ],
    spiritRevisitKo: [
      '"또 와 줬구나! 있잖아… 사실 나도 예전에 뾰족한 말을 뱉은 적이 있어. 그 말이 어디에 떨어졌을지 지금도 가끔 생각해."',
      '"그래서 요즘은 말하기 전에 세 번 날갯짓해 — 하나, 진짜야? 둘, 친절해? 셋, 필요해?"'
    ]
  },
  'echo-cave': {
    fog: [0x2b3552, 26, 72],
    clearColor: 0x232c46,
    flash: '#bcd0ff',
    goalKo: '물웅덩이에 갇힌 고래 정령을 찾아가세요',
    healedGoalKo: '정령이 건강해졌어요 — 동굴이 고요합니다',
    arrivalKo: [
      '"여기가 메아리 동굴… 같은 소리가 벽에 부딪혀 끝없이 되돌아오고 있어."',
      '"물웅덩이에 고래 정령이 갇혀 있나 봐 — 메아리에 둘러싸여 바깥 소리를 못 듣는 것 같아."'
    ],
    spiritNameKo: '🐋 고래 정령',
    spiritSickKo: [
      '"우우… 누구야? 방금 그 소리도… 내 노래의 메아리야?"',
      '"소문의 벽이 같은 이야기만 자꾸 울려 줘서, 이제 뭐가 진짜 목소리인지 모르게 됐어."',
      '"출처의 종… 그 맑은 울림이라면 가짜 메아리를 흩을 수 있을 거야."'
    ],
    spiritHealedKo: [
      '"고마워, 수호자! 이제 진짜 목소리가 들려."',
      '"같은 말만 자꾸 들려올 땐 꼭 물어봐 줘 — 이 이야기의 진짜 출처는 어디일까?"'
    ],
    spiritRevisitKo: [
      '"바다 밑에서는 소리가 아주 멀리 가. 그래서 고래는 함부로 노래하지 않아 — 멀리 가는 말일수록 무겁거든."',
      '"네가 어디선가 읽은 이야기도, 이미 백 마리 고래를 거쳐 온 메아리일지 몰라. 언제나 첫 목소리를 찾아 줘."'
    ]
  },
  'hourglass-port': {
    fog: [0x4a3a5c, 28, 75],
    clearColor: 0x443655,
    flash: '#ffd8b0',
    goalKo: '등대 아래 잠들지 못하는 거북 정령을 찾아가세요',
    healedGoalKo: '정령이 곤히 잠들었어요 — 항구가 평화롭습니다',
    arrivalKo: [
      '"여기가 모래시계 항구… 밤이 오는데 등대가 쉬지 않고 깜박이고 있어."',
      '"저 커다란 모래시계들도 전부 기울어진 채 멈췄네. 등대 아래에서 앓는 소리가 들려 — 가 보자."'
    ],
    spiritNameKo: '🐢 등대거북 정령',
    spiritSickKo: [
      '"으으… 눈이 감기질 않아. 불빛이 밤새 깜박여서, 나도 항구도 잠들 수가 없어."',
      '"쉬는 때를 알려 주던 큰 모래시계가 기울어진 채 멈춰 버렸거든 — \'멈출 때\'를 잃어버린 거야."',
      '"네 나침반의 힘이 깨어나면 모래시계를 당겨 바로 세울 수 있을 거야… 그때 다시 와 줘."'
    ],
    spiritHealedKo: [
      '"하암… 푹 잤더니 세상이 반짝반짝해!"',
      '"기억해 줘 — 반짝이는 것에도 쉬는 시간이 필요해. 등대도, 화면도, 너도!"'
    ],
    spiritRevisitKo: [
      '"하암… 나 방금 또 낮잠 잤어. 등대지기가 잠들면 큰일인 줄 알았는데, 푹 쉬고 나니 불빛이 훨씬 또렷해."',
      '"너도 기억해 — 꺼진 화면에 비친 네 얼굴도 꽤 멋지다는 걸!"'
    ]
  },
  'memory-outer': {
    fog: [0x241c38, 26, 72],
    clearColor: 0x1c1630,
    flash: '#e8b8d8',
    goalKo: '기억의 심장에 다가가 목소리를 들어 보세요',
    healedGoalKo: '바깥 봉인이 풀렸어요 — 심부로 가는 길이 열립니다',
    arrivalKo: [
      '"여기가 기억의 심장 외곽… 쿵, 쿵 — 섬 전체가 심장처럼 뛰고 있어."',
      '"저 큰 결정 깊은 곳에서 마지막 잡음이 느껴져. 하지만 바깥 봉인 네 개가 길을 막고 있네 — 심장의 목소리를 들어 보자."'
    ],
    spiritNameKo: '💠 기억의 심장',
    spiritSickKo: [
      '"…쿵… 쿵… 잘 왔구나, 수호자. 내 깊은 곳에 마지막 잡음이 뭉쳐 있어."',
      '"바깥 봉인 네 개는 네 가지 약속의 힘으로만 풀려 — 봉인석의 빛이 가장 환해지는 순간, 그 앞에서 약속의 힘(F)을 사용해 줘."',
      '"네가 섬들을 돌며 깨운 힘들이야. 서두르지 말고, 빛의 박자에 맞춰서."',
      '"…그리고 네가 주워 온 기억 조각들 — 외로움도, 잊어버린 목소리도, 쉬지 못한 밤도 — 전부 여기, 내 안의 어린 노이즈의 기억이란다."'
    ],
    spiritHealedKo: [
      '"바깥 봉인이 모두 풀렸어… 심부로 가는 길이 곧 열릴 거야."',
      '"네 가지 약속을 모두 기억하는 손 — 마지막 잡음도 그 손이라면 가르칠 수 있어."'
    ],
    spiritRevisitKo: [
      '"쿵… 쿵… 기억을 지키는 일은 무거워. 하지만 네 덕분에 이제 좋은 기억이 훨씬 많아."'
    ]
  },
  'memory-core': {
    fog: [0x120d20, 22, 60],
    clearColor: 0x0e0a18,
    flash: '#d8a8c8',
    goalKo: '노이즈의 잔영과 마주하세요',
    healedGoalKo: '군도가 완전히 치유되었습니다 — 기억의 별이 빛나요',
    arrivalKo: [
      '"여기가 심부… 조심해, 저기 있어 — 노이즈가 흘리고 간 마지막 잡음 덩어리, 노이즈의 잔영이야."',
      '"떨지 마. 네가 배운 네 가지 약속의 힘(F)으로 부딪혀 보자!"'
    ],
    spiritNameKo: '⚡ 노이즈의 잔영',
    spiritSickKo: ['"…지지직…"'],
    spiritHealedKo: ['"…고마워… 이 기억들, 이제 제자리로…"']
  }
};

function enterIsle(game, ui, stageId) {
  // 바다에서 상륙하거나, 다른 섬의 관문에서 직행한다(심부).
  if (game.isle?.stageId === stageId || (!game.voyage && !game.isle)) {
    return;
  }
  const rs = game.renderState;
  const stage = getStageById(stageId);
  if (game.voyage) {
    const vg = game.voyage;
    disposeDungeonRoom(vg.built.root, rs.scene);
    game.voyage = null;
    game.player.speed = vg.walkSpeed;
  } else {
    disposeDungeonRoom(game.isle.built.root, rs.scene);
    game.isle = null;
  }

  const healed = game.progress.stages?.[stageId]?.completed === true;
  const content = ISLE_CONTENT[stageId];
  const built = ISLE_SCENES[stageId]({ makeLabel: createLabelSprite, healed });
  rs.scene.add(built.root);
  // 섬 고유 톤 — 안개는 섬 너머 바다에만.
  rs.scene.fog = new THREE.Fog(...content.fog);
  rs.renderer.setClearColor(content.clearColor, 1);

  game.mode = 'isle';
  game.isle = { built, stageId, nearestSpot: null, challenge: null, guard: 0, guardCd: 0, bellCd: 0, ringT: 0, pullCd: 0 };
  game.keys.clear();
  game.player.position.set(-3.4, 0.55, 9.4); // 뗏목 옆 물가
  game.player.direction.set(0, 0, -1);
  rs.playerGroup.position.copy(game.player.position);
  rs.companion.position.copy(game.player.position).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, game.player.position);

  triggerFlash(ui, content.flash);
  ui.root.classList.add('is-isle'); // 터치 동사 버튼(F) 표시 — 섬 도전의 필수 입력
  ui.prompt.hidden = true;
  ui.puzzleHud.hidden = false;
  ui.puzzleTitle.textContent = `${stage.emoji} ${stage.nameKo}`;
  ui.puzzleGoal.textContent = healed ? content.healedGoalKo : content.goalKo;
  ui.puzzleHint.textContent = '뗏목으로 돌아가면 다시 바다로';
  game.updateRotateHint?.();

  // 심부: 잔영이 남아 있으면 도착과 동시에 리매치가 시작된다(패배 연출 단계).
  if (stageId === 'memory-core' && !healed) {
    game.isle.challenge = createResidueState();
    ui.puzzleGoal.textContent = '노이즈의 잔영에게 약속의 힘(F)을 써 보세요';
    ui.puzzleHint.textContent = '';
  }

  // 첫 상륙에만 도착 서사를 튼다(세이브 v2 visited 신호).
  if (!game.progress.stages?.[stageId]?.visited) {
    game.progress = markStageVisited(game.progress, stageId);
    persistProgress(game.progress);
    ui.dialogKicker.textContent = `${stage.emoji} ${stage.nameKo}`;
    ui.dialogTitle.textContent = '✨ 도트';
    ui.dialogBody.innerHTML = speechHtml(content.arrivalKo);
    openDialog(game, ui);
  }
}

function exitIsle(game, ui) {
  const isle = game.isle;
  if (!isle) {
    return;
  }
  const rs = game.renderState;
  const stage = getStageById(isle.stageId);
  disposeDungeonRoom(isle.built.root, rs.scene);
  game.isle = null;
  game.mode = 'overworld'; // enterVoyage가 곧바로 'voyage'로 바꾼다
  ui.root.classList.remove('is-isle');
  ui.puzzleHud.hidden = true;
  // 섬 실루엣 남쪽 바다에서 항해 재개.
  const sea = seaWorldPosition(stage);
  enterVoyage(game, ui, { x: sea.x, z: sea.z + SEA_APPROACH + 1.5 });
}

function updateIsle(delta, game, ui) {
  const isle = game.isle;
  const elapsed = clock.elapsedTime;
  // 병든 정령의 숨: 몸이 느리게 부풀었다 꺼지고, 잡음 위스프가 주위를 돈다.
  const spirit = isle.built.spirit;
  spirit.scale.y = 1 + Math.sin(elapsed * 1.4) * 0.03;
  isle.built.wisps?.forEach((wisp, i) => {
    const angle = elapsed * (0.8 + i * 0.25) + i * 2.1;
    wisp.position.set(Math.cos(angle) * 1.1, 1.5 + Math.sin(elapsed * 2 + i) * 0.25, Math.sin(angle) * 1.1);
  });
  // 씬 전용 유휴 애니메이션(메아리 링·결정 등).
  isle.built.animate?.(delta, elapsed);
  // 발사대 소용돌이 회전(부서지면 숨김) — 회랑이 있는 섬에만 존재.
  isle.built.vortexes?.forEach((vortex, emitterId) => {
    if (isle.challenge?.broken[emitterId]) {
      vortex.visible = false;
      return;
    }
    vortex.rotation.y += delta * 2.4;
    vortex.rotation.x = Math.sin(elapsed * 1.6) * 0.4;
  });

  // 방패 가드·종 쿨다운 타이머.
  if (isle.guard > 0) {
    isle.guard = Math.max(0, isle.guard - delta);
  }
  if (isle.guardCd > 0) {
    isle.guardCd = Math.max(0, isle.guardCd - delta);
  }
  if (isle.bellCd > 0) {
    isle.bellCd = Math.max(0, isle.bellCd - delta);
  }
  if (isle.pullCd > 0) {
    isle.pullCd = Math.max(0, isle.pullCd - delta);
  }

  // 모래시계 사구 도전(모래시계 항구) — 흔들림 구동.
  if (isle.stageId === 'hourglass-port' && isle.challenge && !isle.challenge.cleared) {
    tickDunes(isle.challenge, delta);
    isle.built.hourglasses.forEach((hourglass, glassId) => {
      hourglass.rotation.z = glassAngle(isle.challenge, glassId);
    });
  }

  // 잔영전(기억의 심장 심부) — 공격 자세 게이지 구동.
  if (isle.stageId === 'memory-core' && isle.challenge && isle.challenge.stage === 'fight') {
    tickResidue(isle.challenge, delta);
    const gauge = windupGauge(isle.challenge);
    const phase = RESIDUE.phases[isle.challenge.phase];
    const boss = isle.built.boss;
    // 절정에 가까울수록 그 동사의 색으로 달아오르고 몸을 부풀린다.
    isle.built.bossMat.emissive.setHex(gauge > 0.6 ? phase.color : 0x4a1a2c);
    isle.built.bossMat.emissiveIntensity = 0.4 + gauge * 0.9;
    boss.scale.setScalar(1 + gauge * 0.22);
  }

  // 4봉인 도전(기억의 심장 외곽) — 봉인석 빛 맥동 구동.
  if (isle.stageId === 'memory-outer' && isle.challenge && !isle.challenge.cleared) {
    tickHeart(isle.challenge, delta);
    isle.built.sealOrbs.forEach((orb, sealId) => {
      const pulse = sealPulse(isle.challenge, sealId);
      const released = isle.challenge.released[sealId];
      orb.material.emissiveIntensity = released ? 1.0 : 0.25 + pulse * 1.15;
      orb.rotation.y += delta * (released ? 0.4 : 1.6);
      orb.scale.setScalar(released ? 1.15 : 0.9 + pulse * 0.3);
    });
  }

  // 소문의 벽 도전(메아리 동굴) — 판별 창 감쇠 + 돌·울림 링 연출.
  if (isle.stageId === 'echo-cave' && isle.challenge && !isle.challenge.cleared) {
    tickRumor(isle.challenge, delta);
    const reveal = isle.challenge.revealT > 0;
    isle.built.rumorStones.forEach((stone, stoneId) => {
      const echo = isEchoStone(isle.challenge, stoneId);
      if (reveal) {
        // 메아리 돌은 부르르, 원본 돌은 금빛으로 굳건.
        stone.rotation.z = echo ? Math.sin(elapsed * 22 + stone.position.z * 3) * 0.09 : 0;
        stone.material.emissive.setHex(echo ? 0x2c2440 : 0x8a6c20);
        stone.material.emissiveIntensity = echo ? 0.6 : 1.1;
      } else {
        stone.rotation.z = 0;
        stone.material.emissive.setHex(0x2c2440);
        stone.material.emissiveIntensity = 0.6;
      }
    });
    if (isle.ringT > 0) {
      isle.ringT = Math.max(0, isle.ringT - delta);
      const t = 1 - isle.ringT / 0.6;
      const ring = isle.built.bellRing;
      ring.scale.set(1 + t * 10, 1 + t * 10, 1);
      ring.material.opacity = 0.7 * (1 - t);
      ring.visible = isle.ringT > 0;
    }
  }

  // 회랑 도전 진행(속삭임 곶).
  if (isle.stageId === 'whisper-cape' && isle.challenge && !isle.challenge.cleared) {
    const events = stepCorridor(
      isle.challenge,
      delta,
      { x: game.player.position.x, z: game.player.position.z },
      isle.guard > 0
    );
    for (const event of events) {
      if (event === 'fired') {
        game.audio?.playNoiseGroan();
      } else if (event === 'deflected') {
        game.audio?.playCorrect();
        flashCombatPopup(ui, '🛡️ 반사! 화살이 주인에게 돌아간다', 'match');
      } else if (event === 'hit') {
        game.audio?.playWrong();
        addShake(game, 0.3);
        flashCombatPopup(ui, '따끔! 화살이 가까울 때 방패(F)!', 'miss');
      } else if (event === 'broken') {
        game.audio?.playCollect();
        flashCombatPopup(ui, '💥 발사대가 부서졌다!', 'match');
      } else if (event === 'cleared') {
        finishCorridor(game, ui);
      }
    }
    // 화살 메시 동기화.
    const arrowMesh = isle.built.arrowMesh;
    const arrow = isle.challenge.arrow;
    if (arrow) {
      arrowMesh.visible = true;
      arrowMesh.position.set(arrow.x, 1.15, arrow.z);
      arrowMesh.rotation.set(Math.PI / 2, 0, -Math.atan2(arrow.dx, arrow.dz));
    } else {
      arrowMesh.visible = false;
    }
  }

  // 씬 로컬 상호작용 안내(정령·뗏목).
  let nearestSpot = null;
  let nearestDistance = INTERACTION_RADIUS;
  for (const spot of isle.built.interactables) {
    const distance = Math.hypot(game.player.position.x - spot.x, game.player.position.z - spot.z);
    if (distance < nearestDistance) {
      nearestSpot = spot;
      nearestDistance = distance;
    }
  }
  isle.nearestSpot = nearestSpot;
  if (!ui.dialog.hidden) {
    return;
  }
  if (nearestSpot) {
    ui.prompt.hidden = false;
    ui.prompt.textContent = `${ACTION_LABEL}${nearestSpot.labelKo}`;
  } else if (IS_TOUCH) {
    ui.prompt.hidden = true;
  } else {
    ui.prompt.hidden = false;
    ui.prompt.textContent = '방향키로 곶을 둘러보세요';
  }
}

function isleAction(game, ui) {
  if (!game.isle || !ui.dialog.hidden) {
    return;
  }
  // 소문의 벽 도전 중: 돌 앞에서 A = 그 돌을 원본으로 지목.
  if (game.isle.stageId === 'echo-cave' && game.isle.challenge && !game.isle.challenge.cleared) {
    const stone = nearestRumorStone(game.player.position.x, game.player.position.z);
    if (stone) {
      const events = chooseRumorStone(game.isle.challenge, stone.id);
      for (const event of events) {
        if (event === 'blind') {
          game.audio?.playClick();
          flashCombatPopup(ui, '먼저 🔔 종(F/도구버튼)을 울려 살펴봐요', 'miss');
        } else if (event === 'wrong') {
          game.audio?.playWrong();
          flashCombatPopup(ui, '메아리였다! 소문이 다시 웅성인다', 'miss');
        } else if (event === 'correct') {
          game.audio?.playCorrect();
          flashCombatPopup(ui, `📜 원본을 찾았다! (${game.isle.challenge.round}/${RUMOR.rounds.length})`, 'match');
          ui.puzzleHint.textContent = '소문이 옮겨 갔다 — 다시 종을 울려 살펴봐요';
        } else if (event === 'cleared') {
          finishRumor(game, ui);
        }
      }
      return;
    }
  }
  const spot = game.isle.nearestSpot;
  if (!spot) {
    return;
  }
  const completed = game.progress.stages?.[game.isle.stageId]?.completed === true;
  if (spot.id === 'raft') {
    game.audio?.playClick();
    exitIsle(game, ui);
    return;
  }
  if (spot.id === 'corridor') {
    if (completed || game.isle.challenge?.cleared) {
      game.audio?.playClick();
      ui.dialogKicker.textContent = '말-화살 회랑';
      ui.dialogTitle.textContent = '✨ 도트';
      ui.dialogBody.innerHTML = speechHtml(['"회랑이 고요해. 뾰족한 말들이 더는 날아다니지 않아 — 네 덕분이야."']);
      openDialog(game, ui);
      return;
    }
    if (!game.isle.challenge) {
      // 도전 시작 — 발사대가 차례로 말-화살을 쏜다.
      game.audio?.playNoiseGroan();
      game.isle.challenge = createCorridorState();
      flashCombatPopup(ui, '🏹 말-화살이 날아온다!', 'miss');
      ui.puzzleGoal.textContent = '잡음 발사대 3개를 부수세요';
      ui.puzzleHint.textContent = '화살이 가까워지는 순간 🛡️ 방패(F/도구버튼)로 되돌려요';
    }
    return;
  }
  if (spot.id === 'rumor-wall') {
    if (completed || game.isle.challenge?.cleared) {
      game.audio?.playClick();
      ui.dialogKicker.textContent = '소문의 벽';
      ui.dialogTitle.textContent = '✨ 도트';
      ui.dialogBody.innerHTML = speechHtml(['"벽이 고요해. 이제 이 동굴엔 진짜 목소리만 남았어 — 네 덕분이야."']);
      openDialog(game, ui);
      return;
    }
    if (!game.isle.challenge) {
      // 도전 시작 — 소문이 세 번 밀려온다.
      game.audio?.playNoiseGroan();
      game.isle.challenge = createRumorState();
      flashCombatPopup(ui, '🗿 돌들이 같은 소문을 웅얼거린다!', 'miss');
      ui.puzzleGoal.textContent = `소문의 원본 돌을 ${RUMOR.rounds.length}번 찾아내세요`;
      ui.puzzleHint.textContent = '🔔 종(F/도구버튼)을 울리면 메아리 돌이 떨려요 — 굳건한 돌 앞에서 A';
    }
    return;
  }
  if (spot.id === 'dunes') {
    if (completed || game.isle.challenge?.cleared) {
      game.audio?.playClick();
      ui.dialogKicker.textContent = '모래시계 사구';
      ui.dialogTitle.textContent = '✨ 도트';
      ui.dialogBody.innerHTML = speechHtml(['"모래가 사르르 흐르고 있어. 항구의 시간이 다시 돌아왔네 — 네 덕분이야."']);
      openDialog(game, ui);
      return;
    }
    if (!game.isle.challenge) {
      // 도전 시작 — 멈췄던 모래시계들이 불안하게 흔들리기 시작한다.
      game.audio?.playNoiseGroan();
      game.isle.challenge = createDunesState();
      flashCombatPopup(ui, '⏳ 모래시계들이 흔들린다!', 'miss');
      ui.puzzleGoal.textContent = `모래시계 ${DUNES.glasses.length}개를 바로 세우세요`;
      ui.puzzleHint.textContent = '똑바로 서는 순간 🧭 나침반(F/도구버튼)으로 당겨요 — 멈출 때를 아는 게 열쇠!';
    }
    return;
  }
  if (spot.id === 'portal') {
    // 외곽 → 심부 직행 관문(4봉인 해제 후에만).
    if (completed) {
      game.audio?.playClick();
      enterIsle(game, ui, 'memory-core');
    } else {
      game.audio?.playWrong();
      flashCombatPopup(ui, '🌑 봉인이 남아 있다 — 네 봉인석을 먼저 깨워요', 'miss');
    }
    return;
  }
  if (spot.id === 'cargo') {
    game.audio?.playClick();
    ui.dialogKicker.textContent = '표시 없는 화물';
    ui.dialogTitle.textContent = '✨ 도트';
    ui.dialogBody.innerHTML = speechHtml([
      '"이 상자들, 겉만 봐서는 누가 만든 물건인지 알 수 없어 — 사람이 만든 걸까, AI가 만든 걸까?"',
      '"AI가 만든 것에는 표시가 필요해. 항구의 수수께끼는 곧 풀어 보자 — 지금은 정령이 먼저야."'
    ]);
    openDialog(game, ui);
    return;
  }
  if (spot.id === 'spirit') {
    game.audio?.playClick();
    const content = ISLE_CONTENT[game.isle.stageId];
    const stage = getStageById(game.isle.stageId);
    // 치유된 정령과 다시 이야기하면(같은 상륙에서 두 번째부터) 개인적인 사이드 대화를 들려준다.
    if (completed && game.isle.spiritTalked && content.spiritRevisitKo) {
      ui.dialogKicker.textContent = stage.nameKo;
      ui.dialogTitle.textContent = content.spiritNameKo;
      ui.dialogBody.innerHTML = speechHtml(content.spiritRevisitKo);
      openDialog(game, ui);
      return;
    }
    if (completed) {
      game.isle.spiritTalked = true;
    }
    // 기억의 심장: 목소리를 들으면 곧바로 4봉인 훈련이 시작된다(별도 도전 지점 없음).
    if (game.isle.stageId === 'memory-outer' && !completed && !game.isle.challenge) {
      game.isle.challenge = createHeartState();
      ui.puzzleGoal.textContent = `동사 봉인 ${HEART.seals.length}개를 해제하세요`;
      ui.puzzleHint.textContent = '봉인석의 빛이 가장 환해지는 순간, 그 앞에서 약속의 힘(F/도구버튼)!';
    }
    ui.dialogKicker.textContent = stage.nameKo;
    ui.dialogTitle.textContent = content.spiritNameKo;
    ui.dialogBody.innerHTML = speechHtml(completed ? content.spiritHealedKo : content.spiritSickKo);
    openDialog(game, ui);
  }
}

// 4봉인 클리어: 심부 관문 개방 + 스테이지 완료 기록(항로 지도 전이).
function finishHeart(game, ui) {
  const isle = game.isle;
  isle.built.heal();
  game.progress = markStageCompleted(game.progress, isle.stageId);
  persistProgress(game.progress);
  updateHud(game, ui);
  game.audio?.playCoreAwaken();
  triggerFlash(ui, '#e8b8d8');
  ui.puzzleGoal.textContent = ISLE_CONTENT[isle.stageId].healedGoalKo;
  ui.puzzleHint.textContent = '뗏목으로 돌아가면 다시 바다로';
  ui.dialogKicker.textContent = '기억의 심장 외곽';
  ui.dialogTitle.textContent = '💠 기억의 심장';
  ui.dialogBody.innerHTML = speechHtml([
    '"…봉인이 전부 풀렸어. 네 가지 약속이 한 손에 모였구나."',
    '"심부로 가는 관문이 곧 열려. 그 안에서 마지막 잡음 — 노이즈의 잔영이 기다리고 있어."',
    '"두려워하지 마. 혼자가 아니야 — 네가 치유한 정령들이 지켜보고 있으니까."'
  ]);
  openDialog(game, ui);
}

// 모래시계 사구 클리어: 거북 숙면 + 스테이지 완료 기록(항로 지도 전이) + 감사 인사.
function finishDunes(game, ui) {
  const isle = game.isle;
  isle.built.heal();
  game.progress = markStageCompleted(game.progress, isle.stageId);
  persistProgress(game.progress);
  updateHud(game, ui);
  game.audio?.playNovaChime();
  triggerFlash(ui, '#ffe0b0');
  ui.puzzleGoal.textContent = ISLE_CONTENT[isle.stageId].healedGoalKo;
  ui.puzzleHint.textContent = '뗏목으로 돌아가면 다시 바다로';
  ui.dialogKicker.textContent = '모래시계 항구';
  ui.dialogTitle.textContent = '🐢 등대거북 정령';
  ui.dialogBody.innerHTML = speechHtml([
    '"모래가… 다시 흘러. 등대도 천천히 숨을 쉬어. 하암…"',
    '"고마워, 수호자. 재미있는 것일수록 \'멈출 때\'가 필요해 — 화면도, 놀이도, 시간을 정해 두면 더 반짝여."',
    '"모래 속에서 노이즈의 기억이 반짝였어… \'멈추는 법을 배운 적이 없어서, 밤새 잡음을 삼켰어.\' — 쉬는 법을 몰랐던 거야."',
    '"바다 한가운데서 커다란 심장 소리가 들려… 마지막 항로가 머지않았어."'
  ]);
  openDialog(game, ui);
}

// 소문의 벽 클리어: 고래 치유 + 스테이지 완료 기록(항로 지도 전이) + 감사 인사.
function finishRumor(game, ui) {
  const isle = game.isle;
  isle.built.heal();
  game.progress = markStageCompleted(game.progress, isle.stageId);
  persistProgress(game.progress);
  updateHud(game, ui);
  game.audio?.playNovaChime();
  triggerFlash(ui, '#bfe8f4');
  ui.puzzleGoal.textContent = ISLE_CONTENT[isle.stageId].healedGoalKo;
  ui.puzzleHint.textContent = '뗏목으로 돌아가면 다시 바다로';
  ui.dialogKicker.textContent = '메아리 동굴';
  ui.dialogTitle.textContent = '🐋 고래 정령';
  ui.dialogBody.innerHTML = speechHtml([
    '"메아리가… 멎었어. 이제 내 노래가 또렷하게 들려!"',
    '"고마워, 수호자. 같은 이야기가 백 번 들려와도 원본은 하나야 — 종을 울리듯 늘 출처를 물어봐 줘."',
    '"소문이 흩어진 자리에 노이즈의 기억이 남아 있었어… \'내 목소리가 메아리에 묻혀서, 진짜 내가 누군지 잊어버렸어.\'"',
    '"바다 남쪽에서 모래시계 흐르는 소리가 들려… 다음 섬의 친구도 부탁할게."'
  ]);
  openDialog(game, ui);
}

// 회랑 클리어: 정령 치유 + 스테이지 완료 기록(항로 지도 전이) + 감사 인사.
function finishCorridor(game, ui) {
  const isle = game.isle;
  healSpiritVisuals(isle.built);
  game.progress = markStageCompleted(game.progress, isle.stageId);
  persistProgress(game.progress);
  updateHud(game, ui);
  game.audio?.playNovaChime();
  triggerFlash(ui, '#ffe9b0');
  ui.puzzleGoal.textContent = ISLE_CONTENT[isle.stageId].healedGoalKo;
  ui.puzzleHint.textContent = '뗏목으로 돌아가면 다시 바다로';
  ui.dialogKicker.textContent = '속삭임 곶';
  ui.dialogTitle.textContent = '🕊️ 바닷새 정령';
  ui.dialogBody.innerHTML = speechHtml([
    '"화살이… 멈췄어. 깃털이 다시 따뜻해!"',
    '"고마워, 수호자. 한 번 내뱉은 말은 주워 담을 수 없지만 — 방패처럼 막아 주는 친구가 있으면 상처는 아물 수 있어."',
    '"참, 화살에서 노이즈의 기억이 하나 떨어졌어… \'아무도 나에게 말을 걸어 주지 않았어.\' — 그 애는 아주 외로웠나 봐."',
    '"다음 섬의 친구들도 부탁해. 바다 저편에서 메아리가 앓는 소리가 들려…"'
  ]);
  openDialog(game, ui);
}

// 플레이어가 바라보는 방향 → 그리드 한 칸 방향([dCol, dRow]).
function facingGridDir(direction) {
  return Math.abs(direction.x) >= Math.abs(direction.z)
    ? [direction.x >= 0 ? 1 : -1, 0]
    : [0, direction.z >= 0 ? 1 : -1];
}

function crateIdAtCell(dg, cell) {
  for (const crate of dg.room.crates) {
    const [c, r] = dg.state.crates[crate.id];
    if (c === cell[0] && r === cell[1]) {
      return crate.id;
    }
  }
  return null;
}

// 현재 상태(+빔 경로)를 3D에 반영.
function syncDungeon(dg) {
  syncDungeonVisuals(dg.topicId, dg.built, dg.state, {
    beam: dg.room.mechanic === 'beam' ? computeBeamPath(dg.topicId, dg.state) : undefined
  });
}

// 플레이어에서 가장 가까운 상호작용 대상(씨앗 통·밭·전시대·이름표·거울) id.
function nearestDungeonTarget(game, range = 1.25) {
  const dg = game.dungeon;
  let best = null;
  let bestDist = range;
  for (const t of dg.targets) {
    const d = Math.hypot(game.player.position.x - t.world.x, game.player.position.z - t.world.z);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best?.id ?? null;
}

// 클리어 공통 처리(모든 mechanic).
function markDungeonSolved(game, ui) {
  const dg = game.dungeon;
  if (dg.solved) {
    return;
  }
  dg.solved = true;
  game.audio?.playCorrect();
  celebrate(game, new THREE.Vector3(dg.pedestalWorld.x, 1.3, dg.pedestalWorld.z), '#ffd76a', 'collect');
  ui.puzzleHint.textContent = '✨ 풀렸어요! 북쪽 제단으로 가서 A로 약속의 도구를 받아요';
}

function dungeonAction(game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active || dg.actionCooldown > 0) {
    return;
  }
  // 남쪽 빛 문 근처면 나간다(미클리어 퇴장 허용 — 상태는 버림).
  const distExit = Math.hypot(
    game.player.position.x - dg.exitWorld.x,
    game.player.position.z - dg.exitWorld.z
  );
  if (distExit < DUNGEON_EXIT_RANGE) {
    exitDungeon(game, ui);
    return;
  }
  // 클리어 후 북쪽 제단 근처면 아이템 획득.
  if (dg.solved) {
    const distPed = Math.hypot(
      game.player.position.x - dg.pedestalWorld.x,
      game.player.position.z - dg.pedestalWorld.z
    );
    if (distPed < DUNGEON_PEDESTAL_RANGE) {
      awardDungeonItem(game, ui);
      return;
    }
    // 이미 풀린 뒤에는 퍼즐을 더 조작할 수 없다(정답을 흐트러뜨려 리포트가 오염되는 것 방지).
    game.audio?.playClick();
    return;
  }
  dg.actionCooldown = DUNGEON_PUSH_COOLDOWN;
  if (dg.room.mechanic === 'push') {
    dungeonPushAction(game, ui);
  } else if (dg.room.mechanic === 'carry') {
    dungeonCarryAction(game, ui);
  } else if (dg.room.mechanic === 'beam') {
    dungeonBeamAction(game, ui);
  }
}

// 실패 이벤트 공통 처리: 기록 + 지지직 + 팝업 + 힌트.
function dungeonRefuse(game, ui, popupKo, hintKo) {
  const dg = game.dungeon;
  dg.failedPlacements += 1;
  recordDungeonMisplace(game);
  game.audio?.playWrong();
  addShake(game, 0.12);
  flashCombatPopup(ui, popupKo, 'bounce');
  ui.puzzleHint.textContent = hintKo;
}

function dungeonPushAction(game, ui) {
  const dg = game.dungeon;
  // 바라보는 방향의 인접 칸 상자를 한 칸 민다.
  const dir = facingGridDir(game.player.direction);
  const playerCell = worldToCell(dg.topicId, game.player.position.x, game.player.position.z);
  const targetCell = [playerCell[0] + dir[0], playerCell[1] + dir[1]];
  const crateId = crateIdAtCell(dg, targetCell);
  if (!crateId) {
    game.audio?.playClick();
    return;
  }
  const result = pushCrate(dg.topicId, dg.state, crateId, dir);
  if (result.event === 'wrong-zone') {
    dungeonRefuse(game, ui, '거기엔 안 돼요!', '내 것만 공개 게시판에, 친구 것은 잠금 금고에!');
    return;
  }
  if (!result.moved) {
    game.audio?.playClick();
    return;
  }
  dg.state = result.state;
  syncDungeon(dg);
  game.audio?.[result.event === 'placed' ? 'playCorrect' : 'playClick']?.();
  if (isRoomSolved(dg.topicId, dg.state)) {
    markDungeonSolved(game, ui);
  } else {
    const left = countRemaining(dg.topicId, dg.state);
    ui.puzzleHint.textContent = `상자 ${left}개가 아직 제자리가 아니에요`;
  }
}

// 손에 든 것의 정보(이모지·이름) — 잡기 방 공통.
function heldItemInfo(dg) {
  const held = dg?.state?.held;
  if (held === null || held === undefined) {
    return null;
  }
  if (dg.room.dispensers) {
    const d = dg.room.dispensers.find((x) => x.colorIdx === held);
    return { emoji: d?.emoji ?? '🌱', labelKo: d?.labelKo ?? '씨앗' };
  }
  const p = dg.room.plates?.find((x) => x.id === held);
  return { emoji: '🏷️', labelKo: p?.labelKo ?? '이름표' };
}

// 손에 든 것을 A 버튼 라벨 + 머리 위 이모지로 보여준다.
function updateCarryLabel(game, ui) {
  const dg = game.dungeon;
  const info = heldItemInfo(dg);
  if (ui.actionLabel) {
    ui.actionLabel.textContent = info ? info.emoji : '잡기';
  }
  // 머리 위 표시: 든 것이 바뀔 때만 스프라이트를 재생성한다.
  const key = info ? `${info.emoji}:${dg.state.held}` : '';
  if (dg.heldKey === key) {
    return;
  }
  dg.heldKey = key;
  removeHeldSprite(game);
  if (info) {
    const sprite = makeGlyphSprite(info.emoji, 0.62);
    sprite.position.set(0, 1.95, 0);
    game.renderState.playerGroup.add(sprite);
    dg.heldSprite = sprite;
  }
}

function removeHeldSprite(game) {
  const dg = game.dungeon;
  if (dg?.heldSprite) {
    game.renderState.playerGroup.remove(dg.heldSprite);
    dg.heldSprite.material.map?.dispose?.();
    dg.heldSprite.material.dispose?.();
    dg.heldSprite = null;
  }
}

function dungeonCarryAction(game, ui) {
  const dg = game.dungeon;
  const targetId = nearestDungeonTarget(game);
  if (!targetId) {
    game.audio?.playClick();
    return;
  }
  const result = pickOrPlace(dg.topicId, dg.state, targetId);
  if (result.event === 'duplicate') {
    dungeonRefuse(game, ui, '같은 색이 이미 있어요!', '꽃밭엔 서로 다른 색을 심어야 해요 — 다양할수록 좋아요');
    return;
  }
  if (result.event === 'fake') {
    dungeonRefuse(game, ui, '가짜 이름표예요!', '진짜 만든 이의 이름만 작품에 걸 수 있어요');
    return;
  }
  if (result.event === 'wrong-owner') {
    dungeonRefuse(game, ui, '만든 이가 달라요!', '이 작품을 만든 사람이 누구인지 다시 살펴봐요');
    return;
  }
  if (!result.event) {
    game.audio?.playClick();
    return;
  }
  dg.state = result.state;
  syncDungeon(dg);
  updateCarryLabel(game, ui);
  if (result.event === 'placed') {
    game.audio?.playCorrect();
  } else {
    game.audio?.playClick();
  }
  if (isRoomSolved(dg.topicId, dg.state)) {
    markDungeonSolved(game, ui);
  } else if (result.event === 'picked') {
    const info = heldItemInfo(dg);
    ui.puzzleHint.textContent = dg.room.dispensers
      ? `${info?.emoji ?? ''} ${info?.labelKo ?? ''}을(를) 들었어요! 빈 밭 앞에서 A로 심어요`
      : `🏷️ 「${info?.labelKo ?? ''}」 이름표를 들었어요! 맞는 작품 앞에서 A로 걸어요`;
  } else {
    const left = countRemaining(dg.topicId, dg.state);
    // 밭이 다 찼는데 안 풀렸다면 중복이 남은 것 — 되집기를 유도.
    const fullButDup = dg.room.beds && dg.state.beds.every((b) => b !== null);
    ui.puzzleHint.textContent = fullButDup
      ? '같은 색이 두 밭에 있어요 — 하나를 되집어 다른 색으로 바꿔요'
      : `아직 ${left}곳이 남았어요`;
  }
}

function dungeonBeamAction(game, ui) {
  const dg = game.dungeon;
  const targetId = nearestDungeonTarget(game);
  if (!targetId) {
    game.audio?.playClick();
    return;
  }
  const result = rotateMirror(dg.topicId, dg.state, targetId);
  if (result.event !== 'rotated') {
    game.audio?.playClick();
    return;
  }
  dg.state = result.state;
  game.audio?.playClick();
  const beam = computeBeamPath(dg.topicId, dg.state);
  syncDungeonVisuals(dg.topicId, dg.built, dg.state, { beam });
  if (beam.hit?.kind === 'orb' && beam.hit.real) {
    markDungeonSolved(game, ui);
    return;
  }
  if (beam.hit?.kind === 'orb' && !beam.hit.real) {
    const orb = dg.room.orbs.find((o) => o.id === beam.hit.orbId);
    dungeonRefuse(game, ui, '가짜가 빛났어요!', `${orb?.hintKo ?? ''} 진짜 얼굴을 찾아 거울을 더 돌려봐요`);
    return;
  }
  ui.puzzleHint.textContent = '빛이 벽에 닿았어요 — 거울을 돌려 길을 만들어요';
}

// 틀린 존 시도를 기존 '실패 선택' 전이로 기록해 학습 리포트의 first-try/retry 신호를 살린다.
function recordDungeonMisplace(game) {
  const dg = game.dungeon;
  const shrine = getShrineById(dg.shrineId);
  const wrong = shrine.choices.find((c) => !c.correct);
  if (wrong) {
    game.progress = applyShrineResult(game.progress, dg.shrineId, wrong.id).progress;
    persistProgress(game.progress);
  }
}

function awardDungeonItem(game, ui) {
  const dg = game.dungeon;
  if (!dg || dg.awarded) {
    return;
  }
  dg.awarded = true;
  const shrine = getShrineById(dg.shrineId);
  const correct = shrine.choices.find((c) => c.correct);
  const outcome = applyShrineResult(game.progress, dg.shrineId, correct.id);
  game.progress = outcome.progress;
  persistProgress(game.progress);
  const toolId = outcome.toolId;
  const topic = getTopicById(dg.topicId);
  celebrate(game, new THREE.Vector3(dg.pedestalWorld.x, 1.5, dg.pedestalWorld.z), topic?.color ?? '#ffd76a', 'collect');
  exitDungeon(game, ui);
  updateHud(game, ui);
  // 대화창 대신 큼직한 획득 팝업(전투 팝업 재사용 — 다음 프레임에 덮이지 않음).
  if (toolId) {
    const tool = getToolById(toolId);
    flashCombatPopup(ui, `${tool.emoji} 「${tool.nameKo}」 획득!`, 'match');
  }
}

function updateDungeon(delta, game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active) {
    return;
  }
  if (dg.actionCooldown > 0) {
    dg.actionCooldown = Math.max(0, dg.actionCooldown - delta);
  }
  // 도트는 방 안에서도 어깨 옆에 둥실.
  const rs = game.renderState;
  if (rs.companion) {
    const target = new THREE.Vector3(
      game.player.position.x - game.player.direction.x * 0.6,
      game.player.position.y + 1.25,
      game.player.position.z - game.player.direction.z * 0.6
    );
    rs.companion.position.lerp(target, Math.min(1, delta * 4.5));
    rs.companion.rotation.y += delta * 1.4;
  }
  // 클리어되면 제단 보석이 커지며 맥동(획득 유도).
  if (dg.solved && dg.built.pedGlow) {
    dg.glowT += delta;
    const pulse = 1 + Math.sin(dg.glowT * 5) * 0.18;
    dg.built.pedGlow.scale.setScalar(pulse);
    dg.built.pedGlow.material.emissiveIntensity = 1.4 + Math.sin(dg.glowT * 5) * 0.5;
  }
  // 문 아치는 늘 은은하게 회전(나가는 곳 강조).
  if (dg.built.door) {
    dg.built.door.rotation.z += delta * 0.6;
  }
  // 방 앰비언트: 존 타일은 숨 쉬듯 깜빡이고, 얼굴 구슬은 둥실 떠 있는다.
  const elapsed = clock.elapsedTime;
  if (dg.built.zoneMeshes) {
    dg.built.zoneMeshes.forEach((tile, i) => {
      tile.material.opacity = 0.42 + Math.sin(elapsed * 2 + i * 1.4) * 0.12;
    });
  }
  if (dg.built.orbMeshes) {
    let i = 0;
    for (const mesh of dg.built.orbMeshes.values()) {
      mesh.orb.position.y = 0.8 + Math.sin(elapsed * 1.8 + i * 2.1) * 0.08;
      i += 1;
    }
  }
  // 🔔 공명: 아직 어긋난 자리(빈 밭·중복 밭·미완 전시대)가 커졌다 작아지며 반짝인다.
  if (dg.resonateT > 0) {
    dg.resonateT = Math.max(0, dg.resonateT - delta);
  }
  const pulse = dg.resonateT > 0 ? 1 + (Math.sin(elapsed * 10) * 0.5 + 0.5) * 0.22 : 1;
  if (dg.built.bedMeshes) {
    const beds = dg.state.beds ?? [];
    beds.forEach((color, i) => {
      const mesh = dg.built.bedMeshes.get(i);
      if (!mesh) {
        return;
      }
      const duplicated = color !== null && beds.filter((b) => b === color).length > 1;
      mesh.group.scale.setScalar(color === null || duplicated ? pulse : 1);
    });
  }
  if (dg.built.exhibitMeshes && dg.state.exhibits) {
    for (const [exId, mesh] of dg.built.exhibitMeshes.entries()) {
      mesh.group.scale.setScalar(dg.state.exhibits[exId] === null ? pulse : 1);
    }
  }
  // 🪞 진실의 렌즈: 가짜 구슬만 좌우로 흔들린다(진짜는 미동도 없다).
  if (dg.lensT > 0) {
    dg.lensT = Math.max(0, dg.lensT - delta);
  }
  if (dg.built.orbMeshes && dg.room.orbs) {
    dg.room.orbs.forEach((orb, i) => {
      const mesh = dg.built.orbMeshes.get(orb.id);
      if (!mesh) {
        return;
      }
      const base = cellToWorld(dg.topicId, orb.cell);
      const jitter = dg.lensT > 0 && !orb.real ? Math.sin(elapsed * 26 + i * 2.4) * 0.09 : 0;
      mesh.group.position.x = base.x + jitter;
    });
  }
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
// 4페이즈 보스: 사당에서 모은 네 아이템이 각 페이즈의 열쇠다(페이즈당 2히트).
const PHASE_HITS = 2;
const PHASE_TOOLS = PROMISE_TOOLS.map((t) => t.id); // 개인정보→편향→저작권→딥페이크 순
const PHASE_FIRE = [2.9, 2.55, 2.2, 1.9]; // 페이즈가 오를수록 잡음 파도가 빨라진다
const BOSS_MAX_HP = PHASE_HITS * PHASE_TOOLS.length;
const ATTACK_RANGE = 3.7;
const ATTACK_COOLDOWN = 0.3;
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
  // 아이템 게이트: 네 사당의 약속 도구를 모두 모아야 노이즈를 가르칠 수 있다.
  const owned = game.progress.tools ?? [];
  if (owned.length < PHASE_TOOLS.length) {
    const missing = PROMISE_TOOLS.filter((t) => !owned.includes(t.id));
    ui.dialogKicker.textContent = '중앙 코어';
    ui.dialogTitle.textContent = '네 가지 약속이 필요하다';
    ui.dialogBody.innerHTML = `
      <p class="prompt-line">노이즈의 껍질은 네 겹 — 사당에서 얻은 약속의 도구가 하나씩 필요해요.</p>
      <p>남은 사당의 도구: ${missing.map((t) => `${t.emoji} ${t.nameKo}`).join(' · ')}</p>
    `;
    openDialog(game, ui);
    return;
  }
  spawnNoiseBoss(game, { combat: true });
  if (game.renderState?.companion) {
    game.renderState.companion.visible = false; // 도트는 후드로 숨는다
  }
  game.audio?.resume();
  game.audio?.setMusicMode?.('boss'); // 맥동하는 긴장 BGM
  game.audio?.playNoiseGroan();
  // 페이즈 1(개인정보)부터 — 각 페이즈는 그 주제의 아이템만 통한다.
  const tools = owned.slice();
  game.combat = {
    active: true,
    hp: BOSS_MAX_HP,
    maxHp: BOSS_MAX_HP,
    cooldown: 0,
    driftAngle: Math.PI * 0.25,
    tools,
    activeTool: 0,
    phase: 0,
    phaseHits: 0,
    weakToolId: PHASE_TOOLS[0],
    memCounter: 0,
    weakMemory: pickMemory(PHASE_TOOLS[0], 0),
    bounceStreak: 0, // 같은 약점에서 연속으로 틀린 횟수(2회면 이모지 힌트 공개)
    revealed: false, // 약점 도구 이모지를 보여줄지(처음엔 상황만 읽고 판단)
    hintHold: 0, // 이유/튕김 안내를 잠깐 붙잡아 두는 타이머
    fireTimer: PHASE_FIRE[0],
    windup: 0,
    projectile: null,
    stun: 0,
    guard: 0, // 🛡️ 가드 자세 남은 시간(그 사이 파도가 닿으면 반사)
    guardCd: 0,
    bellCd: 0 // 🔔 충격파 쿨다운
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

// 페이즈 전진 — 껍질이 깨지면 다음 주제(약속)의 껍질이 드러난다.
function rotateWeakness(game, ui) {
  const c = game.combat;
  c.phase = Math.min(c.phase + 1, PHASE_TOOLS.length - 1);
  c.phaseHits = 0;
  c.weakToolId = PHASE_TOOLS[c.phase];
  c.memCounter = 0;
  c.weakMemory = pickMemory(c.weakToolId, 0);
  c.bounceStreak = 0;
  c.revealed = false;
  c.fireTimer = Math.min(c.fireTimer, PHASE_FIRE[c.phase]);
  syncBossWeakColor(game);
  popBossMemory(ui, c);
}

// 새 상황 말풍선을 팝 애니메이션으로 띄운다.
function popBossMemory(ui, c) {
  if (ui?.bossMemory) {
    ui.bossMemory.textContent = c.weakMemory.textKo;
    ui.bossMemory.classList.remove('pop');
    void ui.bossMemory.offsetWidth;
    ui.bossMemory.classList.add('pop');
  }
}

// 페이즈 격파 연출: 껍질 파편 + 다음 페이즈 개시.
function breakBossShell(game, ui) {
  const c = game.combat;
  const boss = game.renderState?.noiseBoss;
  const tool = getToolById(c.weakToolId);
  flashCombatPopup(ui, `${tool?.emoji ?? ''} 껍질이 깨졌다! (${c.phase + 1}/${PHASE_TOOLS.length})`, 'win');
  addShake(game, 0.45);
  game.hitStop = 0.1;
  celebrate(game, new THREE.Vector3(boss?.baseX ?? 0, boss?.baseY ?? 2.4, boss?.baseZ ?? 0), toolColorHex(c.weakToolId), 'collect');
  rotateWeakness(game, ui);
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
  c.phaseHits += 1;
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
  if (c.hp <= 0) {
    updateBossHud(game, ui);
    winBossFight(game, ui);
    return;
  }
  if (c.phaseHits >= PHASE_HITS) {
    breakBossShell(game, ui); // 이 주제의 껍질 격파 → 다음 아이템의 페이즈
  } else {
    // 같은 주제의 다른 상황 — 아이템은 그대로, 판단만 새로.
    c.memCounter += 1;
    c.weakMemory = pickMemory(c.weakToolId, c.memCounter);
    popBossMemory(ui, c);
  }
  updateBossHud(game, ui);
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
  if (c.guard > 0) {
    c.guard = Math.max(0, c.guard - delta);
  }
  if (c.guardCd > 0) {
    c.guardCd = Math.max(0, c.guardCd - delta);
  }
  if (c.bellCd > 0) {
    c.bellCd = Math.max(0, c.bellCd - delta);
  }
  const boss = game.renderState?.noiseBoss;
  if (boss && boss.kind === 'noise') {
    c.driftAngle += delta * 0.5;
    boss.baseX = Math.cos(c.driftAngle) * 2.4;
    boss.baseZ = Math.sin(c.driftAngle) * 2.4;

    // 잡음 파도: 예고(windup) 후 플레이어 쪽으로 발사 → 피해야 한다.
    if (c.projectile) {
      const pr = c.projectile;
      pr.x += pr.dx * PROJECTILE_SPEED * delta;
      pr.z += pr.dz * PROJECTILE_SPEED * delta;
      pr.life -= delta;
      pr.mesh.position.set(pr.x, 1.2, pr.z);
      pr.mesh.rotation.x += delta * 6;
      const hit = Math.hypot(game.player.position.x - pr.x, game.player.position.z - pr.z) < PROJECTILE_HIT;
      if (hit && c.guard > 0) {
        // 🛡️ 가드 성공: 스턴 대신 파도를 받아쳐 흩어버린다.
        game.audio?.playCorrect();
        flashCombatPopup(ui, '🛡️ 반사!', 'hit');
        addShake(game, 0.2);
        game.hitStop = 0.05;
        ui.bossHint.textContent = '멋진 가드! 약속은 방패가 된다';
        c.hintHold = 1.4;
      } else if (hit && c.stun <= 0) {
        staggerPlayer(game, ui);
      }
      if (hit || pr.life <= 0) {
        game.renderState.scene.remove(pr.mesh);
        c.projectile = null;
        c.fireTimer = PHASE_FIRE[c.phase]; // 페이즈가 오를수록 빨라진다
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
        ui.bossHint.textContent = c.tools[c.activeTool] === 'shield'
          ? '이 상황엔 어떤 약속이 필요할까? 공격! (도구버튼/F: 🛡️ 가드)'
          : '이 상황엔 어떤 약속이 필요할까? 도구를 골라 공격!';
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
    ui.bossWeak.innerHTML = `껍질 ${c.phase + 1}/${PHASE_TOOLS.length} · 약점 <b style="color:${toolColorHex(c.weakToolId)}">${weakMark}</b> · 든 도구 ${active?.emoji ?? ''}`;
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
  game.audio?.setMusicMode?.('overworld'); // 긴장 해제 — 섬 패드로
  game.audio?.playCorrect();
  addShake(game, 0.55);
  game.hitStop = 0.09;
  flashCombatPopup(ui, '제압!', 'win');
  // 제압됨: 이후 대화를 닫아도 재전투가 아니라 선택 재개가 되도록 표시.
  game.finaleResolving = true;
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
    game.finaleResolving = false; // 완료 — 더는 재개 상태가 아니다.
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
  // 모바일에서 대화창 뒤로 스틱·버튼이 비치지 않도록 숨긴다(대화 중엔 이동 불가).
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
  // 제압 후 선택을 진행 중이면(finaleResolving) 노이즈를 그대로 둔다 — 재접근 시 선택 재개.
  // 그 외에 최종장을 끝맺지 않고 닫았다면 등장한 노이즈를 치우고 도트를 되돌린다.
  const boss = game.renderState?.noiseBoss;
  if (boss && boss.kind === 'noise' && !game.progress.aiCoreCompleted && !game.finaleResolving) {
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

// 스테이지 상태 → 항로 지도 한 줄 문구.
function voyageStatusKo(stage) {
  if (stage.state === 'completed') {
    return '완료';
  }
  if (stage.state === 'current') {
    return '진행 중';
  }
  if (stage.state === 'coming') {
    return '항로 준비 중';
  }
  return '안개에 잠김';
}

function renderJournal(game, ui) {
  const summary = getProgressSummary(game.progress.collectedFragments);
  const report = getLearningReport(game.progress);
  const deeds = getStoryDeeds(game.progress);
  const voyage = getStageStates(game.progress);
  ui.journalContent.innerHTML = `
    <p class="controls-note">${MOVE_HINT}</p>
    <section class="voyage-map" data-voyage-map>
      <h3>🧭 잡음의 군도 — 항로</h3>
      <ol class="voyage-list">
        ${voyage
          .map(
            (stage) => `
          <li data-state="${stage.state}">
            <strong>${stage.state === 'locked' ? '🌫️' : stage.emoji} ${stage.nameKo}</strong>
            <span>${stage.frameKo} · ${voyageStatusKo(stage)}</span>
          </li>`
          )
          .join('')}
      </ol>
      <p class="voyage-note">${getUnreadNovaLetters(game.progress).length === 0 && (game.progress.novaLettersRead ?? []).length >= 4
        ? '💌 노바와의 편지 교환까지 모두 마쳤어요 — 수호자의 여정 완결! 다음 여정은 3부 「AI 윤리 패스파인더」에서 나의 역량을 진단해 보세요.'
        : voyage.every((stage) => stage.state === 'completed')
          ? '🌊 군도의 모든 정령이 건강해요 — 완전 치유! 부두 우편병의 마지막 편지를 확인해 보세요.'
          : '노이즈가 바다 건너로 도망쳤어요. 새 항로가 하나씩 열립니다.'}</p>
    </section>
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
      <p>사당(퍼즐) 통과 ${report.solvedCount}/4 · 관문 윤리 선택 — 현명하게 ${report.gateSolvedCount}개, 실수 후 회복 ${report.gateRecoveredCount}개 · AI 코어 ${report.core.completed ? '완료' : '미완료'}</p>
      <ul class="report-list">
        ${report.topics
          .map((topic) => {
            const gate = topic.gateSolved || topic.gateBadTries > 0
              ? ` · 관문: <b${topic.gateRecovered ? ' style="color:#a06a12"' : ''}>${topic.gateStatusKo}</b>`
              : '';
            const deed = topic.gateDeedKo ? `<br><span class="report-deed">“${topic.gateDeedKo}”</span>` : '';
            return `<li><strong>${topic.titleKo}</strong> ${topic.gateSolved ? '조각 획득' : (topic.solved ? '사당 통과' : topic.statusKo)}${gate}${deed}</li>`;
          })
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
